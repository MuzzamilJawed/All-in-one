import { fetchGoldPrice } from "@/app/lib/api";

export async function GET() {
  try {
    const goldPrice = await fetchGoldPrice();
    
    if (!goldPrice) {
      return Response.json(
        { error: "Could not fetch gold price" },
        { status: 500 }
      );
    }

    return Response.json(goldPrice);
  } catch (error) {
    console.error("API error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
