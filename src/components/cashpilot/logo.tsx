"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  withText?: boolean;
}

/**
 * Logo CashPilot: un cercle vert avec une flèche dorée qui monte (prospérité).
 */
export function CashPilotLogo({
  size = 48,
  className,
  animated = false,
  withText = false,
}: LogoProps) {
  const logo = (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-2xl bg-brand-gradient shadow-soft",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Flèche montante dorée */}
        <motion.path
          d="M5 15L10 10L13 13L19 7"
          stroke="oklch(0.85 0.13 90)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={animated ? { pathLength: 0, opacity: 0 } : false}
          animate={animated ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.circle
          cx="19"
          cy="7"
          r="2"
          fill="oklch(0.9 0.1 95)"
          initial={animated ? { scale: 0 } : false}
          animate={animated ? { scale: 1 } : undefined}
          transition={{ duration: 0.4, delay: 0.7, type: "spring" }}
        />
        {/* Petite pièce en bas */}
        <motion.circle
          cx="5"
          cy="19"
          r="1.5"
          fill="oklch(0.85 0.13 90)"
          opacity="0.5"
          initial={animated ? { scale: 0 } : false}
          animate={animated ? { scale: 1 } : undefined}
          transition={{ duration: 0.3, delay: 0.2 }}
        />
      </svg>
    </div>
  );

  if (!withText) return logo;

  return (
    <div className="inline-flex items-center gap-2.5">
      {logo}
      <div className="flex flex-col leading-none">
        <span className="font-display font-extrabold text-lg tracking-tight text-foreground">
          CashPilot
        </span>
        <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
          Votre argent travaille
        </span>
      </div>
    </div>
  );
}
