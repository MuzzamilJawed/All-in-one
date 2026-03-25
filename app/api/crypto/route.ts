import { fetchCryptoPrices } from "@/app/lib/api";

export async function GET() {
  try {
    const data = await fetchCryptoPrices();
    if (!data) {
      return Response.json({ error: "Could not fetch crypto prices" }, { status: 500 });
    }
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
