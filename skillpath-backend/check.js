require("dotenv").config();
const key = process.env.GEMINI_API_KEY;
console.log("Key found:", Boolean(key));
console.log("Key length:", key ? key.length : 0);