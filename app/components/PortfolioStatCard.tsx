"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase } from "lucide-react";
import StatCard from "./StatCard";
import { useCurrency } from "../context/CurrencyContext";
import { convertAmount, currencySymbol } from "../lib/currency";
import { fetchTxns, computeHoldings, type Txn } from "../lib/portfolio";
import { fetchAllPrices, priceKey, priceIn, type PriceBook } from "../lib/prices";

// Compact dashboard tile: live portfolio value + total return %. Reuses the same
// average-cost + live-price logic as the full /portfolio screen and PortfolioSummary.
export default function PortfolioStatCard() {
    const { currency: displayCur, rates } = useCurrency();

    const [txns, setTxns] = useState<Txn[]>([]);
    const [book, setBook] = useState<PriceBook>({ map: {}, rate: 278, updated: "" });

    const reload = useCallback(async () => setTxns(await fetchTxns()), []);
    useEffect(() => {
        reload();
        const h = () => { reload(); };
        window.addEventListener("portfolio", h);
        return () => window.removeEventListener("portfolio", h);
    }, [reload]);

    useEffect(() => {
        let active = true;
        (async () => {
            try { const b = await fetchAllPrices(); if (active) setBook(b); } catch { /* keep defaults */ }
        })();
        return () => { active = false; };
    }, []);

    const rate = book.rate;
    const fxRates = useMemo(() => ({ ...rates, PKR: rate || rates.PKR, USD: 1 }), [rates, rate]);
    const { holdings } = useMemo(() => computeHoldings(txns), [txns]);

    const totals = useMemo(() => {
        const convert = (amt: number, from: string) => convertAmount(amt, from, displayCur, fxRates) ?? 0;
        let value = 0, investedPriced = 0;
        holdings.forEach(h => {
            const info = book.map[priceKey(h.assetType, h.symbol)];
            const current = priceIn(info, h.currency, rate);
            const inv = convert(h.quantity * h.avgCost, h.currency);
            if (current != null) {
                value += convert(h.quantity * current, h.currency);
                investedPriced += inv;
            }
        });
        const unrealized = value - investedPriced;
        return {
            value,
            totalPct: investedPriced > 0 ? (unrealized / investedPriced) * 100 : 0,
            count: holdings.length,
        };
    }, [holdings, book, rate, displayCur, fxRates]);

    const cs = currencySymbol(displayCur);
    const fmt = (v: number) => `${cs}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    const has = totals.count > 0;

    return (
        <a href="/portfolio" className="block">
            <StatCard
                label="Portfolio"
                value={has ? fmt(totals.value) : "—"}
                icon={<Briefcase className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />}
                change={has ? totals.totalPct : undefined}
                changeLabel={has ? `Total Return · ${totals.count} holding${totals.count === 1 ? "" : "s"}` : "No holdings yet"}
            />
        </a>
    );
}
