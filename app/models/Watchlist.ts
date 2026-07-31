import mongoose from 'mongoose';
import { registerModel } from '../lib/registerModel';

// A watchlist holds a single asset class. `type` is locked to the first symbol's
// market (or chosen at creation) so every item in a list is the same kind.
export type WatchlistType = 'PSX' | 'NASDAQ' | 'CRYPTO' | 'FOREX' | 'COMMODITY';
export const WATCHLIST_TYPES: WatchlistType[] = ['PSX', 'NASDAQ', 'CRYPTO', 'FOREX', 'COMMODITY'];

export interface IWatchlist extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  type: WatchlistType;
  symbols: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WatchlistSchema = new mongoose.Schema<IWatchlist>({
  // Watchlists are private to their owner. Lists created before accounts
  // existed are adopted by the seeded admin on first connect (see lib/seed.ts).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
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

export default registerModel<IWatchlist>('Watchlist', WatchlistSchema);
