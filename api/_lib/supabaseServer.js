// ============================================================
//  Server-side Supabase client — FIXED: No fallback, strict validation
// ============================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

// 🔥 FIX: Log error if missing, but return null gracefully
if (!url || !key) {
  console.error("⚠️ VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in server environment!");
  console.error("   WhatsApp webhook and notifications will NOT work.");
  console.error("   Please set these in Vercel → Settings → Environment Variables");
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
