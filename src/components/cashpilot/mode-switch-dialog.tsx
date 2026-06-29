"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Bot,
  Bell,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  CreditCard,
  Zap,
  Shield,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCashPilotStore } from "@/lib/store";
import { formatXAF } from "@/lib/utils";
import { toast } from "sonner";
import type { DashboardData, UserMode } from "@/lib/types";
import { useT } from "@/lib/i18n/context";

interface ModeSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMode: UserMode;
  data: DashboardData;
  onSuccess?: () => void;
}

export function ModeSwitchDialog({
  open,
  onOpenChange,
  targetMode,
  data,
  onSuccess,
}: ModeSwitchDialogProps) {
  const t = useT();
  const userId = useCashPilotStore((s) => s.userId);
  const setMode = useCashPilotStore((s) => s.setMode);
  const setView = useCashPilotStore((s) => s.setView);
  const setTab = useCashPilotStore((s) => s.setTab);
  const [loading, setLoading] = useState(false);

  const currentMode = data.user.mode;
  const isSwitchingToAlerts = targetMode === "alerts";

  // Détermine si on a besoin d'un abonnement pour le mode alerts
  const needsSubscription =
    isSwitchingToAlerts && !data.subscription.isActive;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mode: targetMode }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error || t("modeSwitch.toast.failed"));
        return;
      }
      setMode(targetMode);

      if (isSwitchingToAlerts && needsSubscription) {
        // Aller à l'écran de sélection des plans
        toast.success(t("modeSwitch.toast.activated"));
        onOpenChange(false);
        setView("plans");
      } else {
        // Changement direct
        toast.success(
          targetMode === "managed"
            ? t("modeSwitch.toast.managed")
            : t("modeSwitch.toast.alerts"),
          {
            description:
              targetMode === "managed"
                ? t("modeSwitch.toast.managedDesc")
                : t("modeSwitch.toast.alertsDesc"),
          }
        );
        onOpenChange(false);
        // Aller à l'onglet approprié
        setTab(targetMode === "managed" ? "home" : "opportunities");
        onSuccess?.();
      }
    } catch {
      toast.error(t("toast.connectionError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="font-display text-lg font-bold">
            {t("modeSwitch.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5">
          {/* Transition visuelle: current → target */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <ModeBadge mode={currentMode} dimmed />
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </motion.div>
            <ModeBadge mode={targetMode} />
          </div>

          {/* Explication du mode cible */}
          <div
            className={`rounded-2xl p-4 mb-4 ${
              isSwitchingToAlerts
                ? "bg-accent/30 border border-accent/60"
                : "bg-primary/5 border border-primary/20"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isSwitchingToAlerts ? "bg-gold-gradient" : "bg-brand-gradient"
                }`}
              >
                {isSwitchingToAlerts ? (
                  <Bell className="w-5 h-5 text-accent-foreground" />
                ) : (
                  <Bot className="w-5 h-5 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-display font-bold text-sm">
                  {isSwitchingToAlerts
                    ? t("common.alerts")
                    : t("common.managed")}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {isSwitchingToAlerts
                    ? t("modeSwitch.alertsDesc")
                    : t("modeSwitch.managedDesc")}
                </div>
              </div>
            </div>

            {/* Bullet points: ce qui va se passer */}
            <ul className="mt-3 space-y-1.5">
              {isSwitchingToAlerts ? (
                <>
                  <BulletItem
                    icon={Zap}
                    text={t("modeSwitch.toAlerts.b1")}
                  />
                  <BulletItem
                    icon={Shield}
                    text={t("modeSwitch.toAlerts.b2")}
                  />
                  <BulletItem
                    icon={Info}
                    text={t("modeSwitch.toAlerts.b3")}
                  />
                  {needsSubscription && (
                    <BulletItem
                      icon={CreditCard}
                      text={t("modeSwitch.toAlerts.b4")}
                      highlight
                    />
                  )}
                </>
              ) : (
                <>
                  <BulletItem
                    icon={Bot}
                    text={t("modeSwitch.toManaged.b1")}
                  />
                  <BulletItem
                    icon={Zap}
                    text={t("modeSwitch.toManaged.b2")}
                  />
                  <BulletItem
                    icon={Shield}
                    text={t("modeSwitch.toManaged.b3")}
                  />
                  {data.subscription.isActive && (
                    <BulletItem
                      icon={Info}
                      text={t("modeSwitch.toManaged.b4", {
                        plan: data.subscription.plan?.name ?? "",
                        days: data.subscription.daysRemaining,
                      })}
                    />
                  )}
                </>
              )}
            </ul>
          </div>

          {/* Alerte si capital présent en mode managed → alerts */}
          {isSwitchingToAlerts && data.user.capital > 0 && (
            <div className="rounded-xl bg-muted/60 border border-border/60 p-3 mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-foreground leading-relaxed">
                {t("modeSwitch.capitalWarning", {
                  amount: formatXAF(data.user.capital),
                })}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              size="lg"
              className="flex-1 h-12 rounded-xl font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading}
              size="lg"
              className={`flex-1 h-12 rounded-xl font-semibold ${
                isSwitchingToAlerts ? "bg-gold-gradient text-accent-foreground" : ""
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("modeSwitch.changing")}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  {t("modeSwitch.confirm")}
                </>
              )}
            </Button>
          </div>

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            {t("modeSwitch.switchNote")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeBadge({
  mode,
  dimmed = false,
}: {
  mode: UserMode;
  dimmed?: boolean;
}) {
  const t = useT();
  const isManaged = mode === "managed";
  return (
    <div
      className={`flex flex-col items-center gap-1.5 transition-opacity ${
        dimmed ? "opacity-50" : "opacity-100"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          isManaged ? "bg-brand-gradient" : "bg-gold-gradient"
        } ${dimmed ? "" : "shadow-soft"}`}
      >
        {isManaged ? (
          <Bot className="w-6 h-6 text-primary-foreground" />
        ) : (
          <Bell className="w-6 h-6 text-accent-foreground" />
        )}
      </div>
      <span className="text-[10px] font-semibold text-foreground">
        {isManaged ? t("common.managed") : t("common.alerts")}
      </span>
    </div>
  );
}

function BulletItem({
  icon: Icon,
  text,
  highlight,
}: {
  icon: React.ElementType;
  text: string;
  highlight?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-2 text-xs ${
        highlight ? "text-accent-foreground font-semibold" : "text-foreground"
      }`}
    >
      <Icon
        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
          highlight ? "text-accent-foreground" : "text-primary"
        }`}
      />
      <span className="leading-relaxed">{text}</span>
    </li>
  );
}
