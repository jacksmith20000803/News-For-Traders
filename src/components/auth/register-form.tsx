"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { setCsrfToken } from "@/lib/api/client";

export function RegisterForm() {
  const { setAuthenticatedUser, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
      router.refresh();
    }
  }, [router, user]);

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Registration failed");
        return;
      }

      setAuthenticatedUser(json.data?.user ?? null);
      setCsrfToken(json.data?.csrfToken);
      router.replace(json.data?.redirectTo ?? "/onboarding");
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
