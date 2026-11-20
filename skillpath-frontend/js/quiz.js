/* Skill quiz: try AI questions first; use self-rating only on its 503 fallback. */
let role = null;
let aiQuiz = null;
let current = 0;
let busy = false;
const answers = {};

function quizMessage(id, message) {
  const box = document.getElementById(id);
  box.textContent = message;
  box.classList.toggle("hidden", !message);
}

// Register buttons before starting the asynchronous request.
document.addEventListener("DOMContentLoaded", async () => {
  if (!requireLogin()) return;
  document.getElementById("prev-btn").addEventListener("click", () => {
    if (!busy && current > 0) {
      current--;
      renderQuestion();
    }
  });
  document.getElementById("next-btn").addEventListener("click", nextQuestion);

  try {
    const roleId = new URLSearchParams(location.search).get("role");
    if (!roleId) {
      await showRolePicker();
      return;
    }
    quizMessage("quiz-status", "Preparing your quiz…");
    role = await Api.getRole(roleId);
    if (!role) throw new Error("Role not found. Please choose another role.");
    try {
      aiQuiz = await Api.startAiQuiz(role.id);
      if (!aiQuiz || !Array.isArray(aiQuiz.questions) || !aiQuiz.questions.length) {
        throw new Error("No AI questions were returned. Please try again.");
      }
      // The server sends the choices, never the correct answers.
      quizMessage("quiz-status", "");
    } catch (error) {
      if (error.status !== 503 || error.data?.fallback !== "self-rating-quiz") throw error;
      aiQuiz = null;
      quizMessage("quiz-status", "AI questions are unavailable. Your self-rating quiz is ready instead.");
    }
    startQuiz();
  } catch (error) {
    quizMessage("quiz-status", "");
    quizMessage("quiz-error", error.message || "Could not load the quiz. Please refresh to try again.");
  }
});

// Shows one link per role, using the existing card classes.
async function showRolePicker() {
  const roles = await Api.getRoles();
  document.getElementById("pick-role").classList.remove("hidden");
  document.getElementById("role-picker").innerHTML = roles.map((r) => `
    <a class="card card-hover role-card" href="quiz.html?role=${encodeURIComponent(r.id)}">
      <div class="role-icon">${escapeHtml(r.icon)}</div>
      <h3>${escapeHtml(r.role_name)}</h3>
      <span class="muted" style="font-size:.9rem">${r.skills.length} skills</span>
    </a>`).join("");
}

function startQuiz() {
  document.getElementById("quiz").classList.remove("hidden");
  document.getElementById("quiz-role").textContent = aiQuiz ? aiQuiz.role_name : role.role_name;
  renderQuestion();
}

function questionCount() {
  return aiQuiz ? aiQuiz.questions.length : role.skills.length;
}

function answerKey() {
  return aiQuiz ? String(aiQuiz.questions[current].id) : role.skills[current];
}

// AI choices use a/b/c/d; the original quiz keeps its 0–3 skill ratings.
function renderQuestion() {
  const total = questionCount();
  const key = answerKey();
  document.getElementById("quiz-count").textContent = `Question ${current + 1} of ${total}`;
  document.getElementById("quiz-bar").style.width = `${(current / total) * 100}%`;
  const question = aiQuiz ? aiQuiz.questions[current] : null;
  document.getElementById("quiz-question").textContent = question
    ? question.question_text : `How comfortable are you with ${role.skills[current]}?`;

  // Support both an array of four strings and an object with a/b/c/d keys.
  const choices = question
    ? ["a", "b", "c", "d"].map((letter, i) => ({
        value: letter,
        label: Array.isArray(question.options) ? question.options[i]
          : question.options[letter] ?? question.options[letter.toUpperCase()],
      }))
    : QUIZ_LEVELS.map((level) => ({ value: level.points, label: level.label, hint: level.hint }));
  const options = document.getElementById("quiz-options");
  options.setAttribute("aria-labelledby", "quiz-question");
  options.innerHTML = choices.map((choice, i) => `
    <button type="button" class="option ${answers[key] === choice.value ? "selected" : ""}"
      role="radio" aria-checked="${answers[key] === choice.value}" data-choice="${i}">
      <span class="dot"></span>
      <span>${escapeHtml(choice.label)}${choice.hint ? `<small>${escapeHtml(choice.hint)}</small>` : ""}</span>
    </button>`).join("");
  options.querySelectorAll(".option").forEach((button) => {
    button.addEventListener("click", () => {
      if (busy) return;
      answers[key] = choices[Number(button.dataset.choice)].value;
      options.querySelectorAll(".option").forEach((option) => {
        option.classList.toggle("selected", option === button);
        option.setAttribute("aria-checked", String(option === button));
      });
      document.getElementById("next-btn").disabled = false;
    });
  });
  const next = document.getElementById("next-btn");
  next.disabled = answers[key] === undefined;
  next.textContent = current === total - 1 ? "See my results" : "Next →";
  document.getElementById("prev-btn").disabled = current === 0;
}

// Keep answers and the current question if submission fails, so it can be retried.
async function nextQuestion() {
  if (busy || answers[answerKey()] === undefined) return;
  quizMessage("quiz-error", "");
  if (current < questionCount() - 1) {
    current++;
    renderQuestion();
    return;
  }
  busy = true;
  document.getElementById("next-btn").textContent = "Saving results…";
  document.querySelectorAll("#quiz button").forEach((button) => { button.disabled = true; });
  try {
    const report = aiQuiz
      ? await Api.submitAiQuiz(aiQuiz.quiz_id, answers)
      : await Api.submitQuiz(role.id, answers);
    showResult(report);
  } catch (error) {
    quizMessage("quiz-error", error.message || "Could not save your results. Please try again.");
    renderQuestion();
  } finally {
    busy = false;
  }
}

// Reuse the gap-report layout for both kinds of quiz results.
function showResult(report) {
  document.getElementById("quiz").classList.add("hidden");
  document.getElementById("result").classList.remove("hidden");
  quizMessage("quiz-status", "");
  window.scrollTo({ top: 0, behavior: "smooth" });
  const name = report.role_name || aiQuiz?.role_name || role.role_name;
  document.getElementById("result-title").textContent = `${name}: ${report.score}% ready`;
  document.getElementById("result-score").textContent = `${report.score}%`;
  document.getElementById("result-ring").style.background =
    `conic-gradient(var(--green) ${report.score * 3.6}deg, var(--green-soft) 0deg)`;
  let label, text;
  if (report.score >= 75) {
    label = "You're nearly job-ready!";
    text = "Polish the last few skills and start applying.";
  } else if (report.score >= 40) {
    label = "Good foundation";
    text = "You know the basics — your roadmap covers what's left.";
  } else {
    label = "Just getting started";
    text = "No worries. Follow your roadmap one step at a time.";
  }
  document.getElementById("result-label").textContent = label;
  document.getElementById("result-text").textContent = text;
  const levelName = (skill) => aiQuiz ? ""
    : QUIZ_LEVELS.find((level) => level.points === report.answers?.[skill])?.label || "";
  document.getElementById("missing-count").textContent = report.missing_skills.length;
  document.getElementById("missing-list").innerHTML = report.missing_skills.length
    ? report.missing_skills.map((skill) => `<li>${escapeHtml(skill)}<span class="muted">${escapeHtml(levelName(skill))}</span></li>`).join("")
    : '<li class="muted">Nothing missing — great job!</li>';
  document.getElementById("strong-count").textContent = report.strong_skills.length;
  document.getElementById("strong-list").innerHTML = report.strong_skills.length
    ? report.strong_skills.map((skill) => `<li>${escapeHtml(skill)}<span class="muted">${escapeHtml(levelName(skill))}</span></li>`).join("")
    : '<li class="muted">Your roadmap will build these up.</li>';
  // The AI submit response supplies the ID required by the roadmap AI routes.
  const link = document.querySelector('#result a[href^="roadmap.html"]');
  link.href = report.roadmap_id ? `roadmap.html?roadmap_id=${encodeURIComponent(report.roadmap_id)}` : "roadmap.html";
}