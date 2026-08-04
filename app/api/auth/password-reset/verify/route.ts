import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import PasswordReset from '../../../../models/PasswordReset';
import {
    digest, digestMatches, generateToken, MAX_OTP_ATTEMPTS, TOKEN_TTL_MINUTES,
} from '../../../../lib/otp';
import { clientIp, rateLimit } from '../../../../lib/rateLimit';

// Step 2: check the one-time code and, if it holds, mint the reset link.
//
// The code proves control of the inbox or handset; the link token is what
// actually authorises the password change. Splitting the two keeps the short
// guessable code out of the URL — and out of browser history and referrers.

/** Set APP_URL when the app sits behind a proxy or in the Capacitor shell. */
const baseUrl = (request: Request) =>
    (process.env.APP_URL || '').trim().replace(/\/+$/, '') || new URL(request.url).origin;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const requestId = String(body?.requestId || '').trim();
        const code = String(body?.code || '').replace(/\D/g, '');

        if (!requestId || !code) {
            return NextResponse.json({ success: false, error: 'Enter the code we sent you' }, { status: 400 });
        }

        const limit = rateLimit(`pwverify-ip:${clientIp(request)}`, 30, 15 * 60 * 1000);
        if (!limit.ok) {
            return NextResponse.json(
                { success: false, error: 'Too many attempts. Try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
            );
        }

        await dbConnect();
        const reset = await PasswordReset.findOne({ requestId });

        // Same message for an unknown handle, a used one and a wrong code — an
        // attacker learns nothing from which of the three they hit.
        const BAD = 'That code is incorrect or has expired. Request a new one.';
        if (!reset || reset.usedAt || !reset.codeHash) {
            return NextResponse.json({ success: false, error: BAD }, { status: 400 });
        }
        if (reset.codeExpiresAt.getTime() < Date.now()) {
            return NextResponse.json({ success: false, error: BAD }, { status: 400 });
        }
        if (reset.attempts >= MAX_OTP_ATTEMPTS) {
            return NextResponse.json(
                { success: false, error: 'Too many incorrect codes. Request a new one.' },
                { status: 429 },
            );
        }

        if (!digestMatches(code, reset.codeHash)) {
            reset.attempts += 1;
            await reset.save();
            const left = Math.max(0, MAX_OTP_ATTEMPTS - reset.attempts);
            return NextResponse.json(
                { success: false, error: left > 0 ? `That code isn't right — ${left} attempt(s) left.` : BAD },
                { status: 400 },
            );
        }

        const token = generateToken();
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

        reset.codeHash = undefined;             // spent — it can't be replayed
        reset.verifiedAt = new Date();
        reset.tokenHash = digest(token);
        reset.tokenExpiresAt = expiresAt;
        reset.expiresAt = new Date(expiresAt.getTime() + 60 * 60_000);
        await reset.save();

        const resetPath = `/reset-password?token=${encodeURIComponent(token)}`;
        return NextResponse.json({
            success: true,
            data: {
                token,
                resetPath,
                resetUrl: `${baseUrl(request)}${resetPath}`,
                expiresInMinutes: TOKEN_TTL_MINUTES,
            },
        });
    } catch (error) {
        console.error('[auth] password reset verify failed:', error);
        return NextResponse.json(
            { success: false, error: 'Could not check that code — please try again.' },
            { status: 500 },
        );
    }
}
