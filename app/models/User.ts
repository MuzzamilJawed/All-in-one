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
    /** App preferences — currency, refresh interval, visible modules. Stored
     *  per user so they follow the account rather than the browser. */
    settings?: Record<string, unknown>;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
    // One account per address, enforced by the database rather than by a
    // check-then-insert that two concurrent sign-ups could both pass.
    // `lowercase` is what makes it case-insensitive: Foo@x.com is stored — and
    // therefore indexed — as foo@x.com. (`unique` already builds the index, so
    // adding `index: true` here would only declare it twice.)
    email: {
        type: String,
        required: [true, 'Email is required.'],
        unique: true,
        lowercase: true,
        trim: true,
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
    // Free-form on purpose: the API normalises this against the Settings shape
    // on the way in and out, so adding a preference needs no migration.
    settings: { type: mongoose.Schema.Types.Mixed, default: undefined },
    lastLoginAt: { type: Date },
}, {
    timestamps: true,
});

/** The one message every path uses when an address is already spoken for. */
export const EMAIL_TAKEN = 'An account with this email already exists — sign in instead.';

/**
 * True for the duplicate-key error the unique index raises when two writes race
 * past a "does this email exist?" lookup and both try to insert it. Catching it
 * is what turns a 500 with a raw Mongo string into something a form can show.
 */
export const isDuplicateEmailError = (error: unknown): boolean => {
    const err = error as { code?: number; keyPattern?: Record<string, unknown> } | null;
    return err?.code === 11000 && (!err.keyPattern || 'email' in err.keyPattern);
};

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
