import { useCallback, useLayoutEffect, useState } from "react";

export function useElementSize<T extends HTMLElement>(debugLabel?: string) {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const ref = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  useLayoutEffect(() => {
    const el = node;
    if (!el) return;

    const debugEnabled =
      typeof import.meta !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (import.meta as any).env?.DEV &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__GRID_DEBUG === true;

    // Ensure we have a non-zero initial size on first paint (important for mobile),
    // because ResizeObserver may not fire immediately in some browsers.
    let logCount = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width || r.height) setSize({ width: r.width, height: r.height });

      if (debugEnabled && debugLabel && logCount < 4) {
        logCount += 1;
        // eslint-disable-next-line no-console
        console.log(`[grid-debug] useElementSize(${debugLabel}) measure`, {
          width: r.width,
          height: r.height,
          tag: el.tagName,
          className: el.className,
        });
      }
    };

    measure();

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ width: cr.width, height: cr.height });

      if (debugEnabled && debugLabel && logCount < 8) {
        logCount += 1;
        // eslint-disable-next-line no-console
        console.log(`[grid-debug] useElementSize(${debugLabel}) ResizeObserver`, {
          width: cr.width,
          height: cr.height,
        });
      }
    });
    ro.observe(el);

    // One more measurement on the next frame helps when layout settles after render,
    // and avoids "fixing itself" only after changing view.
    const raf = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [debugLabel, node]);

  return { ...size, ref };
}

