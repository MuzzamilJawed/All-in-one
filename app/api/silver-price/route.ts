import { fetchSilverPrice } from "@/app/lib/api";

export async function GET() {
  try {
    const silverPrice = await fetchSilverPrice();
    if (!silverPrice) {
      return Response.json({ error: "Could not fetch silver price" }, { status: 500 });
    }
    return Response.json(silverPrice);
  } catch (error) {
    console.error("API error (silver):", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
