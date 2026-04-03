"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

const navigationGroups = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", href: "/", icon: "📊" },
    ]
  },
  {
    title: "Markets",
    items: [
      { name: "PSX Stocks", href: "/stocks", icon: "📈" },
      { name: "NASDAQ Stocks", href: "/nasdaq", icon: "🧭" },
      { name: "Forex", href: "/forex", icon: "💱" },
      { name: "Crypto", href: "/crypto", icon: "₿" },
    ]
  },
  {
    title: "Commodities",
    items: [
      { name: "Gold & Silver", href: "/metals", icon: "💎" },
      { name: "Oil & Energy", href: "/oil", icon: "🛢️" },
    ]
  },
  {
    title: "Tools & Personal",
    items: [
      { name: "Watchlist", href: "/watchlist", icon: "⭐" },
      { name: "Expenses", href: "/expenses", icon: "💰" },
    ]
  },
  {
    title: "Configuration",
    items: [
      { name: "Settings", href: "/settings", icon: "⚙️" },
    ]
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleTimeString());

    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-lg overflow-y-auto flex flex-col border-r border-zinc-200 dark:border-zinc-800">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Your All-in-One Hub</p>
      </div>

      <nav className="p-4 space-y-6 flex-1">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 px-4 mb-2">
              {group.title}
            </h2>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50"
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-bold text-sm tracking-tight">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="mb-4">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">Theme</p>
          <div className="flex bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center p-1.5 rounded transition-all ${theme === 'light' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
              title="Light Mode"
            >
              ☀️
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center p-1.5 rounded transition-all ${theme === 'dark' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
              title="Dark Mode"
            >
              🌙
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`flex-1 flex items-center justify-center p-1.5 rounded transition-all ${theme === 'system' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
              title="System Auto"
            >
              💻
            </button>
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Last updated: {mounted ? currentTime : "--:--"}
        </p>
      </div>
    </aside>
  );
}
