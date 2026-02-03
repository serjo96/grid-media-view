import { useCallback, useLayoutEffect, useState } from "react";

export function useElementSize<T extends HTMLElement>(_debugLabel?: string) {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const ref = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  useLayoutEffect(() => {
    const el = node;
    if (!el) return;

    // Ensure we have a non-zero initial size on first paint (important for mobile),
    // because ResizeObserver may not fire immediately in some browsers.
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width || r.height) setSize({ width: r.width, height: r.height });
    };

    measure();

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);

    // One more measurement on the next frame helps when layout settles after render,
    // and avoids "fixing itself" only after changing view.
    const raf = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [node]);

  return { ...size, ref };
}

