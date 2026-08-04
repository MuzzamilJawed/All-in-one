import mongoose from 'mongoose';
import { registerModel } from '../lib/registerModel';

/**
 * One forgot-password attempt, from "send me a code" through to "password
 * changed". Two secrets pass through it and neither is stored readable:
 * `codeHash` is the HMAC of the six-digit code, `tokenHash` the HMAC of the
 * reset link's token (minted only once the code has been verified).
 *
 * `expiresAt` carries a TTL index, so finished and abandoned attempts drop out
 * of the collection on their own.
 */
export interface IPasswordReset extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    /** Opaque public handle — what the browser holds between the two steps. */
    requestId: string;
    /** The email address the code was actually sent to. */
    destination: string;
    codeHash?: string;
    codeExpiresAt: Date;
    attempts: number;
    verifiedAt?: Date;
    tokenHash?: string;
    tokenExpiresAt?: Date;
    usedAt?: Date;
    /** TTL anchor — the row is removed once this passes. */
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PasswordResetSchema = new mongoose.Schema<IPasswordReset>({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestId: { type: String, required: true, unique: true, index: true },
    destination: { type: String, required: true },
    codeHash: { type: String },
    codeExpiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date },
    tokenHash: { type: String, index: true, sparse: true },
    tokenExpiresAt: { type: Date },
    usedAt: { type: Date },
    expiresAt: { type: Date, required: true, expires: 0 },
}, {
    timestamps: true,
});

export default registerModel<IPasswordReset>('PasswordReset', PasswordResetSchema);
