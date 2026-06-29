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
    const stored = localStorage.getItem(themeStorageKey) as Theme | null;
    return stored ?? "dark";
  } catch {
    return "dark";
  }
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const resolved = theme === "system" ? getSystemTheme() : theme;

  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  } else {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  }

  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => "dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      const initialTheme = getStoredTheme();
      const resolved = applyTheme(initialTheme);
      setThemeState(initialTheme);
      setResolvedTheme(resolved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Only set up system theme listener on client
    if (typeof window === "undefined" || !mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const newResolved = applyTheme(theme);
      setResolvedTheme(newResolved);
    };

    mediaQuery.addEventListener?.("change", listener);
    return () => mediaQuery.removeEventListener?.("change", listener);
  }, [theme, mounted]);

  const setTheme = (next: Theme | ((current: Theme) => Theme)) => {
    setThemeState((current) => {
      const nextTheme = typeof next === "function" ? next(current) : next;
      try {
        localStorage.setItem(themeStorageKey, nextTheme);
      } catch {
        // ignore localStorage write failures
      }
      setResolvedTheme(applyTheme(nextTheme));
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
