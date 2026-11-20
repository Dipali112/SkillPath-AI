/* Show roadmap steps and request AI advice or a new learning order. */
let roadmap = null;
let busy = false;

function roadmapMessage(id, message) {
  const box = document.getElementById(id);
  box.textContent = message;
  box.classList.toggle("hidden", !message);
}

// Load the existing roadmap; failed requests show a readable error.
document.addEventListener("DOMContentLoaded", async () => {
  if (!requireLogin()) return;
  document.getElementById("advice-btn").addEventListener("click", () => runAiAction("advice"));
  document.getElementById("replan-btn").addEventListener("click", () => runAiAction("replan"));
  try {
    roadmap = await Api.getRoadmap();
    if (!roadmap) {
      document.getElementById("roadmap-empty").classList.remove("hidden");
      return;
    }
    document.getElementById("roadmap-content").classList.remove("hidden");
    document.getElementById("roadmap-title").textContent = `${roadmap.role_name} roadmap`;
    document.getElementById("roadmap-date").textContent = "Created " + formatDate(roadmap.created_at);
    renderTimeline();
  } catch (error) {
    roadmapMessage("roadmap-error", error.message || "Could not load your roadmap. Please refresh to try again.");
  }
});

function renderProgress() {
  const total = roadmap.steps.length;
  const done = roadmap.steps.filter((step) => step.status === "done").length;
  const percent = total ? Math.round((done / total) * 100) : 100;
  document.getElementById("roadmap-progress-text").textContent =
    total ? `${done} of ${total} steps done (${percent}%)` : "No missing skills — you're ready!";
  document.getElementById("roadmap-bar").style.width = percent + "%";
}

// Lock all changing controls while a save or AI request is running.
function setBusy(value, action) {
  busy = value;
  document.querySelectorAll("#roadmap-content button, #timeline input").forEach((control) => {
    control.disabled = value;
  });
  document.getElementById("advice-btn").textContent = value && action === "advice" ? "Getting advice…" : "Get AI advice";
  document.getElementById("replan-btn").textContent = value && action === "replan" ? "Re-planning…" : "Re-plan my roadmap";
  document.getElementById("roadmap-content").setAttribute("aria-busy", String(value));
}

function renderTimeline() {
  renderProgress();
  const timeline = document.getElementById("timeline");
  if (roadmap.steps.length === 0) {
    timeline.innerHTML = '<li class="empty">🎉 Your quiz showed no skill gaps. Start applying for jobs!</li>';
    return;
  }
  timeline.innerHTML = roadmap.steps.map((step) => `
    <li class="t-step ${step.status === "done" ? "done" : ""}">
      <span class="t-marker">${step.status === "done" ? "✓" : step.step_order}</span>
      <div class="t-card">
        <div>
          <h3>${escapeHtml(step.skill_name)}</h3>
          <a href="${escapeHtml(safeResourceLink(step.resource_link))}" target="_blank" rel="noopener">${escapeHtml(step.resource_title)} ↗</a>
        </div>
        <label class="check">
          <input type="checkbox" data-step="${Number(step.id)}" aria-label="${escapeHtml('Mark ' + step.skill_name + ' done')}" ${step.status === "done" ? "checked" : ""} />
          Done
        </label>
      </div>
    </li>`).join("");
  timeline.querySelectorAll("input[data-step]").forEach((box) => {
    box.disabled = busy;
    box.addEventListener("change", async () => {
      if (busy) return;
      const step = roadmap.steps.find((item) => item.id === Number(box.dataset.step));
      if (!step) return;
      const status = box.checked ? "done" : "pending";
      roadmapMessage("roadmap-error", "");
      setBusy(true);
      try {
        await Api.updateStepStatus(step.id, status);
        step.status = status;
        renderTimeline();
        showToast(status === "done" ? "Nice work! Step completed." : "Step marked as pending");
      } catch (error) {
        box.checked = step.status === "done";
        roadmapMessage("roadmap-error", error.message || "Could not save this step. Please try again.");
      } finally {
        setBusy(false);
      }
    });
  });
}

// Only open ordinary web links returned as learning resources.
function safeResourceLink(link) {
  try {
    const url = new URL(link);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

async function runAiAction(action) {
  if (busy || !roadmap) return;
  roadmapMessage("roadmap-error", "");
  roadmapMessage("roadmap-status", "");
  // Prefer the roadmap response ID. The quiz result link also carries its ID.
  const id = Number(roadmap.id || roadmap.roadmap_id || new URLSearchParams(location.search).get("roadmap_id"));
  if (!Number.isInteger(id) || id < 1) {
    roadmapMessage("roadmap-error", "The roadmap ID is missing. Open this roadmap from your AI quiz results, or have the latest-roadmap response include its id.");
    return;
  }
  setBusy(true, action);
  try {
    if (action === "advice") {
      const result = await Api.getRoadmapAdvice(id);
      if (typeof result?.advice !== "string" || !result.advice.trim()) {
        throw new Error("No advice was returned. Please try again.");
      }
      // Use textContent so AI output cannot become executable HTML.
      document.getElementById("advice-text").textContent = result.advice;
      document.getElementById("roadmap-advice").classList.remove("hidden");
    } else {
      const result = await Api.replanRoadmap(id);
      if (!Array.isArray(result?.steps)) throw new Error("No updated steps were returned. Please refresh your roadmap.");
      // Use the saved steps in the response, including completed statuses.
      roadmap.steps = result.steps.slice().sort((a, b) => a.step_order - b.step_order);
      renderTimeline();
      document.getElementById("advice-text").textContent = "";
      document.getElementById("roadmap-advice").classList.add("hidden");
      roadmapMessage("roadmap-status", "Your roadmap is up to date.");
    }
  } catch (error) {
    roadmapMessage("roadmap-error", error.message || "AI is unavailable right now. Please try again.");
  } finally {
    setBusy(false);
  }
}