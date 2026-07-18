// ============================================================
//  Shared Groq (OpenAI-compatible) caller.
//  Used by BOTH api/chat.js (web AI widgets) and
//  api/whatsapp-webhook.js (WhatsApp bot) so the model config
//  lives in exactly one place — do not duplicate this logic.
// ============================================================

const MAX_RETRIES = 3; // total attempts = 1 + MAX_RETRIES
const BASE_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 20000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exponential backoff with jitter. Honors the server's Retry-After header
// (Groq sends this on 429s) instead of guessing when possible.
function computeDelay(attempt, response) {
  const retryAfterHeader = response?.headers?.get?.("retry-after");
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
  }
  const jitter = Math.random() * 250;
  return BASE_DELAY_MS * 2 ** attempt + jitter;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function callGroq(systemPrompt, messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error("GROQ_API_KEY is not set in Vercel environment variables");
    err.status = 500;
    throw err;
  }

  if (!systemPrompt || typeof systemPrompt !== "string") {
    const err = new Error("systemPrompt is required and must be a string");
    err.status = 400;
    throw err;
  }

  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...(Array.isArray(messages) ? messages : []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  const body = JSON.stringify({
    model: "openai/gpt-oss-120b",
    messages: chatMessages,
    temperature: 0.5,
    max_completion_tokens: 1500,
    response_format: { type: "json_object" },
    frequency_penalty: 0.4,
    presence_penalty: 0.3,
    reasoning_effort: "medium",
    include_reasoning: false,
  });

  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body,
      });
    } catch (networkErr) {
      // Network failure or timeout — retryable.
      lastErr = networkErr;
      if (attempt < MAX_RETRIES) {
        await sleep(computeDelay(attempt));
        continue;
      }
      const err = new Error("Could not reach Groq (network error or timeout)");
      err.status = 502;
      err.cause = networkErr;
      throw err;
    }

    // 429 (rate limit) and 5xx (transient server issues) are worth retrying.
    // 400/401/403/404 etc are the caller's fault (bad request, bad key) and
    // will never succeed on retry, so fail fast instead of burning attempts.
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      lastErr = { status: response.status };
      await sleep(computeDelay(attempt, response));
      continue;
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const err = new Error(
        response.status === 429
          ? "Groq rate limit hit and retries exhausted"
          : "Groq API error"
      );
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data?.choices?.[0]?.message?.content || "";
  }

  const err = new Error("Groq API error after retries");
  err.status = lastErr?.status || 502;
  throw err;
}

// Same parsing rules as src/lib/aiHelpers.tsx's parseAssistantReply — kept
// as a small standalone copy here because this file runs as plain Node
// (not Vite-bundled) and can't import the frontend .tsx module directly.
export function parseReply(raw) {
  let cleaned = (raw || "").trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const jsonSlice = cleaned.slice(start, end + 1);
    try {
      const parsed = JSON.parse(jsonSlice);
      if (parsed && typeof parsed === "object" && "reply" in parsed) {
        return { reply: parsed.reply, action: parsed.action || null };
      }
    } catch (e) {
      // fall through
    }
  }
  return { reply: raw || "Sorry, samajh nahi aaya — dobara batayein?", action: null };
}
