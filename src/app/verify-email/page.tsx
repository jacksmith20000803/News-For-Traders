"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MailCheck, RefreshCw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { readJsonResponse, secureFetch } from "@/lib/api/client";

type Status = "idle" | "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const { refresh } = useAuth();
  const [status, setStatus] = useState<Status>(token ? "loading" : "idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const safeCallbackUrl = useMemo(
    () => (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/dashboard"),
    [callbackUrl]
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((response) =>
        readJsonResponse<{ success: boolean; error?: string; data?: { message?: string } }>(response)
      )
      .then(async (json) => {
        if (cancelled) return;
        if (json.success) {
          setStatus("success");
          setMessage(json.data?.message ?? "Email verified successfully.");
          await refresh();
          return;
        }
        setStatus("error");
        setMessage(json.error ?? "Verification failed.");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setMessage("Verification request failed.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refresh, token]);

  const sendCode = async () => {
    setIsSending(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await secureFetch("/api/auth/send-verification-code", { method: "POST" });
      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: { message?: string; retryAfterSeconds?: number };
      }>(response);

      if (!json.success) {
        setStatus("error");
        setMessage(json.error ?? "Could not send a verification code.");
        return;
      }

      setStatus("idle");
      setMessage(json.data?.message ?? "Verification code sent. Check your email.");
    } catch {
      setStatus("error");
      setMessage("Could not send a verification code.");
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    setIsVerifying(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await secureFetch("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const json = await readJsonResponse<{ success: boolean; error?: string; data?: { message?: string } }>(
        response
      );

      if (!json.success) {
        setStatus("error");
        setMessage(json.error ?? "Incorrect verification code.");
        return;
      }

      setStatus("success");
      setMessage(json.data?.message ?? "Email verified successfully.");
      await refresh();
    } catch {
      setStatus("error");
      setMessage("Could not verify this code.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card className="w-full max-w-md overflow-hidden border-border/80 bg-card/95 shadow-2xl shadow-black/10">
      <CardHeader className="border-b border-border/70 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-transparent text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck className="h-6 w-6" />
        </div>
        <CardTitle>Email Verification</CardTitle>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Enter the 6-digit code sent to your inbox to finish protecting your account.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-6 text-center">
        {token && status === "loading" && (
          <p className="text-sm text-muted-foreground">Verifying your email...</p>
        )}

        {!token && status !== "success" && (
          <div className="space-y-3 text-left">
            <Input
              label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="success"
                isLoading={isVerifying}
                disabled={code.length !== 6}
                onClick={verifyCode}
              >
                Verify Email
              </Button>
              <Button type="button" variant="outline" isLoading={isSending} onClick={sendCode}>
                <RefreshCw className="h-4 w-4" />
                Send Code
              </Button>
            </div>
          </div>
        )}

        {message && status !== "loading" && (
          <p
            role={status === "error" ? "alert" : "status"}
            className={
              status === "error"
                ? "rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-200"
                : "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-300"
            }
          >
            {message}
          </p>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <ButtonLink href={safeCallbackUrl} variant="success" className="w-full">
              Continue
            </ButtonLink>
          </div>
        )}

        {status === "error" && token && (
          <Link href="/verify-email" className="text-sm font-medium text-primary hover:underline">
            Request a new verification code
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Suspense>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
