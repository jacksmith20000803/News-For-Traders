"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthOAuthButtons, type OAuthAvailability } from "@/components/auth/oauth-buttons";
import { useAuth } from "@/components/providers/auth-provider";
import { readJsonResponse, setCsrfToken } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  oauthAvailability?: OAuthAvailability;
}

type LoginStep = "credentials" | "mfa" | "recovery";

export function LoginForm({ oauthAvailability }: LoginFormProps) {
  const router = useRouter();
  const { setAuthenticatedUser, user } = useAuth();
  const searchParams = useSearchParams();
  const [error, setError] = useState(() => getOauthErrorMessage(searchParams));
  const [isLoading, setIsLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [twoFactorInvalid, setTwoFactorInvalid] = useState(false);
  const redirectTo = getSafeRedirect(searchParams.get("redirect"));
  const twoFactorWarning = twoFactorInvalid;
  const isTwoFactorStep = requiresTwoFactor && !!challengeToken;
  const activeStep: LoginStep = isTwoFactorStep ? (recoveryMode ? "recovery" : "mfa") : "credentials";

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    shouldUnregister: false,
  });
  const emailValue = useWatch({ control, name: "email" }) ?? "";

  useEffect(() => {
    if (user) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router, user]);

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setError("");
    setTwoFactorInvalid(false);
    let didRedirect = false;

    try {
      if (isTwoFactorStep && recoveryMode) {
        await recoverWithCode(data.email);
        return;
      }

      const mfaToken = (data.twoFactorCode ?? "").trim();

      if (isTwoFactorStep && !/^\d{6}$/.test(mfaToken)) {
        setTwoFactorInvalid(false);
        setError("Enter the 6-digit code from your authenticator app.");
        return;
      }

      const res = await fetch(isTwoFactorStep ? "/api/auth/login/mfa" : "/api/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isTwoFactorStep
            ? {
                challengeToken,
                token: mfaToken,
                rememberDevice,
                deviceName: navigator.userAgent.slice(0, 255),
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
          const token = json.data?.challengeToken ?? "";
          if (!token) {
            setError("Two-factor verification could not be started. Please try again.");
            return;
          }
          setRequiresTwoFactor(true);
          setChallengeToken(token);
          setTwoFactorInvalid(false);
          setError("");
          return;
        }
        if (json.code === "INVALID_CHALLENGE") {
          resetTwoFactorStep();
          setError("Your two-factor challenge expired. Please sign in again.");
          return;
        }
        if (isTwoFactorStep && json.code === "VALIDATION_ERROR") {
          setTwoFactorInvalid(false);
          setError(json.error ?? "Enter the 6-digit code from your authenticator app.");
          return;
        }
        if (
          isTwoFactorStep ||
          json.code === "INVALID_MFA_TOKEN" ||
          json.code === "INVALID_TWO_FACTOR_CODE" ||
          json.code === "INVALID_TOKEN"
        ) {
          setTwoFactorInvalid(true);
          setError("Warning: incorrect two-factor authentication code.");
          return;
        }
        setError(json.error ?? "Login failed");
        return;
      }

      if (json.data?.mfaRequired) {
        const token = json.data.challengeToken ?? "";
        if (!token) {
          setError("Two-factor verification could not be started. Please try again.");
          return;
        }
        setRequiresTwoFactor(true);
        setChallengeToken(token);
        setTwoFactorInvalid(false);
        setError("");
        return;
      }

      setAuthenticatedUser(json.data?.user ?? null);
      setCsrfToken(json.data?.csrfToken);
      didRedirect = true;
      setRedirecting(true);
      router.replace(redirectTo);
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
    router.replace(redirectTo);
  };

  const resetTwoFactorStep = () => {
    setChallengeToken("");
    setRequiresTwoFactor(false);
    setRecoveryMode(false);
    setRecoveryCode("");
    setTwoFactorInvalid(false);
  };

  if (redirecting || user) {
    return (
      <Card className="relative w-full max-w-5xl overflow-hidden border-gray-200 bg-white dark:border-white/10 dark:bg-[#0a0c0c]">
        <AuthTopLoading active />
        <CardContent className="p-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground">Opening your dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative w-full max-w-5xl overflow-hidden border-gray-200 bg-white dark:border-white/10 dark:bg-[#0a0c0c]">
      <AuthTopLoading active={isLoading} />
      <CardHeader className="text-center">
        <Image
          src="/tradx-logo.webp"
          alt="TRADX"
          width={180}
          height={180}
          style={{ width: "180px", height: "180px" }}
          className="mx-auto mb-3 h-24 w-24 object-contain"
          priority
        />
        <CardTitle className="text-2xl text-gray-900 dark:text-white">Welcome back</CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">Sign in to your TRADX account</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.95fr)_1px_minmax(320px,1fr)] lg:items-start">
          <AuthOAuthButtons mode="signin" availability={oauthAvailability} />
          <div className="hidden h-full min-h-80 w-px bg-border lg:block" />
          <div>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="relative overflow-hidden p-1"
            >
              <div key={activeStep} className="auth-page-turn space-y-4">
                {activeStep === "credentials" ? (
                  <>
                    {error && <AuthAlert message={error} warning={false} />}
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
                      placeholder="Password"
                      error={errors.password?.message}
                      {...register("password")}
                    />
                    <div className="flex justify-end">
                      <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      Log In
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Two-factor verification
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-foreground">Confirm it is you</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Enter the verification code for {emailValue || "your account"}.
                      </p>
                    </div>

                    {error && <AuthAlert message={error} warning={twoFactorWarning} />}

                    {activeStep === "mfa" ? (
                      <>
                        <Input
                          label="Authenticator code"
                          id="twoFactorCode"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          error={errors.twoFactorCode?.message}
                          {...register("twoFactorCode")}
                        />
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={rememberDevice}
                            onChange={(event) => setRememberDevice(event.target.checked)}
                            className="h-4 w-4 rounded border-border accent-primary"
                          />
                          Remember this device for 30 days
                        </label>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            className="text-sm font-medium text-primary hover:underline"
                            onClick={() => {
                              setRecoveryMode(true);
                              setTwoFactorInvalid(false);
                              setError("");
                            }}
                          >
                            Use a recovery code instead
                          </button>
                          <button
                            type="button"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground"
                            onClick={resetTwoFactorStep}
                          >
                            Use a different account
                          </button>
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                          Next
                        </Button>
                      </>
                    ) : (
                      <>
                        <Input
                          label="Recovery code"
                          id="recoveryCode"
                          placeholder="xxxx-xxxx-xxxx-xxxx"
                          value={recoveryCode}
                          onChange={(event) => setRecoveryCode(event.target.value)}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            className="text-sm font-medium text-primary hover:underline"
                            onClick={() => {
                              setRecoveryMode(false);
                              setRecoveryCode("");
                              setTwoFactorInvalid(false);
                              setError("");
                            }}
                          >
                            Use authenticator code instead
                          </button>
                          <button
                            type="button"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground"
                            onClick={resetTwoFactorStep}
                          >
                            Use a different account
                          </button>
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                          Recover and sign in
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuthTopLoading({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 overflow-hidden bg-transparent">
      <span className="auth-loading-line block h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-blue-500" />
    </div>
  );
}

function AuthAlert({ message, warning }: { message: string; warning: boolean }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border p-3 text-sm font-semibold",
        warning
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {message}
    </div>
  );
}

function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login") || value.startsWith("/register")) return "/dashboard";
  return value;
}

function getOauthErrorMessage(searchParams: ReturnType<typeof useSearchParams>) {
  const error = searchParams.get("error");
  if (!error) return "";
  const provider = searchParams.get("provider");
  const label = provider ? provider[0]?.toUpperCase() + provider.slice(1) : "This provider";
  if (error !== "oauth_not_configured") {
    return `${label} sign-in failed: ${error}. Please check the provider setup and try again.`;
  }
  return `${label} sign-in is not configured yet. Add its OAuth client ID and secret to enable it.`;
}
