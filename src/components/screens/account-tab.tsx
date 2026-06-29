"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  User,
  Crown,
  MessageCircle,
  LogOut,
  Send,
  Loader2,
  Bot,
  SlidersHorizontal,
  Phone,
  Mail,
  Globe,
  Shield,
  Bell,
  Award,
  Lock,
  Gift,
  Share2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useCashPilotStore } from "@/lib/store";
import {
  formatXAF,
  formatPhoneDisplay,
  getSetting,
  setSetting,
  computeCountdown,
  type Countdown,
} from "@/lib/utils";
import { useI18n, useT } from "@/lib/i18n/context";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { toast } from "sonner";
import type { DashboardData } from "@/lib/types";

interface AccountTabProps {
  data: DashboardData;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: number; // timestamp (ms)
}

export function AccountTab({ data }: AccountTabProps) {
  const t = useT();
  const { locale } = useI18n();
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";
  const { user, subscription } = data;
  const logout = useCashPilotStore((s) => s.logout);
  const setView = useCashPilotStore((s) => s.setView);
  const setModeSelectionContext = useCashPilotStore(
    (s) => s.setModeSelectionContext
  );
  const setSubscriptionOpen = useCashPilotStore((s) => s.setSubscriptionOpen);
  const [chatOpen, setChatOpen] = useState(false);

  const isAlertsMode = user.mode === "alerts";

  const handleSwitchMode = () => {
    setModeSelectionContext("switch");
    setView("mode-selection");
  };

  const handleRenew = () => {
    if (subscription.plan) {
      setSubscriptionOpen(true);
    } else {
      setView("plans");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">{t("account.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("account.subtitle")}
        </p>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-gradient flex items-center justify-center text-primary-foreground font-display font-bold text-xl shrink-0">
            {user.name ? user.name[0].toUpperCase() : "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-lg truncate">
              {user.name || t("account.defaultName")}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatPhoneDisplay(user.phone)}
            </div>
          </div>
          <div
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
              user.level === "croissance"
                ? "bg-gold-gradient text-accent-foreground shadow-gold"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {user.level === "croissance" && <Crown className="w-3 h-3" />}
            {user.level === "croissance" ? t("common.croissance") : t("common.starter")}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-border/50">
          <div>
            <div className="text-xs text-muted-foreground">{t("account.memberSince")}</div>
            <div className="font-display font-semibold text-sm mt-0.5">
              {new Date(user.createdAt).toLocaleDateString(dateLocale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              {isAlertsMode ? t("account.opportunitiesReceived") : t("account.exchangesTotal")}
            </div>
            <div className="font-display font-semibold text-sm mt-0.5">
              {isAlertsMode ? data.opportunitiesStats.totalReceived : user.totalExchanges}
            </div>
          </div>
        </div>

        {/* Language toggle */}
        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="w-3.5 h-3.5" />
            {t("lang.toggle")}
          </div>
          <LanguageToggle />
        </div>
      </motion.div>

      {/* Mode & subscription card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
      >
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-sm">{t("account.mode.title")}</h3>
        </div>

        {/* Current mode display */}
        <div
          className={`rounded-xl p-4 mb-3 ${
            isAlertsMode
              ? "bg-accent/30 border border-accent/60"
              : "bg-primary/5 border border-primary/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isAlertsMode ? "bg-gold-gradient" : "bg-brand-gradient"
              }`}
            >
              {isAlertsMode ? (
                <Bell className="w-5 h-5 text-accent-foreground" />
              ) : (
                <Bot className="w-5 h-5 text-primary-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm">
                {isAlertsMode
                  ? t("common.alerts")
                  : t("common.managed")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {isAlertsMode
                  ? t("account.mode.alertsDesc")
                  : t("account.mode.managedDesc")}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription details (alerts mode only) */}
        {isAlertsMode && (
          <div className="rounded-xl bg-muted/50 p-3 mb-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("account.subscription.plan")}</span>
              <span className="font-semibold text-foreground">
                {subscription.plan?.name ?? t("account.subscription.none")}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("account.subscription.status")}</span>
              <span
                className={`font-semibold ${
                  subscription.isActive
                    ? "text-[oklch(0.45_0.1_155)]"
                    : "text-destructive"
                }`}
              >
                {subscription.isActive ? t("common.active") : t("common.expired")}
              </span>
            </div>
            {subscription.isActive && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("account.subscription.expires")}</span>
                <span className="font-semibold text-foreground">
                  {subscription.daysRemaining} {subscription.daysRemaining > 1 ? t("common.days") : t("common.day")}
                </span>
              </div>
            )}
            {user.subscriptionExpiresAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("account.subscription.expiryDate")}</span>
                <span className="font-semibold text-foreground">
                  {new Date(user.subscriptionExpiresAt).toLocaleDateString(dateLocale, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Live Countdown (alerts mode) */}
        {isAlertsMode && <SubscriptionCountdown expiresAt={user.subscriptionExpiresAt} onRenew={handleRenew} />}

        {/* Action buttons */}
        <div className="flex gap-2">
          {isAlertsMode && (
            <Button
              onClick={handleRenew}
              variant={subscription.isActive ? "outline" : "default"}
              size="sm"
              className="flex-1 h-10 rounded-lg text-xs font-semibold"
            >
              {subscription.isActive ? t("account.subscription.renew") : t("account.subscription.reactivate")}
            </Button>
          )}
          <Button
            onClick={handleSwitchMode}
            variant="outline"
            size="sm"
            className="flex-1 h-10 rounded-lg text-xs font-semibold"
          >
            {t("account.subscription.switchMode")}
          </Button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground text-center">
          {t("account.subscription.switchNote")}
        </p>
      </motion.div>

      {/* Profile Completion Meter (NEW) */}
      <ProfileCompletionMeter data={data} />

      {/* Achievements (NEW) */}
      <AchievementsSection data={data} />

      {/* Level card with progress visualization */}
      {!isAlertsMode && <LevelProgressCard data={data} />}

      {/* Settings Toggles (NEW) */}
      <SettingsToggles />

      {/* Referral Card (NEW) */}
      <ReferralCard phone={user.phone} />

      {/* Support section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
      >
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-sm">{t("account.support.title")}</h3>
        </div>

        <Button
          onClick={() => setChatOpen(true)}
          className="w-full h-12 rounded-xl font-semibold group"
        >
          <Bot className="w-4 h-4 mr-2" />
          {t("account.support.chatbot")}
        </Button>

        <div className="mt-3 space-y-2">
          <ContactRow
            icon={Phone}
            label={t("account.support.whatsapp")}
            value="+237 XXX XXX XXX"
            note={t("account.support.whatsappNote")}
          />
          <ContactRow
            icon={Mail}
            label={t("account.support.email")}
            value="contact@cashpilot.africa"
          />
          <ContactRow
            icon={Globe}
            label={t("account.support.website")}
            value="www.cashpilot.africa"
          />
        </div>
      </motion.div>

      {/* Transparency */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl bg-accent/30 border border-accent/60 p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-accent-foreground" />
          <h3 className="font-display font-semibold text-sm">{t("account.transparency.title")}</h3>
        </div>
        <ul className="space-y-2 text-sm text-foreground">
          <li className="flex items-start gap-2">
            <span className="text-[oklch(0.45_0.1_155)] font-bold">✓</span>
            <span>{t("account.transparency.f1")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[oklch(0.45_0.1_155)] font-bold">✓</span>
            <span>{t("account.transparency.f2")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[oklch(0.45_0.1_155)] font-bold">✓</span>
            <span>{t("account.transparency.f3")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[oklch(0.45_0.1_155)] font-bold">✓</span>
            <span>{t("account.transparency.f4")}</span>
          </li>
        </ul>
      </motion.div>

      {/* Logout */}
      <Button
        variant="outline"
        onClick={() => {
          logout();
          toast.success(t("toast.loggedOut"));
        }}
        className="w-full h-12 rounded-xl font-semibold text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
      >
        <LogOut className="w-4 h-4 mr-2" />
        {t("account.logout")}
      </Button>

      <p className="text-center text-xs text-muted-foreground pb-2">
        {t("account.version")}
      </p>

      <SupportChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}

// ============================================================
// Live Subscription Countdown (Task 2-c-dash, Feature 1)
// ============================================================
function SubscriptionCountdown({
  expiresAt,
  onRenew,
}: {
  expiresAt: string | null;
  onRenew: () => void;
}) {
  const t = useT();
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  useEffect(() => {
    const update = () => setCountdown(computeCountdown(expiresAt));
    update();
    const interval = setInterval(update, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!countdown) return null;

  // Expired banner
  if (countdown.expired) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onRenew}
        className="w-full mb-3 rounded-xl bg-destructive/95 text-destructive-foreground p-3 flex items-center gap-3 shadow-soft hover:bg-destructive transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4" />
        </div>
        <div className="flex-1 text-left text-sm font-bold">
          {t("account.countdown.expired")}
        </div>
        <ChevronRightSmall />
      </motion.button>
    );
  }

  const totalDays = countdown.days;
  // Urgency tier
  const tier: "urgent" | "warning" | "normal" =
    totalDays < 2 ? "urgent" : totalDays < 7 ? "warning" : "normal";

  const tierClass =
    tier === "urgent"
      ? "bg-destructive/10 border-destructive/40 text-destructive"
      : tier === "warning"
      ? "bg-[oklch(0.85_0.13_85)]/20 border-[oklch(0.7_0.15_85)]/40 text-[oklch(0.4_0.13_60)]"
      : "bg-primary/5 border-primary/20 text-foreground";

  const label =
    tier === "urgent"
      ? t("account.countdown.expiresSoon")
      : tier === "warning"
      ? t("account.countdown.renewSoon")
      : t("account.countdown.expiresIn");

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-3 rounded-xl border p-3 ${tierClass}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide">
          {label}
        </span>
        {tier !== "normal" && (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-current"
          />
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CountdownUnit value={countdown.days} label={t("account.countdown.days")} />
        <CountdownUnit value={countdown.hours} label={t("account.countdown.hours")} />
        <CountdownUnit value={countdown.minutes} label={t("account.countdown.minutes")} />
      </div>
    </motion.div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <motion.div
        key={value}
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="font-display font-extrabold text-2xl tabular-nums leading-none"
      >
        {String(value).padStart(2, "0")}
      </motion.div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">
        {label}
      </div>
    </div>
  );
}

function ChevronRightSmall() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-70"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ============================================================
// Achievements Badges (Task 2-c-dash, Feature 2)
// ============================================================
interface Achievement {
  id: string;
  emoji: string;
  labelKey: string;
  descKey: string;
  earned: boolean;
}

function AchievementsSection({ data }: { data: DashboardData }) {
  const t = useT();
  const { user } = data;

  const achievements: Achievement[] = [
    {
      id: "firstDeposit",
      emoji: "🚀",
      labelKey: "account.achievements.firstDeposit",
      descKey: "account.achievements.firstDeposit.desc",
      earned: user.capital > 0,
    },
    {
      id: "croissance",
      emoji: "💎",
      labelKey: "account.achievements.croissance",
      descKey: "account.achievements.croissance.desc",
      earned: user.level === "croissance",
    },
    {
      id: "tenExchanges",
      emoji: "🎯",
      labelKey: "account.achievements.tenExchanges",
      descKey: "account.achievements.tenExchanges.desc",
      earned: user.totalExchanges >= 10,
    },
    {
      id: "bigGains",
      emoji: "🏆",
      labelKey: "account.achievements.bigGains",
      descKey: "account.achievements.bigGains.desc",
      earned: user.totalGains >= 50000,
    },
    {
      id: "alertsMode",
      emoji: "⭐",
      labelKey: "account.achievements.alertsMode",
      descKey: "account.achievements.alertsMode.desc",
      earned: user.mode === "alerts",
    },
  ];

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.07 }}
      className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-sm">
            {t("account.achievements.title")}
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">
          {earnedCount}/{achievements.length}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t("account.achievements.subtitle")}
      </p>

      <div className="grid grid-cols-5 gap-2">
        {achievements.map((a, i) => (
          <AchievementBadge
            key={a.id}
            achievement={a}
            delay={i * 0.05}
          />
        ))}
      </div>
    </motion.div>
  );
}

function AchievementBadge({
  achievement,
  delay,
}: {
  achievement: Achievement;
  delay: number;
}) {
  const t = useT();
  const label = t(achievement.labelKey);
  const desc = t(achievement.descKey);

  const handleClick = () => {
    if (achievement.earned) {
      toast.success(`${label}`, {
        description: desc,
        duration: 3500,
      });
    } else {
      toast(`${label} · ${t("account.achievements.locked")}`, {
        description: desc,
        duration: 3500,
      });
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
      whileTap={{ scale: 0.92 }}
      onClick={handleClick}
      className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors ${
        achievement.earned
          ? "bg-accent/20 border-accent/50 hover:bg-accent/30"
          : "bg-muted/40 border-border/50 opacity-60 grayscale"
      }`}
      title={label}
    >
      <div className="text-2xl leading-none relative">
        {achievement.emoji}
        {!achievement.earned && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40 rounded-full">
            <Lock className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="text-[9px] font-medium text-center leading-tight line-clamp-2 min-h-[24px]">
        {label}
      </div>
      {achievement.earned && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.15, type: "spring" }}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[oklch(0.7_0.18_150)] flex items-center justify-center"
        >
          <Check className="w-2.5 h-2.5 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
}

// ============================================================
// Profile Completion Meter (Task 2-c-dash, Feature 3)
// ============================================================
function ProfileCompletionMeter({ data }: { data: DashboardData }) {
  const t = useT();
  const { user } = data;

  const checks = [
    {
      key: "name",
      label: t("account.completion.check.name"),
      done: !!user.name,
    },
    {
      key: "capital",
      label: t("account.completion.check.capital"),
      done: user.capital > 0,
    },
    {
      key: "deposit",
      label: t("account.completion.check.deposit"),
      // first deposit = capital > 0 OR has at least one deposit transaction
      done:
        user.capital > 0 ||
        data.recentTransactions.some((tx) => tx.type === "deposit"),
    },
    {
      key: "mode",
      label: t("account.completion.check.mode"),
      done: !!user.mode,
    },
  ];

  const doneCount = checks.filter((c) => c.done).length;
  const percent = Math.round((doneCount / checks.length) * 100);
  const isComplete = percent === 100;

  const missing = checks.filter((c) => !c.done).map((c) => c.label);

  const handleClick = () => {
    if (isComplete) {
      toast.success(t("account.completion.complete"), {
        duration: 3000,
      });
    } else {
      toast(t("account.completion.title", { percent }), {
        description: t("account.completion.missing", {
          items: missing.join(", "),
        }),
        duration: 4000,
      });
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      onClick={handleClick}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-display font-semibold text-sm">
          {isComplete
            ? t("account.completion.complete")
            : t("account.completion.title", { percent })}
        </span>
        <span className="text-xs font-bold text-primary tabular-nums">
          {percent}%
        </span>
      </div>

      <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
          className={`h-full rounded-full ${
            isComplete ? "bg-[oklch(0.7_0.18_150)]" : "bg-brand-gradient"
          }`}
        />
        {isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{ width: "100%" }}
          />
        )}
      </div>

      {/* Check dots */}
      <div className="mt-3 flex items-center justify-between">
        {checks.map((c) => (
          <div
            key={c.key}
            className={`flex items-center gap-1 text-[10px] ${
              c.done ? "text-[oklch(0.45_0.1_155)]" : "text-muted-foreground"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                c.done
                  ? "bg-[oklch(0.7_0.18_150)]"
                  : "bg-muted border border-border"
              }`}
            >
              {c.done && <Check className="w-2 h-2 text-white" />}
            </div>
          </div>
        ))}
      </div>
    </motion.button>
  );
}

// ============================================================
// Settings Toggles (Task 2-c-dash, Feature 4)
// ============================================================
function SettingsToggles() {
  const t = useT();
  const [settings, setSettings] = useState({
    push: false,
    sms: false,
    daily: false,
    privacy: false,
  });

  // Load from localStorage on mount
  useEffect(() => {
    setSettings({
      push: getSetting("push-notifications"),
      sms: getSetting("sms-notifications"),
      daily: getSetting("daily-recap"),
      privacy: getSetting("balance-privacy"),
    });
  }, []);

  // Listen for external changes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string; value: boolean };
      if (detail.key === "push-notifications") setSettings((s) => ({ ...s, push: detail.value }));
      if (detail.key === "sms-notifications") setSettings((s) => ({ ...s, sms: detail.value }));
      if (detail.key === "daily-recap") setSettings((s) => ({ ...s, daily: detail.value }));
      if (detail.key === "balance-privacy") setSettings((s) => ({ ...s, privacy: detail.value }));
    };
    window.addEventListener("cashpilot-setting-change", handler);
    return () => window.removeEventListener("cashpilot-setting-change", handler);
  }, []);

  const update = (key: "push" | "sms" | "daily" | "privacy", value: boolean) => {
    setSettings((s) => ({ ...s, [key]: value }));
    const storageKey =
      key === "push"
        ? "push-notifications"
        : key === "sms"
        ? "sms-notifications"
        : key === "daily"
        ? "daily-recap"
        : "balance-privacy";
    setSetting(storageKey, value);
    toast.success(t("account.settings.updated"), { duration: 1500 });
  };

  const items: Array<{
    key: "push" | "sms" | "daily" | "privacy";
    icon: React.ElementType;
    label: string;
    desc: string;
  }> = [
    {
      key: "push",
      icon: Bell,
      label: t("account.settings.push"),
      desc: t("account.settings.push.desc"),
    },
    {
      key: "sms",
      icon: MessageCircle,
      label: t("account.settings.sms"),
      desc: t("account.settings.sms.desc"),
    },
    {
      key: "daily",
      icon: Mail,
      label: t("account.settings.daily"),
      desc: t("account.settings.daily.desc"),
    },
    {
      key: "privacy",
      icon: Shield,
      label: t("account.settings.privacy"),
      desc: t("account.settings.privacy.desc"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
    >
      <h3 className="font-display font-semibold text-sm mb-3">
        {t("account.settings.title")}
      </h3>
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <item.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </div>
            <Switch
              checked={settings[item.key]}
              onCheckedChange={(v) => update(item.key, v)}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// Referral Card (Task 2-c-dash, Feature 5)
// ============================================================
function ReferralCard({ phone }: { phone: string }) {
  const t = useT();
  const referralCode = phone || "CASHPILOT";
  // Simulated stats
  const referredCount = 0;

  const handleShare = async () => {
    const url = `https://cashpilot.africa/?ref=${encodeURIComponent(referralCode)}`;
    const text = t("account.referral.shareText", { url });
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("account.referral.copied"));
    } catch {
      // Fallback: copy just the URL
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t("account.referral.copied"));
      } catch {
        toast.success(url);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-2xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 border border-accent/40 p-5 shadow-soft"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center shrink-0">
          <Gift className="w-5 h-5 text-accent-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-sm">
            {t("account.referral.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("account.referral.subtitle")}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-background/70 border border-border/60 p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          {t("account.referral.code")}
        </div>
        <div className="font-display font-bold text-base tracking-wide mt-0.5 break-all">
          {referralCode}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {referredCount === 0
            ? t("account.referral.statsZero")
            : t("account.referral.stats", {
                count: referredCount,
                plural: referredCount > 1 ? "s" : "",
              })}
        </div>
        <Button
          onClick={handleShare}
          size="sm"
          className="h-9 rounded-lg text-xs font-semibold"
        >
          <Share2 className="w-3.5 h-3.5 mr-1.5" />
          {t("account.referral.share")}
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================================
// Level Progress Visualization (Task 2-c-dash, Feature 6)
// ============================================================
function LevelProgressCard({ data }: { data: DashboardData }) {
  const t = useT();
  const { user } = data;

  const minStarter = 10000;
  const minCroissance = 50000;
  const capital = user.capital;

  // Compute progress from starter threshold to croissance threshold
  const progress =
    user.level === "croissance"
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((capital - minStarter) / (minCroissance - minStarter)) * 100
          )
        );

  const remaining = Math.max(0, minCroissance - capital);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
    >
      <div className="flex items-center gap-2 mb-4">
        <Crown
          className={`w-4 h-4 ${
            user.level === "croissance" ? "text-accent-foreground" : "text-muted-foreground"
          }`}
        />
        <h3 className="font-display font-semibold text-sm">{t("account.level.title")}</h3>
      </div>

      {/* Level chips */}
      <div className="flex items-center justify-between mb-2">
        <LevelChip
          label={t("account.level.starter.label")}
          active={user.level === "starter"}
          variant="starter"
        />
        <LevelChip
          label={t("account.level.croissance.label")}
          active={user.level === "croissance"}
          variant="croissance"
        />
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-muted overflow-hidden mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          className="h-full bg-gradient-to-r from-primary via-primary to-[oklch(0.7_0.15_85)] rounded-full"
        />
        {/* Current position marker */}
        <motion.div
          initial={{ left: "0%", opacity: 0 }}
          animate={{ left: `${progress}%`, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-md"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatXAF(minStarter)} XAF</span>
        <span>{formatXAF(minCroissance)} XAF</span>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {user.level === "croissance"
          ? t("account.level.maxReached")
          : t("account.level.toGo", { amount: formatXAF(remaining) })}
      </p>
    </motion.div>
  );
}

function LevelChip({
  label,
  active,
  variant,
}: {
  label: string;
  active: boolean;
  variant: "starter" | "croissance";
}) {
  return (
    <div
      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
        active
          ? variant === "croissance"
            ? "bg-gold-gradient text-accent-foreground border-accent-foreground/20 shadow-gold"
            : "bg-brand-gradient text-primary-foreground border-primary-foreground/20"
          : "bg-muted/40 text-muted-foreground border-border/50"
      }`}
    >
      {label}
    </div>
  );
}

// ============================================================
// Original LevelCard (kept for reference / not used in main render anymore)
// ============================================================
function ContactRow({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground truncate">{value}</div>
      </div>
      {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
    </div>
  );
}

// ============================================================
// Support Chat Dialog (Task 2-c-dash, Feature 7: Enhanced)
// ============================================================
function SupportChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: t("account.support.greeting"),
      at: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickReplies = [
    t("account.support.quick.how"),
    t("account.support.quick.earn"),
    t("account.support.quick.withdraw"),
    t("account.support.quick.mode"),
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;

      const newMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: msg, at: Date.now() },
      ];
      setMessages(newMessages);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const json = await res.json();
        if (json.ok) {
          setMessages([
            ...newMessages,
            { role: "assistant", content: json.response, at: Date.now() },
          ]);
        } else {
          setMessages([
            ...newMessages,
            {
              role: "assistant",
              content: t("account.support.unavailable"),
              at: Date.now(),
            },
          ]);
        }
      } catch {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: t("account.support.networkError"),
            at: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, t]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md p-0 gap-0 overflow-hidden h-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-border/60 flex flex-row items-center gap-3 space-y-0">
          <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <DialogTitle className="font-display font-bold text-base">
              {t("account.support.assistant")}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-[oklch(0.7_0.18_150)]"
              />
              <span className="text-[11px] text-muted-foreground">
                {t("account.support.online")}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3 bg-muted/30"
        >
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-brand-gradient text-primary-foreground rounded-br-md"
                    : "bg-card border border-border/60 text-foreground rounded-bl-md shadow-soft"
                }`}
              >
                {m.content}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                {new Date(m.at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-4 py-3 shadow-soft">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick replies */}
        {messages.length <= 1 && !loading && (
          <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 bg-card">
            {quickReplies.map((q) => (
              <motion.button
                key={q}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => send(q)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/8 text-primary border border-primary/20 hover:bg-primary/12 transition-colors"
              >
                {q}
              </motion.button>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-border/60 bg-card">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t("account.support.placeholder")}
              disabled={loading}
              className="flex-1 h-11 rounded-xl border border-border bg-background px-4 text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
            <Button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-11 w-11 rounded-xl shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
