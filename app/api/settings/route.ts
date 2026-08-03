import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import User from '../../models/User';
import { requireUser, fail } from '../../lib/apiAuth';
import { normalizeSettings } from '../../lib/settingsShape';

// Per-user app preferences. `hasSaved` tells the client whether this account has
// ever stored settings — if not, the browser's existing localStorage values get
// promoted on first load rather than being overwritten by defaults.
export async function GET() {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const user = await User.findById(session.uid).select('settings').lean() as { settings?: unknown } | null;
        const stored = user?.settings;
        return NextResponse.json({
            success: true,
            data: stored ? normalizeSettings(stored) : null,
            hasSaved: !!stored,
        });
    } catch (error) {
        console.error('[settings] GET failed:', error);
        return fail(error, 'Failed to load your settings');
    }
}

export async function PUT(request: Request) {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        // Normalising here means a malformed or hostile body can't persist a
        // refresh interval of 0.001s or an unknown module key.
        const settings = normalizeSettings(await request.json());

        const user = await User.findByIdAndUpdate(
            session.uid,
            { $set: { settings } },
            { new: true, select: 'settings' },
        );
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        return NextResponse.json({ success: true, data: normalizeSettings(user.settings) });
    } catch (error) {
        console.error('[settings] PUT failed:', error);
        return fail(error, 'Failed to save your settings');
    }
}
