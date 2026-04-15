import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import CommandPalette from "./components/CommandPalette";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsProvider } from "./context/SettingsContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "All-in-One Dashboard",
  description: "Your centralized hub for gold, silver, and PSX stocks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50 dark:bg-black`}
      >
        <SettingsProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <div className="flex bg-zinc-50 dark:bg-[#050505]">
              <Sidebar />
              <main className="flex-1 lg:ml-64 min-w-0">
                {children}
              </main>
            </div>
            <CommandPalette />
          </ThemeProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
