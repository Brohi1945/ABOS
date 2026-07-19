// ============================================================
//  Shared Twilio SMS sender — /api/_lib/smsClient.ts
//  Same Twilio credentials api/notify.js already uses for owner
//  alerts; extracted here so the admin-registration OTP flow can
//  send a code to the *registering admin's own* phone number too
//  (not just the fixed ADMIN_PHONE_NUMBER).
//
//  Env vars needed (same as api/notify.js):
//    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
// ============================================================

export function isSmsReady(): boolean {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}

export async function sendSms(to: string, message: string): Promise<{ skipped?: boolean; sid?: string }> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn("⚠️ Twilio env vars not set — SMS skipped");
    return { skipped: true };
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const form = new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: message });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Twilio error:", data);
    throw new Error(data?.message || "SMS send failed");
  }
  return { sid: data.sid };
}
