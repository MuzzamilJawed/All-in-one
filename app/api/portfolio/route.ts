import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../lib/mongodb';
import Transaction from '../../models/Transaction';
import { requireUser, fail } from '../../lib/apiAuth';
import { normalizeTxn } from './shape';

// The signed-in user's trade ledger. Holdings and P/L are derived client-side
// from these rows (lib/portfolio.ts) so the maths stays in one place.
export async function GET() {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const txns = await Transaction.find({ userId: session.uid }).sort({ date: -1, createdAt: -1 });
        return NextResponse.json({ success: true, data: txns });
    } catch (error) {
        console.error('[portfolio] GET failed:', error);
        return fail(error, 'Failed to load your portfolio');
    }
}

export async function POST(request: Request) {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const body = await request.json();
        const txn = normalizeTxn(body);
        if ('error' in txn) return NextResponse.json({ success: false, error: txn.error }, { status: 400 });

        const created = await Transaction.create({ ...txn, userId: session.uid });
        return NextResponse.json({ success: true, data: created });
    } catch (error) {
        console.error('[portfolio] POST failed:', error);
        return fail(error, 'Failed to record the trade');
    }
}

// Wipe the whole ledger for this user (the "reset portfolio" action).
export async function DELETE() {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        if (!mongoose.isValidObjectId(session.uid)) {
            return fail(new Error('Invalid account identifier'), 'Could not identify your account', 400);
        }
        const userId = new mongoose.Types.ObjectId(session.uid);
        const result = await Transaction.deleteMany({ userId });
        return NextResponse.json({ success: true, data: { deleted: result.deletedCount ?? 0 } });
    } catch (error) {
        console.error('[portfolio] DELETE all failed:', error);
        return fail(error, 'Failed to clear your portfolio');
    }
}
