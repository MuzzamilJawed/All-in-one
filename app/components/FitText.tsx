"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

// useLayoutEffect warns during SSR; the measurement only matters in the browser.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface FitTextProps {
    children: React.ReactNode;
    className?: string;
    /**
     * Smallest allowed size as a fraction of the CSS font size. Below ~0.6 the
     * text stops being readable — a slot that needs more than that is too narrow
     * and wants a layout change, not a smaller font.
     */
    min?: number;
    title?: string;
}

/**
 * Shrinks its content just enough to fit the width it is given.
 *
 * Money figures vary wildly in length — "$68.4" and "Rs.1,234,567.89" land in the
 * same card slot — so a fixed font size either wraps to a second line or gets
 * clipped. This measures the rendered text and scales the font down (never up)
 * until the whole value fits on one line, so nothing is ever cut off.
 *
 * The element keeps whatever font size its classes set; we only override
 * downwards, and reset before every measurement so breakpoint changes still win.
 */
export default function FitText({ children, className = "", min = 0.6, title }: FitTextProps) {
    const boxRef = useRef<HTMLSpanElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const lastWidth = useRef(-1);

    const fit = useCallback(() => {
        const box = boxRef.current;
        const text = textRef.current;
        if (!box || !text) return;

        text.style.fontSize = "";
        text.style.whiteSpace = "";
        const base = parseFloat(getComputedStyle(text).fontSize);
        const avail = box.clientWidth;
        if (!base || avail <= 0 || text.scrollWidth <= avail) return;

        // Glyph widths don't scale perfectly linearly with font size, so one
        // ratio pass usually lands a hair too wide. Re-measure and correct until
        // it fits (converges in two or three passes) or we reach the floor.
        const floor = base * min;
        let size = base;
        for (let pass = 0; pass < 4; pass++) {
            const need = text.scrollWidth;
            if (need <= avail) break;
            // The -0.25px guard stops sub-pixel rounding re-clipping the last glyph.
            const next = Math.max(floor, (avail / need) * size - 0.25);
            if (next >= size) break; // already at the floor — the slot is too narrow
            size = next;
            text.style.fontSize = `${size}px`;
        }

        // Floor reached and it still doesn't fit: the slot is too narrow for this
        // value at any readable size. Wrap rather than let it spill — a taller
        // cell is recoverable, a half-shown number is not.
        if (text.scrollWidth > avail) {
            text.style.whiteSpace = "normal";
            text.style.wordBreak = "break-word";
        }
    }, [min]);

    // Re-fit after every render so a new value is measured as soon as it paints.
    useIsoLayoutEffect(fit);

    useEffect(() => {
        const box = boxRef.current;
        if (!box || typeof ResizeObserver === "undefined") return;

        lastWidth.current = box.clientWidth;
        const ro = new ResizeObserver(() => {
            // Guard against a feedback loop if this sits in a shrink-to-fit parent.
            const w = box.clientWidth;
            if (w === lastWidth.current) return;
            lastWidth.current = w;
            fit();
        });
        ro.observe(box);

        // Web fonts land after first paint and change the metrics we measured.
        document.fonts?.ready.then(fit).catch(() => { });

        return () => ro.disconnect();
    }, [fit]);

    return (
        <span ref={boxRef} className={`block min-w-0 ${className}`} title={title}>
            <span ref={textRef} className="inline-block whitespace-nowrap">{children}</span>
        </span>
    );
}
