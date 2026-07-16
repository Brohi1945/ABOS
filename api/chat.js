// ============================================================
//  ⚡ GROQ VERSION — api/chat.js
//  Provider : Groq (console.groq.com)
//  Model    : openai/gpt-oss-120b
//  Env var  : GROQ_API_KEY   (set this in Vercel → Settings → Environment Variables)
// ============================================================
// Vercel Serverless Function
// Path: /api/chat  (auto-detected because file lives in /api)
// Uses Groq's API (free tier, very high rate limits). The API key stays on
// the server — it is read from a Vercel Environment Variable, never from
// the frontend.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not set in Vercel environment variables" });
  }

  try {
    const { systemPrompt, messages } = req.body;

    // Groq's API is OpenAI-compatible: a flat "messages" array with a
    // "system" role first, then alternating user/assistant turns.
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: chatMessages,
        temperature: 0.5,
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
        // Discourages the model from repeating earlier phrases/replies —
        // this is what was causing it to "repeat itself" in long chats.
        frequency_penalty: 0.4,
        presence_penalty: 0.3,
        // gpt-oss is a reasoning model — without these two flags it can leak
        // its chain-of-thought / a duplicate plain-text sentence in front of
        // the JSON envelope, which is exactly the "code showing in chat" bug.
        reasoning_effort: "low",
        include_reasoning: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // Normalize Groq's OpenAI-style response into the same
    // { content: [{type:"text", text}] } shape our frontend already
    // expects (so App.jsx doesn't need to change).
    const text = data?.choices?.[0]?.message?.content || "";

    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}