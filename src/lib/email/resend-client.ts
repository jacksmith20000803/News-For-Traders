interface SendVerificationEmailParams {
  toEmail: string;
  code: string;
  expiryMinutes: number;
}

interface ResendResponse {
  id?: string;
  message?: string;
  name?: string;
}

function buildVerificationEmailHtml(code: string, expiryMinutes: number) {
  const safeCode = code.replace(/[^0-9]/g, "");

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
                  Use this one-time code to verify your TRADX account email address.
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
}: SendVerificationEmailParams): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
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
        subject: "Your TRADX verification code",
        html: buildVerificationEmailHtml(code, expiryMinutes),
      }),
    });

    const json = (await response.json().catch(() => null)) as ResendResponse | null;

    if (!response.ok) {
      return { ok: false, error: json?.message ?? "Verification email could not be sent." };
    }

    return { ok: true, id: json?.id };
  } catch {
    return { ok: false, error: "Verification email could not be sent." };
  }
}
