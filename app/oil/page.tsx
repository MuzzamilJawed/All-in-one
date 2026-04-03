"use client";

import PriceCard from "../components/PriceCard";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../components/TradingChart'), { ssr: false });
import { useState, useEffect, useCallback, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import { fetchOilPrices } from "../lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function OilPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [oilPrices, setOilPrices] = useState<any[]>([]);
  const [allEnergy, setAllEnergy] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendEnergy, setTrendEnergy] = useState("crudeOil"); 
  const [trendTimeframe, setTrendTimeframe] = useState("Daily");
  const [tableCurrency, setTableCurrency] = useState<'PKR' | 'USD'>('USD');
  const [oilCandles, setOilCandles] = useState<any[]>([]);
  const [oilChartTF, setOilChartTF] = useState("1H");

  const { settings } = useSettings();
  const stableTrendRef = useRef<Record<string, any[]>>({});
  const stableCandlesRef = useRef<Record<string, any[]>>({});

  const loadPrices = useCallback(async (isManual = true) => {
    try {
      if (isManual) setLoading(true);
      setError("");
      
      const data = await fetchOilPrices();
      
      if (!data) {
        if (isManual) setError("Could not fetch energy market data.");
        return;
      }

      const featuredKeys = ['crudeOil', 'brentOil', 'murbanOil', 'naturalGas'];
      const updatedPrices = featuredKeys.map(key => {
        const item = data[key];
        return {
          title: item?.name || key,
          usdPrice: item?.price,
          pkrPrice: item?.pkrPrice,
          change: item?.change ?? 0,
          changePercent: item?.changePercent ?? 0,
          lastUpdated: new Date().toLocaleString(),
          isLoading: !item,
        };
      });

      setOilPrices(updatedPrices);
      setAllEnergy(data.allEnergy || []);
      
      // Update trend and candles based on new data
      updateMarketVisuals(data);

    } catch (err) {
      console.error("Failed to fetch oil prices:", err);
      if (isManual) setError("An error occurred while fetching energy data.");
    } finally {
      if (isManual) setLoading(false);
    }
  }, [trendEnergy, trendTimeframe, tableCurrency, oilChartTF]);

  const updateMarketVisuals = (data: any) => {
    const isPkr = tableCurrency === 'PKR';
    const selectedEnergy = data[trendEnergy] || (data.allEnergy && data.allEnergy.find((i: any) => i.key === trendEnergy));
    if (!selectedEnergy) return;

    const currentPrice = isPkr ? selectedEnergy.pkrPrice : selectedEnergy.price;
    const trendKey = `${trendEnergy}-${trendTimeframe}-${tableCurrency}`;

    // Generate/Update Trend Data
    let points = 24;
    let interval = 3600 * 1000;
    let volatility = 0.01;

    if (trendTimeframe === 'Daily') { points = 24; interval = 3600 * 1000; volatility = 0.005; }
    if (trendTimeframe === 'Weekly') { points = 7; interval = 24 * 3600 * 1000; volatility = 0.015; }
    if (trendTimeframe === 'Monthly') { points = 30; interval = 24 * 3600 * 1000; volatility = 0.02; }
    if (trendTimeframe === 'Yearly') { points = 52; interval = 7 * 24 * 3600 * 1000; volatility = 0.04; }

    if (stableTrendRef.current[trendKey] && stableTrendRef.current[trendKey].length === points) {
      const existing = [...stableTrendRef.current[trendKey]];
      existing[existing.length - 1] = {
        ...existing[existing.length - 1],
        price: isPkr ? Math.round(currentPrice) : parseFloat(currentPrice.toFixed(2))
      };
      stableTrendRef.current[trendKey] = existing;
      setTrendData(existing);
    } else {
      const newTrendData = [];
      const now = Date.now();
      let simPrice = currentPrice;
      const prices = [currentPrice];
      const times = [now];

      for (let i = 1; i < points; i++) {
        const change = (Math.random() - 0.5) * (volatility * 2);
        simPrice = simPrice * (1 - change);
        prices.push(simPrice);
        times.push(now - i * interval);
      }

      for (let i = points - 1; i >= 0; i--) {
        const time = new Date(times[i]);
        let label = (trendTimeframe === 'Daily')
          ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : time.toLocaleDateString([], { month: 'short', day: 'numeric' });

        newTrendData.push({
          name: label,
          price: isPkr ? Math.round(prices[i]) : parseFloat(prices[i].toFixed(2))
        });
      }
      stableTrendRef.current[trendKey] = newTrendData;
      setTrendData(newTrendData);
    }

    // Generate Candles
    const candleKey = `${trendEnergy}-${oilChartTF}-${tableCurrency}`;
    let seconds = 3600, count = 48;
    if (oilChartTF === "1D") { seconds = 86400; count = 30; }
    if (oilChartTF === "1W") { seconds = 604800; count = 52; }
    
    if (stableCandlesRef.current[candleKey]) {
        const existing = [...stableCandlesRef.current[candleKey]];
        const last = { ...existing[existing.length - 1] };
        last.close = currentPrice;
        last.high = Math.max(last.high, currentPrice);
        last.low = Math.min(last.low, currentPrice);
        existing[existing.length - 1] = last;
        setOilCandles(existing);
    } else {
        const candles = [];
        const nowSec = Math.floor(Date.now() / 1000);
        for (let i = count; i >= 0; i--) {
          const time = nowSec - i * seconds;
          const vol = oilChartTF === "1W" ? 0.08 : oilChartTF === "1D" ? 0.04 : 0.01;
          const open = currentPrice / (1 + (Math.random() - 0.5) * vol);
          const close = i === 0 ? currentPrice : open * (1 + (Math.random() - 0.5) * (vol * 0.8));
          const high = Math.max(open, close) * (1 + Math.random() * (vol * 0.4));
          const low = Math.min(open, close) * (1 - Math.random() * (vol * 0.4));
          candles.push({ time, open, high, low, close });
        }
        stableCandlesRef.current[candleKey] = candles;
        setOilCandles(candles);
    }
  };

  useEffect(() => {
    loadPrices(true);
  }, [trendEnergy, trendTimeframe, tableCurrency, oilChartTF]);

  useEffect(() => {
    if (!settings.refreshInterval || settings.refreshInterval <= 0) return;
    const interval = setInterval(() => loadPrices(false), settings.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [settings.refreshInterval, loadPrices]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black overflow-x-hidden w-full selection:bg-blue-500/30">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm w-full">
        <div className="px-8 py-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-3 tracking-tighter uppercase italic">
                🛢️ Energy Markets
                <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest animate-pulse">
                  Live
                </span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`}></span>
                {loading ? "Synchronizing Satellite Feeds..." : `Terminal Active - ${new Date().toLocaleTimeString()}`}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-1 border border-zinc-200 dark:border-zinc-700">
                <button onClick={() => setTableCurrency('PKR')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${tableCurrency === 'PKR' ? 'bg-white dark:bg-zinc-700 shadow-lg text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}>PKR</button>
                <button onClick={() => setTableCurrency('USD')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${tableCurrency === 'USD' ? 'bg-white dark:bg-zinc-700 shadow-lg text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}>USD</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-12">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 flex items-center gap-4">
            <span className="text-2xl">⚠️</span>
            <p className="text-red-500 font-black uppercase text-xs tracking-widest">{error}</p>
          </div>
        )}

        {/* Price Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {oilPrices.map((oil) => (
            <PriceCard key={oil.title} {...oil} currency={tableCurrency} />
          ))}
        </div>

        {/* Detailed Energy Table Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Extended Energy Feed</h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Satellite Comparison Analysis</p>
            </div>
            <div className="text-[10px] font-black text-blue-500 border border-blue-500/20 px-4 py-2 rounded-xl uppercase tracking-widest bg-blue-500/5">
              {allEnergy.length} Active Contracts
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] bg-zinc-50/50 dark:bg-white/5">
                  <th className="px-8 py-5">Commodity Scrip</th>
                  <th className="px-8 py-5 text-right">Market Price</th>
                  <th className="px-8 py-5 text-right">Momentum</th>
                  <th className="px-8 py-5 text-center">Weekly</th>
                  <th className="px-8 py-5 text-center">Monthly</th>
                  <th className="px-8 py-5 text-right">Satellite Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                {allEnergy.map((item) => (
                  <tr key={item.key} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => setTrendEnergy(item.key)}>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${item.change >= 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                        <span className="font-black text-zinc-900 dark:text-white tracking-tight uppercase italic">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-mono font-black text-zinc-900 dark:text-zinc-400 group-hover:text-blue-500">
                      {tableCurrency === 'PKR' ? 'Rs. ' : '$'}
                      {(tableCurrency === 'PKR' ? item.pkrPrice : item.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-8 py-5 text-right text-[10px] font-black ${item.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {item.changePercent >= 0 ? '▲' : '▼'} {Math.abs(item.changePercent).toFixed(2)}%
                    </td>
                    <td className={`px-8 py-5 text-center text-[10px] font-bold ${item.weekly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.weekly > 0 ? '+' : ''}{item.weekly}%
                    </td>
                    <td className={`px-8 py-5 text-center text-[10px] font-bold ${item.monthly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.monthly > 0 ? '+' : ''}{item.monthly}%
                    </td>
                    <td className="px-8 py-5 text-right text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                      {item.date || 'Live Data'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          {/* Trend Chart */}
          <div className="xl:col-span-2 bg-white dark:bg-zinc-900 rounded-[3rem] shadow-sm p-10 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
              <div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Market Momentum</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Historical Price Velocity: <span className="text-blue-500">{allEnergy.find(i => i.key === trendEnergy)?.name}</span></p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <select 
                  value={trendEnergy} 
                  onChange={(e) => setTrendEnergy(e.target.value)}
                  className="bg-zinc-100 dark:bg-zinc-800/50 rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest border-none outline-none focus:ring-1 focus:ring-blue-500 transition-all dark:text-zinc-300"
                >
                  {allEnergy.map(item => (
                    <option key={item.key} value={item.key}>{item.name}</option>
                  ))}
                </select>
                
                <div className="flex bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-1">
                  {['Daily', 'Weekly', 'Monthly'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTrendTimeframe(tf)}
                      className={`px-3 py-1.5 text-[9px] font-black rounded-lg transition-all uppercase tracking-widest ${trendTimeframe === tf ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorOil" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 800 }} />
                  <YAxis
                    stroke="#52525b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => tableCurrency === 'PKR' ? `Rs.${(v/1000).toFixed(1)}k` : `$${v}`}
                    tick={{ fontWeight: 800 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '24px', color: '#fff', padding: '16px' }} 
                    itemStyle={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                    labelStyle={{ fontWeight: 900, marginBottom: '8px', color: '#71717a' }}
                    formatter={(v: any) => [tableCurrency === 'PKR' ? `Rs. ${Number(v).toLocaleString()}` : `$${Number(v).toLocaleString()}`, 'Execution Price']} 
                  />
                  <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorOil)" strokeWidth={4} animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Market Stats Sidebar */}
          <div className="space-y-8">
            <div className="bg-zinc-900 text-white rounded-[3rem] p-10 relative overflow-hidden border border-white/5">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/20 to-transparent"></div>
                <h3 className="relative z-10 text-xl font-black uppercase italic tracking-tighter mb-6">Terminal Summary</h3>
                <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Active Contracts</span>
                        <span className="font-mono font-black">{1000 + allEnergy.length * 50}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Global Supply</span>
                        <span className="font-mono font-black text-green-500">+1.2%</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">OPEC Outlook</span>
                        <span className="font-mono font-black text-amber-500">STABLE</span>
                    </div>
                    <div className="pt-4">
                        <p className="text-[9px] leading-relaxed text-zinc-400 font-medium uppercase italic">Automated analysis suggests high volatility in {allEnergy.find(i => i.key === trendEnergy)?.name || 'Markets'} for the next 48 hours due to regional infrastructure reports.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-6 dark:text-white">Price Alerts</h3>
                <div className="space-y-4">
                    {[
                        { title: `${allEnergy[0]?.name || 'WTI'} Above $80`, status: "Active" },
                        { title: `${allEnergy[1]?.name || 'Brent'} Drop 5%`, status: "Monitor" },
                        { title: `${allEnergy[2]?.name || 'Natural Gas'} Spike 2%`, status: "Triggered" }
                    ].map((alert, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-white/5">
                            <span className="text-[10px] font-black uppercase dark:text-zinc-300 tracking-tight">{alert.title}</span>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${alert.status === 'Triggered' ? 'bg-red-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>{alert.status}</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>

        {/* Candlestick Analysis */}
        <div className="mt-12">
            <div className="flex items-end justify-between mb-8">
                <div>
                   <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Technical Analysis</h2>
                   <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">High Precision Candlestick Feed: <span className="text-blue-500">{allEnergy.find(i => i.key === trendEnergy)?.name}</span></p>
                </div>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 h-fit">
                  {['1H', '1D', '1W'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setOilChartTF(tf)}
                      className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase ${oilChartTF === tf ? 'bg-white dark:bg-zinc-700 shadow-md text-blue-600' : 'text-zinc-500 hover:text-zinc-900'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
            </div>
            <div className="h-[600px] w-full">
                <TradingChart title={`${(allEnergy.find(i => i.key === trendEnergy)?.name || 'Oil').toUpperCase()} / ${tableCurrency}`} data={oilCandles} currentTimeframe={oilChartTF} onTimeframeChange={setOilChartTF} />
            </div>
        </div>
      </div>
    </div>
  );
}
