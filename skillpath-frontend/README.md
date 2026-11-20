# SkillPath AI — Frontend

Plain HTML, CSS and JavaScript. No build tools, no frameworks.

## How to run in VS Code

1. Open this folder in VS Code.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` → **Open with Live Server**.

(You can also just double-click `index.html`, it works without a server.)

## Folder structure

```
skillpath-frontend/
├── index.html        Home page (hero, roles, how it works)
├── roles.html        Explore roles with search + filters
├── signup.html       Create account
├── login.html        Log in
├── dashboard.html    Stats, latest gap report, profile
├── quiz.html         Skill quiz → gap report
├── roadmap.html      Step-by-step roadmap with checkboxes
├── css/
│   └── style.css     All styles (colors are at the top in :root)
└── js/
    ├── data.js       Roles, skills and resources (same as schema.sql seed)
    ├── api.js        All "backend" calls — uses localStorage for now
    ├── main.js       Header, footer, mobile menu, helpers
    ├── auth.js       Login + signup forms
    ├── roles.js      Roles page
    ├── quiz.js       Quiz page
    ├── dashboard.js  Dashboard page
    └── roadmap.js    Roadmap page
```

## Connecting the backend later

Only `js/api.js` needs to change. Each function has a comment showing the
Express route it should call, for example:

```js
async getRoles() {
  const res = await fetch(`${API_BASE}/roles`);
  return res.json();
}
```

Right now the app stores users, reports and roadmaps in the browser's
localStorage so you can click through every page. Passwords are **not**
stored or checked in the browser — your Express backend should hash them
with bcrypt and check them on login.
