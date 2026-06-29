"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { readJsonResponse, setCsrfToken } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  googleEnabled?: boolean;
  githubEnabled?: boolean;
}

export function LoginForm({ googleEnabled, githubEnabled }: LoginFormProps) {
  const { setAuthenticatedUser, user } = useAuth();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const redirectTo = getSafeRedirect(searchParams.get("redirect"));
  const twoFactorWarning = error.toLowerCase().includes("two-factor");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (user) {
      window.location.replace(redirectTo);
    }
  }, [redirectTo, user]);

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setError("");
    let didRedirect = false;

    try {
      if (requiresTwoFactor && recoveryMode) {
        await recoverWithCode(data.email);
        return;
      }

      const isMfaStep = requiresTwoFactor && challengeToken;
      const res = await fetch(isMfaStep ? "/api/auth/login/mfa" : "/api/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isMfaStep
            ? {
                challengeToken,
                token: data.twoFactorCode ?? "",
                rememberDevice,
                deviceName: navigator.userAgent,
              }
            : data
        ),
      });

      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        code?: string;
        data?: {
          user?: Parameters<typeof setAuthenticatedUser>[0];
          csrfToken?: string;
          mfaRequired?: boolean;
          challengeToken?: string;
          message?: string;
        };
      }>(res);

      if (!json.success) {
        if (json.code === "TWO_FACTOR_REQUIRED") {
          setRequiresTwoFactor(true);
          setError("Enter your authenticator code to finish signing in.");
          return;
        }
        if (json.code === "INVALID_CHALLENGE") {
          setChallengeToken("");
          setRequiresTwoFactor(false);
          setRecoveryMode(false);
          setError("Your two-factor challenge expired. Please sign in again.");
          return;
        }
        if (
          isMfaStep ||
          json.code === "INVALID_MFA_TOKEN" ||
          json.code === "INVALID_TWO_FACTOR_CODE" ||
          json.code === "INVALID_TOKEN"
        ) {
          setError("Warning: incorrect two-factor authentication code.");
          return;
        }
        setError(json.error ?? "Login failed");
        return;
      }

      if (json.data?.mfaRequired) {
        setRequiresTwoFactor(true);
        setChallengeToken(json.data.challengeToken ?? "");
        setRecoveryMode(false);
        setError(json.data.message ?? "Enter your authenticator code to finish signing in.");
        return;
      }

      setAuthenticatedUser(json.data?.user ?? null);
      setCsrfToken(json.data?.csrfToken);
      didRedirect = true;
      setRedirecting(true);
      window.location.replace(redirectTo);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      if (!didRedirect) setIsLoading(false);
    }
  };

  const recoverWithCode = async (email: string) => {
    if (!recoveryCode.trim()) {
      setError("Enter one of your recovery codes.");
      return;
    }

    const recoverResponse = await fetch("/api/auth/recover-mfa", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, recoveryCode }),
    });
    const recoverJson = await readJsonResponse<{
      success: boolean;
      error?: string;
      data?: { recoveryToken?: string };
    }>(recoverResponse);

    if (!recoverJson.success || !recoverJson.data?.recoveryToken) {
      setError(recoverJson.error ?? "Recovery code could not be verified.");
      return;
    }

    const resetResponse = await fetch("/api/auth/reset-mfa", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryToken: recoverJson.data.recoveryToken }),
    });
    const resetJson = await readJsonResponse<{
      success: boolean;
      error?: string;
      data?: {
        user?: Parameters<typeof setAuthenticatedUser>[0];
        csrfToken?: string;
        message?: string;
      };
    }>(resetResponse);

    if (!resetJson.success) {
      setError(resetJson.error ?? "Could not reset two-factor authentication.");
      return;
    }

    setAuthenticatedUser(resetJson.data?.user ?? null);
    setCsrfToken(resetJson.data?.csrfToken);
    setRedirecting(true);
    window.location.replace(redirectTo);
  };

  if (redirecting || user) {
    return (
      <Card className="w-full max-w-md border-gray-200 bg-white dark:border-white/10 dark:bg-[#0a0c0c]">
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-muted-foreground">Opening your dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md bg-white dark:bg-[#0a0c0c] border-gray-200 dark:border-white/10">
      <CardHeader className="text-center">
        <Image
          src="/tradx-logo.png"
          alt="TRADX"
          width={180}
          height={180}
          style={{width: "180px", height: "180px"}}
          className="mx-auto mb-3 h-24 w-24 object-contain"
          priority
        />
        <CardTitle className="text-2xl text-gray-900 dark:text-white">Welcome back</CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">Sign in to your TRADX account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div
              role="alert"
              className={cn(
                "rounded-lg border p-3 text-sm font-semibold",
                twoFactorWarning
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              )}
            >
              {error}
            </div>
          )}
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
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
          {requiresTwoFactor && !recoveryMode && (
            <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <Input
                label="Authenticator code"
                id="twoFactorCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                error={errors.twoFactorCode?.message}
                {...register("twoFactorCode")}
              />
              {twoFactorWarning && (
                <p
                  role="alert"
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-200"
                >
                  Warning: incorrect two-factor authentication code.
                </p>
              )}
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(event) => setRememberDevice(event.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Remember this device for 30 days
              </label>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => {
                  setRecoveryMode(true);
                  setError("");
                }}
              >
                Use a recovery code instead
              </button>
            </div>
          )}
          {requiresTwoFactor && recoveryMode && (
            <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
              <Input
                label="Recovery code"
                id="recoveryCode"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
              />
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => {
                  setRecoveryMode(false);
                  setError("");
                }}
              >
                Use authenticator code instead
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" isLoading={isLoading}>
            {requiresTwoFactor ? "Verify and sign in" : "Sign in"}
          </Button>
        </form>

        {(googleEnabled || githubEnabled) && (
          <div className="mt-6 space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {googleEnabled ? (
                <Link href="/api/auth/oauth/google">
                  <Button variant="outline" className="w-full" type="button">
                    Google
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" disabled title="Configure GOOGLE_CLIENT_ID">
                  Google
                </Button>
              )}
              {githubEnabled ? (
                <Link href="/api/auth/oauth/github">
                  <Button variant="outline" className="w-full" type="button">
                    GitHub
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" disabled title="Configure GITHUB_CLIENT_ID">
                  GitHub
                </Button>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login") || value.startsWith("/register")) return "/dashboard";
  return value;
}
