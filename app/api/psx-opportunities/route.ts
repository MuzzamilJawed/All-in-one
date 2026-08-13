import { NextResponse } from "next/server";

type StockInput = {
    symbol: string;
    currentPrice?: number;
    volume?: string | number;
};

type MonthlyResult = {
    symbol: string;
    monthlyChangePercent: number | null;
    monthlyHigh: number | null;
    monthlyLow: number | null;
    averageVolume: number | null;
    volumeRatio: number | null;
    positiveDays: number;
    tradingDays: number;
    score: number;
    reasons: string[];
};

type YahooChartResult = {
    timestamp?: number[];
    indicators?: {
        quote?: Array<{
            close?: Array<number | null>;
            volume?: Array<number | null>;
        }>;
    };
};

async function fetchMonthly(symbol: string): Promise<MonthlyResult | null> {
    const candidates = [`${symbol}.KA`, `${symbol}.K`, symbol];
    let result: YahooChartResult | null = null;

    for (const ticker of candidates) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                Accept: "application/json",
            },
            next: { revalidate: 900 },
        });
        if (!response.ok) continue;
        const json = await response.json() as { chart?: { result?: YahooChartResult[] } };
        result = json?.chart?.result?.[0] || null;
        if (result?.timestamp?.length) break;
    }

    if (!result?.timestamp?.length) return null;

    const quote = result.indicators?.quote?.[0] || {};
    const closes = (result.timestamp as number[])
        .map((timestamp, index) => ({
            timestamp,
            close: Number(quote.close?.[index]),
            volume: Number(quote.volume?.[index] || 0),
        }))
        .filter(point => Number.isFinite(point.close) && point.close > 0);

    if (closes.length < 2) return null;

    const window = closes.slice(-22);
    const start = window[0].close;
    const end = window[window.length - 1].close;
    const monthlyChangePercent = ((end - start) / start) * 100;
    const monthlyHigh = Math.max(...window.map(point => point.close));
    const monthlyLow = Math.min(...window.map(point => point.close));
    const averageVolume = window.reduce((total, point) => total + point.volume, 0) / window.length;
    const latestVolume = window[window.length - 1].volume;
    const volumeRatio = averageVolume > 0 ? latestVolume / averageVolume : null;
    const positiveDays = window.filter((point, index) => index === 0 || point.close >= window[index - 1].close).length;

    const returnScore = Math.min(40, Math.max(0, (monthlyChangePercent + 5) * 2.5));
    const consistencyScore = (positiveDays / window.length) * 35;
    const volumeScore = volumeRatio == null ? 0 : Math.min(25, Math.max(0, (volumeRatio - 0.5) * 12.5));
    const score = returnScore + consistencyScore + volumeScore;
    const reasons: string[] = [];

    if (monthlyChangePercent >= 5) reasons.push(`${monthlyChangePercent.toFixed(1)}% monthly uptrend`);
    else if (monthlyChangePercent > 0) reasons.push(`${monthlyChangePercent.toFixed(1)}% monthly gain`);
    if (positiveDays / window.length >= 0.6) reasons.push(`${positiveDays}/${window.length} positive sessions`);
    if (volumeRatio != null && volumeRatio >= 1.25) reasons.push(`${volumeRatio.toFixed(1)}x average volume`);
    if (reasons.length === 0) reasons.push("Needs closer review");

    return {
        symbol,
        monthlyChangePercent,
        monthlyHigh,
        monthlyLow,
        averageVolume,
        volumeRatio,
        positiveDays,
        tradingDays: window.length,
        score,
        reasons,
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const stocks: StockInput[] = Array.isArray(body?.stocks) ? body.stocks : [];
        if (!stocks.length) {
            return NextResponse.json({ success: false, error: "Stocks are required" }, { status: 400 });
        }

        const results: MonthlyResult[] = [];
        const batchSize = 8;
        for (let index = 0; index < stocks.length; index += batchSize) {
            const batch = stocks.slice(index, index + batchSize);
            const settled = await Promise.allSettled(batch.map(stock => fetchMonthly(stock.symbol.toUpperCase())));
            settled.forEach(result => {
                if (result.status === "fulfilled" && result.value) results.push(result.value);
            });
        }

        return NextResponse.json({ success: true, data: results });
    } catch (error: unknown) {
        console.error("PSX opportunity history failed:", error);
        const message = error instanceof Error ? error.message : "Unable to calculate opportunities";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
