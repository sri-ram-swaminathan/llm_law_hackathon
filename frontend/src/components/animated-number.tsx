import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Ticks to the new value over 400ms (instant under prefers-reduced-motion). */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return; }
    const c = animate(from.current, value, {
      duration: 0.4, ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => { from.current = v; setShown(Math.round(v)); },
    });
    return () => c.stop();
  }, [value, reduce]);
  return <span className={`tnum ${className ?? ""}`}>{shown}</span>;
}
