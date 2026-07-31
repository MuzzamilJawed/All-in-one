// A multi-asset watchlist — lets the user watch ANY asset type (PSX, NASDAQ,
// crypto, forex, commodities), not just PSX stocks. Stored on the signed-in
// user's document via /api/universal-watch, so it follows them across devices.
//
// Every mutation dispatches the "uwatch" window event that the UI listens on.

import type { AssetType } from "./prices";

export interface WatchItem {
    assetType: AssetType;
    symbol: string;
}

const hasWindow = () => typeof window !== "undefined";
const emit = () => { if (hasWindow()) window.dispatchEvent(new CustomEvent("uwatch")); };

const parse = (json: any): WatchItem[] =>
    json?.success && Array.isArray(json.data)
        ? json.data.map((i: any) => ({ assetType: i.assetType, symbol: i.symbol }))
        : [];

export async function fetchWatch(): Promise<WatchItem[]> {
    try {
        return parse(await (await fetch("/api/universal-watch", { cache: "no-store" })).json());
    } catch {
        return [];
    }
}

export async function addWatch(assetType: AssetType, symbol: string): Promise<void> {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    try {
        await fetch("/api/universal-watch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assetType, symbol: sym }),
        });
        emit();
    } catch { /* offline — the list reloads on the next fetch */ }
}

export async function removeWatch(assetType: AssetType, symbol: string): Promise<void> {
    const sym = symbol.trim().toUpperCase();
    try {
        await fetch(`/api/universal-watch?assetType=${encodeURIComponent(assetType)}&symbol=${encodeURIComponent(sym)}`, {
            method: "DELETE",
        });
        emit();
    } catch { /* offline */ }
}

export async function replaceWatch(items: WatchItem[]): Promise<void> {
    try {
        await fetch("/api/universal-watch", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
        });
        emit();
    } catch { /* offline */ }
}

// ── Legacy localStorage list (pre-accounts) ─────────────────────────────────

const LEGACY_KEY = "watch.universal.v1";

export function readLegacyWatch(): WatchItem[] {
    if (!hasWindow()) return [];
    try {
        const raw = window.localStorage.getItem(LEGACY_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

export function clearLegacyWatch() {
    if (!hasWindow()) return;
    try { window.localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}
