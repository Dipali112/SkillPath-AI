/* ==========================================================================
   data.js — sample data that matches the seed data in schema.sql.
   When your Express backend is ready, this data will come from MySQL
   (GET /api/roles) instead of this file.
   ========================================================================== */

// Roles and their skills, in learning order (same as the role_skills table)
const ROLES = [
  {
    id: 1,
    role_name: "Frontend Developer",
    icon: "🎨",
    category: "Web Development",
    summary: "Build the parts of websites and apps that people see and click.",
    skills: ["HTML", "CSS", "JavaScript", "Git and GitHub", "Responsive Design", "React", "REST API Basics", "Frontend Testing"],
  },
  {
    id: 2,
    role_name: "Backend Developer",
    icon: "⚙️",
    category: "Web Development",
    summary: "Write the server code, APIs and databases that power an app.",
    skills: ["JavaScript", "Git and GitHub", "Node.js", "Express.js", "SQL and MySQL", "REST API Design", "Authentication (JWT)", "Deployment Basics"],
  },
  {
    id: 3,
    role_name: "Full Stack Developer",
    icon: "🧩",
    category: "Web Development",
    summary: "Handle both the frontend and the backend of a web application.",
    skills: ["HTML and CSS", "JavaScript", "Git and GitHub", "React", "Node.js", "Express.js", "SQL and MySQL", "Deployment Basics"],
  },
  {
    id: 4,
    role_name: "Data Analyst",
    icon: "📊",
    category: "Data",
    summary: "Turn raw data into charts, reports and business decisions.",
    skills: ["Excel", "Statistics Basics", "SQL", "Python", "Pandas", "Data Visualization", "Power BI or Tableau"],
  },
  {
    id: 5,
    role_name: "DevOps Engineer",
    icon: "🚀",
    category: "Cloud & Infrastructure",
    summary: "Automate how software is built, tested and shipped to servers.",
    skills: ["Linux Basics", "Networking Basics", "Git and GitHub", "Shell Scripting", "Docker", "CI/CD (GitHub Actions)", "Cloud Basics (AWS)", "Kubernetes"],
  },
];

// One free learning resource per skill (used when building a roadmap)
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

// Answer choices for the skill quiz. "points" is what each answer is worth.
const QUIZ_LEVELS = [
  { points: 0, label: "Never used it", hint: "I haven't started learning this yet" },
  { points: 1, label: "Beginner", hint: "I know the basics from a tutorial" },
  { points: 2, label: "Comfortable", hint: "I've used it in a small project" },
  { points: 3, label: "Confident", hint: "I could explain it or use it at work" },
];
