export const THEME_STORAGE_KEY = "gemeshi-theme";

export const THEME_COLORS = {
  light: "#f7f2e8",
  dark: "#0b110e"
} as const;

export type Theme = keyof typeof THEME_COLORS;

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}
