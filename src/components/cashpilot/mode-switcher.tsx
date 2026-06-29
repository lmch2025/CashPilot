"use client";

import { motion } from "framer-motion";
import { Bot, Bell, ArrowRightLeft, ChevronRight } from "lucide-react";
import { useCashPilotStore } from "@/lib/store";
import type { DashboardData, UserMode } from "@/lib/types";
import { useT } from "@/lib/i18n/context";

interface ModeSwitcherProps {
  data: DashboardData;
  onSwitch: (targetMode: UserMode) => void;
}

/**
 * Carte compacte affichée en haut du tableau de bord.
 * Montre le mode actuel et permet de changer rapidement.
 */
export function ModeSwitcher({ data, onSwitch }: ModeSwitcherProps) {
  const t = useT();
  const { user, subscription } = data;
  const currentMode = user.mode;
  const targetMode: UserMode = currentMode === "managed" ? "alerts" : "managed";

  const isManaged = currentMode === "managed";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative rounded-2xl border border-border/60 bg-card p-3 shadow-soft overflow-hidden"
    >
      {/* Accent strip */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          isManaged ? "bg-brand-gradient" : "bg-gold-gradient"
        }`}
      />

      <div className="flex items-center gap-3 pl-2">
        {/* Mode icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isManaged ? "bg-brand-gradient" : "bg-gold-gradient"
          }`}
        >
          {isManaged ? (
            <Bot className="w-5 h-5 text-primary-foreground" />
          ) : (
            <Bell className="w-5 h-5 text-accent-foreground" />
          )}
        </div>

        {/* Mode label */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            {t("modeSwitch.currentMode")}
          </div>
          <div className="font-display font-bold text-sm text-foreground truncate">
            {isManaged ? t("common.managed") : t("common.alerts")}
          </div>
          {!isManaged && subscription.isActive && (
            <div className="text-[10px] text-muted-foreground truncate">
              {t("modeSwitch.subscriptionLeft", {
                plan: subscription.plan?.name ?? "",
                days: subscription.daysRemaining,
              })}
            </div>
          )}
        </div>

        {/* Switch button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSwitch(targetMode)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-muted/60 hover:bg-muted px-3 h-9 text-xs font-semibold text-foreground transition-colors border border-border/60"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
          <span>{t("modeSwitch.change")}</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.button>
      </div>
    </motion.div>
  );
}
