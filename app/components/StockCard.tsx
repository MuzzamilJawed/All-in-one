import { useState, useEffect, useCallback } from "react";
import { Target, Volume2, StickyNote } from "lucide-react";
import { computeSignals, dayRangePosition, toneClasses } from "../lib/stockSignals";
import { getTarget, setTarget, getNote, setNote, type StockNote } from "../lib/stockPrefs";
import { useToast } from "../context/ToastContext";

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
    // Daily-analysis extras
    isNew?: boolean; // "new since yesterday" leader
    selectable?: boolean; // compare mode
    selected?: boolean;
    onToggleSelect?: (symbol: string) => void;
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
    onWatchlistCreated,
    isNew = false,
    selectable = false,
    selected = false,
    onToggleSelect,
}: StockCardProps) {
    const { success, error } = useToast();
    const isPositive = change >= 0;
    const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
    const [showMeta, setShowMeta] = useState(false);
    const [newWLName, setNewWLName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [ttsLoading, setTtsLoading] = useState(false);

    // Per-symbol prefs (localStorage) — target + note/tag
    const [target, setTargetState] = useState<number | null>(null);
    const [note, setNoteState] = useState<StockNote | null>(null);
    const [targetInput, setTargetInput] = useState("");
    const [noteText, setNoteText] = useState("");
    const [tagText, setTagText] = useState("");

    const isPSX = (exchange || 'PSX').toUpperCase() === 'PSX';

    const loadPrefs = useCallback(() => {
        const t = getTarget(symbol);
        const n = getNote(symbol);
        setTargetState(t);
        setNoteState(n);
        setTargetInput(t != null ? String(t) : "");
        setNoteText(n?.text || "");
        setTagText(n?.tag || "");
    }, [symbol]);

    useEffect(() => {
        loadPrefs();
        const handler = () => loadPrefs();
        window.addEventListener("stockprefs", handler);
        return () => window.removeEventListener("stockprefs", handler);
    }, [loadPrefs]);

    const effectiveTarget = target ?? (targetPrice ?? null);
    const signals = isPSX ? computeSignals({ changePercent, currentPrice, open, high, low }, effectiveTarget) : [];
    const rangePos = dayRangePosition(low, high, currentPrice);

    const saveMeta = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        const parsed = parseFloat(targetInput.replace(/,/g, ""));
        setTarget(symbol, Number.isFinite(parsed) && parsed > 0 ? parsed : null);
        setNote(symbol, { text: noteText, tag: tagText }, Date.now());
        loadPrefs();
        setShowMeta(false);
        success(`Target & note saved for ${symbol.toUpperCase()}`);
    };

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
                success(`Watchlist "${newWLName.trim()}" created with ${symbol.toUpperCase()}`);
                setNewWLName("");
                setShowWatchlistMenu(false);
            } else {
                error(json.error || "Couldn't create watchlist");
            }
        } catch (err) {
            console.error(err);
            error("Network error — couldn't create watchlist");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div
            onClick={onClick}
            className={`relative bg-white dark:bg-zinc-900 rounded-[1.2rem] sm:rounded-xl shadow-sm hover:shadow-md transition-all p-3 sm:p-4 border flex flex-col h-full cursor-pointer group/card ${selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-zinc-200 dark:border-zinc-800'}`}
        >
            {/* Compare selection checkbox */}
            {selectable && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleSelect?.(symbol); }}
                    className={`absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shadow-lg transition-all ${selected ? 'bg-blue-600 text-white scale-110' : 'bg-white dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-blue-500'}`}
                    title={selected ? 'Remove from compare' : 'Add to compare'}
                >
                    {selected ? '✓' : '+'}
                </button>
            )}

            <div className="flex justify-between items-start mb-2 sm:mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
                        <h4 className="text-sm sm:text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tighter truncate">
                            {symbol}
                        </h4>
                        {/* <span className="text-[9px] sm:text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">
                            {exchange || 'PSX'}
                        </span> */}
                        {isNew && (
                            <span className="text-[8px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0" title="New leader vs previous session">NEW</span>
                        )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-tighter line-clamp-1 sm:line-clamp-2 leading-tight">
                        {name}
                    </p>
                </div>
                <div className={`flex flex-col items-end relative shrink-0`}>
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMeta(!showMeta); setShowWatchlistMenu(false); }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${showMeta || target || note ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                            title="Set target / note"
                        >
                            <Target className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowWatchlistMenu(!showWatchlistMenu); setShowMeta(false); }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${showWatchlistMenu ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                            title="Add to Watchlist"
                        >
                            <span className="text-[13px] sm:text-[14px] leading-none">{showWatchlistMenu ? "×" : "+"}</span>
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
                                        error(`Audio unavailable: ${errMsg}`);
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
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700`}
                            title="Listen"
                        >
                            {ttsLoading ? <span className="text-[11px] sm:text-[12px] leading-none">…</span> : <Volume2 className="w-3.5 h-3.5" strokeWidth={2} />}
                        </button>

                        <span className={`text-[10px] sm:text-xs font-black ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '▲' : '▼'}{Math.abs(changePercent).toFixed(1)}%
                        </span>
                    </div>
                    <span className={`text-[9px] sm:text-[10px] font-bold ${isPositive ? 'text-green-600/70' : 'text-red-600/70'}`}>
                        {isPositive ? '+' : ''}{change?.toFixed(2)}
                    </span>

                    {/* Target / note editor */}
                    {showMeta && (
                        <div
                            className="absolute right-0 top-8 w-[min(14rem,85vw)] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Target Price ({currencySymbol})</p>
                            <input
                                type="number"
                                inputMode="decimal"
                                placeholder="e.g. 150"
                                value={targetInput}
                                onChange={(e) => setTargetInput(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Tag</p>
                            <input
                                type="text"
                                placeholder="e.g. Breakout, Earnings"
                                value={tagText}
                                maxLength={20}
                                onChange={(e) => setTagText(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Note</p>
                            <textarea
                                placeholder="Your thesis / reminder…"
                                value={noteText}
                                rows={2}
                                onChange={(e) => setNoteText(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            />
                            <div className="flex gap-2 pt-1">
                                <button onClick={saveMeta} className="flex-1 bg-blue-600 text-white text-[10px] font-black uppercase py-1.5 rounded-lg hover:bg-blue-700">Save</button>
                                <button onClick={(e) => { e.stopPropagation(); setShowMeta(false); }} className="px-3 text-zinc-400 hover:text-zinc-600 text-xs">✕</button>
                            </div>
                        </div>
                    )}

                    {showWatchlistMenu && (
                        <div
                            className="absolute right-0 top-8 w-[min(12rem,80vw)] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 py-2 animate-in fade-in slide-in-from-top-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="px-3 py-1 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 mb-1">Manage Watchlists</p>
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

            {/* Signal badges + user tag */}
            {(signals.length > 0 || note?.tag) && (
                <div className="flex flex-wrap items-center gap-1 mb-2">
                    {note?.tag && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" title={note.text || note.tag}>
                            <StickyNote className="w-2.5 h-2.5" strokeWidth={2} /> {note.tag}
                        </span>
                    )}
                    {signals.slice(0, 2).map(sig => (
                        <span key={sig.key} title={sig.title} className={`inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border ${toneClasses(sig.tone)}`}>
                            <sig.icon className="w-2.5 h-2.5" strokeWidth={2.5} /> {sig.label}
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-auto pt-2 sm:pt-3 flex items-end justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Price</p>
                    <p className="text-sm sm:text-xl font-black text-zinc-900 dark:text-zinc-50 font-mono tabular-nums leading-none truncate">
                        <span className="text-[10px] sm:text-xs font-normal mr-0.5">{currencySymbol}</span>
                        {currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </p>
                    {effectiveTarget != null && (
                        <p className="text-[9px] font-bold text-blue-500 mt-0.5 truncate inline-flex items-center gap-0.5" title="Your target"><Target className="w-2.5 h-2.5 shrink-0" strokeWidth={2} /> {effectiveTarget.toLocaleString()}</p>
                    )}
                </div>
                <div className="text-right min-w-0">
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mb-0.5">Vol</p>
                    <p className="text-[10px] sm:text-xs font-bold text-zinc-600 dark:text-zinc-300 font-mono leading-none truncate">{volume}</p>
                </div>
            </div>

            {/* Day range position bar */}
            {rangePos != null && (
                <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                        <span>L {low?.toFixed(1)}</span>
                        <span className="text-zinc-500">Day Range</span>
                        <span>H {high?.toFixed(1)}</span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-gradient-to-r from-red-500/30 via-zinc-300 dark:via-zinc-700 to-green-500/30">
                        <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white dark:border-zinc-900 shadow"
                            style={{ left: `${rangePos}%` }}
                            title={`${rangePos.toFixed(0)}% of today's range`}
                        ></div>
                    </div>
                </div>
            )}

            {/* Technical Quick View */}
            <div className="mt-3 grid grid-cols-3 gap-1 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Open</p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50">{open?.toFixed(1)}</p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">High</p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50">{high?.toFixed(1)}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Low</p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50">{low?.toFixed(1)}</p>
                </div>
            </div>
        </div>
    );
}
