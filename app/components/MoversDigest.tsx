"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Flame, Star, type LucideIcon } from "lucide-react";

interface Stock {
    symbol: string;
    name: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    volume: string;
    sector?: string;
}

interface MoversDigestProps {
    stocks: Stock[];
    watchlists?: any[];
    loading?: boolean;
    onSelect: (symbol: string) => void;
}

const parseVol = (v: string | number | undefined): number => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    const n = parseInt(v.toString().replace(/,/g, ""), 10);
    return isNaN(n) ? 0 : n;
};

const fmtVol = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
};

function MoverRow({ stock, rank, meta, onSelect }: { stock: Stock; rank: number; meta?: string; onSelect: (s: string) => void }) {
    const isPos = (stock.changePercent || 0) >= 0;
    return (
        <button
            onClick={() => onSelect(stock.symbol)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-all group text-left"
        >
            <span className="w-5 shrink-0 text-[10px] font-black text-zinc-300 dark:text-zinc-600 tabular-nums">{rank}</span>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs font-black text-zinc-900 dark:text-white tracking-tight group-hover:text-blue-600 transition-colors truncate">{stock.symbol}</p>
                <p className="text-[8px] sm:text-[9px] font-bold text-zinc-400 uppercase tracking-wide truncate">{meta || stock.name}</p>
            </div>
            <div className="text-right shrink-0">
                <p className="text-[11px] sm:text-xs font-mono font-black text-zinc-900 dark:text-zinc-100 tabular-nums leading-tight">
                    {stock.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-[9px] sm:text-[10px] font-black tabular-nums leading-tight ${isPos ? "text-green-500" : "text-red-500"}`}>
                    {isPos ? "▲" : "▼"}{Math.abs(stock.changePercent || 0).toFixed(2)}%
                </p>
            </div>
        </button>
    );
}

function DigestColumn({ title, icon: Icon, tone, accent, children, empty }: { title: string; icon: LucideIcon; tone: string; accent: string; children: React.ReactNode; empty?: boolean }) {
    return (
        <div className="bg-white dark:bg-zinc-900/40 backdrop-blur-sm rounded-[1.5rem] sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-white/5">
                <Icon className={`w-4 h-4 shrink-0 ${tone}`} strokeWidth={2.25} />
                <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">{title}</h3>
                <span className={`ml-auto w-1.5 h-1.5 rounded-full ${accent}`}></span>
            </div>
            <div className="p-1.5 flex-1">
                {empty ? (
                    <div className="py-10 text-center">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">No data</p>
                    </div>
                ) : children}
            </div>
        </div>
    );
}

export default function MoversDigest({ stocks, watchlists = [], loading = false, onSelect }: MoversDigestProps) {
    const { gainers, losers, active, watchMovers } = useMemo(() => {
        const valid = (stocks || []).filter(s => s && s.symbol && typeof s.changePercent === "number");

        const gainers = [...valid].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0)).slice(0, 3);
        const losers = [...valid].sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0)).slice(0, 3);
        const active = [...valid].sort((a, b) => parseVol(b.volume) - parseVol(a.volume)).slice(0, 3);

        const watchSymbols = new Set<string>();
        (watchlists || []).forEach(wl => (wl?.symbols || []).forEach((s: string) => watchSymbols.add(s.toUpperCase())));
        const watchMovers = valid
            .filter(s => watchSymbols.has(s.symbol.toUpperCase()))
            .sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))
            .slice(0, 3);

        return { gainers, losers, active, watchMovers };
    }, [stocks, watchlists]);

    const hasWatch = watchMovers.length > 0;

    if (loading) {
        return (
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasWatch ? "xl:grid-cols-4" : "xl:grid-cols-3"} gap-3 sm:gap-6`}>
                {Array.from({ length: hasWatch ? 4 : 3 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900/40 rounded-[2rem] border border-zinc-200 dark:border-white/5 p-4 animate-pulse">
                        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-24 mb-4"></div>
                        {Array.from({ length: 5 }).map((_, j) => (
                            <div key={j} className="flex justify-between py-2.5">
                                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-16"></div>
                                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-10"></div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasWatch ? "xl:grid-cols-4" : "xl:grid-cols-3"} gap-3 sm:gap-6`}>
            <DigestColumn title="Top Gainers" icon={TrendingUp} tone="text-green-500" accent="bg-green-500" empty={gainers.length === 0}>
                {gainers.map((s, i) => <MoverRow key={s.symbol} stock={s} rank={i + 1} onSelect={onSelect} />)}
            </DigestColumn>

            <DigestColumn title="Top Losers" icon={TrendingDown} tone="text-red-500" accent="bg-red-500" empty={losers.length === 0}>
                {losers.map((s, i) => <MoverRow key={s.symbol} stock={s} rank={i + 1} onSelect={onSelect} />)}
            </DigestColumn>

            <DigestColumn title="Most Active" icon={Flame} tone="text-orange-500" accent="bg-blue-500" empty={active.length === 0}>
                {active.map((s, i) => <MoverRow key={s.symbol} stock={s} rank={i + 1} meta={`Vol ${fmtVol(parseVol(s.volume))}`} onSelect={onSelect} />)}
            </DigestColumn>

            {hasWatch && (
                <DigestColumn title="Your Watchlist" icon={Star} tone="text-amber-500" accent="bg-amber-500">
                    {watchMovers.map((s, i) => <MoverRow key={s.symbol} stock={s} rank={i + 1} onSelect={onSelect} />)}
                </DigestColumn>
            )}
        </div>
    );
}
