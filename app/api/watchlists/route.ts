import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import Watchlist from '../../models/Watchlist';

export async function GET() {
  try {
    await dbConnect();
    const watchlists = await Watchlist.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: watchlists });
  } catch (error) {
    console.error('[watchlists] GET failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch watchlists' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const watchlist = await Watchlist.create(body);
    return NextResponse.json({ success: true, data: watchlist });
  } catch (error) {
    console.error('[watchlists] POST failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create watchlist' },
      { status: 500 }
    );
  }
}
