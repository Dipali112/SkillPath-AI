/* ==========================================================================
   main.js — shared code used on every page:
   header, footer, mobile menu, toast messages and page protection.
   ========================================================================== */

// Builds the top navigation. Shows "Log in / Sign up" or the user's name.
function renderHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;

  const user = Api.currentUser();
  const page = location.pathname.split("/").pop() || "index.html";
  const link = (href, text) =>
    `<li><a href="${href}" class="${page === href ? "active" : ""}">${text}</a></li>`;

  const actions = user
    ? `<a class="nav-user" href="dashboard.html"><span class="avatar">${user.name.charAt(0).toUpperCase()}</span>${user.name.split(" ")[0]}</a>
       <button class="btn btn-ghost" id="logout-btn">Log out</button>`
    : `<a class="btn btn-ghost" href="login.html">Log in</a>
       <a class="btn btn-primary" href="signup.html">Sign up</a>`;

  header.className = "site-header";
  header.innerHTML = `
    <nav class="container nav" aria-label="Main">
      <a href="index.html" class="logo"><span class="logo-mark">S</span>SkillPath<span>AI</span></a>
      <button class="nav-toggle" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links">
        ${link("roles.html", "Explore roles")}
        ${link("quiz.html", "Skill quiz")}
        ${link("roadmap.html", "My roadmap")}
        ${user ? link("dashboard.html", "Dashboard") : ""}
      </ul>
      <div class="nav-actions">${actions}</div>
    </nav>`;

  // Mobile menu open / close
  const toggle = header.querySelector(".nav-toggle");
  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });

  // Log out button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      Api.logout();
      location.href = "index.html";
    });
  }
}

// Builds the footer
function renderFooter() {
  const footer = document.getElementById("site-footer");
  if (!footer) return;
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a href="index.html" class="logo"><span class="logo-mark">S</span>SkillPath<span>AI</span></a>
          <p>Career guidance for IT job seekers. Find your gaps, follow a roadmap, get hired.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li><a href="roles.html">All roles</a></li>
            <li><a href="quiz.html">Skill quiz</a></li>
            <li><a href="roadmap.html">Roadmaps</a></li>
          </ul>
        </div>
        <div>
          <h4>Account</h4>
          <ul>
            <li><a href="signup.html">Sign up</a></li>
            <li><a href="login.html">Log in</a></li>
            <li><a href="dashboard.html">Dashboard</a></li>
          </ul>
        </div>
        <div>
          <h4>Popular roles</h4>
          <ul>
            <li><a href="roles.html?q=frontend">Frontend Developer</a></li>
            <li><a href="roles.html?q=backend">Backend Developer</a></li>
            <li><a href="roles.html?q=data">Data Analyst</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} SkillPath AI</span>
        <span>Made for IT job seekers</span>
      </div>
    </div>`;
}

// Shows a small message at the bottom of the screen
function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// Sends visitors to the login page if they are not logged in
function requireLogin() {
  if (!Api.currentUser()) {
    const back = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    location.href = `login.html?next=${back}`;
    return false;
  }
  return true;
}

// Makes text safe to put inside innerHTML (prevents broken HTML / XSS)
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

// Formats an ISO date like "5 Nov 2026"
function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Run on every page
document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
});
