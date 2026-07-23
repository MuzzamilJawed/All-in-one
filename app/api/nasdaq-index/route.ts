import { NextResponse } from 'next/server';

// NASDAQ Composite (^IXIC) — the headline NASDAQ stock index. Real level + 24h
// change from Yahoo, cached.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function GET() {
    try {
        const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EIXIC?interval=1d&range=5d', {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            next: { revalidate: 120 },
        });
        if (!r.ok) throw new Error(`provider ${r.status}`);
        const j = await r.json();
        const meta = j?.chart?.result?.[0]?.meta || {};
        const value = meta.regularMarketPrice ?? null;
        const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
        const changePercent = (value != null && prev) ? ((value - prev) / prev) * 100 : null;
        return NextResponse.json({ success: true, symbol: 'IXIC', name: 'NASDAQ', value, changePercent });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'fetch failed', value: null }, { status: 500 });
    }
}
