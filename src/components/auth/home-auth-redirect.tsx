"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

export function HomeAuthRedirect() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    router.replace(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }, [isLoading, router, user]);

  return null;
}
