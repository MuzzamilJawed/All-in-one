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

export default function CryptoPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cryptoData, setCryptoData] = useState<any[]>([]);
    const [selectedCoin, setSelectedCoin] = useState<any>(null);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [displayCurrency, setDisplayCurrency] = useState<'PKR' | 'USD'>('USD');
    const { settings } = useSettings();

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
        const points = 30;
        const basePrice = displayCurrency === 'PKR' ? selectedCoin.pkrPrice : selectedCoin.usdPrice;
        const data = [];
        let current = basePrice;
        for (let i = points; i >= 0; i--) {
            const time = new Date(Date.now() - i * 1800000); // 30 min intervals
            current = current * (1 + (Math.random() - 0.5) * 0.015); // Higher volatility for crypto
            data.push({
                time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                price: current
            });
        }
        setTrendData(data);
    }, [selectedCoin, displayCurrency]);

    const getCoinColor = (symbol: string) => {
        const colors: any = {
            BTC: '#f7931a', ETH: '#627eea', BNB: '#f3ba2f', SOL: '#14f195',
            XRP: '#23292f', ADA: '#0033ad', DOGE: '#c2a633', TRX: '#ef0027',
            DOT: '#e6007a', AVAX: '#e84142'
        };
        return colors[symbol] || '#3b82f6';
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                            ₿ Crypto Markets
                            <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-0.5 rounded dark:bg-orange-900/30 dark:text-orange-400">Live</span>
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Live cryptocurrency prices & market analytics</p>
                    </div>

                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                        <button onClick={() => setDisplayCurrency('USD')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${displayCurrency === 'USD' ? 'bg-white dark:bg-zinc-700 shadow text-orange-500' : 'text-zinc-500'}`}>USD</button>
                        <button onClick={() => setDisplayCurrency('PKR')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${displayCurrency === 'PKR' ? 'bg-white dark:bg-zinc-700 shadow text-green-600' : 'text-zinc-500'}`}>PKR</button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
                    {cryptoData.slice(0, 5).map((coin) => (
                        <div key={coin.id} onClick={() => setSelectedCoin(coin)} className="cursor-pointer group">
                            <div className={`p-4 rounded-xl border transition-all ${selectedCoin?.id === coin.id ? 'bg-white dark:bg-zinc-900 border-orange-500/50 shadow-lg' : 'bg-white/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-zinc-900 dark:text-zinc-50">{coin.symbol}</span>
                                    <span className={`text-xs font-bold ${coin.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {coin.changePercent >= 0 ? '+' : ''}{coin.changePercent.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="text-xl font-mono font-bold text-zinc-900 dark:text-zinc-50">
                                    {displayCurrency === 'USD' ? '$' : 'Rs.'}{(displayCurrency === 'USD' ? coin.usdPrice : coin.pkrPrice).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-zinc-500 mt-1">{coin.name}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                                    {selectedCoin?.name} <span className="text-zinc-400 font-normal">Chart</span>
                                </h2>
                                <div className="flex items-center gap-4 mt-1">
                                    <span className="text-3xl font-mono font-bold text-zinc-900 dark:text-zinc-50">
                                        {displayCurrency === 'USD' ? '$' : 'Rs.'}{(displayCurrency === 'USD' ? selectedCoin?.usdPrice : selectedCoin?.pkrPrice)?.toLocaleString()}
                                    </span>
                                    <span className={`font-bold ${selectedCoin?.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {selectedCoin?.changePercent >= 0 ? '▲' : '▼'} {Math.abs(selectedCoin?.changePercent || 0).toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-zinc-500 uppercase tracking-widest">Volatility Index</div>
                                <div className="text-lg font-bold text-orange-500">High</div>
                            </div>
                        </div>

                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorCrypto" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={getCoinColor(selectedCoin?.symbol)} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={getCoinColor(selectedCoin?.symbol)} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }}
                                        formatter={(v: any) => [`${displayCurrency === 'USD' ? '$' : 'Rs.'}${Number(v).toLocaleString()}`, 'Price']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="price"
                                        stroke={getCoinColor(selectedCoin?.symbol)}
                                        strokeWidth={4}
                                        fill="url(#colorCrypto)"
                                        animationDuration={2000}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden h-fit">
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <h2 className="font-bold text-zinc-900 dark:text-zinc-50">Market Assets</h2>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {cryptoData.map((coin) => (
                                <div
                                    key={coin.id}
                                    onClick={() => setSelectedCoin(coin)}
                                    className={`p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex justify-between items-center ${selectedCoin?.id === coin.id ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs" style={{ backgroundColor: getCoinColor(coin.symbol) }}>
                                            {coin.symbol[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-zinc-900 dark:text-zinc-50">{coin.symbol}</div>
                                            <div className="text-[10px] text-zinc-500">{coin.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-zinc-900 dark:text-zinc-50 text-sm">
                                            {displayCurrency === 'USD' ? '$' : ''}{(displayCurrency === 'USD' ? coin.usdPrice : coin.pkrPrice).toLocaleString()}
                                        </div>
                                        <div className={`text-[10px] font-bold ${coin.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {coin.changePercent >= 0 ? '+' : ''}{coin.changePercent.toFixed(2)}%
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
