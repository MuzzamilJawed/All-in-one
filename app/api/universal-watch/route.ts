import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import User from '../../models/User';
import { requireUser, fail } from '../../lib/apiAuth';

// The dashboard's cross-market "watch any asset" list. It's small and always
// read as a whole, so it lives as an array on the user document.
const ASSET_TYPES = ['PSX', 'NASDAQ', 'CRYPTO', 'FOREX', 'COMMODITY'];
const MAX_ITEMS = 200;

const parseItem = (raw: any) => {
    const assetType = String(raw?.assetType || '');
    const symbol = String(raw?.symbol || '').trim().toUpperCase();
    if (!ASSET_TYPES.includes(assetType) || !symbol) return null;
    return { assetType, symbol };
};

export async function GET() {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const user = await User.findById(session.uid).select('universalWatch');
        return NextResponse.json({ success: true, data: user?.universalWatch || [] });
    } catch (error) {
        console.error('[universal-watch] GET failed:', error);
        return fail(error, 'Failed to load your watch list');
    }
}

export async function POST(request: Request) {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const item = parseItem(await request.json());
        if (!item) return NextResponse.json({ success: false, error: 'Invalid symbol' }, { status: 400 });

        const user = await User.findById(session.uid).select('universalWatch');
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        if ((user.universalWatch?.length || 0) >= MAX_ITEMS) {
            return NextResponse.json({ success: false, error: `You can watch at most ${MAX_ITEMS} assets` }, { status: 400 });
        }

        // $addToSet keeps this idempotent when the same symbol is added twice.
        const updated = await User.findByIdAndUpdate(
            session.uid,
            { $addToSet: { universalWatch: item } },
            { new: true, select: 'universalWatch' },
        );
        return NextResponse.json({ success: true, data: updated?.universalWatch || [] });
    } catch (error) {
        console.error('[universal-watch] POST failed:', error);
        return fail(error, 'Failed to add to your watch list');
    }
}

export async function DELETE(request: Request) {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const item = parseItem({
            assetType: searchParams.get('assetType'),
            symbol: searchParams.get('symbol'),
        });
        if (!item) return NextResponse.json({ success: false, error: 'Invalid symbol' }, { status: 400 });

        const updated = await User.findByIdAndUpdate(
            session.uid,
            { $pull: { universalWatch: item } },
            { new: true, select: 'universalWatch' },
        );
        return NextResponse.json({ success: true, data: updated?.universalWatch || [] });
    } catch (error) {
        console.error('[universal-watch] DELETE failed:', error);
        return fail(error, 'Failed to remove from your watch list');
    }
}

// Replace the whole list — used by the one-off localStorage migration.
export async function PUT(request: Request) {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const body = await request.json();
        const items = (Array.isArray(body?.items) ? body.items : [])
            .map(parseItem)
            .filter(Boolean)
            .slice(0, MAX_ITEMS);

        const updated = await User.findByIdAndUpdate(
            session.uid,
            { $set: { universalWatch: items } },
            { new: true, select: 'universalWatch' },
        );
        return NextResponse.json({ success: true, data: updated?.universalWatch || [] });
    } catch (error) {
        console.error('[universal-watch] PUT failed:', error);
        return fail(error, 'Failed to save your watch list');
    }
}
