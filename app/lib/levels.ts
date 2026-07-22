// Classic floor-trader pivot points — standard technical support/resistance
// derived from a period's High, Low and Close. Used for the crypto page's
// "next support / resistance" readout and the chart's price lines.

export interface PivotLevels {
    pivot: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
}

export const computePivotLevels = (
    high?: number | null,
    low?: number | null,
    close?: number | null,
): PivotLevels | null => {
    if (
        typeof high !== "number" || typeof low !== "number" || typeof close !== "number" ||
        !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) ||
        !(high > low)
    ) {
        return null;
    }
    const pivot = (high + low + close) / 3;
    const range = high - low;
    return {
        pivot,
        r1: 2 * pivot - low,
        s1: 2 * pivot - high,
        r2: pivot + range,
        s2: pivot - range,
        r3: high + 2 * (pivot - low),
        s3: low - 2 * (high - pivot),
    };
};

// Given the current price, the immediate next resistance (closest level above)
// and next support (closest level below). Falls back to null when none exist.
export const nextLevels = (
    price: number,
    levels: PivotLevels,
): { nextResistance: number | null; nextSupport: number | null } => {
    const ups = [levels.pivot, levels.r1, levels.r2, levels.r3].filter(v => v > price).sort((a, b) => a - b);
    const downs = [levels.pivot, levels.s1, levels.s2, levels.s3].filter(v => v < price).sort((a, b) => b - a);
    return {
        nextResistance: ups.length ? ups[0] : null,
        nextSupport: downs.length ? downs[0] : null,
    };
};
