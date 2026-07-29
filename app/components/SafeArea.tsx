"use client";

import { useEffect } from "react";

/**
 * Flags the document as running inside the Capacitor shell so globals.css can
 * apply a minimum top inset.
 *
 * Android targets SDK 36, where edge-to-edge is mandatory: the WebView paints
 * behind the status bar and camera cutout. Chrome's env(safe-area-inset-top)
 * is honoured there, but several OEM WebViews still report 0 — which would put
 * page headers straight under the front camera. The `native-shell` class turns
 * `--sa-top` into max(reported inset, floor), so the real inset wins whenever
 * the WebView reports one and the floor covers it when it doesn't.
 */
export default function SafeArea() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; isNative?: boolean } }).Capacitor;
    const isNative = typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : !!cap?.isNative;
    if (!isNative) return;

    document.documentElement.classList.add("native-shell");
    return () => document.documentElement.classList.remove("native-shell");
  }, []);

  return null;
}
