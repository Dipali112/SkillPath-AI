// db.js
// Creates ONE shared pool of MySQL connections that every route can use.
// A "pool" keeps a few connections open and reuses them, which is faster
// than opening a new connection for every request.

const mysql = require("mysql2/promise"); // the promise version lets us use async/await
require("dotenv").config(); // loads the values from the .env file into process.env

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true, // wait if all connections are busy
  connectionLimit: 10, // max 10 connections at the same time
  queueLimit: 0, // no limit on waiting requests
});

// Small helper used by server.js to check the database at startup
async function testConnection() {
  const connection = await pool.getConnection();
  await connection.ping();
  connection.release(); // always give the connection back to the pool
}

module.exports = { pool, testConnection };
