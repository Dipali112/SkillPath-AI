/* ==========================================================================
   dashboard.js — shows the user's stats, latest report, roadmap and profile.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireLogin()) return;

  const user = Api.currentUser();
  document.getElementById("welcome").textContent = `Welcome back, ${user.name.split(" ")[0]}`;
  document.getElementById("today").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });

  // Load everything at the same time
  const [roles, profile, report, roadmap] = await Promise.all([
    Api.getRoles(),
    Api.getProfile(),
    Api.getLatestReport(),
    Api.getRoadmap(),
  ]);

  renderReport(report);
  renderRoadmap(roadmap);
  renderProfile(roles, profile);
});

function renderReport(report) {
  const body = document.getElementById("report-body");
  if (!report) {
    body.innerHTML = `<p class="muted">You haven't taken a quiz yet.</p>
      <a class="btn btn-outline" href="quiz.html">Start your first quiz</a>`;
    return;
  }

  document.getElementById("stat-score").textContent = report.score + "%";
  document.getElementById("stat-gaps").textContent = report.missing_skills.length;
  document.getElementById("report-date").textContent = formatDate(report.created_at);

  body.innerHTML = `
    <p style="margin-bottom:12px"><strong style="color:var(--ink)">${escapeHtml(report.role_name)}</strong> — ${report.score}% ready</p>
    <div class="progress" style="margin-bottom:16px"><div class="progress-bar" style="width:${report.score}%"></div></div>
    <div class="tags">
      ${report.strong_skills.map((s) => `<span class="badge badge-ok">${escapeHtml(s)}</span>`).join("")}
      ${report.missing_skills.map((s) => `<span class="badge badge-gap">${escapeHtml(s)}</span>`).join("")}
    </div>`;
}

function renderRoadmap(roadmap) {
  const list = document.getElementById("next-steps");
  if (!roadmap || roadmap.steps.length === 0) {
    list.innerHTML = `<li class="muted">Your roadmap will appear here after your first quiz.</li>`;
    return;
  }

  const done = roadmap.steps.filter((s) => s.status === "done").length;
  const percent = Math.round((done / roadmap.steps.length) * 100);
  document.getElementById("stat-progress").textContent = percent + "%";
  document.getElementById("roadmap-bar").style.width = percent + "%";

  const pending = roadmap.steps.filter((s) => s.status === "pending").slice(0, 3);
  list.innerHTML = pending.length
    ? pending
        .map(
          (s) => `<li><span><strong style="color:var(--ink)">${s.step_order}. ${escapeHtml(s.skill_name)}</strong><br>
            <span class="muted" style="font-size:.9rem">${escapeHtml(s.resource_title)}</span></span>
            <a class="btn btn-outline" href="${escapeHtml(s.resource_link)}" target="_blank" rel="noopener">Learn</a></li>`
        )
        .join("")
    : `<li>🎉 You've finished every step. Time to apply for jobs!</li>`;
}

function renderProfile(roles, profile) {
  const select = document.getElementById("target-role");
  select.innerHTML =
    `<option value="">Choose a role</option>` +
    roles.map((r) => `<option value="${escapeHtml(r.role_name)}">${escapeHtml(r.role_name)}</option>`).join("");

  if (profile) {
    select.value = profile.target_role;
    document.getElementById("current-skills").value = profile.current_skills;
  }

  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await Api.saveProfile({
      target_role: select.value,
      current_skills: document.getElementById("current-skills").value.trim(),
    });
    showToast("Profile saved");
  });
}
