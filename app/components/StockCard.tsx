import { useState } from "react";

interface StockCardProps {
    symbol: string;
    name: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    open: number;
    high: number;
    low: number;
    volume: string;
    targetPrice?: number;
    exchange?: string; // new prop to show exchange label (defaults to PSX)
    currencySymbol?: string;
    onClick?: () => void;
    watchlists?: any[];
    activeWatchlistId?: string | null;
    onAddToWatchlist?: (watchlistId: string, symbol: string) => void;
    onRemoveFromWatchlist?: (watchlistId: string, symbol: string) => void;
    onWatchlistCreated?: (watchlist: any) => void;
}

export default function StockCard({
    symbol,
    name,
    currentPrice,
    change,
    changePercent,
    open,
    high,
    low,
    volume,
    targetPrice,
    exchange = 'PSX',
    currencySymbol = 'Rs.',
    onClick,
    watchlists = [],
    onAddToWatchlist,
    onRemoveFromWatchlist,
    onWatchlistCreated
}: StockCardProps) {
    const isPositive = change >= 0;
    const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
    const [newWLName, setNewWLName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [ttsLoading, setTtsLoading] = useState(false);

    const handleCreateLocal = async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        if (!newWLName.trim()) return;
        setIsCreating(true);
        try {
            const res = await fetch('/api/watchlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newWLName, symbols: [symbol.toUpperCase()] })
            });
            const json = await res.json();
            if (json.success) {
                onWatchlistCreated?.(json.data);
                setNewWLName("");
                setShowWatchlistMenu(false);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div
            onClick={onClick}
            className="bg-white dark:bg-zinc-900 rounded-[1.2rem] sm:rounded-xl shadow-sm hover:shadow-md transition-all p-3 sm:p-4 border border-zinc-200 dark:border-zinc-800 flex flex-col h-full cursor-pointer group/card"
        >
            <div className="flex justify-between items-start mb-2 sm:mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
                        <h4 className="text-sm sm:text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tighter truncate">
                            {symbol}
                        </h4>
                        <span className="text-[7px] sm:text-[9px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1 py-0.5 rounded uppercase tracking-widest shrink-0">
                            {exchange || 'PSX'}
                        </span>
                    </div>
                    <p className="text-[9px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-tighter line-clamp-1 sm:line-clamp-2 leading-tight">
                        {name}
                    </p>
                </div>
                <div className={`flex flex-col items-end relative shrink-0`}>
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowWatchlistMenu(!showWatchlistMenu); }}
                            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all ${showWatchlistMenu ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                            title="Add to Watchlist"
                        >
                            <span className="text-[12px] sm:text-[14px] leading-none">{showWatchlistMenu ? "×" : "+"}</span>
                        </button>

                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (ttsLoading) return;
                                setTtsLoading(true);
                                try {
                                    const text = `${symbol} ${name} is trading at ${currentPrice} ${currencySymbol === '$' ? 'dollars' : 'rupees'}. Change ${change} (${changePercent} percent).`;
                                    const res = await fetch('/api/tts', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ text })
                                    });
                                    if (!res.ok) {
                                        let errMsg = `TTS request failed (${res.status})`;
                                        try {
                                            const j = await res.json();
                                            errMsg = j?.detail || j?.error || errMsg;
                                        } catch (e) {
                                            // ignore
                                        }
                                        // Surface the error to the user
                                        alert(`TTS error: ${errMsg}`);
                                        throw new Error(errMsg);
                                    }
                                    const ab = await res.arrayBuffer();
                                    const blob = new Blob([ab], { type: res.headers.get('content-type') || 'audio/mpeg' });
                                    const url = URL.createObjectURL(blob);
                                    const audio = new Audio(url);
                                    audio.play();
                                    audio.onended = () => { URL.revokeObjectURL(url); };
                                } catch (err) {
                                    console.error('TTS play error', err);
                                } finally {
                                    setTtsLoading(false);
                                }
                            }}
                            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700`}
                            title="Listen"
                        >
                            <span className="text-[10px] sm:text-[12px] leading-none">{ttsLoading ? '…' : '🔊'}</span>
                        </button>

                        <span className={`text-[10px] sm:text-xs font-black ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '▲' : '▼'}{Math.abs(changePercent).toFixed(1)}%
                        </span>
                    </div>
                    <span className={`text-[9px] font-bold ${isPositive ? 'text-green-600/70' : 'text-red-600/70'}`}>
                        {isPositive ? '+' : ''}{change?.toFixed(2)}
                    </span>

                    {showWatchlistMenu && (
                        <div
                            className="absolute right-0 top-8 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 py-2 animate-in fade-in slide-in-from-top-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="px-3 py-1 text-[8px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 mb-1">Manage Watchlists</p>
                            {watchlists.length > 0 ? watchlists.map(wl => {
                                const isInList = wl.symbols?.includes(symbol.toUpperCase());
                                return (
                                    <button
                                        key={wl._id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isInList) {
                                                onRemoveFromWatchlist?.(wl._id, symbol);
                                            } else {
                                                onAddToWatchlist?.(wl._id, symbol);
                                            }
                                            setShowWatchlistMenu(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-[11px] font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between group/item"
                                    >
                                        <span className={isInList ? "text-blue-600 dark:text-blue-400" : "text-zinc-600 dark:text-zinc-300"}>
                                            {wl.name}
                                        </span>
                                        <span className={`text-[10px] ${isInList ? 'text-blue-600' : 'text-zinc-300 group-hover/item:text-blue-400'}`}>
                                            {isInList ? "✓" : "+"}
                                        </span>
                                    </button>
                                );
                            }) : (
                                <div className="px-3 py-2 space-y-2">
                                    <p className="text-[10px] italic text-zinc-500 leading-tight">No watchlists found. Create your first list for <b>{symbol}</b>:</p>
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            placeholder="List name..."
                                            value={newWLName}
                                            onChange={(e) => setNewWLName(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                            className="flex-1 text-[10px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateLocal(e)}
                                        />
                                        <button
                                            onClick={handleCreateLocal}
                                            disabled={isCreating}
                                            className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {isCreating ? "..." : "→"}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {watchlists.length > 0 && (
                                <div className="border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-1 px-3">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowWatchlistMenu(false); window.location.href = '/stocks'; }}
                                        className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                                    >
                                        + Create New Watchlist
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-auto pt-2 sm:pt-3 flex items-end justify-between border-t border-zinc-100 dark:border-zinc-800">
                <div>
                    <p className="text-[8px] sm:text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Price</p>
                    <p className="text-sm sm:text-xl font-black text-zinc-900 dark:text-zinc-50 font-mono leading-none">
                        <span className="text-[9px] sm:text-[10px] font-normal mr-0.5">{currencySymbol}</span>
                        {currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[8px] sm:text-[9px] text-zinc-400 uppercase font-bold tracking-widest mb-0.5">Vol</p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-zinc-600 dark:text-zinc-300 font-mono leading-none">{volume}</p>
                </div>
            </div>

            {/* Technical Quick View */}
            <div className="mt-3 grid grid-cols-3 gap-1 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <div>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">Open</p>
                    <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-50">{open?.toFixed(1)}</p>
                </div>
                <div className="text-center">
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">High</p>
                    <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-50">{high?.toFixed(1)}</p>
                </div>
                <div className="text-right">
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">Low</p>
                    <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-50">{low?.toFixed(1)}</p>
                </div>
            </div>
        </div>
    );
}
