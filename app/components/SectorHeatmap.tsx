"use client";

import { useMemo } from "react";
import { parseVolume, formatVolume, heatSolid } from "../lib/stockSignals";

interface Stock {
    symbol: string;
    name: string;
    currentPrice: number;
    change?: number;
    changePercent: number;
    volume: string;
    sector?: string;
}

interface SectorHeatmapProps {
    stocks: Stock[];
    onSelectSector?: (sector: string) => void;
    onSelectSymbol?: (symbol: string) => void;
}

interface SectorGroup {
    sector: string;
    avgChange: number;      // volume-weighted average % change
    advancers: number;
    decliners: number;
    totalVolume: number;
    sectorValue: number;    // sum of per-stock areas (floored ≥ 1) for treemap sizing
    stocks: Stock[];        // ALL stocks in the sector, sorted by turnover
}

// ── Squarified treemap ──────────────────────────────────────────────────────
interface R { x: number; y: number; w: number; h: number; }

const worst = (row: number[], side: number, sum: number): number => {
    let mx = -Infinity, mn = Infinity;
    for (const a of row) { if (a > mx) mx = a; if (a < mn) mn = a; }
    const s2 = sum * sum, side2 = side * side;
    return Math.max((side2 * mx) / s2, s2 / (side2 * mn));
};

function squarify<T>(items: { v: number; d: T }[], rect: R): (R & { d: T })[] {
    const sorted = [...items].sort((a, b) => b.v - a.v);
    const total = sorted.reduce((s, i) => s + i.v, 0) || 1;
    const area = rect.w * rect.h;
    const scaled = sorted.map(it => ({ d: it.d, a: (it.v / total) * area }));

    const out: (R & { d: T })[] = [];
    let { x, y, w, h } = rect;
    let row: { d: T; a: number }[] = [];

    const layout = (r: { d: T; a: number }[]) => {
        const sum = r.reduce((s, i) => s + i.a, 0);
        if (sum <= 0) return;
        if (w >= h) {
            const colW = sum / h;
            let cy = y;
            for (const it of r) { const rh = it.a / colW; out.push({ d: it.d, x, y: cy, w: colW, h: rh }); cy += rh; }
            x += colW; w -= colW;
        } else {
            const rowH = sum / w;
            let cx = x;
            for (const it of r) { const rw = it.a / rowH; out.push({ d: it.d, x: cx, y, w: rw, h: rowH }); cx += rw; }
            y += rowH; h -= rowH;
        }
    };

    let i = 0;
    while (i < scaled.length) {
        const it = scaled[i];
        const side = Math.min(w, h) || 1;
        if (row.length === 0) { row.push(it); i++; continue; }
        const sum = row.reduce((s, r) => s + r.a, 0);
        const cur = worst(row.map(r => r.a), side, sum);
        const nxt = worst([...row.map(r => r.a), it.a], side, sum + it.a);
        if (nxt <= cur) { row.push(it); i++; }
        else { layout(row); row = []; }
    }
    if (row.length) layout(row);
    return out;
}

const TM_W = 1000, TM_H = 700, TM_GAP = 2;

export default function SectorHeatmap({ stocks, onSelectSector, onSelectSymbol }: SectorHeatmapProps) {
    const sectors = useMemo<SectorGroup[]>(() => {
        const map = new Map<string, Stock[]>();
        (stocks || []).forEach(s => {
            if (!s || !s.symbol) return;
            const key = s.sector || "Other";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(s);
        });

        const groups: SectorGroup[] = [];
        map.forEach((list, sector) => {
            let weighted = 0, weight = 0, adv = 0, dec = 0, vol = 0, secVal = 0;
            list.forEach(s => {
                const w = parseVolume(s.volume) || 1;
                weighted += (s.changePercent || 0) * w;
                weight += w;
                vol += parseVolume(s.volume);
                secVal += Math.max(parseVolume(s.volume), 1);
                if ((s.changePercent || 0) > 0) adv++;
                else if ((s.changePercent || 0) < 0) dec++;
            });
            const sorted = [...list].sort((a, b) => parseVolume(b.volume) - parseVolume(a.volume));
            groups.push({
                sector,
                avgChange: weight > 0 ? weighted / weight : 0,
                advancers: adv, decliners: dec, totalVolume: vol, sectorValue: secVal,
                stocks: sorted,
            });
        });

        return groups.sort((a, b) => b.totalVolume - a.totalVolume);
    }, [stocks]);

    const totalCount = useMemo(() => sectors.reduce((n, s) => n + s.stocks.length, 0), [sectors]);

    // Nested treemap: sectors → stocks sized by turnover.
    const treemap = useMemo(() => {
        const secRects = squarify(sectors.map(s => ({ v: s.sectorValue, d: s })), { x: 0, y: 0, w: TM_W, h: TM_H });
        const cells: { r: R; s: Stock }[] = [];
        const frames: { r: R; sec: SectorGroup; headerH: number }[] = [];

        secRects.forEach(sr => {
            const x = sr.x + TM_GAP, y = sr.y + TM_GAP;
            const w = Math.max(0, sr.w - TM_GAP * 2), h = Math.max(0, sr.h - TM_GAP * 2);
            if (w <= 1 || h <= 1) return;
            const headerH = h > 30 ? Math.min(20, Math.max(11, h * 0.07)) : 0;
            frames.push({ r: { x, y, w, h }, sec: sr.d, headerH });
            const inner: R = { x, y: y + headerH, w, h: h - headerH };
            if (inner.h > 2 && inner.w > 2) {
                const stRects = squarify(sr.d.stocks.map(st => ({ v: Math.max(parseVolume(st.volume), 1), d: st })), inner);
                stRects.forEach(c => cells.push({ r: { x: c.x, y: c.y, w: c.w, h: c.h }, s: c.d }));
            }
        });

        return { cells, frames };
    }, [sectors]);

    if (sectors.length === 0) {
        return (
            <div className="py-32 text-center bg-zinc-50 dark:bg-white/5 rounded-[3rem] border border-dashed border-zinc-200 dark:border-white/10">
                <span className="text-4xl block mb-4">🗺️</span>
                <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">No sector data</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Market Map · {totalCount} scrips · sized by volume</span>
                <div className="hidden sm:flex items-center gap-1.5">
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">−7.5%</span>
                    <span className="h-2.5 w-16 rounded-full" style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.6), rgba(239,68,68,0.15), rgba(120,120,120,0.2), rgba(34,197,94,0.15), rgba(34,197,94,0.6))" }}></span>
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">+7.5%</span>
                </div>
            </div>

            {/* Squarified treemap: tile area ∝ volume, grouped by sector */}
            <div className="w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-black">
                    <svg viewBox={`0 0 ${TM_W} ${TM_H}`} className="w-full h-auto block select-none" style={{ fontFamily: 'inherit' }}>
                        {/* stock tiles */}
                        {treemap.cells.map((c, i) => {
                            const { x, y, w, h } = c.r;
                            const s = c.s;
                            const chg = s.changePercent || 0;
                            const heat = heatSolid(chg);
                            const cx = x + w / 2, cy = y + h / 2;
                            const pad = 1.5;
                            const iw = w - pad * 2, ih = h - pad * 2;
                            const len = Math.max(3, s.symbol.length);
                            // Size so the symbol fits the tile width with a margin (prevents bleed).
                            let fs = Math.min(ih * 0.42, (iw * 0.9) / (len * 0.6));
                            fs = Math.min(fs, 30);
                            const showSym = fs >= 4.5 && iw > 12 && ih > 9;
                            const showDetails = ih >= 46 && iw >= 52;
                            const showVol = ih >= 66 && iw >= 52;
                            const symFs = showDetails ? Math.min(fs, ih * 0.30, (iw * 0.9) / (len * 0.6), 30) : fs;
                            const textFill = heat.text;
                            const subFill = heat.sub;
                            const clipId = `tile-${i}`;
                            return (
                                <g key={`${s.symbol}-${i}`} className="cursor-pointer" onClick={() => onSelectSymbol?.(s.symbol)}>
                                    <clipPath id={clipId}><rect x={x} y={y} width={w} height={h} /></clipPath>
                                    <rect x={x} y={y} width={w} height={h} fill={heat.fill} stroke="rgba(255,255,255,0.5)" strokeWidth={0.6} className="transition-all hover:brightness-110" />
                                    <title>{`${s.symbol} · ${s.name}\n${s.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}  ${(s.change ?? 0) >= 0 ? '+' : ''}${(s.change ?? 0).toFixed(2)} (${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%)\nVol ${s.volume}`}</title>
                                    <g clipPath={`url(#${clipId})`} style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.4)', strokeLinejoin: 'round' }}>
                                        {showSym && !showDetails && (
                                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={textFill} strokeWidth={symFs * 0.1} style={{ fontSize: symFs, fontWeight: 900, letterSpacing: -0.3 }}>{s.symbol}</text>
                                        )}
                                        {showSym && showDetails && (
                                            <>
                                                <text x={cx} y={cy - ih * 0.16} textAnchor="middle" dominantBaseline="central" fill={textFill} strokeWidth={symFs * 0.1} style={{ fontSize: symFs, fontWeight: 900, letterSpacing: -0.3 }}>{s.symbol}</text>
                                                <text x={cx} y={cy + ih * 0.06} textAnchor="middle" dominantBaseline="central" fill={textFill} strokeWidth={symFs * 0.05} style={{ fontSize: symFs * 0.5, fontWeight: 800 }}>{s.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</text>
                                                <text x={cx} y={cy + ih * 0.22} textAnchor="middle" dominantBaseline="central" fill={subFill} strokeWidth={symFs * 0.04} style={{ fontSize: symFs * 0.42, fontWeight: 700 }}>{(s.change ?? 0) >= 0 ? '+' : ''}{(s.change ?? 0).toFixed(2)} ({chg >= 0 ? '+' : ''}{chg.toFixed(2)}%)</text>
                                                {showVol && (
                                                    <text x={cx} y={cy + ih * 0.36} textAnchor="middle" dominantBaseline="central" fill={subFill} strokeWidth={symFs * 0.04} style={{ fontSize: symFs * 0.38, fontWeight: 700 }}>{formatVolume(parseVolume(s.volume))}</text>
                                                )}
                                            </>
                                        )}
                                    </g>
                                </g>
                            );
                        })}

                        {/* sector frames + headers (drawn on top) */}
                        {treemap.frames.map((f, i) => {
                            const { x, y, w, h } = f.r;
                            const hh = f.headerH;
                            const hfs = Math.min(hh * 0.62, 11);
                            const isPos = f.sec.avgChange >= 0;
                            const pctStr = `${isPos ? '+' : ''}${f.sec.avgChange.toFixed(1)}%`;
                            const showPctHdr = w > 70;
                            // Reserve room on the right for the % so the name never collides with it.
                            const pctW = showPctHdr ? pctStr.length * hfs * 0.62 + 8 : 0;
                            const availW = w - 6 - pctW;
                            const maxChars = Math.max(2, Math.floor(availW / (hfs * 0.6)));
                            const name = f.sec.sector.length > maxChars ? f.sec.sector.slice(0, Math.max(1, maxChars - 1)) + "…" : f.sec.sector;
                            const hdrClip = `hdr-${i}`;
                            return (
                                <g key={`f-${i}`}>
                                    <rect x={x} y={y} width={w} height={h} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={1} />
                                    {hh > 0 && (
                                        <g className="cursor-pointer" onClick={() => onSelectSector?.(f.sec.sector)}>
                                            <clipPath id={hdrClip}><rect x={x} y={y} width={w} height={hh} /></clipPath>
                                            <rect x={x} y={y} width={w} height={hh} fill="#18181b" />
                                            <text x={x + 4} y={y + hh / 2} dominantBaseline="central" clipPath={`url(#${hdrClip})`} fill="#ffffff" style={{ fontSize: hfs, fontWeight: 800, letterSpacing: 0.2 }}>{name}</text>
                                            {showPctHdr && (
                                                <text x={x + w - 4} y={y + hh / 2} textAnchor="end" dominantBaseline="central" fill={isPos ? "#4ade80" : "#f87171"} style={{ fontSize: hfs * 0.95, fontWeight: 800 }}>{pctStr}</text>
                                            )}
                                        </g>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
        </div>
    );
}
