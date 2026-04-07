"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../../components/TradingChart'), { ssr: false });
import { useSettings } from "../../context/SettingsContext";

export default function MarketTerminalPage() {
    const [stocks, setStocks] = useState<any[]>([]);
    const [indices, setIndices] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'stocks' | 'indices'>('stocks');
    const [selectedAsset, setSelectedAsset] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [candles, setCandles] = useState<any[]>([]);
    const [timeframe, setTimeframe] = useState("1H");
    const [searchTerm, setSearchTerm] = useState("");
    const router = useRouter();
    const { settings } = useSettings();

    const generateCandles = useCallback((price: number, tf: string) => {
        const count = 120;
        const nowSec = Math.floor(Date.now() / 1000);
        const interval = tf === "1H" ? 3600 : tf === "1D" ? 86400 : 604800;
        const volatility = tf === "1W" ? 0.05 : tf === "1D" ? 0.025 : 0.01;
        
        let lastClose = price;
        const data = [];

        for (let i = 0; i < count; i++) {
            const time = nowSec - i * interval;
            const change = (Math.random() - 0.5) * volatility;
            
            const close = lastClose;
            const open = close / (1 + change);
            const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.3));
            const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.3));

            data.unshift({
                time,
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(close.toFixed(2)),
                volume: Math.floor(Math.random() * 500000) + 50000
            });
            lastClose = open;
        }
        return data;
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
                
                if (!selectedAsset) {
                    const initial = indexData.length > 0 ? indexData[0] : stockData[0];
                    if (initial) {
                        setSelectedAsset(initial);
                        setViewMode(indexData.length > 0 ? 'indices' : 'stocks');
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    useEffect(() => {
        if (selectedAsset) {
            setCandles(generateCandles(selectedAsset.currentPrice, timeframe));
        }
    }, [selectedAsset, timeframe, generateCandles]);

    const displayList = viewMode === 'stocks' ? stocks : indices;
    const filteredAssets = displayList.filter(s => 
        (s.symbol || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] flex items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.4em] animate-pulse">Synchronizing Market Data...</p>
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
            <header className="h-16 border-b border-zinc-200 dark:border-white/5 bg-white/40 dark:bg-black/40 backdrop-blur-2xl flex items-center justify-between px-8 shrink-0 relative z-30">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => router.push('/stocks')}
                        className="text-zinc-500 hover:text-blue-500 transition-colors text-xl"
                    >
                        ←
                    </button>
                    <div className="w-[1px] h-6 bg-zinc-200 dark:bg-white/10 mx-2"></div>
                    <div className="flex items-center gap-3">
                        <span className="text-xl">📊</span>
                        <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900 dark:text-white/90 italic">
                            Market Master <span className="text-blue-500">Terminal</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Datastream</span>
                    </div>
                    <div className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
                        EST {new Date().toLocaleTimeString()}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative z-10 h-full">
                {/* Lateral Navigation Pane */}
                <aside className="w-[380px] h-full border-r border-zinc-200 dark:border-white/5 bg-white/40 dark:bg-black/20 backdrop-blur-md flex flex-col shrink-0 overflow-hidden">
                    <div className="p-6 border-b border-zinc-200 dark:border-white/5 space-y-6">
                        {/* Global View Selector */}
                        <div className="flex bg-zinc-100 dark:bg-white/5 p-1 rounded-xl border border-zinc-200 dark:border-white/5">
                            <button 
                                onClick={() => { setViewMode('stocks'); setSelectedAsset(stocks[0]); }}
                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'stocks' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 dark:text-zinc-500 hover:text-blue-500'}`}
                            >
                                Equity Watch
                            </button>
                            <button 
                                onClick={() => { setViewMode('indices'); setSelectedAsset(indices[0]); }}
                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'indices' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 dark:text-zinc-500 hover:text-blue-500'}`}
                            >
                                Index Watch
                            </button>
                        </div>

                        <div className="relative group">
                            <input 
                                type="text"
                                placeholder={`Filter ${viewMode === 'stocks' ? 'Assets' : 'Benchmarks'}...`}
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
                                onClick={() => setSelectedAsset(s)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group mb-1 ${selectedAsset?.symbol === s.symbol ? 'bg-blue-600/10 dark:bg-blue-600/20 border border-blue-500/30' : 'hover:bg-zinc-50 dark:hover:bg-white/5 border border-transparent'}`}
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
                    <div className="h-20 lg:h-24 bg-gradient-to-r from-transparent via-blue-900/5 to-transparent border-b border-zinc-200 dark:border-white/5 flex items-center justify-between px-10 shrink-0">
                        {selectedAsset && (
                            <div className="flex items-center gap-12">
                                <div>
                                    <div className="flex items-center gap-4 mb-1">
                                        <h2 className="text-3xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter">{selectedAsset.symbol}</h2>
                                        <span className="px-3 py-1 bg-blue-600/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-500/20">
                                            {viewMode === 'stocks' ? 'Equity Mode' : 'Market Index'}
                                        </span>
                                    </div>
                                    <p className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.2em]">{selectedAsset.name || selectedAsset.symbol} {selectedAsset.sector ? `• ${selectedAsset.sector}` : ''}</p>
                                </div>

                                <div className="h-10 w-[1px] bg-zinc-200 dark:bg-white/10 hidden md:block"></div>

                                <div className="hidden lg:flex items-center gap-10">
                                    <div>
                                        <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1">Session Delta</p>
                                        <p className="text-sm font-black font-mono">
                                            <span className={selectedAsset.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                                                {selectedAsset.change >= 0 ? '+' : ''}{selectedAsset.change?.toFixed(2)}
                                            </span>
                                            <span className="mx-2 text-zinc-300 dark:text-white/20">|</span> 
                                            <span className="text-zinc-400 dark:text-zinc-500 opacity-60">P:</span> <span className="text-zinc-900 dark:text-white">{selectedAsset.currentPrice?.toLocaleString()}</span>
                                        </p>
                                    </div>
                                    {viewMode === 'stocks' && (
                                        <div>
                                            <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1">Trading Liquidity</p>
                                            <p className="text-sm font-black font-mono text-zinc-900 dark:text-white">{selectedAsset.volume}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex bg-zinc-100 dark:bg-white/5 p-1 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl">
                            {['1H', '1D', '1W'].map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-8 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${timeframe === tf ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30' : 'text-zinc-500 dark:text-zinc-600 hover:text-blue-600 dark:hover:text-white'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>

                        <div className="flex-1 p-4 lg:p-6 relative min-h-[600px]">
                            <div className="absolute inset-0 p-4 lg:p-6 flex flex-col">
                                <div className="flex-1 bg-white dark:bg-black/60 rounded-3xl border border-zinc-200 dark:border-white/5 overflow-hidden shadow-[0_0_50px_-12px_rgba(37,99,235,0.15)] transition-all duration-1000 relative">
                                    <TradingChart
                                        title={`${selectedAsset?.symbol} Strategic Roadmap`}
                                        data={candles}
                                        currentTimeframe={timeframe}
                                        onTimeframeChange={setTimeframe}
                                        currencySymbol={viewMode === 'indices' ? '' : 'Rs.'}
                                        seamless={true}
                                    />
                                </div>
                            
                            <div className="mt-4 lg:mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 shrink-0 pb-2">
                                {[
                                    { label: viewMode === 'stocks' ? 'Market Cap' : 'Index Weight', val: 'Proprietary Vector', icon: '🏛️' },
                                    { label: 'Volatility Index', val: timeframe === '1H' ? '0.012 σ' : '0.045 σ', icon: '⚡' },
                                    { label: 'Alpha Strength', val: ((selectedAsset?.changePercent || 0) * 1.2).toFixed(2) + '%', icon: '💎' },
                                    { label: 'Neural Sentiment', val: (selectedAsset?.changePercent || 0) >= 0 ? 'BULLISH' : 'BEARISH', icon: '🧠' },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white/60 dark:bg-white/5 border border-zinc-100 dark:border-white/5 rounded-2xl lg:rounded-[2rem] p-4 lg:p-5 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-all group/stat backdrop-blur-md shadow-sm">
                                        <div className="flex items-center gap-3 lg:gap-4">
                                            <div className="text-xl lg:text-2xl group-hover:scale-110 transition-transform">{stat.icon}</div>
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
