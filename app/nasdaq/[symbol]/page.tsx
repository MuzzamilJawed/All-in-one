"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import StockCard from "../../components/StockCard";
import { useSettings } from "../../context/SettingsContext";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../../components/TradingChart'), { ssr: false });

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
    history?: { time: number; open: number; high: number; low: number; close: number }[];
}

export default function NasdaqSymbolPage() {
    const params = useParams();
    const symbol = (params.symbol as string)?.toUpperCase();
    const router = useRouter();
    const [stock, setStock] = useState<Stock | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartTF, setChartTF] = useState("1D");
    const { settings } = useSettings();
    const displayCurrency = settings.currency as 'USD' | 'PKR';

    const generateHistory = (currentPrice: number) => {
        const history = [];
        const count = 60;
        const nowSec = Math.floor(Date.now() / 1000);
        const interval = chartTF === "1H" ? 3600 : chartTF === "1D" ? 86400 : 604800;

        let lastClose = currentPrice;
        const volatility = chartTF === "1W" ? 0.05 : chartTF === "1D" ? 0.025 : 0.01;

        for (let i = 0; i < count; i++) {
            const time = nowSec - i * interval;
            const change = (Math.random() - 0.5) * volatility;
            
            const close = lastClose;
            const open = close / (1 + change);
            const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.3));
            const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.3));
            
            history.unshift({ 
                time, 
                open: parseFloat(open.toFixed(2)), 
                high: parseFloat(high.toFixed(2)), 
                low: parseFloat(low.toFixed(2)), 
                close: parseFloat(close.toFixed(2)),
                volume: Math.floor(Math.random() * 1000000) + 100000 
            });
            lastClose = open;
        }
        return history;
    };

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const res = await fetch('/api/nasdaq-stocks');
                const json = await res.json();
                const data: Stock[] = json?.data || [];
                const s = data.find(s => s.symbol?.toUpperCase() === symbol);
                if (s) {
                    s.history = generateHistory(s.currentPrice || 0);
                    setStock(s);
                }
            } catch (err) {
                console.error('Failed to load NASDAQ stock detail', err);
            } finally {
                setLoading(false);
            }
        }
        if (symbol) load();
    }, [symbol]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Accessing NASDAQ Satellite Feed...</p>
                </div>
            </div>
        );
    }
    if (!stock) {
        return (
          <div className="min-h-screen bg-black flex items-center justify-center">
              <div className="text-center">
                  <h1 className="text-4xl font-black text-white italic uppercase mb-4">Route Error</h1>
                  <p className="text-zinc-500 mb-8 uppercase text-xs tracking-widest font-black">No market data available for {symbol}</p>
                  <button onClick={() => router.push('/nasdaq')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all">Back to NASDAQ Console</button>
              </div>
          </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white p-6">
            <button onClick={() => router.back()} className="text-blue-600 font-black tracking-widest text-[10px] uppercase hover:underline mb-8 flex items-center gap-2">← Back to Console</button>
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="max-w-md">
                    <StockCard {...stock} exchange="NASDAQ" />
                </div>
                
                {stock.history && (
                    <div className="bg-white dark:bg-zinc-900 rounded-[3.5rem] p-10 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                            <span className="text-[12rem] font-black italic text-blue-500 uppercase select-none">{stock.symbol}</span>
                        </div>
                        <div className="flex justify-between items-center mb-12 relative z-10">
                            <div>
                                <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Satellite Velocity Terminal</h2>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Institutional Technical Feed: {stock.symbol} / {displayCurrency}</p>
                            </div>
                        </div>
                        <div className="h-[550px] relative z-10">
                            <TradingChart 
                                title={`${stock.symbol} / ${displayCurrency}`} 
                                data={stock.history} 
                                currentTimeframe={chartTF} 
                                onTimeframeChange={setChartTF} 
                                currencySymbol={displayCurrency === 'PKR' ? 'Rs.' : '$'} 
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
