"use client";

import StockCard from "../components/StockCard";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useSettings } from "../context/SettingsContext";
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function NasdaqPage() {
    interface Stock {
        symbol: string;
        name: string;
        currentPrice: number;
        change: number;
        changePercent: number;
        open: number;
        high: number;
        low: number;
        volume: string;
        targetPrice?: number;
        sector?: string;
        history?: { time: string; price: number }[];
    }

    const [filter, setFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [stocks, setStocks] = useState<Stock[]>([]);
    const router = useRouter();
    const [sectors, setSectors] = useState<string[]>([]);
    const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: keyof Stock; direction: 'asc' | 'desc' } | null>(null);

    // Watchlist State
    const [watchlists, setWatchlists] = useState<any[]>([]);
    const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
    const [newWatchlistName, setNewWatchlistName] = useState("");
    const [isCreatingWatchlist, setIsCreatingWatchlist] = useState(false);

    // Table Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Card Pagination State
    const [currentCardPage, setCurrentCardPage] = useState(1);
    const cardsPerPage = 10;

    const { settings } = useSettings();

    const load = async (isManual = true) => {
        try {
            if (isManual) setLoading(true);
            const res = await fetch('/api/nasdaq-stocks');
            const json = await res.json();
            const rawData: Stock[] = json?.data || [];

            const generateHistory = (currentPrice: number) => {
                const history = [];
                let lastPrice = currentPrice;
                for (let i = 6; i >= 0; i--) {
                    const change = (Math.random() - 0.5) * (currentPrice * 0.02);
                    lastPrice = lastPrice - change;
                    history.push({
                        time: `${i}d ago`,
                        price: parseFloat(lastPrice.toFixed(2))
                    });
                }
                return history.reverse();
            };

            const data = rawData
                .filter(s => s && s.symbol)
                .map(s => ({
                    ...s,
                    history: generateHistory(s.currentPrice || 0)
                })).sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));

            setStocks(data);

            const allSectorsArr = Array.from(new Set(data.map((s) => s.sector || 'Other'))).sort();
            setSectors(['All', ...allSectorsArr]);
        } catch (err) {
            console.error('Failed to load NASDAQ stocks', err);
        } finally {
            if (isManual) setLoading(false);
        }
    };

    const fetchWatchlists = async () => {
        try {
            const res = await fetch('/api/watchlists');
            const json = await res.json();
            if (json.success) setWatchlists(json.data);
        } catch (err) {
            console.error('Failed to fetch watchlists', err);
        }
    };

    const handleCreateWatchlist = async () => {
        if (!newWatchlistName.trim()) return;
        try {
            const res = await fetch('/api/watchlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newWatchlistName, symbols: [] }),
            });
            const json = await res.json();
            if (json.success) {
                setWatchlists([json.data, ...watchlists]);
                setNewWatchlistName("");
                setIsCreatingWatchlist(false);
            }
        } catch (err) {
            console.error('Failed to create watchlist', err);
        }
    };

    const handleAddToWatchlist = async (watchlistId: string, symbol: string) => {
        const watchlist = watchlists.find(wl => wl._id === watchlistId);
        if (!watchlist || !symbol) return;

        const currentSymbols = watchlist.symbols || [];
        if (currentSymbols.includes(symbol.toUpperCase())) return;

        const newSymbols = [...currentSymbols, symbol.toUpperCase()];

        try {
            const res = await fetch(`/api/watchlists/${watchlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: newSymbols }),
            });
            const json = await res.json();
            if (json.success) {
                setWatchlists(watchlists.map(wl => wl._id === watchlistId ? json.data : wl));
            }
        } catch (err) {
            console.error('Failed to add symbol to watchlist', err);
        }
    };

    const handleRemoveFromWatchlist = async (watchlistId: string, symbol: string) => {
        const watchlist = watchlists.find(wl => wl._id === watchlistId);
        if (!watchlist || !symbol) return;

        const currentSymbols = watchlist.symbols || [];
        const newSymbols = currentSymbols.filter((s: string) => s !== symbol.toUpperCase());

        try {
            const res = await fetch(`/api/watchlists/${watchlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: newSymbols }),
            });
            const json = await res.json();
            if (json.success) {
                setWatchlists(watchlists.map(wl => wl._id === watchlistId ? json.data : wl));
            }
        } catch (err) {
            console.error('Failed to remove symbol from watchlist', err);
        }
    };

    useEffect(() => {
        load(true);
        fetchWatchlists();
    }, []);

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                <p>Loading NASDAQ data...</p>
            </div>
        );
    }

    useEffect(() => {
        if (!settings.refreshInterval || settings.refreshInterval <= 0) return;

        const interval = setInterval(() => {
            load(false);
        }, settings.refreshInterval * 1000);

        return () => clearInterval(interval);
    }, [settings.refreshInterval]);

    const requestSort = (key: keyof Stock) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    useEffect(() => {
        let updated = stocks;

        // 0. Watchlist Filtering
        if (activeWatchlistId) {
            const activeWL = watchlists.find(wl => wl._id === activeWatchlistId);
            if (activeWL && activeWL.symbols) {
                updated = updated.filter(s => activeWL.symbols.includes(s.symbol.toUpperCase()));
            } else if (activeWL && activeWL.symbols.length === 0) {
                updated = []; // Empty watchlist shows no stocks
            }
        }

        // 1. Sector Filter
        if (filter !== 'all') {
            updated = updated.filter((s) => (s.sector || 'Other').toLowerCase() === filter.toLowerCase());
        }

        // 2.5 Category Filter
        if (categoryFilter && categoryFilter !== 'all') {
            if (categoryFilter === 'gainers') {
                updated = [...updated]
                    .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
                    .slice(0, 50);
            } else if (categoryFilter === 'losers') {
                updated = [...updated]
                    .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
                    .slice(0, 50);
            } else if (categoryFilter === 'active') {
                updated = [...updated]
                    .sort((a, b) => {
                        const va = parseInt(a.volume.replace(/,/g, '')) || 0;
                        const vb = parseInt(b.volume.replace(/,/g, '')) || 0;
                        return vb - va;
                    })
                    .slice(0, 50);
            }
        }

        // 3. Search Filter
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            updated = updated.filter((s) =>
                s.symbol.toLowerCase().includes(lowSearch) ||
                s.name.toLowerCase().includes(lowSearch)
            );
        }

        // 4. Sorting
        if (sortConfig) {
            updated = [...updated].sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (aVal === undefined || bVal === undefined) return 0;

                if (aVal < bVal) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        setFilteredStocks(updated);
        setCurrentPage(1);
        setCurrentCardPage(1);
    }, [filter, stocks, searchTerm, sortConfig, activeWatchlistId, watchlists]);

    // Table Pagination
    const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedStocks = filteredStocks.slice(startIndex, startIndex + itemsPerPage);

    // Card Pagination
    const totalCardPages = Math.ceil(filteredStocks.length / cardsPerPage);
    const cardStartIndex = (currentCardPage - 1) * cardsPerPage;
    const paginatedCards = filteredStocks.slice(cardStartIndex, cardStartIndex + cardsPerPage);

    const SortIcon = ({ column }: { column: keyof Stock }) => {
        const isActive = sortConfig?.key === column;
        const isAsc = sortConfig?.direction === 'asc';
        return (
            <span className="inline-flex flex-col ml-2 -space-y-1.5 align-middle">
                <span className={`text-[7px] transition-colors ${isActive && isAsc ? 'text-blue-500' : 'text-zinc-300 dark:text-zinc-700'}`}>▲</span>
                <span className={`text-[7px] transition-colors ${isActive && !isAsc ? 'text-blue-500' : 'text-zinc-300 dark:text-zinc-700'}`}>▼</span>
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white selection:bg-blue-500/30">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
                <div className="max-w-[1600px] mx-auto px-8 py-6">
                    <h1 className="text-3xl font-black tracking-tighter italic uppercase text-zinc-900 dark:text-white">
                        🧭 NASDAQ <span className="text-blue-500">Explorer</span>
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                        NASDAQ Real-Time Trading Terminal
                    </p>
                </div>
            </header>

            {/* Global Index Ticker - "Index data above" */}
            {false && (
                <div className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 py-2.5 w-full overflow-hidden shadow-sm sticky top-[73px] z-30">
                    {/* not used for NASDAQ */}
                </div>
            )}

            <div className="px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
                {/* Market Control Center */}
                <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-blue-600 text-xs">🛠️</span>
                            <h3 className="text-[10px] font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-[0.2em]">Market Controls</h3>
                        </div>
                        <button
                            onClick={() => { setFilter('all'); setCategoryFilter('all'); setSearchTerm(""); }}
                            className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors"
                        >
                            Reset All Filters
                        </button>
                    </div>

                    <div className="p-4 space-y-6">
                        {/* Primary Selection & Live Metric */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest pl-1">Index Selector</p>
                                <div className="relative group">
                                    <select
                                        value={""}
                                        onChange={() => { }}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-black text-zinc-900 dark:text-zinc-50 appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                    >
                                        <option value="">All Market (Exchange Wide)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px] group-hover:text-blue-500 transition-colors">▼</div>
                                </div>
                            </div>
                        </div>

                        {/* Watchlist Management */}
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center px-1">
                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Watchlist Hub</p>
                                <button
                                    onClick={() => setIsCreatingWatchlist(!isCreatingWatchlist)}
                                    className="text-[9px] font-bold text-blue-600 hover:underline"
                                >
                                    {isCreatingWatchlist ? "Cancel" : "+ New Watchlist"}
                                </button>
                            </div>

                            {isCreatingWatchlist && (
                                <div className="flex gap-2 p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100/50 dark:border-blue-800/30 animate-in fade-in zoom-in-95">
                                    <input
                                        type="text"
                                        placeholder="Enter name (e.g. My Favorites)"
                                        value={newWatchlistName}
                                        onChange={(e) => setNewWatchlistName(e.target.value)}
                                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                        onKeyPress={(e) => e.key === 'Enter' && handleCreateWatchlist()}
                                    />
                                    <button
                                        onClick={handleCreateWatchlist}
                                        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                                    >
                                        Create
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 scroll-smooth">
                                <button
                                    onClick={() => setActiveWatchlistId(null)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border ${!activeWatchlistId
                                        ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900"
                                        : "text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800"
                                        }`}
                                >
                                    Global Market
                                </button>
                                {watchlists.map((wl) => (
                                    <button
                                        key={wl._id}
                                        onClick={() => setActiveWatchlistId(wl._id)}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border flex items-center gap-2 ${activeWatchlistId === wl._id
                                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10"
                                            : "text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200"
                                            }`}
                                    >
                                        <span>📂</span> {wl.name}
                                        <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${activeWatchlistId === wl._id ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                                            {wl.symbols?.length || 0}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* High-Level Benchmarks Grid */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Market Benchmarks</p>
                                <span className="text-[9px] font-bold text-zinc-400 italic">Click to focus and filter market data</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                <button
                                    onClick={() => { /* no-op */ }}
                                    className={`p-3 rounded-2xl border transition-all text-left group bg-zinc-900 border-transparent shadow-lg shadow-zinc-500/10 text-white`}
                                >
                                    <p className={`text-[8px] font-black uppercase tracking-widest mb-1 text-zinc-400`}>Total Market</p>
                                    <p className="text-sm font-black uppercase tracking-tighter">All Scripts</p>
                                </button>
                            </div>
                        </div>

                        {/* Secondary Filters: Sectors */}
                        <div className="space-y-3 pt-2">
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest pl-1">Sector Depth</p>
                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 scroll-smooth">
                                {sectors.map((sector) => (
                                    <button
                                        key={sector}
                                        onClick={() => setFilter(sector === 'All' ? 'all' : sector)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border ${filter === (sector === 'All' ? 'all' : sector)
                                            ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 shadow-md"
                                            : "text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200"
                                            }`}
                                    >
                                        {sector}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* New category dropdown */}
                        <div className="space-y-3 pt-2">
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest pl-1">Market Filter</p>
                            <div className="relative group max-w-xs">
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-black text-zinc-900 dark:text-zinc-50 appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                >
                                    <option value="all">All Scripts</option>
                                    <option value="gainers">Top Gainers</option>
                                    <option value="active">Most Active</option>
                                    <option value="losers">Top Losers</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px] group-hover:text-blue-500 transition-colors">▼</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stock Explorer Cards */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-1 gap-4">
                        <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight flex items-center gap-2">
                            <span className="bg-blue-100 dark:bg-blue-900/30 p-1 rounded-md text-blue-600 dark:text-blue-400">🗂️</span> Market Scripts
                        </h2>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-4 order-2 md:order-none">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search Scripts..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-9 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-bold shadow-sm"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {paginatedCards.length > 0 ? paginatedCards.map((stock) => (
                            <div key={stock.symbol} className="min-w-0">
                                <StockCard
                                    {...stock}
                                    exchange="NASDAQ"
                                    onClick={() => router.push(`/nasdaq/${stock.symbol.toLowerCase()}`)}
                                    watchlists={watchlists}
                                    activeWatchlistId={activeWatchlistId}
                                    onAddToWatchlist={handleAddToWatchlist}
                                    onRemoveFromWatchlist={handleRemoveFromWatchlist}
                                    onWatchlistCreated={(newList) => setWatchlists([newList, ...watchlists])}
                                />
                            </div>
                        )) : (
                            <div className="col-span-full py-12 text-center text-zinc-400 font-bold italic">No scripts found matching search/filter</div>
                        )}
                    </div>

                    {totalCardPages > 1 && (
                        <div className="flex justify-center pt-4">
                            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <button
                                    onClick={() => setCurrentCardPage(p => Math.max(1, p - 1))}
                                    disabled={currentCardPage === 1}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 disabled:opacity-20 transition-all font-bold text-[10px] uppercase tracking-wider"
                                >
                                    <span>←</span> Prev
                                </button>
                                <div className="h-4 w-[1px] bg-zinc-100 dark:bg-zinc-800 mx-1"></div>
                                <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-50 min-w-[60px] text-center">
                                    {currentCardPage} <span className="text-zinc-400 font-bold mx-1">/</span> {totalCardPages}
                                </span>
                                <div className="h-4 w-[1px] bg-zinc-100 dark:bg-zinc-800 mx-1"></div>
                                <button
                                    onClick={() => setCurrentCardPage(p => Math.min(totalCardPages, p + 1))}
                                    disabled={currentCardPage === totalCardPages}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 disabled:opacity-20 transition-all font-bold text-[10px] uppercase tracking-wider"
                                >
                                    Next <span>→</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Table continues unchanged from stocks page but using filteredStocks */}
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-50/50 dark:bg-zinc-800/20">
                            <div>
                                <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">Market Analytics Table</h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800">
                                    {filteredStocks.length} Companies Listed
                                </span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-zinc-50 dark:bg-zinc-950">
                                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400">
                                        <th onClick={() => requestSort('symbol')} className="p-4 font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">Symbol <SortIcon column="symbol" /></th>
                                        <th onClick={() => requestSort('name')} className="p-4 font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">Company <SortIcon column="name" /></th>
                                        <th onClick={() => requestSort('currentPrice')} className="p-4 font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">Price <SortIcon column="currentPrice" /></th>
                                        <th onClick={() => requestSort('changePercent')} className="p-4 font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">% <SortIcon column="changePercent" /></th>
                                        <th onClick={() => requestSort('volume')} className="p-4 font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">Volume <SortIcon column="volume" /></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedStocks.map((s) => {
                                        const isPos = s.change >= 0;
                                        return (
                                            <tr key={s.symbol} className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer" onClick={() => router.push(`/nasdaq/${s.symbol.toLowerCase()}`)}>
                                                <td className="p-4 font-bold uppercase">{s.symbol}</td>
                                                <td className="p-4 font-semibold truncate max-w-[200px]">{s.name}</td>
                                                <td className="p-4 font-mono">{s.currentPrice.toLocaleString()}</td>
                                                <td className={`p-4 font-bold ${isPos ? 'text-green-600' : 'text-red-600'}`}>{s.changePercent.toFixed(2)}%</td>
                                                <td className="p-4">{s.volume}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center py-4">
                                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 disabled:opacity-20 transition-all font-bold text-[10px] uppercase tracking-wider"
                                    >
                                        <span>←</span> Prev
                                    </button>
                                    <div className="h-4 w-[1px] bg-zinc-100 dark:bg-zinc-800 mx-1"></div>
                                    <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-50 min-w-[60px] text-center">
                                        {currentPage} <span className="text-zinc-400 font-bold mx-1">/</span> {totalPages}
                                    </span>
                                    <div className="h-4 w-[1px] bg-zinc-100 dark:bg-zinc-800 mx-1"></div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 disabled:opacity-20 transition-all font-bold text-[10px] uppercase tracking-wider"
                                    >
                                        Next <span>→</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
