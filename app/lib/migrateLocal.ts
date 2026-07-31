// One-off hand-off from the pre-accounts localStorage store into the freshly
// signed-in user's database records. Runs after every sign-in but only does
// work when this browser still holds legacy data AND the account is empty —
// so it can never duplicate or clobber what's already on the server.

import { readLegacyTxns, clearLegacyTxns, fetchTxns, importTxns } from "./portfolio";
import { readLegacyWatch, clearLegacyWatch, fetchWatch, replaceWatch } from "./universalWatch";

export interface MigrationResult {
    txns: number;
    watch: number;
}

export async function migrateLocalDataToAccount(): Promise<MigrationResult> {
    const result: MigrationResult = { txns: 0, watch: 0 };

    try {
        const legacyTxns = readLegacyTxns();
        if (legacyTxns.length > 0) {
            const existing = await fetchTxns();
            if (existing.length === 0) {
                result.txns = await importTxns(legacyTxns.map(({ id, ...rest }) => rest));
            }
            clearLegacyTxns();
        }
    } catch (err) {
        console.error("[migrate] portfolio hand-off failed:", err);
    }

    try {
        const legacyWatch = readLegacyWatch();
        if (legacyWatch.length > 0) {
            const existing = await fetchWatch();
            if (existing.length === 0) {
                await replaceWatch(legacyWatch);
                result.watch = legacyWatch.length;
            }
            clearLegacyWatch();
        }
    } catch (err) {
        console.error("[migrate] watch-list hand-off failed:", err);
    }

    return result;
}
