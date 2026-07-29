"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSettings } from "./SettingsContext";
import {
    CURRENCY_CODES, DEFAULT_CURRENCY, currencySymbol, normalizeCurrencies,
    rateOf, usdTo, convertAmount, formatMoney, type MoneyFormat,
} from "../lib/currency";

// The active *display* currency for the session. It starts at the default set in
// Settings and can be flipped from any screen's currency toggle (when more than
// one currency is enabled). PSX / NASDAQ screens ignore it entirely.

const STORAGE_KEY = "display-currency";
const FALLBACK_RATES: Record<string, number> = { USD: 1, PKR: 278 };
const RATES_REFRESH_MS = 10 * 60 * 1000;

interface CurrencyContextType {
    /** Active display currency code. */
    currency: string;
    setCurrency: (code: string) => void;
    /** Currencies the user enabled in Settings. */
    options: string[];
    /** True when a toggle should be offered (more than one currency enabled). */
    canSwitch: boolean;
    /** USD-based rate map (units per 1 USD). */
    rates: Record<string, number>;
    ratesReady: boolean;
    /** Symbol of the active currency. */
    sym: string;
    symbolOf: (code: string) => string;
    /** Convert a USD figure to the active currency, preferring a supplied PKR quote. */
    conv: (usd?: number | null, pkr?: number | null) => number | null;
    /** Convert an amount already denominated in `from` to the active currency. */
    convertFrom: (amt?: number | null, from?: string) => number | null;
    /** Format a value that is already in the active currency. */
    fmt: (value?: number | null, opts?: MoneyFormat) => string;
    /** Convert a USD (or PKR) figure and format it in one step. */
    price: (usd?: number | null, pkr?: number | null, opts?: MoneyFormat) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const { settings } = useSettings();

    const defaultCurrency = CURRENCY_CODES.includes(settings.currency) ? settings.currency : DEFAULT_CURRENCY;
    const options = useMemo(
        () => normalizeCurrencies(settings.currencies, defaultCurrency),
        [settings.currencies, defaultCurrency],
    );

    // `picked` is what the user last chose; the effective currency is derived from
    // it so a currency disabled in Settings falls back to the default without an
    // extra render pass.
    const [picked, setCurrencyState] = useState<string>(defaultCurrency);
    const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
    const [ratesReady, setRatesReady] = useState(false);

    const currency = options.includes(picked)
        ? picked
        : (options.includes(defaultCurrency) ? defaultCurrency : options[0]);

    // Restore the last-used display currency for this browser. Done in an effect
    // (not a lazy initializer) so the server and first client render agree.
    useEffect(() => {
        const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        if (saved && CURRENCY_CODES.includes(saved)) setCurrencyState(saved);
    }, []);

    const setCurrency = useCallback((code: string) => {
        if (!CURRENCY_CODES.includes(code)) return;
        setCurrencyState(code);
        try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode */ }
    }, []);

    // Live USD-based rates for every currency (cached server-side).
    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const res = await fetch("/api/forex/rates");
                const json = await res.json();
                if (!active || !json?.rates) return;
                setRates({ ...FALLBACK_RATES, ...json.rates, USD: 1 });
                setRatesReady(true);
            } catch { /* keep the previous / fallback rates */ }
        };
        load();
        const id = setInterval(load, RATES_REFRESH_MS);
        return () => { active = false; clearInterval(id); };
    }, []);

    const value = useMemo<CurrencyContextType>(() => {
        const conv = (usd?: number | null, pkr?: number | null) => {
            // Prefer the feed's own PKR quote when we're showing PKR — it is priced
            // with the same rate the rest of the PKR data uses.
            if (currency === "PKR" && pkr != null && Number.isFinite(pkr)) return pkr;
            const usdVal = usd != null && Number.isFinite(usd)
                ? usd
                : (pkr != null && Number.isFinite(pkr) ? pkr / rateOf(rates, "PKR") : null);
            return usdTo(usdVal, currency, rates);
        };
        const fmt = (v?: number | null, opts?: MoneyFormat) => formatMoney(v, currency, opts);
        return {
            currency,
            setCurrency,
            options,
            canSwitch: options.length > 1,
            rates,
            ratesReady,
            sym: currencySymbol(currency),
            symbolOf: currencySymbol,
            conv,
            convertFrom: (amt?: number | null, from = "USD") => convertAmount(amt, from, currency, rates),
            fmt,
            price: (usd?: number | null, pkr?: number | null, opts?: MoneyFormat) => fmt(conv(usd, pkr), opts),
        };
    }, [currency, setCurrency, options, rates, ratesReady]);

    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
    const ctx = useContext(CurrencyContext);
    if (ctx === undefined) throw new Error("useCurrency must be used within a CurrencyProvider");
    return ctx;
}
