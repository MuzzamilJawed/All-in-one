"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StockCard from "../../components/StockCard";
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
    history?: { time: string; price: number }[];
}

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
    const symbol = params.symbol?.toUpperCase();
    const router = useRouter();
    const [stock, setStock] = useState<Stock | null>(null);
    const [relatedStocks, setRelatedStocks] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(true);
    const [watchlists, setWatchlists] = useState<any[]>([]);

    const generateHistory = (currentPrice: number) => {
        const history: { time: string; price: number }[] = [];
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
                const s = data.find(s => s.symbol?.toUpperCase() === symbol);
                if (s) {
                    s.history = generateHistory(s.currentPrice || 0);
                    setStock(s);
                    
                    // Get related stocks from same sector
                    if (s.sector) {
                        const related = data
                            .filter(st => st.sector === s.sector && st.symbol !== symbol)
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
        if (symbol) {
            load();
            fetchWatchlists();
        }
    }, [symbol]);

    const isPositive = stock && stock.change >= 0;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#050505]">
                <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-zinc-600 dark:text-zinc-400">Loading stock details...</p>
                </div>
            </div>
        );
    }

    if (!stock) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#050505]">
                <div className="text-center space-y-4">
                    <p className="text-red-500 font-bold">No data found for {symbol}</p>
                    <button onClick={() => router.back()} className="text-blue-600 hover:underline">← Back to Stocks</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4">
                    <button 
                        onClick={() => router.back()} 
                        className="text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 font-bold text-sm mb-3 flex items-center gap-1"
                    >
                        ← Back to Stocks
                    </button>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-black text-zinc-900 dark:text-white">{stock.symbol}</h1>
                                <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-1 rounded uppercase tracking-widest">PSX</span>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">{stock.name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-black font-mono">Rs.{stock.currentPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                            <p className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {isPositive ? '▲' : '▼'} {Math.abs(stock.change || 0).toFixed(2)} ({Math.abs(stock.changePercent || 0).toFixed(2)}%)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Open</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{stock.open?.toFixed(2)}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">High</p>
                        <p className="text-2xl font-black text-green-600">{stock.high?.toFixed(2)}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Low</p>
                        <p className="text-2xl font-black text-red-600">{stock.low?.toFixed(2)}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Volume</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{stock.volume}</p>
                    </div>
                </div>

                {/* Price Chart */}
                {stock.history && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-lg font-black mb-4 text-zinc-900 dark:text-zinc-50">7-Day Price History</h2>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stock.history}>
                                    <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#6b7280' }} />
                                    <Tooltip
                                        contentStyle={{ 
                                            backgroundColor: '#18181b', 
                                            border: '1px solid #27272a', 
                                            borderRadius: '12px', 
                                            color: '#fff'
                                        }}
                                        formatter={(v: any) => [`Rs. ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'Price']}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="price" 
                                        stroke="#3b82f6" 
                                        strokeWidth={3} 
                                        dot={{ fill: '#3b82f6', r: 5 }}
                                        isAnimationActive={true}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Stock Card */}
                <div className="max-w-lg">
                    <StockCard 
                        {...stock} 
                        exchange="PSX"
                        watchlists={watchlists}
                    />
                </div>

                {/* Sector Info */}
                {stock.sector && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-lg font-black mb-4 text-zinc-900 dark:text-zinc-50">Sector Information</h2>
                        <div className="flex items-center justify-between">
                            <p className="text-zinc-600 dark:text-zinc-400 font-medium">Sector</p>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{stock.sector}</p>
                        </div>
                    </div>
                )}

                {/* Related Stocks */}
                {relatedStocks.length > 0 && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-lg font-black mb-4 text-zinc-900 dark:text-zinc-50">Related Stocks in {stock.sector}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {relatedStocks.map(s => (
                                <button
                                    key={s.symbol}
                                    onClick={() => router.push(`/stocks/${s.symbol.toLowerCase()}`)}
                                    className="text-left p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-100 dark:border-zinc-800"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-black text-zinc-900 dark:text-zinc-50">{s.symbol}</h3>
                                        <span className={`text-xs font-bold ${(s.changePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {(s.changePercent || 0) >= 0 ? '▲' : '▼'} {Math.abs(s.changePercent || 0).toFixed(1)}%
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 font-bold mb-2">{s.name}</p>
                                    <p className="text-lg font-black font-mono text-zinc-900 dark:text-zinc-50">Rs.{s.currentPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
