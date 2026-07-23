import { NextResponse } from 'next/server';

// Paginated full currency list for the Forex terminal's infinite-scroll list.
// Prices come from the same free USD-rates feed; names via Intl.DisplayNames;
// real 24h change is fetched from Yahoo only for the requested page's codes.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Most-used currencies surface first; the rest follow alphabetically.
const PRIORITY = [
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SAR', 'AED', 'INR',
    'HKD', 'SGD', 'NZD', 'SEK', 'NOK', 'DKK', 'TRY', 'ZAR', 'KRW', 'MYR', 'THB',
    'IDR', 'QAR', 'KWD', 'BHD', 'OMR', 'RUB', 'BRL', 'MXN', 'PKR',
];

let displayNames: Intl.DisplayNames | null = null;
const currencyName = (code: string): string => {
    try {
        if (!displayNames) displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
        return displayNames.of(code) || code;
    } catch {
        return code;
    }
};

async function yahooChange(codes: string[]): Promise<Record<string, number | null>> {
    const out: Record<string, number | null> = {};
    await Promise.all(codes.map(async (code) => {
        try {
            const sym = code === 'USD' ? 'PKR=X' : `${code}USD=X`;
            const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`, {
                headers: { 'User-Agent': UA, 'Accept': 'application/json' },
                next: { revalidate: 300 },
            });
            if (!r.ok) { out[code] = null; return; }
            const j = await r.json();
            const meta = j?.chart?.result?.[0]?.meta || {};
            const price = meta.regularMarketPrice ?? null;
            const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
            out[code] = (price != null && prev) ? ((price - prev) / prev) * 100 : null;
        } catch {
            out[code] = null;
        }
    }));
    return out;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '24', 10)));

    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 120 } });
        if (!res.ok) throw new Error('rates fetch failed');
        const data = await res.json();
        const rates: Record<string, number> = data.rates || {};
        const pkrRate = rates.PKR || 280;

        // Ordered list of codes: priority first, then the rest alphabetically.
        const all = Object.keys(rates).filter(c => rates[c] > 0);
        const prioritySet = new Set(PRIORITY);
        const ordered = [
            ...PRIORITY.filter(c => rates[c] > 0),
            ...all.filter(c => !prioritySet.has(c)).sort(),
        ];

        const total = ordered.length;
        const start = (page - 1) * perPage;
        const slice = ordered.slice(start, start + perPage);

        const changeMap = await yahooChange(slice);

        const items = slice.map(code => {
            const usdToCode = rates[code];
            const usdPrice = 1 / usdToCode;         // 1 unit of code in USD
            const pkrPrice = usdPrice * pkrRate;    // 1 unit of code in PKR
            const cp = changeMap[code];
            return {
                code,
                name: currencyName(code),
                usdPrice,
                pkrPrice,
                changePercent: typeof cp === 'number' ? cp : 0,
                change: typeof cp === 'number' ? usdPrice * (cp / 100) : 0,
                hasChange: typeof cp === 'number',
            };
        });

        return NextResponse.json({ success: true, page, perPage, total, hasMore: start + perPage < total, data: items });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'fetch failed', data: [] }, { status: 500 });
    }
}
