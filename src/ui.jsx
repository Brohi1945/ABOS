import React from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { displayFont } from "../lib/theme.js";
import { STATUS_META } from "../lib/seedData.js";

/* ---------------------------------- Shared UI primitives ---------------------------------- */

export function Button({ children, variant = "primary", size = "md", icon: Icon, className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 whitespace-nowrap";
  const sizes = { sm: "text-xs px-3 py-1.5", md: "text-sm px-4 py-2.5", lg: "text-sm px-5 py-3" };
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600",
    success: "bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-500/20",
    danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
    ghost: "text-slate-500 hover:bg-slate-100",
    glassOutline: "bg-white/20 text-white border border-white/30 backdrop-blur-md hover:bg-white/30",
    glassSolid: "bg-white text-indigo-700 hover:bg-slate-50",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon size={size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
}

export function Card({ children, className = "", noPad = false, style }) {
  return (
    <div style={style} className={`bg-white rounded-xl border border-slate-100 shadow-sm ${noPad ? "" : "p-5"} ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-50 text-indigo-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${meta.cls}`}>
      <Icon size={11} /> {meta.label}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, delta, tone = "indigo" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <Card className="flex items-start justify-between">
      <div>
        <div className="text-xs font-medium text-slate-500 mb-1.5">{label}</div>
        <div className="text-2xl font-bold text-slate-900" style={{ fontFamily: displayFont }}>{value}</div>
        {delta && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${delta.startsWith("-") ? "text-red-500" : "text-green-600"}`}>
            {delta.startsWith("-") ? <TrendingDown size={13} /> : <TrendingUp size={13} />} {delta}
          </div>
        )}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon size={18} />
      </div>
    </Card>
  );
}

export function Drawer({ open, onClose, title, children, width = 420 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className="absolute top-0 right-0 bottom-0 bg-white shadow-2xl overflow-y-auto animate-drawer-in"
        style={{ width: "92%", maxWidth: width }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-900" style={{ fontFamily: displayFont }}>{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <X size={17} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 460 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full animate-modal-in max-h-[88vh] overflow-y-auto" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-900" style={{ fontFamily: displayFont }}>{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <X size={17} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="mb-3.5">
      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

export const inputCls = "w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition text-slate-800";

export function EmptyState({ icon: Icon, title, note }) {
  return (
    <div className="text-center py-14 px-5">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
        <Icon size={20} />
      </div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {note && <div className="text-xs text-slate-400 mt-1">{note}</div>}
    </div>
  );
}
