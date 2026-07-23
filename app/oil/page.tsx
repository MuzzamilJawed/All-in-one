"use client";

import { Fuel, AlertTriangle, Award, TrendingDown, Search, Bell } from "lucide-react";

import PageSkeleton from "../components/PageSkeleton";

import PriceCard from "../components/PriceCard";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { fetchOilPrices } from "../lib/api";
import { type OilAlert, type AlertCondition, loadAlerts, persistAlerts, makeAlertId } from "../lib/oilAlerts";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type SortKey = "name" | "price" | "changePercent" | "weekly" | "monthly" | "yearly";

// Timeframe metrics for the cross-market comparison matrix
const COMPARE_METRICS: { key: 'changePercent' | 'weekly' | 'monthly' | 'yearly'; label: string }[] = [
  { key: 'changePercent', label: '24h' },
  { key: 'weekly', label: '7D' },
  { key: 'monthly', label: '30D' },
  { key: 'yearly', label: '52W' },
];

export default function OilPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [oilPrices, setOilPrices] = useState<any[]>([]);
  const [allEnergy, setAllEnergy] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendEnergy, setTrendEnergy] = useState("crudeOil");
  const [trendTimeframe, setTrendTimeframe] = useState("Daily");
  const { settings, updateSettings } = useSettings();
  const { success, info, error: toastError } = useToast();
  const tableCurrency = settings.currency as 'USD' | 'PKR';
  const router = useRouter();

  // Table controls
  const [tableSearch, setTableSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'changePercent', dir: 'desc' });

  // Cross-market comparison timeframe
  const [compareMetric, setCompareMetric] = useState<'changePercent' | 'weekly' | 'monthly' | 'yearly'>('changePercent');

  // Alerts
  const [alerts, setAlerts] = useState<OilAlert[]>([]);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertKey, setAlertKey] = useState("");
  const [alertCondition, setAlertCondition] = useState<AlertCondition>("above");
  const [alertPrice, setAlertPrice] = useState("");

  const stableTrendRef = useRef<Record<string, any[]>>({});

  const loadPrices = useCallback(async (isManual = true) => {
    try {
      if (isManual) setLoading(true);
      setError("");

      const data = await fetchOilPrices();

      if (!data) {
        if (isManual) setError("Could not fetch energy market data.");
        return;
      }

      const featuredKeys = ['crudeOil', 'brentOil', 'naturalGas', 'heatingOil'];
      const updatedPrices = featuredKeys.map(key => {
        const item = data[key];
        return {
          key,
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
  }, [trendEnergy, trendTimeframe, tableCurrency]);

  const openDetail = (item: any) => {
    router.push(`/oil/${item.key}`);
  };

  const formatPrice = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: val < 10 ? 4 : 2,
      maximumFractionDigits: val < 10 ? 4 : 2
    });
  };

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
  };

  useEffect(() => {
    loadPrices(true);
  }, [trendEnergy, trendTimeframe, tableCurrency]);

  useEffect(() => {
    if (!settings.refreshInterval || settings.refreshInterval <= 0) return;
    const interval = setInterval(() => loadPrices(false), settings.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [settings.refreshInterval, loadPrices]);

  // Load persisted alerts once on mount
  useEffect(() => {
    setAlerts(loadAlerts());
  }, []);

  // ─── Real market intelligence, derived from live feeds ──────────────────────
  const intel = useMemo(() => {
    const list = allEnergy.filter((i) => typeof i.changePercent === 'number');
    const total = list.length;
    const advancers = list.filter((i) => (i.changePercent || 0) > 0).length;
    const decliners = list.filter((i) => (i.changePercent || 0) < 0).length;
    const unchanged = total - advancers - decliners;
    const avg = total ? list.reduce((s, i) => s + (i.changePercent || 0), 0) / total : 0;
    const byChange = [...list].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
    const top = byChange[0];
    const bottom = byChange[byChange.length - 1];
    const volatile = [...list].sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))[0];
    return { total, advancers, decliners, unchanged, avg, top, bottom, volatile };
  }, [allEnergy]);

  // ─── Evaluate alerts against live prices; toast on newly triggered ──────────
  useEffect(() => {
    if (allEnergy.length === 0 || alerts.length === 0) return;
    const fired: string[] = [];
    let changed = false;
    const next = alerts.map((al) => {
      const item = allEnergy.find((i) => i.key === al.key);
      if (!item || typeof item.price !== 'number') return al;
      const hit = al.condition === 'above' ? item.price >= al.targetUsd : item.price <= al.targetUsd;
      if (hit !== al.triggered) {
        changed = true;
        if (hit) fired.push(`${al.name} moved ${al.condition} your target`);
        return { ...al, triggered: hit };
      }
      return al;
    });
    if (changed) {
      setAlerts(next);
      persistAlerts(next);
      fired.forEach((m) => success(`${m}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEnergy]);

  const rateFor = (key: string) => {
    const item = allEnergy.find((i) => i.key === key);
    if (item?.pkrPrice && item?.price) return item.pkrPrice / item.price;
    return 280;
  };

  const displayTarget = (al: OilAlert) => {
    const val = tableCurrency === 'PKR' ? al.targetUsd * rateFor(al.key) : al.targetUsd;
    return `${tableCurrency === 'PKR' ? 'Rs. ' : '$'}${formatPrice(val)}`;
  };

  const handleAddAlert = () => {
    const key = alertKey || allEnergy[0]?.key;
    const item = allEnergy.find((i) => i.key === key);
    const parsed = parseFloat(alertPrice.replace(/,/g, ""));
    if (!item || !Number.isFinite(parsed) || parsed <= 0) {
      toastError("Enter a valid target price");
      return;
    }
    const rate = item.pkrPrice && item.price ? item.pkrPrice / item.price : 280;
    const targetUsd = tableCurrency === 'PKR' ? parsed / rate : parsed;
    const triggered = alertCondition === 'above' ? item.price >= targetUsd : item.price <= targetUsd;
    const newAlert: OilAlert = {
      id: makeAlertId(),
      key,
      name: item.name,
      condition: alertCondition,
      targetUsd,
      createdAt: Date.now(),
      triggered,
    };
    const next = [newAlert, ...alerts];
    setAlerts(next);
    persistAlerts(next);
    success(`Alert set — ${item.name} ${alertCondition} ${tableCurrency === 'PKR' ? 'Rs. ' : '$'}${formatPrice(parsed)}`);
    setAlertPrice("");
    setShowAlertForm(false);
  };

  const handleRemoveAlert = (id: string) => {
    const removed = alerts.find((a) => a.id === id);
    const next = alerts.filter((a) => a.id !== id);
    setAlerts(next);
    persistAlerts(next);
    info(`Alert removed${removed ? ` — ${removed.name}` : ''}`);
  };

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  };

  // ─── Filtered + sorted table rows ───────────────────────────────────────────
  const visibleEnergy = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    let list = allEnergy.filter((i) => !q || (i.name || '').toLowerCase().includes(q) || (i.key || '').toLowerCase().includes(q));
    const dir = sort.dir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sort.key === 'name') return (a.name || '').localeCompare(b.name || '') * dir;
      const av = sort.key === 'price' ? (a.price || 0) : (a[sort.key] || 0);
      const bv = sort.key === 'price' ? (b.price || 0) : (b[sort.key] || 0);
      return (av - bv) * dir;
    });
    return list;
  }, [allEnergy, tableSearch, sort]);

  const maxAbsChange = useMemo(
    () => Math.max(1, ...allEnergy.map((i) => Math.abs(i.changePercent || 0))),
    [allEnergy]
  );

  // Cross-market comparison: every contract ranked by the selected timeframe
  const comparison = useMemo(() => {
    const rows = allEnergy
      .map((i) => ({ key: i.key, name: i.name, value: Number(i[compareMetric] ?? 0) }))
      .sort((a, b) => b.value - a.value);
    const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
    return { rows, maxAbs };
  }, [allEnergy, compareMetric]);

  const activeName = allEnergy.find(i => i.key === trendEnergy)?.name || 'Markets';

  if (loading && oilPrices.length === 0) return <PageSkeleton variant="cards" />;

  const SortArrow = ({ k }: { k: SortKey }) => (
    <span className={`ml-1 text-[8px] ${sort.key === k ? 'text-blue-500' : 'text-zinc-300 dark:text-zinc-600'}`}>
      {sort.key === k ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-blue-500/30 overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm w-full">
        <div className="pl-16 pr-4 sm:pr-8 lg:pl-8 py-4 sm:py-6 max-w-[1600px] mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
            <div>
              <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2 tracking-tighter uppercase italic">
                <Fuel className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2} /> Energy Markets
                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">
                  Live
                </span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1 sm:mt-2 flex items-center gap-2">
                <span className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${loading ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`}></span>
                {loading ? "Synchronizing satellite Feeds..." : `Terminal Active - ${new Date().toLocaleTimeString()}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 pb-32 max-w-[1600px] mx-auto w-full space-y-6 sm:space-y-12">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" strokeWidth={2} />
            <p className="text-red-500 font-black uppercase text-xs tracking-widest">{error}</p>
          </div>
        )}

        {/* ── Market Breadth strip (real, computed) ── */}
        {intel.total > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Session Bias</p>
              <p className={`text-2xl sm:text-3xl font-black italic tracking-tighter ${intel.avg >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {intel.avg >= 0 ? '+' : ''}{intel.avg.toFixed(2)}%
              </p>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Avg across {intel.total} feeds</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Breadth</p>
              <div className="flex items-end gap-2">
                <span className="text-xl sm:text-2xl font-black text-green-500 tabular-nums">{intel.advancers}</span>
                <span className="text-zinc-400 text-xs font-black mb-0.5">/</span>
                <span className="text-xl sm:text-2xl font-black text-red-500 tabular-nums">{intel.decliners}</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex">
                <div className="h-full bg-green-500" style={{ width: `${(intel.advancers / intel.total) * 100}%` }} />
                <div className="h-full bg-zinc-300 dark:bg-zinc-600" style={{ width: `${(intel.unchanged / intel.total) * 100}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${(intel.decliners / intel.total) * 100}%` }} />
              </div>
            </div>
            {intel.top && (
              <button onClick={() => openDetail(intel.top)} className="text-left bg-green-500/[0.06] rounded-2xl sm:rounded-[2rem] border border-green-500/15 p-4 sm:p-6 shadow-sm hover:bg-green-500/10 transition-colors">
                <p className="text-[9px] font-black text-green-600/70 dark:text-green-400/70 uppercase tracking-[0.2em] mb-2 inline-flex items-center gap-1.5"><Award className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> Top Gainer</p>
                <p className="text-base sm:text-lg font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter truncate">{intel.top.name}</p>
                <p className="text-sm font-black text-green-500 font-mono mt-0.5">+{Math.abs(intel.top.changePercent || 0).toFixed(2)}%</p>
              </button>
            )}
            {intel.bottom && (
              <button onClick={() => openDetail(intel.bottom)} className="text-left bg-red-500/[0.05] rounded-2xl sm:rounded-[2rem] border border-red-500/15 p-4 sm:p-6 shadow-sm hover:bg-red-500/10 transition-colors">
                <p className="text-[9px] font-black text-red-600/70 dark:text-red-400/70 uppercase tracking-[0.2em] mb-2 inline-flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> Top Loser</p>
                <p className="text-base sm:text-lg font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter truncate">{intel.bottom.name}</p>
                <p className="text-sm font-black text-red-500 font-mono mt-0.5">{(intel.bottom.changePercent || 0).toFixed(2)}%</p>
              </button>
            )}
          </div>
        )}

        {/* Price Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
          {oilPrices.map((oil) => (
            <div key={oil.title} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-95" onClick={() => {
              const fullItem = allEnergy.find(i => i.name === oil.title);
              if (fullItem) openDetail(fullItem);
            }}>
              <PriceCard {...oil} currency={tableCurrency} />
            </div>
          ))}
        </div>

        {/* Detailed Energy Table Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-[1.5rem] sm:rounded-[3rem] shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-5 sm:p-8 border-b border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Energy Contracts Feed</h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Satellite Comparison Benchmark</p>
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5" strokeWidth={2} />
                <input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search contract..."
                  className="w-full lg:w-56 bg-zinc-100 dark:bg-zinc-800 rounded-xl pl-8 pr-3 py-2.5 text-[11px] font-bold text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="text-[10px] font-black text-blue-500 border border-blue-500/20 px-4 py-2.5 rounded-xl uppercase tracking-widest bg-blue-500/5 whitespace-nowrap">
                {visibleEnergy.length}/{allEnergy.length} Feeds
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/5 text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em] bg-zinc-50/50 dark:bg-white/5">
                  <th className="px-4 sm:px-8 py-3 sm:py-5 cursor-pointer select-none hover:text-blue-500 transition-colors" onClick={() => toggleSort('name')}>Scrip<SortArrow k="name" /></th>
                  <th className="px-4 sm:px-8 py-3 sm:py-5 text-right cursor-pointer select-none hover:text-blue-500 transition-colors" onClick={() => toggleSort('price')}>Price<SortArrow k="price" /></th>
                  <th className="px-4 sm:px-8 py-3 sm:py-5 text-right cursor-pointer select-none hover:text-blue-500 transition-colors" onClick={() => toggleSort('changePercent')}>24h%<SortArrow k="changePercent" /></th>
                  <th className="px-4 sm:px-8 py-3 sm:py-5 text-center hidden sm:table-cell cursor-pointer select-none hover:text-blue-500 transition-colors" onClick={() => toggleSort('weekly')}>Weekly<SortArrow k="weekly" /></th>
                  <th className="px-4 sm:px-8 py-3 sm:py-5 text-center hidden sm:table-cell cursor-pointer select-none hover:text-blue-500 transition-colors" onClick={() => toggleSort('monthly')}>Monthly<SortArrow k="monthly" /></th>
                  <th className="px-4 sm:px-8 py-3 sm:py-5 text-center hidden md:table-cell cursor-pointer select-none hover:text-blue-500 transition-colors" onClick={() => toggleSort('yearly')}>YoY<SortArrow k="yearly" /></th>
                  <th className="px-4 sm:px-8 py-3 sm:py-5 text-right hidden lg:table-cell">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                {visibleEnergy.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-16 text-center">
                      <p className="text-zinc-400 font-black uppercase tracking-widest text-[11px]">No contracts match "{tableSearch}"</p>
                    </td>
                  </tr>
                ) : visibleEnergy.map((item) => {
                  const isPos = (item.changePercent || 0) >= 0;
                  const barPct = Math.min(100, (Math.abs(item.changePercent || 0) / maxAbsChange) * 100);
                  return (
                    <tr key={item.key} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => openDetail(item)}>
                      <td className="px-4 sm:px-8 py-3 sm:py-5">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${item.change >= 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                          <span className="font-black text-zinc-900 dark:text-white tracking-tight uppercase italic text-[10px] sm:text-sm">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-8 py-3 sm:py-5 text-right font-mono font-black text-zinc-900 dark:text-zinc-400 group-hover:text-blue-500 text-[10px] sm:text-sm">
                        {tableCurrency === 'PKR' ? 'Rs. ' : '$'}
                        {formatPrice(tableCurrency === 'PKR' ? item.pkrPrice : item.price)}
                      </td>
                      <td className="px-4 sm:px-8 py-3 sm:py-5">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] sm:text-xs font-black ${isPos ? 'text-green-500' : 'text-red-500'}`}>
                            {isPos ? '▲' : '▼'}{Math.abs(item.changePercent).toFixed(1)}%
                          </span>
                          <div className="w-16 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden hidden sm:block">
                            <div className={`h-full rounded-full ${isPos ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 sm:px-8 py-3 sm:py-5 text-center text-[10px] sm:text-xs font-bold hidden sm:table-cell ${item.weekly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.weekly > 0 ? '+' : ''}{item.weekly}%
                      </td>
                      <td className={`px-4 sm:px-8 py-3 sm:py-5 text-center text-[10px] sm:text-xs font-bold hidden sm:table-cell ${item.monthly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.monthly > 0 ? '+' : ''}{item.monthly}%
                      </td>
                      <td className={`px-4 sm:px-8 py-3 sm:py-5 text-center text-[10px] sm:text-xs font-bold hidden md:table-cell ${(item.yearly || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(item.yearly || 0) > 0 ? '+' : ''}{item.yearly || 0}%
                      </td>
                      <td className="px-4 sm:px-8 py-3 sm:py-5 text-right text-[10px] font-black text-zinc-500 uppercase tracking-widest hidden lg:table-cell">
                        {item.date || 'Live'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-12">
          {/* Trend Chart */}
          <div className="xl:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-[3rem] shadow-sm p-5 sm:p-10 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2"></div>

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 sm:mb-10 gap-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Market Momentum</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Velocity Trace: <span className="text-blue-500">{activeName}</span></p>
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
                <select
                  value={trendEnergy}
                  onChange={(e) => setTrendEnergy(e.target.value)}
                  className="flex-1 sm:flex-none bg-zinc-100 dark:bg-zinc-800/50 rounded-xl px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest border-none outline-none focus:ring-1 focus:ring-blue-500 transition-all dark:text-zinc-300"
                >
                  {allEnergy.map(item => (
                    <option key={item.key} value={item.key}>{item.name}</option>
                  ))}
                </select>

                <div className="flex bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-1">
                  {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTrendTimeframe(tf)}
                      className={`px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all uppercase tracking-widest ${trendTimeframe === tf ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[360px] sm:h-[400px] w-full">
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
                    tickFormatter={(v) => tableCurrency === 'PKR' ? `Rs.${(v / 1000).toFixed(1)}k` : `$${v}`}
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
            {/* Real market intelligence */}
            <div className="bg-zinc-900 text-white rounded-2xl sm:rounded-[3rem] p-5 sm:p-10 relative overflow-hidden border border-white/5">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/20 to-transparent pointer-events-none"></div>
              <h3 className="relative z-10 text-xl font-black uppercase italic tracking-tighter mb-6">Market Intelligence</h3>
              <div className="relative z-10 space-y-5">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Active Feeds</span>
                  <span className="font-mono font-black">{intel.total}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Advancing</span>
                  <span className="font-mono font-black text-green-500">{intel.advancers} ▲</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Declining</span>
                  <span className="font-mono font-black text-red-500">{intel.decliners} ▼</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Avg 24h Move</span>
                  <span className={`font-mono font-black ${intel.avg >= 0 ? 'text-green-500' : 'text-red-500'}`}>{intel.avg >= 0 ? '+' : ''}{intel.avg.toFixed(2)}%</span>
                </div>
                {intel.volatile && (
                  <div className="pt-2">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Most Volatile</p>
                    <div className="flex items-center justify-between">
                      <span className="font-black uppercase italic text-sm tracking-tight">{intel.volatile.name}</span>
                      <span className={`font-mono font-black text-sm ${(intel.volatile.changePercent || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(intel.volatile.changePercent || 0) >= 0 ? '+' : ''}{(intel.volatile.changePercent || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Functional Price Alerts */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-[3rem] p-5 sm:p-8 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter dark:text-white">Price Alerts</h3>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">
                    {alerts.length > 0 ? `${alerts.filter(a => a.triggered).length} triggered · ${alerts.length} total` : 'Track your entry levels'}
                  </p>
                </div>
                <button
                  onClick={() => { setShowAlertForm((v) => !v); setAlertKey(allEnergy[0]?.key || ''); }}
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all ${showAlertForm ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'}`}
                >
                  {showAlertForm ? 'Close' : '＋ New'}
                </button>
              </div>

              {showAlertForm && (
                <div className="mb-5 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-white/5 space-y-3">
                  <select
                    value={alertKey || allEnergy[0]?.key || ''}
                    onChange={(e) => setAlertKey(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 dark:text-zinc-200"
                  >
                    {allEnergy.map((i) => (<option key={i.key} value={i.key}>{i.name}</option>))}
                  </select>
                  <div className="flex gap-2">
                    <div className="flex bg-white dark:bg-zinc-800 rounded-xl p-1 border border-zinc-200 dark:border-zinc-700">
                      {(['above', 'below'] as AlertCondition[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => setAlertCondition(c)}
                          className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-widest transition-all ${alertCondition === c ? (c === 'above' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'text-zinc-500'}`}
                        >
                          {c === 'above' ? '≥ Above' : '≤ Below'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={alertPrice}
                      onChange={(e) => setAlertPrice(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddAlert()}
                      placeholder={`Target (${tableCurrency})`}
                      className="flex-1 min-w-0 bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 text-[11px] font-bold border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                  <button onClick={handleAddAlert} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all">
                    Set Alert
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-zinc-400" strokeWidth={2} />
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No alerts yet</p>
                    <p className="text-zinc-400 text-[10px] mt-1">Get notified when a contract hits your price.</p>
                  </div>
                ) : alerts.map((al) => (
                  <div key={al.id} className={`flex items-center justify-between gap-2 p-4 rounded-2xl border transition-colors ${al.triggered ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-white/5'}`}>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase dark:text-zinc-200 tracking-tight truncate">{al.name}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                        {al.condition === 'above' ? '≥' : '≤'} {displayTarget(al)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wide ${al.triggered ? 'bg-red-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
                        {al.triggered ? 'Triggered' : 'Active'}
                      </span>
                      <button onClick={() => handleRemoveAlert(al.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-500/10 text-[11px] transition-colors" title="Remove alert">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cross-Market Performance Comparison — a view you can't get on a single detail page */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-[3rem] shadow-sm p-5 sm:p-10 border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Performance Matrix</h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Every energy contract, ranked head-to-head</p>
            </div>
            <div className="flex bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-1 w-full md:w-auto">
              {COMPARE_METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setCompareMetric(m.key)}
                  className={`flex-1 md:flex-none px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all uppercase tracking-widest ${compareMetric === m.key ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {comparison.rows.map((row) => {
              const pos = row.value >= 0;
              const widthPct = (Math.abs(row.value) / comparison.maxAbs) * 50; // half-width max (diverging)
              return (
                <button
                  key={row.key}
                  onClick={() => router.push(`/oil/${row.key}`)}
                  className="w-full group flex items-center gap-2 sm:gap-4 text-left"
                >
                  <span className="w-24 sm:w-40 shrink-0 text-[10px] sm:text-xs font-black uppercase italic tracking-tight text-zinc-700 dark:text-zinc-300 group-hover:text-blue-500 transition-colors truncate">
                    {row.name}
                  </span>
                  {/* Diverging bar around a centre baseline */}
                  <div className="flex-1 flex items-center h-6 relative">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700" />
                    <div className="w-1/2 flex justify-end">
                      {!pos && (
                        <div className="h-3 sm:h-3.5 rounded-l-md bg-gradient-to-l from-red-500 to-red-500/60" style={{ width: `${widthPct * 2}%` }} />
                      )}
                    </div>
                    <div className="w-1/2 flex justify-start">
                      {pos && (
                        <div className="h-3 sm:h-3.5 rounded-r-md bg-gradient-to-r from-green-500 to-green-500/60" style={{ width: `${widthPct * 2}%` }} />
                      )}
                    </div>
                  </div>
                  <span className={`w-14 sm:w-20 shrink-0 text-right text-[10px] sm:text-sm font-black font-mono tabular-nums ${pos ? 'text-green-500' : 'text-red-500'}`}>
                    {pos ? '+' : ''}{row.value.toFixed(2)}%
                  </span>
                </button>
              );
            })}
            {comparison.rows.length === 0 && (
              <p className="py-10 text-center text-zinc-400 font-black uppercase tracking-widest text-[11px]">No comparison data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
