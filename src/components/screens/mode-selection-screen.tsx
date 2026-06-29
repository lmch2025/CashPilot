"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Bot,
  Bell,
  Check,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Loader2,
  Zap,
  Wallet,
  Clock,
  ShieldCheck,
  HandCoins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { useCashPilotStore } from "@/lib/store";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/context";

type Mode = "managed" | "alerts";

const MANAGED_BENEFITS = [
  { icon: Bot, key: "mode.managed.b1" },
  { icon: Zap, key: "mode.managed.b2" },
  { icon: HandCoins, key: "mode.managed.b3" },
  { icon: ShieldCheck, key: "mode.managed.b4" },
];

const ALERTS_BENEFITS = [
  { icon: Wallet, key: "mode.alerts.b1" },
  { icon: Bell, key: "mode.alerts.b2" },
  { icon: HandCoins, key: "mode.alerts.b3" },
  { icon: Check, key: "mode.alerts.b4" },
];

const COMPARISON_ROWS: {
  labelKey: string;
  managedKey: string;
  alertsKey: string;
}[] = [
  {
    labelKey: "mode.compare.money",
    managedKey: "mode.compare.moneyManaged",
    alertsKey: "mode.compare.moneyAlerts",
  },
  {
    labelKey: "mode.compare.who",
    managedKey: "mode.compare.whoManaged",
    alertsKey: "mode.compare.whoAlerts",
  },
  {
    labelKey: "mode.compare.cost",
    managedKey: "mode.compare.costManaged",
    alertsKey: "mode.compare.costAlerts",
  },
  {
    labelKey: "mode.compare.speed",
    managedKey: "mode.compare.speedManaged",
    alertsKey: "mode.compare.speedAlerts",
  },
  {
    labelKey: "mode.compare.effort",
    managedKey: "mode.compare.effortManaged",
    alertsKey: "mode.compare.effortAlerts",
  },
];

export function ModeSelectionScreen() {
  const t = useT();
  const userId = useCashPilotStore((s) => s.userId);
  const setView = useCashPilotStore((s) => s.setView);
  const setMode = useCashPilotStore((s) => s.setMode);
  const modeSelectionContext = useCashPilotStore(
    (s) => s.modeSelectionContext
  );

  const [loading, setLoading] = useState<Mode | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const isSwitch = modeSelectionContext === "switch";

  const selectMode = async (mode: Mode) => {
    if (loading) return;
    setLoading(mode);
    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mode }),
      });
      setMode(mode);
      if (mode === "managed") {
        setView("app");
      } else {
        setView("plans");
      }
    } catch {
      // On navigue quand même : le mode est mis en cache localement,
      // le tableau de bord se synchronisera plus tard.
      setMode(mode);
      toast.warning(
        mode === "managed"
          ? t("mode.toast.slowManaged")
          : t("mode.toast.slowAlerts")
      );
      if (mode === "managed") setView("app");
      else setView("plans");
    } finally {
      setLoading(null);
    }
  };

  const handleBack = () => {
    if (isSwitch) setView("app");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSwitch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-9 w-9 -ml-2 text-muted-foreground hover:text-foreground"
              aria-label={t("common.back")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <CashPilotLogo size={36} withText />
        </div>
        {isSwitch && (
          <span className="text-xs text-muted-foreground">{t("modeSwitch.title")}</span>
        )}
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-12">
        <div className="mx-auto w-full max-w-md">
          {/* Title block */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mt-4 mb-7"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Zap className="w-3 h-3" />
              {t("mode.pill")}
            </span>
            <h1 className="mt-4 font-display text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
              {t("mode.title")}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {t("mode.subtitle")}
            </p>
          </motion.div>

          {/* Two cards */}
          <div className="space-y-4">
            {/* CARD 1 — MANAGED */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <ModeCard
                mode="managed"
                icon={Bot}
                accent="green"
                title={t("mode.managed.title")}
                tagline={t("mode.managed.tagline")}
                priceBadge={t("mode.managed.price")}
                recommended
                benefits={MANAGED_BENEFITS}
                loading={loading === "managed"}
                disabled={loading !== null && loading !== "managed"}
                onSelect={() => selectMode("managed")}
              />
            </motion.div>

            {/* CARD 2 — ALERTS */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <ModeCard
                mode="alerts"
                icon={Bell}
                accent="gold"
                title={t("mode.alerts.title")}
                tagline={t("mode.alerts.tagline")}
                priceBadge={t("mode.alerts.price")}
                benefits={ALERTS_BENEFITS}
                loading={loading === "alerts"}
                disabled={loading !== null && loading !== "alerts"}
                onSelect={() => selectMode("alerts")}
              />
            </motion.div>
          </div>

          {/* Help text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="mt-5 text-center text-xs text-muted-foreground"
          >
            {t("mode.switchNote")}
          </motion.p>

          {/* Collapsible comparison */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-7"
          >
            <button
              type="button"
              onClick={() => setShowComparison((v) => !v)}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors py-2"
              aria-expanded={showComparison}
            >
              <span>{t("mode.compare.title")}</span>
              <motion.span
                animate={{ rotate: showComparison ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                className="inline-flex"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {showComparison && (
                <motion.div
                  key="comparison"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <ComparisonTable />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* "Comment choisir ?" helper */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="mt-7 rounded-2xl border border-border/60 bg-muted/40 p-4"
          >
            <div className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-primary-foreground">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-sm leading-relaxed">
                <p className="font-semibold text-foreground">
                  {t("mode.helper.title")}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {t("mode.helper.text")}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

interface ModeCardProps {
  mode: Mode;
  icon: React.ComponentType<{ className?: string }>;
  accent: "green" | "gold";
  title: string;
  tagline: string;
  priceBadge: string;
  benefits: { icon: React.ComponentType<{ className?: string }>; key: string }[];
  recommended?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

function ModeCard({
  mode,
  icon: Icon,
  accent,
  title,
  tagline,
  priceBadge,
  benefits,
  recommended = false,
  loading = false,
  disabled = false,
  onSelect,
}: ModeCardProps) {
  const t = useT();
  const isGreen = accent === "green";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className={[
        "group relative w-full text-left rounded-3xl overflow-hidden",
        "border bg-card transition-shadow",
        isGreen
          ? "border-[oklch(0.45_0.1_155_/_0.25)] shadow-soft hover:shadow-soft-lg"
          : "border-[oklch(0.82_0.13_88_/_0.35)] shadow-soft hover:shadow-gold",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Accent strip top */}
      <div
        className={[
          "h-1.5 w-full",
          isGreen ? "bg-brand-gradient" : "bg-gold-gradient",
        ].join(" ")}
      />

      {/* Recommended badge */}
      {recommended && (
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2.5 py-1 text-[10px] font-semibold text-primary-foreground shadow-soft">
            <Zap className="w-3 h-3" />
            {t("mode.managed.recommended")}
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6">
        {/* Header row: icon + price badge */}
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", bounce: 0.4 }}
            className={[
              "shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center",
              isGreen ? "bg-brand-gradient" : "bg-gold-gradient",
              isGreen ? "shadow-soft" : "shadow-gold",
            ].join(" ")}
          >
            <Icon className="w-7 h-7 text-primary-foreground" />
          </motion.div>

          <div className="flex-1 min-w-0 pr-24">
            <h2 className="font-display text-lg sm:text-xl font-bold leading-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-snug">
              {tagline}
            </p>
          </div>
        </div>

        {/* Price badge */}
        <div className="mt-4">
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
              isGreen
                ? "bg-[oklch(0.45_0.1_155_/_0.1)] text-[oklch(0.35_0.09_155)]"
                : "bg-[oklch(0.82_0.13_88_/_0.18)] text-[oklch(0.55_0.1_80)]",
            ].join(" ")}
          >
            <Wallet className="w-3.5 h-3.5" />
            {priceBadge}
          </span>
        </div>

        {/* Benefits */}
        <ul className="mt-5 space-y-2.5">
          {benefits.map((b, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.07, duration: 0.3 }}
              className="flex items-start gap-2.5"
            >
              <span
                className={[
                  "shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center",
                  isGreen
                    ? "bg-[oklch(0.45_0.1_155_/_0.12)]"
                    : "bg-[oklch(0.82_0.13_88_/_0.2)]",
                ].join(" ")}
              >
                <b.icon
                  className={[
                    "w-3 h-3",
                    isGreen
                      ? "text-[oklch(0.4_0.09_155)]"
                      : "text-[oklch(0.55_0.1_80)]",
                  ].join(" ")}
                />
              </span>
              <span className="text-sm text-foreground/90 leading-snug">
                {t(b.key)}
              </span>
            </motion.li>
          ))}
        </ul>

        {/* CTA */}
        <div
          className={[
            "mt-5 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors",
            isGreen
              ? "bg-brand-gradient text-primary-foreground group-hover:brightness-110"
              : "bg-gold-gradient text-[oklch(0.28_0.05_100)] group-hover:brightness-105",
          ].join(" ")}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("common.loading")}</span>
            </>
          ) : (
            <>
              <span>{t(`mode.${mode}.cta`)}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function ComparisonTable() {
  const t = useT();
  return (
    <div className="mt-3 rounded-2xl border border-border/60 bg-card overflow-hidden shadow-soft">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_1.1fr_1.1fr] bg-muted/50">
        <div className="px-3 py-3 text-xs font-semibold text-muted-foreground">
          &nbsp;
        </div>
        <div className="px-3 py-3 text-xs font-bold text-[oklch(0.35_0.09_155)] border-l border-border/60">
          <span className="inline-flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" />
            {t("mode.compare.col")}
          </span>
        </div>
        <div className="px-3 py-3 text-xs font-bold text-[oklch(0.55_0.1_80)] border-l border-border/60">
          <span className="inline-flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            {t("mode.compare.colAlerts")}
          </span>
        </div>
      </div>

      {COMPARISON_ROWS.map((row, i) => (
        <div
          key={row.labelKey}
          className={[
            "grid grid-cols-[1fr_1.1fr_1.1fr]",
            i % 2 === 1 ? "bg-muted/20" : "",
            "border-t border-border/50",
          ].join(" ")}
        >
          <div className="px-3 py-3 text-xs font-medium text-foreground/80 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground/70 shrink-0" />
            <span>{t(row.labelKey)}</span>
          </div>
          <div className="px-3 py-3 text-xs text-foreground/90 border-l border-border/60 leading-snug">
            {t(row.managedKey)}
          </div>
          <div className="px-3 py-3 text-xs text-foreground/90 border-l border-border/60 leading-snug">
            {t(row.alertsKey)}
          </div>
        </div>
      ))}
    </div>
  );
}
