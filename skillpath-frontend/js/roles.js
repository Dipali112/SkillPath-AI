/* ==========================================================================
   roles.js — "Explore roles" page: search, filters and the role list.
   ========================================================================== */

let allRoles = [];

document.addEventListener("DOMContentLoaded", async () => {
  allRoles = await Api.getRoles();

  // Pre-fill the search box from the URL (?q=react)
  const params = new URLSearchParams(location.search);
  const searchInput = document.getElementById("search-input");
  searchInput.value = params.get("q") || "";

  // Build one checkbox per category
  const categories = [...new Set(allRoles.map((r) => r.category))];
  document.getElementById("category-filters").innerHTML = categories
    .map((c) => `<li><label><input type="checkbox" name="category" value="${escapeHtml(c)}" checked /> ${escapeHtml(c)}</label></li>`)
    .join("");

  // Re-draw the list whenever something changes
  document.getElementById("role-search").addEventListener("submit", (e) => {
    e.preventDefault();
    renderRoles();
  });
  searchInput.addEventListener("input", renderRoles);
  document.querySelectorAll(".sidebar input").forEach((input) => input.addEventListener("change", renderRoles));

  renderRoles();
});

// Returns the roles that match the search text and filters
function getFilteredRoles() {
  const q = document.getElementById("search-input").value.trim().toLowerCase();
  const checked = [...document.querySelectorAll('input[name="category"]:checked')].map((i) => i.value);
  const size = document.querySelector('input[name="size"]:checked').value;

  return allRoles.filter((role) => {
    const text = (role.role_name + " " + role.skills.join(" ")).toLowerCase();
    const matchesSearch = !q || text.includes(q);
    const matchesCategory = checked.includes(role.category);
    const matchesSize =
      size === "all" || (size === "7" ? role.skills.length <= 7 : role.skills.length === 8);
    return matchesSearch && matchesCategory && matchesSize;
  });
}

// Draws the role list
function renderRoles() {
  const roles = getFilteredRoles();
  const list = document.getElementById("role-list");
  document.getElementById("result-count").textContent =
    `${roles.length} role${roles.length === 1 ? "" : "s"} found`;

  if (roles.length === 0) {
    list.innerHTML = `<div class="empty">No roles match your search. Try another skill or clear the filters.</div>`;
    return;
  }

  list.innerHTML = roles
    .map(
      (role) => `
      <article class="listing-item">
        <div class="listing-top">
          <div>
            <span class="muted" style="font-size:.85rem">${escapeHtml(role.category)} · ${role.skills.length} skills</span>
            <h3>${role.icon} ${escapeHtml(role.role_name)}</h3>
          </div>
          <a class="btn btn-primary" href="quiz.html?role=${role.id}">Check my skills</a>
        </div>
        <p style="margin:8px 0 14px">${escapeHtml(role.summary)}</p>
        <div class="tags">${role.skills.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}</div>
        <button class="link-btn" style="margin-top:14px" data-toggle="${role.id}" aria-expanded="false">Show learning order ▾</button>
        <ol class="learning-order hidden" id="order-${role.id}">
          ${role.skills.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ol>
      </article>`
    )
    .join("");

  // "Show learning order" buttons
  list.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = document.getElementById("order-" + btn.dataset.toggle);
      const isHidden = order.classList.toggle("hidden");
      btn.textContent = isHidden ? "Show learning order ▾" : "Hide learning order ▴";
      btn.setAttribute("aria-expanded", !isHidden);
    });
  });
}
