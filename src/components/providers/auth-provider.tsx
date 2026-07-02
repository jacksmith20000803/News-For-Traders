"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import type { SafeUser } from "@/types";
import { readJsonResponse } from "@/lib/api/client";

interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  setAuthenticatedUser: (user: SafeUser | null) => void;
  updateAuthenticatedUser: (patch: Partial<SafeUser>) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  refresh: async () => {},
  setAuthenticatedUser: () => {},
  updateAuthenticatedUser: () => {},
});

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: SafeUser | null;
}) {
  const [user, setUser] = useState<SafeUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(true);
  const initialUserRef = useRef(initialUser);
  const didInitialRefreshRef = useRef(false);
  const authVersionRef = useRef(0);

  const applyAuthenticatedUser = useCallback((nextUser: SafeUser | null) => {
    setUser(nextUser);
    initialUserRef.current = nextUser;
    setIsLoading(false);
  }, []);

  const setAuthenticatedUser = useCallback((nextUser: SafeUser | null) => {
    authVersionRef.current += 1;
    applyAuthenticatedUser(nextUser);
  }, [applyAuthenticatedUser]);

  const updateAuthenticatedUser = useCallback((patch: Partial<SafeUser>) => {
    authVersionRef.current += 1;
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const nextUser = { ...currentUser, ...patch };
      initialUserRef.current = nextUser;
      return nextUser;
    });
  }, []);

  const refresh = useCallback(async () => {
    const requestVersion = authVersionRef.current;
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await readJsonResponse<{ success: boolean; data?: { user?: SafeUser | null; reason?: string | null } }>(res);
      if (authVersionRef.current === requestVersion) {
        if (user && !json.data?.user && json.data?.reason === "account_deleted") {
          window.alert("Administrator deleted your account. Please contact them!");
          window.location.href = "/login?error=account_deleted";
          return;
        }
        applyAuthenticatedUser(json.success ? json.data?.user ?? null : null);
      }
    } catch {
      if (authVersionRef.current === requestVersion) {
        applyAuthenticatedUser(null);
      }
    } finally {
      if (authVersionRef.current === requestVersion) {
        setIsLoading(false);
      }
    }
  }, [applyAuthenticatedUser, user]);

  useEffect(() => {
    if (initialUserRef.current !== initialUser) {
      authVersionRef.current += 1;
      setUser(initialUser);
      initialUserRef.current = initialUser;
      setIsLoading(false);
    }
  }, [initialUser]);

  useEffect(() => {
    if (didInitialRefreshRef.current) return;
    didInitialRefreshRef.current = true;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh, user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, refresh, setAuthenticatedUser, updateAuthenticatedUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
