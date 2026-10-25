import { create } from "zustand";

/**
 * Theme: follow the OS by default, or force light/dark. Written to `<html data-theme>` so the kit's
 * token layers (`:root`, `[data-theme="dark"]`) switch everywhere at once.
 */
export type Theme = "system" | "light" | "dark";

const THEME_KEY = "admin.theme";

function storedTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: storedTheme(),
  setTheme: (theme) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },
}));

/** What is actually painted: resolves `system` against the OS preference. */
export function resolvedTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}
