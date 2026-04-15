"use client";

import PriceCard from "../components/PriceCard";
import { useState, useEffect, useCallback } from "react";
import { useSettings } from "../context/SettingsContext";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../components/TradingChart'), { ssr: false });

export default function CryptoPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cryptoData, setCryptoData] = useState<any[]>([]);
    const [selectedCoin, setSelectedCoin] = useState<any>(null);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [chartTF, setChartTF] = useState("1H");
    const { settings, updateSettings } = useSettings();
    const displayCurrency = settings.currency as 'USD' | 'PKR';

    const loadCrypto = useCallback(async (isManual = true) => {
        try {
            if (isManual) setLoading(true);
            const res = await fetch('/api/crypto');
            if (!res.ok) throw new Error("Failed to fetch crypto prices");
            const data = await res.json();
            setCryptoData(data);
            if (!selectedCoin && data.length > 0) setSelectedCoin(data[0]);
        } catch (err) {
            setError("Unable to load crypto market data");
        } finally {
            if (isManual) setLoading(false);
        }
    }, [selectedCoin]);

    useEffect(() => {
        loadCrypto(true);
    }, []);

    useEffect(() => {
        if (!settings.refreshInterval || settings.refreshInterval <= 0) return;
        const interval = setInterval(() => loadCrypto(false), settings.refreshInterval * 1000);
        return () => clearInterval(interval);
    }, [settings.refreshInterval, loadCrypto]);

    useEffect(() => {
        if (!selectedCoin) return;
        const count = 75;
        const basePrice = displayCurrency === 'PKR' ? selectedCoin.pkrPrice : selectedCoin.usdPrice;
        const data = [];
        const nowSec = Math.floor(Date.now() / 1000);
        const interval = chartTF === '1H' ? 3600 : chartTF === '1D' ? 86400 : 604800;

        let lastClose = basePrice;
        const volatility = chartTF === '1W' ? 0.08 : chartTF === '1D' ? 0.04 : 0.02;

        for (let i = 0; i < count; i++) {
            const time = nowSec - i * interval;
            const change = (Math.random() - 0.5) * volatility;
            
            const close = lastClose;
            const open = close / (1 + change);
            const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.3));
            const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.3));
            
            data.unshift({ 
                time, 
                open: parseFloat(open.toFixed(selectedCoin.symbol === 'BTC' ? 0 : 4)), 
                high: parseFloat(high.toFixed(selectedCoin.symbol === 'BTC' ? 0 : 4)), 
                low: parseFloat(low.toFixed(selectedCoin.symbol === 'BTC' ? 0 : 4)), 
                close: parseFloat(close.toFixed(selectedCoin.symbol === 'BTC' ? 0 : 4)),
                volume: Math.floor(Math.random() * 5000) + 1000
            });
            lastClose = open;
        }
        setTrendData(data);
    }, [selectedCoin, displayCurrency, chartTF]);

    const getCoinColor = (symbol: string) => {
        const colors: any = {
            BTC: '#f7931a', ETH: '#627eea', BNB: '#f3ba2f', SOL: '#14f195',
            XRP: '#23292f', ADA: '#0033ad', DOGE: '#c2a633', TRX: '#ef0027',
            DOT: '#e6007a', AVAX: '#e84142'
        };
        return colors[symbol] || '#3b82f6';
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-3 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2 uppercase italic tracking-tighter">
                            ₿ Crypto Hub
                            <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">Live</span>
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[10px] sm:text-sm mt-1 font-bold uppercase tracking-wide">Global Digital Asset Pulse</p>
                    </div>

                    <div className="flex w-full sm:w-auto bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 border border-zinc-200 dark:border-zinc-700">
                        <button onClick={() => updateSettings({ currency: 'USD' })} className={`flex-1 sm:flex-none px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${displayCurrency === 'USD' ? 'bg-white dark:bg-zinc-700 shadow text-orange-500' : 'text-zinc-500'}`}>USD View</button>
                        <button onClick={() => updateSettings({ currency: 'PKR' })} className={`flex-1 sm:flex-none px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${displayCurrency === 'PKR' ? 'bg-white dark:bg-zinc-700 shadow text-green-600' : 'text-zinc-500'}`}>PKR View</button>
                    </div>
                </header>

                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-8">
                    {cryptoData.slice(0, 5).map((coin) => (
                        <div key={coin.id} onClick={() => setSelectedCoin(coin)} className="cursor-pointer group">
                            <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all ${selectedCoin?.id === coin.id ? 'bg-white dark:bg-zinc-900 border-orange-500/50 shadow-xl' : 'bg-white/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-700'}`}>
                                <div className="flex justify-between items-center mb-2 sm:mb-3">
                                    <span className="font-black text-zinc-900 dark:text-zinc-50 text-xs sm:text-sm tracking-tighter uppercase italic">{coin.symbol}</span>
                                    <span className={`text-[10px] font-black ${coin.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {coin.changePercent >= 0 ? '+' : ''}{coin.changePercent.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="text-lg sm:text-2xl font-mono font-black text-zinc-900 dark:text-white tracking-tighter italic">
                                    {displayCurrency === 'USD' ? '$' : 'Rs.'}{(displayCurrency === 'USD' ? coin.usdPrice : coin.pkrPrice).toLocaleString(undefined, { maximumFractionDigits: coin.usdPrice > 1 ? 2 : 4 })}
                                </div>
                                <div className="text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1 sm:mt-2 truncate">{coin.name}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">
                                    {selectedCoin?.name} <span className="text-zinc-400 font-normal">Pulse</span>
                                </h2>
                                <div className="flex items-center gap-4 mt-2">
                                    <span className="text-2xl sm:text-4xl font-mono font-black text-zinc-900 dark:text-white tracking-tighter italic">
                                        {displayCurrency === 'USD' ? '$' : 'Rs.'}{(displayCurrency === 'USD' ? selectedCoin?.usdPrice : selectedCoin?.pkrPrice)?.toLocaleString()}
                                    </span>
                                    <span className={`text-xs sm:text-base font-black ${selectedCoin?.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {selectedCoin?.changePercent >= 0 ? '▲' : '▼'} {Math.abs(selectedCoin?.changePercent || 0).toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                            <div className="text-left sm:text-right">
                                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">Risk Assessment</div>
                                <div className="text-lg font-black text-orange-500 uppercase italic tracking-widest">Volatility High</div>
                            </div>
                        </div>

                        <div className="h-[300px] sm:h-[450px] w-full">
                            <TradingChart 
                                title={`${selectedCoin?.name} Tracking`} 
                                data={trendData} 
                                currentTimeframe={chartTF} 
                                onTimeframeChange={setChartTF} 
                                currencySymbol={displayCurrency === 'PKR' ? 'Rs.' : '$'} 
                            />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-[2rem] sm:rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden h-fit">
                        <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Market Surveillance</h2>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] lg:max-h-none overflow-y-auto no-scrollbar">
                            {cryptoData.map((coin) => (
                                <div
                                    key={coin.id}
                                    onClick={() => setSelectedCoin(coin)}
                                    className={`p-4 sm:p-5 cursor-pointer hover:bg-white/[0.02] transition-all flex justify-between items-center ${selectedCoin?.id === coin.id ? 'bg-orange-500/5 dark:bg-orange-900/10' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-white text-[10px] sm:text-xs tracking-tighter" style={{ backgroundColor: getCoinColor(coin.symbol) }}>
                                            {coin.symbol[0]}
                                        </div>
                                        <div>
                                            <div className="font-black text-zinc-900 dark:text-zinc-50 uppercase italic text-xs sm:text-sm tracking-tighter">{coin.symbol}</div>
                                            <div className="text-[8px] sm:text-[10px] text-zinc-500 uppercase font-black tracking-widest truncate max-w-[50px] sm:max-w-none">{coin.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-black text-zinc-900 dark:text-white text-xs sm:text-sm tracking-tighter">
                                            {displayCurrency === 'USD' ? '$' : ''}{(displayCurrency === 'USD' ? coin.usdPrice : coin.pkrPrice).toLocaleString(undefined, { maximumFractionDigits: coin.usdPrice > 1 ? 2 : 4 })}
                                        </div>
                                        <div className={`text-[8px] sm:text-[10px] font-black ${coin.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {coin.changePercent >= 0 ? '+' : ''}{coin.changePercent.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
