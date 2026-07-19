// ============================================================
//  Server-side Supabase client — FIXED: No fallback, strict validation
//  🔒 SECURITY FIX: ab yeh SERVICE ROLE key use karta hai, anon key nahi.
//  Wajah: RLS on karne ke baad, anon key ke saath yeh server function
//  (WhatsApp webhook, notifications) khud apna data read/write nahi kar
//  payega jab tak service role key na ho (jo RLS ko bypass karti hai —
//  isi liye yeh SIRF server-side env var mein rahegi, kabhi frontend
//  bundle mein nahi jaani chahiye).
// ============================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 🔥 FIX: Log error if missing, but return null gracefully
if (!url || !key) {
  console.error("⚠️ VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in server environment!");
  console.error("   WhatsApp webhook and notifications will NOT work.");
  console.error("   Please set these in Vercel → Settings → Environment Variables");
  console.error("   (SUPABASE_SERVICE_ROLE_KEY: Supabase Dashboard → Settings → API → service_role)");
}

export const supabase = url && key ? createClient(url, key) : null;

// Helper to check if Supabase is ready
export function isSupabaseReady() {
  if (!supabase) {
    console.warn("⚠️ Supabase client not initialized. Check environment variables.");
    return false;
  }
  return true;
}
