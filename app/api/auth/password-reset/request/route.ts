import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import PasswordReset from '../../../../models/PasswordReset';
import { generateOtp, generateToken, digest, maskEmail, OTP_TTL_MINUTES } from '../../../../lib/otp';
import { sendOtp } from '../../../../lib/notify';
import { clientIp, rateLimit } from '../../../../lib/rateLimit';

// Step 1 of the forgot-password flow: take the account's email address, send a
// one-time code to it, and hand back the request handle the browser uses for
// step 2.
//
// Email is the only channel — there is no SMS provider wired up, and offering
// a phone box that silently can't deliver is worse than not offering it.
//
// The response is deliberately the same whether or not the address belongs to
// an account — an unauthenticated endpoint that says "no such user" is a list
// of who banks here. An unknown address gets a throwaway requestId whose code
// can never match.

const CODE_WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IDENTIFIER = 5;
const MAX_PER_IP = 15;

const parseEmail = (raw: string): string | null => {
    const email = String(raw || '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // `identifier` stays the field name so an SMS channel could be added
        // back without changing the request shape.
        const email = parseEmail(body?.identifier ?? body?.email);
        if (!email) {
            return NextResponse.json(
                { success: false, error: 'Enter the email address on your account' },
                { status: 400 },
            );
        }

        const byIdentifier = rateLimit(`pwreset:${email}`, MAX_PER_IDENTIFIER, CODE_WINDOW_MS);
        const byIp = rateLimit(`pwreset-ip:${clientIp(request)}`, MAX_PER_IP, CODE_WINDOW_MS);
        if (!byIdentifier.ok || !byIp.ok) {
            const retryAfter = Math.max(byIdentifier.retryAfterSeconds, byIp.retryAfterSeconds);
            return NextResponse.json(
                { success: false, error: `Too many codes requested. Try again in ${Math.ceil(retryAfter / 60)} minute(s).` },
                { status: 429, headers: { 'Retry-After': String(retryAfter) } },
            );
        }

        await dbConnect();
        const user = await User.findOne({ email });
        const expiresInMinutes = OTP_TTL_MINUTES;

        if (!user) {
            return NextResponse.json({
                success: true,
                data: { requestId: generateToken(), sentTo: maskEmail(email), expiresInMinutes },
            });
        }

        const code = generateOtp();
        const delivery = await sendOtp({
            to: user.email,
            code,
            name: user.name,
            expiresInMinutes,
        });

        if (!delivery.ok) {
            return NextResponse.json(
                { success: false, error: delivery.error || 'Could not send your code — please try again.' },
                { status: 502 },
            );
        }

        // Newest attempt wins: any earlier unfinished request for this account
        // (including a verified-but-unused link) stops working.
        await PasswordReset.deleteMany({ userId: user._id, usedAt: { $exists: false } });

        const now = Date.now();
        const requestId = generateToken();
        await PasswordReset.create({
            userId: user._id,
            requestId,
            destination: user.email,
            codeHash: digest(code),
            codeExpiresAt: new Date(now + OTP_TTL_MINUTES * 60_000),
            attempts: 0,
            expiresAt: new Date(now + 60 * 60_000),   // TTL sweep an hour later
        });

        return NextResponse.json({
            success: true,
            data: {
                requestId,
                sentTo: maskEmail(user.email),
                expiresInMinutes,
                // Only when no provider is configured on a dev server — see notify.ts.
                ...(delivery.devOnly && process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
            },
        });
    } catch (error) {
        console.error('[auth] password reset request failed:', error);
        return NextResponse.json(
            { success: false, error: 'Could not start the reset — please try again.' },
            { status: 500 },
        );
    }
}
