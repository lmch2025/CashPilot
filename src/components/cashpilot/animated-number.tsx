"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring, motion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

/**
 * Affiche un nombre qui s'anime (count-up) quand il change ou entre dans la vue.
 */
export function AnimatedNumber({
  value,
  duration = 0.8,
  format = (n) => Math.round(n).toString(),
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    if (!inView) return;
    const start = prev.current;
    const end = value;
    if (start === end) return;
    const startTime = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / (duration * 1000), 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prev.current = end;
        setDisplay(end);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, inView, duration]);

  return (
    <motion.span
      ref={ref}
      className={className}
      key={Math.round(display)}
      initial={false}
    >
      {format(display)}
    </motion.span>
  );
}
