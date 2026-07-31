import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import User, { publicUser } from '../../../models/User';
import { hashPassword, passwordProblem } from '../../../lib/password';
import { normalizePhone, phoneProblem } from '../../../lib/phone';
import { createSessionToken, attachSession } from '../../../lib/session';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const name = String(body?.name || '').trim();
        const email = String(body?.email || '').trim().toLowerCase();
        const phone = normalizePhone(body?.phone);
        const password = String(body?.password || '');

        if (!name) return NextResponse.json({ success: false, error: 'Enter your name' }, { status: 400 });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ success: false, error: 'Enter a valid email address' }, { status: 400 });
        }
        const phoneErr = phoneProblem(String(body?.phone || ''));
        if (phoneErr) return NextResponse.json({ success: false, error: phoneErr }, { status: 400 });
        const pwErr = passwordProblem(password);
        if (pwErr) return NextResponse.json({ success: false, error: pwErr }, { status: 400 });

        const existing = await User.findOne({ email }).select('+passwordHash');
        if (existing) {
            // A Google-first account can claim a password instead of being told
            // "already registered" with no way forward.
            if (!existing.passwordHash) {
                existing.passwordHash = hashPassword(password);
                if (phone) existing.phone = phone;   // Google sign-up never collected one
                existing.providers = Array.from(new Set([...(existing.providers || []), 'credentials']));
                existing.lastLoginAt = new Date();
                await existing.save();
                const res = NextResponse.json({ success: true, data: publicUser(existing) });
                return attachSession(res, createSessionToken(String(existing._id), existing.role));
            }
            return NextResponse.json(
                { success: false, error: 'An account with this email already exists — sign in instead.' },
                { status: 409 },
            );
        }

        const user = await User.create({
            name,
            email,
            phone,
            passwordHash: hashPassword(password),
            providers: ['credentials'],
            role: 'user',
            universalWatch: [],
            lastLoginAt: new Date(),
        });

        const res = NextResponse.json({ success: true, data: publicUser(user) });
        return attachSession(res, createSessionToken(String(user._id), user.role));
    } catch (error) {
        console.error('[auth] register failed:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Could not create your account' },
            { status: 500 },
        );
    }
}
