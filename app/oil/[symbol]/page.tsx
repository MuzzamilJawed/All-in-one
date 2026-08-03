"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, BarChart3, Target, Bell } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../../components/TradingChart'), { ssr: false });
import { useSettings } from "../../context/SettingsContext";
import { useCurrency } from "../../context/CurrencyContext";
import CurrencyToggle from "../../components/CurrencyToggle";
import FitText from "../../components/FitText";
import { rateOf } from "../../lib/currency";
import { useToast } from "../../context/ToastContext";
import { fetchOilPrices } from "../../lib/api";
import { type OilAlert, type AlertCondition, loadAlerts, persistAlerts, makeAlertId } from "../../lib/oilAlerts";
import { LOADING_CAPTION } from "../../lib/caption";

export default function OilDetailPage() {
    const params = useParams();
    const router = useRouter();
    const symbol = params.symbol as string;
    const { settings } = useSettings();
    const { success, info, error: toastError } = useToast();
    const { currency: tableCurrency, sym: priceSymbol, conv, rates } = useCurrency();

    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState<any>(null);
    const [candles, setCandles] = useState<any[]>([]);
    const [timeframe, setTimeframe] = useState("1D");

    // Local price alerts (shared with the Energy Markets list)
    const [alerts, setAlerts] = useState<OilAlert[]>([]);
    const [alertCondition, setAlertCondition] = useState<AlertCondition>("above");
    const [alertPrice, setAlertPrice] = useState("");

    useEffect(() => {
        setAlerts(loadAlerts());
    }, []);

    useEffect(() => {
        const loadDetail = async () => {
            setLoading(true);
            try {
                const data = await fetchOilPrices();
                if (!data) return;

                // Find the item in featured keys or allEnergy
                let found = data[symbol];
                if (!found && data.allEnergy) {
                    found = data.allEnergy.find((i: any) => i.key === symbol);
                }

                if (found) {
                    setItem(found);
                    generateInitialCandles(found);
                }
            } catch (err) {
                console.error("Failed to load oil detail:", err);
            } finally {
                setLoading(false);
            }
        };

        const generateInitialCandles = (data: any) => {
            const basePrice = conv(data.price, data.pkrPrice) ?? 0;
            const candleData = [];
            const now = new Date();
            if (timeframe === "1H") now.setMinutes(0, 0, 0);
            else now.setHours(0, 0, 0, 0);

            const nowSec = Math.floor(now.getTime() / 1000);
            const interval = timeframe === "1H" ? 3600 : timeframe === "1D" ? 86400 : 604800;
            const count = 100;

            let lastClose = basePrice;
            const volatility = timeframe === "1W" ? 0.05 : timeframe === "1D" ? 0.025 : 0.01;

            for (let i = 0; i < count; i++) {
                const time = nowSec - i * interval;
                const change = (Math.random() - 0.5) * volatility;

                const close = lastClose;
                const open = close / (1 + change);
                const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.3));
                const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.3));

                candleData.unshift({
                    time,
                    open: parseFloat(open.toFixed(4)),
                    high: parseFloat(high.toFixed(4)),
                    low: parseFloat(low.toFixed(4)),
                    close: parseFloat(close.toFixed(4)),
                    volume: Math.floor(Math.random() * 50000) + 10000
                });
                lastClose = open;
            }
            setCandles(candleData);
        };

        loadDetail();
    }, [symbol, tableCurrency, timeframe]);

    const formatPrice = (val: number) => {
        if (typeof val !== 'number') return '---';
        return val.toLocaleString(undefined, {
            minimumFractionDigits: val < 10 ? 4 : 2,
            maximumFractionDigits: val < 10 ? 4 : 2
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">{LOADING_CAPTION}</p>
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-white italic uppercase mb-4">404 Terminal Error</h1>
                    <p className="text-zinc-500 mb-8 uppercase text-xs tracking-widest font-black">Asset not found in energy constellation</p>
                    <button onClick={() => router.push('/oil')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all">Back to Refinery</button>
                </div>
            </div>
        );
    }

    const currentPrice = conv(item.price, item.pkrPrice) ?? 0;
    const rate = item.pkrPrice && item.price ? item.pkrPrice / item.price : rateOf(rates, 'PKR');

    // Real multi-timeframe performance for this contract
    const perf = [
        { label: "24 Hour", value: Number(item.changePercent ?? 0) },
        { label: "7 Day", value: Number(item.weekly ?? 0) },
        { label: "30 Day", value: Number(item.monthly ?? 0) },
        { label: "52 Week", value: Number(item.yearly ?? 0) },
    ];
    const perfMaxAbs = Math.max(1, ...perf.map((p) => Math.abs(p.value)));

    // Technical bands derived from live price
    const support = currentPrice * 0.94;
    const resistance = currentPrice * 1.07;

    const myAlerts = alerts.filter((a) => a.key === symbol);

    // Alerts are stored in USD; show and accept them in the active currency.
    const displayTarget = (al: OilAlert) =>
        `${priceSymbol}${formatPrice(conv(al.targetUsd, al.targetUsd * rate) ?? 0)}`;

    const handleAddAlert = () => {
        const parsed = parseFloat(alertPrice.replace(/,/g, ""));
        if (!Number.isFinite(parsed) || parsed <= 0) {
            toastError("Enter a valid target price");
            return;
        }
        const targetUsd = tableCurrency === 'USD' ? parsed
            : tableCurrency === 'PKR' ? parsed / rate
                : parsed / rateOf(rates, tableCurrency);
        const triggered = alertCondition === 'above' ? item.price >= targetUsd : item.price <= targetUsd;
        const next: OilAlert[] = [
            { id: makeAlertId(), key: symbol, name: item.name, condition: alertCondition, targetUsd, createdAt: Date.now(), triggered },
            ...alerts,
        ];
        setAlerts(next);
        persistAlerts(next);
        success(`Alert set — ${item.name} ${alertCondition} ${priceSymbol}${formatPrice(parsed)}`);
        setAlertPrice("");
    };

    const handleRemoveAlert = (id: string) => {
        const next = alerts.filter((a) => a.id !== id);
        setAlerts(next);
        persistAlerts(next);
        info("Alert removed");
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-blue-500/30">
            {/* Header */}
            <div className="safe-top sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
                <div className="page-shell mx-auto pl-16 pr-4 sm:pr-8 lg:pl-8 py-4 sm:py-6 flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
                        <button onClick={() => router.push('/oil')} className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center group">
                            <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-blue-500 transition-colors" strokeWidth={2} />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter leading-none truncate">{item.name}</h1>
                            <div className="flex items-center gap-2 mt-1 sm:mt-2 min-w-0">
                                <span className="bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded truncate">Terminal ID: {symbol}</span>
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            </div>
                        </div>
                    </div>
                    <CurrencyToggle />
                </div>
            </div>

            <main className="page-shell mx-auto p-4 sm:p-8 space-y-8 sm:space-y-12">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
                    {[
                        { label: "Execution Price", value: `${priceSymbol}${formatPrice(currentPrice)}`, sub: `${(item.changePercent ?? 0) >= 0 ? '+' : ''}${(item.changePercent ?? 0).toFixed(2)}%`, color: (item.changePercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500' },
                        { label: "Weekly Momentum", value: `${item.weekly > 0 ? '+' : ''}${item.weekly}%`, sub: "7D Analysis", color: item.weekly >= 0 ? 'text-green-500' : 'text-red-500' },
                        { label: "Monthly Outlook", value: `${item.monthly > 0 ? '+' : ''}${item.monthly}%`, sub: "30D Projection", color: item.monthly >= 0 ? 'text-green-500' : 'text-red-500' },
                        { label: "Yearly Trend", value: `${(item.yearly ?? 0) > 0 ? '+' : ''}${item.yearly ?? 0}%`, sub: "52W Performance", color: (item.yearly ?? 0) >= 0 ? 'text-green-500' : 'text-red-500' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900/50 p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-white/5 shadow-sm">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">{stat.label}</p>
                            <FitText className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter mb-1">{stat.value}</FitText>
                            <div className={`text-[10px] font-black ${stat.color}`}>{stat.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Main Technical Chart */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-[3.5rem] p-5 sm:p-10 border border-zinc-200 dark:border-white/5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <span className="text-[12rem] font-black italic text-blue-500 uppercase select-none">{symbol}</span>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-6 sm:mb-12 relative z-10">
                        <div>
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">Satellite Technical Analysis</h2>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">High-Precision Candlestick Feed / SMA (20)</p>
                        </div>
                    </div>

                    <div className="h-[360px] sm:h-[600px] w-full relative z-10">
                        <TradingChart
                            title={`${item.name} Market Analysis`}
                            data={candles}
                            currentTimeframe={timeframe}
                            onTimeframeChange={setTimeframe}
                            currencySymbol={priceSymbol}
                        />
                    </div>
                </div>

                {/* Analytics: real performance + levels + working alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12">
                    {/* Left: Performance breakdown + key levels */}
                    <div className="space-y-6 sm:space-y-8">
                        <div className="bg-white dark:bg-zinc-900/50 p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-white/5">
                            <div className="flex items-center gap-3 mb-6">
                                <BarChart3 className="w-6 h-6 shrink-0 text-blue-500" strokeWidth={2} />
                                <h3 className="text-xl font-black uppercase italic tracking-tighter dark:text-white">Performance Breakdown</h3>
                            </div>
                            <div className="space-y-4">
                                {perf.map((p) => {
                                    const pos = p.value >= 0;
                                    const w = (Math.abs(p.value) / perfMaxAbs) * 50;
                                    return (
                                        <div key={p.label} className="flex items-center gap-3">
                                            <span className="w-16 shrink-0 text-[10px] font-black uppercase tracking-widest text-zinc-400">{p.label}</span>
                                            <div className="flex-1 flex items-center h-5 relative">
                                                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700" />
                                                <div className="w-1/2 flex justify-end">
                                                    {!pos && <div className="h-3 rounded-l-md bg-red-500" style={{ width: `${w * 2}%` }} />}
                                                </div>
                                                <div className="w-1/2 flex justify-start">
                                                    {pos && <div className="h-3 rounded-r-md bg-green-500" style={{ width: `${w * 2}%` }} />}
                                                </div>
                                            </div>
                                            <span className={`w-16 shrink-0 text-right text-xs font-black font-mono tabular-nums ${pos ? 'text-green-500' : 'text-red-500'}`}>
                                                {pos ? '+' : ''}{p.value.toFixed(2)}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900/50 p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-white/5">
                            <div className="flex items-center gap-3 mb-6">
                                <Target className="w-6 h-6 shrink-0 text-blue-500" strokeWidth={2} />
                                <h3 className="text-xl font-black uppercase italic tracking-tighter dark:text-white">Key Price Levels</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                                <div className="bg-green-500/[0.06] border border-green-500/15 p-2.5 sm:p-4 rounded-2xl text-center min-w-0">
                                    <p className="text-[8px] font-black text-green-600/70 dark:text-green-400/70 uppercase tracking-widest mb-1">Support</p>
                                    <FitText className="text-sm sm:text-base font-black text-green-600 dark:text-green-400 font-mono">{priceSymbol}{formatPrice(support)}</FitText>
                                </div>
                                <div className="bg-blue-500/[0.06] border border-blue-500/15 p-2.5 sm:p-4 rounded-2xl text-center min-w-0">
                                    <p className="text-[8px] font-black text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest mb-1">Current</p>
                                    <FitText className="text-sm sm:text-base font-black text-zinc-900 dark:text-white font-mono">{priceSymbol}{formatPrice(currentPrice)}</FitText>
                                </div>
                                <div className="bg-red-500/[0.05] border border-red-500/15 p-2.5 sm:p-4 rounded-2xl text-center min-w-0">
                                    <p className="text-[8px] font-black text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Resistance</p>
                                    <FitText className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 font-mono">{priceSymbol}{formatPrice(resistance)}</FitText>
                                </div>
                            </div>
                            {/* Position within the support→resistance band */}
                            <div className="mt-5">
                                <div className="relative h-2 rounded-full bg-gradient-to-r from-green-500/40 via-zinc-200 dark:via-zinc-700 to-red-500/40">
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-zinc-900 shadow"
                                        style={{ left: `${Math.min(100, Math.max(0, ((currentPrice - support) / (resistance - support)) * 100))}%` }}
                                    />
                                </div>
                                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest text-center mt-2">Technical band (±% of live price)</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Working price alerts for this contract */}
                    <div className="bg-white dark:bg-zinc-900/50 p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-white/5 flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <Bell className="w-6 h-6 shrink-0 text-blue-500" strokeWidth={2} />
                            <div>
                                <h3 className="text-xl font-black uppercase italic tracking-tighter dark:text-white">Price Alerts</h3>
                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">Get notified when {item.name} hits your level</p>
                            </div>
                        </div>

                        {/* Create */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-white/5 space-y-3">
                            <div className="flex gap-2">
                                <div className="flex bg-white dark:bg-zinc-800 rounded-xl p-1 border border-zinc-200 dark:border-zinc-700">
                                    {(['above', 'below'] as AlertCondition[]).map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => setAlertCondition(c)}
                                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-widest transition-all ${alertCondition === c ? (c === 'above' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'text-zinc-500'}`}
                                        >
                                            {c === 'above' ? '≥ Above' : '≤ Below'}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={alertPrice}
                                    onChange={(e) => setAlertPrice(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddAlert()}
                                    placeholder={`Target (${tableCurrency})`}
                                    className="flex-1 min-w-0 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 text-[11px] font-bold border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                />
                            </div>
                            <button onClick={handleAddAlert} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all">
                                Set Alert
                            </button>
                        </div>

                        {/* Existing alerts for this contract */}
                        <div className="mt-4 space-y-3 flex-1">
                            {myAlerts.length === 0 ? (
                                <div className="py-8 text-center">
                                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No alerts on {item.name}</p>
                                    <p className="text-zinc-400 text-[10px] mt-1">Set one above — it also shows on the Energy Markets screen.</p>
                                </div>
                            ) : myAlerts.map((al) => (
                                <div key={al.id} className={`flex items-center justify-between gap-2 p-4 rounded-2xl border transition-colors ${al.triggered ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-white/5'}`}>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black uppercase dark:text-zinc-200 tracking-tight">
                                            {al.condition === 'above' ? '≥' : '≤'} {displayTarget(al)}
                                        </p>
                                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                                            {al.triggered ? 'Condition met' : 'Watching live price'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wide ${al.triggered ? 'bg-red-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
                                            {al.triggered ? 'Triggered' : 'Active'}
                                        </span>
                                        <button onClick={() => handleRemoveAlert(al.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-500/10 text-[11px] transition-colors" title="Remove alert">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
