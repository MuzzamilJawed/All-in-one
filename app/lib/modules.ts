// Toggleable app modules. Users can hide any of these from Settings; hidden
// modules disappear from the sidebar + dashboard and their routes are blocked.

export interface ModuleDef {
    key: string;
    label: string;
    desc: string;
}

export const MODULES: ModuleDef[] = [
    { key: "stocks", label: "PSX Stocks", desc: "Pakistan Stock Exchange terminal, sectors & screener" },
    { key: "nasdaq", label: "NASDAQ Stocks", desc: "US equities market" },
    { key: "forex", label: "Forex", desc: "Currency rates & converter" },
    { key: "crypto", label: "Crypto", desc: "Cryptocurrency market" },
    { key: "metals", label: "Gold & Silver", desc: "Precious metals & commodities" },
    { key: "oil", label: "Oil & Energy", desc: "Energy markets" },
    { key: "watchlist", label: "Watchlist", desc: "Tracked scrips & alerts" },
    { key: "portfolio", label: "Portfolio", desc: "Holdings & profit / loss" },
    { key: "expenses", label: "Expenses", desc: "Personal expense tracker" },
];

// Every module enabled by default.
export const DEFAULT_MODULES: Record<string, boolean> = Object.fromEntries(MODULES.map(m => [m.key, true]));

// A module is enabled unless it is explicitly set to false (so new modules added
// in future default to visible for existing users).
export const isModuleEnabled = (modules: Record<string, boolean> | undefined, key: string): boolean =>
    modules?.[key] !== false;

// Map a route to its owning module key (for route guarding). null = always allowed
// (dashboard, settings, debug, etc.).
const ROUTE_PREFIXES: [string, string][] = [
    ["/stocks", "stocks"],
    ["/nasdaq", "nasdaq"],
    ["/forex", "forex"],
    ["/crypto", "crypto"],
    ["/metals", "metals"],
    ["/oil", "oil"],
    ["/watchlist", "watchlist"],
    ["/portfolio", "portfolio"],
    ["/expenses", "expenses"],
];

export const moduleForPath = (pathname: string): string | null => {
    const p = pathname || "";
    for (const [pre, key] of ROUTE_PREFIXES) {
        if (p === pre || p.startsWith(pre + "/")) return key;
    }
    return null;
};
