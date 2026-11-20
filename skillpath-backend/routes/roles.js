// routes/roles.js
// Public routes (no login needed) that list the IT job roles and their skills.
// Mounted in server.js with:  app.use("/api", rolesRoutes);
// All SQL uses "?" placeholders (parameterized queries) to stay safe from SQL injection.

const express = require("express");
const { pool } = require("../db");

const router = express.Router();

// Helper: send the same JSON shape every time -> { success, message, data }
function reply(res, status, success, message, data = null) {
  return res.status(status).json({ success, message, data });
}

// Helper: load roles together with their skills.
// If roleId is given, only that role is loaded.
// Returns a list like:
//   [{ id, role_name, icon, category, summary, skills: ["HTML", "CSS", ...] }]
async function loadRoles(roleId = null) {
  // LEFT JOIN gives one row per (role, skill). A role with no skills still
  // appears once, with skill_name = NULL.
  let sql = `
    SELECT r.id, r.role_name, r.icon, r.category, r.summary, rs.skill_name
    FROM roles r
    LEFT JOIN role_skills rs ON rs.role_id = r.id`;
  const params = [];

  if (roleId !== null) {
    sql += " WHERE r.id = ?";
    params.push(roleId);
  }
  sql += " ORDER BY r.id, rs.learning_order"; // skills come out in learning order

  const [rows] = await pool.execute(sql, params);

  // Turn the flat rows into one object per role
  const roles = [];
  const byId = {};
  for (const row of rows) {
    if (!byId[row.id]) {
      byId[row.id] = {
        id: row.id,
        role_name: row.role_name,
        icon: row.icon,
        category: row.category,
        summary: row.summary,
        skills: [],
      };
      roles.push(byId[row.id]);
    }
    if (row.skill_name) {
      byId[row.id].skills.push(row.skill_name);
    }
  }
  return roles;
}

// ---------------------------------------------------------------------------
// GET /api/roles   (public)
// Returns every role with its skills in learning order.
// ---------------------------------------------------------------------------
router.get("/roles", async (req, res, next) => {
  try {
    const roles = await loadRoles();
    return reply(res, 200, true, "Roles loaded.", roles);
  } catch (err) {
    next(err); // goes to the error handler in server.js
  }
});

// ---------------------------------------------------------------------------
// GET /api/roles/:id   (public)
// Returns one role in the same shape, or 404 if it doesn't exist.
// ---------------------------------------------------------------------------
router.get("/roles/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply(res, 400, false, "Role id must be a positive whole number.");
    }

    const roles = await loadRoles(id);
    if (roles.length === 0) {
      return reply(res, 404, false, "Role not found.");
    }
    return reply(res, 200, true, "Role loaded.", roles[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
