import { NextResponse } from 'next/server';

// Real FX history from Yahoo Finance. We always fetch the "<CODE>USD=X" cross
// (1 unit of CODE in USD) — reliable for all majors + SAR/AED/INR — and let the
// client scale/anchor it to the displayed currency (USD or PKR). USD itself uses
// "PKR=X" (USD/PKR). Meta carries 24h change, day range and 52-week range.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const yahooSymbol = (code: string): string => {
    const c = code.toUpperCase();
    if (c === 'USD') return 'PKR=X';   // USD/PKR
    return `${c}USD=X`;                 // e.g. EURUSD=X — 1 unit in USD
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || 'EUR').toUpperCase();
    const timeframe = searchParams.get('timeframe') || '1D';

    const symbol = yahooSymbol(code);
    const intervalMap: Record<string, string> = { '1H': '1h', '1D': '1d', '1W': '1wk', '1M': '1mo' };
    const interval = intervalMap[timeframe] || '1d';
    const rangeMap: Record<string, string> = { '1h': '1mo', '1d': '1y', '1wk': '5y', '1mo': 'max' };
    const range = rangeMap[interval] || '1y';

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
        const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, next: { revalidate: 60 } });
        if (!res.ok) {
            return NextResponse.json({ success: false, error: `Provider error (${res.status})`, symbol }, { status: res.status });
        }

        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result || !result.timestamp) {
            return NextResponse.json({ success: false, error: 'No historical data', symbol });
        }

        const timestamps: number[] = result.timestamp;
        const ohlc = result.indicators?.quote?.[0] || {};
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
                volume: 0,
            };
        }).filter((d: any) => d.open != null && d.close != null);

        const meta = result.meta || {};
        const price = meta.regularMarketPrice ?? null;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
        const changePercent = (price != null && prevClose) ? ((price - prevClose) / prevClose) * 100 : null;

        return NextResponse.json({
            success: true,
            code,
            symbol,
            data,
            regularMarketPrice: price,
            previousClose: prevClose,
            changePercent,
            dayHigh: meta.regularMarketDayHigh ?? null,
            dayLow: meta.regularMarketDayLow ?? null,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'fetch failed', symbol }, { status: 500 });
    }
}
