// routes/ai.js
// AI features powered by Google Gemini:
//   POST /api/ai/quiz                   -> make a multiple choice quiz for a role
//   POST /api/ai/quiz/:quizId/submit    -> mark the quiz, save gap report + roadmap
//   POST /api/ai/roadmap-advice         -> short personal study plan
//   POST /api/ai/replan                 -> AI re-orders the pending roadmap steps
//
// Mounted in server.js with:  app.use("/api", aiRoutes);
// Every route needs a login: verifyToken checks the JWT and sets req.user.
// Every reply has the same shape: { success, message, data }

const express = require("express");
const { pool } = require("../db");
const verifyToken = require("../middleware/auth");
const { askGemini, askGeminiJson } = require("../services/gemini");
const quizRoutes = require("./quizzes"); // reuse the learning resources list from the old quiz

const router = express.Router();

// ===========================================================================
// PROMPTS SENT TO GEMINI
// Words in {{DOUBLE_BRACES}} are filled in with real data before sending.
// ===========================================================================

// 1. Used by POST /api/ai/quiz: one multiple choice question per skill
const QUIZ_PROMPT = `You are a friendly technical interviewer for IT job seekers.
Write one multiple choice question for EACH skill below, for someone who wants to become a {{ROLE_NAME}}.
Level: beginner to intermediate. Test practical understanding, not trivia.

Rules:
- Exactly 4 options per question, and exactly one option is correct.
- Keep each option shorter than 120 characters.
- Write "skill_name" exactly as it is written in the list.

Skills:
{{SKILLS}}

Return a JSON array in this exact shape:
[{"skill_name": "HTML", "question_text": "...", "options": ["...", "...", "...", "..."], "correct_option": "A"}]
"correct_option" is "A", "B", "C" or "D" (A means the first option).`;

// 2. Used by POST /api/ai/roadmap-advice: a short personal study plan
const ADVICE_PROMPT = `You are a kind career mentor for an IT job seeker who wants to become a {{ROLE_NAME}}.
Skills they are missing (from their latest quiz): {{MISSING_SKILLS}}

Their roadmap steps, in the current order:
{{STEPS}}

Write a short personal study plan in simple English, maximum 150 words.
Suggest the order to learn the pending skills and give one practical tip for each skill.
Use plain text, one line per skill, like "1. Skill - tip". Do not use markdown symbols such as ** or #.`;

// 3. Used by POST /api/ai/replan: a better order for the pending steps
const REPLAN_PROMPT = `You are a career mentor re-planning a learning roadmap for a future {{ROLE_NAME}}.
Latest quiz score: {{SCORE}}
Skills missing in the latest quiz: {{MISSING_SKILLS}}
Steps already done: {{DONE_STEPS}}

Pending steps, in the current order:
{{PENDING_STEPS}}

Choose the best new order for the PENDING steps only.
Put basics before the skills that depend on them, and build on what is already done.
For each step give one short line explaining why it moved earlier, moved later, or stayed.

Return JSON in this exact shape:
{"order": [{"step_id": 12, "reason": "one short line"}]}
Include every pending step_id exactly once.`;

// ===========================================================================
// SETTINGS AND SMALL HELPERS
// ===========================================================================

const LETTERS = ["A", "B", "C", "D"];
const ADVICE_MAX_WORDS = 150;

// Send the same JSON shape every time -> { success, message, data }
function reply(res, status, success, message, data = null) {
  return res.status(status).json({ success, message, data });
}

// Replace every {{KEY}} in a prompt with its value
function fillPrompt(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

// Learning resource for a roadmap step. Uses the list in routes/quizzes.js;
// a skill that is not in that list gets a search link.
function resourceFor(skill) {
  if (typeof quizRoutes.resourceFor === "function") return quizRoutes.resourceFor(skill);
  return { title: `Learn ${skill}`, link: `https://www.google.com/search?q=${encodeURIComponent("learn " + skill)}` };
}

// Check that an id from the URL or body is a positive whole number
function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Shuffle a list (AI models often put the right answer first, so we mix the options)
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Cut a text after maxWords words (keeps the line breaks)
function limitWords(text, maxWords) {
  const words = [...text.matchAll(/\S+/g)];
  if (words.length <= maxWords) return text.trim();
  const last = words[maxWords - 1];
  return text.slice(0, last.index + last[0].length).trim() + " …";
}

// Turn "React, Git" (how missing skills are saved) back into ["React", "Git"]
function splitSkills(text) {
  return text ? text.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

// Load a role's name and its skills in learning order (null if the role doesn't exist)
async function loadRoleWithSkills(roleId) {
  const [roles] = await pool.execute("SELECT id, role_name FROM roles WHERE id = ?", [roleId]);
  if (roles.length === 0) return null;
  const [skills] = await pool.execute(
    "SELECT skill_name FROM role_skills WHERE role_id = ? ORDER BY learning_order",
    [roleId]
  );
  return { ...roles[0], skills: skills.map((s) => s.skill_name) };
}

// Load one of the logged-in user's roadmaps with its steps (null if not theirs)
async function loadUserRoadmap(roadmapId, userId) {
  const [rows] = await pool.execute(
    `SELECT rm.id, rm.role_id, r.role_name, rm.created_at
     FROM roadmaps rm
     JOIN roles r ON r.id = rm.role_id
     WHERE rm.id = ? AND rm.user_id = ?`,
    [roadmapId, userId]
  );
  if (rows.length === 0) return null;
  const [steps] = await pool.execute(
    `SELECT id, skill_name, resource_title, resource_link, step_order, status
     FROM roadmap_steps
     WHERE roadmap_id = ?
     ORDER BY step_order, id`,
    [roadmapId]
  );
  return { ...rows[0], steps };
}

// The user's latest finished quiz score and missing skills for a role
async function loadLatestResult(userId, roleId) {
  const [quizzes] = await pool.execute(
    `SELECT score FROM quizzes
     WHERE user_id = ? AND role_id = ? AND score IS NOT NULL
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId, roleId]
  );
  const [reports] = await pool.execute(
    `SELECT missing_skills FROM gap_reports
     WHERE user_id = ? AND role_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId, roleId]
  );
  return {
    score: quizzes.length ? quizzes[0].score : null,
    missing_skills: reports.length ? splitSkills(reports[0].missing_skills) : [],
  };
}

// Check Gemini's quiz and turn it into one clean question per skill.
// Throws an error (caught by the route) if anything is missing or broken.
function cleanQuizQuestions(aiResult, skills) {
  const list = Array.isArray(aiResult) ? aiResult : aiResult && aiResult.questions;
  if (!Array.isArray(list)) {
    throw aiError("Gemini did not send a list of questions.");
  }

  return skills.map((skill) => {
    const q = list.find((item) => item && String(item.skill_name || "").trim().toLowerCase() === skill.toLowerCase());
    if (!q) throw aiError(`Gemini did not write a question for "${skill}".`);

    const questionText = String(q.question_text || "").trim();
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim().slice(0, 255)) : [];
    const correctIndex = LETTERS.indexOf(String(q.correct_option || "").trim().toUpperCase());

    const allDifferent = new Set(options.map((o) => o.toLowerCase())).size === 4;
    if (!questionText || options.length !== 4 || options.some((o) => !o) || !allDifferent || correctIndex === -1) {
      throw aiError(`Gemini wrote a broken question for "${skill}".`);
    }

    // Mix the options, then find where the correct one ended up
    const correctText = options[correctIndex];
    const mixed = shuffle(options);
    return {
      skill_name: skill,
      question_text: questionText,
      options: mixed,
      correct_option: LETTERS[mixed.indexOf(correctText)],
    };
  });
}

// Make an error that is treated like a Gemini failure (clean message, no crash)
function aiError(message) {
  const err = new Error(message);
  err.isGeminiError = true;
  return err;
}

// ===========================================================================
// ROUTES
// ===========================================================================

// ---------------------------------------------------------------------------
// POST /api/ai/quiz   (protected)
// Body: { role_id }
// 1. Loads the role and its skills
// 2. Asks Gemini for one multiple choice question per skill
// 3. Saves a new quiz and its questions
// 4. Returns the questions WITHOUT the correct answers
// If Gemini fails, we answer 503 and tell the frontend to use the old
// self-rating quiz (POST /api/quizzes), which does not need AI.
// ---------------------------------------------------------------------------
router.post("/ai/quiz", verifyToken, async (req, res, next) => {
  let connection;
  try {
    // 1. Check the input and load the role
    const roleId = toId(req.body.role_id);
    if (!roleId) return reply(res, 400, false, "Please send a valid role_id.");

    const role = await loadRoleWithSkills(roleId);
    if (!role) return reply(res, 404, false, "Role not found.");
    if (role.skills.length === 0) return reply(res, 400, false, "This role has no skills to test yet.");

    // 2. Ask Gemini BEFORE saving anything, so a failure leaves no empty quiz
    const prompt = fillPrompt(QUIZ_PROMPT, {
      ROLE_NAME: role.role_name,
      SKILLS: role.skills.map((s) => `- ${s}`).join("\n"),
    });
    let questions;
    try {
      questions = cleanQuizQuestions(await askGeminiJson(prompt), role.skills);
    } catch (err) {
      if (!err.isGeminiError) throw err;
      // Fallback: tell the frontend clearly that the self-rating quiz still works
      return reply(
        res,
        503,
        false,
        `The AI quiz is not available right now. ${err.message} You can still take the self-rating quiz.`,
        { fallback: "self-rating-quiz", fallback_endpoint: "POST /api/quizzes" }
      );
    }

    // 3. Save the quiz (score stays NULL until it is submitted) and its questions
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [quizResult] = await connection.execute(
      "INSERT INTO quizzes (user_id, role_id) VALUES (?, ?)",
      [req.user.id, roleId]
    );
    const quizId = quizResult.insertId;

    const saved = [];
    for (const q of questions) {
      const [qResult] = await connection.execute(
        `INSERT INTO quiz_questions
           (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, skill_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [quizId, q.question_text, q.options[0], q.options[1], q.options[2], q.options[3], q.correct_option, q.skill_name]
      );
      // correct_option is NOT included here, so the user can't see the answers
      saved.push({ id: qResult.insertId, skill_name: q.skill_name, question_text: q.question_text, options: q.options });
    }

    await connection.commit();

    // 4. Send the questions to the frontend
    return reply(res, 201, true, "Your AI quiz is ready.", {
      quiz_id: quizId,
      role_id: role.id,
      role_name: role.role_name,
      questions: saved,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/quiz/:quizId/submit   (protected)
// Body: { answers: { "<questionId>": "a" | "b" | "c" | "d" } }
// 1. Checks each answer against the saved correct option
// 2. Score = correct answers / all questions x 100
// 3. A skill is "missing" if its question was answered wrong (or skipped)
// 4. Saves the gap report and builds the roadmap (same as POST /api/quizzes)
// Returns { score, strong_skills, missing_skills, roadmap_id }
// ---------------------------------------------------------------------------
router.post("/ai/quiz/:quizId/submit", verifyToken, async (req, res, next) => {
  let connection;
  try {
    // 1. Check the input
    const quizId = toId(req.params.quizId);
    if (!quizId) return reply(res, 400, false, "Quiz id must be a positive whole number.");

    const answersIn = req.body.answers;
    if (!answersIn || typeof answersIn !== "object" || Array.isArray(answersIn)) {
      return reply(res, 400, false, 'answers must be an object like { "12": "a", "13": "c" }.');
    }

    // 2. The quiz must belong to this user
    const [quizzes] = await pool.execute(
      "SELECT id, role_id, score FROM quizzes WHERE id = ? AND user_id = ?",
      [quizId, req.user.id]
    );
    const quiz = quizzes[0];
    if (!quiz) return reply(res, 404, false, "Quiz not found.");
    if (quiz.score !== null) return reply(res, 409, false, "This quiz has already been submitted.");

    const [questions] = await pool.execute(
      "SELECT id, skill_name, correct_option FROM quiz_questions WHERE quiz_id = ? ORDER BY id",
      [quizId]
    );
    if (questions.length === 0) {
      return reply(res, 404, false, "This quiz has no AI questions. Use the self-rating quiz instead.");
    }

    // 3. Mark each question. A missing answer counts as wrong.
    const marked = [];
    for (const q of questions) {
      const raw = answersIn[q.id] === undefined ? null : String(answersIn[q.id]).trim().toUpperCase();
      if (raw !== null && !LETTERS.includes(raw)) {
        return reply(res, 400, false, `The answer for question ${q.id} must be "a", "b", "c" or "d".`);
      }
      marked.push({ ...q, user_answer: raw, correct: raw === q.correct_option });
    }

    const correctCount = marked.filter((q) => q.correct).length;
    const score = Math.round((correctCount / marked.length) * 100);

    // 4. Strong and missing skills, kept in the role's learning order
    const role = await loadRoleWithSkills(quiz.role_id);
    const roleOrder = role ? role.skills : [];
    const testedSkills = [...new Set(marked.map((q) => q.skill_name))].sort(
      (a, b) => (roleOrder.indexOf(a) + 1 || 999) - (roleOrder.indexOf(b) + 1 || 999)
    );
    const missingSkills = testedSkills.filter((skill) => marked.some((q) => q.skill_name === skill && !q.correct));
    const strongSkills = testedSkills.filter((skill) => !missingSkills.includes(skill));

    // Saved like the self-rating quiz: 3 points = strong, 0 = missing,
    // so GET /api/gap-reports/latest can show both kinds of quiz.
    const answersAsPoints = {};
    for (const skill of testedSkills) answersAsPoints[skill] = missingSkills.includes(skill) ? 0 : 3;

    // 5. Save everything in ONE transaction: all rows are saved, or none are
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // "score IS NULL" stops the same quiz from being submitted twice at once
    const [updated] = await connection.execute(
      "UPDATE quizzes SET score = ?, answers = ? WHERE id = ? AND user_id = ? AND score IS NULL",
      [score, JSON.stringify(answersAsPoints), quizId, req.user.id]
    );
    if (updated.affectedRows === 0) {
      await connection.rollback();
      return reply(res, 409, false, "This quiz has already been submitted.");
    }

    for (const q of marked) {
      await connection.execute("UPDATE quiz_questions SET user_answer = ? WHERE id = ?", [q.user_answer, q.id]);
    }

    await connection.execute(
      "INSERT INTO gap_reports (user_id, role_id, missing_skills) VALUES (?, ?, ?)",
      [req.user.id, quiz.role_id, missingSkills.join(", ")]
    );

    const [roadmapResult] = await connection.execute(
      "INSERT INTO roadmaps (user_id, role_id) VALUES (?, ?)",
      [req.user.id, quiz.role_id]
    );

    // One roadmap step per missing skill, in learning order, all "pending"
    for (let i = 0; i < missingSkills.length; i++) {
      const resource = resourceFor(missingSkills[i]);
      await connection.execute(
        `INSERT INTO roadmap_steps
           (roadmap_id, skill_name, resource_title, resource_link, step_order, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [roadmapResult.insertId, missingSkills[i], resource.title, resource.link, i + 1]
      );
    }

    await connection.commit();

    return reply(res, 200, true, "Quiz marked. Your gap report and roadmap are ready.", {
      score,
      strong_skills: strongSkills,
      missing_skills: missingSkills,
      roadmap_id: roadmapResult.insertId,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/roadmap-advice   (protected)
// Body: { roadmap_id }
// Asks Gemini for a short personal study plan (max 150 words) based on the
// user's missing skills and roadmap steps. Returns { advice }.
// ---------------------------------------------------------------------------
router.post("/ai/roadmap-advice", verifyToken, async (req, res, next) => {
  try {
    // 1. Check the input and load the user's roadmap
    const roadmapId = toId(req.body.roadmap_id);
    if (!roadmapId) return reply(res, 400, false, "Please send a valid roadmap_id.");

    const roadmap = await loadUserRoadmap(roadmapId, req.user.id);
    if (!roadmap) return reply(res, 404, false, "Roadmap not found.");
    if (roadmap.steps.length === 0) {
      return reply(res, 200, true, "No skills to plan.", {
        advice: "Great work! Your quiz showed no missing skills for this role. Keep practising with small projects.",
      });
    }

    // 2. Build the prompt from real data
    const result = await loadLatestResult(req.user.id, roadmap.role_id);
    const prompt = fillPrompt(ADVICE_PROMPT, {
      ROLE_NAME: roadmap.role_name,
      MISSING_SKILLS: result.missing_skills.join(", ") || "none recorded",
      STEPS: roadmap.steps.map((s) => `${s.step_order}. ${s.skill_name} (${s.status})`).join("\n"),
    });

    // 3. Ask Gemini, remove markdown symbols, and keep it to 150 words
    const text = await askGemini(prompt);
    const advice = limitWords(text.replace(/\*\*/g, "").replace(/^#+\s*/gm, ""), ADVICE_MAX_WORDS);

    return reply(res, 200, true, "Here is your study plan.", { advice });
  } catch (err) {
    if (err.isGeminiError) {
      return reply(res, 503, false, `AI advice is not available right now. ${err.message}`);
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/replan   (protected)
// Body: { roadmap_id }
// 1. Looks at the done steps and the latest quiz result
// 2. Asks Gemini for a better order of the PENDING steps (with one reason each)
// 3. Saves the new step_order: done steps stay first, then the pending steps
// Returns the updated steps (each pending step has old_order and reason).
// ---------------------------------------------------------------------------
router.post("/ai/replan", verifyToken, async (req, res, next) => {
  let connection;
  try {
    // 1. Check the input and load the user's roadmap
    const roadmapId = toId(req.body.roadmap_id);
    if (!roadmapId) return reply(res, 400, false, "Please send a valid roadmap_id.");

    const roadmap = await loadUserRoadmap(roadmapId, req.user.id);
    if (!roadmap) return reply(res, 404, false, "Roadmap not found.");

    const done = roadmap.steps.filter((s) => s.status === "done");
    const pending = roadmap.steps.filter((s) => s.status === "pending");
    if (pending.length < 2) {
      return reply(res, 200, true, "Nothing to re-plan: fewer than 2 steps are still pending.", {
        roadmap_id: roadmap.id,
        steps: roadmap.steps,
      });
    }

    // 2. Ask Gemini for a new order of the pending steps
    const result = await loadLatestResult(req.user.id, roadmap.role_id);
    const prompt = fillPrompt(REPLAN_PROMPT, {
      ROLE_NAME: roadmap.role_name,
      SCORE: result.score === null ? "not available" : `${result.score}%`,
      MISSING_SKILLS: result.missing_skills.join(", ") || "none recorded",
      DONE_STEPS: done.map((s) => s.skill_name).join(", ") || "none yet",
      PENDING_STEPS: pending.map((s) => `- step_id ${s.id}: ${s.skill_name}`).join("\n"),
    });
    const aiResult = await askGeminiJson(prompt);

    // 3. Check Gemini's answer: keep only real pending step ids, each once.
    //    Any step Gemini forgot is added at the end in its old order.
    const aiOrder = aiResult && Array.isArray(aiResult.order) ? aiResult.order : null;
    if (!aiOrder) throw aiError("Gemini did not send a new order.");

    const reasons = {};
    const newPending = [];
    for (const item of aiOrder) {
      const step = pending.find((s) => s.id === Number(item && item.step_id));
      if (step && !newPending.includes(step)) {
        newPending.push(step);
        reasons[step.id] = String(item.reason || "").trim().slice(0, 200);
      }
    }
    for (const step of pending) {
      if (!newPending.includes(step)) {
        newPending.push(step);
        reasons[step.id] = "Kept in its old place.";
      }
    }

    // 4. Save the new order: done steps first, then pending steps in the AI order
    const finalOrder = [...done, ...newPending];
    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (let i = 0; i < finalOrder.length; i++) {
      await connection.execute("UPDATE roadmap_steps SET step_order = ? WHERE id = ? AND roadmap_id = ?", [
        i + 1,
        finalOrder[i].id,
        roadmap.id,
      ]);
    }
    await connection.commit();

    // 5. Send back the updated steps, with the old position and the reason
    const steps = finalOrder.map((s, i) => ({
      ...s,
      step_order: i + 1,
      old_order: s.step_order,
      reason: s.status === "pending" ? reasons[s.id] : null,
    }));
    return reply(res, 200, true, "Your roadmap has been re-planned.", { roadmap_id: roadmap.id, steps });
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.isGeminiError) {
      return reply(res, 503, false, `AI re-planning is not available right now. ${err.message} Your roadmap was not changed.`);
    }
    next(err);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
