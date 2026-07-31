import mongoose from 'mongoose';
import { registerModel } from '../lib/registerModel';
import type { AssetType } from '../lib/prices';

// One BUY/SELL entry in a user's portfolio ledger. Holdings and P/L are derived
// from these rows (average cost) rather than stored — see lib/portfolio.ts.
export interface ITransaction extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    date: string;              // YYYY-MM-DD
    type: 'BUY' | 'SELL';
    assetType: AssetType;
    symbol: string;
    name?: string;
    quantity: number;
    price: number;             // per unit, in `currency`
    currency: 'PKR' | 'USD';
    note?: string;
    createdAt: Date;
    updatedAt: Date;
}

const TransactionSchema = new mongoose.Schema<ITransaction>({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    date: {
        type: String,
        required: true,
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    type: { type: String, enum: ['BUY', 'SELL'], required: true },
    assetType: {
        type: String,
        enum: ['PSX', 'NASDAQ', 'CRYPTO', 'FOREX', 'COMMODITY'],
        required: true,
    },
    symbol: { type: String, required: true, uppercase: true, trim: true, maxlength: 30 },
    name: { type: String, maxlength: 120 },
    quantity: { type: Number, required: true, min: [0, 'Quantity must be positive'] },
    price: { type: Number, required: true, min: [0, 'Price must be positive'] },
    currency: { type: String, enum: ['PKR', 'USD'], required: true },
    note: { type: String, maxlength: 300 },
}, {
    timestamps: true,
});

TransactionSchema.index({ userId: 1, date: -1 });

export default registerModel<ITransaction>('Transaction', TransactionSchema);
