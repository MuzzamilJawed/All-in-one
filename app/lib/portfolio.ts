// Client-side portfolio ledger (localStorage). Records BUY/SELL transactions
// across every asset type and derives current holdings + realized/unrealized
// P/L using the average-cost method. No backend needed.

import type { AssetType } from "./prices";

export interface Txn {
    id: string;
    date: string;            // YYYY-MM-DD
    type: "BUY" | "SELL";
    assetType: AssetType;
    symbol: string;          // uppercased
    name?: string;
    quantity: number;
    price: number;           // per-unit, in `currency`
    currency: "PKR" | "USD";
    note?: string;
}

const KEY = "portfolio.txns.v1";
const hasWindow = () => typeof window !== "undefined";

export const getTxns = (): Txn[] => {
    if (!hasWindow()) return [];
    try {
        const raw = window.localStorage.getItem(KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
};

const write = (txns: Txn[]) => {
    if (!hasWindow()) return;
    try {
        window.localStorage.setItem(KEY, JSON.stringify(txns));
        window.dispatchEvent(new CustomEvent("portfolio"));
    } catch { /* quota */ }
};

export const addTxn = (t: Omit<Txn, "id">): Txn => {
    const txn: Txn = { ...t, symbol: t.symbol.trim().toUpperCase(), id: `${t.date}-${t.symbol}-${Math.floor(Math.random() * 1e9)}-${getTxns().length}` };
    write([...getTxns(), txn]);
    return txn;
};

export const deleteTxn = (id: string) => write(getTxns().filter(t => t.id !== id));
export const clearTxns = () => write([]);

export interface Holding {
    assetType: AssetType;
    symbol: string;
    name?: string;
    quantity: number;
    avgCost: number;   // per-unit in `currency`
    currency: "PKR" | "USD";
}

export interface Derived {
    holdings: Holding[];
    realized: { PKR: number; USD: number };
}

// Average-cost accounting, processed in chronological order.
export function computeHoldings(txns: Txn[]): Derived {
    const sorted = [...txns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const book = new Map<string, Holding>();
    const realized = { PKR: 0, USD: 0 };

    for (const t of sorted) {
        const key = `${t.assetType}:${t.symbol.toUpperCase()}:${t.currency}`;
        const h = book.get(key) || { assetType: t.assetType, symbol: t.symbol.toUpperCase(), name: t.name, quantity: 0, avgCost: 0, currency: t.currency };
        const qty = Math.abs(Number(t.quantity) || 0);
        const price = Number(t.price) || 0;
        if (t.name) h.name = t.name;

        if (t.type === "BUY") {
            const newQty = h.quantity + qty;
            h.avgCost = newQty > 0 ? (h.avgCost * h.quantity + price * qty) / newQty : 0;
            h.quantity = newQty;
        } else {
            const sellQty = Math.min(qty, h.quantity);          // can't sell more than held
            realized[t.currency] += (price - h.avgCost) * sellQty;
            h.quantity -= sellQty;
        }
        book.set(key, h);
    }

    const holdings = Array.from(book.values()).filter(h => h.quantity > 1e-9);
    return { holdings, realized };
}

// CSV export of a set of transactions.
export function txnsToCsv(txns: Txn[]): string {
    const head = ["Date", "Type", "Asset", "Symbol", "Name", "Quantity", "Price", "Currency", "Value"];
    const rows = txns.map(t => [
        t.date, t.type, t.assetType, t.symbol, (t.name || "").replace(/,/g, " "),
        String(t.quantity), String(t.price), t.currency, String((Number(t.quantity) || 0) * (Number(t.price) || 0)),
    ]);
    return [head, ...rows].map(r => r.join(",")).join("\n");
}
