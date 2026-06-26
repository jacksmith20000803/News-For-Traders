"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/providers/auth-provider";

export function SidebarGate() {
  const { user } = useAuth();
  return user ? <Sidebar /> : null;
}
