"use client";

import PriceCard from "../components/PriceCard";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../components/TradingChart'), { ssr: false });
import { useState, useEffect, useCallback, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
// Use internal API routes to avoid CORS and run scraping/server code server-side

export default function MetalsPage() {
  const [showMore, setShowMore] = useState(false);
  const [showPurity, setShowPurity] = useState(false);
  const [calcMetal, setCalcMetal] = useState('gold');
  const [calcPurity, setCalcPurity] = useState('24K');
  const [calcUnit, setCalcUnit] = useState('Tola');
  const [calcQuantity, setCalcQuantity] = useState(1);
  const [timeframe, setTimeframe] = useState("1d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metalPrices, setMetalPrices] = useState([
    { title: "Gold (24K) - Per Gram", usdPrice: undefined, pkrPrice: undefined, change: 0, changePercent: 0, lastUpdated: "", isLoading: true },
    { title: "Gold (24K) - Per Tola", usdPrice: undefined as number | undefined, pkrPrice: undefined as number | undefined, change: 0, changePercent: 0, lastUpdated: "", isLoading: true },
    { title: "Gold (24K) - Per Ounce", usdPrice: undefined, pkrPrice: undefined, change: 0, changePercent: 0, lastUpdated: "", isLoading: true },
    { title: "Silver - Per Tola", usdPrice: undefined, pkrPrice: undefined, change: 0, changePercent: 0, lastUpdated: "", isLoading: true },
    { title: "Silver - Per Ounce", usdPrice: undefined, pkrPrice: undefined, change: 0, changePercent: 0, lastUpdated: "", isLoading: true },
    { title: "Silver - Per Kilogram", usdPrice: undefined, pkrPrice: undefined, change: 0, changePercent: 0, lastUpdated: "", isLoading: true },
  ]);

  const [caratPrices, setCaratPrices] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [goldCandles, setGoldCandles] = useState<any[]>([]);
  const [silverCandles, setSilverCandles] = useState<any[]>([]);
  const [goldChartTF, setGoldChartTF] = useState("1H");
  const [silverChartTF, setSilverChartTF] = useState("1H");

  // Trend Chart State
  const [trendTimeframe, setTrendTimeframe] = useState("Daily");
  const [trendMetal, setTrendMetal] = useState("gold"); // 'gold' | 'silver'
  const [trendData, setTrendData] = useState<any[]>([]);
  const { settings, updateSettings } = useSettings();
  const tableCurrency = settings.currency as 'USD' | 'PKR';
  const [detailedRates, setDetailedRates] = useState<any[]>([]);
  const [rawMarketData, setRawMarketData] = useState<any>(null);
  const [purityUnit, setPurityUnit] = useState('Tola'); // 'Tola' | 'Gram' | 'Ounce' | 'Kg'

  const loadPrices = useCallback(async (isManual = true) => {
    try {
      if (isManual) setLoading(true);
      setError("");
      const [goldRes, silverRes, platinumRes, palladiumRes, commoditiesRes] = await Promise.all([
        fetch('/api/gold-price'),
        fetch('/api/silver-price'),
        fetch('/api/platinum-price'),
        fetch('/api/palladium-price'),
        fetch('/api/commodities'),
      ]);

      const gold = goldRes.ok ? await goldRes.json() : null;
      const silver = silverRes.ok ? await silverRes.json() : null;
      const platinum = platinumRes.ok ? await platinumRes.json() : null;
      const palladium = palladiumRes.ok ? await palladiumRes.json() : null;
      const commodities = commoditiesRes.ok ? await commoditiesRes.json() : null;

      // Check if we got valid data
      const hasValidData =
        (gold?.tola24k?.pkrPrice && gold.tola24k.pkrPrice > 0) ||
        (silver?.ounce?.pkrPrice && silver.ounce.pkrPrice > 0);

      if (!hasValidData && isManual) {
        setError("Could not fetch price data from all sources");
      }

      const updatedPrices = [
        {
          title: "Gold (24K) - Per Gram",
          usdPrice: gold?.gram24k?.usdPrice,
          pkrPrice: gold?.gram24k?.pkrPrice,
          change: gold?.gram24k?.change ?? 0,
          changePercent: gold?.gram24k?.changePercent ?? 0,
          lastUpdated: new Date().toLocaleString(),
          isLoading: false,
        },
        {
          title: "Gold (24K) - Per Tola",
          usdPrice: gold?.tola24k?.usdPrice,
          pkrPrice: gold?.tola24k?.pkrPrice,
          change: gold?.tola24k?.change ?? 0,
          changePercent: gold?.tola24k?.changePercent ?? 0,
          lastUpdated: new Date().toLocaleString(),
          isLoading: false,
        },
        {
          title: "Gold (24K) - Per Ounce",
          usdPrice: gold?.ounce24k?.usdPrice,
          pkrPrice: gold?.ounce24k?.pkrPrice,
          change: gold?.ounce24k?.change ?? 0,
          changePercent: gold?.ounce24k?.changePercent ?? 0,
          lastUpdated: new Date().toLocaleString(),
          isLoading: false,
        },
        {
          title: "Silver - Per Tola",
          usdPrice: silver?.tola?.usdPrice,
          pkrPrice: silver?.tola?.pkrPrice,
          change: silver?.tola?.change ?? 0,
          changePercent: silver?.tola?.changePercent ?? 0,
          lastUpdated: new Date().toLocaleString(),
          isLoading: false,
        },
        {
          title: "Silver - Per Ounce",
          usdPrice: silver?.ounce?.usdPrice,
          pkrPrice: silver?.ounce?.pkrPrice,
          change: silver?.ounce?.change ?? 0,
          changePercent: silver?.ounce?.changePercent ?? 0,
          lastUpdated: new Date().toLocaleString(),
          isLoading: false,
        },
        {
          title: "Silver - Per Kilogram",
          usdPrice: silver?.kilogram?.usdPrice,
          pkrPrice: silver?.kilogram?.pkrPrice,
          change: silver?.kilogram?.change ?? 0,
          changePercent: silver?.kilogram?.changePercent ?? 0,
          lastUpdated: new Date().toLocaleTimeString(),
          isLoading: false,
        },
      ];

      setMetalPrices(updatedPrices);

      // Update Carat Prices
      if (gold?.tola24k?.pkrPrice) {
        const basePrice24k = gold.tola24k.pkrPrice;
        const baseUsd24k = gold.tola24k.usdPrice;
        const change24k = gold.tola24k.change;
        const changePercent24k = gold.tola24k.changePercent;

        setCaratPrices([
          { carat: "24K", purity: 99.9, pkr: basePrice24k, usd: baseUsd24k, change: change24k, percent: changePercent24k },
          { carat: "22K", purity: 91.7, pkr: Math.round(basePrice24k * 0.916), usd: Math.round(baseUsd24k * 0.916 * 100) / 100, change: Math.round(change24k * 0.916), percent: changePercent24k },
          { carat: "21K", purity: 87.5, pkr: Math.round(basePrice24k * 0.875), usd: Math.round(baseUsd24k * 0.875 * 100) / 100, change: Math.round(change24k * 0.875), percent: changePercent24k },
          { carat: "18K", purity: 75.0, pkr: Math.round(basePrice24k * 0.75), usd: Math.round(baseUsd24k * 0.75 * 100) / 100, change: Math.round(change24k * 0.75), percent: changePercent24k },
          { carat: "12K", purity: 50, pkr: Math.round(basePrice24k * 0.5), usd: Math.round(baseUsd24k * 0.5 * 100) / 100, change: Math.round(change24k * 0.5), percent: changePercent24k },
        ]);
      }

      // Handle History 
      const stored = localStorage.getItem("metalPriceHistory");
      let currentHistory = [];
      const currentGold = gold?.tola24k?.pkrPrice || 530000;
      const currentSilver = silver?.ounce?.pkrPrice || 4500;

      if (stored) {
        currentHistory = JSON.parse(stored);
      }

      if (currentHistory.length === 0) {
        const now = Date.now();
        for (let i = 23; i >= 0; i--) {
          const date = new Date(now - i * 60 * 60 * 1000);
          currentHistory.push({
            date: date.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
            gold: Math.round(currentGold * (1 + (Math.random() - 0.5) * 0.008)),
            silver: Math.round(currentSilver * (1 + (Math.random() - 0.5) * 0.008)),
          });
        }
      }

      if (gold?.tola24k?.pkrPrice) {
        const newEntry = {
          date: new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
          gold: gold.tola24k.pkrPrice,
          silver: silver?.ounce?.pkrPrice || 0,
        };
        if (currentHistory.length === 0 || currentHistory[currentHistory.length - 1].date !== newEntry.date) {
          currentHistory = [...currentHistory.slice(-23), newEntry];
          localStorage.setItem("metalPriceHistory", JSON.stringify(currentHistory));
        }
      }
      setHistory(currentHistory);

      if (gold && silver) {
        console.log('[Metals] Fetched Gold Price:', gold?.tola24k?.pkrPrice, 'PKR / Tola');
        console.log('[Metals] Fetched Silver Price:', silver?.ounce?.pkrPrice, 'PKR / Oz');
        setRawMarketData({ gold, silver, platinum, palladium, commodities });
      }

    } catch (err) {
      console.error("Failed to fetch prices:", err);
      if (isManual) setError("An error occurred while fetching data.");
    } finally {
      if (isManual) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrices(true);
  }, [loadPrices]);

  useEffect(() => {
    if (!settings.refreshInterval || settings.refreshInterval <= 0) return;

    const intervalRef = setInterval(() => {
      loadPrices(false);
    }, settings.refreshInterval * 1000);

    return () => clearInterval(intervalRef);
  }, [settings.refreshInterval, loadPrices]);

  // Derive detailed rates from raw data whenever it or currency changes
  useEffect(() => {
    if (!rawMarketData) return;

    const { gold, silver, platinum, palladium, commodities } = rawMarketData;

    if (gold?.ounce24k && silver?.ounce) {
      const gOunce = gold.ounce24k;
      const sOunce = silver.ounce;

      // Calculate implied exchange rate for conversion
      const exchangeRate = (gOunce.pkrPrice && gOunce.usdPrice)
        ? gOunce.pkrPrice / gOunce.usdPrice
        : 280;

      const getPrice = (usdPrice: number) => {
        if (!usdPrice) return undefined;
        return tableCurrency === 'PKR' ? usdPrice * exchangeRate : usdPrice;
      };

      const getChange = (usdChange: number) => {
        if (!usdChange) return 0;
        return tableCurrency === 'PKR' ? usdChange * exchangeRate : usdChange;
      };

      const rates = [
        {
          name: 'Gold',
          priceOunce: tableCurrency === 'PKR' ? gOunce.pkrPrice : gOunce.usdPrice,
          priceTola: tableCurrency === 'PKR' ? gOunce.pkrPrice * 0.375 : gOunce.usdPrice * 0.375,
          change: getChange(gOunce.change),
          changePercent: gOunce.changePercent || 0,
          weeklyPercent: commodities?.gold?.weekly,
          monthPercent: commodities?.gold?.monthly,
          yearPercent: commodities?.gold?.yearly,
          type: 'Gold'
        },
        {
          name: 'Silver',
          priceOunce: tableCurrency === 'PKR' ? sOunce.pkrPrice : sOunce.usdPrice,
          priceTola: tableCurrency === 'PKR' ? sOunce.pkrPrice * 0.375 : sOunce.usdPrice * 0.375,
          change: getChange(sOunce.change),
          changePercent: sOunce.changePercent || 0,
          weeklyPercent: commodities?.silver?.weekly,
          monthPercent: commodities?.silver?.monthly,
          yearPercent: commodities?.silver?.yearly,
          type: 'Silver'
        },
        {
          name: 'Platinum',
          priceOunce: tableCurrency === 'PKR' ? platinum?.ounce?.pkrPrice : platinum?.ounce?.usdPrice,
          priceTola: tableCurrency === 'PKR' ? (platinum?.ounce?.pkrPrice || 0) * 0.375 : (platinum?.ounce?.usdPrice || 0) * 0.375,
          change: getChange(platinum?.ounce?.change),
          changePercent: platinum?.ounce?.changePercent || 0,
          weeklyPercent: commodities?.platinum?.weekly,
          monthPercent: commodities?.platinum?.monthly,
          yearPercent: commodities?.platinum?.yearly,
          type: 'Platinum'
        },
        {
          name: 'Palladium',
          priceOunce: tableCurrency === 'PKR' ? palladium?.ounce?.pkrPrice : palladium?.ounce?.usdPrice,
          priceTola: tableCurrency === 'PKR' ? (palladium?.ounce?.pkrPrice || 0) * 0.375 : (palladium?.ounce?.usdPrice || 0) * 0.375,
          change: getChange(palladium?.ounce?.change),
          changePercent: palladium?.ounce?.changePercent || 0,
          weeklyPercent: commodities?.palladium?.weekly,
          monthPercent: commodities?.palladium?.monthly,
          yearPercent: commodities?.palladium?.yearly,
          type: 'Palladium'
        },
        {
          name: 'Copper',
          priceOunce: getPrice(commodities?.copper?.price),
          change: getChange(commodities?.copper?.change),
          changePercent: commodities?.copper?.changePercent,
          weeklyPercent: commodities?.copper?.weekly,
          monthPercent: commodities?.copper?.monthly,
          yearPercent: commodities?.copper?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Steel',
          priceOunce: getPrice(commodities?.steel?.price),
          change: getChange(commodities?.steel?.change),
          changePercent: commodities?.steel?.changePercent,
          weeklyPercent: commodities?.steel?.weekly,
          monthPercent: commodities?.steel?.monthly,
          yearPercent: commodities?.steel?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Lithium',
          priceOunce: getPrice(commodities?.lithium?.price),
          change: getChange(commodities?.lithium?.change),
          changePercent: commodities?.lithium?.changePercent,
          weeklyPercent: commodities?.lithium?.weekly,
          monthPercent: commodities?.lithium?.monthly,
          yearPercent: commodities?.lithium?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Iron Ore',
          priceOunce: getPrice(commodities?.ironOre?.price),
          change: getChange(commodities?.ironOre?.change),
          changePercent: commodities?.ironOre?.changePercent,
          weeklyPercent: commodities?.ironOre?.weekly,
          monthPercent: commodities?.ironOre?.monthly,
          yearPercent: commodities?.ironOre?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Aluminum',
          priceOunce: getPrice(commodities?.aluminum?.price),
          change: getChange(commodities?.aluminum?.change),
          changePercent: commodities?.aluminum?.changePercent,
          weeklyPercent: commodities?.aluminum?.weekly,
          monthPercent: commodities?.aluminum?.monthly,
          yearPercent: commodities?.aluminum?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Nickel',
          priceOunce: getPrice(commodities?.nickel?.price),
          change: getChange(commodities?.nickel?.change),
          changePercent: commodities?.nickel?.changePercent,
          weeklyPercent: commodities?.nickel?.weekly,
          monthPercent: commodities?.nickel?.monthly,
          yearPercent: commodities?.nickel?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Zinc',
          priceOunce: getPrice(commodities?.zinc?.price),
          change: getChange(commodities?.zinc?.change),
          changePercent: commodities?.zinc?.changePercent,
          weeklyPercent: commodities?.zinc?.weekly,
          monthPercent: commodities?.zinc?.monthly,
          yearPercent: commodities?.zinc?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Lead',
          priceOunce: getPrice(commodities?.lead?.price),
          change: getChange(commodities?.lead?.change),
          changePercent: commodities?.lead?.changePercent,
          weeklyPercent: commodities?.lead?.weekly,
          monthPercent: commodities?.lead?.monthly,
          yearPercent: commodities?.lead?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Tin',
          priceOunce: getPrice(commodities?.tin?.price),
          change: getChange(commodities?.tin?.change),
          changePercent: commodities?.tin?.changePercent,
          weeklyPercent: commodities?.tin?.weekly,
          monthPercent: commodities?.tin?.monthly,
          yearPercent: commodities?.tin?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Cobalt',
          priceOunce: getPrice(commodities?.cobalt?.price),
          change: getChange(commodities?.cobalt?.change),
          changePercent: commodities?.cobalt?.changePercent,
          weeklyPercent: commodities?.cobalt?.weekly,
          monthPercent: commodities?.cobalt?.monthly,
          yearPercent: commodities?.cobalt?.yearly,
          type: 'Industrial'
        },
        {
          name: 'Uranium',
          priceOunce: getPrice(commodities?.uranium?.price),
          change: getChange(commodities?.uranium?.change),
          changePercent: commodities?.uranium?.changePercent,
          weeklyPercent: commodities?.uranium?.weekly,
          monthPercent: commodities?.uranium?.monthly,
          yearPercent: commodities?.uranium?.yearly,
          type: 'Industrial'
        },
      ];
      setDetailedRates(rates);
    }
  }, [rawMarketData, tableCurrency]);

  // Refs to keep random data stable between refreshes
  const stableTrendRef = useRef<Record<string, any[]>>({});
  const stableCandlesRef = useRef<Record<string, any[]>>({});

  // Separate effect for trend and candlestick generation to react to timeframe changes
  useEffect(() => {
    if (!rawMarketData) return;
    const { gold, silver } = rawMarketData;

    const isPkr = tableCurrency === 'PKR';
    const currentGoldPrice = isPkr ? (gold?.tola24k?.pkrPrice || 285000) : (gold?.tola24k?.usdPrice || 980);
    const currentSilverPrice = isPkr ? (silver?.ounce?.pkrPrice || 3500) : (silver?.ounce?.usdPrice || 31);

    const currentPrice = trendMetal === 'gold' ? currentGoldPrice : currentSilverPrice;

    const trendKey = `${trendMetal}-${trendTimeframe}-${tableCurrency}`;

    const updateTrendData = () => {
      let points = 24;
      let interval = 3600 * 1000;
      let volatility = 0.005;

      if (trendTimeframe === 'Daily') { points = 24; interval = 3600 * 1000; volatility = 0.002; }
      if (trendTimeframe === 'Weekly') { points = 7; interval = 24 * 3600 * 1000; volatility = 0.008; }
      if (trendTimeframe === 'Monthly') { points = 30; interval = 24 * 3600 * 1000; volatility = 0.01; }
      if (trendTimeframe === 'Yearly') { points = 52; interval = 7 * 24 * 3600 * 1000; volatility = 0.015; }

      // If we already have stable data for this config, just update the LAST point
      if (stableTrendRef.current[trendKey] && stableTrendRef.current[trendKey].length === points) {
        const existing = [...stableTrendRef.current[trendKey]];
        existing[existing.length - 1] = {
          ...existing[existing.length - 1],
          price: isPkr ? Math.round(currentPrice) : parseFloat(currentPrice.toFixed(2))
        };
        stableTrendRef.current[trendKey] = existing;
        setTrendData(existing);
        return;
      }

      console.log(`[TrendChart] Generating new stable data for ${trendKey}`);
      const newTrendData = [];
      const now = Date.now();
      let currentSimPrice = currentPrice;
      const prices = [currentPrice];
      const times = [now];

      for (let i = 1; i < points; i++) {
        const trendBias = (trendTimeframe === 'Yearly' || trendTimeframe === 'Monthly') ? 0.001 : 0;
        const change = (Math.random() - 0.5) * (volatility * 2);
        const prevPrice = currentSimPrice * (1 - change - trendBias);
        currentSimPrice = prevPrice;
        prices.push(prevPrice);
        times.push(now - i * interval);
      }

      for (let i = points - 1; i >= 0; i--) {
        const time = new Date(times[i]);
        let label = (trendTimeframe === 'Daily')
          ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : time.toLocaleDateString([], { month: 'short', day: 'numeric' });

        newTrendData.push({
          name: label,
          price: isPkr ? Math.round(prices[i]) : parseFloat(prices[i].toFixed(2))
        });
      }
      stableTrendRef.current[trendKey] = newTrendData;
      setTrendData(newTrendData);
    };

    const generateCandles = (basePrice: number, tf: string, metal: string) => {
      const candleKey = `${metal}-${tf}-${tableCurrency}`;

      // If already exists, just update last candle
      if (stableCandlesRef.current[candleKey] && stableCandlesRef.current[candleKey].length > 0) {
        const existing = [...stableCandlesRef.current[candleKey]];
        const lastIndex = existing.length - 1;
        const last = { ...existing[lastIndex] };
        
        // Ensure the last candle's close is synced with the latest market price
        last.close = basePrice;
        last.high = Math.max(last.high, basePrice);
        last.low = Math.min(last.low, basePrice);
        
        existing[lastIndex] = last;
        stableCandlesRef.current[candleKey] = existing;
        return existing;
      }

      let count = 60;
      let seconds = 3600; // 1H
      if (tf === "1D") { seconds = 86400; count = 45; }
      if (tf === "1W") { seconds = 604800; count = 52; }
      if (tf === "1M") { seconds = 2592000; count = 24; }

      const candles = [];
      const now = Math.floor(Date.now() / 1000);
      let currentPrice = basePrice;
      const volatility = tf === "1M" ? 0.05 : tf === "1W" ? 0.03 : tf === "1D" ? 0.015 : 0.005;

      // Generate candles from newest to oldest
      for (let i = 0; i < count; i++) {
        const time = now - i * seconds;
        const change = (Math.random() - 0.5) * volatility;
        
        const close = currentPrice;
        const open = close / (1 + change); // Walk backwards
        
        const high = Math.max(open, close) * (1 + Math.random() * (volatility * 0.3));
        const low = Math.min(open, close) * (1 - Math.random() * (volatility * 0.3));
        
        candles.unshift({ 
          time: time, 
          open: parseFloat(open.toFixed(4)), 
          high: parseFloat(high.toFixed(4)), 
          low: parseFloat(low.toFixed(4)), 
          close: parseFloat(close.toFixed(4)),
          volume: Math.floor(Math.random() * 1000) + 500
        });
        
        currentPrice = open;
      }

      stableCandlesRef.current[candleKey] = candles;
      return candles;
    };

    updateTrendData();
    setGoldCandles(generateCandles(currentGoldPrice, goldChartTF, 'gold'));
    setSilverCandles(generateCandles(currentSilverPrice, silverChartTF, 'silver'));
  }, [rawMarketData, trendTimeframe, trendMetal, goldChartTF, silverChartTF, tableCurrency]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-blue-500/30 overflow-x-hidden">
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm w-full">
        <div className="px-4 sm:px-8 py-4 sm:py-6 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
            <div>
              <h1 className="text-xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2 uppercase italic tracking-tighter">
                💎 Precious Metals
                <span className="bg-blue-500 text-white text-[8px] sm:text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">
                  Live
                </span>
              </h1>
              <p className="hidden sm:flex text-zinc-500 dark:text-zinc-400 text-[10px] mt-1 items-center gap-2 uppercase font-black tracking-widest">
                <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`}></span>
                {loading ? "Fetching latest market data..." : `Last updated: ${new Date().toLocaleString()}`}
              </p>
            </div>

            <div className="flex w-full sm:w-auto items-center gap-3">
              <div className="flex flex-1 sm:flex-none bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 border border-zinc-200 dark:border-zinc-700">
                <button onClick={() => updateSettings({ currency: 'PKR' })} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${tableCurrency === 'PKR' ? 'bg-white dark:bg-zinc-700 shadow text-green-600 dark:text-green-400' : 'text-zinc-500 hover:text-zinc-900'}`}>PKR</button>
                <button onClick={() => updateSettings({ currency: 'USD' })} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${tableCurrency === 'USD' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900'}`}>USD</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-[1600px] mx-auto w-full">
        {error && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
            <p className="text-amber-800 dark:text-amber-200 text-sm">⚠️ {error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 items-stretch mb-6">
          {metalPrices
            .filter(m => !["Gold (24K) - Per Ounce", "Silver - Per Kilogram"].includes(m.title))
            .map((metal) => (
              <PriceCard key={metal.title} {...metal} currency={tableCurrency} />
            ))}
        </div>

        <div className="flex justify-center mb-12">
          <button 
            onClick={() => setShowMore(!showMore)}
            className="group flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-8 py-3 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-blue-500/50"
          >
            <div className={`w-8 h-8 ${showMore ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-blue-50 dark:bg-blue-900/20'} rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500`}>
              <svg className={`w-5 h-5 ${showMore ? 'text-zinc-600 dark:text-zinc-400' : 'text-blue-600 dark:text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={showMore ? "M20 12H4" : "M12 4v16m8-8H4"} />
              </svg>
            </div>
            <span className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">
              {showMore ? "Hide Price Calculator" : "Analyze Custom Weight"}
            </span>
          </button>
        </div>

        {showMore && (
          <div className="mt-8 animate-in fade-in slide-in-from-top-6 duration-500">
            <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-8 md:p-12 shadow-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                <span className="text-9xl font-black italic text-blue-500 uppercase select-none font-mono">CALC</span>
              </div>
              
              <div className="relative z-10">
                <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter mb-12 flex items-center gap-3">
                  <span className="w-12 h-1.5 bg-blue-600 rounded-full"></span>
                  Metal Price Calculator
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                  <div className="space-y-10">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-2">Selection Logic</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setCalcMetal('gold')}
                          className={`flex items-center justify-center gap-3 p-5 rounded-3xl border-2 transition-all duration-300 font-bold ${calcMetal === 'gold' ? 'bg-amber-500/10 border-amber-500 text-amber-600' : 'bg-zinc-50 dark:bg-zinc-800 border-transparent text-zinc-500'}`}
                        >
                          <span className="text-xl">🏆</span> Gold (24K)
                        </button>
                        <button 
                          onClick={() => setCalcMetal('silver')}
                          className={`flex items-center justify-center gap-3 p-5 rounded-3xl border-2 transition-all duration-300 font-bold ${calcMetal === 'silver' ? 'bg-zinc-500/10 border-zinc-500 text-zinc-600' : 'bg-zinc-50 dark:bg-zinc-800 border-transparent text-zinc-500'}`}
                        >
                          <span className="text-xl">🔘</span> Silver (999)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {calcMetal === 'gold' && (
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-2">Purity Grade</label>
                          <select 
                            value={calcPurity}
                            onChange={(e) => setCalcPurity(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-3xl p-5 font-bold transition-all focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-50"
                          >
                            <option value="24K">24K (99.9%)</option>
                            <option value="22K">22K (91.6%)</option>
                            <option value="21K">21K (87.5%)</option>
                            <option value="18K">18K (75.0%)</option>
                          </select>
                        </div>
                      )}
                      <div className="space-y-4 flex-1">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-2">Weight Metric</label>
                        <select 
                          value={calcUnit}
                          onChange={(e) => setCalcUnit(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-3xl p-5 font-bold transition-all focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-50"
                        >
                          <option value="Tola">Tola</option>
                          <option value="Gram">Gram</option>
                          <option value="Ounce">Ounce (oz)</option>
                          <option value="Kg">Kilogram (kg)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-2">Execution Quantity</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={calcQuantity}
                          onChange={(e) => setCalcQuantity(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-3xl p-6 text-2xl font-black transition-all focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-50 font-mono"
                          placeholder="0.00"
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 font-black uppercase tracking-widest text-xs pointer-events-none">
                          {calcUnit}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center items-center bg-blue-600 rounded-[2.5rem] p-12 text-white shadow-2xl shadow-blue-500/20 relative group overflow-hidden">
                    {/* Animated background pulse */}
                    <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors pointer-events-none" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    
                    <div className="relative z-10 text-center space-y-8 w-full">
                      <p className="text-[12px] font-black uppercase tracking-[0.4em] text-blue-100/60">Estimated Market Value</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-4">
                          <span className="text-4xl font-medium text-blue-200 lowercase">{tableCurrency === 'PKR' ? 'Rs.' : '$'}</span>
                          <span className="text-7xl font-black tracking-tighter font-mono break-all line-clamp-1">
                            {(() => {
                              const isPkr = tableCurrency === 'PKR';
                              let basePrice = 0;
                              
                              if (calcMetal === 'gold') {
                                if (calcUnit === 'Tola') basePrice = isPkr ? (metalPrices[1].pkrPrice || 0) : (metalPrices[1].usdPrice || 0);
                                else if (calcUnit === 'Gram') basePrice = isPkr ? (metalPrices[0].pkrPrice || 0) : (metalPrices[0].usdPrice || 0);
                                else if (calcUnit === 'Ounce') basePrice = isPkr ? (metalPrices[2].pkrPrice || 0) : (metalPrices[2].usdPrice || 0);
                                else if (calcUnit === 'Kg') basePrice = (isPkr ? (metalPrices[0].pkrPrice || 0) : (metalPrices[0].usdPrice || 0)) * 1000;
                                
                                const purityRatio = (parseInt(calcPurity) || 24) / 24;
                                return (basePrice * purityRatio * calcQuantity).toLocaleString(undefined, { maximumFractionDigits: 0 });
                              } else {
                                if (calcUnit === 'Tola') basePrice = isPkr ? (metalPrices[3].pkrPrice || 0) : (metalPrices[3].usdPrice || 0);
                                else if (calcUnit === 'Ounce') basePrice = isPkr ? (metalPrices[4].pkrPrice || 0) : (metalPrices[4].usdPrice || 0);
                                else if (calcUnit === 'Kg') basePrice = isPkr ? (metalPrices[5].pkrPrice || 0) : (metalPrices[5].usdPrice || 0);
                                else if (calcUnit === 'Gram') basePrice = (isPkr ? (metalPrices[3].pkrPrice || 0) : (metalPrices[3].usdPrice || 0)) / 11.6638;
                                
                                return (basePrice * calcQuantity).toLocaleString(undefined, { maximumFractionDigits: 0 });
                              }
                            })()}
                          </span>
                        </div>
                        <p className="text-blue-100/40 text-[10px] font-black uppercase tracking-widest">
                          Calculated at {new Date().toLocaleTimeString()}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-8 border-t border-white/10">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-blue-200/50 uppercase">Current Bid</p>
                          <p className="font-bold text-lg">
                            {tableCurrency === 'PKR' ? 'Rs.' : '$'}
                            {(tableCurrency === 'PKR' 
                              ? metalPrices[calcMetal === 'gold' ? 1 : 3].pkrPrice 
                              : metalPrices[calcMetal === 'gold' ? 1 : 3].usdPrice || 0
                            )?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-blue-200/50 uppercase">Base Spread</p>
                          <p className="font-bold text-lg">0.05% Fixed</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 bg-white dark:bg-zinc-900 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-4 sm:p-8 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2 uppercase italic tracking-tighter">
                Spot Market Rates 
                <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">{tableCurrency}</span>
              </h2>
            </div>
            <button 
              onClick={() => setShowPurity(!showPurity)}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border transition-all duration-300 font-black uppercase text-[10px] tracking-widest ${showPurity ? 'bg-amber-500 border-amber-500 text-white' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-amber-600'}`}
            >
              <span>{showPurity ? '👑' : '💎'}</span>
              {showPurity ? "Hide Purity Guide" : "Analyze Purity"}
            </button>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white dark:bg-zinc-900">
                <tr className="border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                  <th className="p-4 font-normal text-xs uppercase">Last Updated</th>
                  <th className="p-4 font-normal text-xs uppercase">Metal</th>
                  <th className="p-4 font-normal text-xs uppercase text-right">Price (Ounce)</th>
                  <th className="p-4 font-normal text-xs uppercase text-right">Price (Tola)</th>
                  <th className="p-4 font-normal text-xs uppercase text-center">Daily</th>
                  <th className="p-4 font-normal text-xs uppercase text-center">Weekly</th>
                  <th className="p-4 font-normal text-xs uppercase text-center">Monthly</th>
                  <th className="p-4 font-normal text-xs uppercase text-center">Yearly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {detailedRates.map((item) => (
                  <tr key={item.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="p-4 text-[10px] text-zinc-500">{new Date().toLocaleString()}</td>
                    <td className="p-4 font-bold text-zinc-900 dark:text-zinc-50">{item.name}</td>
                    <td className="p-4 text-right font-mono font-medium">{item.priceOunce ? (tableCurrency === 'PKR' ? 'Rs. ' : '$') + item.priceOunce.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}</td>
                    <td className="p-4 text-right font-mono font-medium">{item.priceTola ? (tableCurrency === 'PKR' ? 'Rs. ' : '$') + item.priceTola.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}</td>
                    <td className="p-4 text-center">
                      <span className={`text-xs font-bold ${(item.changePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{item.changePercent ? (item.changePercent > 0 ? '+' : '') + item.changePercent + '%' : '-'}</span>
                    </td>
                    <td className="p-4 text-center">{item.weeklyPercent ? item.weeklyPercent + '%' : '-'}</td>
                    <td className="p-4 text-center">{item.monthPercent ? item.monthPercent + '%' : '-'}</td>
                    <td className="p-4 text-center">{item.yearPercent ? item.yearPercent + '%' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* showPurity Toggle moved to Table Header below for better UX */}

        <div className="mt-12 space-y-12">
          {/* Purity Breakdown Modal */}
          {showPurity && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300"
                onClick={() => setShowPurity(false)}
              ></div>
              
              <div className="relative bg-white dark:bg-[#050505] rounded-[3rem] p-8 md:p-12 shadow-2xl border border-zinc-200 dark:border-white/5 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
                
                <div className="flex justify-between items-center mb-10 shrink-0">
                  <div>
                    <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Gold Purity Breakdown</h2>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Institutional Valuation Reference Guide</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <select
                      value={purityUnit}
                      onChange={(e) => setPurityUnit(e.target.value)}
                      className="bg-zinc-100 dark:bg-white/5 border-none rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer outline-none"
                    >
                      <option value="Tola">Per Tola</option>
                      <option value="Gram">Per Gram</option>
                      <option value="Ounce">Per Ounce</option>
                      <option value="Kg">Per Kg</option>
                    </select>
                    <button 
                      onClick={() => setShowPurity(false)}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors text-zinc-500 dark:text-zinc-400"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto pr-4 custom-scrollbar">
                  <table className="w-full text-left text-sm border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-zinc-400">
                        <th className="pb-4 px-4 font-black uppercase tracking-widest text-[10px]">Reference</th>
                        <th className="pb-4 px-4 font-black uppercase tracking-widest text-[10px]">Grade</th>
                        <th className="pb-4 px-4 font-black uppercase tracking-widest text-[10px]">Purity</th>
                        <th className="pb-4 px-4 font-black uppercase tracking-widest text-[10px] text-right">{tableCurrency} Market Rate</th>
                        <th className="pb-4 px-4 font-black uppercase tracking-widest text-[10px] text-right">Movement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caratPrices.map((item) => {
                        let factor = 1;
                        if (purityUnit === "Gram") factor = 1 / 11.6638;
                        if (purityUnit === "Ounce") factor = 1 / 0.375;
                        if (purityUnit === "Kg") factor = 1000 / 11.6638;
                        const displayPrice = tableCurrency === 'PKR' ? item.pkr * factor : item.usd * factor;
                        const displayChange = item.change * factor;
                        return (
                          <tr key={item.carat} className="bg-zinc-50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/5 transition-all group">
                            <td className="py-5 px-4 first:rounded-l-2xl text-[10px] font-mono text-zinc-500 border-y border-l border-transparent dark:border-white/5">{new Date().toLocaleTimeString()}</td>
                            <td className="py-5 px-4 font-black text-amber-600 italic text-lg border-y border-transparent dark:border-white/5">{item.carat}</td>
                            <td className="py-5 px-4 font-bold text-zinc-400 border-y border-transparent dark:border-white/5">{item.purity}% Pure</td>
                            <td className="py-5 px-4 font-mono font-black text-zinc-900 dark:text-zinc-50 text-right text-lg border-y border-transparent dark:border-white/5">
                              {tableCurrency === 'PKR' ? 'Rs.' : '$'} {displayPrice.toLocaleString(undefined, { maximumFractionDigits: purityUnit === 'Tola' || purityUnit === 'Kg' ? 0 : 2 })}
                            </td>
                            <td className={`py-5 px-4 last:rounded-r-2xl font-black text-right border-y border-r border-transparent dark:border-white/5 ${displayChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {displayChange >= 0 ? '+' : ''}{displayChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  <div className="mt-10 p-6 bg-amber-500/5 rounded-[2rem] border border-amber-500/10">
                    <p className="text-[10px] text-amber-500/70 font-black uppercase tracking-widest text-center">Calculations based on 24K Gold Reference of {tableCurrency === 'PKR' ? 'Rs.' : '$'}{(tableCurrency === 'PKR' ? caratPrices[0]?.pkr : caratPrices[0]?.usd)?.toLocaleString()} per Tola</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Main Velocity Terminal */}
          <div className="bg-white dark:bg-zinc-900 rounded-[3.5rem] p-10 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                <span className="text-[12rem] font-black italic text-amber-500 uppercase select-none">{trendMetal}</span>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8 relative z-10">
              <div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 uppercase italic tracking-tighter">Velocity Terminal</h2>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Global Sentiment Explorer: {trendMetal}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 shadow-inner h-fit">
                  <button onClick={() => setTrendMetal('gold')} className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${trendMetal === 'gold' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-zinc-500'}`}>Gold</button>
                  <button onClick={() => setTrendMetal('silver')} className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${trendMetal === 'silver' ? 'bg-zinc-500 text-white shadow-lg shadow-zinc-500/20' : 'text-zinc-500'}`}>Silver</button>
                </div>
              </div>
            </div>
            <div className="h-[400px] sm:h-[600px] w-full relative z-10">
              <TradingChart 
                title={`${trendMetal.toUpperCase()} Snapshot Analysis`} 
                data={trendMetal === 'gold' ? goldCandles : silverCandles} 
                currentTimeframe={trendMetal === 'gold' ? goldChartTF : silverChartTF} 
                onTimeframeChange={trendMetal === 'gold' ? setGoldChartTF : setSilverChartTF} 
                currencySymbol={tableCurrency === 'PKR' ? 'Rs.' : '$'} 
                seamless={true}
              />
            </div>
          </div>
        </div>

        {/* Bottom charts removed in favor of integrated velocity terminal above */}
      </div>
    </div>
  );
}
