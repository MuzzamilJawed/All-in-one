import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Transaction from '../../../models/Transaction';
import { requireUser, fail } from '../../../lib/apiAuth';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, response } = await requireUser();
    if (!session) return response;
    const { id } = await params;
    try {
        await dbConnect();
        const result = await Transaction.deleteOne({ _id: id, userId: session.uid });
        if (result.deletedCount === 0) {
            return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: {} });
    } catch (error) {
        console.error('[portfolio] DELETE failed:', error);
        return fail(error, 'Failed to delete the trade');
    }
}
