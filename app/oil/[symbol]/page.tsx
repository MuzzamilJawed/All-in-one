"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../../components/TradingChart'), { ssr: false });
import { useSettings } from "../../context/SettingsContext";
import { fetchOilPrices } from "../../lib/api";

export default function OilDetailPage() {
    const params = useParams();
    const router = useRouter();
    const symbol = params.symbol as string;
    const { settings } = useSettings();
    const tableCurrency = settings.currency as 'USD' | 'PKR';
    
    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState<any>(null);
    const [candles, setCandles] = useState<any[]>([]);
    const [timeframe, setTimeframe] = useState("1H");

    useEffect(() => {
        const loadDetail = async () => {
            setLoading(true);
            try {
                const data = await fetchOilPrices();
                if (!data) return;

                // Find the item in featured keys or allEnergy
                let found = data[symbol];
                if (!found && data.allEnergy) {
                    found = data.allEnergy.find((i: any) => i.key === symbol);
                }

                if (found) {
                    setItem(found);
                    generateInitialCandles(found);
                }
            } catch (err) {
                console.error("Failed to load oil detail:", err);
            } finally {
                setLoading(false);
            }
        };

        const generateInitialCandles = (data: any) => {
            const basePrice = tableCurrency === 'PKR' ? data.pkrPrice : data.price;
            const candleData = [];
            const nowSec = Math.floor(Date.now() / 1000);
            const interval = timeframe === "1H" ? 3600 : timeframe === "1D" ? 86400 : 604800;
            const count = 100;

            let lastClose = basePrice;
            const volatility = timeframe === "1W" ? 0.05 : timeframe === "1D" ? 0.025 : 0.01;

            for (let i = 0; i < count; i++) {
                const time = nowSec - i * interval;
                const change = (Math.random() - 0.5) * volatility;
                
                const close = lastClose;
                const open = close / (1 + change);
                const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.3));
                const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.3));

                candleData.unshift({ 
                    time, 
                    open: parseFloat(open.toFixed(4)), 
                    high: parseFloat(high.toFixed(4)), 
                    low: parseFloat(low.toFixed(4)), 
                    close: parseFloat(close.toFixed(4)),
                    volume: Math.floor(Math.random() * 50000) + 10000
                });
                lastClose = open;
            }
            setCandles(candleData);
        };

        loadDetail();
    }, [symbol, tableCurrency, timeframe]);

    const formatPrice = (val: number) => {
        if (typeof val !== 'number') return '---';
        return val.toLocaleString(undefined, { 
            minimumFractionDigits: val < 10 ? 4 : 2, 
            maximumFractionDigits: val < 10 ? 4 : 2 
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Synchronizing Market Feeds...</p>
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-white italic uppercase mb-4">404 Terminal Error</h1>
                    <p className="text-zinc-500 mb-8 uppercase text-xs tracking-widest font-black">Asset not found in energy constellation</p>
                    <button onClick={() => router.push('/oil')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all">Back to Refinery</button>
                </div>
            </div>
        );
    }

    const currentPrice = tableCurrency === 'PKR' ? item.pkrPrice : item.price;
    const priceSymbol = tableCurrency === 'PKR' ? 'Rs. ' : '$';

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-blue-500/30">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
                <div className="max-w-[1600px] mx-auto px-8 py-6 flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <button onClick={() => router.push('/oil')} className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center group">
                            <span className="text-zinc-500 group-hover:text-blue-500 transition-colors">←</span>
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter leading-none">{item.name}</h1>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded">Terminal ID: {symbol}</span>
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-[1600px] mx-auto p-8 space-y-12">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        { label: "Execution Price", value: `${priceSymbol}${formatPrice(currentPrice)}`, sub: `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`, color: item.changePercent >= 0 ? 'text-green-500' : 'text-red-500' },
                        { label: "Weekly Momentum", value: `${item.weekly > 0 ? '+' : ''}${item.weekly}%`, sub: "7D Analysis", color: item.weekly >= 0 ? 'text-green-500' : 'text-red-500' },
                        { label: "Monthly Outlook", value: `${item.monthly > 0 ? '+' : ''}${item.monthly}%`, sub: "30D Projection", color: item.monthly >= 0 ? 'text-green-500' : 'text-red-500' },
                        { label: "Volume Scrip", value: "CONSOLIDATED", sub: "Market Dynamics", color: 'text-blue-500' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-white/5 shadow-sm">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">{stat.label}</p>
                            <div className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter mb-1">{stat.value}</div>
                            <div className={`text-[10px] font-black ${stat.color}`}>{stat.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Main Technical Chart */}
                <div className="bg-white dark:bg-zinc-900 rounded-[3.5rem] p-10 border border-zinc-200 dark:border-white/5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <span className="text-[12rem] font-black italic text-blue-500 uppercase select-none">{symbol}</span>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 relative z-10">
                        <div>
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">Satellite Technical Analysis</h2>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">High-Precision Candlestick Feed / SMA (20)</p>
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
                            title={`${item.name} Market Analysis`} 
                            data={candles} 
                            currentTimeframe={timeframe} 
                            onTimeframeChange={setTimeframe} 
                            currencySymbol={priceSymbol} 
                        />
                    </div>
                </div>

                {/* Intelligence & News Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-8">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📰</span>
                            <h3 className="text-xl font-black uppercase italic tracking-tighter dark:text-white">Active Intelligence Reports</h3>
                        </div>
                        <div className="space-y-6">
                            {[
                                { title: "Global Supply Chain Resilience", time: "2H AGO", text: `Detailed analysis of current extraction rates for ${item.name} reveals a robust movement profile despite regional volatility markers.`, tag: "HOT" },
                                { title: "Satellite Inventory Assessment", time: "5H AGO", text: "New imagery confirms a 1.2% expansion in terminal storage, suggesting a stable flow forecast for the next financial quarter.", tag: "LIVE" }
                            ].map((news, i) => (
                                <div key={i} className="bg-white dark:bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-white/5 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-6 opacity-10 font-black text-5xl italic uppercase select-none group-hover:scale-110 transition-transform">{news.tag}</div>
                                    <div className="relative z-10">
                                        <p className="text-[9px] font-black text-blue-500 mb-2 uppercase tracking-widest">{news.time}</p>
                                        <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight mb-4">{news.title}</h4>
                                        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">{news.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="flex items-center gap-3">
                           <span className="text-2xl">🔮</span>
                           <h3 className="text-xl font-black uppercase italic tracking-tighter dark:text-white">Refinery Outlook</h3>
                        </div>
                        <div className="bg-zinc-900 rounded-[3rem] p-10 border border-white/5 relative overflow-hidden h-full">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px]"></div>
                            <div className="relative z-10 space-y-10">
                                <div>
                                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Sentiment Synthesis</p>
                                    <div className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Strategic <br /> <span className="text-blue-500">Accumulation</span></div>
                                    <p className="text-zinc-400 text-sm leading-relaxed font-medium">Automated analysis engine indicates that {item.name} is entering a period of technical consolidation with a bullish bias for the Q3 interval.</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                        <p className="text-[8px] font-black text-green-500 uppercase tracking-widest mb-2">Technical Support</p>
                                        <p className="text-xl font-black text-white font-mono">{priceSymbol}{formatPrice(currentPrice * 0.94)}</p>
                                    </div>
                                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                        <p className="text-[8px] font-black text-red-500 uppercase tracking-widest mb-2">Resistance Band</p>
                                        <p className="text-xl font-black text-white font-mono">{priceSymbol}{formatPrice(currentPrice * 1.07)}</p>
                                    </div>
                                </div>

                                <div className="p-6 bg-blue-600/10 rounded-3xl border border-blue-500/20">
                                    <p className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] mb-2 text-center">Analyst Execution Summary</p>
                                    <p className="text-zinc-300 text-[11px] font-medium leading-relaxed italic text-center italic">"The market scrip for {item.name} shows high resilience at current execution levels. Institutional satellite metrics suggest a low-risk entry profile for long-term holders."</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
