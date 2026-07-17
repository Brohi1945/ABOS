// ============================================================
//  Vercel Serverless Function — /api/whatsapp
//  OUTBOUND WhatsApp sender - used by notify.ts for waitlist
//  and other customer notifications.
// ============================================================
import { sendWhatsAppText } from "./_lib/waClient.js";

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, message } = req.body || {};
  
  if (!to || !message) {
    return res.status(400).json({ 
      error: "to and message are required",
      received: { to: !!to, message: !!message }
    });
  }

  // Validate phone format
  const cleanPhone = to.replace(/[\s\-()]/g, '');
  if (!cleanPhone.match(/^\+?[0-9]{10,15}$/)) {
    return res.status(400).json({ 
      error: "Invalid phone number format",
      received: to,
      expected: "e.g., +923001234567 or 923001234567"
    });
  }

  const result = await sendWhatsAppText(to, message);
  
  if (!result.ok) {
    console.error("WhatsApp send failed:", result.data || result.error);
    return res.status(500).json({ 
      error: "WhatsApp send failed", 
      details: result.data || result.error 
    });
  }
  
  return res.status(200).json({ 
    sent: true, 
    to: to,
    message: message.slice(0, 50) + (message.length > 50 ? '...' : '')
  });
}
