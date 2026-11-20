# SkillPath AI — Backend

Node.js + Express + MySQL (mysql2). No ORM, plain SQL only.

## Folder structure

```
skillpath-backend/
├── server.js           Starts Express (cors, JSON, routes, error handling)
├── db.js               MySQL connection pool (reads .env)
├── routes/
│   └── auth.js         /api/auth/signup, /api/auth/login, /api/auth/me
├── middleware/
│   └── auth.js         Checks the JWT token on protected routes
├── package.json
├── .env.example        Copy to .env and fill in
└── .gitignore
```

## How to run

1. Load the database first: `mysql -u root -p < schema.sql`
2. Open this folder in VS Code and open a terminal.
3. Install packages: `npm install`
4. Copy `.env.example` to `.env` and fill in your MySQL password and a JWT secret.
5. Start the server: `npm start` (or `npm run dev` to auto-restart on changes)

You should see:

```
Server running on http://localhost:5001
Connected to MySQL database: skillpath
```

## API

Every response looks like: `{ "success": true/false, "message": "...", "data": ... }`

| Method | URL                | Body / Header                      | What it does                    |
| ------ | ------------------ | ---------------------------------- | ------------------------------- |
| GET    | /api/health        | –                                  | Checks the server is running    |
| POST   | /api/auth/signup   | `{ name, email, password }`        | Creates an account              |
| POST   | /api/auth/login    | `{ email, password }`              | Returns `{ token, user }`       |
| GET    | /api/auth/me       | `Authorization: Bearer <token>`    | Returns the logged-in user      |

The token is valid for 1 day.

## Try it with curl (or Postman / Thunder Client)

```bash
curl -X POST http://localhost:5000/api/auth/signup -H "Content-Type: application/json" -d "{\"name\":\"Dipali\",\"email\":\"dipali@example.com\",\"password\":\"secret123\"}"

curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"dipali@example.com\",\"password\":\"secret123\"}"

curl http://localhost:5000/api/auth/me -H "Authorization: Bearer PASTE_TOKEN_HERE"
```

## Protecting more routes later

```js
const verifyToken = require("./middleware/auth");
router.get("/profile", verifyToken, async (req, res) => {
  // req.user.id is the logged-in user's id
});
```

## Common problems

- **"Could not connect to MySQL"** — check the values in `.env` and that MySQL is running.
- **Port 5000 already in use** (common on Mac, AirPlay uses it) — set `PORT=5001` in `.env`.
- **`npm install` fails on bcrypt** — update Node.js to version 18 or newer.
