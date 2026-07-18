import React from "react";
import { ArrowRight, Sparkles, ShoppingBag, Star } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { displayFont, bodyFont } from "../theme";
import { salesTrend } from "../lib/seedData";
import { Button } from "../components/ui";

interface LandingScreenProps {
  onLogin: () => void;
  onBrowseStore: () => void;
}

export default function LandingScreen({ onLogin, onBrowseStore }: LandingScreenProps) {
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-app" style={{ fontFamily: bodyFont }}>
      <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-10 w-[28rem] h-[28rem] rounded-full bg-accent/10 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-fg font-bold text-lg" style={{ fontFamily: displayFont }}>
          <div className="w-9 h-9 rounded-xl bg-surface border flex items-center justify-center text-brand">
            <Sparkles size={18} />
          </div>
          AB OS
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-muted font-medium">
          <span>Product</span>
          <span>Pricing</span>
          <span>Support</span>
        </div>
        <Button variant="secondary" size="sm" onClick={onLogin}>
          Sign in
        </Button>
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-24 grid lg:grid-cols-2 gap-10 items-center">
        <div className="text-fg">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-surface border mb-5">
            <Star size={12} className="text-brand" /> All-in-one business automation
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] mb-5" style={{ fontFamily: displayFont }}>
            Run your whole shop from one clean dashboard.
          </h1>

          <p className="text-muted text-base max-w-md mb-8">
            Orders, inventory, POS billing, customers, and marketing — in one fast, uncluttered workspace built for small business teams.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" variant="primary" icon={ArrowRight} onClick={onLogin}>
              Open Admin Dashboard
            </Button>
            <Button size="lg" variant="secondary" icon={ShoppingBag} onClick={onBrowseStore}>
              Browse as Customer
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-3xl p-6 border shadow-2xl bg-surface">
            <div className="rounded-2xl bg-app p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-muted">Today's overview</span>
                <span className="text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Live</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-app p-3">
                  <div className="text-[10px] text-muted font-medium mb-1">Sales</div>
                  <div className="text-lg font-bold text-fg" style={{ fontFamily: displayFont }}>Rs 33,100</div>
                </div>
                <div className="rounded-xl bg-app p-3">
                  <div className="text-[10px] text-muted font-medium mb-1">Orders</div>
                  <div className="text-lg font-bold text-fg" style={{ fontFamily: displayFont }}>48</div>
                </div>
              </div>

              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend}>
                    <defs>
                      <linearGradient id="landingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2} fill="url(#landingGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
