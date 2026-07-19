// ============================================================
//  Vercel Serverless Function — /api/create-payment
//  Order place hone ke baad (place-order se) yeh Safepay checkout
//  session banata hai aur customer ko jis URL par redirect karna hai
//  woh wapas bhejta hai.
// ============================================================
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, isSupabaseReady } from "./_lib/supabaseServer.js";
import { isSafepayReady, createSafepaySession, buildSafepayCheckoutUrl } from "./_lib/safepayClient.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseReady() || !isSafepayReady()) {
    return res.status(500).json({ error: "Payment setup abhi ready nahi hai (env vars check karein)" });
  }

  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ error: "orderId zaroori hai" });
    }

    // Order ka asal total DB se lo — client se aane wale amount par
    // bharosa nahi karte (jaise place-order mein bhi karte hain).
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, total")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) {
      return res.status(404).json({ error: "Order nahi mila" });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const { trackerToken, authToken } = await createSafepaySession(order.id, order.total);

    const checkoutUrl = buildSafepayCheckoutUrl({
      trackerToken,
      authToken,
      redirectUrl: `${origin}/?payment=success&order_id=${order.id}`,
      cancelUrl: `${origin}/?payment=cancelled&order_id=${order.id}`,
    });

    // Tracker order ke sath save karo taake webhook aane par match ho sake.
    await supabase.from("orders").update({ safepay_tracker: trackerToken }).eq("id", order.id);

    return res.status(200).json({ success: true, checkoutUrl, trackerToken });
  } catch (err: any) {
    console.error("create-payment: error", err.message);
    return res.status(500).json({ error: "Payment session nahi ban saka, dobara try karein" });
  }
}
