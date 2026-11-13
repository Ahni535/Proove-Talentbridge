document.addEventListener("DOMContentLoaded", () => {
  initializePaymentPages();
});

async function initializePaymentPages() {
  const setupForm = document.getElementById("paymentSetupForm");
  const receiptForm = document.getElementById("paymentConfirmationForm");
  const payoutForm = document.getElementById("payoutRequestForm");
  const adminPanel = document.getElementById("adminPaymentsPanel");
  const authStatus = document.getElementById("paymentAuthStatus") ||
    document.getElementById("payoutAuthStatus");
  const planAmounts = { monthly: 1500, "six-months": 7500, yearly: 15000 };
  const allowedReceiptTypes = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf"
  };
  let supabase;
  let user;
  let username = "";
  let accountType = "";
  let paymentContext = null;

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  const setStatus = (id, message) => setText(id, message);

  try {
    supabase = await window.connectPTBSupabase();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session) {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      user = data.user;
    } else {
      user = null;
    }

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username, account_type")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      username = profile?.username || user.user_metadata?.username || "";
      accountType = profile?.account_type || "";
      localStorage.setItem("ptbCurrentUser", JSON.stringify({
        username,
        email: user.email,
        accountType: user.user_metadata?.account_type
      }));
      setText("paymentAuthStatus", `Signed in as ${username || user.email}.`);
      setText("payoutAuthStatus", `Signed in as ${username || user.email}.`);
    } else if (authStatus) {
      authStatus.replaceChildren();
      authStatus.append("Sign in before starting a payment. ");
      const login = document.createElement("a");
      login.href = "login.html";
      login.textContent = "Go to login";
      authStatus.appendChild(login);
    }
  } catch (error) {
    console.error("Could not initialize Supabase payments.", error);
    setStatus("paymentAuthStatus", error.message);
    setStatus("payoutAuthStatus", error.message);
  }

  if (setupForm) {
    setupForm.addEventListener("submit", event => {
      event.preventDefault();
      if (!user || !username) {
        setStatus("paymentSetupMessage", "A signed-in account with a registered username is required.");
        return;
      }

      const purpose = setupForm.dataset.purpose ||
        setupForm.elements.purpose.value;
      if (purpose === "project_payment" && accountType !== "client") {
        setStatus("paymentSetupMessage", "Project payments can only be requested from a client account.");
        return;
      }
      const plan = setupForm.elements.plan.value || "";
      const projectReference = setupForm.elements.project_reference?.value.trim() || "";
      const amount = purpose === "premium_subscription"
        ? planAmounts[plan]
        : Number(setupForm.elements.amount_ngn?.value);

      if (purpose === "project_payment" && (!projectReference || !Number.isSafeInteger(amount) || amount < 1)) {
        setStatus("paymentSetupMessage", "Enter a project reference and a whole-number amount greater than zero.");
        return;
      }
      if (purpose === "premium_subscription" && !planAmounts[plan]) {
        setStatus("paymentSetupMessage", "Choose a valid Premium plan first.");
        return;
      }

      paymentContext = { purpose, plan, projectReference, amount };
      setText("paymentBankName", "FCMB");
      setText("paymentAccountNumber", "1053314806");
      setText("paymentAccountName", "Aniebietabasi Isaac Edet");
      setText("paymentNarration", `${username} – ${purpose === "premium_subscription" ? "Premium Subscription" : "Project Payment"}`);
      setText("paymentAmountDisplay", `₦${amount.toLocaleString("en-NG")}`);
      document.getElementById("paymentDetails").hidden = false;
      document.getElementById("paymentSetup").hidden = true;
      setStatus("paymentSetupMessage", "");
    });
  }

  document.querySelectorAll(".premiumPlan").forEach(button => {
    button.addEventListener("click", () => {
      if (!user || !username) {
        setStatus("paymentAuthStatus", "Sign in with a client account before choosing a Premium plan.");
        return;
      }
      const setup = document.getElementById("paymentSetup");
      const form = document.getElementById("paymentSetupForm");
      const projectFields = document.getElementById("projectPaymentFields");
      const planSummary = document.getElementById("planSummary");
      const plan = button.dataset.plan;
      if (!planAmounts[plan]) {
        setStatus("paymentSetupMessage", "This Premium plan is not available.");
        return;
      }
      form.dataset.purpose = "premium_subscription";
      form.elements.purpose.value = "premium_subscription";
      form.elements.plan.value = plan;
      projectFields.hidden = true;
      projectFields.querySelectorAll("input").forEach(input => {
        input.disabled = true;
      });
      planSummary.hidden = false;
      planSummary.textContent = `${plan === "six-months" ? "6 months" : plan} Premium — ₦${planAmounts[plan].toLocaleString("en-NG")}`;
      setup.hidden = false;
      document.getElementById("paymentDetails").hidden = true;
      setup.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const backButton = document.getElementById("backToPaymentSetup");
  if (backButton) {
    backButton.addEventListener("click", () => {
      document.getElementById("paymentDetails").hidden = true;
      document.getElementById("paymentSetup").hidden = false;
    });
  }

  if (receiptForm) {
    receiptForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!supabase || !user || !paymentContext) {
        setStatus("paymentConfirmationMessage", "Sign in and select Proceed to Payment before uploading a receipt.");
        return;
      }

      const file = receiptForm.elements.receipt.files[0];
      if (!file || !allowedReceiptTypes[file.type] || file.size > 5 * 1024 * 1024) {
        setStatus("paymentConfirmationMessage", "Choose a JPG, PNG, WebP or PDF receipt no larger than 5 MB.");
        return;
      }

      const submit = receiptForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus("paymentConfirmationMessage", "Uploading your receipt securely…");
      let storagePath = "";
      let paymentId = "";
      try {
        const { data: payment, error: paymentError } = await supabase
          .from("payments")
          .insert({
            purpose: paymentContext.purpose,
            plan: paymentContext.plan || null,
            project_reference: paymentContext.projectReference || null,
            amount_ngn: paymentContext.amount
          })
          .select("id")
          .single();
        if (paymentError) throw paymentError;
        paymentId = payment.id;

        storagePath = `${user.id}/${payment.id}/receipt.${allowedReceiptTypes[file.type]}`;
        const { error: uploadError } = await supabase.storage
          .from("payment-receipts")
          .upload(storagePath, file, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false
          });
        if (uploadError) throw uploadError;

        const paymentReference = receiptForm.elements.payment_reference.value.trim();
        const { error: updateError } = await supabase
          .from("payments")
          .update({ receipt_path: storagePath, payment_reference: paymentReference || null })
          .eq("id", payment.id)
          .select("id")
          .single();
        if (updateError) {
          const { error: cleanupError } = await supabase.storage
            .from("payment-receipts")
            .remove([storagePath]);
          if (cleanupError) console.error("Could not remove an unlinked receipt upload.", cleanupError);
          throw updateError;
        }

        setStatus("paymentConfirmationMessage", "Receipt submitted. Admin has been notified to verify the transfer. Payment remains pending until confirmed.");
        receiptForm.reset();
        await renderClientPayments(supabase, user.id);
      } catch (error) {
        console.error("Payment receipt submission failed.", { paymentId, error });
        setStatus("paymentConfirmationMessage", `Receipt submission failed: ${error.message}`);
      } finally {
        submit.disabled = false;
      }
    });
  }

  if (payoutForm) {
    payoutForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!supabase || !user) {
        setStatus("payoutRequestMessage", "Sign in before submitting a payout request.");
        return;
      }
      if (accountType !== "professional") {
        setStatus("payoutRequestMessage", "Payout requests are available to professional accounts only.");
        return;
      }
      const data = new FormData(payoutForm);
      const amount = Number(data.get("amount"));
      if (!Number.isSafeInteger(amount) || amount < 1) {
        setStatus("payoutRequestMessage", "Enter a whole-number amount greater than zero.");
        return;
      }

      const button = payoutForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const { error } = await supabase.from("payout_requests").insert({
          client_id: user.id,
          project_reference: String(data.get("projectReference") || "").trim(),
          amount_ngn: amount,
          bank_name: String(data.get("bankName") || "").trim(),
          account_number: String(data.get("accountNumber") || "").trim(),
          account_name: String(data.get("accountName") || "").trim()
        });
        if (error) throw error;
        setStatus("payoutRequestMessage", "Payout request saved for manual staff review. No transfer was initiated.");
        payoutForm.reset();
        await renderPayoutHistory(supabase, user.id);
      } catch (error) {
        console.error("Payout request failed.", error);
        setStatus("payoutRequestMessage", `Payout request failed: ${error.message}`);
      } finally {
        button.disabled = false;
      }
    });
  }

  if (supabase && user) {
    await renderClientPayments(supabase, user.id);
    await renderPayoutHistory(supabase, user.id);
  }
  if (supabase && adminPanel) {
    await initializeAdminPayments(supabase, adminPanel);
  }
}

async function renderClientPayments(supabase, userId) {
  const list = document.getElementById("paymentHistory");
  if (!list) return;
  const { data, error } = await supabase
    .from("payments")
    .select("id, purpose, project_reference, amount_ngn, narration, status, receipt_path, payment_reference, created_at")
    .eq("client_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    showPaymentError(list, error, "Could not load payment history.");
    return;
  }
  list.replaceChildren();
  if (!data.length) {
    list.textContent = "No payment requests yet.";
    return;
  }
  for (const payment of data) {
    const card = document.createElement("article");
    card.className = "notification-card";
    const heading = document.createElement("h3");
    heading.textContent = payment.narration;
    const details = document.createElement("p");
    details.textContent = `₦${Number(payment.amount_ngn).toLocaleString("en-NG")} — ${payment.status}${payment.project_reference ? ` — Project ${payment.project_reference}` : ""}`;
    card.append(heading, details);
    if (payment.receipt_path) {
      const receipt = await signedReceiptLink(supabase, payment.receipt_path);
      if (receipt) card.appendChild(receipt);
    }
    list.appendChild(card);
  }
}

async function renderPayoutHistory(supabase, userId) {
  const list = document.getElementById("payoutRequestHistory");
  if (!list) return;
  const { data, error } = await supabase
    .from("payout_requests")
    .select("project_reference, amount_ngn, status, created_at")
    .eq("client_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    showPaymentError(list, error, "Could not load payout requests.");
    return;
  }
  list.replaceChildren();
  if (!data.length) {
    list.textContent = "No payout requests yet.";
    return;
  }
  data.forEach(request => {
    const item = document.createElement("article");
    item.className = "notification-card";
    item.textContent = `${request.project_reference} — ₦${Number(request.amount_ngn).toLocaleString("en-NG")} — ${request.status} (manual processing)`;
    list.appendChild(item);
  });
}

async function signedReceiptLink(supabase, path) {
  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .createSignedUrl(path, 300);
  if (error) {
    console.error("Could not create a private receipt link.", error);
    return null;
  }
  const link = document.createElement("a");
  link.href = data.signedUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View private receipt (link expires in 5 minutes)";
  return link;
}

function showPaymentError(container, error, message) {
  console.error(message, error);
  container.textContent = `${message} ${error.message}`;
}

async function initializeAdminPayments(supabase, panel) {
  const status = document.getElementById("adminPaymentStatus");
  try {
    const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin");
    if (roleError) throw roleError;
    if (!isAdmin) {
      panel.hidden = true;
      if (status) status.textContent = "Payment verification is available to authorized Admin accounts only.";
      return;
    }
    panel.hidden = false;
    const [{ count: paymentCount, error: paymentCountError }, { count: payoutCount, error: payoutCountError }] =
      await Promise.all([
        supabase.from("payments").select("id", { count: "exact", head: true }),
        supabase.from("payout_requests").select("id", { count: "exact", head: true })
      ]);
    if (paymentCountError) throw paymentCountError;
    if (payoutCountError) throw payoutCountError;
    setText("paymentCount", String(paymentCount + payoutCount));
    await Promise.all([
      renderAdminNotices(supabase),
      renderAdminPaymentList(supabase, "adminPaymentQueue", "pending", true),
      renderAdminPaymentList(supabase, "adminConfirmedPayments", "confirmed", false),
      renderAdminPayouts(supabase)
    ]);
  } catch (error) {
    console.error("Could not load the Admin payment queue.", error);
    if (status) status.textContent = `Admin payment queue unavailable: ${error.message}`;
  }
}

async function renderAdminNotices(supabase) {
  const list = document.getElementById("adminPaymentNotices");
  if (!list) return;
  const { data, error } = await supabase
    .from("payment_admin_notifications")
    .select("id, payment_id, created_at")
    .is("seen_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  list.replaceChildren();
  if (!data.length) {
    list.textContent = "No new receipt notifications.";
    return;
  }
  data.forEach(notice => {
    const item = document.createElement("article");
    item.className = "notification-card";
    const text = document.createElement("p");
    text.textContent = `Receipt submitted for payment ${notice.payment_id}.`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Mark as read";
    button.addEventListener("click", async () => {
      button.disabled = true;
      const { error: updateError } = await supabase
        .from("payment_admin_notifications")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", notice.id);
      if (updateError) {
        button.disabled = false;
        text.textContent = `Could not mark notification as read: ${updateError.message}`;
        return;
      }
      item.remove();
      if (!list.childElementCount) list.textContent = "No new receipt notifications.";
    });
    item.append(text, button);
    list.appendChild(item);
  });
}

async function renderAdminPaymentList(supabase, containerId, status, canReview) {
  const list = document.getElementById(containerId);
  if (!list) return;
  let query = supabase
    .from("payments")
    .select("id, client_id, purpose, project_reference, amount_ngn, narration, status, receipt_path, payment_reference, created_at")
    .eq("status", status)
    .not("receipt_path", "is", null)
    .order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  list.replaceChildren();
  if (!data.length) {
    list.textContent = status === "confirmed" ? "No confirmed receipts yet." : "No receipts are awaiting review.";
    return;
  }
  for (const payment of data) {
    const card = document.createElement("article");
    card.className = "payment-card";
    const heading = document.createElement("h4");
    heading.textContent = payment.narration;
    const detail = document.createElement("p");
    detail.textContent = `Client ${payment.client_id} — ₦${Number(payment.amount_ngn).toLocaleString("en-NG")} — ${payment.status}${payment.project_reference ? ` — Project ${payment.project_reference}` : ""}${payment.payment_reference ? ` — Bank ref ${payment.payment_reference}` : ""}`;
    card.append(heading, detail);
    const receipt = await signedReceiptLink(supabase, payment.receipt_path);
    if (receipt) card.appendChild(receipt);
    if (canReview) {
      ["confirm", "reject"].forEach(decision => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = decision === "confirm" ? "btn-success" : "btn-danger";
        button.textContent = decision === "confirm" ? "Confirm Payment" : "Reject Receipt";
        button.addEventListener("click", async () => {
          button.disabled = true;
          const { error: reviewError } = await supabase.functions.invoke("review-payment", {
            body: { payment_id: payment.id, decision }
          });
          if (reviewError) {
            button.disabled = false;
            detail.textContent = `Review failed: ${reviewError.message}`;
            return;
          }
          await initializeAdminPayments(supabase, document.getElementById("adminPaymentsPanel"));
        });
        card.appendChild(button);
      });
    }
    list.appendChild(card);
  }
}

async function renderAdminPayouts(supabase) {
  const list = document.getElementById("adminPayoutQueue");
  if (!list) return;
  const { data, error } = await supabase
    .from("payout_requests")
    .select("project_reference, amount_ngn, bank_name, account_number, account_name, client_id, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  list.replaceChildren();
  if (!data.length) {
    list.textContent = "No payout requests are awaiting manual processing.";
    return;
  }
  data.forEach(request => {
    const item = document.createElement("article");
    item.className = "notification-card";
    item.textContent = `${request.project_reference} — ₦${Number(request.amount_ngn).toLocaleString("en-NG")} — ${request.bank_name}, ${request.account_name}, account ${request.account_number} — ${request.status}. Process manually outside this website.`;
    list.appendChild(item);
  });
}
