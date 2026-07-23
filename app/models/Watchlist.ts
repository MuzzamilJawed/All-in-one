import mongoose from 'mongoose';

// A watchlist holds a single asset class. `type` is locked to the first symbol's
// market (or chosen at creation) so every item in a list is the same kind.
export type WatchlistType = 'PSX' | 'NASDAQ' | 'CRYPTO' | 'FOREX' | 'COMMODITY';
export const WATCHLIST_TYPES: WatchlistType[] = ['PSX', 'NASDAQ', 'CRYPTO', 'FOREX', 'COMMODITY'];

export interface IWatchlist extends mongoose.Document {
  name: string;
  type: WatchlistType;
  symbols: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WatchlistSchema = new mongoose.Schema<IWatchlist>({
  name: {
    type: String,
    required: [true, 'Please provide a name for this watchlist.'],
    maxlength: [60, 'Name cannot be more than 60 characters'],
  },
  // Legacy watchlists created before typing default to PSX.
  type: {
    type: String,
    enum: WATCHLIST_TYPES,
    default: 'PSX',
  },
  symbols: [{
    type: String,
    uppercase: true,
  }],
}, {
  timestamps: true,
});

export default mongoose.models.Watchlist || mongoose.model<IWatchlist>('Watchlist', WatchlistSchema);
