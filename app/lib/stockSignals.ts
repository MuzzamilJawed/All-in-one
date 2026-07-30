// Derived daily-analysis signals for PSX scrips.
// Everything here is computed from the fields the /api/psx-stocks feed already
// returns (price, change, %change, open, high, low, volume). No extra requests.
//
// NOTE: PSX equities move within a ±7.5% circuit breaker on last day close.
// We flag "locked" a touch below the exact cap to absorb rounding in the feed.

import { Lock, AlertTriangle, Zap, Target, ChevronUp, ChevronDown, type LucideIcon } from "lucide-react";

export const CIRCUIT_CAP = 7.5;
const LOCK_THRESHOLD = 7.35;   // treat as fully locked at/above this
const NEAR_THRESHOLD = 5.5;    // "approaching the cap"
const BIG_MOVE = 4;            // notable intraday move

export type SignalTone = "green" | "red" | "blue" | "amber" | "zinc";

export interface Signal {
    key: string;
    icon: LucideIcon;
    label: string;
    tone: SignalTone;
    title: string; // tooltip / long form
}

export const parseVolume = (v: string | number | undefined | null): number => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (!v) return 0;
    const s = v.toString().trim().toUpperCase().replace(/,/g, "");
    const mult = s.endsWith("M") ? 1_000_000 : s.endsWith("K") ? 1_000 : s.endsWith("B") ? 1_000_000_000 : 1;
    const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n * mult : 0;
};

export const formatVolume = (n: number): string => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
};

export type CircuitStatus = "upper-lock" | "lower-lock" | "near-upper" | "near-lower" | null;

export const circuitStatus = (changePercent: number | undefined): CircuitStatus => {
    const c = changePercent ?? 0;
    if (c >= LOCK_THRESHOLD) return "upper-lock";
    if (c <= -LOCK_THRESHOLD) return "lower-lock";
    if (c >= NEAR_THRESHOLD) return "near-upper";
    if (c <= -NEAR_THRESHOLD) return "near-lower";
    return null;
};

// Position of current price within the session low→high band, as 0..100.
// null when the band is degenerate (no range yet).
export const dayRangePosition = (low?: number, high?: number, price?: number): number | null => {
    if (low == null || high == null || price == null) return null;
    if (!(high > low)) return null;
    const pct = ((price - low) / (high - low)) * 100;
    return Math.max(0, Math.min(100, pct));
};

export const prevClose = (price?: number, change?: number): number | null => {
    if (price == null || change == null) return null;
    return price - change;
};

export interface CircuitLimits {
    /** Last Day Closing Price the caps are measured from. */
    ldcp: number;
    /** Highest price the scrip may trade at today. */
    upper: number;
    /** Lowest price the scrip may trade at today. */
    lower: number;
    /** How far the current price still has to run, in percent (0 when locked). */
    toUpperPct: number;
    toLowerPct: number;
    /** Where the price sits between the two caps, 0..100. */
    position: number;
    status: CircuitStatus;
}

/**
 * The day's upper/lower lock prices for a PSX scrip.
 *
 * PSX caps a scrip's daily move at ±CIRCUIT_CAP% of its last day close, so the
 * band is fixed for the whole session and only moves when LDCP does — i.e. once
 * per day. Pass the feed's `ldcp` when you have it; otherwise it is derived from
 * price − change, which is the same number.
 */
export const circuitLimits = (
    ldcpOrNull?: number | null,
    currentPrice?: number,
    change?: number,
): CircuitLimits | null => {
    const ldcp = ldcpOrNull ?? prevClose(currentPrice, change);
    if (ldcp == null || !(ldcp > 0) || currentPrice == null) return null;

    const band = ldcp * (CIRCUIT_CAP / 100);
    const upper = ldcp + band;
    const lower = ldcp - band;

    const toUpperPct = Math.max(0, ((upper - currentPrice) / currentPrice) * 100);
    const toLowerPct = Math.max(0, ((currentPrice - lower) / currentPrice) * 100);
    const position = upper > lower
        ? Math.max(0, Math.min(100, ((currentPrice - lower) / (upper - lower)) * 100))
        : 50;

    return {
        ldcp,
        upper,
        lower,
        toUpperPct,
        toLowerPct,
        position,
        status: circuitStatus(((currentPrice - ldcp) / ldcp) * 100),
    };
};

interface SignalStock {
    changePercent?: number;
    currentPrice?: number;
    open?: number;
    high?: number;
    low?: number;
}

// Ordered list of the most useful flags for a scrip. UI decides how many to show.
export const computeSignals = (stock: SignalStock, targetPrice?: number | null): Signal[] => {
    const out: Signal[] = [];
    const c = stock.changePercent ?? 0;
    const price = stock.currentPrice;
    const cs = circuitStatus(c);

    if (cs === "upper-lock") {
        out.push({ key: "upper-lock", icon: Lock, label: "UPPER", tone: "green", title: `Upper circuit — locked near +${CIRCUIT_CAP}%` });
    } else if (cs === "lower-lock") {
        out.push({ key: "lower-lock", icon: Lock, label: "LOWER", tone: "red", title: `Lower circuit — locked near -${CIRCUIT_CAP}%` });
    } else if (cs === "near-upper") {
        out.push({ key: "near-upper", icon: AlertTriangle, label: "NEAR CAP", tone: "green", title: "Approaching the upper circuit" });
    } else if (cs === "near-lower") {
        out.push({ key: "near-lower", icon: AlertTriangle, label: "NEAR CAP", tone: "red", title: "Approaching the lower circuit" });
    } else if (c >= BIG_MOVE) {
        out.push({ key: "surge", icon: Zap, label: `+${c.toFixed(1)}%`, tone: "green", title: "Strong intraday gain" });
    } else if (c <= -BIG_MOVE) {
        out.push({ key: "drop", icon: Zap, label: `${c.toFixed(1)}%`, tone: "red", title: "Sharp intraday drop" });
    }

    // Target alert (user-set, from localStorage prefs)
    if (targetPrice != null && price != null && targetPrice > 0) {
        if (price >= targetPrice) {
            out.push({ key: "target-hit", icon: Target, label: "TARGET", tone: "blue", title: `Reached your target of ${targetPrice}` });
        } else {
            const away = ((targetPrice - price) / price) * 100;
            if (away <= 2) out.push({ key: "target-near", icon: Target, label: `${away.toFixed(1)}%`, tone: "blue", title: `${away.toFixed(1)}% below your target of ${targetPrice}` });
        }
    }

    // Fresh session high / low (only when not already flagged as locked, to reduce clutter)
    if (cs !== "upper-lock" && cs !== "lower-lock" && stock.high != null && price != null && stock.high > 0 && price >= stock.high) {
        out.push({ key: "day-high", icon: ChevronUp, label: "HIGH", tone: "green", title: "Trading at the session high" });
    } else if (cs !== "upper-lock" && cs !== "lower-lock" && stock.low != null && price != null && stock.low > 0 && price <= stock.low) {
        out.push({ key: "day-low", icon: ChevronDown, label: "LOW", tone: "red", title: "Trading at the session low" });
    }

    return out;
};

export const toneClasses = (tone: SignalTone): string => {
    switch (tone) {
        case "green": return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
        case "red": return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
        case "blue": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
        case "amber": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
        default: return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
    }
};

// Heatmap cell background from a percent change (-cap..+cap → red..green).
export const heatColor = (changePercent: number): string => {
    const c = Math.max(-CIRCUIT_CAP, Math.min(CIRCUIT_CAP, changePercent || 0));
    const intensity = Math.min(1, Math.abs(c) / CIRCUIT_CAP);
    if (c >= 0) {
        const a = (0.12 + intensity * 0.5).toFixed(2);
        return `rgba(34,197,94,${a})`; // green-500
    }
    const a = (0.12 + intensity * 0.5).toFixed(2);
    return `rgba(239,68,68,${a})`; // red-500
};

// Opaque heat scale for treemap tiles: light pastel at ~0% → deep saturated at
// the circuit cap. Returns matching text colours picked from the tile's own
// lightness, so it reads the same in light and dark mode (no background bleed).
// Text is ALWAYS white (consistent across every tile). The palette is kept dark
// enough — even for small moves — that white stays readable; a dark text outline
// (applied in the component) guarantees legibility on the lighter tiles too.
export const HEAT_TEXT = "#ffffff";
export const HEAT_SUB = "rgba(255,255,255,0.9)";

export const heatSolid = (changePercent: number): { fill: string; text: string; sub: string } => {
    const c = Math.max(-CIRCUIT_CAP, Math.min(CIRCUIT_CAP, changePercent || 0));
    if (Math.abs(c) < 0.05) {
        return { fill: "hsl(220,8%,52%)", text: HEAT_TEXT, sub: HEAT_SUB };
    }
    // Ease so even small moves show clear colour; strong movers go deep & vivid.
    const t = Math.pow(Math.min(1, Math.abs(c) / CIRCUIT_CAP), 0.7);
    const hue = c > 0 ? 140 : 4;      // green vs red
    const sat = 52 + 24 * t;          // 52% (mild) → 76% (strong)
    const light = 58 - 28 * t;        // 58% (mild) → 30% (strong) — never near-white
    return { fill: `hsl(${hue}, ${sat}%, ${light}%)`, text: HEAT_TEXT, sub: HEAT_SUB };
};
