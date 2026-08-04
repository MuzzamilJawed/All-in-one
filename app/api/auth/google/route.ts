import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import User, { publicUser, isDuplicateEmailError } from '../../../models/User';
import { verifyGoogleIdToken } from '../../../lib/google';
import { createSessionToken, attachSession } from '../../../lib/session';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const credential = String(body?.credential || '');
        const profile = await verifyGoogleIdToken(credential);

        await dbConnect();

        // Addresses are stored lowercase, so match on the lowercase form —
        // querying the raw one would miss the account and then collide with the
        // unique index on insert.
        const email = String(profile.email || '').trim().toLowerCase();

        // Match on the Google subject first, then fall back to the (verified)
        // email so a password account and its Google sign-in stay one user.
        let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email }] });

        if (!user) {
            try {
                user = await User.create({
                    name: profile.name,
                    email,
                    image: profile.picture,
                    googleId: profile.sub,
                    providers: ['google'],
                    role: 'user',
                    universalWatch: [],
                });
            } catch (error) {
                // Two first-time sign-ins for one address can race past the
                // lookup above. The index rejects the loser, which then adopts
                // the account the winner created rather than failing a sign-in
                // that should have worked.
                if (!isDuplicateEmailError(error)) throw error;
                user = await User.findOne({ email });
                if (!user) throw error;
            }
        }

        // Links Google to an existing account, and is a no-op re-save for one
        // just created above.
        user.googleId = profile.sub;
        if (!user.image && profile.picture) user.image = profile.picture;
        user.providers = Array.from(new Set([...(user.providers || []), 'google']));
        user.lastLoginAt = new Date();
        await user.save();

        const res = NextResponse.json({ success: true, data: publicUser(user) });
        return attachSession(res, createSessionToken(String(user._id), user.role));
    } catch (error) {
        console.error('[auth] google sign-in failed:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Google sign-in failed' },
            { status: 401 },
        );
    }
}
