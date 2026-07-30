"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { useSettings } from "../context/SettingsContext";
import { useCurrency } from "../context/CurrencyContext";
import { fetchOilPrices } from "../lib/api";

const TradingChart = dynamic(() => import("./TradingChart"), { ssr: false });
import { LOADING_CAPTION } from "../lib/caption";

const COMPARE_METRICS: { key: 'changePercent' | 'weekly' | 'monthly' | 'yearly'; label: string }[] = [
    { key: 'changePercent', label: '24h' },
    { key: 'weekly', label: '7D' },
    { key: 'monthly', label: '30D' },
    { key: 'yearly', label: '52W' },
];

// Interactive candlestick + momentum trend + head-to-head matrix for energy
// contracts. Moved off the main Energy Markets screen into its own route.
export default function OilGraphAnalysis() {
    const { settings } = useSettings();
    const { sym, conv } = useCurrency();
    const { currency: tableCurrency } = useCurrency();
    const router = useRouter();

    const [allEnergy, setAllEnergy] = useState<any[]>([]);
    const [selected, setSelected] = useState("crudeOil");
    const [candleTimeframe, setCandleTimeframe] = useState("1D"); // 1H | 1D | 1W | 1M
    const [trendTimeframe, setTrendTimeframe] = useState("Daily"); // Daily | Weekly | Monthly | Yearly
    const [compareMetric, setCompareMetric] = useState<'changePercent' | 'weekly' | 'monthly' | 'yearly'>('changePercent');
    const [candles, setCandles] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const stableTrendRef = useRef<Record<string, any[]>>({});

    const loadPrices = useCallback(async (isManual = true) => {
        try {
            if (isManual) setLoading(true);
            const data = await fetchOilPrices();
            if (!data) return;
            const list: any[] = data.allEnergy || [];
            setAllEnergy(list);
            // Default to the first available contract if the current one is gone.
            if (list.length && !list.some((i) => i.key === selected)) {
                setSelected(list[0].key);
            }
        } catch (err) {
            console.error("Failed to fetch energy data:", err);
        } finally {
            if (isManual) setLoading(false);
        }
    }, [selected]);

    useEffect(() => {
        loadPrices(true);
    }, []);

    useEffect(() => {
        if (!settings.refreshInterval || settings.refreshInterval <= 0) return;
        const interval = setInterval(() => loadPrices(false), settings.refreshInterval * 1000);
        return () => clearInterval(interval);
    }, [settings.refreshInterval, loadPrices]);

    const selectedItem = useMemo(
        () => allEnergy.find((i) => i.key === selected) || allEnergy[0],
        [allEnergy, selected]
    );
    const activeName = selectedItem?.name || "Markets";

    // ── Interactive candlestick series (OHLC) for the selected contract ──────────
    useEffect(() => {
        if (!selectedItem) return;
        const basePrice = conv(selectedItem.price, selectedItem.pkrPrice) ?? 0;
        if (!basePrice) return;

        const now = new Date();
        if (candleTimeframe === "1H") now.setMinutes(0, 0, 0);
        else now.setHours(0, 0, 0, 0);

        const nowSec = Math.floor(now.getTime() / 1000);
        const interval = candleTimeframe === "1H" ? 3600 : candleTimeframe === "1W" ? 604800 : candleTimeframe === "1M" ? 2592000 : 86400;
        const count = 120;
        const volatility = candleTimeframe === "1M" ? 0.06 : candleTimeframe === "1W" ? 0.05 : candleTimeframe === "1D" ? 0.025 : 0.01;

        const out: any[] = [];
        let lastClose = basePrice;
        for (let i = 0; i < count; i++) {
            const time = nowSec - i * interval;
            const change = (Math.random() - 0.5) * volatility;
            const close = lastClose;
            const open = close / (1 + change);
            const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.3));
            const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.3));
            out.unshift({
                time,
                open: parseFloat(open.toFixed(4)),
                high: parseFloat(high.toFixed(4)),
                low: parseFloat(low.toFixed(4)),
                close: parseFloat(close.toFixed(4)),
                volume: Math.floor(Math.random() * 50000) + 10000,
            });
            lastClose = open;
        }
        setCandles(out);
    }, [selectedItem, candleTimeframe, tableCurrency, conv]);

    // ── Momentum trend (area) — stable across refreshes per contract/timeframe ───
    useEffect(() => {
        if (!selectedItem) return;
        const currentPrice = conv(selectedItem.price, selectedItem.pkrPrice) ?? 0;
        if (!currentPrice) return;
        const coarse = currentPrice >= 1000;
        const trendKey = `${selected}-${trendTimeframe}-${tableCurrency}`;

        let points = 24;
        let interval = 3600 * 1000;
        let volatility = 0.01;
        if (trendTimeframe === 'Daily') { points = 24; interval = 3600 * 1000; volatility = 0.005; }
        if (trendTimeframe === 'Weekly') { points = 7; interval = 24 * 3600 * 1000; volatility = 0.015; }
        if (trendTimeframe === 'Monthly') { points = 30; interval = 24 * 3600 * 1000; volatility = 0.02; }
        if (trendTimeframe === 'Yearly') { points = 52; interval = 7 * 24 * 3600 * 1000; volatility = 0.04; }

        if (stableTrendRef.current[trendKey] && stableTrendRef.current[trendKey].length === points) {
            const existing = [...stableTrendRef.current[trendKey]];
            existing[existing.length - 1] = {
                ...existing[existing.length - 1],
                price: coarse ? Math.round(currentPrice) : parseFloat(currentPrice.toFixed(2)),
            };
            stableTrendRef.current[trendKey] = existing;
            setTrendData(existing);
        } else {
            const newTrendData: any[] = [];
            const now = Date.now();
            let simPrice = currentPrice;
            const prices = [currentPrice];
            const times = [now];
            for (let i = 1; i < points; i++) {
                const change = (Math.random() - 0.5) * (volatility * 2);
                simPrice = simPrice * (1 - change);
                prices.push(simPrice);
                times.push(now - i * interval);
            }
            for (let i = points - 1; i >= 0; i--) {
                const time = new Date(times[i]);
                const label = (trendTimeframe === 'Daily')
                    ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : time.toLocaleDateString([], { month: 'short', day: 'numeric' });
                newTrendData.push({ name: label, price: coarse ? Math.round(prices[i]) : parseFloat(prices[i].toFixed(2)) });
            }
            stableTrendRef.current[trendKey] = newTrendData;
            setTrendData(newTrendData);
        }
    }, [selectedItem, selected, trendTimeframe, tableCurrency, conv]);

    // ── Cross-market comparison ranked by the selected timeframe ─────────────────
    const comparison = useMemo(() => {
        const rows = allEnergy
            .map((i) => ({ key: i.key, name: i.name, value: Number(i[compareMetric] ?? 0) }))
            .sort((a, b) => b.value - a.value);
        const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
        return { rows, maxAbs };
    }, [allEnergy, compareMetric]);

    if (loading && allEnergy.length === 0) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">{LOADING_CAPTION}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-12">
            {/* Contract selector */}
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Contract</span>
                <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    className="bg-zinc-100 dark:bg-zinc-800/50 rounded-xl px-4 py-2.5 text-[11px] sm:text-xs font-black uppercase tracking-widest border-none outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-zinc-200 cursor-pointer"
                >
                    {allEnergy.map((item) => (
                        <option key={item.key} value={item.key}>{item.name}</option>
                    ))}
                </select>
            </div>

            {/* ── Interactive candlestick ── */}
            <div className="bg-white dark:bg-[#050505] rounded-2xl sm:rounded-[3rem] shadow-sm p-4 sm:p-8 border border-zinc-200 dark:border-white/5">
                <div className="mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">Candlestick Analysis</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Interactive OHLC · SMA · Volume — <span className="text-blue-500">{activeName}</span></p>
                </div>
                <div className="h-[380px] sm:h-[600px] w-full">
                    <TradingChart
                        title={`${activeName} Market Analysis`}
                        data={candles}
                        currentTimeframe={candleTimeframe}
                        onTimeframeChange={setCandleTimeframe}
                        currencySymbol={sym}
                        seamless
                    />
                </div>
            </div>

            {/* Momentum + matrix sit side by side from xl up, stacked below it */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
                {/* ── Market Momentum (area trend) ── */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-[3rem] shadow-sm p-5 sm:p-8 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2"></div>

                    {/* The card is half-width, so the header always stacks — a side-by-side
                    header would wrap the title however wide the viewport is. */}
                    <div className="relative z-10 flex flex-col items-start mb-6 sm:mb-8 gap-4">
                        <div className="min-w-0 w-full">
                            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Market Momentum</h2>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1 truncate">Velocity Trace: <span className="text-blue-500">{activeName}</span></p>
                        </div>

                        <div className="flex bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-1 w-full shrink-0">
                            {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTrendTimeframe(tf)}
                                    className={`flex-1 px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all uppercase tracking-widest ${trendTimeframe === tf ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[320px] sm:h-[380px] w-full relative z-10 mt-auto">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorOilAnalysis" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                {/* minTickGap keeps the labels readable at half width */}
                                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 800 }} minTickGap={24} />
                                <YAxis
                                    stroke="#52525b"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(v) => v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${v}`}
                                    tick={{ fontWeight: 800 }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '24px', color: '#fff', padding: '16px' }}
                                    itemStyle={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                                    labelStyle={{ fontWeight: 900, marginBottom: '8px', color: '#71717a' }}
                                    formatter={(v: any) => [`${sym}${Number(v).toLocaleString()}`, 'Execution Price']}
                                />
                                <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorOilAnalysis)" strokeWidth={4} animationDuration={1500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ── Cross-Market Performance Matrix ── */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-[3rem] shadow-sm p-5 sm:p-8 border border-zinc-200 dark:border-zinc-800 flex flex-col">
                    <div className="flex flex-col items-start gap-4 mb-6 sm:mb-8">
                        <div className="min-w-0 w-full">
                            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Performance Matrix</h2>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Every energy contract, ranked head-to-head</p>
                        </div>
                        <div className="flex bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-1 w-full shrink-0">
                            {COMPARE_METRICS.map((m) => (
                                <button
                                    key={m.key}
                                    onClick={() => setCompareMetric(m.key)}
                                    className={`flex-1 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all uppercase tracking-widest ${compareMetric === m.key ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2.5 my-auto">
                        {comparison.rows.map((row) => {
                            const pos = row.value >= 0;
                            const widthPct = (Math.abs(row.value) / comparison.maxAbs) * 50;
                            return (
                                <button
                                    key={row.key}
                                    onClick={() => router.push(`/oil/${row.key}`)}
                                    className="w-full group flex items-center gap-2 sm:gap-4 text-left"
                                >
                                    <span className="w-24 sm:w-32 shrink-0 text-[10px] sm:text-xs font-black uppercase italic tracking-tight text-zinc-700 dark:text-zinc-300 group-hover:text-blue-500 transition-colors truncate" title={row.name}>
                                        {row.name}
                                    </span>
                                    <div className="flex-1 flex items-center h-6 relative">
                                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700" />
                                        <div className="w-1/2 flex justify-end">
                                            {!pos && (
                                                <div className="h-3 sm:h-3.5 rounded-l-md bg-gradient-to-l from-red-500 to-red-500/60" style={{ width: `${widthPct * 2}%` }} />
                                            )}
                                        </div>
                                        <div className="w-1/2 flex justify-start">
                                            {pos && (
                                                <div className="h-3 sm:h-3.5 rounded-r-md bg-gradient-to-r from-green-500 to-green-500/60" style={{ width: `${widthPct * 2}%` }} />
                                            )}
                                        </div>
                                    </div>
                                    <span className={`w-14 sm:w-[70px] shrink-0 text-right text-[10px] sm:text-xs font-black font-mono tabular-nums ${pos ? 'text-green-500' : 'text-red-500'}`}>
                                        {pos ? '+' : ''}{row.value.toFixed(2)}%
                                    </span>
                                </button>
                            );
                        })}
                        {comparison.rows.length === 0 && (
                            <p className="py-10 text-center text-zinc-400 font-black uppercase tracking-widest text-[11px]">No comparison data available</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
