interface HistoryPoint {
  time: string;
  price: number;
}

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await params;
    // Generate synthetic history for demo (real implementation should call a market API)
    const now = Date.now();
    const points = 30;
    const base = 100 + Math.floor(Math.random() * 500);
    const data: HistoryPoint[] = [];
    for (let i = points - 1; i >= 0; i--) {
      const t = new Date(now - i * 60 * 60 * 1000);
      const price = Math.round((base + Math.sin(i / 3) * 5 + (Math.random() - 0.5) * 10) * 100) / 100;
      data.push({ time: t.toISOString(), price });
    }
    return Response.json({ symbol, data });
  } catch (err) {
    console.error('History fetch error', err);
    return Response.json({ error: 'Failed to generate history' }, { status: 500 });
  }
}
