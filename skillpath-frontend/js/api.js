/* ==========================================================================
   api.js: the ONLY file that talks to the backend.
   Every function returns a Promise. All data now comes from the Express
   + MySQL backend running on port 5001.
   ========================================================================== */

const API_BASE = "http://localhost:5001/api";

const TOKEN_KEY = "skillpath_token";     // JWT: the login entry pass
const USER_KEY = "skillpath_user";       // logged-in user info
const SESSION_KEY = "skillpath_session"; // email of the logged-in user

// One common function: calls the backend and opens the { success, message, data } answer
async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  let res;
  try {
    res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (e) {
    throw new Error("Cannot reach the server. Is the backend running?");
  }
  let body = null;
  try { body = await res.json(); } catch (e) {}

  // Session expired (token too old): clear it and send the user to the login page.
  // We skip /auth/ calls, because a wrong password on login is also a 401.
  if (res.status === 401 && token && !path.startsWith("/auth/")) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_KEY);
    const page = location.pathname.split("/").pop();
    if (page !== "login.html" && page !== "signup.html") {
      const next = /^[\w-]+\.html$/.test(page) ? `?next=${encodeURIComponent(page)}` : "";
      location.href = "login.html" + next;
    }
  }

  if (!res.ok || !body || body.success === false) {
    const err = new Error((body && body.message) || "Something went wrong. Please try again.");
    err.status = res.status;
    err.data = body ? body.data : null; // e.g. { fallback: "self-rating-quiz" } when the AI is down
    throw err;
  }
  return body.data;
}

const Api = {
  // ----- Roles ----------------------------------------------------------
  async getRoles() {
    return request("/roles");
  },

  async getRole(id) {
    try {
      return await request(`/roles/${id}`);
    } catch (e) {
      return null; // role not found
    }
  },

  // ----- Auth -----------------------------------------------------------
  async signup({ name, email, password }) {
    await request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    return this.login({ email, password }); // log in right after signup
  },

  async login({ email, password }) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const user = data.user || { id: data.id, name: data.name || email, email };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_KEY, user.email);
    return user;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_KEY);
  },

  // Returns the logged-in user, or null (sync, so the header can use it)
  currentUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY)) || null;
    } catch (e) {
      return null;
    }
  },

  // ----- Profile --------------------------------------------------------
  async getProfile() {
    try {
      return await request("/profile");
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  async saveProfile({ target_role, current_skills }) {
    return request("/profile", {
      method: "PUT",
      body: JSON.stringify({ target_role, current_skills }),
    });
  },

  // ----- Quiz, Gap report, Roadmap ----------------------------------------
  // answers looks like { "HTML": 3, "CSS": 1 }  (0 to 3 points per skill)
  async submitQuiz(roleId, answers) {
    return request("/quizzes", {
      method: "POST",
      body: JSON.stringify({ role_id: Number(roleId), answers }),
    });
  },

  // Latest gap report, or null if the user has none yet
  async getLatestReport() {
    try {
      return await request("/gap-reports/latest");
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  // Latest roadmap, or null if the user has none yet
  async getRoadmap() {
    try {
      return await request("/roadmaps/latest");
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  // status is "done" or "pending"
  async updateStepStatus(stepId, status) {
    return request(`/roadmap-steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  // ----- AI (Gemini) ------------------------------------------------------
  // These can take 5 to 20 seconds, so pages should show a loading message.
  // If the AI is down, the error has err.status = 503 and
  // err.data.fallback = "self-rating-quiz", so the page can use submitQuiz() instead.

  // Returns { quiz_id, role_id, role_name, questions: [{ id, skill_name, question_text, options }] }
  async startAiQuiz(roleId) {
    return request("/ai/quiz", {
      method: "POST",
      body: JSON.stringify({ role_id: Number(roleId) }),
    });
  },

  // answers looks like { "12": "a", "13": "c" } (question id -> chosen option)
  // Returns { score, strong_skills, missing_skills, roadmap_id }
  async submitAiQuiz(quizId, answers) {
    return request(`/ai/quiz/${quizId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  },

  // Returns { advice }
  async getRoadmapAdvice(roadmapId) {
    return request("/ai/roadmap-advice", {
      method: "POST",
      body: JSON.stringify({ roadmap_id: roadmapId }),
    });
  },

  // Returns { roadmap_id, steps: [{ id, skill_name, resource_title, resource_link, step_order, status, old_order, reason }] }
  async replanRoadmap(roadmapId) {
    return request("/ai/replan", {
      method: "POST",
      body: JSON.stringify({ roadmap_id: roadmapId }),
    });
  },
};