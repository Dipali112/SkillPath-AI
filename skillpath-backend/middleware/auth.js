// middleware/auth.js
// Protects routes so only logged-in users can use them.
//
// The frontend must send the token it got from /api/auth/login like this:
//   Authorization: Bearer <token>
//
// If the token is valid, we save the user's info in req.user and call next().
// If not, we stop here and reply with 401 (Unauthorized).

const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  // 1. Is there a token at all?
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Please log in first. No token was sent.",
      data: null,
    });
  }

  // 2. Is the token real and not expired?
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, email: payload.email }; // available in the next handler
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "Your session has expired. Please log in again."
        : "Invalid token. Please log in again.";
    return res.status(401).json({ success: false, message, data: null });
  }
}

module.exports = verifyToken;
