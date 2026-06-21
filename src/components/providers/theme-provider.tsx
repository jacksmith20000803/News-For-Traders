"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (nextTheme: Theme | ((current: Theme) => Theme)) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const themeStorageKey = "theme";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  try {
    return (localStorage.getItem(themeStorageKey) as Theme | null) ?? "system";
  } catch {
    return "system";
  }
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme): "light" | "dark" {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  useEffect(() => {
    const resolved = applyTheme(theme);
    setResolvedTheme(resolved);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setResolvedTheme(applyTheme(theme));

    mediaQuery.addEventListener?.("change", listener);
    return () => mediaQuery.removeEventListener?.("change", listener);
  }, [theme]);

  const setTheme = (next: Theme | ((current: Theme) => Theme)) => {
    setThemeState((current) => {
      const nextTheme = typeof next === "function" ? next(current) : next;
      try {
        localStorage.setItem(themeStorageKey, nextTheme);
      } catch {
        // ignore localStorage write failures
      }
      return nextTheme;
    });
  };

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
