import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';
import { requireUser, fail } from '../../../lib/apiAuth';
import { hashPassword, verifyPassword, passwordProblem } from '../../../lib/password';

// Change (or, for a Google-only account, set for the first time) the password
// on the signed-in user's own account.
export async function POST(request: Request) {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const body = await request.json();
        const currentPassword = String(body?.currentPassword || '');
        const newPassword = String(body?.newPassword || '');

        const problem = passwordProblem(newPassword);
        if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 });

        const user = await User.findById(session.uid).select('+passwordHash');
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        // Accounts that already have a password must prove the old one. A
        // Google-only account has none to prove, so it can set one directly.
        if (user.passwordHash && !verifyPassword(currentPassword, user.passwordHash)) {
            return NextResponse.json(
                { success: false, error: 'Your current password is incorrect' },
                { status: 400 },
            );
        }

        user.passwordHash = hashPassword(newPassword);
        user.providers = Array.from(new Set([...(user.providers || []), 'credentials']));
        await user.save();

        return NextResponse.json({ success: true, data: { hasPassword: true } });
    } catch (error) {
        console.error('[profile] password change failed:', error);
        return fail(error, 'Failed to change your password');
    }
}
