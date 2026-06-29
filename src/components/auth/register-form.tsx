"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { readJsonResponse, setCsrfToken } from "@/lib/api/client";

export function RegisterForm() {
  const { setAuthenticatedUser, user } = useAuth();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (user) {
      window.location.replace("/dashboard");
    }
  }, [user]);

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
      setAuthenticatedUser(json.data?.user ?? null);
      didRedirect = true;
      setRedirecting(true);
      window.location.replace(json.data?.redirectTo ?? "/dashboard");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      if (!didRedirect) setIsLoading(false);
    }
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
          width={200}
          height={190}
          className="mx-auto mb-3 object-contain"
          priority
        />
        <CardTitle className="text-2xl text-gray-900 dark:text-white">Create your account</CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Join TRADX — Trade. Invest. Grow.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            placeholder="Min. 8 characters"
            error={errors.password?.message}
            {...register("password")}
          />
          <p className="text-xs text-muted-foreground">
            Must include uppercase, lowercase, and a number.
          </p>
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
      </CardContent>
    </Card>
  );
}
