"use client";

import { dayRangePosition, circuitStatus } from "../lib/stockSignals";

interface Stock {
    symbol: string;
    name: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    open: number;
    high: number;
    low: number;
    volume: string;
    sector?: string;
}

interface CompareTrayProps {
    stocks: Stock[];       // currently selected (max ~4)
    onRemove: (symbol: string) => void;
    onClear: () => void;
    onOpen: (symbol: string) => void;
}

const Metric = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
        <span className="font-mono font-black tabular-nums text-zinc-900 dark:text-white">{children}</span>
    </div>
);

export default function CompareTray({ stocks, onRemove, onClear, onOpen }: CompareTrayProps) {
    if (stocks.length === 0) return null;

    // Best performer among the selection (for a subtle "winner" highlight)
    const best = stocks.reduce((a, b) => ((b.changePercent || 0) > (a.changePercent || 0) ? b : a), stocks[0]);

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[80] px-3 sm:px-6 pb-3 sm:pb-6 pointer-events-none">
            <div className="max-w-[1600px] mx-auto pointer-events-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">⚖️</span>
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">Compare · {stocks.length}/4</span>
                    </div>
                    <button onClick={onClear} className="text-[9px] font-black text-zinc-400 hover:text-red-500 uppercase tracking-widest transition-colors">Clear all ✕</button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-100 dark:divide-white/5">
                    {stocks.map(s => {
                        const isPos = (s.changePercent || 0) >= 0;
                        const pos = dayRangePosition(s.low, s.high, s.currentPrice);
                        const cs = circuitStatus(s.changePercent);
                        const isBest = s.symbol === best.symbol && stocks.length > 1;
                        return (
                            <div key={s.symbol} className={`p-3 sm:p-4 space-y-2 ${isBest ? 'bg-green-500/5' : ''}`}>
                                <div className="flex items-start justify-between gap-1">
                                    <button onClick={() => onOpen(s.symbol)} className="min-w-0 text-left group">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">{s.symbol}</span>
                                            {isBest && <span className="text-[8px]">🏆</span>}
                                        </div>
                                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest truncate">{s.sector || '—'}</p>
                                    </button>
                                    <button onClick={() => onRemove(s.symbol)} className="text-zinc-300 hover:text-red-500 text-xs shrink-0" title="Remove">✕</button>
                                </div>

                                <div>
                                    <p className="text-base sm:text-lg font-black font-mono tabular-nums text-zinc-900 dark:text-white leading-none">{s.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    <p className={`text-[10px] font-black ${isPos ? 'text-green-500' : 'text-red-500'}`}>
                                        {isPos ? '▲' : '▼'}{Math.abs(s.changePercent || 0).toFixed(2)}% {cs?.includes('lock') ? '🔒' : ''}
                                    </p>
                                </div>

                                <div className="space-y-1 pt-1 border-t border-zinc-100 dark:border-white/5">
                                    <Metric label="Open">{s.open?.toFixed(1)}</Metric>
                                    <Metric label="High">{s.high?.toFixed(1)}</Metric>
                                    <Metric label="Low">{s.low?.toFixed(1)}</Metric>
                                    <Metric label="Vol">{s.volume}</Metric>
                                    <Metric label="Range">{pos != null ? `${pos.toFixed(0)}%` : '—'}</Metric>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
