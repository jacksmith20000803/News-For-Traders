"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { setCsrfToken } from "@/lib/api/client";

interface LoginFormProps {
  googleEnabled?: boolean;
  githubEnabled?: boolean;
}

export function LoginForm({ googleEnabled, githubEnabled }: LoginFormProps) {
  const { setAuthenticatedUser, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const redirectTo = getSafeRedirect(searchParams.get("redirect"));

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (user) {
      router.replace(redirectTo);
      router.refresh();
    }
  }, [redirectTo, router, user]);

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Login failed");
        return;
      }

      setAuthenticatedUser(json.data?.user ?? null);
      setCsrfToken(json.data?.csrfToken);
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md bg-white dark:bg-[#0a0c0c] border-gray-200 dark:border-white/10">
      <CardHeader className="text-center">
        <Image
          src="/tradx-logo.png"
          alt="TRADX"
          width={168}
          height={50}
          className="mx-auto mb-3 h-auto w-40 object-contain"
          style={{ height: "auto" }}
          priority
        />
        <CardTitle className="text-2xl text-gray-900 dark:text-white">Welcome back</CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">Sign in to your TRADX account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
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
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Sign in
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
