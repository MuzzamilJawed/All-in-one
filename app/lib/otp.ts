// One-time codes and reset-link tokens for the forgot-password flow.
//
// Nothing replayable is stored in plain text: the database only ever holds an
// HMAC of the code and of the link token, so a leaked collection can't be used
// to take an account over. Same `crypto`-only approach as password.ts and
// session.ts — no new dependency.

import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

const SECRET = process.env.AUTH_SECRET || 'solo-trackr-insecure-dev-secret';

export const OTP_LENGTH = 6;
/** How long the emailed/texted code stays valid. */
export const OTP_TTL_MINUTES = 10;
/** How long the reset link minted from a verified code stays valid. */
export const TOKEN_TTL_MINUTES = 15;
/** Wrong codes tolerated before the request is burned — stops code guessing. */
export const MAX_OTP_ATTEMPTS = 5;

/** A zero-padded numeric code. `randomInt` is the CSPRNG, not `Math.random`. */
export const generateOtp = (): string =>
    String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

/** 256 bits of entropy — the reset link's only secret. */
export const generateToken = (): string => randomBytes(32).toString('base64url');

export const digest = (value: string): string =>
    createHmac('sha256', SECRET).update(value).digest('base64url');

/** Constant-time compare of a presented code/token against its stored HMAC. */
export function digestMatches(value: string, stored?: string | null): boolean {
    if (!value || !stored) return false;
    const expected = Buffer.from(stored);
    const actual = Buffer.from(digest(value));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** `ja***ir@gmail.com` — enough to recognise your own address, not to harvest. */
export function maskEmail(email: string): string {
    const value = String(email || '').trim();
    const at = value.lastIndexOf('@');
    if (at < 1) return value;
    const local = value.slice(0, at);
    const domain = value.slice(at);
    if (local.length <= 2) return `${local[0]}***${domain}`;
    return `${local.slice(0, 2)}${'*'.repeat(Math.min(4, local.length - 2))}${local.slice(-1)}${domain}`;
}

