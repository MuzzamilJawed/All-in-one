import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Watchlist, { WATCHLIST_TYPES } from '../../../models/Watchlist';
import { requireUser, fail } from '../../../lib/apiAuth';

const notFound = () =>
  NextResponse.json({ success: false, error: 'Watchlist not found' }, { status: 404 });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireUser();
  if (!session) return response;
  const { id } = await params;
  try {
    await dbConnect();
    // Scoping every query by userId is what turns another user's id into a 404.
    const watchlist = await Watchlist.findOne({ _id: id, userId: session.uid });
    if (!watchlist) return notFound();
    return NextResponse.json({ success: true, data: watchlist });
  } catch (error) {
    console.error('[watchlists] GET by id failed:', error);
    return fail(error, 'Invalid ID');
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireUser();
  if (!session) return response;
  const { id } = await params;
  try {
    await dbConnect();
    const body = await request.json();

    const update: Record<string, unknown> = {};
    if (typeof body?.name === 'string') update.name = body.name.trim();
    if (WATCHLIST_TYPES.includes(body?.type)) update.type = body.type;
    if (Array.isArray(body?.symbols)) update.symbols = body.symbols.map(String);

    const watchlist = await Watchlist.findOneAndUpdate(
      { _id: id, userId: session.uid },
      update,
      { new: true, runValidators: true },
    );
    if (!watchlist) return notFound();
    return NextResponse.json({ success: true, data: watchlist });
  } catch (error) {
    console.error('[watchlists] PUT failed:', error);
    return fail(error, 'Update failed');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireUser();
  if (!session) return response;
  const { id } = await params;
  try {
    await dbConnect();
    const result = await Watchlist.deleteOne({ _id: id, userId: session.uid });
    if (result.deletedCount === 0) return notFound();
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    console.error('[watchlists] DELETE failed:', error);
    return fail(error, 'Delete failed');
  }
}
