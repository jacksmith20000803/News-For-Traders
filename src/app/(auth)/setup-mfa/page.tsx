"use client";

import { useEffect, useState } from "react";
import { BrandedQRCode } from "@/components/ui/branded-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readJsonResponse, secureFetch } from "@/lib/api/client";

interface MfaQrApiResponse {
  success: boolean;
  error?: string;
  data?: {
    qrDataUrl?: string;
    qrCodeDataUrl?: string;
    manualKey?: string;
    message?: string;
  };
}

export default function SetupMfaPage() {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadQrCode() {
      setLoading(true);
      setError("");

      try {
        const response = await secureFetch("/api/auth/mfa/generate-qr", { method: "POST" });
        const json = await readJsonResponse<MfaQrApiResponse>(response);

        if (cancelled) return;

        if (!json.success) {
          setError(json.error ?? "Could not generate two-factor setup QR code.");
          return;
        }

        setQrDataUrl(json.data?.qrDataUrl ?? json.data?.qrCodeDataUrl ?? "");
        setManualKey(json.data?.manualKey ?? "");
        setMessage(json.data?.message ?? "Scan this QR code with your authenticator app.");
      } catch {
        if (!cancelled) setError("Could not generate two-factor setup QR code.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadQrCode();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="auth-market-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="relative z-10 w-full max-w-lg border-border/80 bg-card/95 shadow-2xl shadow-black/10">
        <CardHeader className="text-center">
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use your authenticator app to scan the branded QR code.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          {loading ? (
            <div className="mx-auto h-[324px] w-[324px] animate-pulse rounded-3xl bg-muted" />
          ) : error ? (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {error}
            </p>
          ) : (
            <>
              <BrandedQRCode qrDataUrl={qrDataUrl} logoSrc="/tradx-logo.webp" />
              <p className="text-sm text-muted-foreground">{message}</p>
              <div className="rounded-2xl border border-border bg-background/70 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Manual setup key
                </p>
                <p className="mt-2 break-all font-mono text-sm font-semibold">{manualKey}</p>
              </div>
              <Button type="button" className="w-full" onClick={() => console.log("Proceed to MFA verification")}>
                Next
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
