import { NextResponse } from 'next/server';

// Lightweight full USD-based rate map for the currency converter (all codes, no
// per-symbol Yahoo lookups — just the fast rates feed, cached).

export async function GET() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 120 } });
        if (!res.ok) throw new Error('rates fetch failed');
        const data = await res.json();
        return NextResponse.json({ success: true, rates: data.rates || {}, updated: data.time_last_update_utc || null });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'fetch failed', rates: {} }, { status: 500 });
    }
}
