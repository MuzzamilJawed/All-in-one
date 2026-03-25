import mongoose from 'mongoose';

export interface IWatchlist extends mongoose.Document {
  name: string;
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
  symbols: [{
    type: String,
    uppercase: true,
  }],
}, {
  timestamps: true,
});

export default mongoose.models.Watchlist || mongoose.model<IWatchlist>('Watchlist', WatchlistSchema);
