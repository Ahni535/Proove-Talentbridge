
document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("ptbRegistration") ||
    document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const accountType = document.getElementById("accountType");
  const occupationSection = document.getElementById("occupationSection");
  const occupation = document.getElementById("specificOccupation");

  function updateOccupationVisibility() {
    if (!accountType || !occupationSection || !occupation) return;
    const isProfessional = accountType.value === "professional";
    occupationSection.hidden = !isProfessional;
    occupation.required = isProfessional;
    if (!isProfessional) occupation.value = "";
  }

  if (accountType) {
    accountType.addEventListener("change", updateOccupationVisibility);
    updateOccupationVisibility();
  }

  function showMessage(form, message) {
    const target = form.querySelector('[role="status"], p');
    if (target) target.textContent = message;
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async event => {
      event.preventDefault();

      const data = new FormData(registerForm);
      const password = data.get("password") || "";
      const confirmPassword = data.get("confirmPassword");

      if (confirmPassword !== null && password !== confirmPassword) {
        showMessage(registerForm, "Your passwords do not match.");
        return;
      }

      const email = String(data.get("email") || "").trim().toLowerCase();
      const username = String(data.get("username") || "").trim();
      const accountTypeValue = data.get("accountType");
      const submit = registerForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const supabase = await window.connectPTBSupabase();
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              account_type: accountTypeValue,
              occupation: data.get("occupation") || ""
            }
          }
        });
        if (error) throw error;

        if (result.session) {
          const accountTypeValue = result.user.user_metadata?.account_type;
          localStorage.setItem("ptbCurrentUser", JSON.stringify({
            username,
            email,
            accountType: accountTypeValue
          }));
          window.location.href = accountTypeValue === "client"
            ? "client-dashboard.html"
            : "professional-dashboard.html";
          return;
        }

        showMessage(registerForm, "Account created. Check your email to confirm it, then sign in.");
        registerForm.reset();
      } catch (error) {
        console.error("Supabase account registration failed.", error);
        showMessage(registerForm, `Registration failed: ${error.message}`);
      } finally {
        submit.disabled = false;
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();

      const data = new FormData(loginForm);
      const email = String(data.get("email") || "").trim().toLowerCase();
      const password = data.get("password");
      const submit = loginForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const supabase = await window.connectPTBSupabase();
        const { data: result, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const user = result.user;
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("username, account_type")
          .eq("id", user.id)
          .single();
        if (profileError) throw profileError;
        const accountTypeValue = profile.account_type;
        const username = profile.username;
        localStorage.setItem("ptbCurrentUser", JSON.stringify({
          username,
          email: user.email,
          accountType: accountTypeValue
        }));
        showMessage(loginForm, "Signed in. Opening your dashboard…");
        window.location.href = accountTypeValue === "client"
          ? "client-dashboard.html"
          : "professional-dashboard.html";
      } catch (error) {
        console.error("Supabase sign in failed.", error);
        showMessage(loginForm, `Sign in failed: ${error.message}`);
      } finally {
        submit.disabled = false;
      }
    });
  }

  const forgotForm = document.getElementById("forgotPasswordForm");
  const passwordUpdateForm = document.getElementById("passwordUpdateForm");
  const recoveryFlow = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
  if (recoveryFlow && forgotForm && passwordUpdateForm) {
    forgotForm.hidden = true;
    passwordUpdateForm.hidden = false;
  }

  if (forgotForm) {
    forgotForm.addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const supabase = await window.connectPTBSupabase();
        const email = String(new FormData(forgotForm).get("email") || "").trim().toLowerCase();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.href.split("#")[0]
        });
        if (error) throw error;
        showMessage(forgotForm, "If an account exists for that email, a password reset message will be sent.");
      } catch (error) {
        console.error("Supabase password reset request failed.", error);
        showMessage(forgotForm, `Password reset request failed: ${error.message}`);
      }
    });
  }

  if (passwordUpdateForm) {
    passwordUpdateForm.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(passwordUpdateForm);
      if (data.get("password") !== data.get("confirmPassword")) {
        showMessage(passwordUpdateForm, "Your passwords do not match.");
        return;
      }
      try {
        const supabase = await window.connectPTBSupabase();
        const { error } = await supabase.auth.updateUser({ password: data.get("password") });
        if (error) throw error;
        showMessage(passwordUpdateForm, "Password updated. You can now sign in.");
        await supabase.auth.signOut({ scope: "local" });
      } catch (error) {
        console.error("Supabase password update failed.", error);
        showMessage(passwordUpdateForm, `Password update failed: ${error.message}`);
      }
    });
  }
});
