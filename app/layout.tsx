import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "./components/AppShell";
import CommandPalette from "./components/CommandPalette";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsProvider } from "./context/SettingsContext";
import { SidebarProvider } from "./context/SidebarContext";
import { ToastProvider } from "./context/ToastContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlphaBazaar — Markets & Analysis",
  description: "Track PSX stocks, gold & silver, forex, crypto and oil — with movers, heatmaps, watchlists and price alerts.",
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
            <SidebarProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
                <CommandPalette />
              </ToastProvider>
            </SidebarProvider>
          </ThemeProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
