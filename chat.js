// Vercel Serverless Function
// Path: /api/chat  (auto-detected because file lives in /api)
// Uses Google Gemini API (free tier). The API key stays on the server —
// it is read from a Vercel Environment Variable, never from the frontend.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel environment variables" });
  }

  try {
    const { systemPrompt, messages } = req.body;

    // Gemini doesn't use a separate "system" field the same way Anthropic does,
    // so we prepend the system prompt as the first turn, then map the rest
    // of the conversation into Gemini's "contents" format.
    const contents = [
      { role: "user", parts: [{ text: `${systemPrompt}\n\n(Just reply "Understood" if you're ready.)` }] },
      { role: "model", parts: [{ text: "Understood." }] },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({ contents }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // Normalize Gemini's response shape into the same { content: [{type:"text", text}] }
    // shape our frontend already expects (so App.jsx doesn't need to change).
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";

    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
