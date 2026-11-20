// routes/roadmaps.js
// The user's learning roadmap and its steps.
// Mounted in server.js with:  app.use("/api", roadmapRoutes);
// Every route here needs a login: verifyToken checks the JWT and sets req.user.

const express = require("express");
const { pool } = require("../db");
const verifyToken = require("../middleware/auth");

const router = express.Router();

// Helper: send the same JSON shape every time -> { success, message, data }
function reply(res, status, success, message, data = null) {
  return res.status(status).json({ success, message, data });
}

// ---------------------------------------------------------------------------
// GET /api/roadmaps/latest   (protected)
// Returns the user's newest roadmap with its steps in order, or null.
// ---------------------------------------------------------------------------
router.get("/roadmaps/latest", verifyToken, async (req, res, next) => {
  try {
    // 1. Find the newest roadmap for this user (and the role's name)
    const [roadmaps] = await pool.execute(
      `SELECT rm.id, rm.role_id, r.role_name, rm.created_at
       FROM roadmaps rm
       JOIN roles r ON r.id = rm.role_id
       WHERE rm.user_id = ?
       ORDER BY rm.created_at DESC, rm.id DESC
       LIMIT 1`,
      [req.user.id]
    );
    const roadmap = roadmaps[0];
    if (!roadmap) {
      return reply(res, 200, true, "No roadmap yet. Take a skill quiz first.", null);
    }

    // 2. Load its steps, first step first
    const [steps] = await pool.execute(
      `SELECT id, skill_name, resource_title, resource_link, step_order, status
       FROM roadmap_steps
       WHERE roadmap_id = ?
       ORDER BY step_order`,
      [roadmap.id]
    );

    return reply(res, 200, true, "Roadmap loaded.", {
      role_id: roadmap.role_id,
      role_name: roadmap.role_name,
      created_at: roadmap.created_at,
      steps,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/roadmap-steps/:id   (protected)
// Body: { status: "done" or "pending" }
// Marks one step as done (or back to pending). The step must belong to one
// of the logged-in user's roadmaps, otherwise we answer 404.
// ---------------------------------------------------------------------------
router.patch("/roadmap-steps/:id", verifyToken, async (req, res, next) => {
  try {
    const stepId = Number(req.params.id);
    const status = req.body.status;

    // 1. Check the input
    if (!Number.isInteger(stepId) || stepId < 1) {
      return reply(res, 400, false, "Step id must be a positive whole number.");
    }
    if (status !== "done" && status !== "pending") {
      return reply(res, 400, false, 'Status must be "done" or "pending".');
    }

    // 2. Update the step, but only if its roadmap belongs to this user.
    //    The JOIN makes sure nobody can change someone else's step.
    const [result] = await pool.execute(
      `UPDATE roadmap_steps rs
       JOIN roadmaps rm ON rm.id = rs.roadmap_id
       SET rs.status = ?
       WHERE rs.id = ? AND rm.user_id = ?`,
      [status, stepId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return reply(res, 404, false, "Step not found.");
    }

    // 3. Send back the updated step
    const [rows] = await pool.execute(
      `SELECT id, skill_name, resource_title, resource_link, step_order, status
       FROM roadmap_steps
       WHERE id = ?`,
      [stepId]
    );
    return reply(res, 200, true, "Step updated.", rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
