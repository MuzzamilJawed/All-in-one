import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import User, { publicUser } from '../../../models/User';
import { verifyGoogleIdToken } from '../../../lib/google';
import { createSessionToken, attachSession } from '../../../lib/session';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const credential = String(body?.credential || '');
        const profile = await verifyGoogleIdToken(credential);

        await dbConnect();

        // Match on the Google subject first, then fall back to the (verified)
        // email so a password account and its Google sign-in stay one user.
        let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email: profile.email }] });

        if (!user) {
            user = await User.create({
                name: profile.name,
                email: profile.email,
                image: profile.picture,
                googleId: profile.sub,
                providers: ['google'],
                role: 'user',
                universalWatch: [],
                lastLoginAt: new Date(),
            });
        } else {
            user.googleId = profile.sub;
            if (!user.image && profile.picture) user.image = profile.picture;
            user.providers = Array.from(new Set([...(user.providers || []), 'google']));
            user.lastLoginAt = new Date();
            await user.save();
        }

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
