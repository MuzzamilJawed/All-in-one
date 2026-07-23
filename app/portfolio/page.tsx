"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Briefcase, Download, RotateCcw, BarChart3 } from "lucide-react";
import {
    PieChart, Pie, Cell, Sector, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import {
    getTxns, addTxn, deleteTxn, computeHoldings, txnsToCsv, type Txn,
} from "../lib/portfolio";
import {
    fetchAllPrices, priceKey, priceIn, convert, curSymbol, ASSET_TYPES,
    COMMODITY_SYMBOLS, type AssetType, type PriceBook,
} from "../lib/prices";

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function PortfolioPage() {
    const { settings } = useSettings();
    const { success, info } = useToast();
    const displayCur: "PKR" | "USD" = settings.currency === "PKR" ? "PKR" : "USD";

    const [txns, setTxns] = useState<Txn[]>([]);
    const [book, setBook] = useState<PriceBook>({ map: {}, rate: 278, updated: "" });
    const [pricesLoading, setPricesLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [portTab, setPortTab] = useState<"analytics" | "holdings" | "history">("holdings");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [chartView, setChartView] = useState<"alloc" | "perf" | "timeline">("alloc");
    const [allocBy, setAllocBy] = useState<"pos" | "type">("pos");
    const [perfMetric, setPerfMetric] = useState<"total" | "day">("total");
    const [activeIdx, setActiveIdx] = useState<number | null>(null);

    // Add-transaction form state
    const [form, setForm] = useState({
        date: todayStr(), type: "BUY" as "BUY" | "SELL", assetType: "PSX" as AssetType,
        symbol: "", quantity: "", price: "", currency: "PKR" as "PKR" | "USD", note: "",
    });

    const reload = useCallback(() => setTxns(getTxns()), []);

    useEffect(() => {
        reload();
        const h = () => reload();
        window.addEventListener("portfolio", h);
        return () => window.removeEventListener("portfolio", h);
    }, [reload]);

    const loadPrices = useCallback(async () => {
        setPricesLoading(true);
        try { setBook(await fetchAllPrices()); } finally { setPricesLoading(false); }
    }, []);

    useEffect(() => {
        loadPrices();
        if (!settings.refreshInterval || settings.refreshInterval <= 0) return;
        const id = setInterval(loadPrices, Math.max(30, settings.refreshInterval) * 1000);
        return () => clearInterval(id);
    }, [loadPrices, settings.refreshInterval]);

    const rate = book.rate;
    const { holdings, realized } = useMemo(() => computeHoldings(txns), [txns]);

    // Enrich holdings with live prices + P/L (in each holding's own currency)
    const rows = useMemo(() => holdings.map(h => {
        const info = book.map[priceKey(h.assetType, h.symbol)];
        const current = priceIn(info, h.currency, rate);
        const invested = h.quantity * h.avgCost;
        const value = current != null ? h.quantity * current : null;
        const pnl = value != null ? value - invested : null;
        const pnlPct = pnl != null && invested > 0 ? (pnl / invested) * 100 : null;
        // Day (24h) P/L for the whole position
        const dayPct = info?.changePct ?? null;
        const dayPnl = (current != null && dayPct != null) ? h.quantity * current * (dayPct / 100) : null;
        return { ...h, name: h.name || info?.name, current, invested, value, pnl, pnlPct, dayPct, dayPnl };
    }), [holdings, book, rate]);

    // Portfolio totals converted to the display currency
    const totals = useMemo(() => {
        let invested = 0;        // cost of all open holdings
        let value = 0;           // current value of holdings that have a live price
        let investedPriced = 0;  // cost of just those priced holdings
        let day = 0;             // today's P/L across priced holdings
        rows.forEach(r => {
            const inv = convert(r.invested, r.currency, displayCur, rate);
            invested += inv;
            if (r.value != null) {
                value += convert(r.value, r.currency, displayCur, rate);
                investedPriced += inv;
            }
            if (r.dayPnl != null) day += convert(r.dayPnl, r.currency, displayCur, rate);
        });
        const unrealized = value - investedPriced;
        const realizedTotal = convert(realized.PKR, "PKR", displayCur, rate) + convert(realized.USD, "USD", displayCur, rate);
        return { invested, value, day, dayPct: value > 0 ? (day / value) * 100 : 0, unrealized, realizedTotal, total: unrealized + realizedTotal };
    }, [rows, realized, displayCur, rate]);

    // Date-filtered ledger (most recent first)
    const ledger = useMemo(() => {
        return [...txns]
            .filter(t => (!from || t.date >= from) && (!to || t.date <= to))
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }, [txns, from, to]);

    // ── Interactive analytics data (all in display currency) ─────────────────
    const TYPE_COLORS: Record<string, string> = { PSX: "#3b82f6", NASDAQ: "#6366f1", CRYPTO: "#f97316", FOREX: "#22c55e", COMMODITY: "#f59e0b" };
    const PALETTE = ["#3b82f6", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#ec4899", "#6366f1", "#06b6d4"];

    const allocData = useMemo(() => {
        const priced = rows.filter(r => r.value != null);
        if (allocBy === "type") {
            const byType = new Map<string, number>();
            priced.forEach(r => byType.set(r.assetType, (byType.get(r.assetType) || 0) + convert(r.value as number, r.currency, displayCur, rate)));
            return Array.from(byType.entries()).map(([name, value]) => ({ name, value, color: TYPE_COLORS[name] || "#3b82f6" }));
        }
        return priced
            .map((r, i) => ({ name: r.symbol, value: convert(r.value as number, r.currency, displayCur, rate), color: PALETTE[i % PALETTE.length] }))
            .sort((a, b) => b.value - a.value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, allocBy, displayCur, rate]);
    const allocTotal = useMemo(() => allocData.reduce((a, d) => a + d.value, 0), [allocData]);

    const perfData = useMemo(() => {
        const pick = (r: typeof rows[number]) => (perfMetric === "day" ? r.dayPnl : r.pnl);
        return rows.filter(r => pick(r) != null)
            .map(r => ({ name: r.symbol, pnl: convert(pick(r) as number, r.currency, displayCur, rate) }))
            .sort((a, b) => b.pnl - a.pnl);
    }, [rows, displayCur, rate, perfMetric]);

    const timelineData = useMemo(() => {
        const sorted = [...txns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        const byDate = new Map<string, number>();
        let running = 0;
        sorted.forEach(t => {
            const v = convert(t.quantity * t.price, t.currency, displayCur, rate) * (t.type === "BUY" ? 1 : -1);
            running += v;
            byDate.set(t.date, running);
        });
        return Array.from(byDate.entries()).map(([date, invested]) => ({ date, invested }));
    }, [txns, displayCur, rate]);

    const fmt = (amt: number | null | undefined, cur: "PKR" | "USD" = displayCur) =>
        amt == null ? "—" : `${curSymbol(cur)}${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const signed = (amt: number | null | undefined, cur: "PKR" | "USD" = displayCur) =>
        amt == null ? "—" : `${amt >= 0 ? "+" : "-"}${curSymbol(cur)}${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const compact = (v: number) => `${curSymbol(displayCur)}${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
    const tooltipStyle: any = { backgroundColor: "var(--tooltip-bg,#fff)", color: "var(--tooltip-fg,#111)", border: "1px solid var(--tooltip-border,#e4e4e7)", borderRadius: "0.75rem", fontSize: "12px", fontWeight: 700 };
    // Pop-out shape for the hovered donut slice (interactive)
    const renderActiveSlice = (props: any) => {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
        return (
            <g>
                <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} />
                <Sector cx={cx} cy={cy} innerRadius={outerRadius + 13} outerRadius={outerRadius + 16} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.55} />
            </g>
        );
    };

    const symbolSuggestions = useMemo(() => {
        const prefix = `${form.assetType}:`;
        return Object.keys(book.map).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length)).sort();
    }, [book, form.assetType]);

    const onPickType = (assetType: AssetType) => {
        const def = ASSET_TYPES.find(a => a.value === assetType);
        setForm(f => ({ ...f, assetType, currency: def?.currency || "PKR", symbol: "", price: "" }));
    };

    const autofillPrice = () => {
        const info = book.map[priceKey(form.assetType, form.symbol)];
        const p = priceIn(info, form.currency, rate);
        if (p != null) setForm(f => ({ ...f, price: String(Number(p.toFixed(p < 1 ? 6 : 2))) }));
    };

    const submit = () => {
        const q = parseFloat(form.quantity), p = parseFloat(form.price);
        if (!form.symbol.trim()) { info("Enter a symbol"); return; }
        if (!Number.isFinite(q) || q <= 0) { info("Enter a valid quantity"); return; }
        if (!Number.isFinite(p) || p <= 0) { info("Enter a valid price"); return; }
        const info2 = book.map[priceKey(form.assetType, form.symbol)];
        addTxn({
            date: form.date || todayStr(), type: form.type, assetType: form.assetType,
            symbol: form.symbol, name: info2?.name, quantity: q, price: p, currency: form.currency, note: form.note.trim() || undefined,
        });
        success(`${form.type} ${q} ${form.symbol.toUpperCase()} recorded`);
        setForm(f => ({ ...f, symbol: "", quantity: "", price: "", note: "" }));
    };

    const remove = (t: Txn) => {
        if (!confirm(`Delete ${t.type} ${t.quantity} ${t.symbol} (${t.date})?`)) return;
        deleteTxn(t.id);
        info("Transaction deleted");
    };

    const download = () => {
        const csv = txnsToCsv(ledger);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${from || "all"}_to_${to || todayStr()}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        success("Ledger exported to CSV");
    };

    const inputCls = "w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all";
    const typeBadge = (t: AssetType) => ({ PSX: "bg-blue-500/10 text-blue-500", NASDAQ: "bg-indigo-500/10 text-indigo-500", CRYPTO: "bg-orange-500/10 text-orange-500", FOREX: "bg-green-500/10 text-green-500", COMMODITY: "bg-amber-500/10 text-amber-500" }[t]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white selection:bg-blue-500/30">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 dark:bg-emerald-600/10 blur-[120px] rounded-full"></div>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
                <div className="max-w-[1600px] mx-auto pl-16 pr-4 sm:pr-8 lg:pl-8 py-3 sm:py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h1 className="text-xl sm:text-3xl font-black tracking-tighter italic uppercase leading-none flex items-center gap-2"><Briefcase className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500 shrink-0" strokeWidth={2} /> Portfolio <span className="text-emerald-500">Ledger</span></h1>
                        <p className="text-zinc-500 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] mt-1">Multi-Asset Holdings · Profit &amp; Loss</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button onClick={() => setShowAdd(s => !s)} className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">{showAdd ? "✕ Close" : "+ Add Trade"}</button>
                        <button onClick={download} disabled={ledger.length === 0} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 disabled:opacity-40 text-zinc-700 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-zinc-200 dark:border-white/10 transition-all"><Download className="w-3.5 h-3.5" strokeWidth={2} /> Download</button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 sm:p-8 relative z-10 space-y-6 sm:space-y-8">
                {/* Add transaction */}
                {showAdd && (
                    <div className="bg-white dark:bg-zinc-900/60 backdrop-blur-sm rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 shadow-sm p-4 sm:p-6 animate-in fade-in slide-in-from-top-2">
                        <h2 className="text-sm font-black uppercase tracking-tighter italic mb-4">Record a Trade</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Date</label>
                                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
                            </div>
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Type</label>
                                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className={inputCls}>
                                    <option value="BUY">Buy</option>
                                    <option value="SELL">Sell</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Asset</label>
                                <select value={form.assetType} onChange={e => onPickType(e.target.value as AssetType)} className={inputCls}>
                                    {ASSET_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Symbol</label>
                                <input list="sym-suggest" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} placeholder={form.assetType === "COMMODITY" ? "GOLD" : "HBL"} className={inputCls} />
                                <datalist id="sym-suggest">
                                    {(form.assetType === "COMMODITY" ? COMMODITY_SYMBOLS : symbolSuggestions).slice(0, 200).map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Quantity</label>
                                <input type="number" inputMode="decimal" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="100" className={inputCls} />
                            </div>
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Price</label>
                                <div className="relative">
                                    <input type="number" inputMode="decimal" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" className={`${inputCls} pr-16`} />
                                    <button type="button" onClick={autofillPrice} title="Fill with the live market price" className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-all"><RotateCcw className="w-3 h-3" strokeWidth={2} /> Live</button>
                                </div>
                            </div>
                            <div className="col-span-1">
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Currency</label>
                                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as any }))} className={inputCls}>
                                    <option value="PKR">PKR</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                            <div className="col-span-1 flex items-end">
                                <button onClick={submit} className="w-full px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">Add</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary cards — day + total both shown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                    {[
                        { label: "Invested", val: totals.invested, tone: "text-zinc-900 dark:text-white", signed: false, pct: null as number | null, highlight: false },
                        { label: "Current Value", val: totals.value, tone: "text-zinc-900 dark:text-white", signed: false, pct: null, highlight: false },
                        { label: "Day P/L", val: totals.day, tone: totals.day >= 0 ? "text-green-500" : "text-red-500", signed: true, pct: totals.value > 0 ? totals.dayPct : null, highlight: true },
                        { label: "Unrealized P/L", val: totals.unrealized, tone: totals.unrealized >= 0 ? "text-green-500" : "text-red-500", signed: true, pct: null, highlight: false },
                        { label: "Realized P/L", val: totals.realizedTotal, tone: totals.realizedTotal >= 0 ? "text-green-500" : "text-red-500", signed: true, pct: null, highlight: false },
                        { label: "Total P/L", val: totals.total, tone: totals.total >= 0 ? "text-green-500" : "text-red-500", signed: true, pct: totals.invested > 0 ? (totals.total / totals.invested) * 100 : null, highlight: true },
                    ].map((c, i) => (
                        <div key={i} className={`bg-white dark:bg-zinc-900/50 rounded-2xl sm:rounded-[1.75rem] p-4 sm:p-5 border shadow-sm ${c.highlight ? "border-blue-500/30" : "border-zinc-200 dark:border-white/5"}`}>
                            <p className="text-[8px] sm:text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{c.label}</p>
                            <p className={`text-base sm:text-xl font-black font-mono tracking-tighter tabular-nums ${c.tone}`}>{c.signed ? signed(c.val) : fmt(c.val)}</p>
                            {c.pct != null && (
                                <p className={`text-[10px] font-black ${c.val >= 0 ? "text-green-500" : "text-red-500"}`}>{c.val >= 0 ? "▲" : "▼"} {Math.abs(c.pct).toFixed(2)}%</p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Section sub-navigation */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {[
                        { id: "analytics" as const, label: "Analytics" },
                        { id: "holdings" as const, label: "Holdings", count: rows.length },
                        { id: "history" as const, label: "History", count: ledger.length },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setPortTab(t.id)}
                            className={`px-4 sm:px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${portTab === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-white dark:bg-white/5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-white/10"}`}
                        >
                            {t.label}{"count" in t && t.count != null ? ` · ${t.count}` : ""}
                        </button>
                    ))}
                </div>

                {/* Interactive analytics */}
                {portTab === "analytics" && (
                <div className="bg-white dark:bg-zinc-900/50 rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="text-sm font-black uppercase tracking-tighter italic flex items-center gap-2"><BarChart3 className="w-4 h-4 shrink-0" strokeWidth={2} /> Portfolio Analytics</h2>
                        <div className="flex bg-zinc-100 dark:bg-white/5 p-1 rounded-xl border border-zinc-200 dark:border-white/10 self-start sm:self-auto">
                            {([["alloc", "Allocation"], ["perf", "Performance"], ["timeline", "Timeline"]] as const).map(([v, l]) => (
                                <button key={v} onClick={() => setChartView(v)} className={`px-3 sm:px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${chartView === v ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}>{l}</button>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 sm:p-6">
                        {rows.length === 0 && chartView !== "timeline" ? (
                            <div className="py-16 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">Add a holding to see analytics</div>
                        ) : chartView === "alloc" ? (
                            <div>
                                <div className="flex justify-center sm:justify-end mb-3">
                                    <div className="flex bg-zinc-100 dark:bg-white/5 p-0.5 rounded-lg">
                                        <button onClick={() => setAllocBy("pos")} className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest ${allocBy === "pos" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500"}`}>By Position</button>
                                        <button onClick={() => setAllocBy("type")} className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest ${allocBy === "type" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500"}`}>By Class</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 items-center">
                                    <div className="min-w-0 w-full h-[300px] sm:h-[360px] relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={allocData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                                    innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none"
                                                    {...({
                                                        activeIndex: activeIdx ?? undefined,
                                                        activeShape: renderActiveSlice,
                                                        onMouseEnter: (_: any, i: number) => setActiveIdx(i),
                                                        onMouseLeave: () => setActiveIdx(null),
                                                    } as any)}
                                                >
                                                    {allocData.map((d, i) => <Cell key={i} fill={d.color} opacity={activeIdx == null || activeIdx === i ? 1 : 0.4} style={{ transition: "opacity .2s", cursor: "pointer" }} />)}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        {/* Center readout reflects the hovered slice */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-8 text-center">
                                            {activeIdx != null && allocData[activeIdx] ? (
                                                <>
                                                    <span className="w-3 h-3 rounded-sm mb-1" style={{ background: allocData[activeIdx].color }} />
                                                    <span className="text-xs font-black uppercase tracking-tight truncate max-w-full">{allocData[activeIdx].name}</span>
                                                    <span className="text-base sm:text-lg font-black font-mono tabular-nums">{fmt(allocData[activeIdx].value)}</span>
                                                    <span className="text-[10px] font-black text-blue-500">{allocTotal > 0 ? ((allocData[activeIdx].value / allocTotal) * 100).toFixed(1) : "0"}%</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Total Value</span>
                                                    <span className="text-lg sm:text-2xl font-black font-mono tabular-nums">{fmt(allocTotal)}</span>
                                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{allocData.length} assets · hover to inspect</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1 max-h-[360px] overflow-y-auto custom-scrollbar pr-1 min-w-0">
                                        {allocData.map((d, i) => (
                                            <button
                                                key={i} type="button"
                                                onMouseEnter={() => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)}
                                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-all ${activeIdx === i ? "bg-zinc-100 dark:bg-white/[0.06]" : "hover:bg-zinc-50 dark:hover:bg-white/[0.03]"}`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0"><span className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.color }} /><span className="text-xs font-black truncate">{d.name}</span></div>
                                                <div className="text-right shrink-0"><span className="text-xs font-mono font-black tabular-nums">{fmt(d.value)}</span><span className="text-[9px] text-zinc-400 font-black ml-2 tabular-nums">{allocTotal > 0 ? ((d.value / allocTotal) * 100).toFixed(1) : "0"}%</span></div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : chartView === "perf" ? (
                            <div>
                                <div className="flex justify-center sm:justify-end mb-3">
                                    <div className="flex bg-zinc-100 dark:bg-white/5 p-0.5 rounded-lg">
                                        <button onClick={() => setPerfMetric("total")} className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest ${perfMetric === "total" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500"}`}>Total P/L</button>
                                        <button onClick={() => setPerfMetric("day")} className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest ${perfMetric === "day" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500"}`}>Day P/L</button>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={perfData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={perfData.length > 6 ? -30 : 0} textAnchor={perfData.length > 6 ? "end" : "middle"} height={perfData.length > 6 ? 50 : 20} />
                                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => compact(v)} />
                                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} formatter={(v: any) => [signed(v as number), perfMetric === "day" ? "Day P/L" : "Total P/L"]} />
                                        <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                                            {perfData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "#22c55e" : "#ef4444"} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            timelineData.length === 0 ? (
                                <div className="py-16 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">Record trades to build your timeline</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={timelineData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                                        <defs><linearGradient id="pf-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} minTickGap={28} />
                                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => compact(v)} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmt(v as number), "Capital Deployed"]} />
                                        <Area type="monotone" dataKey="invested" stroke="#3b82f6" strokeWidth={2} fill="url(#pf-grad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )
                        )}
                    </div>
                </div>
                )}

                {/* Current holdings */}
                {portTab === "holdings" && (
                <div className="bg-white dark:bg-zinc-900/50 rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-black uppercase tracking-tighter italic">Current Holdings</h2>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{pricesLoading ? "Pricing…" : `${rows.length} positions · ${book.updated}`}</span>
                    </div>
                    {rows.length === 0 ? (
                        <div className="py-16 text-center px-4">
                            <BarChart3 className="w-8 h-8 mx-auto mb-3 text-zinc-400" strokeWidth={1.5} />
                            <p className="text-zinc-500 font-black uppercase tracking-widest text-[11px] mb-1">No open positions</p>
                            <p className="text-zinc-400 text-[10px] mb-4">Add a Buy trade — stocks, crypto, forex or commodities — to start tracking P/L.</p>
                            <button onClick={() => setShowAdd(true)} className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-b border-blue-500/40 hover:border-blue-500">+ Add your first trade</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[8px] sm:text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-white/5">
                                        <th className="px-3 sm:px-6 py-3">Asset</th>
                                        <th className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">Qty</th>
                                        <th className="px-3 sm:px-4 py-3 text-right hidden lg:table-cell">Avg Cost</th>
                                        <th className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">Current</th>
                                        <th className="px-3 sm:px-4 py-3 text-right hidden lg:table-cell">Invested</th>
                                        <th className="px-3 sm:px-4 py-3 text-right">Value</th>
                                        <th className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">Day P/L</th>
                                        <th className="px-3 sm:px-6 py-3 text-right">Total P/L</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                                    {rows.map(r => (
                                        <tr key={`${r.assetType}:${r.symbol}:${r.currency}`} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                                            <td className="px-3 sm:px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${typeBadge(r.assetType)}`}>{r.assetType}</span>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black tracking-tight truncate">{r.symbol}</div>
                                                        <div className="text-[9px] text-zinc-400 font-bold truncate max-w-[160px]">{r.name || "—"}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs tabular-nums hidden sm:table-cell">{r.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                            <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs tabular-nums text-zinc-500 hidden lg:table-cell">{fmt(r.avgCost, r.currency)}</td>
                                            <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs tabular-nums hidden md:table-cell">{fmt(r.current, r.currency)}</td>
                                            <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs tabular-nums text-zinc-500 hidden lg:table-cell">{fmt(r.invested, r.currency)}</td>
                                            <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs tabular-nums font-black">{fmt(r.value, r.currency)}</td>
                                            <td className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">
                                                <div className={`font-mono text-xs font-black tabular-nums ${r.dayPnl == null ? "text-zinc-400" : r.dayPnl >= 0 ? "text-green-500" : "text-red-500"}`}>{signed(r.dayPnl, r.currency)}</div>
                                                {r.dayPct != null && <div className={`text-[9px] font-black ${r.dayPct >= 0 ? "text-green-500" : "text-red-500"}`}>{r.dayPct >= 0 ? "▲" : "▼"} {Math.abs(r.dayPct).toFixed(2)}%</div>}
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 text-right">
                                                <div className={`font-mono text-xs font-black tabular-nums ${r.pnl == null ? "text-zinc-400" : r.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>{signed(r.pnl, r.currency)}</div>
                                                {r.pnlPct != null && <div className={`text-[9px] font-black ${r.pnlPct >= 0 ? "text-green-500" : "text-red-500"}`}>{r.pnlPct >= 0 ? "▲" : "▼"} {Math.abs(r.pnlPct).toFixed(2)}%</div>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                )}

                {/* Trade ledger (previous trading) with date filter */}
                {portTab === "history" && (
                <div className="bg-white dark:bg-zinc-900/50 rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="text-sm font-black uppercase tracking-tighter italic">Trade History <span className="text-zinc-400">· {ledger.length}</span></h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">From</span>
                            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">To</span>
                            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                            {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:underline">Clear</button>}
                        </div>
                    </div>
                    {ledger.length === 0 ? (
                        <div className="py-14 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">No trades {from || to ? "in this date range" : "yet"}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[8px] sm:text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-white/5">
                                        <th className="px-3 sm:px-6 py-3 hidden sm:table-cell">Date</th>
                                        <th className="px-3 sm:px-4 py-3">Type</th>
                                        <th className="px-3 sm:px-4 py-3">Asset</th>
                                        <th className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">Qty</th>
                                        <th className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">Price</th>
                                        <th className="px-3 sm:px-4 py-3 text-right">Value</th>
                                        <th className="px-3 sm:px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                                    {ledger.map(t => (
                                        <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                                            <td className="px-3 sm:px-6 py-3 font-mono text-[11px] tabular-nums text-zinc-500 hidden sm:table-cell">{t.date}</td>
                                            <td className="px-3 sm:px-4 py-3"><span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${t.type === "BUY" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>{t.type}</span></td>
                                            <td className="px-3 sm:px-4 py-3">
                                                <span className="text-xs font-black">{t.symbol}</span> <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded ${typeBadge(t.assetType)}`}>{t.assetType}</span>
                                                <span className="sm:hidden block text-[9px] font-mono text-zinc-400 tabular-nums mt-0.5">{t.date}</span>
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs tabular-nums hidden md:table-cell">{t.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                            <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs tabular-nums hidden sm:table-cell">{fmt(t.price, t.currency)}</td>
                                            <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs tabular-nums font-black">{fmt(t.quantity * t.price, t.currency)}</td>
                                            <td className="px-3 sm:px-6 py-3 text-right"><button onClick={() => remove(t)} className="text-zinc-400 hover:text-red-500 text-sm px-2" title="Delete">✕</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {ledger.length > 0 && (
                        <div className="px-4 sm:px-6 py-3 border-t border-zinc-100 dark:border-white/5 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-[10px] font-black uppercase tracking-widest">
                            <span className="text-zinc-400">Bought <span className="text-green-500">{fmt(ledger.filter(t => t.type === "BUY").reduce((a, t) => a + convert(t.quantity * t.price, t.currency, displayCur, rate), 0))}</span></span>
                            <span className="text-zinc-400">Sold <span className="text-red-500">{fmt(ledger.filter(t => t.type === "SELL").reduce((a, t) => a + convert(t.quantity * t.price, t.currency, displayCur, rate), 0))}</span></span>
                        </div>
                    )}
                </div>
                )}
            </main>
        </div>
    );
}
