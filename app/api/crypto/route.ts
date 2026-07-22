import { fetchCryptoPrices } from "@/app/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("per_page") || "20") || 20));

  try {
    const data = await fetchCryptoPrices(page, perPage);
    if (!data) {
      return Response.json({ error: "Could not fetch crypto prices" }, { status: 500 });
    }
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
