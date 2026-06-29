"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crown,
  Star,
  Shield,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { useCashPilotStore } from "@/lib/store";
import { SUBSCRIPTION_PLANS } from "@/lib/plans";
import { SubscriptionDialog } from "@/components/cashpilot/subscription-dialog";
import type { SubscriptionPlan } from "@/lib/types";
import { useT } from "@/lib/i18n/context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

/**
 * Ajoute un canal alpha à une couleur oklch opaque.
 * "oklch(0.5 0.1 155)" → "oklch(0.5 0.1 155 / 0.15)"
 */
function withAlpha(color: string, alpha: number): string {
  return color.replace(/\)$/, ` / ${alpha})`);
}

export function PlansScreen() {
  const t = useT();
  const setView = useCashPilotStore((s) => s.setView);
  const setTab = useCashPilotStore((s) => s.setTab);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const handleChoose = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    setView("app");
    setTab("opportunities");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-4 sm:px-6 h-16 flex items-center justify-between shrink-0">
        <button
          onClick={() => setView("mode-selection")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </button>
        <CashPilotLogo size={32} />
      </header>

      <main className="flex-1 overflow-y-auto scroll-thin px-4 sm:px-6 py-4">
        <div className="max-w-md mx-auto pb-8">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-6"
          >
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              {t("plans.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t("plans.subtitle")}
            </p>
          </motion.div>

          {/* Plan cards (staggered fade-in + slide-up) */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {SUBSCRIPTION_PLANS.map((plan) => (
              <motion.div key={plan.id} variants={cardVariants}>
                <PlanCard
                  plan={plan}
                  onChoose={() => handleChoose(plan)}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Reassurance */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 space-y-2"
          >
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              <span>{t("plans.reassurance1")}</span>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {t("plans.reassurance2")}
            </p>
          </motion.div>

          {/* Detailed comparison (collapsible) */}
          <div className="mt-6">
            <button
              onClick={() => setCompareOpen((v) => !v)}
              className="w-full flex items-center justify-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors py-2"
              aria-expanded={compareOpen}
            >
              <span>{t("plans.compare.title")}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  compareOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <AnimatePresence initial={false}>
              {compareOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <ComparisonTable />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <SubscriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={selectedPlan}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

function PlanCard({
  plan,
  onChoose,
}: {
  plan: SubscriptionPlan;
  onChoose: () => void;
}) {
  const t = useT();
  const isHighlight = plan.highlight;

  const Icon = plan.id === "premium" ? Crown : plan.highlight ? Star : Check;
  // Feature keys per plan: plan.{id}.f1..f5
  const featureKeys = [1, 2, 3, 4, 5].map((n) => `plan.${plan.id}.f${n}`);

  return (
    <div
      className={`relative rounded-2xl border-2 p-5 transition-all ${
        isHighlight
          ? "bg-card shadow-gold"
          : "border-border bg-card hover:border-primary/30 shadow-soft"
      }`}
      style={
        isHighlight
          ? { borderColor: "oklch(0.82 0.13 88)" }
          : undefined
      }
    >
      {/* Popular badge ribbon */}
      {isHighlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-gradient px-3 py-1 rounded-full flex items-center gap-1 shadow-soft">
          <Crown className="w-3.5 h-3.5 text-accent-foreground" />
          <span className="text-xs font-bold text-accent-foreground">
            {t("plans.popular")}
          </span>
        </div>
      )}

      {/* Plan name + tagline */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: withAlpha(plan.color, 0.15) }}
        >
          <Icon className="w-4 h-4" style={{ color: plan.color }} />
        </div>
        <h3
          className="font-display font-bold text-lg"
          style={{ color: plan.color }}
        >
          {t(`plan.${plan.id}.name`)}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(`plans.${plan.id}.tagline`)}
      </p>

      {/* Price */}
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-extrabold">
          {plan.priceLabel}
        </span>
        <span className="text-sm text-muted-foreground">
          {t("plans.xafPerPeriod", { period: t("plans.period.month") })}
        </span>
      </div>

      {/* Features list */}
      <ul className="mt-4 space-y-2">
        {featureKeys.map((fKey, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: plan.color }}
              strokeWidth={3}
            />
            <span className="text-foreground/85">{t(fKey)}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Button
        onClick={onChoose}
        size="lg"
        className={`w-full h-12 mt-5 font-semibold rounded-xl group ${
          isHighlight
            ? "bg-gold-gradient text-accent-foreground shadow-gold hover:opacity-90"
            : ""
        }`}
      >
        {t("plans.choose")} {t(`plan.${plan.id}.name`)}
        <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
      </Button>
    </div>
  );
}

function ComparisonTable() {
  const t = useT();
  // Lignes de comparaison (ordre: Découverte, Standard, Premium)
  const rows: {
    labelKey: string;
    values: (boolean | string)[];
  }[] = [
    {
      labelKey: "plans.compare.opsPerDay",
      values: ["10", "unlimited", "unlimited"],
    },
    { labelKey: "plans.compare.pushAlerts", values: [true, true, true] },
    { labelKey: "plans.compare.smsAlerts", values: [false, true, true] },
    { labelKey: "plans.compare.estimatedGain", values: [false, true, true] },
    {
      labelKey: "plans.compare.priorityOps",
      values: [false, false, true],
    },
    { labelKey: "plans.compare.marketAnalysis", values: [false, false, true] },
    { labelKey: "plans.compare.weeklyReport", values: [false, false, true] },
    { labelKey: "plans.compare.supportWhatsapp", values: ["48h", "24h", "4h"] },
  ];

  return (
    <div className="mt-3 rounded-xl border border-border overflow-hidden bg-card shadow-soft">
      {/* Header row */}
      <div className="grid grid-cols-4 bg-muted/50 text-xs font-semibold">
        <div className="p-2.5 text-left text-muted-foreground">
          {t("plans.compare.feature")}
        </div>
        {SUBSCRIPTION_PLANS.map((p) => (
          <div
            key={p.id}
            className="p-2.5 text-center font-display"
            style={{ color: p.color }}
          >
            {t(`plan.${p.id}.name`)}
          </div>
        ))}
      </div>
      {/* Data rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          className={`grid grid-cols-4 text-xs ${
            i % 2 === 0 ? "bg-card" : "bg-muted/20"
          }`}
        >
          <div className="p-2.5 text-left text-muted-foreground leading-tight">
            {t(row.labelKey)}
          </div>
          {row.values.map((v, j) => (
            <div
              key={j}
              className="p-2.5 text-center flex items-center justify-center"
            >
              {typeof v === "boolean" ? (
                v ? (
                  <Check
                    className="w-3.5 h-3.5 text-primary"
                    strokeWidth={3}
                  />
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )
              ) : v === "unlimited" ? (
                <span className="font-medium text-foreground/80">
                  {t("plans.compare.unlimited")}
                </span>
              ) : (
                <span className="font-medium text-foreground/80">{v}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
