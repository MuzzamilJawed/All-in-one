"use client";

import { useCurrency } from "../context/CurrencyContext";

// Per-screen display-currency switcher. Renders nothing unless the user enabled
// more than one currency in Settings — with a single currency the default one
// simply displays everywhere. Never shown on PSX / NASDAQ screens: those markets
// are always quoted in PKR and USD respectively.
export default function CurrencyToggle({ className = "" }: { className?: string }) {
    const { currency, setCurrency, options, canSwitch } = useCurrency();

    if (!canSwitch) return null;

    // Up to 4 currencies fit as a segmented control; beyond that use a select.
    if (options.length > 4) {
        return (
            <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label="Display currency"
                title="Display currency"
                className={`px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all ${className}`}
            >
                {options.map(code => <option key={code} value={code}>{code}</option>)}
            </select>
        );
    }

    return (
        <div
            role="group"
            aria-label="Display currency"
            className={`flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 border border-zinc-200 dark:border-zinc-700 shrink-0 ${className}`}
        >
            {options.map(code => (
                <button
                    key={code}
                    onClick={() => setCurrency(code)}
                    aria-pressed={currency === code}
                    className={`px-3 sm:px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${
                        currency === code
                            ? "bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400"
                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                >
                    {code}
                </button>
            ))}
        </div>
    );
}
