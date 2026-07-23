"use client";

import StatCard from "./components/StatCard";
import { Bitcoin, Banknote, Gem, BarChart3, ArrowRightLeft, Fuel, Briefcase, Globe } from "lucide-react";
import PriceCard from "./components/PriceCard";
import MoversDigest from "./components/MoversDigest";
import WatchlistAlerts from "./components/WatchlistAlerts";
import PortfolioSummary from "./components/PortfolioSummary";
import PageSkeleton from "./components/PageSkeleton";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchGoldPrice, fetchSilverPrice, fetchForexRates, fetchCryptoPrices, fetchOilPrices } from "./lib/api";
import { useSettings } from "./context/SettingsContext";
import { isModuleEnabled } from "./lib/modules";

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
  const [nasdaqIdx, setNasdaqIdx] = useState<{ value: number | null; changePercent: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const router = useRouter();
  const { settings } = useSettings();
  const mod = (k: string) => isModuleEnabled(settings.modules, k);

  // Mobile: tabbed dashboard so each section ≈ one screen. Desktop (lg+) shows
  // everything in one scroll (the tab bar is hidden and every group is lg:block).
  type DashTab = "overview" | "psx" | "markets" | "watchlist";
  const [dashTab, setDashTab] = useState<DashTab>("overview");
  const dashTabs: { id: DashTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(mod("stocks") ? [{ id: "psx" as DashTab, label: "PSX" }] : []),
    ...(mod("metals") || mod("forex") || mod("oil") || mod("crypto") ? [{ id: "markets" as DashTab, label: "Markets" }] : []),
    ...(mod("watchlist") || mod("portfolio") ? [{ id: "watchlist" as DashTab, label: "Watchlist" }] : []),
  ];
  const tabCls = (id: DashTab) => `${dashTab === id ? "" : "hidden"} lg:block`;

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

        fetch('/api/nasdaq-index').then(r => r.json()).then(j => { if (j?.success) setNasdaqIdx({ value: j.value, changePercent: j.changePercent }); }).catch(() => { });

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
              <span className="text-white font-black text-xl sm:text-2xl italic leading-none">S</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-black tracking-tighter italic uppercase text-zinc-900 dark:text-white leading-none">
                Solo<span className="text-blue-500">Trackr</span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-500 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] mt-1 sm:mt-2">All Markets · One Place</p>
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

        {/* Mobile tab bar — one section per screen (hidden on desktop) */}
        <div className="lg:hidden -mt-1 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
          {dashTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setDashTab(t.id)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${dashTab === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-zinc-100 dark:bg-white/5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <section className={`mb-8 sm:mb-12 ${tabCls("overview")}`}>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-6">
            {mod('stocks') && (psxIndices.length > 0 || marketStats) && (() => {
              const kse = psxIndices.find((i: any) => /100/.test(i.name)) || psxIndices[0];
              const isPos = (kse?.change ?? 0) >= 0;
              return (
                <a href="/stocks" className="group bg-white dark:bg-zinc-900/50 backdrop-blur-xl rounded-3xl p-4 sm:p-6 border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                    </div>
                    {kse && (
                      <div className={`px-3 py-1 rounded-full text-xs font-black tracking-tighter ${isPos ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                        {isPos ? '↑' : '↓'} {Math.abs(kse?.changePercent ?? 0).toFixed(2)}%
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">PSX · {kse?.name || 'KSE'}</p>
                    <p className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter font-mono italic break-words">{kse ? Number(kse.value).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '---'}</p>
                    {marketStats ? (
                      <div className="mt-2 flex items-center gap-2.5 text-[10px] font-black tabular-nums">
                        <span className="text-green-600 dark:text-green-400">▲{marketStats.advanced}</span>
                        <span className="text-red-600 dark:text-red-400">▼{marketStats.declined}</span>
                        <span className="text-blue-600 dark:text-blue-400">={marketStats.unchanged}</span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-zinc-400 mt-2 flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-500"></span> PSX Pulse</p>
                    )}
                  </div>
                </a>
              );
            })()}
            {mod('crypto') && <StatCard label="Bitcoin / USD" value={`$${cryptoData[0]?.usdPrice?.toLocaleString() || "---"}`} icon={<Bitcoin className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />} change={cryptoData[0]?.changePercent || 0} changeLabel="Volatility" />}
            {mod('forex') && <StatCard label="USD / PKR" value={`Rs. ${forexData[0]?.pkrPrice?.toFixed(2) || "---"}`} icon={<Banknote className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />} change={forexData[0]?.changePercent || 0} changeLabel="Forex" />}
            {mod('metals') && (
              <a href="/metals" className="group bg-white dark:bg-zinc-900/50 backdrop-blur-xl rounded-3xl p-4 sm:p-6 border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 flex flex-col">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-110 transition-transform duration-300 mb-4">
                  <Gem className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                </div>
                <div className="grid grid-cols-2 divide-x divide-zinc-200/70 dark:divide-white/10 flex-1">
                  {[
                    { label: "Gold · Tola", price: goldData.tola24k?.pkrPrice, chg: goldData.tola24k?.changePercent ?? 0, pad: "pr-3 sm:pr-4" },
                    { label: "Silver · Oz", price: silverData.ounce?.pkrPrice, chg: silverData.ounce?.changePercent ?? 0, pad: "pl-3 sm:pl-4" },
                  ].map((m) => {
                    const up = (m.chg || 0) >= 0;
                    return (
                      <div key={m.label} className={`${m.pad} flex flex-col justify-center`}>
                        <p className="text-[8px] sm:text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.15em] mb-1.5 truncate">{m.label}</p>
                        <p className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-50 tracking-tighter font-mono italic leading-none truncate">Rs.{m.price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "---"}</p>
                        <p className={`mt-1.5 text-[10px] font-black ${up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{up ? "▲" : "▼"} {Math.abs(m.chg || 0).toFixed(2)}%</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] font-bold text-zinc-400 mt-3 flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-500"></span> Metals</p>
              </a>
            )}
            {mod('oil') && (
              <a href="/oil" className="block">
                <StatCard
                  label="Crude Oil · WTI"
                  value={oilData?.crudeOil?.price != null ? `$${Number(oilData.crudeOil.price).toFixed(2)}` : "---"}
                  icon={<Fuel className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />}
                  change={oilData?.crudeOil?.changePercent ?? 0}
                  changeLabel="Energy · Oil & Gas"
                />
              </a>
            )}
            {mod('nasdaq') && <StatCard label="NASDAQ · IXIC" value={nasdaqIdx?.value != null ? nasdaqIdx.value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "---"} icon={<Globe className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />} change={nasdaqIdx?.changePercent ?? 0} changeLabel="US Stock Index" />}
          </div>
        </section>


        {/* Today's Movers Digest - Full Width Priority */}
        {mod('stocks') && (
          <section className={`mb-8 sm:mb-12 ${tabCls("psx")}`}>
            <div className="flex items-end justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none flex items-center gap-2.5"><BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2} /> PSX Today&apos;s Movers</h2>
                <p className="text-zinc-500 text-[10px] sm:text-sm mt-1">Gainers, losers &amp; high-volume scrips at a glance</p>
              </div>
              <a href="/stocks" className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">All Stocks →</a>
            </div>
            <MoversDigest
              stocks={psxStocks}
              watchlists={watchlists}
              loading={loading && (!psxStocks || psxStocks.length === 0)}
              onSelect={(symbol) => router.push(`/stocks/${symbol.toLowerCase()}`)}
            />
          </section>
        )}

        {/* Balanced Market Rows */}
        <div className={`space-y-6 sm:space-y-12 ${tabCls("markets")}`}>
          {/* Row 1: Metals & Forex */}
          {(mod('metals') || mod('forex')) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-12">
              {/* Precious Metals Section */}
              {mod('metals') && (
                <div className="flex flex-col">
                  <div className="flex items-end justify-between mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter flex items-center gap-2.5"><Gem className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2} /> Commodity Spot Rates</h2>
                    <a href="/metals" className="shrink-0 text-xs font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">View Warehouse →</a>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-6 flex-1 xl:auto-rows-fr">
                    <PriceCard title="Gold (24K) - Tola" usdPrice={goldData.tola24k?.usdPrice} pkrPrice={goldData.tola24k?.pkrPrice} change={goldData.tola24k?.change} changePercent={goldData.tola24k?.changePercent} error={goldData.tola24k?.error} lastUpdated={currentTime} isLoading={loading} />
                    <PriceCard title="Silver - per Ounce" usdPrice={silverData.ounce?.usdPrice} pkrPrice={silverData.ounce?.pkrPrice} change={silverData.ounce?.change} changePercent={silverData.ounce?.changePercent} error={silverData.ounce?.error} lastUpdated={currentTime} isLoading={loading} />
                  </div>
                </div>

              )}

              {/* Forex Section */}
              {mod('forex') && (
                <div className="flex flex-col">
                  <div className="flex items-end justify-between mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none flex items-center gap-2.5"><ArrowRightLeft className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2} /> Global Exchange</h2>
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
              )}
            </div>
          )}

          {/* Row 2: Energy & Crypto */}
          {(mod('oil') || mod('crypto')) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-12">
              {/* Oil & Energy Section */}
              {mod('oil') && (
                <div>
                  <div className="flex items-end justify-between mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter flex items-center gap-2.5"><Fuel className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2} /> Energy Intelligence</h2>
                    <a href="/oil" className="shrink-0 text-xs font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border-b border-blue-500/0 hover:border-blue-500 transition-all">View Refinery →</a>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-6">
                    <div onClick={() => router.push('/oil/crudeOil')} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-95">
                      <PriceCard title="Crude Oil (WTI)" usdPrice={oilData?.crudeOil?.usdPrice} pkrPrice={oilData?.crudeOil?.pkrPrice} change={oilData?.crudeOil?.change} changePercent={oilData?.crudeOil?.changePercent} error={oilData?.crudeOil?.error} lastUpdated={currentTime} isLoading={loading} currency="USD" />
                    </div>
                    <div onClick={() => router.push('/oil/brentOil')} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-95">
                      <PriceCard title="Brent Crude" usdPrice={oilData?.brentOil?.usdPrice} pkrPrice={oilData?.brentOil?.pkrPrice} change={oilData?.brentOil?.change} changePercent={oilData?.brentOil?.changePercent} error={oilData?.brentOil?.error} lastUpdated={currentTime} isLoading={loading} currency="USD" />
                    </div>
                  </div>
                </div>

              )}

              {/* Crypto pulse */}
              {mod('crypto') && (
                <div className="bg-zinc-100 dark:bg-zinc-900/40 backdrop-blur-sm rounded-[1.5rem] sm:rounded-[3rem] p-4 sm:p-8 border border-zinc-200 dark:border-white/5">
                  <div className="flex items-end justify-between mb-4 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none flex items-center gap-2.5"><Bitcoin className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 shrink-0" strokeWidth={2} /> Crypto Hub</h2>
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
              )}
            </div>
          )}
        </div>

        {/* Watchlist & Portfolio */}
        {(mod('watchlist') || mod('portfolio')) && (
          <section className={`mt-8 sm:mb-12 ${tabCls("watchlist")}`}>
            <div className="mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter leading-none flex items-center gap-2.5"><Briefcase className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2} /> Watchlist &amp; Portfolio</h2>
              <p className="text-zinc-500 text-[10px] sm:text-sm mt-1">Your tracked scrips, alerts and live holdings at a glance</p>
            </div>
            <div className={`grid grid-cols-1 gap-6 ${mod('watchlist') && mod('portfolio') ? 'xl:grid-cols-2' : ''}`}>
              {mod('watchlist') && (
                <WatchlistAlerts
                  stocks={psxStocks}
                  watchlists={watchlists}
                  onSelect={(symbol) => router.push(`/stocks/${symbol.toLowerCase()}`)}
                />
              )}
              {mod('portfolio') && <PortfolioSummary />}
            </div>
          </section>
        )}

        {/* Tactical Call to Action (desktop only — keeps the mobile tabs clean) */}
        <div className="hidden lg:block mt-6 sm:mt-10 relative rounded-[2rem] sm:rounded-[4rem] p-8 sm:p-12 lg:p-20 overflow-hidden group">
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
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest text-center md:text-left">© 2026 SoloTrackr. All Rights Reserved.</p>
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
