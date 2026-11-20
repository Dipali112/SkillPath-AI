// routes/auth.js
// Signup, login and "who am I" routes.
// All SQL uses "?" placeholders (parameterized queries). mysql2 fills them in
// safely, which protects us from SQL injection. Never build SQL by joining strings.

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const verifyToken = require("../middleware/auth");

const router = express.Router();

const SALT_ROUNDS = 10; // how hard bcrypt works; 10 is a good default
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper: send the same JSON shape every time -> { success, message, data }
function reply(res, status, success, message, data = null) {
  return res.status(status).json({ success, message, data });
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// Body: { name, email, password }
// Creates a new user. The password is hashed with bcrypt before saving,
// so the real password is never stored in the database.
// ---------------------------------------------------------------------------
router.post("/signup", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    // 1. Check the input
    if (name.length < 2 || name.length > 100) {
      return reply(res, 400, false, "Please enter your name (2 to 100 characters).");
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 150) {
      return reply(res, 400, false, "Please enter a valid email.");
    }
    if (password.length < 8) {
      return reply(res, 400, false, "Password must be at least 8 characters.");
    }
    if (Buffer.byteLength(password) > 72) {
      // bcrypt only uses the first 72 bytes of a password
      return reply(res, 400, false, "Password is too long (max 72 characters).");
    }

    // 2. Is this email already used?
    const [existing] = await pool.execute("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return reply(res, 409, false, "An account with this email already exists.");
    }

    // 3. Hash the password and save the new user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, passwordHash]
    );

    // 4. Send back the new user (never send the password hash)
    return reply(res, 201, true, "Account created. You can now log in.", {
      id: result.insertId,
      name,
      email,
    });
  } catch (err) {
    // Two signups with the same email at the exact same moment
    if (err.code === "ER_DUP_ENTRY") {
      return reply(res, 409, false, "An account with this email already exists.");
    }
    next(err); // anything else goes to the error handler in server.js
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Body: { email, password }
// Checks the password and returns a JWT token that is valid for 1 day.
// The frontend saves this token and sends it with protected requests.
// ---------------------------------------------------------------------------
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    // 1. Check the input
    if (!email || !password) {
      return reply(res, 400, false, "Please enter your email and password.");
    }

    // 2. Find the user by email
    const [rows] = await pool.execute(
      "SELECT id, name, email, password_hash FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];

    // 3. Compare the typed password with the saved hash.
    // We use the same message for "no user" and "wrong password",
    // so attackers can't find out which emails are registered.
    const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!passwordOk) {
      return reply(res, 401, false, "Email or password is incorrect.");
    }

    // 4. Create the token (expires in 1 day)
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return reply(res, 200, true, "Logged in successfully.", {
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me   (protected)
// Header: Authorization: Bearer <token>
// Returns the logged-in user. Useful to test that the token works.
// verifyToken runs first and puts the user's id in req.user.
// ---------------------------------------------------------------------------
router.get("/me", verifyToken, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, email, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0) {
      return reply(res, 404, false, "User not found.");
    }
    return reply(res, 200, true, "User loaded.", rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
