"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  KeyRound,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandedQRCode } from "@/components/ui/branded-qr-code";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";

interface SecuritySettingsProps {
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export function SecuritySettings({
  email,
  emailVerified,
  twoFactorEnabled,
}: SecuritySettingsProps) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [verified, setVerified] = useState(emailVerified);
  const [twoFactor, setTwoFactor] = useState(twoFactorEnabled);
  const [verificationCode, setVerificationCode] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [setupQrCode, setSetupQrCode] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [regenerateCode, setRegenerateCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<"email" | "2fa" | null>(null);

  const requestVerification = async () => {
    setLoadingAction("email");
    setMessage("");
    setError("");

    try {
      const response = await secureFetch("/api/auth/send-verification-code", { method: "POST" });
      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: { message?: string; retryAfterSeconds?: number };
      }>(response);

      if (!json.success) {
        setError(json.error ?? "Could not send verification code");
        return;
      }

      setMessage(json.data?.message ?? "Verification code sent. Check your email.");
      if (json.data?.message?.toLowerCase().includes("already")) {
        setVerified(true);
      }
    } catch {
      setError("Could not send verification code");
    } finally {
      setLoadingAction(null);
    }
  };

  const confirmEmailVerification = async () => {
    setLoadingAction("email");
    setMessage("");
    setError("");

    try {
      const response = await secureFetch("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ code: verificationCode }),
      });
      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: { message?: string };
      }>(response);

      if (!json.success) {
        setError(json.error ?? "Incorrect verification code");
        return;
      }

      setVerified(true);
      setVerificationCode("");
      setMessage(json.data?.message ?? "Email verification is complete.");
      await refresh();
      router.refresh();
    } catch {
      setError("Could not verify this code");
    } finally {
      setLoadingAction(null);
    }
  };

  const startTwoFactorSetup = async () => {
    setLoadingAction("2fa");
    setMessage("");
    setError("");

    try {
      const response = await secureFetch("/api/auth/mfa/generate-qr", {
        method: "POST",
      });
      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: { qrDataUrl?: string; qrCodeDataUrl?: string; manualKey?: string; message?: string };
      }>(response);

      if (!json.success) {
        setError(json.error ?? "Could not start two-factor setup");
        return;
      }

      setSetupSecret(json.data?.manualKey ?? "");
      setSetupQrCode(json.data?.qrDataUrl ?? json.data?.qrCodeDataUrl ?? "");
      setRecoveryCodes([]);
      setMessage(json.data?.message ?? "Scan the QR code, then enter the 6-digit code.");
    } catch {
      setError("Could not start two-factor setup");
    } finally {
      setLoadingAction(null);
    }
  };

  const confirmTwoFactor = async () => {
    setLoadingAction("2fa");
    setMessage("");
    setError("");

    try {
      const response = await secureFetch("/api/user/security", {
        method: "PATCH",
        body: JSON.stringify({ action: "confirm_2fa", code: setupCode }),
      });
      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: { twoFactorEnabled?: boolean; message?: string; recoveryCodes?: string[] };
      }>(response);

      if (!json.success) {
        setError(
          json.error?.toLowerCase().includes("two-factor") || json.error?.toLowerCase().includes("authenticator")
            ? "Warning: incorrect two-factor authentication code."
            : json.error ?? "Could not confirm two-factor code"
        );
        return;
      }

      setTwoFactor(Boolean(json.data?.twoFactorEnabled));
      setSetupSecret("");
      setSetupQrCode("");
      setSetupCode("");
      setRecoveryCodes(json.data?.recoveryCodes ?? []);
      setMessage(
        json.data?.recoveryCodes?.length
          ? "Two-factor authentication enabled. Store your recovery codes now."
          : json.data?.message ?? "Two-factor authentication enabled"
      );
      await refresh();
      router.refresh();
    } catch {
      setError("Could not confirm two-factor code");
    } finally {
      setLoadingAction(null);
    }
  };

  const disableTwoFactor = async () => {
    setLoadingAction("2fa");
    setMessage("");
    setError("");

    if (!disableCode.trim()) {
      setError("Enter your authenticator code before disabling two-factor authentication.");
      setLoadingAction(null);
      return;
    }

    try {
      const response = await secureFetch("/api/user/security", {
        method: "PATCH",
        body: JSON.stringify({ action: "disable_2fa", code: disableCode }),
      });
      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: { twoFactorEnabled?: boolean; message?: string };
      }>(response);

      if (!json.success) {
        setError(
          json.error?.toLowerCase().includes("two-factor") || json.error?.toLowerCase().includes("authenticator")
            ? "Warning: incorrect two-factor authentication code."
            : json.error ?? "Could not update two-factor authentication"
        );
        return;
      }

      setTwoFactor(Boolean(json.data?.twoFactorEnabled));
      setDisableCode("");
      setRecoveryCodes([]);
      setMessage(json.data?.message ?? "Two-factor authentication disabled");
      await refresh();
      router.refresh();
    } catch {
      setError("Could not update two-factor authentication");
    } finally {
      setLoadingAction(null);
    }
  };

  const regenerateRecoveryCodes = async () => {
    setLoadingAction("2fa");
    setMessage("");
    setError("");

    if (!regenerateCode.trim()) {
      setError("Enter your authenticator code before regenerating recovery codes.");
      setLoadingAction(null);
      return;
    }

    try {
      const response = await secureFetch("/api/user/security", {
        method: "PATCH",
        body: JSON.stringify({ action: "regenerate_recovery_codes", code: regenerateCode }),
      });
      const json = await readJsonResponse<{
        success: boolean;
        error?: string;
        data?: { recoveryCodes?: string[]; message?: string };
      }>(response);

      if (!json.success) {
        setError(
          json.error?.toLowerCase().includes("two-factor") || json.error?.toLowerCase().includes("authenticator")
            ? "Warning: incorrect two-factor authentication code."
            : json.error ?? "Could not regenerate recovery codes"
        );
        return;
      }

      setRecoveryCodes(json.data?.recoveryCodes ?? []);
      setRegenerateCode("");
      setMessage(json.data?.message ?? "Recovery codes regenerated. Save them now.");
      await refresh();
      router.refresh();
    } catch {
      setError("Could not regenerate recovery codes");
    } finally {
      setLoadingAction(null);
    }
  };

  const downloadRecoveryCodes = () => {
    if (recoveryCodes.length === 0) return;

    const content = [
      "TRADX recovery codes",
      "Store these codes somewhere safe. Each code can be used only once.",
      "",
      ...recoveryCodes,
      "",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tradx-recovery-codes.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 shadow-2xl shadow-black/10 dark:bg-[#101214]/95">
      <CardHeader className="border-b border-border/70 bg-gradient-to-r from-cyan-500/10 via-emerald-500/5 to-transparent p-6 pb-7">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Security Settings
        </CardTitle>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Configure account protection and verification for {email}.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 sm:p-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <MailCheck className="h-4 w-4 text-primary" />
                Email Verification
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Verify your email to unlock publishing and sensitive account actions.
              </p>
            </div>
            <Badge variant={verified ? "success" : "warning"}>
              {verified ? "Verified" : "Pending"}
            </Badge>
          </div>
          {verified ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              Email verification is complete.
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                label="Verification code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <Button
                type="button"
                variant="success"
                isLoading={loadingAction === "email"}
                disabled={verificationCode.length !== 6}
                onClick={confirmEmailVerification}
                className="w-full"
              >
                Verify Email
              </Button>
              <Button
                type="button"
                variant="outline"
                isLoading={loadingAction === "email"}
                onClick={requestVerification}
                className="w-full"
              >
                Send Verification Code
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <KeyRound className="h-4 w-4 text-primary" />
                Two-Factor Authentication
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a second account protection layer for sensitive sessions.
              </p>
            </div>
            <Badge variant={twoFactor ? "success" : "outline"}>
              {twoFactor ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          {twoFactor ? (
            <div className="space-y-4">
              <Input
                label="Authenticator code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
              />
              <Button
                type="button"
                variant="destructive"
                isLoading={loadingAction === "2fa"}
                onClick={disableTwoFactor}
                className="w-full"
              >
                <ShieldOff className="h-4 w-4" />
                Disable 2FA
              </Button>
              <div className="rounded-2xl border border-border bg-card/80 p-3">
                <p className="text-sm font-semibold">Recovery codes</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Generate a fresh one-time set if you used or misplaced a code.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    label="Authenticator code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={regenerateCode}
                    onChange={(event) => setRegenerateCode(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={loadingAction === "2fa"}
                    onClick={regenerateRecoveryCodes}
                    className="sm:mt-6"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="success"
              isLoading={loadingAction === "2fa"}
              onClick={startTwoFactorSetup}
              className="w-full"
            >
              <ShieldCheck className="h-4 w-4" />
              Set up 2FA
            </Button>
          )}
          {!twoFactor && setupSecret && (
            <div className="mt-4 rounded-2xl border border-border bg-white p-4 shadow-xl dark:bg-[#101214]">
              <p className="text-sm font-semibold">Authenticator setup</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Scan this QR code with your authenticator app, then enter the generated code.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                {setupQrCode && (
                  <div className="mx-auto rounded-2xl border border-border bg-white p-3 shadow-lg sm:mx-0">
                    <BrandedQRCode
                      qrDataUrl={setupQrCode}
                      logoSrc="/tradx-logo.png"
                      size={180}
                      logoSizePercent={20}
                      showDownload={false}
                      alt="Two-factor authentication QR code"
                    />
                  </div>
                )}
                <div className="rounded-2xl border border-border bg-background/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Manual setup key
                  </p>
                  <p className="mt-2 break-all font-mono text-sm font-semibold text-foreground">
                    {setupSecret}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    This key is shown only for setup. The server stores an encrypted pending copy until you confirm.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={setupCode}
                  onChange={(event) => setSetupCode(event.target.value)}
                  inputMode="numeric"
                  placeholder="123456"
                  className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  type="button"
                  onClick={confirmTwoFactor}
                  isLoading={loadingAction === "2fa"}
                  disabled={setupCode.trim().length < 6}
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
          {recoveryCodes.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-300">
                Save these recovery codes
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Each code works once if you lose access to your authenticator app.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {recoveryCodes.map((code) => (
                  <code
                    key={code}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold"
                  >
                    {code}
                  </code>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={downloadRecoveryCodes}
                className="mt-4 w-full"
              >
                <Download className="h-4 w-4" />
                Download text file
              </Button>
            </div>
          )}
        </div>

        {(message || error) && (
          <div className="space-y-2 lg:col-span-2">
            {message && (
              <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-200">
                {error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
