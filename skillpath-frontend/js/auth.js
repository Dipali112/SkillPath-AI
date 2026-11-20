/* ==========================================================================
   auth.js — handles the login and signup forms (with simple validation).
   ========================================================================== */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shows an error under one field (or clears it when message is empty)
function setFieldError(form, field, message) {
  const input = form.elements[field];
  const box = form.querySelector(`[data-error-for="${field}"]`);
  if (input) input.classList.toggle("invalid", Boolean(message));
  if (box) box.textContent = message || "";
}

// After login/signup, go back to the page the user wanted (or dashboard)
function goNext() {
  const next = new URLSearchParams(location.search).get("next");
  // Only allow simple local page names, never an outside website
  location.href = next && /^[\w-]+\.html(\?[\w=&%-]*)?$/.test(next) ? next : "dashboard.html";
}

// ----- Signup form -----
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = signupForm.elements;
    const name = f.name.value.trim();
    const email = f.email.value.trim();
    const password = f.password.value;
    const confirm = f.confirm.value;

    // Check each field
    const errors = {
      name: name.length < 2 ? "Please enter your name." : "",
      email: !EMAIL_PATTERN.test(email) ? "Please enter a valid email." : "",
      password: password.length < 8 ? "Password must be at least 8 characters." : "",
      confirm: confirm !== password ? "Passwords do not match." : "",
    };
    Object.entries(errors).forEach(([field, msg]) => setFieldError(signupForm, field, msg));
    if (Object.values(errors).some(Boolean)) return;

    const button = signupForm.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await Api.signup({ name, email, password });
      goNext();
    } catch (err) {
      document.getElementById("form-message").textContent = err.message;
      button.disabled = false;
    }
  });
}

// ----- Login form -----
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginForm.elements.email.value.trim();
    const password = loginForm.elements.password.value;

    const errors = {
      email: !EMAIL_PATTERN.test(email) ? "Please enter a valid email." : "",
      password: !password ? "Please enter your password." : "",
    };
    Object.entries(errors).forEach(([field, msg]) => setFieldError(loginForm, field, msg));
    if (Object.values(errors).some(Boolean)) return;

    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await Api.login({ email, password });
      goNext();
    } catch (err) {
      document.getElementById("form-message").textContent = err.message;
      button.disabled = false;
    }
  });
}
