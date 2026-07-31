import { NextResponse } from 'next/server';
import { SEED_ADMIN_EMAIL } from '../../../lib/seed';

// Dev-only helper: hands the local seed credentials to the sign-in screen so the
// form can be filled in one click.
//
// This route 404s in a production build, so the password is never served from a
// deployed environment and never ends up in the client bundle — the browser only
// ever learns it by asking this endpoint, which only answers locally.

export const dynamic = 'force-dynamic';

interface DevAccount {
    label: string;
    email: string;
    password: string;
    role?: string;
}

/** Optional extras: DEV_LOGIN_ACCOUNTS="Trader:trader@x.dev:pass123,QA:qa@x.dev:pass123" */
function extraAccounts(): DevAccount[] {
    const raw = process.env.DEV_LOGIN_ACCOUNTS;
    if (!raw) return [];
    return raw.split(',').flatMap((entry) => {
        const [label, email, password] = entry.split(':').map((s) => s?.trim());
        if (!email || !password) return [];
        return [{ label: label || email, email, password }];
    });
}

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const accounts: DevAccount[] = [
        {
            label: process.env.SEED_ADMIN_NAME || 'Administrator',
            email: SEED_ADMIN_EMAIL,
            password: process.env.SEED_ADMIN_PASSWORD || 'admin12345',
            role: 'admin',
        },
        ...extraAccounts(),
    ];

    return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'no-store' } });
}
