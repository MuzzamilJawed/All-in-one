// Password hashing with Node's built-in scrypt — no external dependency.
// Stored format: scrypt$N$r$p$salt$key   (salt + key are base64url)

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const N = 16384;   // CPU/memory cost — ~16MB, under Node's 32MB scrypt default
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
    const salt = randomBytes(16);
    const key = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
    return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export function verifyPassword(password: string, stored?: string | null): boolean {
    if (!stored) return false;
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, salt, key] = parts;
    try {
        const expected = Buffer.from(key, 'base64url');
        const actual = scryptSync(password, Buffer.from(salt, 'base64url'), expected.length, {
            N: Number(n), r: Number(r), p: Number(p),
        });
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
        return false;
    }
}

// Shared rule so the register API and the sign-up form agree.
export function passwordProblem(password: string): string | null {
    if (!password || password.length < 8) return 'Password must be at least 8 characters.';
    if (password.length > 200) return 'Password is too long.';
    return null;
}
