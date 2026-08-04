// Outbound delivery for one-time codes. Email only — reset codes go to the
// address on the account, never to a phone.
//
// Dependency-free on purpose, like the rest of the auth stack: every provider
// below is a plain HTTPS call through `fetch`, so nothing is added to
// package.json and no SMTP client has to be configured.
//
// Configure one in .env:
//
//   RESEND_API_KEY + MAIL_FROM                    (https://resend.com)
//   NOTIFY_WEBHOOK_URL [+ NOTIFY_WEBHOOK_TOKEN]   — your own sender
//
// With neither configured a *development* server prints the code to the
// terminal so the flow can be exercised before any provider account exists. A
// production build never does that: it reports the failure instead, because a
// code nobody receives is worse than an honest error.

export interface DeliveryResult {
    ok: boolean;
    /** 'resend' | 'webhook' | 'console' — for the server log. */
    provider: string;
    /** True when the code only reached the terminal, never the user. */
    devOnly?: boolean;
    error?: string;
}

const env = (key: string) => (process.env[key] || '').trim();

const webhookConfigured = () => Boolean(env('NOTIFY_WEBHOOK_URL'));

export const emailConfigured = () =>
    Boolean((env('RESEND_API_KEY') && env('MAIL_FROM')) || webhookConfigured());

// ── Message copy ────────────────────────────────────────────────────────────

const SUBJECT = 'Your SoloTrackr password reset code';

const textBody = (code: string, minutes: number) =>
    `Your SoloTrackr password reset code is ${code}.\n\n` +
    `It expires in ${minutes} minutes. If you didn't ask to reset your password, ` +
    `ignore this message — your account is unchanged.`;

const htmlBody = (name: string, code: string, minutes: number) => `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f4f4f5;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <p style="margin:0 0 4px;font-size:20px;font-weight:800;letter-spacing:-.02em">Solo<span style="color:#2563eb">Trackr</span></p>
    <p style="margin:0 0 24px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#71717a">Password reset</p>
    <p style="margin:0 0 16px;font-size:14px;color:#27272a">Hi ${escapeHtml(name || 'there')}, use this code to reset your password:</p>
    <p style="margin:0 0 16px;font-size:34px;font-weight:800;letter-spacing:.35em;font-family:ui-monospace,SFMono-Regular,monospace;color:#111">${code}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#52525b">The code expires in ${minutes} minutes.</p>
    <p style="margin:0;font-size:12px;color:#a1a1aa">If you didn't ask to reset your password, ignore this email — your account is unchanged.</p>
  </div>
</div>`;

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
    ));

// ── Providers ───────────────────────────────────────────────────────────────

async function sendViaWebhook(payload: Record<string, unknown>): Promise<DeliveryResult> {
    const token = env('NOTIFY_WEBHOOK_TOKEN');
    const res = await fetch(env('NOTIFY_WEBHOOK_URL'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, provider: 'webhook', error: `Webhook responded ${res.status}` };
    return { ok: true, provider: 'webhook' };
}

async function sendEmail(to: string, name: string, code: string, minutes: number): Promise<DeliveryResult> {
    if (env('RESEND_API_KEY') && env('MAIL_FROM')) {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env('RESEND_API_KEY')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env('MAIL_FROM'),
                to: [to],
                subject: SUBJECT,
                text: textBody(code, minutes),
                html: htmlBody(name, code, minutes),
            }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            return { ok: false, provider: 'resend', error: `Resend responded ${res.status} ${detail.slice(0, 160)}` };
        }
        return { ok: true, provider: 'resend' };
    }

    if (webhookConfigured()) {
        return sendViaWebhook({ channel: 'email', to, subject: SUBJECT, text: textBody(code, minutes), html: htmlBody(name, code, minutes), code });
    }

    return { ok: false, provider: 'none', error: 'No email provider configured' };
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function sendOtp(opts: {
    to: string;
    code: string;
    name?: string;
    expiresInMinutes: number;
}): Promise<DeliveryResult> {
    const { to, code, name = '', expiresInMinutes } = opts;

    if (!emailConfigured()) {
        if (process.env.NODE_ENV === 'production') {
            return { ok: false, provider: 'none', error: 'Email delivery is not configured on this server.' };
        }
        console.warn(
            `[auth] no email provider configured — password reset code for ${to} is ${code} ` +
            `(valid ${expiresInMinutes} minutes). Set RESEND_API_KEY + MAIL_FROM to deliver it for real.`,
        );
        return { ok: true, provider: 'console', devOnly: true };
    }

    try {
        const result = await sendEmail(to, name, code, expiresInMinutes);
        if (!result.ok) console.error(`[auth] email delivery failed via ${result.provider}: ${result.error}`);
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Delivery failed';
        console.error('[auth] email delivery threw:', error);
        return { ok: false, provider: 'unknown', error: message };
    }
}
