"use client";

import { useEffect, useState } from "react";
import { dayRangePosition } from "../lib/stockSignals";
import { getMetalTarget, setMetalTarget, type MetalTarget } from "../lib/stockPrefs";

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
}

export default function MetalStatCard({
    metal, label, icon, unitLabel, currentPrice, change = 0, changePercent = 0, low52, high52, accent,
}: MetalStatCardProps) {
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
        const v = parseFloat(input.replace(/,/g, ""));
        setMetalTarget(metal, Number.isFinite(v) && v > 0 ? v : null, currentPrice || 0);
        setEditing(false);
    };

    const fmt = (n?: number | null) => (n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 0 }));

    return (
        <div className={`rounded-2xl sm:rounded-[2rem] p-5 sm:p-6 text-white relative overflow-hidden bg-gradient-to-br ${accent} shadow-xl`}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-12 translate-x-8 pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{icon}</span>
                        <div>
                            <h3 className="text-sm font-black uppercase italic tracking-tighter leading-none">{label}</h3>
                            <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mt-0.5">{unitLabel}</p>
                        </div>
                    </div>
                    {hit && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-white text-emerald-600 animate-pulse">🎯 Target hit</span>
                    )}
                </div>

                <div className="flex items-end justify-between gap-2 mb-5">
                    <div>
                        <p className="text-2xl sm:text-4xl font-black font-mono tracking-tighter leading-none">
                            <span className="text-sm sm:text-lg font-medium mr-1 text-white/70">Rs.</span>{fmt(currentPrice)}
                        </p>
                    </div>
                    <div className={`text-right ${isPos ? 'text-emerald-200' : 'text-red-200'}`}>
                        <p className="text-sm font-black font-mono leading-none">{isPos ? '▲' : '▼'} {Math.abs(changePercent || 0).toFixed(2)}%</p>
                        <p className="text-[10px] font-bold opacity-80">{isPos ? '+' : ''}{Math.round(change || 0).toLocaleString()}</p>
                    </div>
                </div>

                {/* 52-week range bar */}
                <div className="mb-4">
                    <div className="flex items-center justify-between text-[8px] font-black text-white/70 uppercase tracking-widest mb-1.5">
                        <span>52W Low {fmt(low52)}</span>
                        <span>52W High {fmt(high52)}</span>
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

                {/* Target alert */}
                <div className="pt-3 border-t border-white/15">
                    {editing ? (
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-xs font-bold">Rs.</span>
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
                            <button onClick={save} className="bg-white text-zinc-900 text-[10px] font-black uppercase px-3 py-2 rounded-xl">Save</button>
                            <button onClick={() => setEditing(false)} className="text-white/70 hover:text-white px-1">✕</button>
                        </div>
                    ) : target ? (
                        <button onClick={() => { setInput(String(target.value)); setEditing(true); }} className="w-full flex items-center justify-between gap-2 group">
                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/80">
                                🎯 Target Rs.{fmt(target.value)}
                            </span>
                            <span className="text-[10px] font-black tabular-nums text-white/70 group-hover:text-white">
                                {hit ? 'Reached' : `${awayPct != null ? (awayPct >= 0 ? '+' : '') + awayPct.toFixed(1) + '%' : ''} away`}
                            </span>
                        </button>
                    ) : (
                        <button onClick={() => { setInput(""); setEditing(true); }} className="w-full text-center text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors">
                            🎯 Set a price target
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
