// Per-user activity roll-up, shared by the profile screen and the admin user
// directory so both report the same numbers.

import mongoose from 'mongoose';
import Watchlist from '../models/Watchlist';
import Transaction from '../models/Transaction';

export interface UserStats {
    watchlists: number;
    trackedSymbols: number;
    trades: number;
    openPositions: number;
    firstTrade: string | null;
    lastTrade: string | null;
}

const toId = (id: string) => new mongoose.Types.ObjectId(id);

/** Counts for a single user — used on their profile and in the admin detail. */
export async function userStats(userId: string): Promise<UserStats> {
    const [lists, txns] = await Promise.all([
        Watchlist.find({ userId }).select('symbols').lean(),
        Transaction.find({ userId }).select('date symbol assetType').lean(),
    ]);

    const trackedSymbols = new Set<string>();
    lists.forEach((l: any) => (l.symbols || []).forEach((s: string) => trackedSymbols.add(s)));

    // "Open positions" here means distinct instruments ever traded — the exact
    // net-of-sells figure needs price data, which lives on the client.
    const positions = new Set(txns.map((t: any) => `${t.assetType}:${t.symbol}`));
    const dates = txns.map((t: any) => t.date).filter(Boolean).sort();

    return {
        watchlists: lists.length,
        trackedSymbols: trackedSymbols.size,
        trades: txns.length,
        openPositions: positions.size,
        firstTrade: dates[0] ?? null,
        lastTrade: dates[dates.length - 1] ?? null,
    };
}

/** One aggregation pass for the whole directory — avoids N queries per user. */
export async function statsForAllUsers(userIds: string[]): Promise<Record<string, { watchlists: number; trackedSymbols: number; trades: number }>> {
    const ids = userIds.map(toId);

    const [lists, trades] = await Promise.all([
        Watchlist.aggregate([
            { $match: { userId: { $in: ids } } },
            {
                $group: {
                    _id: '$userId',
                    watchlists: { $sum: 1 },
                    symbols: { $push: '$symbols' },
                },
            },
        ]),
        Transaction.aggregate([
            { $match: { userId: { $in: ids } } },
            { $group: { _id: '$userId', trades: { $sum: 1 } } },
        ]),
    ]);

    const out: Record<string, { watchlists: number; trackedSymbols: number; trades: number }> = {};
    for (const id of userIds) out[id] = { watchlists: 0, trackedSymbols: 0, trades: 0 };

    for (const row of lists) {
        const key = String(row._id);
        if (!out[key]) continue;
        const unique = new Set<string>();
        (row.symbols || []).flat().forEach((s: string) => unique.add(s));
        out[key].watchlists = row.watchlists;
        out[key].trackedSymbols = unique.size;
    }
    for (const row of trades) {
        const key = String(row._id);
        if (out[key]) out[key].trades = row.trades;
    }

    return out;
}
