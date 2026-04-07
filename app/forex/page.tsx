"use client";

import PriceCard from "../components/PriceCard";
import { useState, useEffect, useCallback } from "react";
import { useSettings } from "../context/SettingsContext";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../components/TradingChart'), { ssr: false });

export default function ForexPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [forexRates, setForexRates] = useState<any[]>([]);
    const [selectedPair, setSelectedPair] = useState<any>(null);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [chartTF, setChartTF] = useState("1H");
    const { settings, updateSettings } = useSettings();
    const currency = settings.currency as 'USD' | 'PKR';

    const loadForex = useCallback(async (isManual = true) => {
        try {
            if (isManual) setLoading(true);
            const res = await fetch('/api/forex');
            if (!res.ok) throw new Error("Failed to fetch rates");
            const data = await res.json();
            setForexRates(data);
            if (!selectedPair && data.length > 0) setSelectedPair(data[1]); // Default to first pair after USD
        } catch (err) {
            setError("Unable to load exchange rates");
        } finally {
            if (isManual) setLoading(false);
        }
    }, [selectedPair]);

    useEffect(() => {
        loadForex(true);
    }, []); // Only on mount

    useEffect(() => {
        if (!settings.refreshInterval || settings.refreshInterval <= 0) return;
        const interval = setInterval(() => loadForex(false), settings.refreshInterval * 1000);
        return () => clearInterval(interval);
    }, [settings.refreshInterval, loadForex]);

    useEffect(() => {
        if (!selectedPair) return;
        const count = 100;
        const basePrice = currency === 'PKR' ? selectedPair.pkrPrice : selectedPair.usdPrice;
        const data = [];
        const nowSec = Math.floor(Date.now() / 1000);
        const interval = chartTF === '1H' ? 3600 : 86400;

        let lastClose = basePrice;
        const volatility = chartTF === '1H' ? 0.001 : 0.003;

        for (let i = 0; i < count; i++) {
            const time = nowSec - i * interval;
            const change = (Math.random() - 0.5) * volatility;
            
            const close = lastClose;
            const open = close / (1 + change);
            const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.2));
            const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.2));
            
            data.unshift({ 
                time, 
                open: parseFloat(open.toFixed(currency === 'PKR' ? 2 : 4)), 
                high: parseFloat(high.toFixed(currency === 'PKR' ? 2 : 4)), 
                low: parseFloat(low.toFixed(currency === 'PKR' ? 2 : 4)), 
                close: parseFloat(close.toFixed(currency === 'PKR' ? 2 : 4)),
                volume: Math.floor(Math.random() * 10000) + 1000
            });
            lastClose = open;
        }
        setTrendData(data);
    }, [selectedPair, currency, chartTF]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white selection:bg-blue-500/30">
            {/* Dynamic Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="max-w-[1600px] mx-auto p-4 sm:p-8 relative z-10">
                <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-4xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter">💱 Forex Terminal</h1>
                            <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                                <span className="text-[10px] text-green-500 font-black uppercase tracking-widest animate-pulse">Syncing Live</span>
                            </div>
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-500 text-sm font-bold tracking-tight">Real-time cross-currency velocity & volatility synthesis</p>
                    </div>

                    <div className="flex bg-zinc-100 dark:bg-zinc-900/50 backdrop-blur-md rounded-2xl p-1.5 border border-zinc-200 dark:border-white/5 shadow-xl">
                        <button onClick={() => updateSettings({ currency: 'PKR' })} className={`px-8 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${currency === 'PKR' ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/40' : 'text-zinc-500 hover:text-zinc-300'}`}>PKR View</button>
                        <button onClick={() => updateSettings({ currency: 'USD' })} className={`px-8 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${currency === 'USD' ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/40' : 'text-zinc-500 hover:text-zinc-300'}`}>USD View</button>
                    </div>
                </header>

                {error && (
                    <div className="mb-12 p-6 bg-red-500/10 border border-red-500/20 rounded-[2.5rem] flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                        <span className="text-2xl">⚠️</span>
                        <p className="text-red-500 font-black uppercase text-xs tracking-widest">{error}</p>
                    </div>
                )}

                {/* Primary Intelligence Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
                    {/* Market Watch Table Sidebar */}
                    <div className="lg:col-span-1 min-h-[800px] bg-white dark:bg-zinc-900/40 rounded-[2.5rem] border border-zinc-200 dark:border-white/5 overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-900/50">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Market Watch</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-md">
                                    <tr className="border-b border-zinc-200 dark:border-white/5">
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-400 tracking-widest">Asset</th>
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-zinc-400 tracking-widest text-right">Price</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-zinc-400 tracking-widest text-right">24h%</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                                    {forexRates.map((rate) => (
                                        <tr 
                                            key={rate.code}
                                            onClick={() => setSelectedPair(rate)}
                                            className={`group cursor-pointer transition-colors duration-200 ${
                                                selectedPair?.code === rate.code 
                                                ? 'bg-blue-600/10 dark:bg-blue-600/20' 
                                                : 'hover:bg-zinc-50 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${selectedPair?.code === rate.code ? 'bg-blue-500 animate-pulse' : 'bg-transparent'}`}></div>
                                                    <div>
                                                        <div className={`text-sm font-black tracking-tighter uppercase italic ${selectedPair?.code === rate.code ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>{rate.code}</div>
                                                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest truncate max-w-[60px]">{rate.name}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`px-4 py-5 text-right font-mono text-sm font-black tracking-tighter ${selectedPair?.code === rate.code ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>
                                                {currency === 'PKR' ? rate.pkrPrice.toFixed(2) : rate.usdPrice.toFixed(4)}
                                            </td>
                                            <td className={`px-6 py-5 text-right text-[10px] font-black ${rate.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {rate.changePercent >= 0 ? '▲' : '▼'}{Math.abs(rate.changePercent).toFixed(2)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Main Chart Terminal */}
                    <div className="lg:col-span-3 space-y-8">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-[3rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            <div className="relative">
                                <TradingChart 
                                    title={`${selectedPair?.code || 'Market'} Intelligence`} 
                                    data={trendData} 
                                    currentTimeframe={chartTF} 
                                    onTimeframeChange={setChartTF} 
                                    currencySymbol={currency === 'PKR' ? 'Rs.' : '$'} 
                                />
                            </div>
                        </div>

                        {/* Tactical Stats Overlay */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {[
                                { label: 'Execution Volatility', val: (Math.random() * 0.5 + 0.1).toFixed(2) + '%', color: 'text-blue-500', icon: '⚡' },
                                { label: 'Spread Velocity', val: '0.0001 pts', color: 'text-indigo-500', icon: '📊' },
                                { label: 'Network Liquidity', val: '99.9% Depth', color: 'text-purple-500', icon: '⚪' },
                            ].map(item => (
                                <div key={item.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 p-6 rounded-[2rem] flex items-center gap-4 hover:shadow-xl transition-all duration-500">
                                    <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-white/5 flex items-center justify-center text-xl">{item.icon}</div>
                                    <div>
                                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">{item.label}</p>
                                        <p className={`text-sm font-black uppercase tracking-tighter ${item.color}`}>{item.val}</p>
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
