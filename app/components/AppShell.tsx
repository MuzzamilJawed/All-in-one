"use client";

import Sidebar from "./Sidebar";
import { useSidebar } from "../context/SidebarContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();

    return (
        <div className="flex bg-zinc-50 dark:bg-[#050505]">
            <Sidebar />
            <main
                className={`flex-1 min-w-0 transition-[margin] duration-300 ease-in-out ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}
            >
                {children}
            </main>
        </div>
    );
}
