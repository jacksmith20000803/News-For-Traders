"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setStatus("success");
          setMessage(json.data?.message ?? "Email verified successfully.");
        } else {
          setStatus("error");
          setMessage(json.error ?? "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Verification request failed.");
      });
  }, [token]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Email Verification</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        {status === "loading" && (
          <p className="text-muted-foreground">Verifying your email…</p>
        )}
        {status === "success" && (
          <>
            <p className="text-accent">{message}</p>
            <Link href="/login">
              <Button>Sign in</Button>
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-destructive">{message}</p>
            <Link href="/dashboard/settings" className="text-sm text-primary hover:underline">
              Go to settings to resend verification
            </Link>
          </>
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
