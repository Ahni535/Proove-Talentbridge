import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});

const jsonResponse = (status: number, body: Record<string, unknown>, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" }
  });

Deno.serve(async (request: Request) => {
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");
  if (!allowedOrigin) {
    return jsonResponse(500, { error: "ALLOWED_ORIGIN is not configured for this function." }, {});
  }

  const origin = request.headers.get("origin") || "";
  const headers = corsHeaders(allowedOrigin);

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers });
  }
  if (origin !== allowedOrigin) {
    return jsonResponse(403, { error: "This website origin is not allowed." }, headers);
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Use POST to review a payment." }, headers);
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return jsonResponse(401, { error: "Sign in with an administrator account first." }, headers);
  }

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    return jsonResponse(500, { error: "Supabase function secrets are not configured." }, headers);
  }

  const authClient = createClient(projectUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse(401, { error: "The sign-in session is invalid or expired." }, headers);
  }

  const serviceClient = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: admin, error: adminError } = await serviceClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (adminError) {
    console.error("Could not verify administrator membership.", adminError);
    return jsonResponse(500, { error: "Administrator access could not be verified." }, headers);
  }
  if (!admin) {
    return jsonResponse(403, { error: "Only an authorized administrator can review payments." }, headers);
  }

  let input: { payment_id?: unknown; decision?: unknown; admin_note?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonResponse(400, { error: "The request body must be valid JSON." }, headers);
  }

  const paymentId = typeof input.payment_id === "string" ? input.payment_id : "";
  const decision = input.decision;
  const adminNote = typeof input.admin_note === "string" ? input.admin_note.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
    return jsonResponse(400, { error: "A valid payment ID is required." }, headers);
  }
  if (decision !== "confirm" && decision !== "reject") {
    return jsonResponse(400, { error: "Choose confirm or reject." }, headers);
  }
  if (adminNote.length > 500) {
    return jsonResponse(400, { error: "The administrator note must be 500 characters or fewer." }, headers);
  }

  const status = decision === "confirm" ? "confirmed" : "rejected";
  const reviewedAt = new Date().toISOString();
  const { data: payment, error: updateError } = await serviceClient
    .from("payments")
    .update({
      status,
      admin_note: adminNote || null,
      reviewed_by: authData.user.id,
      reviewed_at: reviewedAt,
      confirmed_by: decision === "confirm" ? authData.user.id : null,
      confirmed_at: decision === "confirm" ? reviewedAt : null
    })
    .eq("id", paymentId)
    .eq("status", "pending")
    .not("receipt_path", "is", null)
    .select("id, status, confirmed_at")
    .maybeSingle();

  if (updateError) {
    console.error("Payment review update failed.", updateError);
    return jsonResponse(500, { error: "The payment review could not be saved." }, headers);
  }
  if (!payment) {
    return jsonResponse(409, { error: "This payment is no longer pending or has no uploaded receipt." }, headers);
  }

  return jsonResponse(200, { payment }, headers);
});
