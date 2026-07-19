// ============================================================
//  Shared transactional email sender — /api/_lib/emailClient.ts
//
//  Resend use kar rahe hain (industry-standard transactional email
//  API for 2026) instead of raw Gmail SMTP — Gmail SMTP production
//  transactional mail ke liye recommend nahi hota (low daily sending
//  limits, aur Google ka Terms of Service bulk/automated mail ko
//  bulk-flag kar sakta hai). Resend free tier is generous and needs
//  no extra npm package — plain fetch() to their REST API.
//
//  Env vars needed (Vercel → Settings → Environment Variables):
//    RESEND_API_KEY   — from resend.com dashboard (free tier: 3,000
//                        emails/month, 100/day)
//    EMAIL_FROM       — e.g. "AB OS <orders@yourdomain.com>". Until
//                        you verify your own domain on Resend, use
//                        "AB OS <onboarding@resend.dev>" — Resend's
//                        shared sandbox sender, works out of the box.
//
//  If RESEND_API_KEY isn't set, every function here quietly no-ops
//  (returns {skipped:true}) so the rest of the app keeps working —
//  same pattern as api/notify.js for Twilio.
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "AB OS <onboarding@resend.dev>";

export function isEmailReady(): boolean {
  return !!RESEND_API_KEY;
}

interface SendResult {
  skipped?: boolean;
  id?: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY not set — email skipped:", subject, "→", to);
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Resend error:", data);
    throw new Error(data?.message || "Email send failed");
  }
  return { id: data?.id };
}

const wrapper = (bodyHtml: string) => `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F172A;">
    <div style="font-weight:800;font-size:18px;margin-bottom:16px;">AB OS</div>
    ${bodyHtml}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;">
      Yeh automated email hai, isay reply mat karein.
    </div>
  </div>
`;

export interface OrderConfirmationInput {
  id: string;
  customer: string;
  total: number;
  items: { name: string; qty: number }[];
}

export async function sendOrderConfirmationEmail(order: OrderConfirmationInput, to: string): Promise<SendResult> {
  const itemsHtml = order.items
    .map((it) => `<tr><td style="padding:6px 0;">${it.name}</td><td style="padding:6px 0;text-align:right;">×${it.qty}</td></tr>`)
    .join("");

  const html = wrapper(`
    <p style="font-size:14px;">Assalam-o-Alaikum ${order.customer || "customer"},</p>
    <p style="font-size:14px;">Aapka order <strong>${order.id}</strong> mil gaya hai aur confirm ho gaya hai. Details neeche hain:</p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin:14px 0;">${itemsHtml}</table>
    <div style="font-size:15px;font-weight:700;padding:10px 0;border-top:1px solid #E2E8F0;">
      Total: Rs ${order.total.toLocaleString()}
    </div>
    <p style="font-size:13px;color:#475569;">Hum jald hi aapka order process karke deliver karenge.</p>
  `);

  return sendEmail(to, `Order confirmed — ${order.id}`, html);
}

export async function sendAdminVerificationEmail(to: string, code: string): Promise<SendResult> {
  const html = wrapper(`
    <p style="font-size:14px;">Admin panel registration verify karne ke liye yeh code use karein:</p>
    <div style="font-size:28px;font-weight:800;letter-spacing:6px;text-align:center;padding:16px 0;color:#4F46E5;">
      ${code}
    </div>
    <p style="font-size:12px;color:#64748B;">Yeh code 10 minute mein expire ho jayega. Agar aapne yeh registration nahi ki, is email ko ignore karein.</p>
  `);

  return sendEmail(to, "Aapka AB OS verification code", html);
}
