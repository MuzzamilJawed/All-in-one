import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import Watchlist, { WATCHLIST_TYPES } from '../../models/Watchlist';
import { requireUser, fail } from '../../lib/apiAuth';

export async function GET() {
  const { session, response } = await requireUser();
  if (!session) return response;
  try {
    await dbConnect();
    const watchlists = await Watchlist.find({ userId: session.uid }).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: watchlists });
  } catch (error) {
    console.error('[watchlists] GET failed:', error);
    return fail(error, 'Failed to fetch watchlists');
  }
}

export async function POST(request: Request) {
  const { session, response } = await requireUser();
  if (!session) return response;
  try {
    await dbConnect();
    const body = await request.json();
    // Only the fields we own are taken from the body — `userId` always comes
    // from the session so a client can't create a list for someone else.
    const watchlist = await Watchlist.create({
      userId: session.uid,
      name: String(body?.name || '').trim(),
      type: WATCHLIST_TYPES.includes(body?.type) ? body.type : 'PSX',
      symbols: Array.isArray(body?.symbols) ? body.symbols.map(String) : [],
    });
    return NextResponse.json({ success: true, data: watchlist });
  } catch (error) {
    console.error('[watchlists] POST failed:', error);
    return fail(error, 'Failed to create watchlist');
  }
}
