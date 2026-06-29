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

  const setAuthenticatedUser = useCallback((nextUser: SafeUser | null) => {
    setUser(nextUser);
    initialUserRef.current = nextUser;
  }, []);

  const updateAuthenticatedUser = useCallback((patch: Partial<SafeUser>) => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const nextUser = { ...currentUser, ...patch };
      initialUserRef.current = nextUser;
      return nextUser;
    });
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await readJsonResponse<{ success: boolean; data?: { user?: SafeUser | null } }>(res);
      setAuthenticatedUser(json.success ? json.data?.user ?? null : null);
    } catch {
      setAuthenticatedUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [setAuthenticatedUser]);

  useEffect(() => {
    if (initialUserRef.current !== initialUser) {
      setUser(initialUser);
      initialUserRef.current = initialUser;
    }
  }, [initialUser]);

  useEffect(() => {
    if (didInitialRefreshRef.current) return;
    didInitialRefreshRef.current = true;
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, isLoading, refresh, setAuthenticatedUser, updateAuthenticatedUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
