"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../../components/TradingChart'), { ssr: false });
import { useSettings } from "../../context/SettingsContext";
import StockCard from "../../components/StockCard";

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
    sector?: string;
}

export default function StockDetailPage() {
    const params = useParams();
    const symbol = (params.symbol as string)?.toUpperCase();
    const router = useRouter();
    const { settings } = useSettings();
    const tableCurrency = settings.currency as 'USD' | 'PKR';
    
    const [stock, setStock] = useState<Stock | null>(null);
    const [relatedStocks, setRelatedStocks] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(true);
    const [watchlists, setWatchlists] = useState<any[]>([]);
    const [candles, setCandles] = useState<any[]>([]);
    const [timeframe, setTimeframe] = useState("1H");

    const fetchWatchlists = async () => {
        try {
            const res = await fetch('/api/watchlists');
            const json = await res.json();
            if (json.success) setWatchlists(json.data);
        } catch (err) {
            console.error('Failed to fetch watchlists', err);
        }
    };

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const res = await fetch('/api/psx-stocks');
                const json = await res.json();
                const data: Stock[] = json?.data || [];
                const s = data.find(st => st.symbol?.toUpperCase() === symbol);
                
                if (s) {
                    setStock(s);
                    generateInitialCandles(s);
                    
                    // Get related stocks from same sector
                    if (s.sector) {
                        const related = data
                            .filter(st => st.sector === s.sector && st.symbol?.toUpperCase() !== symbol)
                            .slice(0, 5);
                        setRelatedStocks(related);
                    }
                }
            } catch (err) {
                console.error('Failed to load stock detail', err);
            } finally {
                setLoading(false);
            }
        }

        const generateInitialCandles = (data: Stock) => {
            const basePrice = data.currentPrice || 100;
            const candleData = [];
            const nowSec = Math.floor(Date.now() / 1000);
            const interval = timeframe === "1H" ? 3600 : timeframe === "1D" ? 86400 : 604800;
            const count = 80;

            let lastClose = basePrice;
            const volatility = timeframe === "1W" ? 0.06 : timeframe === "1D" ? 0.03 : 0.012;

            for (let i = 0; i < count; i++) {
                const time = nowSec - i * interval;
                const change = (Math.random() - 0.5) * volatility;
                
                const close = lastClose;
                const open = close / (1 + change);
                const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.3));
                const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.3));

                candleData.unshift({ 
                    time, 
                    open: parseFloat(open.toFixed(2)), 
                    high: parseFloat(high.toFixed(2)), 
                    low: parseFloat(low.toFixed(2)), 
                    close: parseFloat(close.toFixed(2)),
                    volume: Math.floor(Math.random() * 100000) + 10000
                });
                lastClose = open;
            }
            setCandles(candleData);
        };

        if (symbol) {
            load();
            fetchWatchlists();
        }
    }, [symbol, timeframe]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Querying PSX Satellite Feeds...</p>
                </div>
            </div>
        );
    }

    if (!stock) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-white italic uppercase mb-4">Terminal Error</h1>
                    <p className="text-zinc-500 mb-8 uppercase text-xs tracking-widest font-black">No market data footprint for {symbol}</p>
                    <button onClick={() => router.push('/stocks')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all">Back to Market Explorer</button>
                </div>
            </div>
        );
    }

    const isPositive = stock.change >= 0;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-blue-500/30">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
                <div className="max-w-[1600px] mx-auto px-8 py-6 flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <button onClick={() => router.push('/stocks')} className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center group">
                            <span className="text-zinc-500 group-hover:text-blue-500 transition-colors font-bold">←</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter leading-none">{stock.symbol}</h1>
                                <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded uppercase tracking-widest">PSX</span>
                            </div>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                                {stock.name} • {stock.sector}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-black text-zinc-900 dark:text-white font-mono tracking-tighter">
                            Rs.{stock.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </p>
                        <p className={`text-sm font-black flex items-center justify-end gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? '▲' : '▼'}{Math.abs(stock.change).toFixed(2)} ({Math.abs(stock.changePercent).toFixed(2)}%)
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-8 space-y-12">
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        { label: "Execution High", value: `Rs.${stock.high?.toFixed(1)}`, sub: "Daily Range High", color: 'text-green-500' },
                        { label: "Execution Low", value: `Rs.${stock.low?.toFixed(1)}`, sub: "Daily Range Low", color: 'text-red-500' },
                        { label: "Market Volume", value: stock.volume, sub: "Traded Shares", color: 'text-blue-500' },
                        { label: "Settle Price", value: `Rs.${stock.open?.toFixed(1)}`, sub: "Session Opening", color: 'text-zinc-500' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-white/5 shadow-sm">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">{stat.label}</p>
                            <div className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter mb-1">{stat.value}</div>
                            <div className={`text-[10px] font-black ${stat.color}`}>{stat.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Main Technical Terminal */}
                <div className="bg-white dark:bg-zinc-900 rounded-[3.5rem] p-10 border border-zinc-200 dark:border-white/5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <span className="text-[12rem] font-black italic text-blue-500 uppercase select-none">{stock.symbol}</span>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 relative z-10">
                        <div>
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">Velocity Performance Terminal</h2>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Institutional High-Precision Candlestick Feed / SMA (20)</p>
                        </div>
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-white/10">
                            {['1H', '1D', '1W'].map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-6 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${timeframe === tf ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[600px] w-full relative z-10">
                        <TradingChart 
                            title={`${stock.symbol} Technical Roadmap`} 
                            data={candles} 
                            currentTimeframe={timeframe} 
                            onTimeframeChange={setTimeframe} 
                            currencySymbol="Rs." 
                            seamless={true}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Intelligence Section */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📰</span>
                            <h3 className="text-xl font-black uppercase italic tracking-tighter dark:text-white">Equity Intelligence</h3>
                        </div>
                        <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-white/5 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-6 opacity-10 font-black text-5xl italic uppercase select-none">BULL</div>
                           <div className="relative z-10">
                               <p className="text-[9px] font-black text-blue-500 mb-2 uppercase tracking-widest">LATEST UPDATE</p>
                               <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight mb-4">{stock.symbol} Liquidity Profile</h4>
                               <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium line-clamp-3">Automated sentiment analysis suggest that {stock.name} is showing high relative strength compared to the KSE100 index. Volume profile indicates institutional accumulation at current execution levels.</p>
                           </div>
                        </div>
                    </div>

                    {/* Stock Card Quick Actions */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⭐</span>
                            <h3 className="text-xl font-black uppercase italic tracking-tighter dark:text-white">Quick Actions</h3>
                        </div>
                        <div className="max-w-md">
                            <StockCard 
                                {...stock} 
                                exchange="PSX"
                                watchlists={watchlists}
                            />
                        </div>
                    </div>
                </div>

                {/* Related Stocks Section */}
                {relatedStocks.length > 0 && (
                    <section className="space-y-6 pt-12 border-t border-zinc-200 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">Sector Corollaries: {stock.sector}</h2>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Comparison Analytics</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                            {relatedStocks.map(s => (
                                <button
                                    key={s.symbol}
                                    onClick={() => router.push(`/stocks/${s.symbol.toLowerCase()}`)}
                                    className="text-left p-6 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-white/5 hover:border-blue-500/50 transition-all shadow-sm group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-black text-zinc-900 dark:text-white group-hover:text-blue-500 transition-colors">{s.symbol}</h3>
                                        <span className={`text-[10px] font-black ${s.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(1)}%
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase truncate mb-4">{s.name}</p>
                                    <p className="text-lg font-black font-mono text-zinc-900 dark:text-white">Rs.{s.currentPrice?.toLocaleString()}</p>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
