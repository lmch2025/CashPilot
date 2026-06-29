"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useCashPilotStore } from "@/lib/store";
import { formatXAF } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

/**
 * Affiche une notification flottante en bas de l'écran quand le robot fait un gain.
 * Le parent contrôle la visibilité via `lastGainAt` (timestamp).
 * Ce composant se cache lui-même après 3.5s et appelle `clearGainAnimation`.
 */
function ToastContent({
  amount,
  onAutoHide,
}: {
  amount: number;
  onAutoHide: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const timer = setTimeout(onAutoHide, 3500);
    return () => clearTimeout(timer);
  }, [onAutoHide]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", duration: 0.5, bounce: 0.4 }}
      className="pointer-events-auto rounded-2xl bg-brand-gradient text-primary-foreground p-4 shadow-soft-lg border border-primary-foreground/10"
    >
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.6, repeat: 2 }}
          className="w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center shrink-0"
        >
          <TrendingUp className="w-5 h-5" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-primary-foreground/80">
            {t("gainToast.title")}
          </div>
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="font-display font-extrabold text-lg leading-tight"
          >
            +{formatXAF(amount)} {t("common.xaf")}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export function GainToast() {
  const lastGainAmount = useCashPilotStore((s) => s.lastGainAmount);
  const lastGainAt = useCashPilotStore((s) => s.lastGainAt);
  const clearGainAnimation = useCashPilotStore((s) => s.clearGainAnimation);

  const visible = lastGainAmount !== null && lastGainAt !== null;

  return (
    <div className="pointer-events-none fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <AnimatePresence>
        {visible && lastGainAmount !== null && (
          <ToastContent
            key={lastGainAt}
            amount={lastGainAmount}
            onAutoHide={clearGainAnimation}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
