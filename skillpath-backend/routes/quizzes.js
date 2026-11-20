// routes/quizzes.js
// Skill quiz -> gap report -> learning roadmap.
// Mounted in server.js with:  app.use("/api", quizRoutes);
// Every route here needs a login: verifyToken checks the JWT and sets req.user.

const express = require("express");
const { pool } = require("../db");
const verifyToken = require("../middleware/auth");

const router = express.Router();

const MAX_POINTS_PER_SKILL = 3; // answers go from 0 (never used it) to 3 (confident)
const STRONG_FROM = 2; // 2 or more points = strong skill, below 2 = missing skill

// One free learning resource per skill, used for the roadmap steps.
// To add a new skill, just add a new line here.
const RESOURCES = {
  "HTML": { title: "MDN — HTML basics", link: "https://developer.mozilla.org/en-US/docs/Learn/HTML" },
  "CSS": { title: "MDN — Learn CSS", link: "https://developer.mozilla.org/en-US/docs/Learn/CSS" },
  "HTML and CSS": { title: "freeCodeCamp — Responsive Web Design", link: "https://www.freecodecamp.org/learn/2022/responsive-web-design/" },
  "JavaScript": { title: "javascript.info — The Modern JS Tutorial", link: "https://javascript.info/" },
  "Git and GitHub": { title: "GitHub Skills — Intro to GitHub", link: "https://skills.github.com/" },
  "Responsive Design": { title: "web.dev — Learn Responsive Design", link: "https://web.dev/learn/design/" },
  "React": { title: "React — Official Quick Start", link: "https://react.dev/learn" },
  "REST API Basics": { title: "MDN — Fetching data from the server", link: "https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Client-side_web_APIs/Fetching_data" },
  "Frontend Testing": { title: "Testing Library — Introduction", link: "https://testing-library.com/docs/" },
  "Node.js": { title: "Node.js — Official Learn guide", link: "https://nodejs.org/en/learn" },
  "Express.js": { title: "Express — Getting started", link: "https://expressjs.com/en/starter/installing.html" },
  "SQL and MySQL": { title: "MySQL Tutorial for beginners", link: "https://www.mysqltutorial.org/" },
  "SQL": { title: "SQLBolt — Interactive SQL lessons", link: "https://sqlbolt.com/" },
  "REST API Design": { title: "Microsoft — RESTful API design", link: "https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design" },
  "Authentication (JWT)": { title: "jwt.io — Introduction to JWT", link: "https://jwt.io/introduction" },
  "Deployment Basics": { title: "Render — Deploy a Node app", link: "https://render.com/docs/deploy-node-express-app" },
  "Excel": { title: "Microsoft — Excel training", link: "https://support.microsoft.com/en-us/excel" },
  "Statistics Basics": { title: "Khan Academy — Statistics", link: "https://www.khanacademy.org/math/statistics-probability" },
  "Python": { title: "Python — Official Tutorial", link: "https://docs.python.org/3/tutorial/" },
  "Pandas": { title: "pandas — 10 minutes to pandas", link: "https://pandas.pydata.org/docs/user_guide/10min.html" },
  "Data Visualization": { title: "Kaggle — Data Visualization course", link: "https://www.kaggle.com/learn/data-visualization" },
  "Power BI or Tableau": { title: "Microsoft Learn — Power BI", link: "https://learn.microsoft.com/en-us/training/powerplatform/power-bi" },
  "Linux Basics": { title: "Linux Journey", link: "https://linuxjourney.com/" },
  "Networking Basics": { title: "Cloudflare — What is networking?", link: "https://www.cloudflare.com/learning/network-layer/what-is-the-network-layer/" },
  "Shell Scripting": { title: "Shell Scripting Tutorial", link: "https://www.shellscript.sh/" },
  "Docker": { title: "Docker — Get started", link: "https://docs.docker.com/get-started/" },
  "CI/CD (GitHub Actions)": { title: "GitHub Actions — Quickstart", link: "https://docs.github.com/en/actions/quickstart" },
  "Cloud Basics (AWS)": { title: "AWS Skill Builder — Cloud Practitioner", link: "https://skillbuilder.aws/" },
  "Kubernetes": { title: "Kubernetes — Basics tutorial", link: "https://kubernetes.io/docs/tutorials/kubernetes-basics/" },
};

// Helper: send the same JSON shape every time -> { success, message, data }
function reply(res, status, success, message, data = null) {
  return res.status(status).json({ success, message, data });
}

// Helper: find a resource for a skill. Skills not in the list get a search link.
function resourceFor(skill) {
  return (
    RESOURCES[skill] || {
      title: `Learn ${skill}`,
      link: `https://www.google.com/search?q=${encodeURIComponent("learn " + skill)}`,
    }
  );
}

// Helper: load a role's name and its skills in learning order
async function loadRoleWithSkills(roleId) {
  const [roles] = await pool.execute("SELECT id, role_name FROM roles WHERE id = ?", [roleId]);
  if (roles.length === 0) return null;

  const [skills] = await pool.execute(
    "SELECT skill_name FROM role_skills WHERE role_id = ? ORDER BY learning_order",
    [roleId]
  );
  return { ...roles[0], skills: skills.map((s) => s.skill_name) };
}

// ---------------------------------------------------------------------------
// POST /api/quizzes   (protected)
// Body: { role_id, answers }   answers looks like { "HTML": 3, "CSS": 1 }
// 1. Works out the score and which skills are strong or missing
// 2. Saves a quiz, a gap report and a new roadmap (one step per missing skill)
// 3. Returns { role_id, role_name, score, answers, strong_skills, missing_skills, created_at }
// ---------------------------------------------------------------------------
router.post("/quizzes", verifyToken, async (req, res, next) => {
  let connection; // a single connection, so all the inserts happen together
  try {
    const roleId = Number(req.body.role_id);
    const answersIn = req.body.answers;

    // 1. Check the input
    if (!Number.isInteger(roleId) || roleId < 1) {
      return reply(res, 400, false, "Please send a valid role_id.");
    }
    if (!answersIn || typeof answersIn !== "object" || Array.isArray(answersIn)) {
      return reply(res, 400, false, 'answers must be an object like { "HTML": 3, "CSS": 1 }.');
    }

    const role = await loadRoleWithSkills(roleId);
    if (!role) {
      return reply(res, 404, false, "Role not found.");
    }
    if (role.skills.length === 0) {
      return reply(res, 400, false, "This role has no skills to test yet.");
    }

    // 2. Keep only this role's skills. A skill with no answer counts as 0 points.
    const answers = {};
    for (const skill of role.skills) {
      const points = answersIn[skill] === undefined ? 0 : Number(answersIn[skill]);
      if (!Number.isInteger(points) || points < 0 || points > MAX_POINTS_PER_SKILL) {
        return reply(res, 400, false, `Points for "${skill}" must be a whole number from 0 to 3.`);
      }
      answers[skill] = points;
    }

    // 3. Score = (total points / (number of skills x 3)) x 100, rounded
    const totalPoints = role.skills.reduce((sum, skill) => sum + answers[skill], 0);
    const score = Math.round((totalPoints / (role.skills.length * MAX_POINTS_PER_SKILL)) * 100);

    // Missing = below 2 points, strong = 2 or more (both stay in learning order)
    const missingSkills = role.skills.filter((skill) => answers[skill] < STRONG_FROM);
    const strongSkills = role.skills.filter((skill) => answers[skill] >= STRONG_FROM);

    // 4. Save everything in ONE transaction: either all rows are saved, or none are
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      "INSERT INTO quizzes (user_id, role_id, score, answers) VALUES (?, ?, ?, ?)",
      [req.user.id, roleId, score, JSON.stringify(answers)]
    );

    const [gapResult] = await connection.execute(
      "INSERT INTO gap_reports (user_id, role_id, missing_skills) VALUES (?, ?, ?)",
      [req.user.id, roleId, missingSkills.join(", ")]
    );

    const [roadmapResult] = await connection.execute(
      "INSERT INTO roadmaps (user_id, role_id) VALUES (?, ?)",
      [req.user.id, roleId]
    );

    // One roadmap step per missing skill, in learning order, all "pending"
    for (let i = 0; i < missingSkills.length; i++) {
      const skill = missingSkills[i];
      const resource = resourceFor(skill);
      await connection.execute(
        `INSERT INTO roadmap_steps
           (roadmap_id, skill_name, resource_title, resource_link, step_order, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [roadmapResult.insertId, skill, resource.title, resource.link, i + 1]
      );
    }

    await connection.commit();

    // 5. Read back the time the report was saved
    const [saved] = await connection.execute(
      "SELECT created_at FROM gap_reports WHERE id = ?",
      [gapResult.insertId]
    );

    return reply(res, 201, true, "Quiz saved. Your gap report and roadmap are ready.", {
      role_id: role.id,
      role_name: role.role_name,
      score,
      answers,
      strong_skills: strongSkills,
      missing_skills: missingSkills,
      created_at: saved[0].created_at,
    });
  } catch (err) {
    if (connection) await connection.rollback(); // undo the half-saved rows
    next(err);
  } finally {
    if (connection) connection.release(); // always give the connection back
  }
});

// ---------------------------------------------------------------------------
// GET /api/gap-reports/latest   (protected)
// Returns the user's newest gap report in the same shape as POST /api/quizzes,
// or null if they haven't taken a quiz yet.
// ---------------------------------------------------------------------------
router.get("/gap-reports/latest", verifyToken, async (req, res, next) => {
  try {
    // 1. Newest gap report for this user
    const [reports] = await pool.execute(
      `SELECT id, role_id, missing_skills, created_at
       FROM gap_reports
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [req.user.id]
    );
    const report = reports[0];
    if (!report) {
      return reply(res, 200, true, "No gap report yet. Take a skill quiz first.", null);
    }

    // 2. The role (name + skills in learning order)
    const role = await loadRoleWithSkills(report.role_id);
    if (!role) {
      return reply(res, 404, false, "The role for this report no longer exists.");
    }

    // 3. The quiz saved together with this report (for the score and answers)
    const [quizzes] = await pool.execute(
      `SELECT score, answers
       FROM quizzes
       WHERE user_id = ? AND role_id = ? AND created_at <= ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [req.user.id, report.role_id, report.created_at]
    );
    const quiz = quizzes[0] || { score: null, answers: null };

    let answers = {};
    try {
      answers = quiz.answers ? JSON.parse(quiz.answers) : {};
    } catch (e) {
      answers = {}; // bad JSON in the database: show the report without answers
    }

    // 4. missing_skills is saved as text like "React, Git"; turn it back into a list
    const missingSkills = report.missing_skills
      ? report.missing_skills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const strongSkills = role.skills.filter((skill) => !missingSkills.includes(skill));

    return reply(res, 200, true, "Gap report loaded.", {
      role_id: role.id,
      role_name: role.role_name,
      score: quiz.score,
      answers,
      strong_skills: strongSkills,
      missing_skills: missingSkills,
      created_at: report.created_at,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.resourceFor = resourceFor; // lets routes/ai.js use the same learning resources
