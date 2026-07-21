import { NextResponse } from 'next/server';

// Real spot/futures history for precious metals from Yahoo Finance.
// Values are in USD per troy ounce; the client scales them to the displayed
// currency/unit and anchors the last close to the live spot price.

const SYMBOLS: Record<string, string> = {
    gold: 'GC=F',      // COMEX gold futures (USD / oz)
    silver: 'SI=F',    // COMEX silver futures (USD / oz)
    platinum: 'PL=F',
    palladium: 'PA=F',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const metal = (searchParams.get('metal') || 'gold').toLowerCase();
    const timeframe = searchParams.get('timeframe') || '1D';

    const symbol = SYMBOLS[metal];
    if (!symbol) {
        return NextResponse.json({ success: false, error: 'Unsupported metal' }, { status: 400 });
    }

    const intervalMap: Record<string, string> = { '1H': '1h', '1D': '1d', '1W': '1wk', '1M': '1mo' };
    const interval = intervalMap[timeframe] || '1d';
    const rangeMap: Record<string, string> = { '1h': '1mo', '1d': '1y', '1wk': '5y', '1mo': 'max' };
    const range = rangeMap[interval] || '1y';

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            return NextResponse.json({ success: false, error: `Provider error (${res.status})`, symbol }, { status: res.status });
        }

        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result || !result.timestamp) {
            return NextResponse.json({ success: false, error: 'No historical data available', symbol });
        }

        const timestamps: number[] = result.timestamp;
        const ohlc = result.indicators?.quote?.[0] || {};
        const volumeData: number[] = ohlc.volume || [];

        const data = timestamps.map((ts: number, i: number) => {
            let time: string | number = ts;
            if (timeframe !== '1H') {
                const d = new Date(ts * 1000);
                time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
            return {
                time,
                open: ohlc.open?.[i] ?? ohlc.close?.[i],
                high: ohlc.high?.[i] ?? ohlc.close?.[i],
                low: ohlc.low?.[i] ?? ohlc.close?.[i],
                close: ohlc.close?.[i],
                volume: volumeData[i] || 0,
            };
        }).filter((d: any) => d.open != null && d.close != null);

        const meta = result.meta || {};

        return NextResponse.json({
            success: true,
            metal,
            symbol,
            data,
            regularMarketPrice: meta.regularMarketPrice ?? null,
            dayHigh: meta.regularMarketDayHigh ?? null,
            dayLow: meta.regularMarketDayLow ?? null,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
        });
    } catch (error: any) {
        console.error('Metals history fetch failed:', error);
        return NextResponse.json({ success: false, error: error?.message || 'fetch failed', symbol }, { status: 500 });
    }
}
