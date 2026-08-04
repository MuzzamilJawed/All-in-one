// Fixed-window request counter held in module memory.
//
// Enough for the way SoloTrackr is deployed — a single Next.js server. Behind
// more than one instance each would keep its own tally, so move the counter
// into Mongo before scaling out.

interface Window { count: number; resetAt: number }

const windows = new Map<string, Window>();

const sweep = (now: number) => {
    if (windows.size < 500) return;              // cheap: only when it grows
    for (const [key, win] of windows) if (win.resetAt <= now) windows.delete(key);
};

/**
 * Counts one hit against `key`. Returns whether it is allowed, and how long
 * the caller should wait when it isn't.
 */
export function rateLimit(key: string, limit: number, windowMs: number): {
    ok: boolean;
    remaining: number;
    retryAfterSeconds: number;
} {
    const now = Date.now();
    sweep(now);

    const existing = windows.get(key);
    if (!existing || existing.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    existing.count += 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
        ok: existing.count <= limit,
        remaining: Math.max(0, limit - existing.count),
        retryAfterSeconds,
    };
}

/** Best-effort client address for rate-limit keys — never for authorisation. */
export function clientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
