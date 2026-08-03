// The user-settings contract, shared by the client context and the API so both
// agree on shape, defaults and bounds.

import { DEFAULT_MODULES, MODULES } from "./modules";
import { DEFAULT_CURRENCIES, DEFAULT_CURRENCY, normalizeCurrencies } from "./currency";

export interface Settings {
    /** Default display currency — used when only one currency is enabled, and as
     *  the starting point for the per-screen currency toggle. */
    currency: string;
    /** Currencies the user made available for display across the app. */
    currencies: string[];
    refreshInterval: number;
    notifications: boolean;
    soundAlerts: boolean;
    priceAlerts: boolean;
    modules: Record<string, boolean>;
}

export const defaultSettings: Settings = {
    currency: DEFAULT_CURRENCY,
    currencies: [...DEFAULT_CURRENCIES],
    refreshInterval: 30,
    notifications: true,
    soundAlerts: false,
    priceAlerts: true,
    modules: DEFAULT_MODULES,
};

const MODULE_KEYS = new Set(MODULES.map(m => m.key));
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/**
 * Coerces anything (a DB document, a request body, an old localStorage blob)
 * into a complete, valid Settings object. Unknown module keys are dropped and
 * newly-added modules default to enabled, so the shape survives app updates.
 */
export function normalizeSettings(raw: unknown): Settings {
    const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>;

    const currencies = normalizeCurrencies(
        src.currencies,
        typeof src.currency === "string" ? src.currency : defaultSettings.currency,
    );
    // The default currency has to be one the user actually enabled.
    const currency = typeof src.currency === "string" && currencies.includes(src.currency)
        ? src.currency
        : currencies[0];

    const modules: Record<string, boolean> = { ...DEFAULT_MODULES };
    const rawModules = (src.modules && typeof src.modules === "object" ? src.modules : {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(rawModules)) {
        if (MODULE_KEYS.has(key)) modules[key] = value !== false;
    }

    const interval = Number(src.refreshInterval);
    return {
        currency,
        currencies,
        // 0 disables polling; otherwise keep it sane so a bad value can't hammer
        // the upstream feeds or stall the UI for an hour.
        refreshInterval: Number.isFinite(interval) ? Math.min(3600, Math.max(0, Math.round(interval))) : defaultSettings.refreshInterval,
        notifications: bool(src.notifications, defaultSettings.notifications),
        soundAlerts: bool(src.soundAlerts, defaultSettings.soundAlerts),
        priceAlerts: bool(src.priceAlerts, defaultSettings.priceAlerts),
        modules,
    };
}
