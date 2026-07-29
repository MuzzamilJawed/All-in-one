"use client";

import { useEffect, useState } from "react";
import { Target, Medal, Gem, Trash2 } from "lucide-react";
import { dayRangePosition } from "../lib/stockSignals";
import { getMetalTarget, setMetalTarget, type MetalTarget } from "../lib/stockPrefs";
import { useCurrency } from "../context/CurrencyContext";
import { rateOf } from "../lib/currency";
import FitText from "./FitText";

interface MetalStatCardProps {
    metal: "GOLD" | "SILVER";
    label: string;
    icon: string;
    unitLabel: string;        // e.g. "per tola", "per ounce"
    currentPrice?: number;    // PKR
    change?: number;          // PKR
    changePercent?: number;
    low52?: number | null;    // PKR
    high52?: number | null;   // PKR
    accent: string;           // tailwind gradient classes
    /** Implied USD→PKR rate from the metal feed (keeps PKR↔USD in step with it). */
    pkrPerUsd?: number;
}

export default function MetalStatCard({
    metal, label, unitLabel, currentPrice, change = 0, changePercent = 0, low52, high52, accent, pkrPerUsd,
}: MetalStatCardProps) {
    // Every figure arrives in PKR; targets are stored in PKR too. `fx` scales
    // PKR into whichever currency the user is viewing.
    const { currency, sym, rates } = useCurrency();
    const usdPkr = pkrPerUsd && pkrPerUsd > 0 ? pkrPerUsd : rateOf(rates, "PKR");
    const fx = currency === "PKR" ? 1 : rateOf(rates, currency) / usdPkr;
    const show = (v?: number | null) => (v == null ? null : v * fx);

    const [target, setTargetState] = useState<MetalTarget | null>(null);
    const [editing, setEditing] = useState(false);
    const [input, setInput] = useState("");

    useEffect(() => {
        const load = () => setTargetState(getMetalTarget(metal));
        load();
        window.addEventListener("stockprefs", load);
        return () => window.removeEventListener("stockprefs", load);
    }, [metal]);

    const isPos = (change || 0) >= 0;
    const rangePos = dayRangePosition(low52 ?? undefined, high52 ?? undefined, currentPrice);

    // Target status
    let hit = false, awayPct: number | null = null;
    if (target && currentPrice) {
        hit = target.dir === "above" ? currentPrice >= target.value : currentPrice <= target.value;
        awayPct = ((target.value - currentPrice) / currentPrice) * 100;
    }

    const save = () => {
        // The input is typed in the displayed currency — store it back in PKR.
        const v = parseFloat(input.replace(/,/g, ""));
        setMetalTarget(metal, Number.isFinite(v) && v > 0 ? v / fx : null, currentPrice || 0);
        setEditing(false);
    };

    const fmt = (n?: number | null) =>
        n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 });
    const fmtPkr = (n?: number | null) => fmt(show(n));

    return (
        <div className={`rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 text-white relative overflow-hidden bg-gradient-to-br ${accent} shadow-xl`}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-12 translate-x-8 pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        {metal === "GOLD"
                            ? <Medal className="w-5 h-5 shrink-0" strokeWidth={2} />
                            : <Gem className="w-5 h-5 shrink-0" strokeWidth={2} />}
                        <div className="min-w-0">
                            <h3 className="text-sm font-black uppercase italic tracking-tighter leading-none">{label}</h3>
                            <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mt-0.5">{unitLabel}</p>
                        </div>
                    </div>

                    {/* The price target sits in the header's spare space rather than in a
                        row of its own — on a phone that row was pure card height. */}
                    {!editing && (target ? (
                        <button
                            onClick={() => { setInput(String(Number(((target.value * fx)).toFixed(2)))); setEditing(true); }}
                            title={hit ? "Target reached — tap to edit" : "Tap to edit your price target"}
                            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[32px] rounded-full text-[9px] font-black uppercase tracking-widest transition-colors ${hit
                                ? "bg-white text-emerald-600 animate-pulse"
                                : "bg-white/15 hover:bg-white/25 text-white/90"
                                }`}
                        >
                            <Target className="w-3 h-3 shrink-0" strokeWidth={2} />
                            {hit ? "Target hit" : (
                                <>
                                    <span className="tabular-nums">{sym}{fmtPkr(target.value)}</span>
                                    {awayPct != null && (
                                        <span className="tabular-nums text-white/60">{(awayPct >= 0 ? "+" : "") + awayPct.toFixed(1)}%</span>
                                    )}
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => { setInput(""); setEditing(true); }}
                            title="Set a price target"
                            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[32px] rounded-full bg-white/15 hover:bg-white/25 text-[9px] font-black uppercase tracking-widest text-white/80 hover:text-white transition-colors"
                        >
                            <Target className="w-3 h-3 shrink-0" strokeWidth={2} /> Set target
                        </button>
                    ))}
                </div>

                <div className="flex items-end justify-between gap-2 mb-4">
                    <div className="min-w-0 flex-1">
                        <FitText className="text-2xl sm:text-4xl font-black font-mono tracking-tighter leading-none">
                            <span className="text-sm sm:text-lg font-medium mr-1 text-white/70">{sym}</span>{fmtPkr(currentPrice)}
                        </FitText>
                    </div>
                    <div className={`text-right shrink-0 ${isPos ? 'text-emerald-200' : 'text-red-200'}`}>
                        <p className="text-sm font-black font-mono leading-none">{isPos ? '▲' : '▼'} {Math.abs(changePercent || 0).toFixed(2)}%</p>
                        <p className="text-[10px] font-bold opacity-80">{isPos ? '+' : ''}{fmtPkr(change || 0)}</p>
                    </div>
                </div>

                {/* 52-week range bar */}
                <div>
                    <div className="flex items-center justify-between text-[8px] font-black text-white/70 uppercase tracking-widest mb-1.5">
                        <span>52W Low {fmtPkr(low52)}</span>
                        <span>52W High {fmtPkr(high52)}</span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-white/20">
                        {rangePos != null && (
                            <div
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-white/60 shadow"
                                style={{ left: `${rangePos}%` }}
                                title={`${rangePos.toFixed(0)}% of 52-week range`}
                            ></div>
                        )}
                    </div>
                </div>

                {/* The editor only exists while it is being used, so the card keeps
                    its short resting height. */}
                {editing && (
                    <div className="mt-4 pt-3 border-t border-white/15">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-xs font-bold">{sym}</span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    autoFocus
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && save()}
                                    placeholder={`Target ${unitLabel}`}
                                    className="w-full bg-white/15 border border-white/20 rounded-xl pl-9 pr-3 py-2 text-sm font-black text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40"
                                />
                            </div>
                            <button onClick={save} className="shrink-0 bg-white text-zinc-900 text-[10px] font-black uppercase px-3 py-2 min-h-[36px] rounded-xl">Save</button>
                            <button
                                onClick={() => setEditing(false)}
                                aria-label="Cancel"
                                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                ✕
                            </button>
                            {target && (
                                <button
                                    onClick={() => { setMetalTarget(metal, null, currentPrice || 0); setEditing(false); }}
                                    aria-label="Remove target"
                                    title="Remove target"
                                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" strokeWidth={2} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
