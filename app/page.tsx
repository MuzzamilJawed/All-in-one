"use client";

import StatCard from "./components/StatCard";
import PriceCard from "./components/PriceCard";
import MoversDigest from "./components/MoversDigest";
import WatchlistAlerts from "./components/WatchlistAlerts";
import PageSkeleton from "./components/PageSkeleton";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchGoldPrice, fetchSilverPrice, fetchForexRates, fetchCryptoPrices, fetchOilPrices } from "./lib/api";

export default function Home() {
  const [goldData, setGoldData] = useState<any>({ tola: { isLoading: true } });
  const [silverData, setSilverData] = useState<any>({ ounce: { isLoading: true } });
  const [oilData, setOilData] = useState<any>(null);
  const [forexData, setForexData] = useState<any[]>([]);
  const [cryptoData, setCryptoData] = useState<any[]>([]);
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [psxStocks, setPsxStocks] = useState<any[]>([]);
  const [psxIndices, setPsxIndices] = useState<any[]>([]);
  const [marketStats, setMarketStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
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

        // PSX API returns { data: stocks[], indices, stats, timestamp }
        if (psxRes && psxRes.data && Array.isArray(psxRes.data) && psxRes.data.length > 0) {
          // Keep the full universe; MoversDigest derives gainers/losers/active/watchlist
          const allStocks = psxRes.data.filter((stock: any) => stock && stock.symbol);
          setPsxStocks(allStocks);
        } else {
          console.warn('No PSX data available or invalid format', psxRes);
          setPsxStocks([]);
        }
        setPsxIndices(Array.isArray(psxRes?.indices) ? psxRes.indices : []);
        setMarketStats(psxRes?.stats && Object.keys(psxRes.stats).length > 0 ? psxRes.stats : null);
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
    setCurrentTime(new Date().toLocaleTimeString());
    const clockInterval = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 60000);
    return () => clearInterval(clockInterval);
  }, []);

  if (loading && psxStocks.length === 0 && forexData.length === 0) return <PageSkeleton variant="dashboard" />;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
        <div className="max-w-[1600px] mx-auto pl-16 pr-4 sm:pr-8 lg:pl-8 py-3 sm:py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
              <span className="text-white font-black text-xl sm:text-2xl italic leading-none">α</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-black tracking-tighter italic uppercase text-zinc-900 dark:text-white leading-none">
                Alpha<span className="text-blue-500">Bazaar</span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-500 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] mt-1 sm:mt-2">Markets &amp; Analysis</p>
            </div>
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


        {/* Today's Movers Digest - Full Width Priority */}
        <section className="mb-8 sm:mb-12">
          <div className="flex items-end justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none">📊 PSX Today&apos;s Movers</h2>
              <p className="text-zinc-500 text-[10px] sm:text-sm mt-1">Gainers, losers &amp; high-volume scrips at a glance</p>
            </div>
            <a href="/stocks" className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">All Stocks →</a>
          </div>
          {/* PSX Market Pulse: index ticker + breadth */}
          {(psxIndices.length > 0 || marketStats) && (
            <section className="mb-8 sm:mb-12">
              <div className="bg-white dark:bg-zinc-900/40 backdrop-blur-sm rounded-[1.5rem] sm:rounded-[2rem] border border-zinc-200 dark:border-white/5 overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  {/* Index ticker */}
                  <div className="flex-1 min-w-0 flex items-center gap-4 sm:gap-8 px-4 sm:px-6 py-4 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 shrink-0 border-r border-zinc-200 dark:border-white/10 pr-4 sm:pr-6">
                      <span className={`w-2 h-2 rounded-full ${marketStats?.status?.toLowerCase().includes('open') ? 'bg-green-500 animate-pulse' : 'bg-blue-600 animate-pulse'}`}></span>
                      <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest italic whitespace-nowrap">PSX Pulse</span>
                    </div>
                    {psxIndices.length === 0 && <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Loading indices…</span>}
                    {psxIndices.map((idx: any) => {
                      const isPos = (idx.change || 0) >= 0;
                      return (
                        <a key={idx.name} href={`/stocks?idx=${encodeURIComponent(idx.name)}`} className="flex items-center gap-2 shrink-0 group">
                          <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 transition-colors">{idx.name}</span>
                          <span className="text-xs font-mono font-black text-zinc-900 dark:text-zinc-50">{Number(idx.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          <span className={`text-[10px] font-bold ${isPos ? 'text-green-600' : 'text-red-600'}`}>{isPos ? '▲' : '▼'}{Math.abs(idx.changePercent || 0).toFixed(2)}%</span>
                        </a>
                      );
                    })}
                  </div>
                  {/* Breadth chips */}
                  {marketStats && (
                    <div className="flex items-center gap-2 px-4 sm:px-6 py-4 border-t lg:border-t-0 lg:border-l border-zinc-100 dark:border-white/5 shrink-0">
                      <div className="text-center px-2">
                        <p className="text-[8px] font-black text-green-600/80 uppercase tracking-widest">Adv</p>
                        <p className="text-sm font-black text-green-600 leading-none">{marketStats.advanced}</p>
                      </div>
                      <div className="text-center px-2">
                        <p className="text-[8px] font-black text-red-600/80 uppercase tracking-widest">Dec</p>
                        <p className="text-sm font-black text-red-600 leading-none">{marketStats.declined}</p>
                      </div>
                      <div className="text-center px-2">
                        <p className="text-[8px] font-black text-blue-600/80 uppercase tracking-widest">Unch</p>
                        <p className="text-sm font-black text-blue-600 leading-none">{marketStats.unchanged}</p>
                      </div>
                      <div className="hidden sm:block text-center px-2 border-l border-zinc-100 dark:border-white/5 ml-1 pl-3">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Value</p>
                        <p className="text-xs font-black text-zinc-900 dark:text-zinc-50 font-mono leading-none">{marketStats.value}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
          <MoversDigest
            stocks={psxStocks}
            watchlists={watchlists}
            loading={loading && (!psxStocks || psxStocks.length === 0)}
            onSelect={(symbol) => router.push(`/stocks/${symbol.toLowerCase()}`)}
          />
        </section>

        {/* Watchlist & Alerts */}
        <section className="mb-8 sm:mb-12">
          <div className="flex items-end justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none">⭐ Your Watchlist</h2>
              <p className="text-zinc-500 text-[10px] sm:text-sm mt-1">Tracked scrips with target &amp; circuit alerts</p>
            </div>
            <a href="/watchlist" className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">Manage →</a>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <WatchlistAlerts
              stocks={psxStocks}
              watchlists={watchlists}
              onSelect={(symbol) => router.push(`/stocks/${symbol.toLowerCase()}`)}
            />
            <div className="hidden xl:flex bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 flex-col justify-center text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-10 translate-x-10"></div>
              <h3 className="text-lg sm:text-2xl font-black italic uppercase tracking-tighter leading-tight relative z-10">Set price targets &amp; catch circuit locks</h3>
              <p className="text-blue-100 text-xs sm:text-sm font-medium mt-2 mb-5 relative z-10 max-w-md">Open any scrip in Market Explorer, tap 🎯 to set a target, and it will flag here the moment it hits — plus upper/lower circuit and big-move alerts.</p>
              <a href="/stocks" className="relative z-10 inline-block w-fit bg-white text-blue-600 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-100 transition-all">Open Market Explorer</a>
            </div>
          </div>
        </section>

        {/* Balanced Market Rows */}
        <div className="space-y-8 sm:space-y-12">
          {/* Row 1: Metals & Forex */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-12">
            {/* Precious Metals Section */}
            <div className="flex flex-col">
              <div className="flex items-end justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter">💎 Commodity Spot Rates</h2>
                <a href="/metals" className="shrink-0 text-xs font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">View Warehouse →</a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1 xl:auto-rows-fr">
                <PriceCard title="Gold (24K) - Tola" usdPrice={goldData.tola24k?.usdPrice} pkrPrice={goldData.tola24k?.pkrPrice} change={goldData.tola24k?.change} changePercent={goldData.tola24k?.changePercent} error={goldData.tola24k?.error} lastUpdated={currentTime} isLoading={loading} />
                <PriceCard title="Silver - per Ounce" usdPrice={silverData.ounce?.usdPrice} pkrPrice={silverData.ounce?.pkrPrice} change={silverData.ounce?.change} changePercent={silverData.ounce?.changePercent} error={silverData.ounce?.error} lastUpdated={currentTime} isLoading={loading} />
              </div>
            </div>

            {/* Forex Section */}
            <div className="flex flex-col">
              <div className="flex items-end justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none">💱 Global Exchange</h2>
                <a href="/forex" className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">More →</a>
              </div>
              <div className="flex-1 flex flex-col bg-zinc-100 dark:bg-zinc-900/40 backdrop-blur-sm rounded-[1.5rem] sm:rounded-[3rem] border border-zinc-200 dark:border-white/5 overflow-hidden">
                <div className="flex-1 overflow-x-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-white/5 text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                        <th className="px-4 sm:px-8 py-3 sm:py-5">Currency</th>
                        <th className="px-4 sm:px-8 py-3 sm:py-5 text-right">Rate</th>
                        <th className="px-4 sm:px-8 py-3 sm:py-5 text-center">∆%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                      {["USD", "EUR", "GBP", "SAR", "AED"]
                        .map(code => forexData.find(r => r.code === code))
                        .filter(Boolean)
                        .map(rate => (
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-12">
            {/* Oil & Energy Section */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter">🛢️ Energy Intelligence</h2>
                <a href="/oil" className="shrink-0 text-xs font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">View Refinery →</a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div onClick={() => router.push('/oil/crudeOil')} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-95">
                  <PriceCard title="Crude Oil (WTI)" usdPrice={oilData?.crudeOil?.usdPrice} pkrPrice={oilData?.crudeOil?.pkrPrice} change={oilData?.crudeOil?.change} changePercent={oilData?.crudeOil?.changePercent} error={oilData?.crudeOil?.error} lastUpdated={currentTime} isLoading={loading} currency="USD" />
                </div>
                <div onClick={() => router.push('/oil/brentOil')} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-95">
                  <PriceCard title="Brent Crude" usdPrice={oilData?.brentOil?.usdPrice} pkrPrice={oilData?.brentOil?.pkrPrice} change={oilData?.brentOil?.change} changePercent={oilData?.brentOil?.changePercent} error={oilData?.brentOil?.error} lastUpdated={currentTime} isLoading={loading} currency="USD" />
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

              {/* Secondary coins — smaller cards below the two majors */}
              {cryptoData.length > 2 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-2 sm:mt-3">
                  {cryptoData.slice(2, 6).map(coin => (
                    <div key={coin.id} className="bg-white dark:bg-white/5 hover:bg-zinc-50 dark:hover:bg-white/[0.08] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-white/5 transition-all cursor-pointer overflow-hidden">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-black text-zinc-900 dark:text-white uppercase text-[10px] sm:text-xs tracking-tight truncate">{coin.symbol}</span>
                        <span className={`text-[8px] sm:text-[9px] font-black shrink-0 ${(coin.changePercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {(coin.changePercent ?? 0) >= 0 ? '+' : ''}{(coin.changePercent ?? 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-[11px] sm:text-sm font-black text-zinc-900 dark:text-white font-mono tracking-tighter truncate">${(coin.usdPrice ?? 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tactical Call to Action */}
        <div className="mt-12 sm:mt-20 relative rounded-[2rem] sm:rounded-[4rem] p-8 sm:p-12 lg:p-20 overflow-hidden group">
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

      <footer className="mt-20 border-t border-white/5 py-8 sm:py-12 px-4 sm:px-8">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest text-center md:text-left">© 2026 AlphaBazaar. All Rights Reserved.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Risk Disclosure</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Data Integrity</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
