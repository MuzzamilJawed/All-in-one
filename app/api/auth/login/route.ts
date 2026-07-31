import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import User, { publicUser } from '../../../models/User';
import { verifyPassword } from '../../../lib/password';
import { createSessionToken, attachSession } from '../../../lib/session';

// Same message for "no such user" and "wrong password" — don't leak which
// emails have accounts.
const BAD_CREDENTIALS = 'Email or password is incorrect';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');

        if (!email || !password) {
            return NextResponse.json({ success: false, error: 'Enter your email and password' }, { status: 400 });
        }

        const user = await User.findOne({ email }).select('+passwordHash');
        if (!user || !verifyPassword(password, user.passwordHash)) {
            return NextResponse.json({ success: false, error: BAD_CREDENTIALS }, { status: 401 });
        }

        user.lastLoginAt = new Date();
        await user.save();

        const res = NextResponse.json({ success: true, data: publicUser(user) });
        return attachSession(res, createSessionToken(String(user._id), user.role));
    } catch (error) {
        console.error('[auth] login failed:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Sign-in failed' },
            { status: 500 },
        );
    }
}
