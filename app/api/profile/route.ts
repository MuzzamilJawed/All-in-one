import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import User, { publicUser } from '../../models/User';
import { requireUser, fail } from '../../lib/apiAuth';
import { userStats } from '../../lib/userStats';
import { normalizePhone, phoneProblem } from '../../lib/phone';

// The signed-in user's own account — always scoped to the session, so there is
// no way to ask for someone else's profile here.
export async function GET() {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const user = await User.findById(session.uid).select('+passwordHash');
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        const stats = await userStats(session.uid);

        return NextResponse.json({
            success: true,
            data: {
                ...publicUser(user),
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt || null,
                watching: (user.universalWatch || []).length,
                hasPassword: !!user.passwordHash,
                stats,
            },
        });
    } catch (error) {
        console.error('[profile] GET failed:', error);
        return fail(error, 'Failed to load your profile');
    }
}

// Display name is the only self-editable field — email identifies the account
// (and is what Google matches on), and role is an admin decision.
export async function PATCH(request: Request) {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const body = await request.json();
        const name = String(body?.name || '').trim();
        if (!name) return NextResponse.json({ success: false, error: 'Enter your name' }, { status: 400 });
        if (name.length > 80) return NextResponse.json({ success: false, error: 'Name is too long' }, { status: 400 });

        const update: Record<string, unknown> = { name };
        // Phone is optional here — Google accounts never collected one, and a
        // user may want to clear it.
        if (body?.phone !== undefined) {
            const raw = String(body.phone || '').trim();
            if (raw) {
                const problem = phoneProblem(raw);
                if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 });
                update.phone = normalizePhone(raw);
            } else {
                update.phone = '';
            }
        }

        const user = await User.findByIdAndUpdate(session.uid, { $set: update }, { new: true });
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        return NextResponse.json({ success: true, data: publicUser(user) });
    } catch (error) {
        console.error('[profile] PATCH failed:', error);
        return fail(error, 'Failed to update your profile');
    }
}
