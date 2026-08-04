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

/**
 * The schema declares `unique: true` on email, but that is only a real
 * constraint once the index exists — and a deployment that turns off mongoose's
 * autoIndex (common production advice) would otherwise run with no enforcement
 * at all. Building it here is idempotent, and loud when the collection already
 * holds duplicate addresses, which is exactly when silence would hurt.
 */
async function ensureUniqueEmails(): Promise<void> {
    try {
        await User.collection.createIndex({ email: 1 }, { unique: true, name: 'email_1' });
    } catch (err) {
        console.error(
            '[seed] could not enforce one account per email — merge or remove the duplicate ' +
            'accounts, then restart so the unique index can be built:', err,
        );
    }
}

async function seed(): Promise<void> {
    await ensureUniqueEmails();

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
