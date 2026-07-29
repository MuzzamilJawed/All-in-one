// Display-currency support.
//
// The app quotes every market in USD (with a PKR companion price where the feed
// provides one). Users pick which currencies they want available in Settings;
// screens then render in whichever of those is active and can offer a toggle
// when more than one is enabled.
//
// Two markets are NEVER converted — PSX is a PKR market and NASDAQ is a USD
// market, so their prices are always shown in their native currency.

export interface CurrencyDef {
    code: string;
    name: string;
    symbol: string;
}

export const CURRENCIES: CurrencyDef[] = [
    { code: "PKR", name: "Pakistani Rupee", symbol: "Rs." },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "British Pound", symbol: "£" },
    { code: "AED", name: "UAE Dirham", symbol: "AED " },
    { code: "SAR", name: "Saudi Riyal", symbol: "SAR " },
    { code: "INR", name: "Indian Rupee", symbol: "₹" },
    { code: "CNY", name: "Chinese Yuan", symbol: "CN¥" },
    { code: "JPY", name: "Japanese Yen", symbol: "¥" },
    { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
    { code: "AUD", name: "Australian Dollar", symbol: "A$" },
    { code: "CHF", name: "Swiss Franc", symbol: "CHF " },
    { code: "TRY", name: "Turkish Lira", symbol: "₺" },
];

export const CURRENCY_CODES = CURRENCIES.map(c => c.code);

// Enabled out of the box — PKR + USD keeps the existing dual-currency behaviour.
export const DEFAULT_CURRENCIES = ["PKR", "USD"];
export const DEFAULT_CURRENCY = "PKR";

// Markets whose prices are pinned to one currency and never converted.
export const MARKET_CURRENCY: Record<string, string> = { PSX: "PKR", NASDAQ: "USD" };

export const currencySymbol = (code: string): string =>
    CURRENCIES.find(c => c.code === code)?.symbol ?? `${code} `;

export const currencyName = (code: string): string =>
    CURRENCIES.find(c => c.code === code)?.name ?? code;

// Sanitize the enabled list: known codes only, de-duped, default order, and the
// default currency is always part of it so a screen can never end up currency-less.
export function normalizeCurrencies(list: unknown, fallbackDefault = DEFAULT_CURRENCY): string[] {
    const raw = Array.isArray(list) ? list.filter((c): c is string => typeof c === "string") : [];
    const valid = CURRENCY_CODES.filter(code => raw.includes(code));
    const out = valid.length ? valid : [...DEFAULT_CURRENCIES];
    if (fallbackDefault && CURRENCY_CODES.includes(fallbackDefault) && !out.includes(fallbackDefault)) {
        out.unshift(fallbackDefault);
    }
    return out;
}

// ── Conversion (all rates are USD-based: units of `code` per 1 USD) ──────────

const FALLBACK_PKR = 278;

export const rateOf = (rates: Record<string, number> | undefined, code: string): number => {
    if (code === "USD") return 1;
    const r = Number(rates?.[code]);
    if (Number.isFinite(r) && r > 0) return r;
    return code === "PKR" ? FALLBACK_PKR : 1;
};

export const usdTo = (usd: number | null | undefined, code: string, rates: Record<string, number>): number | null =>
    usd == null || !Number.isFinite(usd) ? null : usd * rateOf(rates, code);

export const amountToUsd = (amt: number | null | undefined, code: string, rates: Record<string, number>): number | null =>
    amt == null || !Number.isFinite(amt) ? null : amt / rateOf(rates, code);

export const convertAmount = (
    amt: number | null | undefined,
    from: string,
    to: string,
    rates: Record<string, number>,
): number | null => {
    if (amt == null || !Number.isFinite(amt)) return null;
    if (from === to) return amt;
    return (amt / rateOf(rates, from)) * rateOf(rates, to);
};

export interface MoneyFormat {
    /** Force a fixed number of decimals (otherwise auto: 4 under 10, else 2). */
    decimals?: number;
    /** Render as 1.2K / 3.4M. */
    compact?: boolean;
    /** Prefix a +/- sign. */
    signed?: boolean;
    /** Shown when the value is null/undefined. */
    empty?: string;
}

export function formatMoney(value: number | null | undefined, code: string, opts: MoneyFormat = {}): string {
    const { decimals, compact, signed, empty = "—" } = opts;
    if (value == null || !Number.isFinite(value)) return empty;
    const sym = currencySymbol(code);
    const abs = Math.abs(value);
    const dp = decimals ?? (abs > 0 && abs < 10 ? 4 : 2);
    const body = compact
        ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(signed ? abs : value)
        : (signed ? abs : value).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
    const sign = signed ? (value >= 0 ? "+" : "-") : "";
    return `${sign}${sym}${body}`;
}
