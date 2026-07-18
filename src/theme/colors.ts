// ============================================================
//  Color palette — single source of truth for JS/chart code
//  (recharts jaise libraries ko kabhi CSS variable string nahi,
//  raw hex chahiye hota hai). tokens.css inhi values ko CSS
//  variables ke roop mein duplicate karti hai — dono sync rakhein.
// ============================================================

export const lightColors = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  accent: "#06B6D4",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "rgba(15, 23, 42, 0.08)",
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#D97706",
};

export const darkColors = {
  bg: "#0B0F19",
  surface: "#111827",
  primary: "#6366F1",
  accent: "#22D3EE",
  text: "#E5E7EB",
  textMuted: "#9CA3AF",
  border: "rgba(255, 255, 255, 0.08)",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",
};

export type ThemeColors = typeof lightColors;

// Chart series (recharts) ke liye ready palette.
export function getChartColors(mode: "light" | "dark" = "dark"): string[] {
  const c = mode === "dark" ? darkColors : lightColors;
  return [c.primary, c.accent, c.success, c.warning, c.danger];
}
