"use client";

import { useState, useEffect } from "react";
import StockCard from "../components/StockCard";
import PriceCard from "../components/PriceCard";
import { fetchGoldPrice, fetchSilverPrice } from "../lib/api";

export default function WatchlistPage() {
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [selectedWlId, setSelectedWlId] = useState<string | null>(null);
  const [stocksData, setStocksData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metalsData, setMetalsData] = useState<any>(null);

  const activeWatchlist = watchlists.find(wl => wl._id === selectedWlId) || watchlists[0];

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [wlRes, stockRes, goldRes, silverRes] = await Promise.all([
        fetch('/api/watchlists'),
        fetch('/api/psx-stocks'),
        fetchGoldPrice(),
        fetchSilverPrice()
      ]);

      const wlJson = await wlRes.json();
      const stockJson = await stockRes.json();

      if (wlJson.success) {
        setWatchlists(wlJson.data);
        if (wlJson.data.length > 0 && !selectedWlId) {
          setSelectedWlId(wlJson.data[0]._id);
        }
      }

      setStocksData(stockJson.data || []);
      setMetalsData({ gold: goldRes, silver: silverRes });
    } catch (err) {
      console.error("Failed to load watchlist data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleRemoveSymbol = async (watchlistId: string, symbol: string) => {
    const wl = watchlists.find(w => w._id === watchlistId);
    if (!wl || !symbol) return;
    const currentSymbols = wl.symbols || [];
    const newSymbols = currentSymbols.filter((s: string) => s !== symbol.toUpperCase());

    try {
      const res = await fetch(`/api/watchlists/${watchlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: newSymbols })
      });
      const json = await res.json();
      if (json.success) {
        setWatchlists(watchlists.map(w => w._id === watchlistId ? json.data : w));
      }
    } catch (err) {
      console.error("Error removing symbol", err);
    }
  };

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

  const handleDeleteWatchlist = async (id: string) => {
    if (!confirm("Are you sure you want to delete this watchlist?")) return;
    try {
      const res = await fetch(`/api/watchlists/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        const remaining = watchlists.filter(w => w._id !== id);
        setWatchlists(remaining);
        if (remaining.length > 0) setSelectedWlId(remaining[0]._id);
        else setSelectedWlId(null);
      }
    } catch (err) {
      console.error("Error deleting watchlist", err);
    }
  };

  // Get current watchlist items with live data
  const watchlistItems = activeWatchlist?.symbols?.map((sym: string) => {
    const live = stocksData.find(s => s.symbol.toUpperCase() === sym.toUpperCase());
    return live ? { ...live, type: 'stock' } : null;
  }).filter(Boolean) || [];

  // Add specific metals if needed (hardcoded for now as placeholders or based on naming)
  if (activeWatchlist?.name.toLowerCase().includes('metal')) {
    if (metalsData?.gold?.tola24k) watchlistItems.push({ ...metalsData.gold.tola24k, title: 'Gold (24K) - Tola', type: 'metal', id: 'gold' });
    if (metalsData?.silver?.ounce) watchlistItems.push({ ...metalsData.silver.ounce, title: 'Silver - Ounce', type: 'metal', id: 'silver' });
  }

  // Calculations
  const totalItems = watchlistItems.length;
  const avgChange = totalItems > 0
    ? watchlistItems.reduce((acc: number, curr: any) => acc + (curr.changePercent || 0), 0) / totalItems
    : 0;

  const bestPerformer = [...watchlistItems].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))[0];
  const worstPerformer = [...watchlistItems].sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))[0];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-zinc-200 dark:border-white/5">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-black tracking-tighter italic uppercase text-zinc-900 dark:text-white">
            ⭐ My <span className="text-blue-500">Watchlists</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
            Personalized Asset Monitoring Engine
          </p>
        </div>
      </header>

      {/* Watchlist Hub Tabs */}
      <div className="bg-zinc-100 dark:bg-black/30 backdrop-blur-sm border-b border-zinc-200 dark:border-white/5 px-8 py-2 overflow-x-auto no-scrollbar flex items-center gap-2">
        {watchlists.map(wl => (
          <button
            key={wl._id}
            onClick={() => setSelectedWlId(wl._id)}
            className={`px-4 py-2 rounded-lg text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 ${selectedWlId === wl._id
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
          >
            📂 {wl.name}
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${selectedWlId === wl._id ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              {wl.symbols?.length || 0}
            </span>
          </button>
        ))}
        {watchlists.length > 0 && (
          <button
            onClick={() => handleDeleteWatchlist(selectedWlId!)}
            className="ml-auto p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete Watchlist"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : watchlists.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-xl p-16 text-center border border-zinc-200 dark:border-zinc-800">
            <p className="text-5xl mb-6">🏜️</p>
            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 mb-3 uppercase tracking-tighter">
              No Watchlists Found
            </h2>
            <p className="text-zinc-500 font-medium mb-8 max-w-md mx-auto">
              You haven't created any watchlists yet. Head over to the stocks page to start organizing your portfolio.
            </p>
            <a
              href="/stocks"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              🚀 Go to Stocks
            </a>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {watchlistItems.map((item: any) => (
                <div key={item.symbol || item.id} className="relative group/wrapper">
                  <button
                    onClick={() => handleRemoveSymbol(selectedWlId!, item.symbol)}
                    className="absolute -top-2 -right-2 z-50 bg-white dark:bg-zinc-800 text-red-500 rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-xl border border-zinc-200 dark:border-zinc-700 opacity-0 group-hover/wrapper:opacity-100 transition-all hover:bg-red-50"
                    title="Remove from Watchlist"
                  >
                    ✕
                  </button>
                  {item.type === 'stock' ? (
                    <StockCard
                      {...item}
                      watchlists={watchlists}
                      onAddToWatchlist={handleAddToWatchlist}
                      onRemoveFromWatchlist={handleRemoveSymbol}
                      onWatchlistCreated={(newList) => setWatchlists([newList, ...watchlists])}
                    />
                  ) : (
                    <PriceCard {...item} />
                  )}
                </div>
              ))}
              {watchlistItems.length === 0 && (
                <div className="col-span-full py-16 text-center bg-zinc-100/50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-zinc-400 font-black uppercase tracking-widest text-xs">This watchlist is empty</p>
                  <p className="text-zinc-500 text-sm mt-1">Add symbols from the market explorer</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats & Insights */}
        {watchlistItems.length > 0 && (
          <div className="mt-12 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm rounded-[3rem] shadow-2xl p-10 border border-zinc-200 dark:border-white/5">
            <div className="flex items-center gap-3 mb-10">
              <span className="text-2xl">📊</span>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white italic uppercase tracking-tighter">
                Portfolio <span className="text-blue-500">Intelligence</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-zinc-100 dark:bg-white/5 p-8 rounded-[2rem] border border-zinc-200 dark:border-white/5 group hover:bg-zinc-200 dark:hover:bg-white/[0.08] transition-all">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Active Monitors</p>
                <div className="flex items-end gap-2">
                  <p className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter italic">{watchlistItems.length}</p>
                  <p className="text-[10px] font-black text-zinc-500 pb-2 uppercase tracking-widest">Assets</p>
                </div>
              </div>

              <div className="bg-zinc-100 dark:bg-white/5 p-8 rounded-[2rem] border border-zinc-200 dark:border-white/5 group hover:bg-zinc-200 dark:hover:bg-white/[0.08] transition-all">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Session Alpha</p>
                <div className="flex items-end gap-1">
                  <p className={`text-5xl font-black tracking-tighter italic ${avgChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                  </p>
                </div>
              </div>

              {bestPerformer && (
                <div className="bg-green-500/5 p-8 rounded-[2rem] border border-green-500/10 group hover:bg-green-500/10 transition-all">
                  <p className="text-[10px] font-black text-green-500/70 uppercase tracking-[0.2em] mb-3">Alpha Leader</p>
                  <p className="text-2xl font-black text-green-400 truncate tracking-tight uppercase italic">{bestPerformer.symbol}</p>
                  <p className="text-lg font-black text-green-500 font-mono mt-1">+{bestPerformer.changePercent?.toFixed(2)}%</p>
                </div>
              )}

              {worstPerformer && (
                <div className="bg-red-500/5 p-8 rounded-[2rem] border border-red-500/10 group hover:bg-red-500/10 transition-all">
                  <p className="text-[10px] font-black text-red-500/70 uppercase tracking-[0.2em] mb-3">Session Laggard</p>
                  <p className="text-2xl font-black text-red-400 truncate tracking-tight uppercase italic">{worstPerformer.symbol}</p>
                  <p className="text-lg font-black text-red-500 font-mono mt-1">{worstPerformer.changePercent?.toFixed(2)}%</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
