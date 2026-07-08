"use client";

import { useLayoutEffect, useState } from "react";

// Animates a dashboard number from 0 to its value on mount (eased, ~0.5s).
// Server-renders the final value (no-JS correct), then the layout effect drops
// to 0 before first paint and counts up. Skipped for zero values and when the
// user prefers reduced motion.
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);

  useLayoutEffect(() => {
    if (value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const duration = 550;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setShown(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown}</>;
}
