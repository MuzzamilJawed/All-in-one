// Client-side per-symbol preferences: price targets, notes/tags, and a daily
// snapshot used to flag "new since yesterday". Stored in localStorage so it is
// private to the browser and needs no backend/model change.
//
// All accessors are SSR-safe (guard on `window`) and dispatch a "stockprefs"
// event so multiple mounted components stay in sync within the same tab.

const TARGETS_KEY = "psx.targets.v1";
const NOTES_KEY = "psx.notes.v1";
const SNAPSHOT_KEY = "psx.snapshot.v1";
const METAL_TARGETS_KEY = "metal.targets.v1";

const hasWindow = () => typeof window !== "undefined";

const readMap = (key: string): Record<string, any> => {
    if (!hasWindow()) return {};
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeMap = (key: string, map: Record<string, any>) => {
    if (!hasWindow()) return;
    try {
        window.localStorage.setItem(key, JSON.stringify(map));
        window.dispatchEvent(new CustomEvent("stockprefs"));
    } catch {
        /* quota / disabled storage — ignore */
    }
};

const norm = (symbol: string) => symbol.trim().toUpperCase();

// ── Price targets ────────────────────────────────────────────────────────────

export const getTargets = (): Record<string, number> => readMap(TARGETS_KEY);

export const getTarget = (symbol: string): number | null => {
    const t = getTargets()[norm(symbol)];
    return typeof t === "number" ? t : null;
};

export const setTarget = (symbol: string, target: number | null) => {
    const map = getTargets();
    if (target == null || !Number.isFinite(target) || target <= 0) delete map[norm(symbol)];
    else map[norm(symbol)] = target;
    writeMap(TARGETS_KEY, map);
};

// ── Metal price targets ──────────────────────────────────────────────────────
// Keyed by metal ("GOLD"/"SILVER"), stored in PKR (gold per tola, silver per
// ounce). `dir` is captured at set time so a "hit" stays stable: a target set
// above the current price fires on a rise, one set below fires on a drop.

export interface MetalTarget {
    value: number;
    dir: "above" | "below";
}

export const getMetalTargets = (): Record<string, MetalTarget> => readMap(METAL_TARGETS_KEY);

export const getMetalTarget = (metal: string): MetalTarget | null => {
    const t = getMetalTargets()[norm(metal)];
    return t && typeof t.value === "number" ? t : null;
};

export const setMetalTarget = (metal: string, value: number | null, currentPrice: number) => {
    const map = getMetalTargets();
    if (value == null || !Number.isFinite(value) || value <= 0) delete map[norm(metal)];
    else map[norm(metal)] = { value, dir: value >= currentPrice ? "above" : "below" };
    writeMap(METAL_TARGETS_KEY, map);
};

// ── Notes / tags ─────────────────────────────────────────────────────────────

export interface StockNote {
    text?: string;
    tag?: string; // short conviction label e.g. "Breakout", "Earnings"
    updated?: number;
}

export const getNotes = (): Record<string, StockNote> => readMap(NOTES_KEY);

export const getNote = (symbol: string): StockNote | null => {
    const n = getNotes()[norm(symbol)];
    return n && (n.text || n.tag) ? n : null;
};

export const setNote = (symbol: string, note: StockNote, now: number) => {
    const map = getNotes();
    const clean: StockNote = {
        text: (note.text || "").trim() || undefined,
        tag: (note.tag || "").trim() || undefined,
        updated: now,
    };
    if (!clean.text && !clean.tag) delete map[norm(symbol)];
    else map[norm(symbol)] = clean;
    writeMap(NOTES_KEY, map);
};

// ── Daily snapshot ("new since yesterday") ───────────────────────────────────
// We remember today's leader set (gainers / most-active) plus the *previous*
// session's set. Diffing today's leaders against `prev` flags fresh entries.
// `prev` stays stable through the whole trading day so the flag doesn't churn as
// the feed refreshes; it only rolls forward when the calendar day changes.

interface Snapshot {
    date: string;        // yyyy-mm-dd of the stored (current) session
    leaders: string[];   // symbols leading this session
    prev: string[];      // symbols that led the previous session
}

const todayKey = (now: number): string => {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Record the current leaders and return the previous session's leaders to diff
// against. First run ever returns an empty set (nothing is "new" yet).
export const rollLeaders = (leaders: string[], now: number): Set<string> => {
    const today = todayKey(now);
    const current = leaders.map(norm).slice(0, 80);
    const existing = readMap(SNAPSHOT_KEY) as unknown as Snapshot;

    let prev: string[];
    if (!existing || !existing.date) {
        prev = []; // nothing stored yet
    } else if (existing.date === today) {
        prev = Array.isArray(existing.prev) ? existing.prev : []; // same day — keep prior baseline
    } else {
        prev = Array.isArray(existing.leaders) ? existing.leaders : []; // new day — yesterday becomes prev
    }

    if (hasWindow()) {
        try {
            window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ date: today, leaders: current, prev } as Snapshot));
        } catch {
            /* ignore */
        }
    }
    return new Set(prev.map(norm));
};
