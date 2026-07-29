"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const isNativeShell = () => {
    if (typeof window === "undefined") return false;
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; isNative?: boolean } }).Capacitor;
    return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : !!cap?.isNative;
};

/**
 * Native-shell chrome: safe-area floor + status bar styling.
 *
 * Android targets SDK 36, where edge-to-edge is mandatory: the WebView paints
 * behind the status bar and camera cutout. Two things follow from that.
 *
 * 1. `--sa-top` needs a floor. Chrome honours env(safe-area-inset-top), but
 *    several OEM WebViews report 0, which would put page headers under the
 *    front camera. The `native-shell` class turns `--sa-top` into
 *    max(reported inset, floor) so the real inset wins when there is one.
 *
 * 2. The status bar icons have to contrast with whatever the app paints behind
 *    them. Capacitor's Style.Dark means "light text for dark backgrounds" and
 *    Style.Light means "dark text for light backgrounds", so the style has to
 *    follow the active theme — pinning it in capacitor.config.ts left the clock
 *    and signal icons white-on-white in light mode, i.e. invisible.
 */
export default function SafeArea() {
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        if (!isNativeShell()) return;
        document.documentElement.classList.add("native-shell");
        return () => document.documentElement.classList.remove("native-shell");
    }, []);

    useEffect(() => {
        if (!isNativeShell()) return;
        let cancelled = false;

        (async () => {
            try {
                const { StatusBar, Style } = await import("@capacitor/status-bar");
                if (cancelled) return;

                // Keep the bar visible — a splash or immersive transition can leave
                // it hidden — and let our content draw underneath it.
                await StatusBar.show().catch(() => { });
                await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => { });
                await StatusBar.setStyle({
                    style: resolvedTheme === "light" ? Style.Light : Style.Dark,
                }).catch(() => { });
            } catch {
                /* plugin not present (plain browser / PWA) — nothing to style */
            }
        })();

        return () => { cancelled = true; };
    }, [resolvedTheme]);

    return null;
}
