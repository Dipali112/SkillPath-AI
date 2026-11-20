// server.js
// The starting point of the backend. Run it with:  npm start

require("dotenv").config(); // load .env values first, before anything else uses them

const express = require("express");
const cors = require("cors");
const { testConnection } = require("./db");
const authRoutes = require("./routes/auth");
const rolesRoutes = require("./routes/roles");
const profileRoutes = require("./routes/profile");
const quizRoutes = require("./routes/quizzes");
const roadmapRoutes = require("./routes/roadmaps");
const aiRoutes = require("./routes/ai");


// Stop early with a clear message if the JWT secret is missing
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5001;

// ----- Middleware (runs before every route) -----
app.use(cors()); // allow the frontend (e.g. Live Server on port 5500) to call this API
app.use(express.json()); // read JSON bodies into req.body

// ----- Routes -----

// GET /api/health -> quick check that the server is running
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "SkillPath API is running", data: null });
});

// All auth routes start with /api/auth  (signup, login, me)
app.use("/api/auth", authRoutes);
// Roles (public), profile, quizzes, gap reports and roadmaps (need a login)
app.use("/api", rolesRoutes);
app.use("/api", profileRoutes);
app.use("/api", quizRoutes);
app.use("/api", roadmapRoutes);
app.use("/api", aiRoutes); // AI quiz, advice and re-planning (need a login)

// ----- 404: no route matched -----
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found", data: null });
});

// ----- Error handler: catches any error passed to next(err) -----
// Express knows this is an error handler because it has 4 parameters.
app.use((err, req, res, next) => {
  // The request body was not valid JSON
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON in request body", data: null });
  }
  console.error(err); // show the real error in the terminal (not to the user)
  res.status(500).json({ success: false, message: "Something went wrong on the server", data: null });
});

// ----- Start the server -----
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    await testConnection();
    console.log("Connected to MySQL database:", process.env.DB_NAME);
  } catch (err) {
    console.error("Could not connect to MySQL:", err.message);
    console.error("Check DB_HOST, DB_USER, DB_PASSWORD and DB_NAME in your .env file.");
  }
});
