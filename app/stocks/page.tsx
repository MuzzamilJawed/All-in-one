"use client";

import StockCard from "../components/StockCard";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { useSettings } from "../context/SettingsContext";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../components/TradingChart'), { ssr: false });
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
    const [indexFilter, setIndexFilter] = useState<string | null>(null);
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

    // View Strategy State
    const [viewType, setViewType] = useState<'card' | 'table'>('card');

    // Table Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const { settings } = useSettings();

    const load = async (isManual = true) => {
        try {
            if (isManual) setLoading(true);
            const res = await fetch('/api/psx-stocks');
            const json = await res.json();
            const rawData: Stock[] = json?.data || [];
            const rawIndices: Index[] = json?.indices || [];

            const stockData = rawData
                .filter(s => s && s.symbol)
                .map(s => ({
                    ...s,
                    history: [] 
                })).sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));

            setStocks(stockData);
            setIndices(rawIndices);
            setMarketStats(json.stats);

            if (!selectedIndex && rawIndices.length > 0) {
                setSelectedIndex(rawIndices[0]);
                setIndexFilter(rawIndices[0].name);
            }

            const allSectorsArr = Array.from(new Set(stockData.map((s) => s.sector || 'Other'))).sort();
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
        if (activeWatchlistId) {
            const activeWL = watchlists.find(wl => wl._id === activeWatchlistId);
            if (activeWL && activeWL.symbols) {
                updated = updated.filter(s => activeWL.symbols.includes(s.symbol.toUpperCase()));
            } else if (activeWL && activeWL.symbols.length === 0) {
                updated = [];
            }
        }
        if (indexFilter) {
            const idxName = indexFilter.toUpperCase();
            if (idxName.includes('100')) {
                updated = [...updated].sort((a, b) => {
                    const valA = (a.currentPrice || 0) * (parseInt(a.volume.replace(/,/g, '')) || 0);
                    const valB = (b.currentPrice || 0) * (parseInt(b.volume.replace(/,/g, '')) || 0);
                    return valB - valA;
                }).slice(0, 100);
            } else if (idxName.includes('KMI')) {
                const shariahSectors = ['technology', 'cement', 'oil & gas', 'fertilizer', 'pharmaceuticals', 'chemical', 'power', 'engineering', 'food', 'textile', 'automobile', 'refinery'];
                updated = updated.filter(s => shariahSectors.some(target => (s.sector || '').toLowerCase().includes(target)) || s.symbol === 'MEBL');
                if (idxName.includes('30')) {
                    updated = [...updated].sort((a, b) => {
                        const valA = (a.currentPrice || 0) * (parseInt(a.volume.replace(/,/g, '')) || 0);
                        const valB = (b.currentPrice || 0) * (parseInt(b.volume.replace(/,/g, '')) || 0);
                        return valB - valA;
                    }).slice(0, 30);
                }
            }
        }
        if (filter !== 'all') {
            updated = updated.filter((s) => (s.sector || 'Other').toLowerCase() === filter.toLowerCase());
        }
        if (categoryFilter && categoryFilter !== 'all') {
            if (categoryFilter === 'gainers') updated = [...updated].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0)).slice(0, 50);
            else if (categoryFilter === 'losers') updated = [...updated].sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0)).slice(0, 50);
            else if (categoryFilter === 'active') updated = [...updated].sort((a, b) => (parseInt(b.volume.replace(/,/g, '')) || 0) - (parseInt(a.volume.replace(/,/g, '')) || 0)).slice(0, 50);
        }
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            updated = updated.filter((s) => s.symbol.toLowerCase().includes(lowSearch) || s.name.toLowerCase().includes(lowSearch));
        }
        if (sortConfig) {
            updated = [...updated].sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];
                if (aVal === undefined || bVal === undefined) return 0;
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        setFilteredStocks(updated);
        setCurrentPage(1);
    }, [filter, stocks, searchTerm, sortConfig, indexFilter, activeWatchlistId, watchlists, categoryFilter]);

    const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedStocks = filteredStocks.slice(startIndex, startIndex + itemsPerPage);

    const getVisiblePages = () => {
        const delta = 2;
        const left = currentPage - delta;
        const right = currentPage + delta + 1;
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= left && i < right)) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) rangeWithDots.push(l + 1);
                else if (i - l !== 1) rangeWithDots.push('...');
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

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
            {loading && (
                <div className="fixed top-0 left-0 w-full h-1 z-[100] bg-blue-600/10">
                    <div className="h-full bg-blue-600 animate-[loading_2s_infinite]"></div>
                </div>
            )}

            <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
                <div className="max-w-[1600px] mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter italic uppercase text-zinc-900 dark:text-white">
                            📈 Market <span className="text-blue-500">Explorer</span>
                        </h1>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">PSX Real-Time Trading Terminal</p>
                    </div>
                    <button
                        onClick={() => router.push('/stocks/terminal')}
                        className="group relative px-6 py-3 bg-blue-600 text-white rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-500/20"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                        <div className="flex items-center gap-3 relative z-10">
                            <span className="text-lg">📊</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Advanced Terminal</span>
                        </div>
                    </button>
                </div>
            </header>

            {indices.length > 0 && (
                <div className="bg-white dark:bg-[#050505] border-b border-zinc-200 dark:border-white/5 py-3 w-full overflow-hidden shadow-sm sticky top-[73px] z-30">
                    <div className="max-w-[1600px] mx-auto px-8 flex items-center gap-10">
                        <div className="flex items-center gap-3 flex-shrink-0 border-r border-zinc-200 dark:border-white/10 pr-10">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                            <span className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] italic">Market Pulse Watch</span>
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
            )}

            {marketStats && (
                <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 w-full overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-8">
                        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800">
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
            )}

            {selectedIndex && (
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
                </div>
            )}

            <div className="px-4 sm:px-8 py-10 max-w-[1700px] mx-auto w-full space-y-10">
                {/* Unified Market Control Ribbon */}
                <div className="bg-white dark:bg-zinc-900/50 backdrop-blur-3xl rounded-[2.5rem] border border-zinc-200 dark:border-white/5 p-8 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
                        <div className="flex-1 space-y-6 w-full">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white">Market Intelligent Explorer</h2>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                                        Monitoring {filteredStocks.length} Real-Time Assets
                                    </p>
                                </div>
                                <div className="flex h-fit bg-zinc-100 dark:bg-white/5 p-1 rounded-2xl border border-zinc-200 dark:border-white/10">
                                    <button
                                        onClick={() => setViewType('card')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${viewType === 'card' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`}
                                    >
                                        <span>🎴</span> Card
                                    </button>
                                    <button
                                        onClick={() => setViewType('table')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${viewType === 'table' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`}
                                    >
                                        <span>📋</span> Table
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Search Symbol..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl pl-12 pr-4 py-4 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-zinc-500"
                                    />
                                </div>

                                <div className="relative group">
                                    <select
                                        value={indexFilter || ""}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setIndexFilter(val || null);
                                            const idxObj = indices.find(i => i.name === val);
                                            setSelectedIndex(idxObj || null);
                                        }}
                                        className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest appearance-none outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
                                    >
                                        <option value="">Index: All Market</option>
                                        {indices.map(idx => (
                                            <option key={idx.name} value={idx.name}>{idx.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">▼</div>
                                </div>

                                <div className="relative group">
                                    <select
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest appearance-none outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
                                    >
                                        <option value="all">Sectors: Global</option>
                                        {sectors.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">▼</div>
                                </div>

                                <div className="relative group">
                                    <select
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest appearance-none outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
                                    >
                                        <option value="all">Market View: General</option>
                                        <option value="gainers">Top Performers</option>
                                        <option value="active">High Liquidity</option>
                                        <option value="losers">Market Decliners</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">▼</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-zinc-100 dark:border-white/5">
                        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 w-full lg:w-auto">
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] whitespace-nowrap">Watchlist Monitor:</span>
                            <button
                                onClick={() => setActiveWatchlistId(null)}
                                className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${!activeWatchlistId ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Total Market
                            </button>
                            {watchlists.map(wl => (
                                <button
                                    key={wl._id}
                                    onClick={() => setActiveWatchlistId(wl._id)}
                                    className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeWatchlistId === wl._id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    <span>📂</span> {wl.name}
                                </button>
                            ))}
                            <button
                                onClick={() => setIsCreatingWatchlist(!isCreatingWatchlist)}
                                className="px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-dashed border-zinc-300 dark:border-white/10 text-zinc-400 hover:border-blue-500 hover:text-blue-500 transition-all shrink-0"
                            >
                                + Create New
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-4 shrink-0">
                            <button
                                onClick={() => { setFilter('all'); setCategoryFilter('all'); setIndexFilter(null); setSelectedIndex(null); setSearchTerm(""); }}
                                className="text-[9px] font-black text-blue-600 hover:text-red-500 uppercase tracking-widest transition-colors"
                            >
                                ↺ Reset Pipeline
                            </button>
                        </div>
                    </div>

                    {isCreatingWatchlist && (
                        <div className="flex gap-2 p-3 bg-blue-600 text-white rounded-2xl animate-in zoom-in-95 duration-200">
                            <input
                                type="text"
                                placeholder="Snapshot Name..."
                                value={newWatchlistName}
                                onChange={(e) => setNewWatchlistName(e.target.value)}
                                className="flex-1 bg-white/20 border-none rounded-xl px-4 py-2 text-xs font-black placeholder:text-white/50 focus:ring-0 outline-none"
                                onKeyPress={(e) => e.key === 'Enter' && handleCreateWatchlist()}
                            />
                            <button onClick={handleCreateWatchlist} className="bg-white text-blue-600 px-6 py-2 rounded-xl text-xs font-black hover:bg-zinc-100 transition-all uppercase">Save</button>
                            <button onClick={() => setIsCreatingWatchlist(false)} className="px-4 py-2 text-white/80 hover:text-white">✕</button>
                        </div>
                    )}
                </div>

                {/* Explorer Results Area */}
                <div className="space-y-12 min-h-[800px]">
                    {viewType === 'card' ? (
                        <div className="space-y-12 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 px-1">
                                {paginatedStocks.map((stock) => (
                                    <StockCard
                                        key={stock.symbol}
                                        {...stock}
                                        onClick={() => router.push(`/stocks/${stock.symbol.toLowerCase()}`)}
                                        watchlists={watchlists}
                                        activeWatchlistId={activeWatchlistId}
                                        onAddToWatchlist={handleAddToWatchlist}
                                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                                        onWatchlistCreated={(newList) => setWatchlists([newList, ...watchlists])}
                                    />
                                ))}
                                {filteredStocks.length === 0 && (
                                    <div className="col-span-full py-48 text-center bg-zinc-50 dark:bg-white/5 rounded-[3rem] border border-dashed border-zinc-200 dark:border-white/10">
                                        <span className="text-4xl block mb-4">🔍</span>
                                        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">No matching scripts found</p>
                                    </div>
                                )}
                            </div>

                            {/* Card Pagination */}
                            {filteredStocks.length > itemsPerPage && (
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-8 border-t border-zinc-200 dark:border-white/5">
                                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                        Displaying {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredStocks.length)} of {filteredStocks.length} Assets
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            disabled={currentPage === 1}
                                            onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 900, behavior: 'smooth' }); }}
                                            className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-20 hover:border-blue-500 transition-all shadow-sm"
                                        >
                                            <span className="text-xs">◀</span>
                                        </button>
                                        <div className="flex items-center gap-2">
                                            {getVisiblePages().map((pageNum, i) => (
                                                <button
                                                    key={i}
                                                    disabled={pageNum === '...'}
                                                    onClick={() => { if (typeof pageNum === 'number') { setCurrentPage(pageNum); window.scrollTo({ top: 900, behavior: 'smooth' }); } }}
                                                    className={`w-12 h-12 rounded-xl text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : pageNum === '...' ? 'text-zinc-400 cursor-default' : 'bg-white dark:bg-zinc-900 text-zinc-500 hover:border-blue-500 border border-zinc-200 dark:border-zinc-800'}`}
                                                >
                                                    {pageNum}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            disabled={currentPage === totalPages}
                                            onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 900, behavior: 'smooth' }); }}
                                            className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-20 hover:border-blue-500 transition-all shadow-sm"
                                        >
                                            <span className="text-xs">▶</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-[#050505] rounded-[2.5rem] border border-zinc-200 dark:border-white/5 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-50 dark:bg-white/5 text-zinc-500">
                                            <th onClick={() => requestSort('symbol')} className="p-6 font-black uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors">Symbol <SortIcon column="symbol" /></th>
                                            <th onClick={() => requestSort('name')} className="p-6 font-black uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors">Company <SortIcon column="name" /></th>
                                            <th onClick={() => requestSort('currentPrice')} className="p-6 font-black uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors text-right">Price <SortIcon column="currentPrice" /></th>
                                            <th onClick={() => requestSort('changePercent')} className="p-6 font-black uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors text-right">Change <SortIcon column="changePercent" /></th>
                                            <th onClick={() => requestSort('volume')} className="p-6 font-black uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors text-right">Volume <SortIcon column="volume" /></th>
                                            <th className="p-6 font-black uppercase tracking-widest text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                                        {paginatedStocks.map((stock) => (
                                            <tr key={stock.symbol} className="hover:bg-blue-500/5 transition-all group">
                                                <td className="p-6"><span className="px-3 py-1.5 bg-zinc-100 dark:bg-white/10 rounded-lg font-black group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">{stock.symbol}</span></td>
                                                <td className="p-6 font-black truncate max-w-[250px] dark:text-zinc-300 group-hover:text-blue-600 transition-colors">{stock.name}</td>
                                                <td className="p-6 font-mono font-black text-right text-sm">{stock.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className={`p-6 font-black text-right text-sm ${stock.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {stock.changePercent >= 0 ? '▲' : '▼'}{Math.abs(stock.changePercent).toFixed(2)}%
                                                </td>
                                                <td className="p-6 font-mono text-zinc-500 dark:text-zinc-500 text-right group-hover:text-zinc-300">{stock.volume}</td>
                                                <td className="p-6 text-right">
                                                    <button onClick={() => router.push(`/stocks/${stock.symbol.toLowerCase()}`)} className="text-[10px] font-black uppercase bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-600/20">Analyze</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Table Pagination */}
                            <div className="px-8 py-6 bg-zinc-50 dark:bg-[#080808] border-t border-zinc-200 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                    Displaying {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredStocks.length)} of {filteredStocks.length} Assets
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 900, behavior: 'smooth' }); }}
                                        className="p-2 rounded-xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/5 disabled:opacity-30 hover:border-blue-500 transition-all font-bold"
                                    >
                                        <span className="text-xs">◀</span>
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {getVisiblePages().map((pageNum, i) => (
                                            <button
                                                key={i}
                                                disabled={pageNum === '...'}
                                                onClick={() => { if (typeof pageNum === 'number') { setCurrentPage(pageNum); window.scrollTo({ top: 900, behavior: 'smooth' }); } }}
                                                className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : pageNum === '...' ? 'text-zinc-400 cursor-default' : 'bg-white dark:bg-white/5 text-zinc-500 hover:border-blue-500 border border-zinc-200 dark:border-white/5'}`}
                                            >
                                                {pageNum}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); window.scrollTo({ top: 900, behavior: 'smooth' }); }}
                                        className="p-2 rounded-xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/5 disabled:opacity-30 hover:border-blue-500 transition-all font-bold"
                                    >
                                        <span className="text-xs">▶</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
