"use client";

import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';

interface CandleData {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface TradingChartProps {
    data: CandleData[];
    title: string;
    onTimeframeChange?: (timeframe: string) => void;
    currentTimeframe?: string;
}

export default function TradingViewChart({ data, title, onTimeframeChange, currentTimeframe = "1H" }: TradingChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<any>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Initial Chart Setup
    useEffect(() => {
        if (!chartContainerRef.current || typeof window === 'undefined') return;

        const container = chartContainerRef.current;
        const chart = createChart(container, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#d1d5db',
            },
            width: container.clientWidth || 600,
            height: 350,
            grid: {
                vertLines: { color: 'rgba(197, 203, 206, 0.05)' },
                horzLines: { color: 'rgba(197, 203, 206, 0.05)' },
            },
            timeScale: {
                borderColor: 'rgba(197, 203, 206, 0.2)',
                timeVisible: true,
            },
        });

        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        chartRef.current = chart;
        seriesRef.current = series;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
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
        };
    }, []);

    // Handle Resize on Fullscreen toggle
    useEffect(() => {
        if (chartRef.current && chartContainerRef.current) {
            // Wait for transition animation (if any) or DOM update
            const timer = setTimeout(() => {
                if (chartContainerRef.current && chartRef.current) {
                    const { clientWidth, clientHeight } = chartContainerRef.current;
                    chartRef.current.applyOptions({ width: clientWidth, height: clientHeight });
                    chartRef.current.timeScale().fitContent();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isFullscreen]);

    // Data Update
    useEffect(() => {
        if (seriesRef.current && data && data.length > 0) {
            try {
                seriesRef.current.setData(data);
                chartRef.current?.timeScale().fitContent();
            } catch (err) {
                console.error("Error updating chart data:", err);
            }
        }
    }, [data]);

    return (
        <div className={`w-full bg-zinc-900 rounded-lg p-3 border border-zinc-800 transition-all ${isFullscreen ? 'fixed inset-0 z-50 p-6 rounded-none h-screen' : ''}`}>
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-4">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{title}</h3>
                    <div className="flex bg-zinc-800 rounded p-0.5">
                        {['1H', '1D', '1W', '1M'].map((tf) => (
                            <button
                                key={tf}
                                onClick={() => onTimeframeChange?.(tf)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${currentTimeframe === tf ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-1 px-2 text-[10px] bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 transition-colors flex items-center gap-1"
                    >
                        {isFullscreen ? '✕ Exit' : '⛶ Fullscreen'}
                    </button>
                    {!isFullscreen && <span className="text-[10px] bg-zinc-800 text-teal-400 px-1.5 py-0.5 rounded font-mono">LIVE</span>}
                </div>
            </div>
            <div
                ref={chartContainerRef}
                className="w-full"
                style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '350px' }}
            />
        </div>
    );
}
