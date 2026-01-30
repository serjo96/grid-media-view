import type { RefObject } from "react";
import { useEffect, useState } from "react";

export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Ensure we have a non-zero initial size on first paint (important for mobile),
    // because ResizeObserver may not fire immediately in some browsers.
    const initial = el.getBoundingClientRect();
    if (initial.width || initial.height) {
      setSize({ width: initial.width, height: initial.height });
    }

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

