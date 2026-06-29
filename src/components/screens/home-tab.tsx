"use client";

import {
  motion,
  AnimatePresence,
  type PanInfo,
} from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Bot,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  Lightbulb,
  Zap,
  Clock,
  ChevronDown,
  Loader2,
  BarChart3,
  Crown,
  LifeBuoy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/cashpilot/animated-number";
import { ModeSwitcher } from "@/components/cashpilot/mode-switcher";
import { ModeSwitchDialog } from "@/components/cashpilot/mode-switch-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useCashPilotStore } from "@/lib/store";
import {
  formatXAF,
  formatRelativeTime,
  formatTime,
  formatDateTime,
  cn,
  isThisWeek,
  isThisMonth,
} from "@/lib/utils";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useT } from "@/lib/i18n/context";
import type { DashboardData, UserMode, Transaction } from "@/lib/types";

interface HomeTabProps {
  data: DashboardData;
  onDeposit: () => void;
  onWithdraw: () => void;
  refresh?: () => Promise<void> | void;
  lastGain?: { amount: number; at: number } | null;
}

type StatSheetKey = "capital" | "balance" | "exchanges" | "level" | null;
type ChartRange = "24h" | "7d" | "30d" | "all";

const PULL_THRESHOLD = 80;
const PULL_MAX = 120;
const CROISSANCE_THRESHOLD = 50000;

export function HomeTab({ data, onDeposit, onWithdraw, refresh, lastGain }: HomeTabProps) {
  const t = useT();
  const {
    user,
    todayGains,
    todayExchanges,
    lastExchange,
    recentTransactions,
    gainsHistory,
  } = data;
  const [switchOpen, setSwitchOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<UserMode>("alerts");

  // Immersive state
  const [expandedHero, setExpandedHero] = useState(false);
  const [openSheet, setOpenSheet] = useState<StatSheetKey>(null);
  const [expandedLastExchange, setExpandedLastExchange] = useState(false);
  const [openChartModal, setOpenChartModal] = useState(false);

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);

  // Live gain pulse state
  const [pulseActive, setPulseActive] = useState(false);
  const [floatingGain, setFloatingGain] = useState<number | null>(null);

  const hasCapital = user.capital > 0;
  const gainsAvailable = user.balance;

  // === Live gain pulse effect ===
  useEffect(() => {
    if (!lastGain) return;
    setPulseActive(true);
    setFloatingGain(lastGain.amount);
    const pulseTimer = setTimeout(() => setPulseActive(false), 1600);
    const floatTimer = setTimeout(() => setFloatingGain(null), 2400);
    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(floatTimer);
    };
  }, [lastGain?.at]);

  const handleSwitch = (mode: UserMode) => {
    setTargetMode(mode);
    setSwitchOpen(true);
  };

  // === Pull-to-refresh handlers ===
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    if (typeof window !== "undefined" && window.scrollY > 0) return;
    touchStartY.current = e.touches[0].clientY;
    setPulling(true);
  }, [refreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null || refreshing) return;
    if (typeof window !== "undefined" && window.scrollY > 0) {
      if (pullDistance !== 0) setPullDistance(0);
      return;
    }
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      // Resistance factor for natural feel
      const resisted = Math.min(deltaY * 0.5, PULL_MAX);
      setPullDistance(resisted);
    } else if (pullDistance !== 0) {
      setPullDistance(0);
    }
  }, [refreshing, pullDistance]);

  const onTouchEnd = useCallback(async () => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;
    setPulling(false);
    if (pullDistance > PULL_THRESHOLD && refresh && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.5);
      try {
        await Promise.resolve(refresh());
      } catch {
        // ignore refresh errors
      }
      // brief loader visibility
      await new Promise((r) => setTimeout(r, 500));
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, refresh, refreshing]);

  const pullProgress = pullDistance / PULL_THRESHOLD;
  const pullReached = pullDistance >= PULL_THRESHOLD;

  return (
    <div
      className="relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ overscrollBehaviorY: "contain" } as React.CSSProperties}
    >
      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || refreshing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-2 flex flex-col items-center pointer-events-none z-40"
          >
            <motion.div
              animate={{ rotate: refreshing ? 360 : 0 }}
              transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: "linear" } : { duration: 0.2 }}
            >
              {refreshing ? (
                <Loader2 className="w-5 h-5 text-primary" />
              ) : (
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-primary transition-transform duration-200",
                    pullReached && "rotate-180"
                  )}
                />
              )}
            </motion.div>
            <span className="text-[10px] font-medium text-muted-foreground mt-1">
              {refreshing
                ? t("home.refresh")
                : pullReached
                ? t("home.refresh.release")
                : t("home.refresh.pull")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{ y: refreshing ? PULL_THRESHOLD * 0.5 : pullDistance }}
        transition={pulling ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 32 }}
        className="space-y-4"
      >
        {/* Mode switcher (en haut, toujours visible) */}
        <ModeSwitcher data={data} onSwitch={handleSwitch} />

        {/* Hero balance card (tappable, expandable, with live gain pulse) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={
            pulseActive
              ? {
                  opacity: 1,
                  y: 0,
                  boxShadow: [
                    "0px 0px 0px 0px rgba(244, 196, 84, 0)",
                    "0px 0px 32px 6px rgba(244, 196, 84, 0.55)",
                    "0px 0px 0px 0px rgba(244, 196, 84, 0)",
                  ],
                }
              : { opacity: 1, y: 0 }
          }
          transition={pulseActive ? { duration: 1.5 } : { duration: 0.4 }}
          className="relative rounded-3xl bg-brand-gradient p-6 text-primary-foreground shadow-soft-lg overflow-hidden"
        >
          {/* Decorative blob */}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <motion.div
              animate={{ scale: [1, 1.2, 1], x: [0, 20, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-12 -right-8 w-48 h-48 rounded-full bg-[oklch(0.82_0.13_88)]"
            />
          </div>

          <button
            type="button"
            onClick={() => setExpandedHero((v) => !v)}
            className="relative w-full text-left"
            aria-expanded={expandedHero}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-primary-foreground/80">
                {t("home.gainsTotal")}
              </div>
              <div className="flex items-center gap-2">
                <RobotStatusBadge active={hasCapital && user.status === "active"} />
                <motion.div
                  animate={{ rotate: expandedHero ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="w-6 h-6 rounded-full bg-primary-foreground/15 flex items-center justify-center"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </motion.div>
              </div>
            </div>

            <div className="mt-2 font-display font-extrabold text-4xl sm:text-5xl tracking-tight relative">
              <AnimatedNumber
                value={user.totalGains}
                format={(n) => formatXAF(Math.round(n))}
              />
              <span className="text-lg font-semibold ml-2 text-primary-foreground/80">XAF</span>

              {/* Floating "+X XAF" on live gain */}
              <AnimatePresence>
                {floatingGain !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 0, scale: 0.8 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      y: [0, -8, -28, -52],
                      scale: 1,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.4, times: [0, 0.12, 0.7, 1] }}
                    className="absolute top-0 right-0 font-display font-extrabold text-2xl text-[oklch(0.92_0.16_88)] pointer-events-none drop-shadow-lg"
                  >
                    +{formatXAF(floatingGain)} XAF
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs font-semibold">
                <TrendingUp className="w-3 h-3" />
                {t("home.todayGains", { amount: formatXAF(todayGains) })}
              </div>
              <div className="text-xs text-primary-foreground/70">
                {t("home.exchanges", {
                  count: todayExchanges,
                  plural: todayExchanges > 1 ? "s" : "",
                })}
              </div>
            </div>

            {!expandedHero && (
              <div className="mt-3 text-[10px] text-primary-foreground/60 flex items-center gap-1">
                <ChevronDown className="w-2.5 h-2.5" />
                {t("home.hero.tapHint")}
              </div>
            )}
          </button>

          {/* Expandable details */}
          <AnimatePresence initial={false}>
            {expandedHero && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                className="relative overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-primary-foreground/15 grid grid-cols-2 gap-3">
                  <HeroDetail
                    label={t("home.hero.weekly")}
                    value={`+${formatXAF(computeWeeklyGains(recentTransactions))} XAF`}
                  />
                  <HeroDetail
                    label={t("home.hero.monthly")}
                    value={`+${formatXAF(computeMonthlyGains(recentTransactions))} XAF`}
                  />
                  <HeroDetail
                    label={t("home.hero.avgDaily")}
                    value={`${formatXAF(computeAvgDailyGains(recentTransactions, user.totalGains))} XAF`}
                  />
                  <HeroDetail
                    label={t("home.hero.bestDay")}
                    value={computeBestDay(recentTransactions, t)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <ActionButton
            icon={ArrowDownToLine}
            label={t("home.deposit")}
            sublabel={t("home.depositSub")}
            onClick={onDeposit}
            variant="primary"
          />
          <ActionButton
            icon={ArrowUpFromLine}
            label={t("home.withdraw")}
            sublabel={hasCapital ? `${formatXAF(gainsAvailable)} XAF` : t("home.withdrawNoFunds")}
            onClick={onWithdraw}
            variant="gold"
            disabled={!hasCapital || gainsAvailable < 2000}
          />
        </div>

        {/* Smart insights card (NEW) */}
        <SmartInsightsCard data={data} />

        {/* Empty state: pas encore de capital */}
        {!hasCapital && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-accent/40 border border-accent/60 p-5"
          >
            <div className="flex items-start gap-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0"
              >
                <Zap className="w-5 h-5 text-accent-foreground" />
              </motion.div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-foreground">
                  {t("home.activate.title")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("home.activate.desc")}
                </p>
                <Button
                  onClick={onDeposit}
                  size="sm"
                  className="mt-3 h-9 font-semibold rounded-lg"
                >
                  {t("home.activate.cta")}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats grid (tappable → Sheet) */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Wallet}
            label={t("home.stat.capital")}
            value={`${formatXAF(user.capital)} XAF`}
            color="oklch(0.45 0.1 155)"
            bg="oklch(0.95 0.02 130)"
            onClick={() => setOpenSheet("capital")}
          />
          <StatCard
            icon={Activity}
            label={t("home.stat.balance")}
            value={`${formatXAF(user.balance)} XAF`}
            color="oklch(0.6 0.13 85)"
            bg="oklch(0.95 0.03 90)"
            onClick={() => setOpenSheet("balance")}
          />
          <StatCard
            icon={Zap}
            label={t("home.stat.exchanges")}
            value={user.totalExchanges.toString()}
            color="oklch(0.45 0.1 155)"
            bg="oklch(0.95 0.02 155)"
            onClick={() => setOpenSheet("exchanges")}
          />
          <StatCard
            icon={Crown}
            label={t("home.stat.level")}
            value={user.level === "croissance" ? t("common.croissance") : t("common.starter")}
            color="oklch(0.55 0.13 85)"
            bg="oklch(0.95 0.03 95)"
            highlight={user.level === "croissance"}
            onClick={() => setOpenSheet("level")}
          />
        </div>

        {/* Interactive gains chart */}
        {hasCapital && gainsHistory.length > 0 && (
          <InteractiveChart
            data={gainsHistory}
            onOpenModal={() => setOpenChartModal(true)}
          />
        )}

        {/* Last exchange (tappable, expandable) */}
        {lastExchange && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
          >
            <button
              type="button"
              onClick={() => setExpandedLastExchange((v) => !v)}
              aria-expanded={expandedLastExchange}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-primary" />
                <h3 className="font-display font-semibold text-sm flex-1">
                  {t("home.lastExchange.title")}
                </h3>
                <motion.div
                  animate={{ rotate: expandedLastExchange ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{lastExchange.market}</div>
                  <div className="font-display font-bold text-lg text-foreground">
                    +{formatXAF(lastExchange.gain)} XAF
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(lastExchange.createdAt)}
                  </div>
                </div>
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-14 h-14 rounded-full bg-brand-gradient flex items-center justify-center"
                >
                  <TrendingUp className="w-7 h-7 text-primary-foreground" />
                </motion.div>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {expandedLastExchange && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 gap-3 text-sm">
                    <DetailRow
                      label={t("home.lastExchange.market")}
                      value={lastExchange.market}
                    />
                    <DetailRow
                      label={t("home.lastExchange.pair")}
                      value={lastExchange.pair}
                    />
                    <DetailRow
                      label={t("home.lastExchange.buy")}
                      value={`≈ ${formatXAF(simulateBuyPrice(lastExchange.gain))} XAF`}
                    />
                    <DetailRow
                      label={t("home.lastExchange.sell")}
                      value={`≈ ${formatXAF(simulateSellPrice(lastExchange.gain))} XAF`}
                    />
                    <DetailRow
                      label={t("home.lastExchange.gain")}
                      value={`+${formatXAF(lastExchange.gain)} XAF`}
                      valueClass="text-[oklch(0.45_0.1_155)] font-bold"
                    />
                    <DetailRow
                      label={t("home.lastExchange.time")}
                      value={formatDateTime(lastExchange.createdAt)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Recent activity (tappable transactions → toast) */}
        <div className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm">{t("home.activity.title")}</h3>
            <span className="text-xs text-muted-foreground">
              {t("home.activity.count", {
                count: recentTransactions.length,
                plural: recentTransactions.length > 1 ? "s" : "",
              })}
            </span>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📊</div>
              <p className="text-sm text-muted-foreground">
                {t("home.activity.empty.title")}
                <br />
                {hasCapital
                  ? t("home.activity.empty.hasCapital")
                  : t("home.activity.empty.noCapital")}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <AnimatePresence initial={false}>
                {recentTransactions.slice(0, 6).map((tx, i) => (
                  <motion.button
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => showTransactionToast(tx, t)}
                    className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg transition-colors hover:bg-primary/5 active:bg-primary/10 text-left"
                  >
                    <TransactionIcon type={tx.type} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {tx.type === "gain"
                          ? t("home.tx.gain")
                          : tx.type === "deposit"
                          ? t("home.tx.deposit")
                          : tx.type === "subscription"
                          ? t("home.tx.deposit")
                          : t("home.tx.withdraw")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(tx.createdAt)}
                      </div>
                    </div>
                    <div
                      className={`font-display font-bold text-sm ${
                        tx.amount > 0
                          ? "text-[oklch(0.45_0.1_155)]"
                          : "text-foreground"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {formatXAF(tx.amount)} XAF
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Dialog de changement de mode */}
        <ModeSwitchDialog
          open={switchOpen}
          onOpenChange={setSwitchOpen}
          targetMode={targetMode}
          data={data}
        />
      </motion.div>

      {/* Stat detail sheets */}
      <StatDetailSheet
        openKey={openSheet}
        onOpenChange={(k) => setOpenSheet(k)}
        data={data}
      />

      {/* Full chart modal */}
      <FullChartModal
        open={openChartModal}
        onOpenChange={setOpenChartModal}
        data={data}
      />
    </div>
  );
}

// === Hero detail (small label/value in expanded section) ===
function HeroDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-primary-foreground/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-primary-foreground/70 font-semibold">
        {label}
      </div>
      <div className="font-display font-bold text-sm text-primary-foreground mt-0.5">
        {value}
      </div>
    </div>
  );
}

// === Detail row (label/value) for expandable cards ===
function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={cn("font-display font-semibold text-foreground mt-0.5", valueClass)}>
        {value}
      </div>
    </div>
  );
}

function RobotStatusBadge({ active }: { active: boolean }) {
  const t = useT();
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1">
      <motion.div
        animate={active ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
        className={`w-2 h-2 rounded-full ${
          active ? "bg-[oklch(0.85_0.18_150)]" : "bg-primary-foreground/40"
        }`}
      />
      <span className="text-[11px] font-semibold">
        {active ? t("home.robotActive") : t("home.robotWaiting")}
      </span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  sublabel,
  onClick,
  variant,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  onClick: () => void;
  variant: "primary" | "gold";
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative rounded-2xl p-4 text-left shadow-soft overflow-hidden transition-opacity ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${
        variant === "primary"
          ? "bg-brand-gradient text-primary-foreground"
          : "bg-gold-gradient text-accent-foreground"
      }`}
    >
      <Icon className="w-5 h-5 mb-2" />
      <div className="font-display font-bold text-base">{label}</div>
      <div
        className={`text-xs ${
          variant === "primary" ? "text-primary-foreground/70" : "text-accent-foreground/70"
        }`}
      >
        {sublabel}
      </div>
    </motion.button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  highlight,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative w-full text-left rounded-2xl p-4 border shadow-soft ${
        highlight ? "border-accent bg-accent/30" : "border-border/60 bg-card"
      }`}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
        style={{ background: bg }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-base mt-0.5">{value}</div>
      {/* Subtle "tap" hint */}
      <ChevronDown className="absolute top-3 right-3 w-3 h-3 text-muted-foreground/40" />
    </motion.button>
  );
}

function TransactionIcon({ type }: { type: string }) {
  if (type === "gain") {
    return (
      <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
        <TrendingUp className="w-4 h-4 text-primary-foreground" />
      </div>
    );
  }
  if (type === "deposit" || type === "subscription") {
    return (
      <div className="w-9 h-9 rounded-full bg-[oklch(0.95_0.03_90)] flex items-center justify-center shrink-0">
        <ArrowDownToLine className="w-4 h-4 text-[oklch(0.6_0.13_85)]" />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
      <ArrowUpFromLine className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}

// === Smart Insights Card ===
interface Insight {
  id: string;
  text: string;
}

function SmartInsightsCard({ data }: { data: DashboardData }) {
  const t = useT();
  const insights = useMemo(() => computeInsights(data, t), [data, t]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % insights.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [insights.length]);

  // Reset index if out of bounds after data change
  useEffect(() => {
    if (index >= insights.length) setIndex(0);
  }, [insights.length, index]);

  const current = insights[Math.min(index, insights.length - 1)] ?? insights[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl bg-gradient-to-br from-primary/5 to-accent/10 border border-primary/20 p-4 shadow-soft"
    >
      <div className="flex items-center gap-2 mb-2">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Lightbulb className="w-3.5 h-3.5 text-accent" />
        </motion.div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
          {t("home.insights.title")}
        </span>
      </div>
      <div className="relative min-h-[1.5rem] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-medium text-foreground leading-snug"
          >
            {current.text}
          </motion.div>
        </AnimatePresence>
      </div>
      {insights.length > 1 && (
        <div className="flex gap-1 mt-2">
          {insights.map((ins, i) => (
            <div
              key={ins.id}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === index ? "w-4 bg-accent" : "w-1 bg-accent/30"
              )}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function computeInsights(data: DashboardData, t: (k: string, p?: Record<string, string | number>) => string): Insight[] {
  const insights: Insight[] = [];
  const { user, todayExchanges, recentTransactions } = data;

  // 1. Weekly gains percent
  const weekGains = recentTransactions
    .filter((tx) => tx.type === "gain" && isThisWeek(tx.createdAt))
    .reduce((s, tx) => s + tx.amount, 0);
  if (weekGains > 0 && user.capital > 0) {
    const percent = Math.round((weekGains / user.capital) * 100);
    if (percent > 0) {
      insights.push({
        id: "up",
        text: t("home.insights.up", { percent }),
      });
    }
  }

  // 2. No trades today
  if (todayExchanges === 0) {
    insights.push({
      id: "noTrades",
      text: t("home.insights.noTrades"),
    });
  }

  // 3. Best day
  const gainByDay = new Map<string, { date: Date; amount: number }>();
  recentTransactions
    .filter((tx) => tx.type === "gain")
    .forEach((tx) => {
      const d = new Date(tx.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const existing = gainByDay.get(key);
      if (existing) {
        existing.amount += tx.amount;
      } else {
        gainByDay.set(key, { date: d, amount: tx.amount });
      }
    });
  let bestDay: { date: Date; amount: number } | null = null;
  for (const v of gainByDay.values()) {
    if (!bestDay || v.amount > bestDay.amount) bestDay = v;
  }
  if (bestDay && bestDay.amount > 0) {
    const dateStr = bestDay.date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
    });
    insights.push({
      id: "bestDay",
      text: t("home.insights.bestDay", {
        amount: formatXAF(bestDay.amount),
        date: dateStr,
      }),
    });
  }

  // 4. More capital (capital < 50000)
  if (user.capital < CROISSANCE_THRESHOLD) {
    insights.push({
      id: "moreCapital",
      text: t("home.insights.moreCapital"),
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "default",
      text: t("home.insights.default"),
    });
  }

  return insights;
}

// === Interactive Gains Chart ===
function InteractiveChart({
  data,
  onOpenModal,
}: {
  data: { time: string; value: number }[];
  onOpenModal?: () => void;
}) {
  const t = useT();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: 100 - (d.value / max) * 100,
    value: d.value,
    time: d.time,
  }));

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  const handleMove = useCallback((clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    const relX = (clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(relX * (data.length - 1))));
    setHoverIdx(idx);
  }, [data.length]);

  const lastPoint = points[points.length - 1];
  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display font-semibold text-sm">{t("home.chart.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("home.chart.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onOpenModal}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label={t("home.chart.expand")}
        >
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div
        className="relative h-32 w-full cursor-crosshair"
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => handleMove(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="gains-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.45 0.1 155)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="oklch(0.45 0.1 155)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={areaD}
            fill="url(#gains-gradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
          <motion.path
            d={pathD}
            fill="none"
            stroke="oklch(0.45 0.1 155)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
          />
          {/* Latest data point + pulse */}
          {lastPoint && (
            <g>
              <motion.circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="1.4"
                fill="oklch(0.55 0.13 85)"
                vectorEffect="non-scaling-stroke"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.3, type: "spring", stiffness: 300 }}
              />
              <motion.circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="2.5"
                fill="none"
                stroke="oklch(0.55 0.13 85)"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
                initial={{ opacity: 0.8, scale: 1 }}
                animate={{ opacity: [0.8, 0], scale: [1, 2] }}
                style={{ transformOrigin: `${lastPoint.x}px ${lastPoint.y}px` }}
                transition={{ duration: 1.6, repeat: Infinity, delay: 1.4 }}
              />
            </g>
          )}
          {/* Hover indicator */}
          {hoverPoint && (
            <>
              <line
                x1={hoverPoint.x}
                y1="0"
                x2={hoverPoint.x}
                y2="100"
                stroke="oklch(0.45 0.1 155)"
                strokeWidth="0.3"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="1 1"
                opacity="0.6"
              />
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r="1.6"
                fill="oklch(0.45 0.1 155)"
                stroke="white"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoverPoint && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              style={{
                left: `${hoverPoint.x}%`,
                top: 0,
                transform: hoverPoint.x > 50 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              }}
              className="absolute pointer-events-none rounded-lg bg-popover border border-border/60 shadow-soft px-2.5 py-1.5 z-10"
            >
              <div className="font-display font-bold text-sm text-[oklch(0.45_0.1_155)]">
                +{formatXAF(hoverPoint.value)} XAF
              </div>
              <div className="text-[10px] text-muted-foreground whitespace-nowrap">{hoverPoint.time}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("home.chart.24hAgo")}</span>
        <span className="font-semibold text-[oklch(0.45_0.1_155)]">
          +{formatXAF(data[data.length - 1]?.value || 0)} XAF
        </span>
        <span>{t("home.chart.now")}</span>
      </div>

      {onOpenModal && (
        <button
          type="button"
          onClick={onOpenModal}
          className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
        >
          <BarChart3 className="w-3 h-3" />
          {t("home.chart.expand")}
        </button>
      )}
    </motion.div>
  );
}

// === Full Chart Modal (Sheet at bottom) ===
function FullChartModal({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardData;
}) {
  const t = useT();
  const [range, setRange] = useState<ChartRange>("24h");
  const chartData = useMemo(() => getChartData(range, data), [range, data]);
  const total = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
  const hasData = chartData.length > 1 || (chartData.length === 1 && chartData[0].value > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[88vh] rounded-t-3xl p-0 flex flex-col"
      >
        <SheetHeader className="bg-brand-gradient text-primary-foreground rounded-t-3xl px-5 py-4">
          <SheetTitle className="text-primary-foreground font-display font-bold text-lg">
            {t("home.chart.modal.title")}
          </SheetTitle>
          <SheetDescription className="text-primary-foreground/80">
            {t("home.chart.modal.subtitle")}
          </SheetDescription>
        </SheetHeader>

        {/* Range tabs */}
        <div className="flex gap-2 px-5 py-3 border-b border-border/60">
          {(["24h", "7d", "30d", "all"] as ChartRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {t(`home.chart.modal.${r}`)}
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("home.chart.modal.total")}</span>
          <motion.span
            key={`${range}-${total}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="font-display font-extrabold text-xl text-[oklch(0.45_0.1_155)]"
          >
            +{formatXAF(total)} XAF
          </motion.span>
        </div>

        {/* Big chart */}
        <div className="flex-1 px-5 pb-6 overflow-hidden">
          {hasData ? (
            <BigChart data={chartData} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">{t("home.chart.modal.noData")}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BigChart({ data }: { data: { time: string; value: number }[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: 100 - (d.value / max) * 100,
    value: d.value,
    time: d.time,
  }));
  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  const handleMove = useCallback((clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    const relX = (clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(relX * (data.length - 1))));
    setHoverIdx(idx);
  }, [data.length]);

  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;
  const lastPoint = points[points.length - 1];

  return (
    <div
      className="relative w-full h-full"
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseLeave={() => setHoverIdx(null)}
      onTouchStart={(e) => handleMove(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={() => setHoverIdx(null)}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="big-gains-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.45 0.1 155)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.45 0.1 155)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={areaD}
          fill="url(#big-gains-gradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={pathD}
          fill="none"
          stroke="oklch(0.45 0.1 155)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
        />
        {lastPoint && (
          <g>
            <motion.circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="1.2"
              fill="oklch(0.55 0.13 85)"
              vectorEffect="non-scaling-stroke"
            />
            <motion.circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="1.2"
              fill="none"
              stroke="oklch(0.55 0.13 85)"
              strokeWidth="0.3"
              vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0.7, scale: 1 }}
              animate={{ opacity: [0.7, 0], scale: [1, 2.5] }}
              style={{ transformOrigin: `${lastPoint.x}px ${lastPoint.y}px` }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          </g>
        )}
        {hoverPoint && (
          <>
            <line
              x1={hoverPoint.x}
              y1="0"
              x2={hoverPoint.x}
              y2="100"
              stroke="oklch(0.45 0.1 155)"
              strokeWidth="0.25"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="1 1"
              opacity="0.6"
            />
            <circle
              cx={hoverPoint.x}
              cy={hoverPoint.y}
              r="1.4"
              fill="oklch(0.45 0.1 155)"
              stroke="white"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {/* X-axis labels (sparse) */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-muted-foreground px-1 pointer-events-none">
        <span>{data[0]?.time ?? ""}</span>
        <span>{data[Math.floor(data.length / 2)]?.time ?? ""}</span>
        <span>{data[data.length - 1]?.time ?? ""}</span>
      </div>

      <AnimatePresence>
        {hoverPoint && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              left: `${hoverPoint.x}%`,
              top: 8,
              transform: hoverPoint.x > 50 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
            }}
            className="absolute pointer-events-none rounded-lg bg-popover border border-border/60 shadow-soft px-3 py-1.5 z-10"
          >
            <div className="font-display font-bold text-sm text-[oklch(0.45_0.1_155)]">
              +{formatXAF(hoverPoint.value)} XAF
            </div>
            <div className="text-[10px] text-muted-foreground whitespace-nowrap">{hoverPoint.time}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// === Stat Detail Sheet (handles all 4 stat cards) ===
function StatDetailSheet({
  openKey,
  onOpenChange,
  data,
}: {
  openKey: StatSheetKey;
  onOpenChange: (k: StatSheetKey) => void;
  data: DashboardData;
}) {
  const t = useT();
  const open = openKey !== null;

  let title = "";
  let description = "";
  let content: React.ReactNode = null;

  if (openKey === "capital") {
    title = t("home.sheet.capital.title");
    description = t("home.sheet.capital.desc");
    content = <CapitalSheetContent data={data} />;
  } else if (openKey === "balance") {
    title = t("home.sheet.balance.title");
    description = t("home.sheet.balance.desc");
    content = <BalanceSheetContent data={data} />;
  } else if (openKey === "exchanges") {
    title = t("home.sheet.exchanges.title");
    description = t("home.sheet.exchanges.desc");
    content = <ExchangesSheetContent data={data} />;
  } else if (openKey === "level") {
    title = t("home.sheet.level.title");
    description = t("home.sheet.level.desc");
    content = <LevelSheetContent data={data} />;
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(null);
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[88vh] rounded-t-3xl p-0 flex flex-col"
      >
        <SheetHeader className="bg-brand-gradient text-primary-foreground rounded-t-3xl px-5 py-4">
          <SheetTitle className="text-primary-foreground font-display font-bold text-lg">
            {title}
          </SheetTitle>
          {description && (
            <SheetDescription className="text-primary-foreground/80">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">{content}</div>
      </SheetContent>
    </Sheet>
  );
}

function CapitalSheetContent({ data }: { data: DashboardData }) {
  const t = useT();
  const { user, recentTransactions } = data;

  const deposits = recentTransactions.filter((tx) => tx.type === "deposit");

  // Capital evolution sparkline (cumulative deposits)
  const evolution = useMemo(() => {
    let cum = 0;
    const pts: { time: string; value: number }[] = [{ time: "", value: 0 }];
    deposits.forEach((tx) => {
      cum += tx.amount;
      pts.push({ time: formatTime(tx.createdAt), value: cum });
    });
    return pts;
  }, [deposits]);

  return (
    <div className="space-y-5">
      {/* Total capital */}
      <div className="rounded-2xl bg-muted/40 p-4">
        <div className="text-xs text-muted-foreground">{t("home.sheet.capital.total")}</div>
        <div className="font-display font-extrabold text-2xl text-foreground mt-1">
          {formatXAF(user.capital)} <span className="text-base font-semibold text-muted-foreground">XAF</span>
        </div>
      </div>

      {/* Capital evolution sparkline */}
      {evolution.length > 1 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("home.sheet.capital.evolution")}
            </h4>
          </div>
          <Sparkline data={evolution} color="oklch(0.45 0.1 155)" />
        </div>
      )}

      {/* Recent deposits */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownToLine className="w-3.5 h-3.5 text-[oklch(0.6_0.13_85)]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("home.sheet.capital.deposits")}
          </h4>
        </div>
        {deposits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("home.sheet.capital.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {deposits.slice(0, 8).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[oklch(0.95_0.03_90)] flex items-center justify-center shrink-0">
                    <ArrowDownToLine className="w-3.5 h-3.5 text-[oklch(0.6_0.13_85)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {operatorLabel(tx.operator, t)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(tx.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="font-display font-bold text-sm text-[oklch(0.45_0.1_155)] whitespace-nowrap">
                  +{formatXAF(tx.amount)} XAF
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BalanceSheetContent({ data }: { data: DashboardData }) {
  const t = useT();
  const { user } = data;
  const gains = Math.max(user.totalGains, 0);
  const capital = Math.max(user.capital, 0);
  const total = gains + capital;
  const gainsPct = total > 0 ? (gains / total) * 100 : 0;
  const capitalPct = total > 0 ? (capital / total) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-muted/40 p-4">
        <div className="text-xs text-muted-foreground">{t("home.stat.balance")}</div>
        <div className="font-display font-extrabold text-2xl text-foreground mt-1">
          {formatXAF(user.balance)} <span className="text-base font-semibold text-muted-foreground">XAF</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {t("home.sheet.balance.withdrawable")}: {formatXAF(user.balance)} XAF
        </div>
      </div>

      {/* Distribution bar */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("home.sheet.balance.distribution")}
          </h4>
        </div>

        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("home.sheet.capital.empty")}
          </p>
        ) : (
          <>
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${capitalPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="bg-primary"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${gainsPct}%` }}
                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                className="bg-[oklch(0.55_0.13_85)]"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.55_0.13_85)]" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {t("home.sheet.balance.gains")}
                  </span>
                </div>
                <div className="font-display font-bold text-lg mt-1">
                  {formatXAF(gains)} <span className="text-xs text-muted-foreground">XAF</span>
                </div>
                <div className="text-xs text-muted-foreground">{Math.round(gainsPct)}%</div>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {t("home.sheet.balance.capital")}
                  </span>
                </div>
                <div className="font-display font-bold text-lg mt-1">
                  {formatXAF(capital)} <span className="text-xs text-muted-foreground">XAF</span>
                </div>
                <div className="text-xs text-muted-foreground">{Math.round(capitalPct)}%</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ExchangesSheetContent({ data }: { data: DashboardData }) {
  const t = useT();
  const { user, recentTransactions, lastExchange } = data;

  // Derive recent exchanges from gain transactions
  const exchanges = useMemo(() => {
    return recentTransactions
      .filter((tx) => tx.type === "gain")
      .slice(0, 10)
      .map((tx, i) => {
        // For the most recent gain, use lastExchange data if available
        const useLastExchange = i === 0 && lastExchange;
        return {
          id: tx.id,
          market: useLastExchange ? lastExchange!.market : "Binance ↔ Local",
          pair: useLastExchange ? lastExchange!.pair : "USDT/XAF",
          gain: tx.amount,
          createdAt: tx.createdAt,
        };
      });
  }, [recentTransactions, lastExchange]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-muted/40 p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
          <Bot className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t("home.stat.exchanges")}</div>
          <div className="font-display font-extrabold text-2xl text-foreground">
            {user.totalExchanges}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("home.sheet.exchanges.desc")}
          </h4>
        </div>
        {exchanges.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("home.sheet.exchanges.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {exchanges.map((ex) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-border/40 bg-card"
              >
                <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {ex.market}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{ex.pair}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(ex.createdAt)}</span>
                  </div>
                </div>
                <div className="font-display font-bold text-sm text-[oklch(0.45_0.1_155)] whitespace-nowrap">
                  +{formatXAF(ex.gain)} XAF
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LevelSheetContent({ data }: { data: DashboardData }) {
  const t = useT();
  const { user } = data;
  const isCroissance = user.level === "croissance";
  const progressPct = Math.min(100, (user.capital / CROISSANCE_THRESHOLD) * 100);

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-2xl p-4 border",
          isCroissance ? "bg-accent/20 border-accent" : "bg-muted/40 border-border/60"
        )}
      >
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
              isCroissance ? "bg-gold-gradient" : "bg-muted"
            )}
          >
            <Crown className={cn("w-6 h-6", isCroissance ? "text-accent-foreground" : "text-muted-foreground")} />
          </motion.div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">{t("home.stat.level")}</div>
            <div className="font-display font-extrabold text-2xl text-foreground">
              {isCroissance ? t("home.sheet.level.croissance") : t("home.sheet.level.starter")}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {isCroissance
            ? t("home.sheet.level.croissanceDesc")
            : t("home.sheet.level.starterDesc")}
        </p>
      </div>

      {/* Progress to Croissance */}
      {!isCroissance && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("home.sheet.level.progress")}
            </span>
            <span className="text-xs font-semibold text-foreground">
              {formatXAF(user.capital)} / {formatXAF(CROISSANCE_THRESHOLD)} XAF
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
              className="h-full rounded-full bg-gold-gradient relative"
            >
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-accent/30"
              />
            </motion.div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {t("home.sheet.level.threshold", { amount: formatXAF(CROISSANCE_THRESHOLD) })}
          </div>
        </div>
      )}

      {isCroissance && (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-center">
          <div className="text-2xl mb-1">🎉</div>
          <p className="font-display font-bold text-foreground">
            {t("home.sheet.level.progressDone")}
          </p>
        </div>
      )}

      {/* Benefits list */}
      <div className="space-y-2">
        <BenefitItem
          icon={Bot}
          label={isCroissance ? "Robot prioritaire" : "Robot standard"}
          active={isCroissance}
        />
        <BenefitItem
          icon={TrendingUp}
          label={isCroissance ? "Rendements optimisés" : "Rendements de base"}
          active={isCroissance}
        />
        <BenefitItem
          icon={LifeBuoy}
          label={isCroissance ? "Support prioritaire" : "Support standard"}
          active={isCroissance}
        />
      </div>
    </div>
  );
}

function BenefitItem({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl border border-border/40">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          active ? "bg-accent/30" : "bg-muted"
        )}
      >
        <Icon className={cn("w-4 h-4", active ? "text-accent-foreground" : "text-muted-foreground")} />
      </div>
      <span className={cn("text-sm", active ? "font-medium text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      {active && <Check className="w-3.5 h-3.5 text-accent ml-auto" />}
    </div>
  );
}

// === Sparkline (mini chart) ===
function Sparkline({
  data,
  color,
}: {
  data: { time: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: 100 - (d.value / max) * 100,
  }));
  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  return (
    <div className="h-16 w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={areaD}
          fill="url(#sparkline-gradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8 }}
        />
      </svg>
    </div>
  );
}

// === Helpers ===

function operatorLabel(
  operator: "mtn" | "orange" | null | undefined,
  t: (k: string, p?: Record<string, string | number>) => string
): string {
  if (operator === "mtn") return t("home.operator.mtn");
  if (operator === "orange") return t("home.operator.orange");
  return t("home.operator.default");
}

function showTransactionToast(
  tx: Transaction,
  t: (k: string, p?: Record<string, string | number>) => string
) {
  const amount = Math.abs(tx.amount);
  const date = new Date(tx.createdAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const balance = formatXAF(tx.balanceAfter);

  let key: string;
  let operator = "";
  if (tx.type === "deposit") {
    key = "home.tx.toastDeposit";
    operator = operatorLabel(tx.operator, t);
  } else if (tx.type === "withdraw") {
    key = "home.tx.toastWithdraw";
    operator = operatorLabel(tx.operator, t);
  } else if (tx.type === "subscription") {
    key = "home.tx.toastSubscription";
  } else {
    key = "home.tx.toastGain";
  }

  const message = t(key, {
    amount: formatXAF(amount),
    date,
    balance,
    operator,
  });

  toast(message, {
    duration: 4500,
  });
}

function computeWeeklyGains(transactions: Transaction[]): number {
  return transactions
    .filter((tx) => tx.type === "gain" && isThisWeek(tx.createdAt))
    .reduce((s, tx) => s + tx.amount, 0);
}

function computeMonthlyGains(transactions: Transaction[]): number {
  return transactions
    .filter((tx) => tx.type === "gain" && isThisMonth(tx.createdAt))
    .reduce((s, tx) => s + tx.amount, 0);
}

function computeAvgDailyGains(transactions: Transaction[], totalGains: number): number {
  // If we have gain transactions, compute average per active day
  const gainDays = new Set<string>();
  transactions
    .filter((tx) => tx.type === "gain")
    .forEach((tx) => {
      const d = new Date(tx.createdAt);
      gainDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
  if (gainDays.size === 0) return 0;
  return Math.round(totalGains / gainDays.size);
}

function computeBestDay(
  transactions: Transaction[],
  t: (k: string, p?: Record<string, string | number>) => string
): string {
  const gainByDay = new Map<string, { date: Date; amount: number }>();
  transactions
    .filter((tx) => tx.type === "gain")
    .forEach((tx) => {
      const d = new Date(tx.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const existing = gainByDay.get(key);
      if (existing) {
        existing.amount += tx.amount;
      } else {
        gainByDay.set(key, { date: d, amount: tx.amount });
      }
    });
  let best: { date: Date; amount: number } | null = null;
  for (const v of gainByDay.values()) {
    if (!best || v.amount > best.amount) best = v;
  }
  if (!best || best.amount === 0) return "—";
  return `+${formatXAF(best.amount)} (${best.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })})`;
}

function simulateBuyPrice(gain: number): number {
  // Simulated plausible buy price
  return 1000 + Math.round(gain * 8);
}

function simulateSellPrice(gain: number): number {
  return simulateBuyPrice(gain) + Math.max(gain, 10);
}

function getChartData(range: ChartRange, data: DashboardData): { time: string; value: number }[] {
  if (range === "24h") return data.gainsHistory;

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const gainByDay = new Map<string, number>();
  data.recentTransactions
    .filter((tx) => tx.type === "gain")
    .forEach((tx) => {
      const d = new Date(tx.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      gainByDay.set(key, (gainByDay.get(key) || 0) + tx.amount);
    });

  // Spread total gains across the period if no daily data (heuristic)
  const totalGains = data.user.totalGains;
  const dailyAvg = totalGains / Math.max(days, 1);
  const hasDailyData = gainByDay.size > 0;

  const result: { time: string; value: number }[] = [];
  let cumulative = 0;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dayGain = gainByDay.get(key) ?? (hasDailyData ? 0 : Math.round(dailyAvg));
    cumulative += dayGain;
    result.push({
      time: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      value: cumulative,
    });
  }
  return result;
}
