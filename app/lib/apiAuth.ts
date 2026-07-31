// Route-handler guard: every user-scoped API starts with `requireUser()` and
// bails out with 401 when there is no valid session cookie.

import { NextResponse } from 'next/server';
import { getSession, type SessionPayload } from './session';
import dbConnect from './mongodb';
import User from '../models/User';

export const unauthorized = () =>
    NextResponse.json({ success: false, error: 'Sign in to continue' }, { status: 401 });

export async function requireUser(): Promise<
    { session: SessionPayload; response: null } | { session: null; response: NextResponse }
> {
    const session = await getSession();
    if (!session) return { session: null, response: unauthorized() };
    return { session, response: null };
}

const forbidden = () =>
    NextResponse.json({ success: false, error: 'Administrator access required' }, { status: 403 });

/**
 * Same as requireUser, but 403s anyone who isn't an admin. The role is re-read
 * from the database rather than trusted from the cookie — otherwise a user
 * demoted mid-session would keep admin powers until their cookie expired.
 */
export async function requireAdmin(): Promise<
    { session: SessionPayload; response: null } | { session: null; response: NextResponse }
> {
    const session = await getSession();
    if (!session) return { session: null, response: unauthorized() };

    await dbConnect();
    const user = await User.findById(session.uid).select('role');
    if (!user || user.role !== 'admin') return { session: null, response: forbidden() };

    return { session, response: null };
}

export const fail = (error: unknown, fallback: string, status = 500) =>
    NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : fallback },
        { status },
    );
