// ============================================================
//  Vercel Serverless Function — /api/chat
//  Provider : Groq (console.groq.com)
//  Model    : openai/gpt-oss-120b  (config lives in api/_lib/groqClient.js)
//  Env var  : GROQ_API_KEY   (set this in Vercel → Settings → Environment Variables)
// ============================================================
// Used by the web AI widgets: src/screens/Store.tsx's CustomerAssistantWidget
// and src/views/AssistantView.tsx (admin assistant). The WhatsApp bot
// (api/whatsapp-webhook.js) calls the same shared callGroq() helper directly
// instead of hitting this HTTP endpoint.

import { callGroq } from "./_lib/groqClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { systemPrompt, messages } = req.body;
    const text = await callGroq(systemPrompt, messages);
    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.data || err.message });
  }
}
