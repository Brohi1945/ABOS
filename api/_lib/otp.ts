// ============================================================
//  6-digit OTP helpers — /api/_lib/otp.ts
//  Code kabhi plaintext store nahi hota — sirf SHA-256 hash DB mein
//  jata hai, taake agar admin_verifications table kabhi leak ho to
//  bhi asal codes na milein.
// ============================================================
import { randomInt, createHash } from "crypto";

export function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
