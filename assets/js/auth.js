document.addEventListener("DOMContentLoaded", async () => {
  const boot = document.getElementById("bootScreen"),
    form = document.getElementById("loginForm"),
    msg = document.getElementById("loginMessage"),
    btn = document.getElementById("loginButton");
  document.getElementById("togglePassword")?.addEventListener("click", () => {
    const input = document.getElementById("password"),
      toggle = document.getElementById("togglePassword");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    toggle.setAttribute("aria-pressed", String(show));
    toggle.innerHTML = show
      ? '<svg class="eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a16.8 16.8 0 0 1-3.1 3.9M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.1 0 2.1-.2 3-.6"/></svg>'
      : '<svg class="eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
  if (window.sb) {
    const {
      data: { session },
    } = await window.sb.auth.getSession();
    if (session) {
      const { data: p } = await window.sb
        .from("profiles")
        .select("role,status")
        .eq("id", session.user.id)
        .maybeSingle();
      if (p?.status !== "disabled") {
        location.replace(
          p?.role === "admin" ? "admin/index.html" : "dashboard.html",
        );
        return;
      }
      await window.sb.auth.signOut();
    }
    boot?.classList.add("hidden");
  }
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!window.sb) {
      msg.textContent = "Supabase is not configured yet.";
      return;
    }
    const id = document.getElementById("studentId").value.trim().toUpperCase(),
      password = document.getElementById("password").value;
    btn.disabled = true;
    btn.textContent = "Signing in…";
    msg.textContent = "";
    try {
      const { data: map, error: mapError } = await window.sb.rpc(
        "resolve_student_login",
        { p_student_id: id },
      );
      if (mapError || !map?.auth_email)
        throw new Error("Student ID or password is incorrect.");
      const { data, error } = await window.sb.auth.signInWithPassword({
        email: map.auth_email,
        password,
      });
      if (error) throw new Error("Student ID or password is incorrect.");
      const { data: profile } = await window.sb
        .from("profiles")
        .select("role,status")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile || profile.status === "disabled") {
        await window.sb.auth.signOut();
        throw new Error("This account is not active. Contact your admin.");
      }
      location.replace(
        profile.role === "admin" ? "admin/index.html" : "dashboard.html",
      );
    } catch (err) {
      msg.textContent = err.message || "Could not sign in. Please try again.";
      btn.disabled = false;
      btn.innerHTML = 'Sign in <span aria-hidden="true">→</span>';
    }
  });
});
