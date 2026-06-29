"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Loader2,
  Check,
  ArrowRight,
  Shield,
  Star,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCashPilotStore } from "@/lib/store";
import { formatXAF } from "@/lib/utils";
import { toast } from "sonner";
import type { SubscriptionPlan, MobileOperator } from "@/lib/types";
import { useT } from "@/lib/i18n/context";

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan | null;
  onSuccess?: () => void;
}

type Step = "review" | "processing" | "success";

/**
 * Ajoute un canal alpha à une couleur oklch opaque.
 * "oklch(0.5 0.1 155)" → "oklch(0.5 0.1 155 / 0.15)"
 */
function withAlpha(color: string, alpha: number): string {
  return color.replace(/\)$/, ` / ${alpha})`);
}

export function SubscriptionDialog({
  open,
  onOpenChange,
  plan,
  onSuccess,
}: SubscriptionDialogProps) {
  const t = useT();
  const userId = useCashPilotStore((s) => s.userId);
  const setMode = useCashPilotStore((s) => s.setMode);
  const [step, setStep] = useState<Step>("review");
  const [operator, setOperator] = useState<MobileOperator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const reset = () => {
    setStep("review");
    setOperator(null);
    setError(null);
    setExpiresAt(null);
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setTimeout(reset, 300);
    }
  };

  const handleConfirm = async () => {
    if (!userId || !plan || !operator) return;
    setStep("processing");
    setError(null);

    try {
      // Simuler le paiement Mobile Money (2.8s)
      await new Promise((r) => setTimeout(r, 2800));

      const res = await fetch("/api/subscription/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId: plan.id, operator }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || t("toast.subscriptionFailed"));
        setStep("review");
        return;
      }
      // Active le mode alerts côté client
      setMode("alerts");
      setExpiresAt(json.subscriptionExpiresAt ?? null);
      setStep("success");
      toast.success(t("subscription.success.activated"), {
        description: `${t("account.subscription.plan")} ${plan.name} — ${plan.priceLabel} ${t("common.xaf")} / ${plan.period}`,
      });
    } catch {
      setError(t("toast.connectionError"));
      setStep("review");
    }
  };

  const handleSuccessDone = () => {
    handleClose(false);
    onSuccess?.();
  };

  const planIcon = (p: SubscriptionPlan) => {
    if (p.id === "premium")
      return <Crown className="w-4 h-4" style={{ color: p.color }} />;
    if (p.highlight)
      return <Star className="w-4 h-4" style={{ color: p.color }} />;
    return <Check className="w-4 h-4" style={{ color: p.color }} />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent aria-describedby={undefined} className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="font-display text-lg font-bold">
            {t("subscription.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5">
          <AnimatePresence mode="wait">
            {/* Step 1: Plan summary + operator selection */}
            {step === "review" && plan && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Plan summary card */}
                <div
                  className="relative rounded-2xl p-4 mb-4 border-2 overflow-hidden"
                  style={{
                    borderColor: plan.highlight
                      ? "oklch(0.82 0.13 88)"
                      : plan.color,
                    background: `linear-gradient(135deg, ${withAlpha(
                      plan.color,
                      0.12
                    )} 0%, transparent 100%)`,
                  }}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 right-0 bg-gold-gradient px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                      <Crown className="w-3 h-3 text-accent-foreground" />
                      <span className="text-[10px] font-bold text-accent-foreground uppercase tracking-wide">
                        {t("subscription.review.popular")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    {planIcon(plan)}
                    <span
                      className="font-display font-bold text-base"
                      style={{ color: plan.color }}
                    >
                      {plan.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-extrabold">
                      {plan.priceLabel}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t("common.xaf")} / {plan.period}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.tagline}
                  </p>
                </div>

                {/* Features included */}
                <div className="rounded-xl bg-muted/40 p-3 mb-4 space-y-2">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Check
                        className="w-3.5 h-3.5 mt-0.5 shrink-0"
                        style={{ color: plan.color }}
                        strokeWidth={3}
                      />
                      <span className="text-foreground/85">{f}</span>
                    </div>
                  ))}
                </div>

                {/* Operator selection */}
                <p className="text-sm text-muted-foreground mb-3">
                  {t("subscription.review.chooseOperator")}
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <OperatorCard
                    name="MTN Money"
                    color="oklch(0.96 0.05 250)"
                    textColor="oklch(0.5 0.18 255)"
                    emoji="🟡"
                    selected={operator === "mtn"}
                    onClick={() => setOperator("mtn")}
                  />
                  <OperatorCard
                    name="Orange Money"
                    color="oklch(0.95 0.04 50)"
                    textColor="oklch(0.55 0.18 45)"
                    emoji="🟠"
                    selected={operator === "orange"}
                    onClick={() => setOperator("orange")}
                  />
                </div>

                <div className="rounded-xl bg-accent/40 border border-accent/60 p-3 mb-4 flex items-start gap-2">
                  <Shield className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-accent-foreground leading-relaxed">
                    {t("subscription.review.reassurance")}
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive mb-3">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleConfirm}
                  disabled={!operator}
                  size="lg"
                  className="w-full h-12 font-semibold rounded-xl group"
                >
                  {t("subscription.review.pay")} {formatXAF(plan.price)} {t("common.xaf")}
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            )}

            {/* Step 2: Processing */}
            {step === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="inline-flex w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary items-center justify-center mx-auto"
                >
                  <span className="text-2xl">
                    {operator === "mtn" ? "🟡" : "🟠"}
                  </span>
                </motion.div>
                <h3 className="mt-6 font-display font-bold text-lg">
                  {t("subscription.processing.title")}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("subscription.processing.desc")} {operator === "mtn" ? "MTN" : "Orange"} Money.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t("subscription.processing.wait")}
                </div>
              </motion.div>
            )}

            {/* Step 3: Success */}
            {step === "success" && plan && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6, bounce: 0.5 }}
                  className="inline-flex w-20 h-20 rounded-full bg-brand-gradient items-center justify-center mx-auto shadow-soft-lg"
                >
                  <Check
                    className="w-10 h-10 text-primary-foreground"
                    strokeWidth={3}
                  />
                </motion.div>

                <h3 className="mt-6 font-display font-bold text-xl">
                  {t("subscription.success.title")}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("subscription.success.desc", { plan: plan.name })}
                </p>

                <div className="mt-5 rounded-xl bg-muted/60 p-4 space-y-2 text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("account.subscription.plan")}</span>
                    <span className="font-display font-bold">{plan.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("subscription.review.amount")}</span>
                    <span className="font-display font-bold">
                      {plan.priceLabel} {t("common.xaf")} / {plan.period}
                    </span>
                  </div>
                  {expiresAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("subscription.review.renewOn")}
                      </span>
                      <span className="font-display font-bold">
                        {new Date(expiresAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSuccessDone}
                  size="lg"
                  className="w-full h-12 mt-5 font-semibold rounded-xl group"
                >
                  {t("subscription.success.cta")}
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OperatorCard({
  name,
  color,
  textColor,
  emoji,
  selected,
  onClick,
}: {
  name: string;
  color: string;
  textColor: string;
  emoji: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl p-4 border-2 transition-all text-left ${
        selected
          ? "border-primary shadow-soft"
          : "border-border hover:border-primary/40"
      }`}
      style={{ background: color }}
    >
      <div className="text-3xl mb-2">{emoji}</div>
      <div
        className="font-display font-bold text-sm"
        style={{ color: textColor }}
      >
        {name}
      </div>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
        >
          <Check
            className="w-3 h-3 text-primary-foreground"
            strokeWidth={3}
          />
        </motion.div>
      )}
    </button>
  );
}
