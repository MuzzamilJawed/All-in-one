// One-time bootstrap run right after the first successful DB connection.
// Creates the admin account and adopts any pre-auth data into it, so an
// existing install keeps its watchlists instead of losing them behind login.

import User from '../models/User';
import Watchlist from '../models/Watchlist';
import { hashPassword } from './password';

export const SEED_ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@solotrackr.app').toLowerCase();
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin12345';
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Administrator';

let running: Promise<void> | null = null;

/** Idempotent — safe to call on every connection; the work happens once. */
export function ensureSeed(): Promise<void> {
    if (!running) {
        running = seed().catch((err) => {
            running = null; // let a later request retry after a transient failure
            console.error('[seed] failed:', err);
        });
    }
    return running;
}

async function seed(): Promise<void> {
    let admin = await User.findOne({ email: SEED_ADMIN_EMAIL });

    if (!admin) {
        admin = await User.create({
            email: SEED_ADMIN_EMAIL,
            name: SEED_ADMIN_NAME,
            role: 'admin',
            providers: ['credentials'],
            passwordHash: hashPassword(SEED_ADMIN_PASSWORD),
            universalWatch: [],
        });
        console.log(`[seed] admin account created — ${SEED_ADMIN_EMAIL} / ${process.env.SEED_ADMIN_PASSWORD ? '(from SEED_ADMIN_PASSWORD)' : SEED_ADMIN_PASSWORD}`);
    } else if (admin.role !== 'admin') {
        admin.role = 'admin';
        await admin.save();
    }

    // Legacy watchlists were global; hand them to the admin so nothing is orphaned.
    const adopted = await Watchlist.updateMany(
        { $or: [{ userId: { $exists: false } }, { userId: null }] },
        { $set: { userId: admin._id } },
    );
    if (adopted.modifiedCount) {
        console.log(`[seed] adopted ${adopted.modifiedCount} pre-auth watchlist(s) into ${SEED_ADMIN_EMAIL}`);
    }
}
