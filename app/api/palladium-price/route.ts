import { fetchPalladiumPrice } from "@/app/lib/api";

export async function GET() {
  try {
    const price = await fetchPalladiumPrice();
    if (!price) return Response.json({ error: "Could not fetch palladium price" }, { status: 500 });
    return Response.json(price);
  } catch (error) {
    console.error("API error (palladium):", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
