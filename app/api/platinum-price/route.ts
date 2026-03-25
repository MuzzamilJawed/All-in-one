import { fetchPlatinumPrice } from "@/app/lib/api";

export async function GET() {
  try {
    const price = await fetchPlatinumPrice();
    if (!price) return Response.json({ error: "Could not fetch platinum price" }, { status: 500 });
    return Response.json(price);
  } catch (error) {
    console.error("API error (platinum):", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
