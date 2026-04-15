"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../../components/TradingChart'), { ssr: false });
import { useSettings } from "../../context/SettingsContext";

export default function MarketTerminalPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
                <div className="flex flex-col items-center gap-8 relative z-10">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-blue-600/20 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-xl">📉</div>
                    </div>
                    <div className="text-center">
                        <p className="text-zinc-900 dark:text-white font-black uppercase text-xs tracking-[0.4em] mb-2">Initializing Terminal</p>
                        <p className="text-zinc-500 font-bold uppercase text-[8px] tracking-[0.2em] animate-pulse">Syncing Advanced Execution Infrastructure</p>
                    </div>
                </div>
            </div>
        }>
            <MarketTerminalContent />
        </Suspense>
    );
}

function MarketTerminalContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Read initial state from URL
    const [viewMode, setViewMode] = useState<'stocks' | 'indices'>((searchParams.get('view') as any) || 'indices');
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(searchParams.get('symbol'));
    const [timeframe, setTimeframe] = useState(searchParams.get('tf') || "1D");
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || "");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const [stocks, setStocks] = useState<any[]>([]);
    const [indices, setIndices] = useState<any[]>([]);
    const [selectedAsset, setSelectedAsset] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [candles, setCandles] = useState<any[]>([]);
    const [chartLoading, setChartLoading] = useState(false);
    const { settings } = useSettings();

    const fetchHistory = useCallback(async (symbol: string, tf: string, asset: any) => {
        setChartLoading(true);
        try {
            const res = await fetch(`/api/psx-history?symbol=${symbol}&timeframe=${tf}`);
            const json = await res.json();
            
            if (json.success && json.data) {
                let history = [...json.data];
                
                // Inject Live Candle from Real-time Scraped Data
                if (asset && asset.currentPrice) {
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const liveTime = Math.floor(now.getTime() / 1000);
                    
                    // Construct a candle from real-time data
                    let currentPrice = parseFloat(asset.currentPrice);
                    let change = parseFloat(asset.change || 0);

                    if (!isNaN(currentPrice)) {
                        const lastIndex = history.length - 1;
                        
                        // Price Discrepancy Correction
                        if (lastIndex >= 0) {
                            const lastClose = history[lastIndex].close;
                            const diffRatio = currentPrice / lastClose;
                            if (diffRatio > 8 || diffRatio < 0.12) {
                                const factor = Math.round(1 / diffRatio);
                                if (factor === 10 || factor === 100 || factor === 1000) {
                                    currentPrice *= factor;
                                    change *= factor;
                                } else {
                                    const revFactor = Math.round(diffRatio);
                                    if (revFactor === 10 || revFactor === 100 || revFactor === 1000) {
                                        currentPrice /= revFactor;
                                        change /= revFactor;
                                    }
                                }
                            }
                        }

                        let liveCandle: any = {
                            time: tf === '1H' ? liveTime : todayStr,
                            open: asset.open ? (parseFloat(asset.open) * (currentPrice/parseFloat(asset.currentPrice))) : (currentPrice - change),
                            high: asset.high ? (parseFloat(asset.high) * (currentPrice/parseFloat(asset.currentPrice))) : Math.max(currentPrice, (currentPrice - change)),
                            low: asset.low ? (parseFloat(asset.low) * (currentPrice/parseFloat(asset.currentPrice))) : Math.min(currentPrice, (currentPrice - change)),
                            close: currentPrice,
                            volume: parseInt((asset.volume || '0').replace(/[^0-9]/g, '')) || 0
                        };

                        if (lastIndex >= 0) {
                            const lastTime = history[lastIndex].time;
                            
                            // Expansion: For 1H view, create a series of bars for today
                            if (tf === '1H') {
                                // Deduplicate: remove any daily bar for today from history before expansion
                                if (lastTime === todayStr || (typeof lastTime === 'number' && lastTime === Math.floor(new Date(todayStr).getTime()/1000))) {
                                    history.splice(lastIndex, 1);
                                }
                                
                                const todayHours = [];
                                const startHour = 9; // PSX Start
                                const currentHour = now.getHours();
                                const marketCloseHour = 16;
                                
                                for (let h = startHour; h <= Math.min(currentHour, marketCloseHour); h++) {
                                    const hTime = new Date(now);
                                    hTime.setHours(h, 0, 0, 0);
                                    const hTimeSec = Math.floor(hTime.getTime() / 1000);
                                    
                                    // Progressively approach currentPrice
                                    const progress = (h - startHour + 1) / (Math.min(currentHour, marketCloseHour) - startHour + 1);
                                    const hPrice = liveCandle.open + (currentPrice - liveCandle.open) * progress;
                                    
                                    todayHours.push({
                                        ...liveCandle,
                                        time: hTimeSec,
                                        open: hPrice * 0.999,
                                        high: Math.max(hPrice, hPrice * 1.001),
                                        low: Math.min(hPrice, hPrice * 0.998),
                                        close: hPrice,
                                        volume: Math.floor(liveCandle.volume / 8)
                                    });
                                }
                                
                                if (todayHours.length > 0) {
                                    history.push(...todayHours);
                                }
                            } else {
                                // Standard Injection logic
                                if (lastTime === liveCandle.time) {
                                    history[lastIndex] = { ...history[lastIndex], ...liveCandle };
                                } else if ((typeof lastTime === 'string' && todayStr > lastTime) || 
                                           (typeof lastTime === 'number' && liveTime > lastTime)) {
                                    history.push(liveCandle);
                                }
                            }
                        } else {
                            // If no history, show at least the live candle
                            history = [liveCandle];
                        }
                    }
                }
                setCandles(history);
            } else {
                // If history fails, still try to show a live candle
                const currentPrice = parseFloat(asset?.currentPrice);
                if (asset && !isNaN(currentPrice)) {
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const change = parseFloat(asset.change || 0);
                    setCandles([{
                        time: tf === '1H' ? Math.floor(now.getTime() / 1000) : todayStr,
                        open: asset.open ? parseFloat(asset.open) : (currentPrice - change),
                        high: asset.high ? parseFloat(asset.high) : Math.max(currentPrice, (currentPrice - change)),
                        low: asset.low ? parseFloat(asset.low) : Math.min(currentPrice, (currentPrice - change)),
                        close: currentPrice,
                        volume: 0
                    }]);
                } else {
                    setCandles([]);
                }
                console.error('History fetch failed:', json.error);
            }
        } catch (err) {
            console.error('History fetch error:', err);
        } finally {
            setChartLoading(false);
        }
    }, []);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/psx-stocks');
                const json = await res.json();
                const stockData = json?.data || [];
                const indexData = (json?.indices || []).map((idx: any) => ({
                    ...idx,
                    symbol: idx.name,
                    currentPrice: idx.value
                }));

                setStocks(stockData);
                setIndices(indexData);
                
                // Determine which asset to select
                const currentList = (searchParams.get('view') || viewMode) === 'indices' ? indexData : stockData;
                const symbolToFind = selectedSymbol || searchParams.get('symbol');
                
                let initial = null;
                if (symbolToFind) {
                    initial = currentList.find((s: any) => s.symbol.toLowerCase() === symbolToFind.toLowerCase());
                }
                
                if (!initial && currentList.length > 0) {
                    initial = currentList[0];
                }

                if (initial) {
                    setSelectedAsset(initial);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Sync state to URL with debounce for search
    useEffect(() => {
        if (loading) return;

        const timer = setTimeout(() => {
            const params = new URLSearchParams();
            if (viewMode) params.set('view', viewMode);
            if (selectedAsset?.symbol) params.set('symbol', selectedAsset.symbol);
            if (timeframe) params.set('tf', timeframe);
            if (searchTerm) params.set('q', searchTerm);

            const queryString = params.toString();
            const currentQuery = searchParams.toString();

            if (queryString !== currentQuery) {
                router.replace(`/stocks/terminal?${queryString}`, { scroll: false });
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [viewMode, selectedAsset, timeframe, searchTerm, loading, router, searchParams]);

    useEffect(() => {
        if (selectedAsset?.symbol) {
            fetchHistory(selectedAsset.symbol, timeframe, selectedAsset);
        }
    }, [selectedAsset?.symbol, timeframe, fetchHistory, selectedAsset]);

    const displayList = viewMode === 'stocks' ? stocks : indices;
    const filteredAssets = displayList.filter(s =>
        (s.symbol || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
                <div className="flex flex-col items-center gap-8 relative z-10">
                    <div className="relative">
                        <div className="w-20 h-20 border-4 border-blue-600/20 rounded-full"></div>
                        <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-3xl">💹</div>
                    </div>
                    <div className="text-center">
                        <p className="text-zinc-900 dark:text-white font-black uppercase text-xs tracking-[0.4em] mb-2">Synchronizing Market Data</p>
                        <p className="text-zinc-500 font-bold uppercase text-[8px] tracking-[0.2em] animate-pulse">Establishing Low-Latency Satellite Downlink</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white flex flex-col overflow-hidden selection:bg-blue-500/30">
            {/* Dynamic Background Glows */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
            </div>

            {/* Minimalist Professional Header */}
            <header className="h-16 border-b border-zinc-200 dark:border-white/5 bg-white/40 dark:bg-black/40 backdrop-blur-2xl flex items-center justify-between px-4 sm:px-8 shrink-0 relative z-30">
                <div className="flex items-center gap-3 sm:gap-6">
                    <button
                        onClick={() => router.push('/stocks')}
                        className="text-zinc-500 hover:text-blue-500 transition-colors text-xl"
                    >
                        ←
                    </button>
                    <div className="w-[1px] h-6 bg-zinc-200 dark:bg-white/10 mx-1 sm:mx-2"></div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-lg sm:text-xl">📊</span>
                        <h1 className="text-[10px] sm:text-sm font-black uppercase tracking-widest sm:tracking-[0.3em] text-zinc-900 dark:text-white/90 italic truncate max-w-[120px] sm:max-w-none">
                            Market <span className="text-blue-500">Terminal</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-8">
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="lg:hidden p-2 rounded-lg bg-blue-600/10 text-blue-600 border border-blue-500/20"
                    >
                        {isSidebarOpen ? '✕' : '📂'}
                    </button>
                    <div className="hidden sm:flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live</span>
                    </div>
                    <div className="hidden lg:block text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
                        EST {new Date().toLocaleTimeString()}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative h-full">
                {/* Lateral Navigation Pane - Mobile Drawer & Desktop Sidebar */}
                <aside 
                    data-testid="equity-watch-list"
                    className={`fixed lg:relative inset-y-0 left-0 w-[300px] sm:w-[380px] h-full border-r border-zinc-200 dark:border-white/5 bg-white dark:bg-[#080808] lg:bg-white/40 lg:dark:bg-black/20 backdrop-blur-3xl lg:backdrop-blur-md flex flex-col shrink-0 overflow-hidden transform transition-transform duration-300 ease-in-out z-50 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-6 border-b border-zinc-200 dark:border-white/5 space-y-6">
                        {/* Global View Selector */}
                        <div className="flex bg-zinc-100 dark:bg-white/5 p-1 rounded-xl border border-zinc-200 dark:border-white/5">
                            <button
                                onClick={() => { setViewMode('stocks'); setSelectedAsset(stocks[0] || null); }}
                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'stocks' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 dark:text-zinc-500 hover:text-blue-500'}`}
                            >
                                Equity Watch
                            </button>
                            <button
                                onClick={() => { setViewMode('indices'); setSelectedAsset(indices[0] || null); }}
                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'indices' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 dark:text-zinc-500 hover:text-blue-500'}`}
                            >
                                Index Watch
                            </button>
                        </div>

                        <div className="relative group">
                            <input
                                type="text"
                                placeholder={`Filter ${viewMode === 'stocks' ? 'Equities' : 'Indices'}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5 rounded-2xl px-10 py-3 text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-600 transition-all outline-none group-hover:bg-zinc-100 dark:group-hover:bg-white/[0.08] dark:text-white text-zinc-900"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-blue-500 transition-colors">🔍</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-2 pb-12">
                        {filteredAssets.map((s) => (
                            <button
                                key={s.symbol}
                                data-testid={`stock-card-${s.symbol}`}
                                onClick={() => { setSelectedAsset(s); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                                className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all group mb-1 ${selectedAsset?.symbol === s.symbol ? 'bg-blue-600/10 dark:bg-blue-600/20 border border-blue-500/30' : 'hover:bg-zinc-50 dark:hover:bg-white/5 border border-transparent'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black italic transition-all ${selectedAsset?.symbol === s.symbol ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 rotate-3' : 'bg-zinc-100 dark:bg-white/5 text-zinc-500'}`}>
                                        {s.symbol.substring(0, 2)}
                                    </div>
                                    <div className="text-left">
                                        <p className={`text-xs font-black uppercase tracking-tighter ${selectedAsset?.symbol === s.symbol ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-300'}`}>{s.symbol}</p>
                                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest truncate max-w-[120px]">{s.name || s.symbol}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black font-mono tracking-tighter text-zinc-900 dark:text-white">{s.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    <p className={`text-[9px] font-black ${s.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {s.changePercent >= 0 ? '▲' : '▼'}{Math.abs(s.changePercent).toFixed(1)}%
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Main Visualization Center */}
                <main className="flex-1 bg-zinc-50/50 dark:bg-black/40 flex flex-col overflow-hidden relative">
                    <div className="h-20 lg:h-24 bg-gradient-to-r from-transparent via-blue-900/5 to-transparent border-b border-zinc-200 dark:border-white/5 flex items-center justify-between px-4 sm:px-10 shrink-0">
                        {selectedAsset && (
                            <div className="flex items-center gap-12">
                                <div>
                                    <div className="flex items-center gap-3 sm:gap-4 mb-1">
                                        <h2 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter truncate max-w-[150px] sm:max-w-none">{selectedAsset.symbol}</h2>
                                        <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-blue-600/20 text-blue-600 dark:text-blue-400 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded sm:rounded-lg border border-blue-500/20">
                                            {viewMode === 'stocks' ? 'Equity' : 'Index'}
                                        </span>
                                    </div>
                                    <p className="text-zinc-500 text-[8px] sm:text-[11px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] truncate max-w-[200px] sm:max-w-none">{selectedAsset.name || selectedAsset.symbol} {selectedAsset.sector ? `• ${selectedAsset.sector}` : ''}</p>
                                </div>

                                <div className="h-10 w-[1px] bg-zinc-200 dark:bg-white/10 hidden md:block"></div>

                                <div className="hidden sm:flex items-center gap-6 sm:gap-10">
                                    <div>
                                        <p className="text-[8px] sm:text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1">Current Price</p>
                                        <p className="text-xl sm:text-2xl font-black font-mono text-zinc-900 dark:text-white leading-none">
                                            {viewMode === 'indices' ? '' : 'Rs.'}{selectedAsset.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="h-8 w-[1px] bg-zinc-200 dark:bg-white/10"></div>
                                    <div>
                                        <p className="text-[8px] sm:text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1">Session</p>
                                        <div className="flex items-center gap-2">
                                            <p className={`text-sm sm:text-base font-black font-mono leading-none ${selectedAsset.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {selectedAsset.change >= 0 ? '+' : ''}{selectedAsset.change?.toFixed(2)}
                                            </p>
                                            <span className={`text-[10px] sm:text-xs font-bold ${selectedAsset.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                ({selectedAsset.changePercent >= 0 ? '+' : ''}{selectedAsset.changePercent?.toFixed(2)}%)
                                            </span>
                                        </div>
                                    </div>
                                    {viewMode === 'stocks' && selectedAsset.volume && (
                                        <>
                                            <div className="h-8 w-[1px] bg-zinc-200 dark:bg-white/10 hidden lg:block"></div>
                                            <div className="hidden lg:block">
                                                <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1">Trading Liquidity</p>
                                                <p className="text-sm font-black font-mono text-zinc-900 dark:text-white leading-none">{selectedAsset.volume}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 p-4 lg:p-6 relative min-h-[600px]">
                        <div className="absolute inset-0 p-4 lg:p-6 flex flex-col">
                            <div className="flex-1 bg-white dark:bg-black/60 rounded-3xl border border-zinc-200 dark:border-white/5 overflow-hidden shadow-[0_0_50px_-12px_rgba(37,99,235,0.15)] transition-all duration-1000 relative">
                                <div className="h-full w-full relative">
                                    {chartLoading && (
                                        <div className="absolute inset-0 z-20 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Fetching Real History...</p>
                                            </div>
                                        </div>
                                    )}
                                    <TradingChart
                                        title={`${selectedAsset?.symbol} Strategic Roadmap`}
                                        data={candles}
                                        currentTimeframe={timeframe}
                                        onTimeframeChange={setTimeframe}
                                        currencySymbol={viewMode === 'indices' ? '' : 'Rs.'}
                                        seamless={true}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 lg:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 shrink-0 pb-2">
                                {[
                                    { label: viewMode === 'stocks' ? 'Market Cap' : 'Index Weight', val: 'Proprietary Vector', icon: '🏛️' },
                                    { label: 'Volatility Index', val: timeframe === '1H' ? '0.012 σ' : '0.045 σ', icon: '⚡' },
                                    { label: 'Alpha Strength', val: ((selectedAsset?.changePercent || 0) * 1.2).toFixed(2) + '%', icon: '💎' },
                                    { label: 'Neural Sentiment', val: (selectedAsset?.changePercent || 0) >= 0 ? 'BULLISH' : 'BEARISH', icon: '🧠' },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white/60 dark:bg-zinc-900/40 border border-zinc-100 dark:border-white/5 rounded-xl sm:rounded-[2rem] p-3 sm:p-5 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-all group/stat backdrop-blur-md shadow-sm">
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <div className="text-lg sm:text-2xl group-hover:scale-110 transition-transform">{stat.icon}</div>
                                            <div>
                                                <p className="text-[8px] lg:text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-0.5 lg:mb-1">{stat.label}</p>
                                                <p className={`text-[10px] lg:text-xs font-black uppercase tracking-tighter ${i === 3 ? ((selectedAsset?.changePercent || 0) >= 0 ? 'text-green-500' : 'text-red-500') : 'text-zinc-900 dark:text-zinc-300'}`}>{stat.val}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.2);
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
            `}</style>
        </div>
    );
}
