import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import User, { publicUser } from '../../../models/User';
import { requireUser, fail } from '../../../lib/apiAuth';
import { verifyGoogleIdToken } from '../../../lib/google';

// Attach a Google account to the signed-in user, so they can then sign in
// either way. Linking never changes the account's email — that stays the
// identity it was created with.
export async function POST(request: Request) {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        const body = await request.json();
        const profile = await verifyGoogleIdToken(String(body?.credential || ''));

        await dbConnect();

        // Refuse if this Google identity (or its email) already belongs to a
        // different account — otherwise two users could share one sign-in.
        const clash = await User.findOne({
            _id: { $ne: session.uid },
            $or: [{ googleId: profile.sub }, { email: profile.email }],
        });
        if (clash) {
            return NextResponse.json(
                { success: false, error: 'That Google account is already linked to another SoloTrackr account.' },
                { status: 409 },
            );
        }

        const user = await User.findById(session.uid);
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        user.googleId = profile.sub;
        if (!user.image && profile.picture) user.image = profile.picture;
        user.providers = Array.from(new Set([...(user.providers || []), 'google']));
        await user.save();

        return NextResponse.json({ success: true, data: publicUser(user) });
    } catch (error) {
        console.error('[profile] link google failed:', error);
        return fail(error, 'Could not link your Google account', 400);
    }
}

// Unlink — refused when it would leave the account with no way to sign in.
export async function DELETE() {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const user = await User.findById(session.uid).select('+passwordHash');
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        if (!user.passwordHash) {
            return NextResponse.json(
                { success: false, error: 'Set a password first — otherwise you would have no way to sign in.' },
                { status: 400 },
            );
        }

        user.googleId = undefined;
        user.providers = (user.providers || []).filter(p => p !== 'google');
        await user.save();

        return NextResponse.json({ success: true, data: publicUser(user) });
    } catch (error) {
        console.error('[profile] unlink google failed:', error);
        return fail(error, 'Could not unlink your Google account');
    }
}
