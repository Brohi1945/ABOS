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

// ============================================================
//  "Colorful" — a third, world-class vibrant theme ("Aurora").
//  Deep violet-black base with an electric purple → pink brand
//  gradient, so every existing `from-brand to-accent` gradient
//  element (avatar, logo tile, etc) automatically picks up a
//  rich, premium-looking gradient with zero extra code.
// ============================================================
export const colorfulColors = {
  bg: "#150F2B",
  surface: "#241A45",
  primary: "#A855F7",
  accent: "#FB7185",
  text: "#F5F3FF",
  textMuted: "#C4B5E8",
  border: "rgba(216, 180, 254, 0.18)",
  success: "#34D399",
  danger: "#FB7185",
  warning: "#FBBF24",
};

export type ThemeColors = typeof lightColors;
export type ThemeMode = "light" | "dark" | "colorful";

const PALETTES: Record<ThemeMode, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
  colorful: colorfulColors,
};

// Chart series (recharts) ke liye ready palette.
export function getChartColors(mode: ThemeMode = "dark"): string[] {
  const c = PALETTES[mode] || darkColors;
  return [c.primary, c.accent, c.success, c.warning, c.danger];
}
