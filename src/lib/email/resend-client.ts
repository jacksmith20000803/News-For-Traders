import nodemailer from "nodemailer";

interface SendVerificationEmailParams {
  toEmail: string;
  code: string;
  expiryMinutes: number;
  verificationUrl: string;
  tokenExpiryHours: number;
}

interface ResendResponse {
  id?: string;
  message?: string;
  name?: string;
}

type StoredEmailKey = {
  id: string;
  displayName: string;
  apiKey: string;
  fromEmail: string;
  enabled: boolean;
};

const EMAIL_KEYS_SETTING = "email_verification_resend_keys";

function buildVerificationEmailHtml(
  code: string,
  expiryMinutes: number,
  verificationUrl: string,
  tokenExpiryHours: number
) {
  const safeCode = code.replace(/[^0-9]/g, "");
  const safeUrl = escapeHtml(verificationUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Verify your TRADX email</title>
  </head>
  <body style="margin:0;background:#f4f7fb;color:#111827;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;overflow:hidden;border-radius:22px;background:#ffffff;box-shadow:0 20px 50px rgba(15,23,42,0.12);">
            <tr>
              <td style="background:#071012;padding:28px 32px;text-align:center;">
                <div style="color:#10b981;font-size:14px;font-weight:800;letter-spacing:0.32em;text-transform:uppercase;">TRADX</div>
                <div style="margin-top:8px;color:#e5e7eb;font-size:22px;font-weight:800;">Verify your email</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                  Confirm this email address for your TRADX account. The secure button below expires in <strong>${tokenExpiryHours} hours</strong>.
                </p>
                <div style="margin:24px 0;text-align:center;">
                  <a href="${safeUrl}" style="display:inline-block;border-radius:999px;background:#10b981;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 24px;box-shadow:0 14px 30px rgba(16,185,129,0.28);">
                    Verify email
                  </a>
                </div>
                <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;word-break:break-all;">
                  If the button does not work, copy and paste this link into your browser:<br />
                  <a href="${safeUrl}" style="color:#047857;">${safeUrl}</a>
                </p>
                <div style="margin:24px 0;border-radius:18px;background:#ecfdf5;border:1px solid #a7f3d0;padding:22px;text-align:center;">
                  <div style="color:#047857;font-size:12px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;">Verification code</div>
                  <div style="margin-top:10px;color:#064e3b;font-family:'SFMono-Regular',Consolas,monospace;font-size:40px;font-weight:900;letter-spacing:0.18em;">${safeCode}</div>
                </div>
                <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.6;">
                  This code expires in <strong>${expiryMinutes} minutes</strong>. If you did not request this email, you can safely ignore it.
                </p>
                <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                  For your security, never share this code with anyone. TRADX support will never ask for it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail({
  toEmail,
  code,
  expiryMinutes,
  verificationUrl,
  tokenExpiryHours,
}: SendVerificationEmailParams): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const subject = "Verify your TRADX email";
  const html = buildVerificationEmailHtml(code, expiryMinutes, verificationUrl, tokenExpiryHours);
  const smtpConfig = getSmtpConfig();
  if (smtpConfig) {
    return sendViaSmtp({
      toEmail,
      subject,
      html,
      ...smtpConfig,
    });
  }

  const config = await getVerificationEmailConfig();
  const apiKey = config?.apiKey;
  const from = config?.fromEmail;

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Email delivery is not configured. Add an active verification email key in Admin Settings or set RESEND_API_KEY and RESEND_FROM_EMAIL.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject,
        html,
      }),
    });

    const json = (await response.json().catch(() => null)) as ResendResponse | null;

    if (!response.ok) {
      return { ok: false, error: json?.message ?? "Verification email could not be sent." };
    }

    return { ok: true, id: json?.id };
  } catch (error) {
    console.error("[email:verification:resend]", error);
    return { ok: false, error: "Verification email could not be sent." };
  }
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM ?? user;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);

  if (!host || !user || !pass || !from || Number.isNaN(port)) return null;
  return {
    host,
    port,
    user,
    pass,
    from,
  };
}

async function sendViaSmtp(params: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  toEmail: string;
  subject: string;
  html: string;
}): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: params.host,
      port: params.port,
      secure: params.port === 465,
      auth: {
        user: params.user,
        pass: params.pass,
      },
    });

    const info = await transporter.sendMail({
      from: params.from,
      to: params.toEmail,
      subject: params.subject,
      html: params.html,
    });

    console.info(`[email:verification:smtp] sent ${info.messageId ?? "unknown"} to ${params.toEmail}`);
    return { ok: true, id: info.messageId };
  } catch (error) {
    console.error("[email:verification:smtp]", error);
    return { ok: false, error: "Verification email could not be sent through SMTP." };
  }
}

async function getVerificationEmailConfig() {
  const stored = await readStoredEmailKeys();
  const active = stored.find((key) => key.enabled && key.apiKey && key.fromEmail);
  if (active) return active;

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    return {
      id: "env",
      displayName: "Environment",
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL,
      enabled: true,
    };
  }

  return null;
}

async function readStoredEmailKeys(): Promise<StoredEmailKey[]> {
  try {
    const { db } = await import("@/lib/db");
    const setting = await db.siteSetting.findUnique({ where: { key: EMAIL_KEYS_SETTING } });
    if (!setting?.value) return [];
    const parsed = JSON.parse(setting.value) as StoredEmailKey[];
    return Array.isArray(parsed) ? parsed.filter(isStoredEmailKey) : [];
  } catch {
    return [];
  }
}

function isStoredEmailKey(value: unknown): value is StoredEmailKey {
  if (!value || typeof value !== "object") return false;
  const key = value as Partial<StoredEmailKey>;
  return Boolean(key.id && key.displayName && key.apiKey && key.fromEmail);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
