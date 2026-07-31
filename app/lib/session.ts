// Stateless session cookie: base64url(payload).HMAC-SHA256(payload).
// Server-only — imports `next/headers`, so never pull this into a client file.

import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'st_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const SECRET = process.env.AUTH_SECRET || 'solo-trackr-insecure-dev-secret';
if (!process.env.AUTH_SECRET) {
    console.warn('[auth] AUTH_SECRET is not set — falling back to a development secret. Set it before deploying.');
}

export type UserRole = 'admin' | 'user';

export interface SessionPayload {
    uid: string;
    role: UserRole;
    exp: number; // unix seconds
}

const sign = (body: string) => createHmac('sha256', SECRET).update(body).digest('base64url');

export function createSessionToken(uid: string, role: UserRole): string {
    const payload: SessionPayload = {
        uid,
        role,
        exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string | undefined | null): SessionPayload | null {
    if (!token) return null;
    const dot = token.lastIndexOf('.');
    if (dot < 1) return null;
    const body = token.slice(0, dot);
    const mac = token.slice(dot + 1);
    try {
        const expected = Buffer.from(sign(body));
        const actual = Buffer.from(mac);
        if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
        if (!payload?.uid || typeof payload.exp !== 'number') return null;
        if (payload.exp * 1000 < Date.now()) return null;
        return { uid: payload.uid, role: payload.role === 'admin' ? 'admin' : 'user', exp: payload.exp };
    } catch {
        return null;
    }
}

/** The signed-in session for the current request, or null. */
export async function getSession(): Promise<SessionPayload | null> {
    const jar = await cookies();
    return readSessionToken(jar.get(SESSION_COOKIE)?.value);
}

// Plain-HTTP LAN dev (the Capacitor shell) needs a non-secure cookie even in a
// production build — COOKIE_SECURE=false opts out.
const secureCookie = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';

export function attachSession(res: NextResponse, token: string): NextResponse {
    res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookie,
        path: '/',
        maxAge: MAX_AGE_SECONDS,
    });
    return res;
}

export function clearSession(res: NextResponse): NextResponse {
    res.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookie,
        path: '/',
        maxAge: 0,
    });
    return res;
}
