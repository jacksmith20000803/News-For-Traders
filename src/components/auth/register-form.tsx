"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthOAuthButtons, type OAuthAvailability } from "@/components/auth/oauth-buttons";
import { useAuth } from "@/components/providers/auth-provider";
import { readJsonResponse, setCsrfToken } from "@/lib/api/client";

interface RegisterFormProps {
  oauthAvailability?: OAuthAvailability;
}

export function RegisterForm({ oauthAvailability }: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthenticatedUser, user } = useAuth();
  const [error, setError] = useState(() => getOauthErrorMessage(searchParams));
  const [isLoading, setIsLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });
  const passwordValue = useWatch({ control, name: "password" }) ?? "";
  const showPasswordPolicyWarning = passwordValue.length > 0 && !hasRequiredPasswordMix(passwordValue);

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [router, user]);

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setError("");
    let didRedirect = false;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: {
          user?: Parameters<typeof setAuthenticatedUser>[0];
          csrfToken?: string;
          redirectTo?: string;
        };
      }>(res);

      if (!json.success) {
        setError(json.error ?? "Registration failed");
        return;
      }

      setCsrfToken(json.data?.csrfToken);
      didRedirect = true;
      setRedirecting(true);
      setAuthenticatedUser(json.data?.user ?? null);
      const redirectTo = json.data?.redirectTo?.startsWith("/") ? json.data.redirectTo : "/dashboard";
      router.replace(redirectTo);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      if (!didRedirect) setIsLoading(false);
    }
  };

  if (redirecting || user) {
    return (
      <Card className="w-full max-w-5xl border-gray-200 bg-white dark:border-white/10 dark:bg-[#0a0c0c]">
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-muted-foreground">Opening your dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-5xl bg-white dark:bg-[#0a0c0c] border-gray-200 dark:border-white/10">
      <CardHeader className="text-center">
        <Image
          src="/tradx-logo.webp"
          alt="TRADX"
          width={180}
          height={180}
          style={{width: "180px", height: "180px"}}
          className="mx-auto mb-3 h-24 w-24 object-contain"
          priority
        />
        <CardTitle className="text-2xl text-gray-900 dark:text-white">Create your account</CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Join TRADX — Trade. Invest. Grow.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.95fr)_1px_minmax(320px,1fr)] lg:items-start">
          <AuthOAuthButtons mode="signup" availability={oauthAvailability} />
          <div className="hidden h-full min-h-80 w-px bg-border lg:block" />
          <div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Input
                label="Full name"
                id="name"
                placeholder="John Smith"
                error={errors.name?.message}
                {...register("name")}
              />
              <Input
                label="Email"
                type="email"
                id="email"
                placeholder="you@example.com"
                error={errors.email?.message}
                {...register("email")}
              />
              <Input
                label="Password"
                type="password"
                id="password"
                placeholder="Min 8 characters"
                error={showPasswordPolicyWarning ? undefined : errors.password?.message}
                {...register("password")}
              />
              {showPasswordPolicyWarning && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-200"
                >
                  Must include uppercase, lowercase, and a number.
                </div>
              )}
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Create account
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function hasRequiredPasswordMix(value: string) {
  return /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);
}

function getOauthErrorMessage(searchParams: ReturnType<typeof useSearchParams>) {
  if (searchParams.get("error") !== "oauth_not_configured") return "";
  const provider = searchParams.get("provider");
  const label = provider ? provider[0]?.toUpperCase() + provider.slice(1) : "This provider";
  return `${label} sign-up is not configured yet. Add its OAuth client ID and secret to enable it.`;
}
