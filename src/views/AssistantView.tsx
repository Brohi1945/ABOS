import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { displayFont } from "../theme";
import { CATEGORIES } from "../lib/seedData";
import { callClaude, parseAssistantReply, TypingDots } from "../lib/aiHelpers";
import { computeWeeklyTrend, computeProductInsights } from "../lib/utils";
import { Card, Button, inputCls } from "../components/ui";

interface Message {
  role: "user" | "bot";
  text: string;
}

interface AssistantViewProps {
  orders: any[];
  products: any[];
  customers: any[];
  campaigns: any[];
  onAddProduct: (product: any) => void;
  onEditProduct: (id: string, fields: any) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateStatus: (orderId: string, status: string) => void;
  onAddCustomer: (customer: any) => void;
  onAddCampaign: (campaign: any) => void;
  onCreateOrder: (order: any) => void;
}

export default function AssistantView({
  orders,
  products,
  customers,
  campaigns,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onUpdateStatus,
  onAddCustomer,
  onAddCampaign,
  onCreateOrder,
}: AssistantViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text: "Salam Sir/Ma'am — main AB OS ka chief assistant hoon. Accounting, inventory, sales analytics, customers aur marketing — poore business ka live data mere paas hai, aur main aapki taraf se actions bhi le sakta hoon. Poochiye kuch bhi, ya seedha bolein \"business health report do\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const suggestions = ["Business health report do", "Sabse zyada profit konsa product de raha hay", "Kaunsa customer risk pe hay", "Aaj kya priority honi chahiye"];
  const endRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || sendingRef.current) return;
    sendingRef.current = true;
    const history = messages;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);

    // ---- Same formulas the dashboards use, reused here so the assistant's
    // numbers always match Accounting / Business Intelligence exactly ----
    const activeOrders = orders.filter((o) => o.status !== "cancelled");
    const revenue = activeOrders.reduce((s, o) => s + o.total, 0);
    const cogsEstimate = Math.round(revenue * 0.68);
    const profitEstimate = revenue - cogsEstimate;
    const inventoryValue = products.reduce((s, p) => s + p.cost * p.stock, 0);
    const weeklyTrend = computeWeeklyTrend(orders);
    const todaySales = weeklyTrend[weeklyTrend.length - 1]?.sales || 0;
    const yesterdaySales = weeklyTrend[weeklyTrend.length - 2]?.sales || 0;

    // ---- Chief Data Analyst layer: per-product margin, profit contribution,
    // dead stock, best sellers — exact same engine as the BI tab ----
    const productInsights = computeProductInsights(products, orders);
    const bestSellers = [...productInsights].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 6)
      .map((p) => ({ name: p.name, unitsSold: p.unitsSold, revenue: p.revenue, marginPct: Math.round(p.marginPct) }));
    const topMarginProducts = [...productInsights].sort((a, b) => b.marginPct - a.marginPct).slice(0, 5)
      .map((p) => ({ name: p.name, marginPct: Math.round(p.marginPct) }));
    const lowMarginProducts = [...productInsights].filter((p) => p.marginPct < 20).sort((a, b) => a.marginPct - b.marginPct).slice(0, 5)
      .map((p) => ({ name: p.name, marginPct: Math.round(p.marginPct) }));
    const deadStock = productInsights.filter((p) => p.unitsSold === 0 && p.stock > 0)
      .sort((a, b) => b.capitalTiedUp - a.capitalTiedUp).slice(0, 8)
      .map((p) => ({ name: p.name, stock: p.stock, capitalTiedUp: p.capitalTiedUp }));
    const avgMarginPct = productInsights.length ? productInsights.reduce((s, p) => s + p.marginPct, 0) / productInsights.length : 0;

    // ---- Chief Growth/CRM layer: repeat vs one-time buyers, VIPs ----
    const repeatCustomers = customers.filter((c) => c.orders > 1).length;
    const oneTimeCustomers = customers.filter((c) => c.orders === 1).length;
    const topCustomers = [...customers].sort((a, b) => b.spent - a.spent).slice(0, 8)
      .map((c) => ({ id: c.id, name: c.name, phone: c.phone, orders: c.orders, spent: c.spent, lastOrder: c.lastOrder }));

    // ---- Chief Marketing layer: open/click rate per campaign ----
    const campaignPerformance = campaigns.map((c) => ({
      name: c.name, channel: c.channel, status: c.status, sent: c.sent,
      openRatePct: c.sent ? Math.round((c.opened / c.sent) * 100) : 0,
      clickRatePct: c.sent ? Math.round((c.clicked / c.sent) * 100) : 0,
    }));

    const storeContext = {
      // Accounting
      totalSalesAllTime: revenue,
      costOfGoodsEstimate: cogsEstimate,
      profitEstimate,
      inventoryValue,
      todaySales,
      yesterdaySales,
      weeklyTrend,
      avgMarginPct: Math.round(avgMarginPct),
      // Analytics / BI
      bestSellingProducts: bestSellers,
      topMarginProducts,
      lowMarginProducts,
      deadStockItems: deadStock,
      // Inventory
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status === "pending").map((o) => ({ id: o.id, customer: o.customer, phone: o.phone, items: o.items, total: o.total, channel: o.channel, date: o.date })),
      recentOrders: orders.slice(0, 30).map((o) => ({ id: o.id, customer: o.customer, phone: o.phone, items: o.items, total: o.total, status: o.status, channel: o.channel, date: o.date })),
      allProducts: products.map((p) => ({ id: p.id, name: p.name, category: p.category, price: p.price, cost: p.cost, stock: p.stock, threshold: p.threshold, lowStock: p.stock <= p.threshold })),
      // CRM
      totalCustomers: customers.length,
      repeatCustomers,
      oneTimeCustomers,
      topCustomers,
      // Marketing
      campaignPerformance,
    };

    const systemPrompt = `You are the AI chief-of-staff built into AB OS — the store owner's entire admin dashboard. You operate as FOUR senior roles combined into one assistant: Chief Accountant (revenue, cost, profit, margins), Chief Operations Manager (orders, inventory, stock health), Chief Data Analyst (best sellers, dead stock, trends, customer segments), and Chief Marketing Officer (campaign performance). Think and answer the way an elite, highly competent human executive team would — fast, precise, numbers-first, and proactive. You are not a generic FAQ bot: you have full live read access to every part of the business (given as JSON below) and the ability to execute real actions.

Behave like Jarvis for this business: when asked an open-ended question ("business health report do", "aaj kya priority honi chahiye"), synthesize across accounting + inventory + customers + marketing yourself and give a short, prioritized, decision-ready answer — don't just dump raw numbers, interpret them (e.g. flag a margin that's shrinking, a customer at churn risk, a campaign underperforming, a product that's dead stock tying up capital, or a pending order that needs attention). Always ground every number in the JSON below — never invent figures.

You can perform these real management actions when the owner asks. Collect any missing required field by asking ONE question at a time, then emit the action once you have everything needed:
- add_product: add a new item to inventory
- edit_product: change a product's price/stock/cost/threshold/name/etc
- delete_product: remove a product
- update_order_status: change an order's status
- create_order: manually log a new order (e.g. a phone/walk-in sale the owner tells you about)
- add_customer: add a new customer record
- add_campaign: log a new marketing campaign

Amounts are in Pakistani Rupees (Rs). If something genuinely isn't in the data below, say so honestly instead of guessing.

Always write the "reply" text in Roman Urdu (Urdu written in plain English/Latin letters, e.g. "aapki sales acchi ja rahi hain"). Do not mix in English words unless it's a product/customer name, number, or a term with no natural Urdu equivalent. Do not reply in Urdu script or in English. Keep replies tight: 2-6 sentences, or a short list for reports — never pad with fluff.

CRITICAL OUTPUT FORMAT — you must ALWAYS respond with ONLY a raw JSON object (no markdown fences, no extra text), matching exactly this shape:
{"reply": "message in Roman Urdu", "action": null}

When ready to perform a management action, set "action" to one of these shapes instead:
- {"type": "add_product", "name": "...", "category": "...", "price": 100, "cost": 70, "stock": 20, "threshold": 10, "barcode": ""}
- {"type": "edit_product", "productId": "P001", "fields": {"price": 120, "stock": 15}}
- {"type": "delete_product", "productId": "P001"}
- {"type": "update_order_status", "orderId": "ORD-1042", "status": "confirmed"}
- {"type": "create_order", "customer": "Customer Name", "phone": "", "channel": "Store", "status": "pending", "items": [{"productId": "P001", "qty": 2}]}
- {"type": "add_customer", "name": "...", "phone": "...", "email": ""}
- {"type": "add_campaign", "name": "...", "channel": "WhatsApp", "status": "Active", "sent": 0, "opened": 0, "clicked": 0}

Only emit an action once you truly have the required fields (add_product needs at least name, category, price, stock; create_order needs at least one item with a valid productId and a customer name). Category must be one of: ${JSON.stringify(CATEGORIES)}. Order status must be one of: pending, confirmed, delivered, cancelled. Match product names to their productId using the allProducts list below before emitting create_order.

Live business data:
${JSON.stringify(storeContext)}`;

    try {
      const raw = await callClaude(systemPrompt, history, q);
      const { reply, action } = parseAssistantReply(raw);
      setMessages((m) => [...m, { role: "bot", text: reply }]);

      if (action) {
        if (action.type === "add_product" && action.name) {
          onAddProduct({
            name: action.name, category: action.category || CATEGORIES[0], price: action.price,
            cost: action.cost, stock: action.stock, threshold: action.threshold, barcode: action.barcode,
          });
        } else if (action.type === "edit_product" && action.productId && action.fields) {
          const existing = products.find((p) => p.id === action.productId);
          onEditProduct(action.productId, { ...existing, ...action.fields });
        } else if (action.type === "delete_product" && action.productId) {
          onDeleteProduct(action.productId);
        } else if (action.type === "update_order_status" && action.orderId && action.status) {
          onUpdateStatus(action.orderId, action.status);
        } else if (action.type === "create_order" && Array.isArray(action.items) && action.items.length) {
          onCreateOrder(action);
        } else if (action.type === "add_customer" && action.name) {
          onAddCustomer(action);
        } else if (action.type === "add_campaign" && action.name) {
          onAddCampaign(action);
        }
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "bot", text: "Maaf kijiye, is waqt assistant tak nahi pohanch saka — thodi dair mein dobara koshish karein." }]);
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-fg" style={{ fontFamily: displayFont }}>AI Assistant</h2>
      <Card noPad className="flex flex-col" style={{ height: "80vh" }}>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-2.5 text-sm rounded-2xl whitespace-pre-line ${
                m.role === "user" ? "bg-brand text-white rounded-br-md" : "bg-app text-fg border rounded-bl-md"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <TypingDots />}
          <div ref={endRef} />
        </div>
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} disabled={loading} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full bg-app border text-muted hover:border-brand disabled:opacity-40">
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t">
          <input
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Ask about sales, stock, orders, customers…"
            className={`${inputCls} flex-1 rounded-full disabled:opacity-60`}
          />
          <Button onClick={() => send()} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
