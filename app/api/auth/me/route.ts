import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import User, { publicUser } from '../../../models/User';
import { getSession, clearSession } from '../../../lib/session';
import { googleClientId } from '../../../lib/google';

// Always 200 — "not signed in" is a normal answer here, not an error. It also
// hands back the Google client ID (public by design) so the login page can
// render the Google button without a second env var on the client, and hide it
// when sign-in isn't configured.
export async function GET() {
    const config = { googleClientId: googleClientId() };
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ success: true, data: null, config });

        await dbConnect();
        const user = await User.findById(session.uid);
        // Session for a deleted user — drop the stale cookie.
        if (!user) return clearSession(NextResponse.json({ success: true, data: null, config }));

        return NextResponse.json({ success: true, data: publicUser(user), config });
    } catch (error) {
        console.error('[auth] me failed:', error);
        return NextResponse.json({ success: true, data: null, config });
    }
}
