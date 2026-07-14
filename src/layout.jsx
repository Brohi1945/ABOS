import React from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Wallet, Megaphone, Bot, Barcode,
  Search, Bell, ChevronDown, LogOut, Menu, Sparkles, ShoppingBag, PieChart,
} from "lucide-react";
import { displayFont } from "../lib/theme.js";

/* ---------------------------------- Admin shell: sidebar + topbar ---------------------------------- */

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: ShoppingCart },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "customers", label: "Customers", icon: Users },
  { key: "pos", label: "POS / Retail", icon: Barcode },
  { key: "accounting", label: "Accounting", icon: Wallet },
  { key: "insights", label: "Business Intelligence", icon: PieChart },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "assistant", label: "AI Assistant", icon: Bot },
];

export function Sidebar({ active, onSelect, open, onClose, lowStockCount, onLogout, onGoStore }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-slate-100 z-50 flex flex-col transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-5 font-bold text-slate-900" style={{ fontFamily: displayFont }}>
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <Sparkles size={15} />
          </div>
          AB OS
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            const badge = item.key === "inventory" ? lowStockCount : 0;
            return (
              <button
                key={item.key}
                onClick={() => { onSelect(item.key); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <item.icon size={17} className="shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className="text-[10px] font-bold bg-red-500 text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-1">
          <button onClick={onGoStore} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-indigo-600">
            <ShoppingBag size={17} /> View store
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600">
            <LogOut size={17} /> Log out
          </button>
        </div>
      </aside>
    </>
  );
}

export function Topbar({ title, onMenuClick, notifCount, onNotifClick, notifOpen, notifications }) {
  return (
    <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-sm border-b border-slate-100">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5">
        <button onClick={onMenuClick} className="lg:hidden w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
          <Menu size={17} />
        </button>
        <h1 className="font-bold text-slate-900 text-lg hidden sm:block shrink-0" style={{ fontFamily: displayFont }}>{title}</h1>
        <div className="flex-1 max-w-md relative hidden md:block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Search orders, products, customers…" className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition" />
        </div>
        <div className="flex-1 sm:flex-none" />
        <div className="relative">
          <button onClick={onNotifClick} className="relative w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <Bell size={16} />
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {notifCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden">
              <div className="px-4 py-3 text-xs font-bold text-slate-700 border-b border-slate-100">Notifications</div>
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-xs text-slate-400 text-center">You're all caught up.</div>
              ) : (
                notifications.map((n, i) => (
                  <div key={i} className="px-4 py-2.5 text-xs border-b border-slate-50 last:border-0">
                    <div className="font-semibold text-slate-700">{n.title}</div>
                    <div className="text-slate-400">{n.note}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-green-500 flex items-center justify-center text-white text-xs font-bold">
            SA
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="text-xs font-semibold text-slate-700">Store Admin</div>
            <div className="text-[10px] text-slate-400">Owner</div>
          </div>
          <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
        </div>
      </div>
    </div>
  );
}
