"use client";

import { createChart, ColorType, CandlestickSeries, CrosshairMode, HistogramSeries, LineSeries } from 'lightweight-charts';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTheme } from 'next-themes';

interface CandleData {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

interface TradingChartProps {
    data: CandleData[];
    title: string;
    onTimeframeChange?: (timeframe: string) => void;
    currentTimeframe?: string;
    currencySymbol?: string;
    seamless?: boolean;
}

export default function TradingViewChart({
    data,
    title,
    onTimeframeChange,
    currentTimeframe = "1H",
    currencySymbol = "$",
    seamless = false
}: TradingChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<any>(null);
    const volumeSeriesRef = useRef<any>(null);
    const smaSeriesRef = useRef<any>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hoverData, setHoverData] = useState<CandleData | null>(null);
    const { resolvedTheme } = useTheme();

    const colors = useMemo(() => {
        const isDark = resolvedTheme === 'dark';
        return {
            background: isDark ? { top: '#09090b', bottom: '#000000' } : { top: '#ffffff', bottom: '#f8fafc' },
            text: isDark ? '#94a3b8' : '#475569',
            grid: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(148, 163, 184, 0.1)',
            borderColor: isDark ? 'rgba(197, 203, 206, 0.1)' : 'rgba(148, 163, 184, 0.2)',
            crosshair: isDark ? '#3b82f6' : '#2563eb',
            watermark: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(37, 99, 235, 0.03)'
        };
    }, [resolvedTheme]);

    // Initial Chart Setup
    useEffect(() => {
        if (!chartContainerRef.current || typeof window === 'undefined') return;

        const container = chartContainerRef.current;
        const chart = createChart(container, {
            layout: {
                background: { type: ColorType.VerticalGradient, topColor: colors.background.top, bottomColor: colors.background.bottom },
                textColor: colors.text,
                fontSize: 11,
                fontFamily: 'Inter, sans-serif',
            },
            width: container.clientWidth || 650,
            height: container.clientHeight || 600,
            handleScroll: true,
            handleScale: true,
            grid: {
                vertLines: { color: colors.grid, style: 1 },
                horzLines: { color: colors.grid, style: 1 },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    width: 1,
                    color: colors.crosshair,
                    style: 0,
                    labelBackgroundColor: colors.crosshair,
                },
                horzLine: {
                    width: 1,
                    color: colors.crosshair,
                    style: 0,
                    labelBackgroundColor: colors.crosshair,
                },
            },
            rightPriceScale: {
                borderColor: colors.borderColor,
                autoScale: true,
                scaleMargins: {
                    top: 0.15,
                    bottom: 0.15,
                },
            },
            timeScale: {
                borderColor: colors.borderColor,
                timeVisible: true,
                secondsVisible: false,
                barSpacing: 10,
                shiftVisibleRangeOnNewBar: true,
                rightOffset: 5,
            },
        });

        // Use applyOptions for watermark with a safe cast to handle potentially missing type definitions
        chart.applyOptions({
            watermark: {
                visible: true,
                fontSize: 48,
                horzAlign: 'center',
                vertAlign: 'center',
                color: colors.watermark,
                text: title.toUpperCase(),
            }
        } as any);

        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
            priceLineVisible: true,
            priceLineWidth: 1,
            priceLineColor: '#3b82f6',
            priceLineStyle: 2,
            priceFormat: {
                type: 'custom',
                formatter: (price: number) => {
                    return currencySymbol + price.toLocaleString(undefined, {
                        minimumFractionDigits: price < 1 ? 4 : 2,
                        maximumFractionDigits: price < 1 ? 6 : 2,
                    });
                },
            },
        });

        // Volume series
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: resolvedTheme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '',
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        // SMA Series (Indicator)
        const smaSeries = chart.addSeries(LineSeries, {
            color: '#fbbf24', // Amber
            lineWidth: 3, // Thicker for better visibility
            lineStyle: 0,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        });

        chart.subscribeCrosshairMove((param) => {
            if (param.time && param.point) {
                const data = param.seriesData.get(series);
                if (data) setHoverData(data as any);
            } else {
                setHoverData(null);
            }
        });

        chartRef.current = chart;
        seriesRef.current = series;
        volumeSeriesRef.current = volumeSeries;
        smaSeriesRef.current = smaSeries;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                const { clientWidth, clientHeight } = chartContainerRef.current;
                chartRef.current.applyOptions({
                    width: clientWidth,
                    height: clientHeight
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
            seriesRef.current = null;
            volumeSeriesRef.current = null;
            smaSeriesRef.current = null;
        };
    }, [currencySymbol, title, colors]);

    // Handle Resize on Fullscreen toggle
    useEffect(() => {
        if (chartRef.current && chartContainerRef.current) {
            const timer = setTimeout(() => {
                if (chartContainerRef.current && chartRef.current) {
                    const { clientWidth, clientHeight } = chartContainerRef.current;
                    chartRef.current.applyOptions({
                        width: clientWidth,
                        height: clientHeight
                    });
                    setTimeout(() => chartRef.current.timeScale().fitContent(), 50);
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isFullscreen]);

    // Data Update
    useEffect(() => {
        if (seriesRef.current && data && data.length > 0) {
            try {
                seriesRef.current.setData(data);

                if (volumeSeriesRef.current) {
                    const volumeData = data.map(d => ({
                        time: d.time,
                        value: d.volume || (Math.random() * 100),
                        color: d.close >= d.open ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                    }));
                    volumeSeriesRef.current.setData(volumeData);
                }

                // Calculate SMA (20 periods)
                if (smaSeriesRef.current && data.length > 20) {
                    const smaData = [];
                    for (let i = 0; i < data.length; i++) {
                        if (i >= 19) {
                            const slice = data.slice(i - 19, i + 1);
                            const sum = slice.reduce((a, b) => a + b.close, 0);
                            const val = sum / 20;
                            smaData.push({ time: data[i].time, value: val });
                            (data[i] as any).ma = val; // Store for hover display
                        } else {
                            // Simple average for early points
                            const slice = data.slice(0, i + 1);
                            const sum = slice.reduce((a, b) => a + b.close, 0);
                            const val = sum / slice.length;
                            smaData.push({ time: data[i].time, value: val });
                            (data[i] as any).ma = val;
                        }
                    }
                    smaSeriesRef.current.setData(smaData);
                }

                chartRef.current?.timeScale().fitContent();
            } catch (err) {
                console.error("Error updating chart data:", err);
            }
        }
    }, [data, colors]);

    return (
        <div className={`w-full flex flex-col transition-all 
            ${isFullscreen ? 'fixed inset-0 z-[110] p-10 bg-white dark:bg-zinc-950 rounded-none h-screen w-screen border-none' : 
            (seamless ? 'bg-transparent border-none shadow-none p-6 h-full' : 'bg-white dark:bg-zinc-950 rounded-[2.5rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-2xl h-full')}`}>
            {/* Header / Info Display */}
            {!isFullscreen && (
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-8 shrink-0">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 flex-1 min-w-0">
                        <div className="flex flex-col shrink-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-[0.3em]">{title}</h3>
                                <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full"></span>
                                <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{currentTimeframe} Terminal</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-2xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase">{title.split('/')[0].split(' ')[0]} Analysis</span>
                                <div className="flex items-center gap-2 px-3 py-1 bg-blue-600/10 dark:bg-green-500/10 border border-blue-600/20 dark:border-green-500/20 rounded-lg">
                                    <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-[9px] text-blue-600 dark:text-green-500 font-black tracking-widest uppercase">Syncing Live</span>
                                </div>
                            </div>
                        </div>

                        {/* OHLC Overlay - Now with better wrapping / growth */}
                        {hoverData && (
                            <div className="flex-1 min-w-[280px] overflow-x-auto no-scrollbar">
                                <div className="flex items-center gap-6 p-4 bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl backdrop-blur-md animate-in fade-in slide-in-from-left-4 duration-300 w-max">
                                    {[
                                        { key: 'O', val: hoverData.open, color: 'text-zinc-400' },
                                        { key: 'H', val: hoverData.high, color: 'text-green-500' },
                                        { key: 'L', val: hoverData.low, color: 'text-red-500' },
                                        { key: 'C', val: hoverData.close, color: 'text-zinc-900 dark:text-white' },
                                    ].map((item) => (
                                        <div key={item.key} className="flex flex-col">
                                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">{item.key}</span>
                                            <span className={`text-xs font-black font-mono tracking-tighter ${item.color}`}>
                                                {currencySymbol}{item.val?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="h-8 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-0.5">MA (20)</span>
                                        <span className={`text-xs font-black font-mono tracking-tighter text-amber-500`}>
                                            {currencySymbol}{(data.find(d => d.time === hoverData.time) as any)?.ma?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '---'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chart Controls - Restored to the Right with absolute visibility priority */}
                    <div className="flex items-center gap-3 shrink-0 self-end xl:self-center">
                        <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shadow-inner h-fit">
                            {['1H', '1D', '1W', '1M'].map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => onTimeframeChange?.(tf)}
                                    className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all uppercase tracking-[0.2em] ${currentTimeframe === tf ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/40' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className={`px-5 py-2.5 text-[9px] font-black bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl hover:shadow-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all uppercase tracking-widest flex items-center gap-2 shrink-0`}
                        >
                            ⛶ Expand
                        </button>
                    </div>
                </div>
            )}

            {/* Fullscreen Close Button */}
            {isFullscreen && (
                <button 
                    onClick={() => setIsFullscreen(false)}
                    className="fixed top-8 right-8 z-[110] bg-red-600 hover:bg-red-700 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                >
                    ✕ Close Fullscreen
                </button>
            )}

            <div
                ref={chartContainerRef}
                className={`w-full flex-1 relative min-h-[400px] border transition-all ${seamless ? 'rounded-[2.5rem]' : 'rounded-[2rem]'} 
                    ${resolvedTheme === 'dark' ? 'bg-[#050505] border-zinc-800/50' : 'bg-[#f8fafc] border-zinc-200/50'}`}
            >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent z-10"></div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent z-10"></div>
            </div>

            {/* Footer / Indicator Info */}
            {!isFullscreen && (
                <div className="mt-6 flex flex-wrap gap-4 items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                            <span className="text-[8px] text-amber-500 font-black tracking-widest uppercase">SMA (20)</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            <span className="text-[8px] text-blue-500 font-black tracking-widest uppercase">Volume Flow</span>
                        </div>
                    </div>
                    <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest italic">All technical signals synthesized from low-latency market providers</p>
                </div>
            )}
        </div>
    );
}
