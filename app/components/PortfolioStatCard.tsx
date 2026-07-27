"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase } from "lucide-react";
import StatCard from "./StatCard";
import { useSettings } from "../context/SettingsContext";
import { getTxns, computeHoldings, type Txn } from "../lib/portfolio";
import { fetchAllPrices, priceKey, priceIn, convert, curSymbol, type PriceBook } from "../lib/prices";

// Compact dashboard tile: live portfolio value + total return %. Reuses the same
// average-cost + live-price logic as the full /portfolio screen and PortfolioSummary.
export default function PortfolioStatCard() {
    const { settings } = useSettings();
    const displayCur: "PKR" | "USD" = settings.currency === "PKR" ? "PKR" : "USD";

    const [txns, setTxns] = useState<Txn[]>([]);
    const [book, setBook] = useState<PriceBook>({ map: {}, rate: 278, updated: "" });

    const reload = useCallback(() => setTxns(getTxns()), []);
    useEffect(() => {
        reload();
        const h = () => reload();
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
    const { holdings, realized } = useMemo(() => computeHoldings(txns), [txns]);

    const totals = useMemo(() => {
        let value = 0, investedPriced = 0;
        holdings.forEach(h => {
            const info = book.map[priceKey(h.assetType, h.symbol)];
            const current = priceIn(info, h.currency, rate);
            const inv = convert(h.quantity * h.avgCost, h.currency, displayCur, rate);
            if (current != null) {
                value += convert(h.quantity * current, h.currency, displayCur, rate);
                investedPriced += inv;
            }
        });
        const unrealized = value - investedPriced;
        const realizedTotal = convert(realized.PKR, "PKR", displayCur, rate) + convert(realized.USD, "USD", displayCur, rate);
        return {
            value,
            totalPct: investedPriced > 0 ? (unrealized / investedPriced) * 100 : 0,
            count: holdings.length,
        };
    }, [holdings, book, rate, displayCur, realized]);

    const cs = curSymbol(displayCur);
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
