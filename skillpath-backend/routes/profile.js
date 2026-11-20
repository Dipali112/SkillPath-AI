// routes/profile.js
// The logged-in user's career profile (target role + current skills).
// Mounted in server.js with:  app.use("/api", profileRoutes);
// Every route here needs a login: verifyToken checks the JWT and sets req.user.

const express = require("express");
const { pool } = require("../db");
const verifyToken = require("../middleware/auth");

const router = express.Router();

// Helper: send the same JSON shape every time -> { success, message, data }
function reply(res, status, success, message, data = null) {
  return res.status(status).json({ success, message, data });
}

// Helper: get the user's profile row, or null if they haven't saved one yet
async function findProfile(userId) {
  const [rows] = await pool.execute(
    `SELECT id, user_id, target_role, current_skills, created_at
     FROM profiles
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// GET /api/profile   (protected)
// Returns the logged-in user's profile, or null if there isn't one yet.
// ---------------------------------------------------------------------------
router.get("/profile", verifyToken, async (req, res, next) => {
  try {
    const profile = await findProfile(req.user.id);
    const message = profile ? "Profile loaded." : "No profile saved yet.";
    return reply(res, 200, true, message, profile);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/profile   (protected)
// Body: { target_role, current_skills }
// Creates the profile the first time, and updates it after that.
// ---------------------------------------------------------------------------
router.put("/profile", verifyToken, async (req, res, next) => {
  try {
    const targetRole = String(req.body.target_role || "").trim();
    const currentSkills = String(req.body.current_skills || "").trim();

    // 1. Check the input
    if (!targetRole) {
      return reply(res, 400, false, "Please choose a target role.");
    }
    if (targetRole.length > 100) {
      return reply(res, 400, false, "Target role is too long (max 100 characters).");
    }
    if (currentSkills.length > 2000) {
      return reply(res, 400, false, "Current skills is too long (max 2000 characters).");
    }

    // 2. Update the profile if it exists, otherwise insert a new one
    const existing = await findProfile(req.user.id);
    if (existing) {
      await pool.execute(
        "UPDATE profiles SET target_role = ?, current_skills = ? WHERE id = ?",
        [targetRole, currentSkills, existing.id]
      );
    } else {
      await pool.execute(
        "INSERT INTO profiles (user_id, target_role, current_skills) VALUES (?, ?, ?)",
        [req.user.id, targetRole, currentSkills]
      );
    }

    // 3. Send back the saved profile
    const profile = await findProfile(req.user.id);
    return reply(res, 200, true, "Profile saved.", profile);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
