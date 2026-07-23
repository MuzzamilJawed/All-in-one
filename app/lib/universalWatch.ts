// A multi-asset watchlist (localStorage) — lets the user watch ANY asset type
// (PSX, NASDAQ, crypto, forex, commodities), not just PSX stocks.

import type { AssetType } from "./prices";

export interface WatchItem {
    assetType: AssetType;
    symbol: string;
}

const KEY = "watch.universal.v1";
const hasWindow = () => typeof window !== "undefined";

export const getWatch = (): WatchItem[] => {
    if (!hasWindow()) return [];
    try {
        const raw = window.localStorage.getItem(KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
};

const write = (items: WatchItem[]) => {
    if (!hasWindow()) return;
    try {
        window.localStorage.setItem(KEY, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent("uwatch"));
    } catch { /* quota */ }
};

export const addWatch = (assetType: AssetType, symbol: string) => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    const items = getWatch();
    if (items.some(i => i.assetType === assetType && i.symbol === sym)) return;
    write([...items, { assetType, symbol: sym }]);
};

export const removeWatch = (assetType: AssetType, symbol: string) => {
    const sym = symbol.trim().toUpperCase();
    write(getWatch().filter(i => !(i.assetType === assetType && i.symbol === sym)));
};
