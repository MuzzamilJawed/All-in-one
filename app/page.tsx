"use client";

import StatCard from "./components/StatCard";
import PriceCard from "./components/PriceCard";
import StockCard from "./components/StockCard";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchGoldPrice, fetchSilverPrice, fetchForexRates, fetchCryptoPrices, fetchOilPrices } from "./lib/api";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('./components/TradingChart'), { ssr: false });
import { useSettings } from "./context/SettingsContext";

export default function Home() {
  const [goldData, setGoldData] = useState<any>({ tola: { isLoading: true } });
  const [silverData, setSilverData] = useState<any>({ ounce: { isLoading: true } });
  const [oilData, setOilData] = useState<any>(null);
  const [forexData, setForexData] = useState<any[]>([]);
  const [cryptoData, setCryptoData] = useState<any[]>([]);
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [psxStocks, setPsxStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulseData, setPulseData] = useState<any[]>([]);
  const [pulseTF, setPulseTF] = useState("1H");
  const { settings } = useSettings();
  const displayCurrency = settings.currency as 'USD' | 'PKR';
  const router = useRouter();

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        const [gold, silver, forex, crypto, wlRes, psxRes, oil] = await Promise.all([
          fetchGoldPrice(),
          fetchSilverPrice(),
          fetchForexRates(),
          fetchCryptoPrices(),
          fetch('/api/watchlists').then(res => res.json()).catch(() => ({ success: false, data: [] })),
          fetch('/api/psx-stocks').then(res => res.json()).catch(err => {
            console.error('PSX API Error:', err);
            return { data: [] };
          }),
          fetchOilPrices()
        ]);

        if (gold) setGoldData(gold);
        if (silver) setSilverData(silver);
        if (forex) setForexData(forex);
        if (crypto) setCryptoData(crypto);
        if (oil) setOilData(oil);
        if (wlRes.success) setWatchlists(wlRes.data);

        console.log('PSX Response:', psxRes);
        // PSX API returns { data: stocks[], indices, stats, timestamp }
        if (psxRes && psxRes.data && Array.isArray(psxRes.data) && psxRes.data.length > 0) {
          // Get top 4 stocks by volume (Most Active)
          const topStocks = psxRes.data
            .filter((stock: any) => stock && stock.symbol && stock.volume !== undefined)
            .sort((a: any, b: any) => (Number(b.volume) || 0) - (Number(a.volume) || 0))
            .slice(0, 4);
          console.log('Most Active PSX Stocks:', topStocks);
          setPsxStocks(topStocks);
        } else {
          console.warn('No PSX data available or invalid format', psxRes);
          setPsxStocks([]);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        setPsxStocks([]);
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
    const interval = setInterval(loadAllData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Generate pulse data based on Gold as proxy for market
    const basePrice = displayCurrency === 'PKR' ? (goldData.tola24k?.pkrPrice || 250000) : (goldData.tola24k?.usdPrice || 2300);
    const data = [];
    const count = 60;
    const nowSec = Math.floor(Date.now() / 1000);
    const interval = pulseTF === '1H' ? 3600 : 86400;

    let lastClose = basePrice;
    const volatility = pulseTF === '1H' ? 0.005 : 0.012;

    for (let i = 0; i < count; i++) {
        const time = nowSec - i * interval;
        const change = (Math.random() - 0.5) * volatility;
        
        const close = lastClose;
        const open = close / (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.3));
        const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.3));

        data.unshift({ 
          time, 
          open: parseFloat(open.toFixed(2)), 
          high: parseFloat(high.toFixed(2)), 
          low: parseFloat(low.toFixed(2)), 
          close: parseFloat(close.toFixed(2)),
          volume: Math.floor(Math.random() * 20000) + 5000
        });
        lastClose = open;
    }
    setPulseData(data);
  }, [goldData, displayCurrency, pulseTF]);

  const handleAddToWatchlist = async (watchlistId: string, symbol: string) => {
    const watchlist = watchlists.find(wl => wl._id === watchlistId);
    if (!watchlist || !symbol) return;
    const currentSymbols = watchlist.symbols || [];
    if (currentSymbols.includes(symbol.toUpperCase())) return;
    const newSymbols = [...currentSymbols, symbol.toUpperCase()];

    try {
      const res = await fetch(`/api/watchlists/${watchlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: newSymbols }),
      });
      const json = await res.json();
      if (json.success) {
        setWatchlists(watchlists.map(wl => wl._id === watchlistId ? json.data : wl));
      }
    } catch (err) {
      console.error('Failed to add symbol to watchlist', err);
    }
  };

  const handleRemoveFromWatchlist = async (watchlistId: string, symbol: string) => {
    const watchlist = watchlists.find(wl => wl._id === watchlistId);
    if (!watchlist || !symbol) return;
    const currentSymbols = watchlist.symbols || [];
    const newSymbols = currentSymbols.filter((s: string) => s !== symbol.toUpperCase());

    try {
      const res = await fetch(`/api/watchlists/${watchlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: newSymbols }),
      });
      const json = await res.json();
      if (json.success) {
        setWatchlists(watchlists.map(wl => wl._id === watchlistId ? json.data : wl));
      }
    } catch (err) {
      console.error('Failed to remove symbol from watchlist', err);
    }
  };



  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-3 sm:py-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tighter italic uppercase text-zinc-900 dark:text-white leading-none">
              Terminal <span className="text-blue-500 text-lg sm:text-2xl">Live</span>
            </h1>
            <p className="text-zinc-500 dark:text-zinc-500 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] mt-1 sm:mt-2">Intelligence Engine</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-zinc-100 dark:bg-white/5 rounded-full border border-zinc-200 dark:border-white/10">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto p-4 sm:p-8 relative z-10">

        <section className="mb-8 sm:mb-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12">
            <StatCard label="Bitcoin / USD" value={`$${cryptoData[0]?.usdPrice?.toLocaleString() || "---"}`} icon="₿" change={cryptoData[0]?.changePercent || 0} changeLabel="Volatility" />
            <StatCard label="USD / PKR" value={`Rs. ${forexData[0]?.pkrPrice?.toFixed(2) || "---"}`} icon="💵" change={forexData[0]?.changePercent || 0} changeLabel="Forex" />
            <StatCard label="Gold (Tola)" value={`Rs. ${goldData.tola24k?.pkrPrice?.toLocaleString() || "---"}`} icon="💎" change={goldData.tola24k?.changePercent || 0} changeLabel="Metal" />
            <StatCard label="Silver (Oz)" value={`Rs. ${silverData.ounce?.pkrPrice?.toLocaleString() || "---"}`} icon="🪙" change={silverData.ounce?.changePercent || 0} changeLabel="Commodity" />
          </div>
        </section>

        {/* PSX Stocks Section - Full Width Priority */}
        <section className="mb-8 sm:mb-12">
          <div className="flex items-end justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none">🔥 Most Active</h2>
              <p className="text-zinc-500 text-[10px] sm:text-sm mt-1">High volume scrips on PSX</p>
            </div>
            <a href="/stocks" className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">All Scrips →</a>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {!psxStocks || psxStocks.length === 0 ? (
              // Skeleton loading cards only show when actually loading or no data
              Array.from({ length: 4 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-200 dark:border-zinc-800 animate-pulse">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-16"></div>
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-24"></div>
                    </div>
                    <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-12"></div>
                  </div>
                  <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-20 mb-2"></div>
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
                </div>
              ))
            ) : (
              psxStocks.map((stock: any) => (
                stock && stock.symbol ? (
                  <StockCard
                    key={stock.symbol}
                    {...stock}
                    onClick={() => router.push(`/stocks/${stock.symbol.toLowerCase()}`)}
                    watchlists={watchlists}
                    onAddToWatchlist={handleAddToWatchlist}
                    onRemoveFromWatchlist={handleRemoveFromWatchlist}
                    onWatchlistCreated={(newList) => setWatchlists([newList, ...watchlists])}
                  />
                ) : null
              ))
            )}
          </div>
        </section>

        {/* Balanced Market Rows */}
        <div className="space-y-12">
          {/* Row 1: Metals & Forex */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            {/* Precious Metals Section */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter">💎 Commodity Spot Rates</h2>
                <a href="/metals" className="text-xs font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">View Warehouse →</a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <PriceCard title="Gold (24K) - Tola" {...goldData.tola24k} lastUpdated={new Date().toLocaleTimeString()} isLoading={loading} />
                <PriceCard title="Silver - per Ounce" {...silverData.ounce} lastUpdated={new Date().toLocaleTimeString()} isLoading={loading} />
              </div>
            </div>

            {/* Forex Section */}
            <div>
              <div className="flex items-end justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none">💱 Global Exchange</h2>
                <a href="/forex" className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">More →</a>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-900/40 backdrop-blur-sm rounded-[1.5rem] sm:rounded-[3rem] border border-zinc-200 dark:border-white/5 overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-white/5 text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                        <th className="px-4 sm:px-8 py-3 sm:py-5">Currency</th>
                        <th className="px-4 sm:px-8 py-3 sm:py-5 text-right">Rate</th>
                        <th className="px-4 sm:px-8 py-3 sm:py-5 text-center">∆%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                    {forexData.slice(1, 5).map(rate => (
                      <tr key={rate.code} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 sm:px-8 py-3 sm:py-4 font-black text-zinc-900 dark:text-white tracking-tight uppercase italic text-[10px] sm:text-sm whitespace-nowrap">{rate.code} / {rate.name}</td>
                        <td className="px-4 sm:px-8 py-3 sm:py-4 text-right font-mono font-black text-blue-600 dark:text-blue-400 text-[10px] sm:text-base">Rs.{rate.pkrPrice.toFixed(2)}</td>
                        <td className={`px-4 sm:px-8 py-3 sm:py-4 text-center text-[8px] sm:text-[10px] font-black ${rate.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {rate.changePercent >= 0 ? '▲' : '▼'}{Math.abs(rate.changePercent).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

          {/* Row 2: Energy & Crypto */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            {/* Oil & Energy Section */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter">🛢️ Energy Intelligence</h2>
                <a href="/oil" className="text-xs font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">View Refinery →</a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div onClick={() => router.push('/oil/crudeOil')} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-95">
                  <PriceCard title="Crude Oil (WTI)" {...oilData?.crudeOil} lastUpdated={new Date().toLocaleTimeString()} isLoading={loading} currency="USD" />
                </div>
                <div onClick={() => router.push('/oil/brentOil')} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-95">
                  <PriceCard title="Brent Crude" {...oilData?.brentOil} lastUpdated={new Date().toLocaleTimeString()} isLoading={loading} currency="USD" />
                </div>
              </div>
            </div>

            {/* Crypto pulse */}
            <div className="bg-zinc-100 dark:bg-zinc-900/40 backdrop-blur-sm rounded-[1.5rem] sm:rounded-[3rem] p-4 sm:p-8 border border-zinc-200 dark:border-white/5">
              <div className="flex items-end justify-between mb-4 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none">₿ Crypto Hub</h2>
                <span className="text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest italic hidden sm:block">Real-Time</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                {cryptoData.slice(0, 2).map(coin => (
                  <div key={coin.id} className="bg-white dark:bg-white/5 hover:bg-zinc-50 dark:hover:bg-white/[0.08] p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 transition-all group cursor-pointer overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 sm:mb-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-orange-500/10 flex items-center justify-center font-black text-orange-500 text-xs sm:text-base">
                          {coin.symbol[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-zinc-900 dark:text-white uppercase text-[10px] sm:text-sm tracking-tight truncate">{coin.name}</p>
                        </div>
                      </div>
                      <div className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-black ${coin.changePercent >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {coin.changePercent >= 0 ? '+' : ''}{coin.changePercent.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-lg sm:text-3xl font-black text-zinc-900 dark:text-white font-mono tracking-tighter group-hover:translate-x-1 transition-transform italic">${coin.usdPrice?.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tactical Call to Action */}
        <div className="mt-12 sm:mt-20 relative rounded-[2rem] sm:rounded-[4rem] p-8 sm:p-12 sm:p-20 overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-800 transition-transform duration-700 group-hover:scale-105"></div>
          <div className="absolute top-0 right-0 w-[50%] h-full bg-black/20 skew-x-[30deg] translate-x-32 hidden lg:block"></div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <h3 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter italic uppercase mb-6 leading-none">
              Strategic Market <br /> Intelligence
            </h3>
            <p className="text-blue-100 text-sm sm:text-xl font-medium max-w-2xl mb-10">
              Leverage real-time technical analysis and personalized watchlists to stay ahead of market shifts. Your portal to high-precision trading.
            </p>
            <div className="flex flex-wrap items-center gap-4 justify-center">
              <a href="/stocks/terminal" className="bg-white text-blue-600 px-8 py-4 sm:px-12 sm:py-6 rounded-2xl sm:rounded-3xl font-black uppercase text-[10px] sm:text-xs tracking-[0.2em] hover:bg-zinc-100 hover:scale-105 active:scale-95 transition-all shadow-2xl">Terminal Access</a>
              <a href="/stocks" className="bg-black/20 backdrop-blur-md text-white border border-white/20 px-8 py-4 sm:px-12 sm:py-6 rounded-2xl sm:rounded-3xl font-black uppercase text-[10px] sm:text-xs tracking-[0.2em] hover:bg-white/10 hover:scale-105 active:scale-95 transition-all">Market Explorer</a>
            </div>
          </div>
        </div>

      </main>

      <footer className="mt-20 border-t border-white/5 py-12 px-8">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">© 2026 Terminal Intelligence Engine. All Rights Reserved.</p>
          <div className="flex gap-8 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Risk Disclosure</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Data Integrity</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
