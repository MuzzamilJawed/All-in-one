"use client";

import StockCard from "../components/StockCard";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useSettings } from "../context/SettingsContext";
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function StocksPage() {
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

    interface Index {
        name: string;
        value: number;
        change: number;
        changePercent: number;
    }

    const [filter, setFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [indexFilter, setIndexFilter] = useState<string | null>("KSE100");
    const [stocks, setStocks] = useState<Stock[]>([]);
    const router = useRouter();
    const [indices, setIndices] = useState<Index[]>([]);
    const [marketStats, setMarketStats] = useState<any>(null);
    const [sectors, setSectors] = useState<string[]>([]);
    const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIndex, setSelectedIndex] = useState<Index | null>(null);
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
            const res = await fetch('/api/psx-stocks');
            const json = await res.json();
            const rawData: Stock[] = json?.data || [];
            const rawIndices: Index[] = json?.indices || [];

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
            setIndices(rawIndices);
            setMarketStats(json.stats);

            if (indexFilter) {
                const currentIdx = rawIndices.find(i => i.name === indexFilter) ||
                    rawIndices.find(i => i.name.toUpperCase().includes(indexFilter.toUpperCase()));
                if (currentIdx) {
                    setSelectedIndex(currentIdx);
                }
            } else if (selectedIndex) {
                // If indexFilter is null but we had a selectedIndex, clear it to stay in "Total Market"
                setSelectedIndex(null);
            }

            const allSectorsArr = Array.from(new Set(data.map((s) => s.sector || 'Other'))).sort();
            setSectors(['All', ...allSectorsArr]);
        } catch (err) {
            console.error('Failed to load PSX stocks', err);
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

    useEffect(() => {
        if (!settings.refreshInterval || settings.refreshInterval <= 0) return;

        const interval = setInterval(() => {
            load(false);
        }, settings.refreshInterval * 1000);

        return () => clearInterval(interval);
    }, [settings.refreshInterval, indexFilter]); // Also sync when filter changes if needed, but interval is most important
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

        // 1. Index-based filtering (Heuristic for demo)
        if (indexFilter) {
            const idxName = indexFilter.toUpperCase();
            if (idxName.includes('ALLSHR')) {
                // All Shares: Reset to show everything (default behavior)
                updated = stocks;
            } else if (idxName.includes('100')) {
                // KSE100: Top 100 by Traded Value (Price * Volume)
                updated = [...updated].sort((a, b) => {
                    const valA = (a.currentPrice || 0) * (parseInt(a.volume.replace(/,/g, '')) || 0);
                    const valB = (b.currentPrice || 0) * (parseInt(b.volume.replace(/,/g, '')) || 0);
                    return valB - valA;
                }).slice(0, 100);
            } else if (idxName.includes('KMI')) {
                // KMI30/KMIALL: Shariah Compliant Scripts
                const shariahBlacklist = ['NPL', 'NCPL', 'KEL']; // Specifically exclude known non-shariah scripts
                const shariahSectors = [
                    'technology & communication', 'cement', 'oil & gas exploration companies',
                    'fertilizer', 'pharmaceuticals', 'chemical', 'power generation & distribution',
                    'engineering', 'food & personal care products', 'textile composite',
                    'oil & gas marketing companies', 'automobile assembler', 'refinery',
                    'glass & ceramics', 'paper & board', 'sugar & allied industries',
                    'leather & tanneries'
                ];

                // MEBL is a key component of KMI30 despite being in the banking sector
                updated = updated.filter(s => {
                    if (shariahBlacklist.includes(s.symbol.toUpperCase())) return false;
                    const sSector = (s.sector || '').toLowerCase();
                    return shariahSectors.some(target => sSector.includes(target)) || s.symbol === 'MEBL';
                });

                // For KMI30, sort by Traded Value and take top 30
                if (idxName.includes('30')) {
                    updated = [...updated].sort((a, b) => {
                        const valA = (a.currentPrice || 0) * (parseInt(a.volume.replace(/,/g, '')) || 0);
                        const valB = (b.currentPrice || 0) * (parseInt(b.volume.replace(/,/g, '')) || 0);
                        return valB - valA;
                    }).slice(0, 30);
                }
            } else if (idxName.includes('BKTI')) {
                // Banking Index
                updated = updated.filter(s => s.sector?.toLowerCase().includes('bank'));
            } else if (idxName.includes('OGTI')) {
                // Oil & Gas Index
                updated = updated.filter(s => s.sector?.toLowerCase().includes('oil & gas'));
            }
        }

        // 2. Sector Filter
        if (filter !== 'all') {
            updated = updated.filter((s) => (s.sector || 'Other').toLowerCase() === filter.toLowerCase());
        }

        // 2.5 Category Filter (Top Gainers / Most Active / Top Losers)
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
    }, [filter, stocks, searchTerm, sortConfig, indexFilter, activeWatchlistId, watchlists, categoryFilter]);

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

    // Header component for selected index
    const IndexSummaryBar = () => {
        if (!selectedIndex) return null;
        const isPos = selectedIndex.change >= 0;
        return (
            <div className="bg-blue-600 dark:bg-blue-900/40 border-b border-blue-500/30 p-2 animate-in slide-in-from-top duration-300 backdrop-blur-md sticky top-[118px] z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-[9px] font-black text-white/90 bg-white/20 px-2 py-1 rounded-md uppercase tracking-wider">Active Monitor</span>
                        <p className="text-sm font-black text-white">{selectedIndex.name}</p>
                        <p className="text-lg font-mono font-black text-white">{selectedIndex.value.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold ${isPos ? 'text-green-300' : 'text-red-300'}`}>
                            {isPos ? '▲' : '▼'}{Math.abs(selectedIndex.change).toFixed(2)} ({selectedIndex.changePercent.toFixed(2)}%)
                        </span>
                        <button onClick={() => { setSelectedIndex(null); setIndexFilter(null); }} className="text-white/60 hover:text-white transition-colors text-sm font-black bg-white/10 w-6 h-6 rounded-full flex items-center justify-center">×</button>
                    </div>
                </div>
            </div>
        );
    };

    // Detailed Stock Viewer Component Removed - Redirecting to Page instead

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white selection:bg-blue-500/30">
            {loading && (
                <div className="w-full py-4 bg-white dark:bg-zinc-900 text-center z-40">
                    <div className="inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400 mt-2">Loading market data...</p>
                </div>
            )}
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
                <div className="max-w-[1600px] mx-auto px-8 py-6">
                    <h1 className="text-3xl font-black tracking-tighter italic uppercase text-zinc-900 dark:text-white">
                        📈 Market <span className="text-blue-500">Explorer</span>
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                        PSX Real-Time Trading Terminal
                    </p>
                </div>
            </header>

            {/* Global Index Ticker - "Index data above" */}
            {indices.length > 0 && (
                <div className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 py-2.5 w-full overflow-hidden shadow-sm sticky top-[73px] z-30">
                    <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center gap-8 overflow-x-auto no-scrollbar scroll-smooth">
                        <div className="flex items-center gap-2 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 pr-6">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Market Watch</span>
                        </div>
                        {indices.map(idx => {
                            const isPos = idx.change >= 0;
                            const isSelected = selectedIndex?.name === idx.name;
                            return (
                                <button
                                    key={idx.name}
                                    onClick={() => {
                                        if (isSelected) { setSelectedIndex(null); setIndexFilter(null); }
                                        else { setSelectedIndex(idx); setIndexFilter(idx.name); }
                                    }}
                                    className={`flex items-center gap-3 flex-shrink-0 transition-all px-2 py-1 rounded-lg ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                                >
                                    <span className={`text-[10px] font-black transition-colors ${isSelected ? 'text-blue-600' : 'text-zinc-500 dark:text-zinc-400'}`}>{idx.name}</span>
                                    <span className="text-xs font-mono font-black text-zinc-900 dark:text-zinc-50">{idx.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    <span className={`text-[10px] font-bold ${isPos ? 'text-green-600' : 'text-red-600'}`}>
                                        {isPos ? '▲' : '▼'}{Math.abs(idx.changePercent).toFixed(1)}%
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )
            }

            {/* Market Pulse Summary (Inspired by PSX Website) */}
            {
                marketStats && (
                    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 w-full overflow-hidden">
                        <div className="max-w-7xl mx-auto px-4 sm:px-8">
                            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800">
                                {/* Exchange Status Section */}
                                <div className="flex-1 py-4 md:pr-8 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${marketStats.status.toLowerCase().includes('open') ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Exchange {marketStats.status}</p>
                                        </div>
                                        <div className="flex items-baseline gap-4">
                                            <div>
                                                <p className="text-[9px] font-bold text-zinc-400 uppercase">Volume</p>
                                                <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 font-mono tracking-tighter">{marketStats.volume}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-zinc-400 uppercase">Value (PKR)</p>
                                                <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 font-mono tracking-tighter">{marketStats.value}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-zinc-400 uppercase">Trades</p>
                                                <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 font-mono tracking-tighter">{marketStats.trades}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Market Breadth Section */}
                                <div className="flex-1 py-4 md:pl-8 flex items-center justify-between">
                                    <div className="space-y-1 w-full">
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Market Breadth (Symbol Statistics)</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-100/50 dark:border-green-800/30 p-2 rounded-xl text-center">
                                                <p className="text-[8px] font-black text-green-600/80 uppercase mb-0.5">Advanced</p>
                                                <p className="text-sm font-black text-green-600 leading-none">{marketStats.advanced}</p>
                                            </div>
                                            <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100/50 dark:border-red-800/30 p-2 rounded-xl text-center">
                                                <p className="text-[8px] font-black text-red-600/80 uppercase mb-0.5">Declined</p>
                                                <p className="text-sm font-black text-red-600 leading-none">{marketStats.declined}</p>
                                            </div>
                                            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 p-2 rounded-xl text-center">
                                                <p className="text-[8px] font-black text-blue-600/80 uppercase mb-0.5">Unchanged</p>
                                                <p className="text-sm font-black text-blue-600 leading-none">{marketStats.unchanged}</p>
                                            </div>
                                            <div className="bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/30 p-2 rounded-xl text-center">
                                                <p className="text-[8px] font-black text-zinc-500 uppercase mb-0.5">Total</p>
                                                <p className="text-sm font-black text-zinc-900 dark:text-zinc-50 leading-none">{marketStats.total}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Index Detail View - Above Grids */}
            {
                selectedIndex && (
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-900/40 dark:to-indigo-900/40 p-6 text-white border border-blue-500/20 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-black tracking-tight">{selectedIndex.name}</h2>
                                    <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md">Active Index</span>
                                </div>
                                <p className="text-blue-100 text-sm font-medium">Detailed performance metrics and component summary</p>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-center md:text-right">
                                    <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mb-1">Index Points</p>
                                    <p className="text-3xl font-black font-mono leading-none">{selectedIndex.value.toLocaleString()}</p>
                                </div>
                                <div className="text-center md:text-right">
                                    <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mb-1">Session Change</p>
                                    <p className={`text-2xl font-black font-mono leading-none flex items-center justify-end gap-1 ${selectedIndex.change >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                        {selectedIndex.change >= 0 ? '▲' : '▼'}{Math.abs(selectedIndex.change).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white/5 p-3 rounded-xl backdrop-blur-sm">
                                <p className="text-[10px] text-blue-200 font-bold uppercase mb-1">Percentage</p>
                                <p className="text-lg font-black">{selectedIndex.changePercent.toFixed(2)}%</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl backdrop-blur-sm">
                                <p className="text-[10px] text-blue-200 font-bold uppercase mb-1">High/Low Gap</p>
                                <p className="text-lg font-black">{Math.abs(selectedIndex.change * 1.2).toFixed(2)}</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl backdrop-blur-sm">
                                <p className="text-[10px] text-blue-200 font-bold uppercase mb-1">Status</p>
                                <p className="text-lg font-black uppercase">{selectedIndex.change >= 0 ? 'Bullish' : 'Bearish'}</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl backdrop-blur-sm flex items-center justify-center">
                                <button
                                    onClick={() => { setSelectedIndex(null); setIndexFilter(null); }}
                                    className="text-xs font-bold hover:underline"
                                >
                                    Close Details ×
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* <IndexSummaryBar /> */}

            <div className="px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
                {/* Market Control Center */}
                <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-blue-600 text-xs">🛠️</span>
                            <h3 className="text-[10px] font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-[0.2em]">Market Controls</h3>
                        </div>
                        <button
                            onClick={() => { setFilter('all'); setCategoryFilter('all'); setIndexFilter(null); setSelectedIndex(null); setSearchTerm(""); }}
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
                                        value={indexFilter || ""}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setIndexFilter(val || null);
                                            const idxObj = indices.find(i => i.name === val);
                                            setSelectedIndex(idxObj || null);
                                        }}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-black text-zinc-900 dark:text-zinc-50 appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                    >
                                        <option value="">All Market (Exchange Wide)</option>
                                        {indices.map(idx => (
                                            <option key={idx.name} value={idx.name}>{idx.name}</option>
                                        ))}
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
                                    onClick={() => { setIndexFilter(null); setSelectedIndex(null); }}
                                    className={`p-3 rounded-2xl border transition-all text-left group ${!indexFilter ? 'bg-zinc-900 border-transparent shadow-lg shadow-zinc-500/10 text-white' : 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200'}`}
                                >
                                    <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${!indexFilter ? 'text-zinc-400' : 'text-zinc-400'}`}>Total Market</p>
                                    <p className="text-sm font-black uppercase tracking-tighter">All Scripts</p>
                                </button>
                                {indices.map(idx => {
                                    const isSelected = indexFilter === idx.name;
                                    const isPos = idx.change >= 0;
                                    return (
                                        <button
                                            key={idx.name}
                                            onClick={() => {
                                                setIndexFilter(idx.name);
                                                setSelectedIndex(idx);
                                            }}
                                            className={`p-3 rounded-2xl border transition-all text-left relative overflow-hidden ${isSelected ? 'bg-blue-600 border-transparent shadow-lg shadow-blue-500/20 text-white' : 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <p className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? 'text-blue-100' : 'text-zinc-400'}`}>{idx.name}</p>
                                                <span className={`text-[8px] font-bold ${isSelected ? 'text-white' : (isPos ? 'text-green-600' : 'text-red-600')}`}>
                                                    {isPos ? '▲' : '▼'}{Math.abs(idx.changePercent).toFixed(1)}%
                                                </span>
                                            </div>
                                            <p className="text-sm font-black font-mono tracking-tighter">
                                                {idx.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </p>
                                            {isSelected && <div className="absolute bottom-0 right-0 w-8 h-8 bg-white/10 rounded-tl-full flex items-center justify-center"><span className="text-[8px] translate-x-1 translate-y-1">✓</span></div>}
                                        </button>
                                    );
                                })}
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

                {/* Stock Explorer Cards - 5 columns */}
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
                                    onClick={() => router.push(`/stocks/${stock.symbol.toLowerCase()}`)}
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

                {/* Market Statistics */}
                {/* <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Listed</p>
                        <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">{stocks.length}</p>
                    </div>
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Bullish</p>
                        <p className="text-lg font-black text-green-600">{stocks.filter((s) => s.change > 0).length}</p>
                    </div>
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Bearish</p>
                        <p className="text-lg font-black text-red-600">{stocks.filter((s) => s.change < 0).length}</p>
                    </div>
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Unchanged</p>
                        <p className="text-lg font-black text-zinc-400">{stocks.filter((s) => s.change === 0).length}</p>
                    </div>
                </div> */}

                {/* Detailed Table with Pagination, Search, and Sorting */}
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
                                        <th onClick={() => requestSort('currentPrice')} className="p-4 font-black text-[10px] uppercase tracking-widest text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">Price <SortIcon column="currentPrice" /></th>
                                        <th onClick={() => requestSort('change')} className="p-4 font-black text-[10px] uppercase tracking-widest text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">Change <SortIcon column="change" /></th>
                                        <th onClick={() => requestSort('changePercent')} className="p-4 font-black text-[10px] uppercase tracking-widest text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">Change% <SortIcon column="changePercent" /></th>
                                        <th className="p-4 font-black text-[10px] uppercase tracking-widest text-right">Volume</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                                    {paginatedStocks.map((stock) => {
                                        const isPositive = stock.change >= 0;
                                        return (
                                            <tr
                                                key={stock.symbol}
                                                onClick={() => router.push(`/stocks/${stock.symbol.toLowerCase()}`)}
                                                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                                            >
                                                <td className="p-4 font-black text-zinc-900 dark:text-zinc-50 group-hover:text-blue-600 transition-colors">{stock.symbol}</td>
                                                <td className="p-4 text-zinc-500 dark:text-zinc-400 max-w-[240px] truncate font-medium">{stock.name}</td>
                                                <td className="p-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-50">
                                                    {stock.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                </td>
                                                <td className={`p-4 text-center font-black ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isPositive ? '+' : ''}{stock.change?.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black ${isPositive
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                        {isPositive ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right text-zinc-400 font-mono text-[10px] font-bold">{stock.volume}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm gap-4 mt-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="w-full sm:w-auto px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 transition-all bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700 hover:border-blue-200 dark:hover:border-blue-900 mt-2"
                            >
                                ← Previous Page
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="h-[2px] w-8 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
                                <span className="text-[11px] font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-widest">
                                    {currentPage} <span className="text-zinc-300 mx-1">/</span> {totalPages}
                                </span>
                                <div className="h-[2px] w-8 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="w-full sm:w-auto px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 transition-all bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-700 hover:border-blue-200 dark:hover:border-blue-900"
                            >
                                Next Page →
                            </button>
                        </div>
                    )}
                </div>

                {filteredStocks.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-dashed border-zinc-300 dark:border-zinc-800">
                        <div className="text-6xl mb-6">🏜️</div>
                        <p className="text-zinc-900 dark:text-zinc-50 font-black text-xl">No Scripts Found</p>
                        <p className="text-zinc-500 font-medium mt-1">Try adjusting your search term or sector filter</p>
                        <button
                            onClick={() => { setFilter('all'); setSearchTerm(""); }}
                            className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30"
                        >
                            Reset All Filters
                        </button>
                    </div>
                )}
            </div>

            {/* StockDetailModal removed - navigation to /stocks/[symbol] used instead */}
        </div >
    );
}
