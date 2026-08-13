"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Briefcase, Download, RotateCcw, BarChart3, ChevronDown, Grid3x3, Globe, Bitcoin, ArrowRightLeft, Zap, ArrowDownToLine, Upload, Plus } from "lucide-react";
import {
    PieChart, Pie, Cell, Sector, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useSettings } from "../context/SettingsContext";
import { useCurrency } from "../context/CurrencyContext";
import CurrencyToggle from "../components/CurrencyToggle";
import FitText from "../components/FitText";
import { convertAmount, currencySymbol } from "../lib/currency";
import { useToast } from "../context/ToastContext";
import {
    fetchTxns, addTxn, deleteTxn, computeHoldings, txnsToCsv, importTxns, type Txn,
} from "../lib/portfolio";
import {
    fetchAllPrices, priceKey, priceIn, ASSET_TYPES,
    COMMODITY_SYMBOLS, type AssetType, type PriceBook,
} from "../lib/prices";

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type UploadTxn = Omit<Txn, "id">;

const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];
        if (char === '"') {
            if (quoted && next === '"') {
                field += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (char === "," && !quoted) {
            row.push(field.trim());
            field = "";
        } else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && next === "\n") index += 1;
            row.push(field.trim());
            if (row.some(value => value.length > 0)) rows.push(row);
            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    row.push(field.trim());
    if (row.some(value => value.length > 0)) rows.push(row);
    return rows;
};

const categoryValue = (value: string): AssetType | null => {
    const normalized = value.trim().toUpperCase().replace(/[\s_-]+/g, "");
    const aliases: Record<string, AssetType> = {
        PSX: "PSX", PSXSTOCK: "PSX", STOCK: "PSX",
        NASDAQ: "NASDAQ", NASDAQSTOCK: "NASDAQ",
        CRYPTO: "CRYPTO", CRYPTOCURRENCY: "CRYPTO",
        FOREX: "FOREX", FX: "FOREX",
        COMMODITY: "COMMODITY", COMMODITIES: "COMMODITY",
    };
    return aliases[normalized] || null;
};

const parseUpload = (text: string, book: PriceBook): { txns: UploadTxn[]; errors: string[] } => {
    const table = parseCsv(text);
    if (table.length < 2) return { txns: [], errors: ["The CSV must contain a header row and at least one trade row."] };

    const headers = table[0].map(value => value.replace(/^\uFEFF/, "").toLowerCase().replace(/[\s_-]+/g, ""));
    const findColumn = (...names: string[]) => names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1;
    const categoryColumn = findColumn("category", "asset", "assettype");
    const symbolColumn = findColumn("symbol", "ticker");
    const quantityColumn = findColumn("quantity", "qty", "shares");
    const priceColumn = findColumn("price", "buyprice", "sellprice");
    const dateColumn = findColumn("date");
    const typeColumn = findColumn("type", "transactiontype");
    const currencyColumn = findColumn("currency");
    const nameColumn = findColumn("name");
    const noteColumn = findColumn("note");
    const missingHeaders = [
        categoryColumn < 0 ? "category" : "",
        symbolColumn < 0 ? "symbol" : "",
        quantityColumn < 0 ? "quantity" : "",
        priceColumn < 0 ? "price" : "",
    ].filter(Boolean);
    if (missingHeaders.length) return { txns: [], errors: [`Missing required column(s): ${missingHeaders.join(", ")}.`] };

    const errors: string[] = [];
    const txns: UploadTxn[] = [];
    table.slice(1).forEach((row, rowIndex) => {
        const line = rowIndex + 2;
        const valueAt = (column: number) => column >= 0 ? (row[column] || "").trim() : "";
        const category = categoryValue(valueAt(categoryColumn));
        const symbol = valueAt(symbolColumn).toUpperCase();
        const quantity = Number(valueAt(quantityColumn));
        const price = Number(valueAt(priceColumn));
        const rowErrors: string[] = [];
        if (!category) rowErrors.push("category must be PSX, NASDAQ, CRYPTO, FOREX, or COMMODITY");
        if (!symbol) rowErrors.push("symbol is required");
        if (!Number.isFinite(quantity) || quantity <= 0) rowErrors.push("quantity must be greater than 0");
        if (!Number.isFinite(price) || price <= 0) rowErrors.push("price must be greater than 0");

        const date = valueAt(dateColumn) || todayStr();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) rowErrors.push("date must be YYYY-MM-DD");
        const rawType = valueAt(typeColumn).toUpperCase() || "BUY";
        if (rawType !== "BUY" && rawType !== "SELL") rowErrors.push("type must be BUY or SELL");
        const defaultCurrency = category ? ASSET_TYPES.find(item => item.value === category)?.currency || "USD" : "USD";
        const currency = (valueAt(currencyColumn).toUpperCase() || defaultCurrency) as "PKR" | "USD";
        if (currency !== "PKR" && currency !== "USD") rowErrors.push("currency must be PKR or USD");

        if (rowErrors.length) {
            errors.push(`Row ${line}: ${rowErrors.join("; ")}`);
            return;
        }
        const info = book.map[priceKey(category as AssetType, symbol)];
        txns.push({
            date, type: rawType as "BUY" | "SELL", assetType: category as AssetType,
            symbol, name: valueAt(nameColumn) || info?.name, quantity, price, currency,
            note: valueAt(noteColumn) || undefined,
        });
    });
    return { txns, errors };
};

export default function PortfolioPage() {
    const { settings } = useSettings();
    const { success, info, error } = useToast();
    // Holdings stay in their own currency (PSX in PKR, NASDAQ in USD); only the
    // aggregate figures are converted to the active display currency.
    const { currency: displayCur, rates } = useCurrency();

    const [txns, setTxns] = useState<Txn[]>([]);
    const [book, setBook] = useState<PriceBook>({ map: {}, rate: 278, updated: "" });
    const [pricesLoading, setPricesLoading] = useState(true);
    const [ledgerLoading, setLedgerLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [portTab, setPortTab] = useState<"analytics" | "holdings" | "history">("holdings");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [chartView, setChartView] = useState<"alloc" | "perf" | "timeline">("alloc");
    const [allocBy, setAllocBy] = useState<"pos" | "type">("pos");
    const [perfMetric, setPerfMetric] = useState<"total" | "day">("total");
    const [activeIdx, setActiveIdx] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<AssetType | "ALL">("ALL");
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef<HTMLDivElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadErrors, setUploadErrors] = useState<string[]>([]);

    // Add-transaction form state
    const [form, setForm] = useState({
        date: todayStr(), type: "BUY" as "BUY" | "SELL", assetType: "PSX" as AssetType,
        symbol: "", quantity: "", price: "", currency: "PKR" as "PKR" | "USD", note: "",
    });

    const reload = useCallback(async () => {
        setLedgerLoading(true);
        try { setTxns(await fetchTxns()); } finally { setLedgerLoading(false); }
    }, []);

    useEffect(() => {
        reload();
        const h = () => { reload(); };
        window.addEventListener("portfolio", h);
        return () => window.removeEventListener("portfolio", h);
    }, [reload]);

    const loadPrices = useCallback(async () => {
        setPricesLoading(true);
        try { setBook(await fetchAllPrices()); } finally { setPricesLoading(false); }
    }, []);

    useEffect(() => {
        loadPrices();
        if (!settings.refreshInterval || settings.refreshInterval <= 0) return;
        const id = setInterval(loadPrices, Math.max(30, settings.refreshInterval) * 1000);
        return () => clearInterval(id);
    }, [loadPrices, settings.refreshInterval]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
                setFilterDropdownOpen(false);
            }
        };
        if (filterDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [filterDropdownOpen]);

    const rate = book.rate;
    // Use the price book's own USD→PKR rate so PKR totals line up with the feeds.
    const fxRates = useMemo(() => ({ ...rates, PKR: rate || rates.PKR, USD: 1 }), [rates, rate]);
    const convert = useCallback(
        (amt: number, from: string, to: string) => convertAmount(amt, from, to, fxRates) ?? 0,
        [fxRates],
    );
    const { holdings, realized } = useMemo(() => computeHoldings(txns), [txns]);

    // Filter holdings by selected category
    const filteredHoldings = useMemo(() => {
        if (selectedCategory === "ALL") return holdings;
        return holdings.filter(h => h.assetType === selectedCategory);
    }, [holdings, selectedCategory]);

    // Enrich holdings with live prices + P/L (in each holding's own currency)
    const rows = useMemo(() => filteredHoldings.map(h => {
        const info = book.map[priceKey(h.assetType, h.symbol)];
        const current = priceIn(info, h.currency, rate);
        const invested = h.quantity * h.avgCost;
        const value = current != null ? h.quantity * current : null;
        const pnl = value != null ? value - invested : null;
        const pnlPct = pnl != null && invested > 0 ? (pnl / invested) * 100 : null;
        // Day (24h) P/L for the whole position
        const dayPct = info?.changePct ?? null;
        const dayPnl = (current != null && dayPct != null) ? h.quantity * current * (dayPct / 100) : null;
        // …and what that move is worth on a single share. The feed only sends a
        // percentage, so back it out of the price: change = current − prevClose,
        // where prevClose = current ÷ (1 + pct/100).
        const dayPerShare = (current != null && dayPct != null && dayPct > -100)
            ? current - current / (1 + dayPct / 100)
            : null;
        return { ...h, name: h.name || info?.name, current, invested, value, pnl, pnlPct, dayPct, dayPnl, dayPerShare };
    }), [filteredHoldings, book, rate]);

    // Portfolio totals converted to the display currency
    const totals = useMemo(() => {
        let invested = 0;        // cost of all open holdings
        let value = 0;           // current value of holdings that have a live price
        let investedPriced = 0;  // cost of just those priced holdings
        let day = 0;             // today's P/L across priced holdings
        rows.forEach(r => {
            const inv = convert(r.invested, r.currency, displayCur);
            invested += inv;
            if (r.value != null) {
                value += convert(r.value, r.currency, displayCur);
                investedPriced += inv;
            }
            if (r.dayPnl != null) day += convert(r.dayPnl, r.currency, displayCur);
        });
        const unrealized = value - investedPriced;
        const realizedTotal = convert(realized.PKR, "PKR", displayCur) + convert(realized.USD, "USD", displayCur);
        return { invested, value, day, dayPct: value > 0 ? (day / value) * 100 : 0, unrealized, realizedTotal, total: unrealized + realizedTotal };
    }, [rows, realized, displayCur, convert]);

    // Date-filtered ledger (most recent first)
    const ledger = useMemo(() => {
        return [...txns]
            .filter(t => (!from || t.date >= from) && (!to || t.date <= to))
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }, [txns, from, to]);

    // ── Interactive analytics data (all in display currency) ─────────────────
    const TYPE_COLORS: Record<string, string> = { PSX: "#3b82f6", NASDAQ: "#6366f1", CRYPTO: "#f97316", FOREX: "#22c55e", COMMODITY: "#f59e0b" };
    const PALETTE = ["#3b82f6", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#ec4899", "#6366f1", "#06b6d4"];

    const allocData = useMemo(() => {
        const priced = rows.filter(r => r.value != null);
        if (allocBy === "type") {
            const byType = new Map<string, number>();
            priced.forEach(r => byType.set(r.assetType, (byType.get(r.assetType) || 0) + convert(r.value as number, r.currency, displayCur)));
            return Array.from(byType.entries()).map(([name, value]) => ({ name, value, color: TYPE_COLORS[name] || "#3b82f6" }));
        }
        return priced
            .map((r, i) => ({ name: r.symbol, value: convert(r.value as number, r.currency, displayCur), color: PALETTE[i % PALETTE.length] }))
            .sort((a, b) => b.value - a.value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, allocBy, displayCur, convert]);
    const allocTotal = useMemo(() => allocData.reduce((a, d) => a + d.value, 0), [allocData]);

    const perfData = useMemo(() => {
        const pick = (r: typeof rows[number]) => (perfMetric === "day" ? r.dayPnl : r.pnl);
        return rows.filter(r => pick(r) != null)
            .map(r => ({ name: r.symbol, pnl: convert(pick(r) as number, r.currency, displayCur) }))
            .sort((a, b) => b.pnl - a.pnl);
    }, [rows, displayCur, convert, perfMetric]);

    const timelineData = useMemo(() => {
        const sorted = [...txns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        const byDate = new Map<string, number>();
        let running = 0;
        sorted.forEach(t => {
            const v = convert(t.quantity * t.price, t.currency, displayCur) * (t.type === "BUY" ? 1 : -1);
            running += v;
            byDate.set(t.date, running);
        });
        return Array.from(byDate.entries()).map(([date, invested]) => ({ date, invested }));
    }, [txns, displayCur, convert]);

    const fmt = (amt: number | null | undefined, cur: string = displayCur) =>
        amt == null ? "—" : `${currencySymbol(cur)}${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const signed = (amt: number | null | undefined, cur: string = displayCur) =>
        amt == null ? "—" : `${amt >= 0 ? "+" : "-"}${currencySymbol(cur)}${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const compact = (v: number) => `${currencySymbol(displayCur)}${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
    const tooltipStyle: any = { backgroundColor: "var(--tooltip-bg,#fff)", color: "var(--tooltip-fg,#111)", border: "1px solid var(--tooltip-border,#e4e4e7)", borderRadius: "0.75rem", fontSize: "12px", fontWeight: 700 };
    // Pop-out shape for the hovered donut slice (interactive)
    const renderActiveSlice = (props: any) => {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
        return (
            <g>
                <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} />
                <Sector cx={cx} cy={cy} innerRadius={outerRadius + 13} outerRadius={outerRadius + 16} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.55} />
            </g>
        );
    };

    const symbolSuggestions = useMemo(() => {
        const prefix = `${form.assetType}:`;
        return Object.keys(book.map).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length)).sort();
    }, [book, form.assetType]);

    const onPickType = (assetType: AssetType) => {
        const def = ASSET_TYPES.find(a => a.value === assetType);
        setForm(f => ({ ...f, assetType, currency: def?.currency || "PKR", symbol: "", price: "" }));
    };

    const autofillPrice = () => {
        const info = book.map[priceKey(form.assetType, form.symbol)];
        const p = priceIn(info, form.currency, rate);
        if (p != null) setForm(f => ({ ...f, price: String(Number(p.toFixed(p < 1 ? 6 : 2))) }));
    };

    const submit = async () => {
        if (saving) return;
        const q = parseFloat(form.quantity), p = parseFloat(form.price);
        if (!form.symbol.trim()) { info("Enter a symbol"); return; }
        if (!Number.isFinite(q) || q <= 0) { info("Enter a valid quantity"); return; }
        if (!Number.isFinite(p) || p <= 0) { info("Enter a valid price"); return; }
        if (form.type === "SELL") {
            const holding = holdings.find(h => h.assetType === form.assetType && h.symbol.toUpperCase() === form.symbol.trim().toUpperCase() && h.currency === form.currency);
            if (!holding || q > holding.quantity + 1e-9) {
                info(`You can sell up to ${holding?.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 }) || "0"} units`);
                return;
            }
        }
        const info2 = book.map[priceKey(form.assetType, form.symbol)];
        setSaving(true);
        const res = await addTxn({
            date: form.date || todayStr(), type: form.type, assetType: form.assetType,
            symbol: form.symbol, name: info2?.name, quantity: q, price: p, currency: form.currency, note: form.note.trim() || undefined,
        });
        setSaving(false);
        if (res.error) { error(res.error); return; }
        success(`${form.type} ${q} ${form.symbol.toUpperCase()} recorded`);
        setForm(f => ({ ...f, symbol: "", quantity: "", price: "", note: "" }));
    };

    const startSell = (holding: typeof rows[number]) => {
        setForm({
            date: todayStr(), type: "SELL", assetType: holding.assetType,
            symbol: holding.symbol, quantity: "", price: holding.current != null ? String(Number(holding.current.toFixed(holding.current < 1 ? 6 : 2))) : "",
            currency: holding.currency, note: "Partial sale",
        });
        setShowAdd(true);
        window.setTimeout(() => document.getElementById("record-trade")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    };

    const openAddTrade = () => {
        setForm({
            date: todayStr(), type: "BUY", assetType: "PSX",
            symbol: "", quantity: "", price: "", currency: "PKR", note: "",
        });
        setShowAdd(true);
    };

    const availableForForm = form.type === "SELL"
        ? holdings.find(h => h.assetType === form.assetType && h.symbol.toUpperCase() === form.symbol.trim().toUpperCase() && h.currency === form.currency)?.quantity
        : undefined;

    const remove = async (t: Txn) => {
        if (!confirm(`Delete ${t.type} ${t.quantity} ${t.symbol} (${t.date})?`)) return;
        if (await deleteTxn(t.id)) info("Transaction deleted");
        else error("Couldn't delete that transaction");
    };

    const download = () => {
        const csv = txnsToCsv(ledger);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${from || "all"}_to_${to || todayStr()}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        success("Ledger exported to CSV");
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setUploading(true);
        setUploadErrors([]);
        try {
            const parsed = parseUpload(await file.text(), book);
            if (parsed.errors.length > 0) {
                setUploadErrors(parsed.errors.slice(0, 8));
                error(`Upload blocked: ${parsed.errors.length} validation issue${parsed.errors.length === 1 ? "" : "s"}`);
                return;
            }
            const imported = await importTxns(parsed.txns);
            if (imported !== parsed.txns.length) {
                error(`Only ${imported} of ${parsed.txns.length} rows were imported`);
                return;
            }
            success(`${imported} trade${imported === 1 ? "" : "s"} uploaded successfully`);
        } catch {
            error("Could not read that CSV file");
        } finally {
            setUploading(false);
        }
    };

    const inputCls = "w-full min-h-11 px-3.5 py-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all";
    const fieldLabelCls = "block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.14em] mb-1.5";
    const typeBadge = (t: AssetType) => ({ PSX: "bg-blue-500/10 text-blue-500", NASDAQ: "bg-indigo-500/10 text-indigo-500", CRYPTO: "bg-orange-500/10 text-orange-500", FOREX: "bg-green-500/10 text-green-500", COMMODITY: "bg-amber-500/10 text-amber-500" }[t]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white selection:bg-blue-500/30">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 dark:bg-emerald-600/10 blur-[120px] rounded-full"></div>
            </div>

            {/* Header */}
            <header className="safe-top sticky top-0 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
                {/* `flex-wrap`: between sm and lg the title and the action group
                    together are wider than the row (the sidebar still costs pl-16
                    there), which pushed the page into horizontal scroll. Wrapping
                    drops the actions to their own line instead. */}
                <div className="page-shell mx-auto pl-16 pr-4 sm:pr-8 lg:pl-8 py-3 sm:py-6 flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-3">
                    {/* Currency rides the title row — same top-right placement as every
                        other market screen — leaving the row below to the actions. */}
                    <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
                        <div className="min-w-0">
                            {/* Sharing the row with the currency pill leaves ~220px here,
                                which "Portfolio Ledger" overruns — FitText shrinks it to
                                fit instead of letting it slide under the pill. */}
                            <h1 className="text-xl sm:text-3xl font-black tracking-tighter italic uppercase leading-none flex items-center gap-2 min-w-0">
                                <Briefcase className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500 shrink-0" strokeWidth={2} />
                                <FitText className="min-w-0 flex-1">Portfolio <span className="text-emerald-500">Ledger</span></FitText>
                            </h1>
                            {/* No `truncate`: on a 320px phone this tagline is wider than
                                the header, and an ellipsised tagline reads as a bug. Let
                                it wrap to a second line instead. */}
                            <p className="text-zinc-500 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.15em] mt-1 leading-relaxed">Multi-Asset Holdings · Profit &amp; Loss</p>
                        </div>
                        <div className="shrink-0"><CurrencyToggle /></div>
                    </div>
                    <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Category Filter Dropdown */}
                            <div ref={filterDropdownRef} className="relative">
                                <button
                                    onClick={() => setFilterDropdownOpen(s => !s)}
                                    className="shrink-0 inline-flex items-center justify-center gap-1.5 h-10 px-3 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-zinc-200 dark:border-white/10 transition-all active:scale-95"
                                    aria-label="Select asset category"
                                    title="Select category"
                                >
                                    {(() => {
                                        const iconClass = "w-4 h-4";
                                        if (selectedCategory === "ALL") return <Grid3x3 className={iconClass} strokeWidth={2} />;
                                        if (selectedCategory === "PSX") return <Globe className={iconClass} strokeWidth={2} />;
                                        if (selectedCategory === "NASDAQ") return <Globe className={iconClass} strokeWidth={2} />;
                                        if (selectedCategory === "CRYPTO") return <Bitcoin className={iconClass} strokeWidth={2} />;
                                        if (selectedCategory === "FOREX") return <ArrowRightLeft className={iconClass} strokeWidth={2} />;
                                        return <Zap className={iconClass} strokeWidth={2} />;
                                    })()}
                                    <span className="text-[9px]">{selectedCategory === "ALL" ? "All" : ASSET_TYPES.find(t => t.value === selectedCategory)?.label.split(" ")[0]}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterDropdownOpen ? "rotate-180" : ""}`} strokeWidth={2} />
                                </button>
                                {filterDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-white/10 shadow-lg z-50 overflow-hidden">
                                        <div className="p-2 space-y-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedCategory("ALL");
                                                    setFilterDropdownOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedCategory === "ALL"
                                                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold"
                                                    : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300"
                                                    }`}
                                            >
                                                <Grid3x3 className="w-4 h-4 shrink-0" strokeWidth={2} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold">All Categories</div>
                                                </div>
                                                {selectedCategory === "ALL" && (
                                                    <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                                                )}
                                            </button>
                                            {ASSET_TYPES.map(type => (
                                                <button
                                                    key={type.value}
                                                    onClick={() => {
                                                        setSelectedCategory(type.value);
                                                        setFilterDropdownOpen(false);
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedCategory === type.value
                                                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold"
                                                        : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300"
                                                        }`}
                                                >
                                                    {(() => {
                                                        const iconClass = "w-4 h-4";
                                                        if (type.value === "PSX") return <Globe className={iconClass} strokeWidth={2} />;
                                                        if (type.value === "NASDAQ") return <Globe className={iconClass} strokeWidth={2} />;
                                                        if (type.value === "CRYPTO") return <Bitcoin className={iconClass} strokeWidth={2} />;
                                                        if (type.value === "FOREX") return <ArrowRightLeft className={iconClass} strokeWidth={2} />;
                                                        return <Zap className={iconClass} strokeWidth={2} />;
                                                    })()}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold">{type.label}</div>
                                                    </div>
                                                    {selectedCategory === type.value && (
                                                        <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => showAdd ? setShowAdd(false) : openAddTrade()}
                                className="whitespace-nowrap inline-flex items-center justify-center px-4 h-10 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
                            >
                                {showAdd ? "✕ Close" : "+ Add Trade"}
                            </button>
                            <input ref={uploadInputRef} type="file" accept=".csv,text/csv" onChange={handleUpload} className="hidden" />
                            <button
                                onClick={() => uploadInputRef.current?.click()}
                                disabled={uploading}
                                aria-label="Upload portfolio trades from CSV"
                                title="Upload portfolio trades from CSV"
                                className="shrink-0 inline-flex items-center justify-center gap-1.5 w-10 sm:w-auto h-10 sm:px-4 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-500/20 transition-all active:scale-95"
                            >
                                <Upload className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" strokeWidth={2} />
                                <span className="hidden sm:inline">{uploading ? "Validating" : "Upload CSV"}</span>
                            </button>
                            {/* Icon-only on phones — the label is what overflowed the row. */}
                            <button
                                onClick={download}
                                disabled={ledger.length === 0}
                                aria-label="Download trades as CSV"
                                title="Download trades as CSV"
                                className="shrink-0 inline-flex items-center justify-center gap-1.5 w-10 sm:w-auto h-10 sm:px-4 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 disabled:opacity-40 text-zinc-700 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-zinc-200 dark:border-white/10 transition-all active:scale-95"
                            >
                                <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" strokeWidth={2} />
                                <span className="hidden sm:inline">Download</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="page-shell mx-auto p-4 sm:p-8 relative z-10 space-y-6 sm:space-y-8">
                {uploadErrors.length > 0 && (
                    <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-red-600 dark:text-red-400">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2">Upload rejected. Fix these CSV validation issues:</p>
                        <ul className="space-y-1 text-[10px] font-bold">
                            {uploadErrors.map(issue => <li key={issue}>{issue}</li>)}
                        </ul>
                    </div>
                )}


                {/* Summary cards — day + total both shown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                    <div className="col-span-2 grid grid-cols-2 gap-3 sm:gap-4 rounded-2xl sm:rounded-[1.75rem] bg-blue-500/[0.04] dark:bg-blue-500/[0.06] border border-blue-500/15 p-2 sm:p-3">
                        <div className="rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900/70 p-3 sm:p-4 border border-zinc-200 dark:border-white/10 shadow-sm min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-[8px] sm:text-[9px] font-black text-zinc-400 uppercase tracking-widest">Invested</p>
                                <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
                            </div>
                            <FitText className="text-base sm:text-xl font-black font-mono tracking-tighter tabular-nums text-zinc-900 dark:text-white">{fmt(totals.invested)}</FitText>
                            <p className="text-[8px] font-bold text-zinc-400 mt-1 uppercase tracking-wider">Cost basis</p>
                        </div>
                        <div className="rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900/70 p-3 sm:p-4 border border-blue-500/25 shadow-sm min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-[8px] sm:text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Current value</p>
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                            </div>
                            <FitText className="text-base sm:text-xl font-black font-mono tracking-tighter tabular-nums text-blue-600 dark:text-blue-400">{fmt(totals.value)}</FitText>
                            <p className="text-[8px] font-bold text-zinc-400 mt-1 uppercase tracking-wider">Live valuation</p>
                        </div>
                        <div className="col-span-2 px-1 sm:px-2 pb-1">
                            <div className="flex items-center justify-between gap-2 mb-1.5 text-[8px] font-black uppercase tracking-widest">
                                <span className="text-zinc-400">Value vs invested</span>
                                <span className={totals.unrealized >= 0 ? "text-green-500" : "text-red-500"}>{totals.invested > 0 ? `${totals.unrealized >= 0 ? "+" : ""}${((totals.unrealized / totals.invested) * 100).toFixed(2)}%` : "—"}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden" aria-label="Current portfolio value compared with invested capital">
                                <div className={`h-full rounded-full transition-all duration-300 ${totals.unrealized >= 0 ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${totals.invested > 0 ? Math.min(100, Math.max(3, (totals.value / totals.invested) * 100)) : 3}%` }} />
                            </div>
                        </div>
                    </div>
                    {[
                        { label: "Day P/L", val: totals.day, tone: totals.day >= 0 ? "text-green-500" : "text-red-500", signed: true, pct: totals.value > 0 ? totals.dayPct : null },
                        { label: "Unrealized P/L", val: totals.unrealized, tone: totals.unrealized >= 0 ? "text-green-500" : "text-red-500", signed: true, pct: null },
                        { label: "Realized P/L", val: totals.realizedTotal, tone: totals.realizedTotal >= 0 ? "text-green-500" : "text-red-500", signed: true, pct: null },
                        { label: "Total P/L", val: totals.total, tone: totals.total >= 0 ? "text-green-500" : "text-red-500", signed: true, pct: totals.invested > 0 ? (totals.total / totals.invested) * 100 : null },
                    ].map((c, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900/50 rounded-2xl sm:rounded-[1.75rem] p-4 sm:p-5 border border-zinc-200 dark:border-white/5 shadow-sm">
                            <p className="text-[8px] sm:text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{c.label}</p>
                            <FitText className={`text-base sm:text-xl font-black font-mono tracking-tighter tabular-nums ${c.tone}`}>{c.signed ? signed(c.val) : fmt(c.val)}</FitText>
                            {c.pct != null && (
                                <p className={`text-[10px] font-black ${c.val >= 0 ? "text-green-500" : "text-red-500"}`}>{c.val >= 0 ? "▲" : "▼"} {Math.abs(c.pct).toFixed(2)}%</p>
                            )}
                        </div>
                    ))}
                </div>
                {/* Add transaction */}
                {showAdd && (
                    <div id="record-trade" className={`relative overflow-hidden bg-white dark:bg-zinc-900/60 backdrop-blur-sm rounded-2xl sm:rounded-[2rem] border shadow-sm p-4 sm:p-6 animate-in fade-in slide-in-from-top-2 ${form.type === "SELL" ? "border-red-500/20" : "border-emerald-500/20"}`}>
                        <div className={`absolute inset-x-0 top-0 h-1 ${form.type === "SELL" ? "bg-red-500" : "bg-emerald-500"}`} />
                        <div className="flex items-center justify-end gap-3 mb-5">
                            <span className={`shrink-0 inline-flex items-center min-h-8 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${form.type === "SELL" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                                {form.type === "SELL" ? "Sell order" : "Buy order"}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.05fr_1.05fr_1.25fr_1.15fr_1fr_1.15fr_0.95fr_1.15fr] gap-3 sm:gap-4 items-end">
                            <div className="col-span-1">
                                <label className={fieldLabelCls}>Date</label>
                                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
                            </div>
                            <div className="col-span-1">
                                <label className={fieldLabelCls}>Type</label>
                                <div className="grid grid-cols-2 gap-1 p-1 min-h-11 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
                                    <button type="button" onClick={() => setForm(f => ({ ...f, type: "BUY" }))} className={`min-h-9 rounded-lg inline-flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${form.type === "BUY" ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-500 hover:text-emerald-600"}`} aria-pressed={form.type === "BUY"}>
                                        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Buy
                                    </button>
                                    <button type="button" onClick={() => setForm(f => ({ ...f, type: "SELL" }))} className={`min-h-9 rounded-lg inline-flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${form.type === "SELL" ? "bg-red-600 text-white shadow-sm" : "text-zinc-500 hover:text-red-600"}`} aria-pressed={form.type === "SELL"}>
                                        <ArrowDownToLine className="w-3.5 h-3.5" strokeWidth={2.5} /> Sell
                                    </button>
                                </div>
                            </div>
                            <div className="col-span-1">
                                <label className={fieldLabelCls}>Asset <span className="text-blue-500" aria-hidden="true">*</span></label>
                                <select value={form.assetType} onChange={e => onPickType(e.target.value as AssetType)} className={inputCls}>
                                    {ASSET_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className={fieldLabelCls}>Symbol <span className="text-blue-500" aria-hidden="true">*</span></label>
                                <input list="sym-suggest" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} placeholder={form.assetType === "COMMODITY" ? "GOLD" : "HBL"} className={inputCls} />
                                <datalist id="sym-suggest">
                                    {(form.assetType === "COMMODITY" ? COMMODITY_SYMBOLS : symbolSuggestions).slice(0, 200).map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>
                            <div className="col-span-1">
                                <label className={fieldLabelCls}>Quantity <span className="text-blue-500" aria-hidden="true">*</span></label>
                                <input type="number" inputMode="decimal" min="0" max={availableForForm} step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="100" className={inputCls} />
                                {availableForForm != null && <p className="mt-1 text-[8px] font-black text-red-500 uppercase tracking-widest">Available: {availableForForm.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>}
                            </div>
                            <div className="col-span-1">
                                <label className={fieldLabelCls}>Price <span className="text-blue-500" aria-hidden="true">*</span></label>
                                <div className="relative">
                                    <input type="number" inputMode="decimal" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" className={`${inputCls} pr-16`} />
                                    <button type="button" onClick={autofillPrice} title="Fill with the live market price" className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-all"><RotateCcw className="w-3 h-3" strokeWidth={2} /> Live</button>
                                </div>
                            </div>
                            <div className="col-span-1">
                                <label className={fieldLabelCls}>Currency</label>
                                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as any }))} className={inputCls}>
                                    <option value="PKR">PKR</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                            <div className="col-span-1 flex items-end">
                                <button onClick={submit} disabled={saving} className={`w-full min-h-11 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] ${form.type === "SELL" ? "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/15" : "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/15"}`}>
                                    {saving ? "Saving…" : <>{form.type === "SELL" ? <ArrowDownToLine className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />}{form.type === "SELL" ? "Sell" : "Add"}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Section sub-navigation */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {[
                        { id: "analytics" as const, label: "Analytics" },
                        { id: "holdings" as const, label: "Holdings", count: rows.length },
                        { id: "history" as const, label: "History", count: ledger.length },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setPortTab(t.id)}
                            className={`px-4 sm:px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${portTab === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-white dark:bg-white/5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-white/10"}`}
                        >
                            {t.label}{"count" in t && t.count != null ? ` · ${t.count}` : ""}
                        </button>
                    ))}
                </div>

                {/* Interactive analytics */}
                {portTab === "analytics" && (
                    <div className="bg-white dark:bg-zinc-900/50 rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h2 className="text-sm font-black uppercase tracking-tighter italic flex items-center gap-2"><BarChart3 className="w-4 h-4 shrink-0" strokeWidth={2} /> Portfolio Analytics</h2>
                            <div className="flex bg-zinc-100 dark:bg-white/5 p-1 rounded-xl border border-zinc-200 dark:border-white/10 self-start sm:self-auto">
                                {([["alloc", "Allocation"], ["perf", "Performance"], ["timeline", "Timeline"]] as const).map(([v, l]) => (
                                    <button key={v} onClick={() => setChartView(v)} className={`px-3 sm:px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${chartView === v ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}>{l}</button>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 sm:p-6">
                            {rows.length === 0 && chartView !== "timeline" ? (
                                <div className="py-16 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">Add a holding to see analytics</div>
                            ) : chartView === "alloc" ? (
                                <div>
                                    <div className="flex justify-center sm:justify-end mb-3">
                                        <div className="flex bg-zinc-100 dark:bg-white/5 p-0.5 rounded-lg">
                                            <button onClick={() => setAllocBy("pos")} className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest ${allocBy === "pos" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500"}`}>By Position</button>
                                            <button onClick={() => setAllocBy("type")} className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest ${allocBy === "type" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500"}`}>By Class</button>
                                        </div>
                                    </div>
                                    {/* minmax(0,…): a bare `fr` track floors at its
                                    content's min width, so the chart column could
                                    push the row a few px past the viewport. */}
                                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-6 items-center">
                                        <div className="min-w-0 w-full h-[300px] sm:h-[360px] relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={allocData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                                        innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none"
                                                        {...({
                                                            activeIndex: activeIdx ?? undefined,
                                                            activeShape: renderActiveSlice,
                                                            onMouseEnter: (_: any, i: number) => setActiveIdx(i),
                                                            onMouseLeave: () => setActiveIdx(null),
                                                        } as any)}
                                                    >
                                                        {allocData.map((d, i) => <Cell key={i} fill={d.color} opacity={activeIdx == null || activeIdx === i ? 1 : 0.4} style={{ transition: "opacity .2s", cursor: "pointer" }} />)}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            {/* Center readout reflects the hovered slice */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-8 text-center">
                                                {activeIdx != null && allocData[activeIdx] ? (
                                                    <>
                                                        <span className="w-3 h-3 rounded-sm mb-1" style={{ background: allocData[activeIdx].color }} />
                                                        <span className="text-xs font-black uppercase tracking-tight truncate max-w-full">{allocData[activeIdx].name}</span>
                                                        <span className="text-base sm:text-lg font-black font-mono tabular-nums">{fmt(allocData[activeIdx].value)}</span>
                                                        <span className="text-[10px] font-black text-blue-500">{allocTotal > 0 ? ((allocData[activeIdx].value / allocTotal) * 100).toFixed(1) : "0"}%</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Total Value</span>
                                                        <span className="text-lg sm:text-2xl font-black font-mono tabular-nums">{fmt(allocTotal)}</span>
                                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{allocData.length} assets · hover to inspect</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1 max-h-[360px] overflow-y-auto custom-scrollbar pr-1 min-w-0">
                                            {allocData.map((d, i) => (
                                                <button
                                                    key={i} type="button"
                                                    onMouseEnter={() => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)}
                                                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-all ${activeIdx === i ? "bg-zinc-100 dark:bg-white/[0.06]" : "hover:bg-zinc-50 dark:hover:bg-white/[0.03]"}`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0"><span className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.color }} /><span className="text-xs font-black truncate">{d.name}</span></div>
                                                    <div className="text-right shrink-0"><span className="text-xs font-mono font-black tabular-nums">{fmt(d.value)}</span><span className="text-[9px] text-zinc-400 font-black ml-2 tabular-nums">{allocTotal > 0 ? ((d.value / allocTotal) * 100).toFixed(1) : "0"}%</span></div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : chartView === "perf" ? (
                                <div>
                                    <div className="flex justify-center sm:justify-end mb-3">
                                        <div className="flex bg-zinc-100 dark:bg-white/5 p-0.5 rounded-lg">
                                            <button onClick={() => setPerfMetric("total")} className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest ${perfMetric === "total" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500"}`}>Total P/L</button>
                                            <button onClick={() => setPerfMetric("day")} className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest ${perfMetric === "day" ? "bg-white dark:bg-zinc-800 text-blue-600 shadow" : "text-zinc-500"}`}>Day P/L</button>
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart data={perfData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={perfData.length > 6 ? -30 : 0} textAnchor={perfData.length > 6 ? "end" : "middle"} height={perfData.length > 6 ? 50 : 20} />
                                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => compact(v)} />
                                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} formatter={(v: any) => [signed(v as number), perfMetric === "day" ? "Day P/L" : "Total P/L"]} />
                                            <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                                                {perfData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "#22c55e" : "#ef4444"} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                timelineData.length === 0 ? (
                                    <div className="py-16 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">Record trades to build your timeline</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <AreaChart data={timelineData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                                            <defs><linearGradient id="pf-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} minTickGap={28} />
                                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => compact(v)} />
                                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmt(v as number), "Capital Deployed"]} />
                                            <Area type="monotone" dataKey="invested" stroke="#3b82f6" strokeWidth={2} fill="url(#pf-grad)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* Current holdings */}
                {portTab === "holdings" && (
                    <div className="bg-white dark:bg-zinc-900/50 rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between gap-2">
                            <h2 className="text-sm font-black uppercase tracking-tighter italic">Current Holdings</h2>
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{ledgerLoading ? "Loading…" : pricesLoading ? "Pricing…" : `${rows.length} positions · ${book.updated}`}</span>
                        </div>
                        {ledgerLoading && rows.length === 0 ? (
                            <div className="py-16 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="py-16 text-center px-4">
                                <BarChart3 className="w-8 h-8 mx-auto mb-3 text-zinc-400" strokeWidth={1.5} />
                                <p className="text-zinc-500 font-black uppercase tracking-widest text-[11px] mb-1">No open positions</p>
                                <p className="text-zinc-400 text-[10px] mb-4">Add a Buy trade — stocks, crypto, forex or commodities — to start tracking P/L.</p>
                                <button onClick={openAddTrade} className="inline-flex items-center px-2 py-2 min-h-[34px] text-[10px] font-black text-blue-500 uppercase tracking-widest border-b border-blue-500/40 hover:border-blue-500">+ Add your first trade</button>
                            </div>
                        ) : (
                            <>
                                {/* Phones: stacked cards. A row of numeric columns can't fit
                            under ~390px, and side-scrolling a table hides the P/L
                            that matters most. Cards show more, not less. */}
                                <div className="sm:hidden p-3 space-y-3">
                                    {rows.map(r => (
                                        <div key={`${r.assetType}:${r.symbol}:${r.currency}`} className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03] p-4 space-y-3 transition-all duration-200 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${typeBadge(r.assetType)}`}>{r.assetType}</span>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black tracking-tight truncate">{r.symbol}</div>
                                                        <div className="text-[9px] text-zinc-400 font-bold truncate">{r.name || "—"}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-1">Last price</div>
                                                    <div className={`text-sm font-black font-mono tabular-nums leading-none ${r.current == null ? "text-zinc-400" : r.current >= r.avgCost ? "text-green-500" : "text-red-500"}`}>
                                                        {fmt(r.current, r.currency)}
                                                    </div>
                                                    {/* Today's move on one share — the amount as
                                                well as the percentage, so it reads the
                                                same way as the P/L figures below. */}
                                                    {r.dayPct != null && (
                                                        <div className={`text-[9px] font-black font-mono tabular-nums mt-0.5 ${r.dayPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                            {r.dayPerShare != null && <span className="mr-1">{signed(r.dayPerShare, r.currency)}</span>}
                                                            {r.dayPct >= 0 ? "▲" : "▼"} {Math.abs(r.dayPct).toFixed(2)}%
                                                        </div>
                                                    )}
                                                    <div className="text-[9px] text-zinc-400 font-bold tabular-nums mt-0.5">
                                                        {r.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} units
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 border-y border-zinc-200 dark:border-white/10 py-3">
                                                <div className="min-w-0">
                                                    <p className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Current value</p>
                                                    <FitText className="text-base font-black font-mono tabular-nums text-zinc-900 dark:text-white">{fmt(r.value, r.currency)}</FitText>
                                                </div>
                                                <div className="min-w-0 border-l border-zinc-200 dark:border-white/10 pl-3">
                                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Invested</p>
                                                    <FitText className="text-base font-black font-mono tabular-nums text-zinc-700 dark:text-zinc-200">{fmt(r.invested, r.currency)}</FitText>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-widest">
                                                    <span className="text-zinc-400">Value vs invested</span>
                                                    <span className={r.pnl == null ? "text-zinc-400" : r.pnl >= 0 ? "text-green-500" : "text-red-500"}>
                                                        {r.pnlPct == null ? "Pricing unavailable" : `${r.pnlPct >= 0 ? "+" : ""}${r.pnlPct.toFixed(2)}%`}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden" aria-label={r.pnlPct == null ? "Value comparison unavailable" : `Current value is ${r.pnlPct.toFixed(2)} percent relative to invested cost`}>
                                                    <div className={`h-full rounded-full transition-all duration-300 ${r.pnl == null ? "bg-zinc-300 dark:bg-white/20" : r.pnl >= 0 ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${r.value != null && r.invested > 0 ? Math.min(100, Math.max(4, (r.value / r.invested) * 100)) : 4}%` }} />
                                                </div>
                                            </div>

                                            <div className="rounded-xl bg-white/70 dark:bg-black/10 border border-zinc-200 dark:border-white/5 px-3 py-2">
                                                <div className="flex items-stretch gap-2">
                                                    {[
                                                        { label: "Buy Rate", val: fmt(r.avgCost, r.currency), tone: "" },
                                                        { label: "Units", val: r.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 }), tone: "" },
                                                    ].map((m, i) => (
                                                        <div key={m.label} className="contents">
                                                            {i > 0 && <div className="w-px bg-zinc-200 dark:bg-white/10 shrink-0" />}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">{m.label}</p>
                                                                <FitText className={`text-[11px] font-black font-mono tabular-nums ${m.tone}`}>{m.val}</FitText>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="h-px bg-zinc-200 dark:bg-white/10 my-2" />

                                                <div className="flex items-stretch gap-2">
                                                    {[
                                                        { label: "Day P/L", val: r.dayPnl, pct: r.dayPct },
                                                        { label: "Total P/L", val: r.pnl, pct: r.pnlPct },
                                                    ].map((m, i) => {
                                                        const up = (m.val ?? 0) >= 0;
                                                        const tone = m.val == null ? "text-zinc-400" : up ? "text-green-500" : "text-red-500";
                                                        return (
                                                            <div key={m.label} className="contents">
                                                                {i > 0 && <div className="w-px bg-zinc-200 dark:bg-white/10 shrink-0" />}
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">{m.label}</p>
                                                                    <FitText className={`text-xs font-black font-mono tabular-nums ${tone}`}>
                                                                        {signed(m.val, r.currency)}
                                                                        {m.pct != null && (
                                                                            <span className="text-[9px] ml-1.5">
                                                                                {m.pct >= 0 ? "▲" : "▼"} {Math.abs(m.pct).toFixed(2)}%
                                                                            </span>
                                                                        )}
                                                                    </FitText>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {r.current != null && (
                                                <div className="flex items-baseline justify-between gap-2 min-w-0">
                                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest shrink-0">Gain per unit</span>
                                                    <span className={`text-[10px] font-mono font-black tabular-nums truncate ${r.current - r.avgCost >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                        {signed(r.current - r.avgCost, r.currency)}
                                                    </span>
                                                </div>
                                            )}
                                            <button onClick={() => startSell(r)} className="w-full min-h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest" title={`Sell ${r.symbol}`}>
                                                <ArrowDownToLine className="w-4 h-4" strokeWidth={2.5} /> Sell
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[8px] sm:text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-white/5">
                                                <th className="px-2 sm:px-6 py-3">Asset</th>
                                                <th className="px-2 sm:px-4 py-3 text-right hidden sm:table-cell">Qty</th>
                                                <th className="px-2 sm:px-4 py-3 text-right hidden lg:table-cell">Avg Cost</th>
                                                <th className="px-2 sm:px-4 py-3 text-right hidden md:table-cell">Current</th>
                                                <th className="px-2 sm:px-4 py-3 text-right hidden lg:table-cell">Invested</th>
                                                <th className="px-2 sm:px-4 py-3 text-right">Value</th>
                                                <th className="px-2 sm:px-4 py-3 text-right hidden md:table-cell">Day P/L</th>
                                                <th className="px-2 sm:px-6 py-3 text-right">Total P/L</th>
                                                <th className="px-2 sm:px-6 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                                            {rows.map(r => (
                                                <tr key={`${r.assetType}:${r.symbol}:${r.currency}`} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                                                    <td className="px-2 sm:px-6 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${typeBadge(r.assetType)}`}>{r.assetType}</span>
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-black tracking-tight truncate">{r.symbol}</div>
                                                                <div className="text-[9px] text-zinc-400 font-bold truncate max-w-[88px] sm:max-w-[160px]">{r.name || "—"}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-3 text-right font-mono text-xs tabular-nums hidden sm:table-cell">{r.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                                    <td className="px-2 sm:px-4 py-3 text-right font-mono text-xs tabular-nums text-zinc-500 hidden lg:table-cell">{fmt(r.avgCost, r.currency)}</td>
                                                    <td className="px-2 sm:px-4 py-3 text-right hidden md:table-cell">
                                                        <div className="font-mono text-xs tabular-nums">{fmt(r.current, r.currency)}</div>
                                                        {/* Today's move on one share, amount and
                                                    percentage — the Day P/L column beside
                                                    it is the same move on the whole
                                                    position. */}
                                                        {r.dayPct != null && (
                                                            <div className={`text-[9px] font-black font-mono tabular-nums ${r.dayPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                                {r.dayPerShare != null && <span className="mr-1">{signed(r.dayPerShare, r.currency)}</span>}
                                                                {r.dayPct >= 0 ? "▲" : "▼"} {Math.abs(r.dayPct).toFixed(2)}%
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-3 text-right font-mono text-xs tabular-nums text-zinc-500 hidden lg:table-cell">{fmt(r.invested, r.currency)}</td>
                                                    <td className="px-2 sm:px-4 py-3 text-right font-mono text-xs tabular-nums font-black">{fmt(r.value, r.currency)}</td>
                                                    <td className="px-2 sm:px-4 py-3 text-right hidden md:table-cell">
                                                        <div className={`font-mono text-xs font-black tabular-nums ${r.dayPnl == null ? "text-zinc-400" : r.dayPnl >= 0 ? "text-green-500" : "text-red-500"}`}>{signed(r.dayPnl, r.currency)}</div>
                                                        {r.dayPct != null && <div className={`text-[9px] font-black ${r.dayPct >= 0 ? "text-green-500" : "text-red-500"}`}>{r.dayPct >= 0 ? "▲" : "▼"} {Math.abs(r.dayPct).toFixed(2)}%</div>}
                                                    </td>
                                                    <td className="px-2 sm:px-6 py-3 text-right">
                                                        <div className={`font-mono text-xs font-black tabular-nums ${r.pnl == null ? "text-zinc-400" : r.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>{signed(r.pnl, r.currency)}</div>
                                                        {r.pnlPct != null && <div className={`text-[9px] font-black ${r.pnlPct >= 0 ? "text-green-500" : "text-red-500"}`}>{r.pnlPct >= 0 ? "▲" : "▼"} {Math.abs(r.pnlPct).toFixed(2)}%</div>}
                                                    </td>
                                                    <td className="px-2 sm:px-6 py-3 text-right">
                                                        <button onClick={() => startSell(r)} className="inline-flex items-center justify-center gap-1.5 min-h-9 px-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-[9px] font-black uppercase tracking-widest" title={`Sell ${r.symbol}`}>
                                                            <ArrowDownToLine className="w-3.5 h-3.5" strokeWidth={2.5} /> Sell
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Trade ledger (previous trading) with date filter */}
                {portTab === "history" && (
                    <div className="bg-white dark:bg-zinc-900/50 rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 shadow-sm overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h2 className="text-sm font-black uppercase tracking-tighter italic">Trade History <span className="text-zinc-400">· {ledger.length}</span></h2>
                            {/* One row on phones: two native date inputs plus both word
                            labels overrun the card, so the labels give way to a compact
                            arrow and the inputs share the remaining width. */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="hidden sm:inline text-[9px] font-black text-zinc-400 uppercase tracking-widest shrink-0">From</span>
                                <input
                                    type="date"
                                    value={from}
                                    onChange={e => setFrom(e.target.value)}
                                    aria-label="From date"
                                    className="flex-1 sm:flex-none min-w-0 w-full sm:w-auto px-2 py-1.5 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="shrink-0 text-[10px] font-black text-zinc-400 sm:hidden">→</span>
                                <span className="hidden sm:inline text-[9px] font-black text-zinc-400 uppercase tracking-widest shrink-0">To</span>
                                <input
                                    type="date"
                                    value={to}
                                    onChange={e => setTo(e.target.value)}
                                    aria-label="To date"
                                    className="flex-1 sm:flex-none min-w-0 w-full sm:w-auto px-2 py-1.5 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {(from || to) && (
                                    <button
                                        onClick={() => { setFrom(""); setTo(""); }}
                                        aria-label="Clear date filter"
                                        className="shrink-0 px-1.5 h-9 text-[9px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                        {ledger.length === 0 ? (
                            <div className="py-14 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">No trades {from || to ? "in this date range" : "yet"}</div>
                        ) : (
                            <>
                                {/* Phones: same card treatment as Holdings — the table was
                            within 2px of overflowing at 320px. */}
                                <div className="sm:hidden divide-y divide-zinc-100 dark:divide-white/5">
                                    {ledger.map(t => (
                                        <div key={t.id} className="p-4 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${t.type === "BUY" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>{t.type}</span>
                                                    <span className="text-xs font-black tracking-tight truncate">{t.symbol}</span>
                                                    <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded ${typeBadge(t.assetType)}`}>{t.assetType}</span>
                                                </div>
                                                <p className="text-[9px] font-mono text-zinc-400 tabular-nums mt-1 truncate">
                                                    {t.date} · {t.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} @ {fmt(t.price, t.currency)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="font-mono text-xs font-black tabular-nums">{fmt(t.quantity * t.price, t.currency)}</span>
                                                <button onClick={() => remove(t)} className="text-zinc-400 hover:text-red-500 text-sm px-1.5 py-1" title="Delete">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[8px] sm:text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-white/5">
                                                <th className="px-2 sm:px-6 py-3 hidden sm:table-cell">Date</th>
                                                <th className="px-2 sm:px-4 py-3">Type</th>
                                                <th className="px-2 sm:px-4 py-3">Asset</th>
                                                <th className="px-2 sm:px-4 py-3 text-right hidden md:table-cell">Qty</th>
                                                <th className="px-2 sm:px-4 py-3 text-right hidden sm:table-cell">Price</th>
                                                <th className="px-2 sm:px-4 py-3 text-right">Value</th>
                                                <th className="px-2 sm:px-6 py-3"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                                            {ledger.map(t => (
                                                <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                                                    <td className="px-2 sm:px-6 py-3 font-mono text-[11px] tabular-nums text-zinc-500 hidden sm:table-cell">{t.date}</td>
                                                    <td className="px-2 sm:px-4 py-3"><span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${t.type === "BUY" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>{t.type}</span></td>
                                                    <td className="px-2 sm:px-4 py-3">
                                                        <span className="text-xs font-black">{t.symbol}</span> <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded ${typeBadge(t.assetType)}`}>{t.assetType}</span>
                                                        <span className="sm:hidden block text-[9px] font-mono text-zinc-400 tabular-nums mt-0.5">{t.date}</span>
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-3 text-right font-mono text-xs tabular-nums hidden md:table-cell">{t.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                                    <td className="px-2 sm:px-4 py-3 text-right font-mono text-xs tabular-nums hidden sm:table-cell">{fmt(t.price, t.currency)}</td>
                                                    <td className="px-2 sm:px-4 py-3 text-right font-mono text-xs tabular-nums font-black">{fmt(t.quantity * t.price, t.currency)}</td>
                                                    <td className="px-2 sm:px-6 py-3 text-right"><button onClick={() => remove(t)} className="text-zinc-400 hover:text-red-500 text-sm px-2" title="Delete">✕</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                        {ledger.length > 0 && (
                            <div className="px-4 sm:px-6 py-3 border-t border-zinc-100 dark:border-white/5 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-[10px] font-black uppercase tracking-widest">
                                <span className="text-zinc-400">Bought <span className="text-green-500">{fmt(ledger.filter(t => t.type === "BUY").reduce((a, t) => a + convert(t.quantity * t.price, t.currency, displayCur), 0))}</span></span>
                                <span className="text-zinc-400">Sold <span className="text-red-500">{fmt(ledger.filter(t => t.type === "SELL").reduce((a, t) => a + convert(t.quantity * t.price, t.currency, displayCur), 0))}</span></span>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
