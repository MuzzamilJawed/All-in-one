"use client";

import { useState, useEffect } from "react";
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
    history?: { time: string; price: number }[];
}

export default function NasdaqSymbolPage({ params }: { params: { symbol: string } }) {
    const symbol = params.symbol?.toUpperCase();
    const [stock, setStock] = useState<Stock | null>(null);
    const [loading, setLoading] = useState(true);

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
            <div className="p-8 text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                <p>Loading stock details...</p>
            </div>
        );
    }
    if (!stock) {
        return <div className="p-8 text-center text-red-500">No data for {symbol}</div>;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white p-6">
            <button onClick={() => window.history.back()} className="text-blue-600 hover:underline mb-4">← Back</button>
            <div className="max-w-3xl mx-auto space-y-6">
                <StockCard {...stock} exchange="NASDAQ" />
                {stock.history && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h2 className="text-lg font-black mb-4">Price History (simulated)</h2>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stock.history}>
                                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }}
                                        formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Price']}
                                    />
                                    <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
