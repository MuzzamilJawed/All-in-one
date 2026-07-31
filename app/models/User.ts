import mongoose from 'mongoose';
import { registerModel } from '../lib/registerModel';
import type { AssetType } from '../lib/prices';

export type UserRole = 'admin' | 'user';
export type AuthProvider = 'credentials' | 'google';

export interface IUser extends mongoose.Document {
    email: string;
    name: string;
    /** Collected at sign-up. Absent on Google accounts — Google never asks. */
    phone?: string;
    image?: string;
    passwordHash?: string;      // absent for Google-only accounts
    googleId?: string;
    role: UserRole;
    providers: AuthProvider[];
    // The dashboard's "watch any asset" list lives on the user so it follows
    // them across devices, same as their watchlist categories and ledger.
    universalWatch: { assetType: AssetType; symbol: string }[];
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
    email: {
        type: String,
        required: [true, 'Email is required.'],
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, 'Name is required.'],
        trim: true,
        maxlength: [80, 'Name cannot be more than 80 characters'],
    },
    phone: { type: String, trim: true, maxlength: [24, 'Phone number cannot be more than 24 characters'] },
    image: { type: String },
    passwordHash: { type: String, select: false },
    googleId: { type: String, index: true, sparse: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    providers: [{ type: String, enum: ['credentials', 'google'] }],
    universalWatch: [{
        _id: false,
        assetType: { type: String, enum: ['PSX', 'NASDAQ', 'CRYPTO', 'FOREX', 'COMMODITY'], required: true },
        symbol: { type: String, uppercase: true, required: true },
    }],
    lastLoginAt: { type: Date },
}, {
    timestamps: true,
});

// Shape sent to the browser — never includes passwordHash.
export const publicUser = (u: IUser) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    phone: u.phone || null,
    image: u.image || null,
    role: u.role,
    providers: u.providers || [],
});

export default registerModel<IUser>('User', UserSchema);
