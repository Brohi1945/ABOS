import React, { useMemo } from "react";
import { Package, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { displayFont } from "../lib/theme";
import { money, computeWeeklyTrend } from "../lib/utils";
import { Card, StatCard } from "../components/ui";
import { CHART_ANIMATION } from "../animations/config";   // 👈 added

interface AccountingViewProps {
  orders: any[];
  products: any[];
}

export default function AccountingView({ orders, products }: AccountingViewProps) {
  const revenue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  const cogsEstimate = revenue * 0.68;
  const profit = revenue - cogsEstimate;
  const inventoryValue = products.reduce((s, p) => s + p.cost * p.stock, 0);
  const weeklyTrend = useMemo(() => computeWeeklyTrend(orders), [orders]);
  const todaySales = weeklyTrend[weeklyTrend.length - 1]?.sales || 0;
  const yesterdaySales = weeklyTrend[weeklyTrend.length - 2]?.sales || 0;
  const profitDelta = yesterdaySales > 0
    ? `${todaySales >= yesterdaySales ? "+" : ""}${(((todaySales - yesterdaySales) / yesterdaySales) * 100).toFixed(1)}% vs yesterday`
    : null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#E8E9ED]" style={{ fontFamily: displayFont }}>Accounting overview</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Revenue (7d)" value={money(revenue)} tone="indigo" />
        <StatCard icon={TrendingDown} label="Cost of goods" value={money(cogsEstimate)} tone="amber" />
        <StatCard icon={TrendingUp} label="Estimated profit" value={money(profit)} tone="green" delta={profitDelta} />
        <StatCard icon={Package} label="Inventory value" value={money(inventoryValue)} tone="indigo" />
      </div>

      <Card>
        <h3 className="font-bold text-[#E8E9ED] text-sm mb-3" style={{ fontFamily: displayFont }}>Revenue vs cost — daily</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyTrend.map((d) => ({ ...d, cost: Math.round(d.sales * 0.68) }))}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8B8F9C" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: any) => money(v)}
                contentStyle={{ background: "#1B1F2A", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}
                labelStyle={{ color: "#8B8F9C" }}
                itemStyle={{ color: "#E8E9ED" }}
              />
              {/* 👇 using CHART_ANIMATION spread */}
              <Bar dataKey="sales" fill="#C9A44C" radius={[6, 6, 0, 0]} name="Revenue" {...CHART_ANIMATION} />
              <Bar dataKey="cost" fill="#22C55E" radius={[6, 6, 0, 0]} name="Cost" {...CHART_ANIMATION} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card noPad>
        <h3 className="font-bold text-[#E8E9ED] text-sm px-5 pt-5 mb-1" style={{ fontFamily: displayFont }}>Recent transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="text-left text-[11px] text-[#8B8F9C] font-semibold uppercase tracking-wide">
                <th className="px-5 py-2">Order</th>
                <th className="px-5 py-2">Amount</th>
                <th className="px-5 py-2">Type</th>
                <th className="px-5 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 6).map((o) => (
                <tr key={o.id} className="border-t border-[rgba(255,255,255,0.06)]">
                  <td className="px-5 py-3 font-semibold text-[#E8E9ED]">{o.id}</td>
                  <td className={`px-5 py-3 font-medium ${o.status === "cancelled" ? "text-red-400" : "text-green-400"}`}>
                    {o.status === "cancelled" ? "—" : "+" + money(o.total)}
                  </td>
                  <td className="px-5 py-3 text-[#8B8F9C]">Sale</td>
                  <td className="px-5 py-3 text-[#8B8F9C] text-xs">{o.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
