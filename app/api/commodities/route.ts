import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { Console } from "console";

export async function GET() {
  try {
    const response = await fetch("https://tradingeconomics.com/commodities", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Cache-Control": "no-cache",
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from TradingEconomics: ${response.status}`,
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const commodities: any = {};

    // Map common names to our keys (handle partial matches or variations)
    const nameMap: Record<string, string> = {
      Gold: "gold",
      Silver: "silver",
      Platinum: "platinum",
      Palladium: "palladium",
      "Crude Oil": "crudeOil",
      Brent: "brentOil",
      Murban: "murbanOil",
      "Natural Gas": "naturalGas",
      Gasoline: "gasoline",
      "Heating Oil": "heatingOil",
      Coal: "coal",
      Ethanol: "ethanol",
      Naphtha: "naphtha",
      Propane: "propane",
      Copper: "copper",
      Steel: "steel",
      Lithium: "lithium",
      "Iron Ore": "ironOre",
      Aluminum: "aluminum",
      Nickel: "nickel",
      Zinc: "zinc",
      Lead: "lead",
      Tin: "tin",
      Cobalt: "cobalt",
      Uranium: "uranium",
    };

    $("table tr").each((i, el) => {
      const tds = $(el).find("td");
      if (tds.length < 4) return;

      let name = tds.eq(0).text().trim().replace(/\s+/g, " ");

      // Normalize name by matching known commodity keywords (handles units like "USD/Lbs" etc.)
      let matchedKey: string | undefined;
      for (const k of Object.keys(nameMap)) {
        if (name.toLowerCase().includes(k.toLowerCase())) {
          matchedKey = k;
          break;
        }
      }

      // Fallback: try a few common cleanups
      if (!matchedKey) {
        if (name.includes("Iron Ore")) matchedKey = "Iron Ore";
        else if (name.includes("Gold")) matchedKey = "Gold";
        else if (name.includes("Silver") && !name.includes("Silver Coin"))
          matchedKey = "Silver";
      }

      if (!matchedKey) return;
      const key = nameMap[matchedKey];

      const priceText = tds.eq(1).text().trim();

      // Determine columns based on table width (standard is usually 8 cols for Overview)
      // Headers: | Name | Price | Change | % | Weekly | Monthly | YoY | Date |
      let changeIndex = 2;
      let percentIndex = 3;
      // Weekly/Monthly/Yearly can vary.
      // Safe bet: Date is last.
      // YoY is usually before Date.

      const dateText = tds.last().text().trim();
      const yoyText = tds
        .eq(tds.length - 2)
        .text()
        .trim()
        .replace("%", "");
      const monthlyText = tds
        .eq(tds.length - 3)
        .text()
        .trim()
        .replace("%", "");
      const weeklyText = tds
        .eq(tds.length - 4)
        .text()
        .trim()
        .replace("%", ""); // Might be wrong if 7 cols

      const changeText = tds.eq(changeIndex).text().trim();
      const changePercentText = tds
        .eq(percentIndex)
        .text()
        .trim()
        .replace("%", "");

      if (priceText && !isNaN(parseFloat(priceText.replace(/,/g, "")))) {
        const price = parseFloat(priceText.replace(/,/g, ""));
        const change = parseFloat(changeText);
        const changePercent = parseFloat(changePercentText);
        const monthly = parseFloat(monthlyText);
        const yearly = parseFloat(yoyText);
        const weekly = parseFloat(weeklyText); // May be NaN if not present

        // Only update if we found a valid price
        commodities[key] = {
          price: isNaN(price) ? 0 : price,
          change: isNaN(change) ? 0 : change,
          changePercent: isNaN(changePercent) ? 0 : changePercent,
          weekly: isNaN(weekly) ? 0 : weekly,
          monthly: isNaN(monthly) ? 0 : monthly,
          yearly: isNaN(yearly) ? 0 : yearly,
          date: dateText,
        };
      }
    });
    console.log(commodities, "commodities");
    return NextResponse.json(commodities);
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
