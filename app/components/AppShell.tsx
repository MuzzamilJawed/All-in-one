"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useSidebar } from "../context/SidebarContext";
import { useSettings } from "../context/SettingsContext";
import { moduleForPath, isModuleEnabled } from "../lib/modules";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();
    const { settings } = useSettings();
    const pathname = usePathname();
    const router = useRouter();

    // Block direct navigation to a hidden module's page — send home.
    const mod = moduleForPath(pathname || "");
    const blocked = mod ? !isModuleEnabled(settings.modules, mod) : false;

    useEffect(() => {
        if (blocked) router.replace("/");
    }, [blocked, router]);

    return (
        <div className="flex bg-zinc-50 dark:bg-[#050505]">
            <Sidebar />
            <main
                className={`flex-1 min-w-0 transition-[margin] duration-300 ease-in-out pb-[env(safe-area-inset-bottom)] ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}
            >
                {blocked ? (
                    <div className="min-h-screen flex items-center justify-center px-6 text-center">
                        <div>
                            <p className="text-zinc-900 dark:text-white font-black uppercase text-sm tracking-widest mb-2">Module hidden</p>
                            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Redirecting to dashboard…</p>
                        </div>
                    </div>
                ) : children}
            </main>
        </div>
    );
}
