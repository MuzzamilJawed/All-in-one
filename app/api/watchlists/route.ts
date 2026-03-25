import { NextResponse } from 'next/server';
import dbConnect from '../../lib/mongodb';
import Watchlist from '../../models/Watchlist';

export async function GET() {
  await dbConnect();
  try {
    const watchlists = await Watchlist.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: watchlists });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch watchlists' }, { status: 400 });
  }
}

export async function POST(request: Request) {
  await dbConnect();
  try {
    const body = await request.json();
    const watchlist = await Watchlist.create(body);
    return NextResponse.json({ success: true, data: watchlist });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create watchlist' }, { status: 400 });
  }
}
