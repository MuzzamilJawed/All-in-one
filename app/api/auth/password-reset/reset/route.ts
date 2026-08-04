import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import PasswordReset from '../../../../models/PasswordReset';
import { hashPassword, passwordProblem } from '../../../../lib/password';
import { digest, maskEmail } from '../../../../lib/otp';
import { clientIp, rateLimit } from '../../../../lib/rateLimit';

// Step 3: the reset link itself.
//
// GET  — does this token still open the form? (so a dead link says so up front
//        instead of after the user has typed a new password twice)
// POST — set the new password and burn the token.

const DEAD_LINK = 'This reset link is no longer valid. Start again from "Forgot password".';

/** A live, unused, unexpired reset for this token — or null. */
async function findLiveReset(token: string) {
    if (!token) return null;
    const reset = await PasswordReset.findOne({ tokenHash: digest(token) });
    if (!reset || reset.usedAt || !reset.verifiedAt) return null;
    if (!reset.tokenExpiresAt || reset.tokenExpiresAt.getTime() < Date.now()) return null;
    return reset;
}

export async function GET(request: Request) {
    try {
        const token = new URL(request.url).searchParams.get('token') || '';
        await dbConnect();
        const reset = await findLiveReset(token);
        if (!reset) return NextResponse.json({ success: false, error: DEAD_LINK }, { status: 400 });

        const user = await User.findById(reset.userId).select('name email');
        if (!user) return NextResponse.json({ success: false, error: DEAD_LINK }, { status: 400 });

        return NextResponse.json({
            success: true,
            data: {
                name: user.name,
                email: maskEmail(user.email),
                expiresAt: reset.tokenExpiresAt,
            },
        });
    } catch (error) {
        console.error('[auth] password reset token check failed:', error);
        return NextResponse.json({ success: false, error: 'Could not check that link' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const token = String(body?.token || '').trim();
        const password = String(body?.password || '');

        const limit = rateLimit(`pwreset-apply-ip:${clientIp(request)}`, 20, 15 * 60 * 1000);
        if (!limit.ok) {
            return NextResponse.json(
                { success: false, error: 'Too many attempts. Try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
            );
        }

        const problem = passwordProblem(password);
        if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 });

        await dbConnect();
        const reset = await findLiveReset(token);
        if (!reset) return NextResponse.json({ success: false, error: DEAD_LINK }, { status: 400 });

        const user = await User.findById(reset.userId).select('+passwordHash');
        if (!user) return NextResponse.json({ success: false, error: DEAD_LINK }, { status: 400 });

        user.passwordHash = hashPassword(password);
        // A Google-first account that resets this way gains email sign-in, the
        // same as setting a password from the profile screen.
        user.providers = Array.from(new Set([...(user.providers || []), 'credentials']));
        await user.save();

        reset.usedAt = new Date();
        reset.tokenHash = undefined;
        await reset.save();

        // Anything else still pending for this account dies with it.
        await PasswordReset.deleteMany({ userId: user._id, usedAt: { $exists: false } });

        return NextResponse.json({ success: true, data: { email: user.email } });
    } catch (error) {
        console.error('[auth] password reset failed:', error);
        return NextResponse.json(
            { success: false, error: 'Could not reset your password — please try again.' },
            { status: 500 },
        );
    }
}
