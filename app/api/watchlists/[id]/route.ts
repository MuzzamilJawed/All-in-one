import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Watchlist from '../../../models/Watchlist';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;
  try {
    const watchlist = await Watchlist.findById(id);
    if (!watchlist) {
      return NextResponse.json({ success: false, error: 'Watchlist not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: watchlist });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;
  try {
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
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;
  try {
    const deletedWatchlist = await Watchlist.deleteOne({ _id: id });
    if (!deletedWatchlist) {
      return NextResponse.json({ success: false, error: 'Watchlist not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 400 });
  }
}
