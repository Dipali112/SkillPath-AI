// services/gemini.js
// Small helper that talks to the Google Gemini API.
//
// We call Gemini with plain fetch(), which is built into Node.js 18+,
// so no extra npm package is needed. The API key stays on the server:
// it is read from .env (GEMINI_API_KEY) and sent only to Google.

require("dotenv").config();

// ----- Settings -----
const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 20000; // give up after 20 seconds

// Added to the end of every JSON prompt, so Gemini replies with JSON only
const JSON_ONLY_INSTRUCTION =
  "Reply with valid JSON only. Do not add any explanation, markdown or code fences.";

// A special error type for "the AI failed". Routes check for it, so they can
// send a clean message to the user instead of crashing the server.
class GeminiError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeminiError";
    this.isGeminiError = true;
  }
}

// Sends one request to Gemini and returns the reply text.
// jsonMode = true asks Gemini to answer in JSON format.
async function callGemini(prompt, jsonMode) {
  // 1. Stop early with a clear message if the key is missing
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is missing. Add it to your .env file and restart the server.");
  }

  // 2. Cancel the request if it takes longer than 20 seconds
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey, // the key goes in a header, never in the URL
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: jsonMode ? "application/json" : "text/plain",
          thinkingConfig: { thinkingBudget: 0 }, // skip "thinking" so replies come back faster
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new GeminiError("Gemini took longer than 20 seconds to answer. Please try again.");
    }
    throw new GeminiError("Could not reach Gemini. Check your internet connection.");
  } finally {
    clearTimeout(timer); // the request finished, so stop the timer
  }

  // 3. Gemini answered, but with an error (wrong key, too many requests, ...)
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.error && body.error.message ? body.error.message : "";
    } catch (e) {
      // the error body was not JSON, ignore it
    }
    console.error(`Gemini error ${response.status}:`, detail); // full detail in the terminal only
    if (response.status === 400 && /API key/i.test(detail)) {
      throw new GeminiError("Your GEMINI_API_KEY is not valid. Check the key in your .env file.");
    }
    if (response.status === 429) {
      throw new GeminiError("Gemini is getting too many requests right now. Wait a minute and try again.");
    }
    throw new GeminiError(`Gemini returned an error (status ${response.status}). Please try again.`);
  }

  // 4. Pull the text out of Gemini's reply
  const data = await response.json();
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  if (!text) {
    throw new GeminiError("Gemini sent back an empty answer. Please try again.");
  }
  return text;
}

// askGemini(prompt) -> the reply as plain text
async function askGemini(prompt) {
  return callGemini(prompt, false);
}

// Removes ```json ... ``` fences that AI models sometimes wrap around JSON
function stripCodeFences(text) {
  return text
    .trim()
    .replace(/^```[a-zA-Z]*\s*/, "") // opening fence, e.g. ```json
    .replace(/\s*```$/, "") // closing fence
    .trim();
}

// askGeminiJson(prompt) -> the reply turned into a JavaScript object or array
async function askGeminiJson(prompt) {
  const text = await callGemini(`${prompt}\n\n${JSON_ONLY_INSTRUCTION}`, true);
  try {
    return JSON.parse(stripCodeFences(text));
  } catch (err) {
    console.error("Gemini sent invalid JSON:", text.slice(0, 500)); // for debugging in the terminal
    throw new GeminiError("Gemini's answer was not valid JSON. Please try again.");
  }
}

module.exports = { askGemini, askGeminiJson, stripCodeFences, GeminiError };
