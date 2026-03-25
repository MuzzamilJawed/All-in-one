"use client";

import PriceCard from "../components/PriceCard";
import dynamic from 'next/dynamic';
const TradingChart = dynamic(() => import('../components/TradingChart'), { ssr: false });
import { useState, useEffect, useCallback, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
// Use internal API routes to avoid CORS and run scraping/server code server-side
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function MetalsPage() {
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
  const [tableCurrency, setTableCurrency] = useState<'PKR' | 'USD'>('PKR');
  const [detailedRates, setDetailedRates] = useState<any[]>([]);
  const [rawMarketData, setRawMarketData] = useState<any>(null);
  const [purityUnit, setPurityUnit] = useState('Tola'); // 'Tola' | 'Gram' | 'Ounce' | 'Kg'

  const { settings } = useSettings();

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

      let seconds = 3600, count = 48;
      if (tf === "1D") { seconds = 86400; count = 30; }
      if (tf === "1W") { seconds = 604800; count = 52; }
      if (tf === "1M") { seconds = 2592000; count = 24; }

      // If already exists, just update last candle
      if (stableCandlesRef.current[candleKey] && stableCandlesRef.current[candleKey].length > 0) {
        const existing = [...stableCandlesRef.current[candleKey]];
        const last = { ...existing[existing.length - 1] };
        last.close = basePrice;
        last.high = Math.max(last.high, basePrice);
        last.low = Math.min(last.low, basePrice);
        existing[existing.length - 1] = last;
        stableCandlesRef.current[candleKey] = existing;
        return existing;
      }

      const candles = [];
      const now = Math.floor(Date.now() / 1000);
      for (let i = count; i >= 0; i--) {
        const time = now - i * seconds;
        const vol = tf === "1M" ? 0.08 : tf === "1W" ? 0.05 : tf === "1D" ? 0.02 : 0.005;
        const open = basePrice * (1 + (Math.random() - 0.5) * vol);
        const close = i === 0 ? basePrice : open * (1 + (Math.random() - 0.5) * (vol * 0.8));
        const high = Math.max(open, close) * (1 + Math.random() * (vol * 0.4));
        const low = Math.min(open, close) * (1 - Math.random() * (vol * 0.4));
        candles.push({ time, open, high, low, close });
      }
      stableCandlesRef.current[candleKey] = candles;
      return candles;
    };

    updateTrendData();
    setGoldCandles(generateCandles(currentGoldPrice, goldChartTF, 'gold'));
    setSilverCandles(generateCandles(currentSilverPrice, silverChartTF, 'silver'));
  }, [rawMarketData, trendTimeframe, trendMetal, goldChartTF, silverChartTF, tableCurrency]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black overflow-x-hidden w-full">
      <div className="sticky top-0 z-40 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm w-full">
        <div className="px-4 sm:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                💎 Metal Prices
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                  Live
                </span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`}></span>
                {loading ? "Fetching latest market data..." : `Last updated: ${new Date().toLocaleString()}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                <button onClick={() => setTableCurrency('PKR')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${tableCurrency === 'PKR' ? 'bg-white dark:bg-zinc-700 shadow text-green-600 dark:text-green-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}>PKR</button>
                <button onClick={() => setTableCurrency('USD')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${tableCurrency === 'USD' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}>USD</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
        {error && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
            <p className="text-amber-800 dark:text-amber-200 text-sm">⚠️ {error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {metalPrices.map((metal) => (
            <PriceCard key={metal.title} {...metal} currency={tableCurrency} />
          ))}
        </div>

        <div className="mt-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">Live Metal Rates <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{tableCurrency}</span></h2>
          </div>
          <div className="overflow-x-auto">
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

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Gold Purity Breakdown</h2>
              <select
                value={purityUnit}
                onChange={(e) => setPurityUnit(e.target.value)}
                className="text-xs bg-zinc-100 dark:bg-zinc-800 border-none rounded-md px-2 py-1 focus:ring-1 focus:ring-amber-500"
              >
                <option value="Tola">Per Tola</option>
                <option value="Gram">Per Gram</option>
                <option value="Ounce">Per Ounce</option>
                <option value="Kg">Per Kg</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left">
                    <th className="py-2 px-2">Last Updated</th>
                    <th className="py-2 px-2">Carat</th>
                    <th className="py-2 px-2">Purity</th>
                    <th className="py-2 px-2">{tableCurrency} ({purityUnit})</th>
                    <th className="py-2 px-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {caratPrices.map((item) => {
                    // Conversion factors from Tola
                    let factor = 1;
                    if (purityUnit === "Gram") factor = 1 / 11.6638;
                    if (purityUnit === "Ounce") factor = 1 / 0.375;
                    if (purityUnit === "Kg") factor = 1000 / 11.6638;

                    const displayPrice = tableCurrency === 'PKR' ? item.pkr * factor : item.usd * factor;
                    const displayChange = item.change * factor;

                    return (
                      <tr key={item.carat} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-3 px-2 text-[10px] text-zinc-500">{new Date().toLocaleString()}</td>
                        <td className="py-3 px-2 font-bold">{item.carat}</td>
                        <td className="py-3 px-2 text-zinc-500">{item.purity}%</td>
                        <td className="py-3 px-2 font-semibold">
                          {tableCurrency === 'PKR' ? 'Rs.' : '$'} {displayPrice.toLocaleString(undefined, { maximumFractionDigits: purityUnit === 'Tola' || purityUnit === 'Kg' ? 0 : 2 })}
                        </td>
                        <td className={`py-3 px-2 ${displayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {displayChange >= 0 ? '+' : ''}{displayChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Price Trends</h2>
              <div className="flex flex-wrap gap-2">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-md p-1 mr-2">
                  {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTrendTimeframe(tf)}
                      className={`px-2 py-1 text-[10px] font-bold rounded ${trendTimeframe === tf ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-md p-1">
                  <button onClick={() => setTrendMetal('gold')} className={`px-3 py-1 text-[10px] font-bold rounded ${trendMetal === 'gold' ? 'bg-amber-500 text-white shadow' : 'text-zinc-500'}`}>Gold</button>
                  <button onClick={() => setTrendMetal('silver')} className={`px-3 py-1 text-[10px] font-bold rounded ${trendMetal === 'silver' ? 'bg-slate-400 text-white shadow' : 'text-zinc-500'}`}>Silver</button>
                </div>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trendMetal === 'gold' ? "#fbbf24" : "#94a3b8"} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={trendMetal === 'gold' ? "#fbbf24" : "#0"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => {
                      if (tableCurrency === 'PKR') {
                        return v >= 1000 ? `Rs.${(v / 1000).toFixed(1)}k` : `Rs.${v}`;
                      }
                      return `$${v.toLocaleString()}`;
                    }}
                  />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }} formatter={(v: any) => [tableCurrency === 'PKR' ? `Rs. ${Number(v).toLocaleString()}` : `$${Number(v).toLocaleString()}`, 'Price']} />
                  <Area type="monotone" dataKey="price" stroke={trendMetal === 'gold' ? "#fbbf24" : "#94a3b8"} fillOpacity={1} fill="url(#colorPrice)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">Market Analysis (Candlestick)</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <TradingChart title={`Gold (${tableCurrency}/${tableCurrency === 'PKR' ? 'Tola' : 'Oz'})`} data={goldCandles} currentTimeframe={goldChartTF} onTimeframeChange={setGoldChartTF} />
            <TradingChart title={`Silver (${tableCurrency}/Oz)`} data={silverCandles} currentTimeframe={silverChartTF} onTimeframeChange={setSilverChartTF} />
          </div>
        </div>
      </div>
    </div>
  );
}
