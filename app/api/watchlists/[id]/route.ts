import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Watchlist from '../../../models/Watchlist';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await dbConnect();
    const watchlist = await Watchlist.findById(id);
    if (!watchlist) {
      return NextResponse.json({ success: false, error: 'Watchlist not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: watchlist });
  } catch (error) {
    console.error('[watchlists] GET by id failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Invalid ID' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await dbConnect();
    const body = await request.json();
    const watchlist = await Watchlist.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });
    if (!watchlist) {
      return NextResponse.json({ success: false, error: 'Watchlist not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: watchlist });
  } catch (error) {
    console.error('[watchlists] PUT failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await dbConnect();
    const deletedWatchlist = await Watchlist.deleteOne({ _id: id });
    if (!deletedWatchlist) {
      return NextResponse.json({ success: false, error: 'Watchlist not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    console.error('[watchlists] DELETE failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
