import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Transaction from '../../../models/Transaction';
import { requireUser, fail } from '../../../lib/apiAuth';
import { normalizeTxn } from '../shape';

const MAX_IMPORT = 5000;

// Bulk insert — used once, when a browser that still holds the old
// localStorage ledger signs in for the first time. Malformed rows are skipped
// rather than failing the whole import.
export async function POST(request: Request) {
    const { session, response } = await requireUser();
    if (!session) return response;
    try {
        await dbConnect();
        const body = await request.json();
        const rows = Array.isArray(body?.txns) ? body.txns.slice(0, MAX_IMPORT) : [];

        const docs = rows
            .map(normalizeTxn)
            .filter((t: any) => !('error' in t))
            .map((t: any) => ({ ...t, userId: session.uid }));

        if (docs.length === 0) return NextResponse.json({ success: true, data: { imported: 0, skipped: rows.length } });

        await Transaction.insertMany(docs);
        return NextResponse.json({
            success: true,
            data: { imported: docs.length, skipped: rows.length - docs.length },
        });
    } catch (error) {
        console.error('[portfolio] import failed:', error);
        return fail(error, 'Failed to import your trades');
    }
}
