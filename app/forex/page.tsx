"use client";

import PriceCard from "../components/PriceCard";
import { useState, useEffect, useCallback } from "react";
import { useSettings } from "../context/SettingsContext";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

export default function ForexPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [forexRates, setForexRates] = useState<any[]>([]);
    const [selectedPair, setSelectedPair] = useState<any>(null);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [currency, setCurrency] = useState<'PKR' | 'USD'>('PKR');
    const { settings } = useSettings();

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

    // Generate mock trend data for the selected pair
    useEffect(() => {
        if (!selectedPair) return;
        const points = 24;
        const basePrice = currency === 'PKR' ? selectedPair.pkrPrice : selectedPair.usdPrice;
        const data = [];
        let current = basePrice;
        for (let i = points; i >= 0; i--) {
            const time = new Date(Date.now() - i * 3600000);
            current = current * (1 + (Math.random() - 0.5) * 0.002);
            data.push({
                time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                price: current
            });
        }
        setTrendData(data);
    }, [selectedPair, currency]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                            💱 Global Forex
                            <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">Live</span>
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Real-time currency exchange rates & trends</p>
                    </div>

                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                        <button onClick={() => setCurrency('PKR')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${currency === 'PKR' ? 'bg-white dark:bg-zinc-700 shadow text-green-600' : 'text-zinc-500'}`}>PKR</button>
                        <button onClick={() => setCurrency('USD')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${currency === 'USD' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600' : 'text-zinc-500'}`}>USD</button>
                    </div>
                </header>

                {error && <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-lg">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                    {forexRates.slice(0, 4).map((rate) => (
                        <div key={rate.code} onClick={() => setSelectedPair(rate)} className="cursor-pointer">
                            <PriceCard
                                title={`${rate.code} - ${rate.name}`}
                                usdPrice={rate.usdPrice}
                                pkrPrice={rate.pkrPrice}
                                change={rate.change}
                                changePercent={rate.changePercent}
                                lastUpdated={new Date().toLocaleTimeString()}
                                isLoading={loading}
                                currency={currency}
                            />
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                                {selectedPair ? `${selectedPair.code}/PKR Performance` : 'Market Trend'}
                            </h2>
                            <span className="text-xs text-zinc-500">Last 24 Hours</span>
                        </div>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorForex" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="time" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                    <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorForex)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <h2 className="font-bold text-zinc-900 dark:text-zinc-50">Exchange Table</h2>
                        </div>
                        <div className="overflow-y-auto max-h-[400px]">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0">
                                    <tr className="text-left text-zinc-500">
                                        <th className="p-3">Currency</th>
                                        <th className="p-3 text-right">Rate ({currency})</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {forexRates.map((rate) => (
                                        <tr key={rate.code} onClick={() => setSelectedPair(rate)} className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${selectedPair?.code === rate.code ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : ''}`}>
                                            <td className="p-3">
                                                <div className="font-bold">{rate.code}</div>
                                                <div className="text-xs text-zinc-500">{rate.name}</div>
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold">
                                                {currency === 'PKR' ? rate.pkrPrice.toFixed(2) : rate.usdPrice.toFixed(4)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
