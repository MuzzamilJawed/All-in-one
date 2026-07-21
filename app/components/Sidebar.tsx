"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useSidebar } from "../context/SidebarContext";

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
  const { collapsed, toggleCollapsed } = useSidebar();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleTimeString());

    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Handle closing on navigation for mobile
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Toggle Button (top-left hamburger) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        className="lg:hidden fixed top-2.5 left-3 z-[100] w-11 h-11 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg flex items-center justify-center active:scale-90 transition-transform"
      >
        {isOpen ? (
          <span className="text-xl leading-none">✕</span>
        ) : (
          <span className="flex flex-col items-center justify-center gap-[3px]">
            <span className="block w-[18px] h-[2px] bg-current rounded-full"></span>
            <span className="block w-[18px] h-[2px] bg-current rounded-full"></span>
            <span className="block w-[18px] h-[2px] bg-current rounded-full"></span>
          </span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
        />
      )}

      <aside className={`fixed left-0 top-0 h-screen h-dvh w-[min(16rem,85vw)] ${collapsed ? "lg:w-20" : "lg:w-64"} bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-lg overflow-y-auto overflow-x-hidden flex flex-col border-r border-zinc-200 dark:border-zinc-800 transition-[transform,width] duration-300 z-[95]
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>

        <div className={`pl-6 pr-2 py-6 ${collapsed ? "lg:pl-2 lg:pr-1 lg:py-3" : ""} border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-2`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 ${collapsed ? "lg:w-8 lg:h-8" : ""} shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/25`}>
              <span className="text-white font-black text-xl italic leading-none">α</span>
            </div>
            <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <h1 className="text-base font-black tracking-tighter italic uppercase leading-none whitespace-nowrap">Alpha<span className="text-blue-500">Bazaar</span></h1>
              <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5 uppercase font-bold tracking-widest whitespace-nowrap">Markets &amp; Analysis</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-zinc-500 shrink-0">✕</button>
          {/* Desktop collapse / expand toggle — same row as logo, on the right */}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden lg:flex shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all ${collapsed ? "w-6 h-8" : "w-8 h-8"}`}
          >
            <span className="text-lg leading-none">{collapsed ? "»" : "«"}</span>
          </button>
        </div>

        <nav className="p-4 space-y-6 flex-1">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 px-4 mb-2 ${collapsed ? "lg:hidden" : ""}`}>
                {group.title}
              </h2>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.name}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${collapsed ? "lg:justify-center lg:px-0" : ""} ${isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50"
                      }`}
                    >
                      <span className="text-xl shrink-0">{item.icon}</span>
                      <span className={`font-bold text-sm tracking-tight ${collapsed ? "lg:hidden" : ""}`}>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div className="mb-4">
            <p className={`text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2 ${collapsed ? "lg:hidden" : ""}`}>Theme</p>
            <div className={`flex bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1 ${collapsed ? "lg:flex-col lg:gap-1" : ""}`}>
              <button
                data-testid="theme-toggle-light"
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center p-1.5 rounded transition-all ${theme === 'light' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                title="Light Mode"
              >
                ☀️
              </button>
              <button
                data-testid="theme-toggle-dark"
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

          <p className={`text-xs text-zinc-500 ${collapsed ? "lg:hidden" : ""}`}>
            Last updated: {mounted ? currentTime : "--:--"}
          </p>
        </div>
      </aside>
    </>
  );
}
