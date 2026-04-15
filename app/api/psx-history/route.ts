import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || '1D';

    if (!symbol) {
        return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    try {
        // Map PSX symbols to Yahoo Finance symbols
        let yahooSymbol = symbol.toUpperCase();
        
        const indexMapping: Record<string, string> = {
            'KSE100': '^KSE100',
            'KSE30': '^KSE30',
            'KSEALL': '^KSE',
            'ALLSHR': '^KSE',
            'ALLSHARES': '^KSE',
            'KMI30': '^KMI30',
            'KMIALLSHR': '^KMIALL',
            'KMIALL': '^KMIALL',
            'BKTI': '^BKTI',
            'OGTI': '^OGTI'
        };

        const lookupSymbol = yahooSymbol.toUpperCase();
        if (indexMapping[lookupSymbol]) {
            yahooSymbol = indexMapping[lookupSymbol];
        } else if (!yahooSymbol.includes('.') && !yahooSymbol.startsWith('^')) {
            // Most PSX stocks on Yahoo use .KA (Karachi)
            yahooSymbol = `${yahooSymbol}.KA`;
        }

        const encodedSymbol = encodeURIComponent(yahooSymbol);

        // Map timeframes to Yahoo intervals
        const intervalMap: Record<string, string> = {
            '1H': '1h',
            '1D': '1d',
            '1W': '1wk',
            '1M': '1mo'
        };
        const interval = intervalMap[timeframe] || '1d';
        
        const rangeMap: Record<string, string> = {
            '1h': '1mo', // 1 month of hourly data
            '1d': '1y',  // 1 year of daily data
            '1wk': '5y', // 5 years of weekly data
            '1mo': 'max' // All time monthly data
        };
        const range = rangeMap[interval] || '1y';

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=${interval}&range=${range}`;
        
        let response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        // Fallback for stocks: if .KA fails, try .K or just the symbol if it's an index
        if (!response.ok && yahooSymbol.endsWith('.KA')) {
            const fallbackSymbol = yahooSymbol.replace('.KA', '.K');
            const fallbackUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${fallbackSymbol}?interval=${interval}&range=${range}`;
            response = await fetch(fallbackUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Yahoo API error (${response.status}):`, errorText);
            return NextResponse.json({ 
                success: false, 
                error: `Market data provider error (${response.status}). Many PSX stocks may not be available on Yahoo Finance.`,
                symbol: yahooSymbol
            }, { status: response.status });
        }

        const data = await response.json();
        const result = data?.chart?.result?.[0];

        if (!result || !result.timestamp) {
            return NextResponse.json({ success: false, error: 'No historical data available for this asset on Yahoo Finance.' });
        }

        const timestamps = result.timestamp;
        const ohlc = result.indicators.quote[0];
        const volumeData = ohlc.volume || [];

        const formattedData = timestamps.map((ts: number, i: number) => {
            let time: string | number = ts;
            if (timeframe !== '1H') {
                const date = new Date(ts * 1000);
                time = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }

            return {
                time,
                open: ohlc.open[i] || ohlc.close[i],
                high: ohlc.high[i] || ohlc.close[i],
                low: ohlc.low[i] || ohlc.close[i],
                close: ohlc.close[i],
                volume: volumeData[i] || 0
            };
        }).filter((d: any) => d.open != null && d.close != null);

        return NextResponse.json({
            success: true,
            symbol: yahooSymbol,
            data: formattedData
        });

    } catch (error: any) {
        console.error('Historical data fetch failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
