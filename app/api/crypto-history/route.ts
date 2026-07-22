// Real OHLC candles for a crypto coin (CoinGecko). Timeframe -> days mapping.
// ALWAYS returns HTTP 200 (empty data on failure) so the client never logs a
// repeating "failed to load resource" error.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // CoinGecko coin ids are lowercase slugs (a-z, 0-9, hyphen). Sanitize hard.
  const id = (searchParams.get("id") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const tf = (searchParams.get("timeframe") || "1W").toUpperCase();

  // Free-tier OHLC accepts a fixed set of `days` values.
  const daysMap: Record<string, string> = { "1H": "1", "1D": "1", "1W": "7", "1M": "30" };
  const days = daysMap[tf] || "7";

  const empty = Response.json({ success: true, data: [] });
  if (!id) return empty;

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) return empty;

    const raw = await res.json();
    // Expected: [ [ msTimestamp, open, high, low, close ], ... ]
    const rows = Array.isArray(raw) ? raw : [];
    const data = rows
      .filter((r: any) => Array.isArray(r) && r.length >= 5)
      .map((r: any) => ({
        time: Math.floor(Number(r[0]) / 1000),
        open: Number(r[1]),
        high: Number(r[2]),
        low: Number(r[3]),
        close: Number(r[4]),
      }))
      .filter((c: any) => Number.isFinite(c.time) && Number.isFinite(c.close));

    return Response.json({ success: true, data });
  } catch {
    return empty;
  }
}
