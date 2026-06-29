"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Clock,
  User,
  Loader2,
  Bell,
  Zap,
  Plus,
  RefreshCw,
  TrendingUp,
  Award,
  AlertCircle,
} from "lucide-react";
import { useCashPilotStore } from "@/lib/store";
import { useDashboard } from "@/hooks/use-dashboard";
import { HomeTab } from "@/components/screens/home-tab";
import { HistoryTab } from "@/components/screens/history-tab";
import { AccountTab } from "@/components/screens/account-tab";
import { OpportunitiesTab } from "@/components/screens/opportunities-tab";
import { DepositDialog } from "@/components/cashpilot/deposit-dialog";
import { WithdrawDialog } from "@/components/cashpilot/withdraw-dialog";
import { SubscriptionDialog } from "@/components/cashpilot/subscription-dialog";
import { GainToast } from "@/components/cashpilot/gain-toast";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useT } from "@/lib/i18n/context";
import { formatXAF, getSetting, setSetting } from "@/lib/utils";
import { toast } from "sonner";
import type { AppTab } from "@/lib/types";
import { useEffect, useRef, useState, useCallback } from "react";

// ============================================================
// Notification types
// ============================================================
type NotificationType = "gain" | "opportunity" | "expiry" | "achievement";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  desc: string;
  at: number; // ms timestamp
  target?: AppTab; // where to navigate on tap
  icon: "trending" | "zap" | "alert" | "award";
  iconColor: string;
}

const READ_KEY = "cashpilot:read-notifications";

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

export function AppShell() {
  const t = useT();
  const tab = useCashPilotStore((s) => s.tab);
  const setTab = useCashPilotStore((s) => s.setTab);
  const depositOpen = useCashPilotStore((s) => s.depositOpen);
  const setDepositOpen = useCashPilotStore((s) => s.setDepositOpen);
  const withdrawOpen = useCashPilotStore((s) => s.withdrawOpen);
  const setWithdrawOpen = useCashPilotStore((s) => s.setWithdrawOpen);
  const subscriptionOpen = useCashPilotStore((s) => s.subscriptionOpen);
  const setSubscriptionOpen = useCashPilotStore((s) => s.setSubscriptionOpen);

  const { data, loading, error, refresh, lastGain } = useDashboard();

  // Tabs based on mode
  const isAlertsMode = data?.user.mode === "alerts";

  const TABS = isAlertsMode
    ? [
        { id: "opportunities" as AppTab, label: t("app.tab.opportunities"), icon: Zap },
        { id: "history" as AppTab, label: t("app.tab.activity"), icon: Clock },
        { id: "account" as AppTab, label: t("app.tab.account"), icon: User },
      ]
    : [
        { id: "home" as AppTab, label: t("app.tab.home"), icon: Home },
        { id: "history" as AppTab, label: t("app.tab.history"), icon: Clock },
        { id: "account" as AppTab, label: t("app.tab.account"), icon: User },
      ];

  // ===== Notification center state =====
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Track previous balance to detect gains
  const prevBalanceRef = useRef<number | null>(null);
  // Track previous opportunity count to detect new ones
  const prevOppCountRef = useRef<number | null>(null);

  // Generate notifications based on dashboard data changes
  useEffect(() => {
    if (!data) return;

    const newNotifications: AppNotification[] = [];

    // Detect new gain (managed mode)
    if (
      data.user.mode === "managed" &&
      prevBalanceRef.current !== null &&
      data.user.balance > prevBalanceRef.current
    ) {
      const gain = data.user.balance - prevBalanceRef.current;
      newNotifications.push({
        id: `gain-${Date.now()}`,
        type: "gain",
        title: t("app.notifications.gain.title"),
        desc: t("app.notifications.gain.desc", { amount: formatXAF(gain) }),
        at: Date.now(),
        target: "home",
        icon: "trending",
        iconColor: "oklch(0.7_0.18_150)",
      });
    }
    prevBalanceRef.current = data.user.balance;

    // Detect new opportunity (alerts mode)
    const totalReceived = data.opportunitiesStats.totalReceived;
    if (
      data.user.mode === "alerts" &&
      prevOppCountRef.current !== null &&
      totalReceived > prevOppCountRef.current
    ) {
      newNotifications.push({
        id: `opp-${Date.now()}`,
        type: "opportunity",
        title: t("app.notifications.opportunity.title"),
        desc: t("app.notifications.opportunity.desc", { market: "Binance P2P" }),
        at: Date.now(),
        target: "opportunities",
        icon: "zap",
        iconColor: "oklch(0.7_0.15_85)",
      });
    }
    prevOppCountRef.current = totalReceived;

    // Subscription expiry warning (alerts mode, < 7 days)
    if (
      data.user.mode === "alerts" &&
      data.subscription.isActive &&
      data.subscription.daysRemaining <= 7 &&
      data.subscription.daysRemaining > 0
    ) {
      const id = `expiry-${data.subscription.daysRemaining}`;
      newNotifications.push({
        id,
        type: "expiry",
        title: t("app.notifications.expiry.title"),
        desc: t("app.notifications.expiry.desc", { days: data.subscription.daysRemaining }),
        at: Date.now(),
        target: "account",
        icon: "alert",
        iconColor: "destructive",
      });
    }

    // Achievements
    if (data.user.level === "croissance") {
      const id = "ach-croissance";
      newNotifications.push({
        id,
        type: "achievement",
        title: t("app.notifications.achievement.title"),
        desc: t("app.notifications.achievement.desc", {
          badge: t("account.achievements.croissance"),
        }),
        at: Date.now(),
        target: "account",
        icon: "award",
        iconColor: "oklch(0.7_0.15_85)",
      });
    }
    if (data.user.totalGains >= 50000) {
      const id = "ach-bigGains";
      newNotifications.push({
        id,
        type: "achievement",
        title: t("app.notifications.achievement.title"),
        desc: t("app.notifications.achievement.desc", {
          badge: t("account.achievements.bigGains"),
        }),
        at: Date.now(),
        target: "account",
        icon: "award",
        iconColor: "oklch(0.7_0.15_85)",
      });
    }

    if (newNotifications.length > 0) {
      setNotifications((prev) => {
        // Avoid duplicate IDs
        const existingIds = new Set(prev.map((n) => n.id));
        const toAdd = newNotifications.filter((n) => !existingIds.has(n.id));
        return [...toAdd, ...prev].slice(0, 30); // cap at 30
      });
    }
  }, [data, t]);

  // Load read state from localStorage on mount
  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const handleNotificationTap = (n: AppNotification) => {
    // Mark as read
    const newRead = new Set(readIds);
    newRead.add(n.id);
    setReadIds(newRead);
    saveReadIds(newRead);
    setNotificationsOpen(false);
    if (n.target) setTab(n.target);
  };

  const handleMarkAllRead = () => {
    const newRead = new Set(readIds);
    notifications.forEach((n) => newRead.add(n.id));
    setReadIds(newRead);
    saveReadIds(newRead);
    toast.success(t("app.notifications.markedAll"), { duration: 1500 });
  };

  // ===== Pull-to-refresh state =====
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const isPulling = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only allow pull-to-refresh when scrolled to top
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = null;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null || isRefreshing) return;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0 && window.scrollY <= 0) {
        isPulling.current = true;
        // Apply rubber-band: reduce delta by 50% after threshold
        const eased = Math.min(delta * 0.5, 90);
        setPullDistance(eased);
      }
    },
    [isRefreshing]
  );

  const onTouchEnd = useCallback(async () => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;
    if (pullDistance > 50 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(60);
      try {
        await refresh();
        toast.success(t("app.pullToRefresh.updated"), { duration: 1500 });
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    isPulling.current = false;
  }, [pullDistance, isRefreshing, refresh, t]);

  // ===== Balance privacy (live) =====
  const [hideBalance, setHideBalance] = useState(false);
  useEffect(() => {
    setHideBalance(getSetting("balance-privacy"));
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string; value: boolean };
      if (detail.key === "balance-privacy") setHideBalance(detail.value);
    };
    window.addEventListener("cashpilot-setting-change", handler);
    return () => window.removeEventListener("cashpilot-setting-change", handler);
  }, []);

  // ===== FAB action =====
  const handleFabClick = () => {
    if (isAlertsMode) {
      refresh();
      toast.success(t("app.fab.refreshed"), { duration: 1500 });
    } else {
      setDepositOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Smart Header */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/40">
        <div className="mx-auto max-w-md px-4 h-14 flex items-center justify-between">
          <CashPilotLogo size={32} withText />

          <div className="flex items-center gap-2">
            {data && (
              <div className="text-right">
                {isAlertsMode ? (
                  <>
                    <div className="text-[10px] text-muted-foreground">
                      {data.subscription.isActive
                        ? t("app.subscription.active", {
                            plan: data.subscription.plan?.name ?? "",
                          })
                        : t("opportunities.subscription.expired")}
                    </div>
                    <div className="font-display font-bold text-sm leading-none">
                      {data.subscription.isActive
                        ? t("app.subscription.daysLeft", {
                            days: data.subscription.daysRemaining,
                          })
                        : t("app.subscription.toRenew")}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] text-muted-foreground">
                      {t("app.balance")}
                    </div>
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key={`balance-${data.user.balance}`}
                        initial={
                          lastGain
                            ? { color: "oklch(0.7_0.15_85)", scale: 1.08 }
                            : false
                        }
                        animate={{ color: "var(--foreground)", scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="font-display font-bold text-sm leading-none tabular-nums"
                      >
                        {hideBalance
                          ? t("app.balance.hidden")
                          : `${formatXAF(data.user.balance)} XAF`}
                      </motion.div>
                    </AnimatePresence>
                  </>
                )}
              </div>
            )}

            {/* Notification bell */}
            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors"
              aria-label={t("app.notifications.title")}
            >
              <Bell className="w-5 h-5 text-foreground" />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
            style={{ marginTop: pullDistance - 30 }}
          >
            <div className="w-10 h-10 rounded-full bg-card border border-border/60 shadow-soft flex items-center justify-center">
              <motion.div
                animate={
                  isRefreshing
                    ? { rotate: 360 }
                    : { rotate: Math.min(pullDistance * 2, 180) }
                }
                transition={
                  isRefreshing
                    ? { duration: 1, repeat: Infinity, ease: "linear" }
                    : { duration: 0.1 }
                }
              >
                <RefreshCw className="w-4 h-4 text-primary" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content (with pull-to-refresh) */}
      <main
        ref={mainRef}
        className="flex-1 mx-auto w-full max-w-md px-4 pt-4 pb-28"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling.current ? "none" : "transform 0.25s ease-out",
        }}
      >
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "home" && (
                <HomeTab
                  data={data}
                  onDeposit={() => setDepositOpen(true)}
                  onWithdraw={() => setWithdrawOpen(true)}
                  refresh={refresh}
                  lastGain={lastGain}
                />
              )}
              {tab === "opportunities" && <OpportunitiesTab />}
              {tab === "history" && <HistoryTab />}
              {tab === "account" && <AccountTab data={data} />}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-md px-2 h-16 flex items-center justify-around">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`relative flex items-center justify-center w-10 h-7 rounded-full transition-colors ${
                    active ? "bg-primary/10" : ""
                  }`}
                >
                  <t.icon
                    className={`w-5 h-5 transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </motion.div>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {t.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -top-px h-0.5 w-8 rounded-full bg-primary"
                    transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Quick Action FAB */}
      <AnimatePresence>
        {data && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={handleFabClick}
            className="fixed right-4 bottom-24 z-30 w-14 h-14 rounded-full bg-brand-gradient text-primary-foreground shadow-soft-lg flex items-center justify-center"
            aria-label={isAlertsMode ? t("app.fab.refresh") : t("app.fab.deposit")}
          >
            {isAlertsMode ? (
              <RefreshCw className="w-6 h-6" />
            ) : (
              <Plus className="w-6 h-6" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating gain toast (managed mode only) */}
      {!isAlertsMode && <GainToast />}

      {/* Dialogs */}
      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        onSuccess={refresh}
      />
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        balance={data?.user.balance ?? 0}
        onSuccess={refresh}
      />
      <SubscriptionDialog
        open={subscriptionOpen && !!data?.subscription.plan}
        onOpenChange={(open) => {
          setSubscriptionOpen(open);
          if (!open) refresh();
        }}
        plan={data?.subscription.plan ?? null}
        onSuccess={refresh}
      />

      {/* Notification center (Sheet from right) */}
      <NotificationCenter
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        notifications={notifications}
        readIds={readIds}
        onNotificationTap={handleNotificationTap}
        onMarkAllRead={handleMarkAllRead}
      />
    </div>
  );
}

// ============================================================
// Notification Center (Sheet)
// ============================================================
function NotificationCenter({
  open,
  onOpenChange,
  notifications,
  readIds,
  onNotificationTap,
  onMarkAllRead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: AppNotification[];
  readIds: Set<string>;
  onNotificationTap: (n: AppNotification) => void;
  onMarkAllRead: () => void;
}) {
  const t = useT();
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
        <SheetHeader className="px-4 py-4 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <SheetTitle className="font-display font-bold text-base">
              {t("app.notifications.title")}
            </SheetTitle>
            {unreadCount > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              {t("app.notifications.markAllRead")}
            </button>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/30">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("app.notifications.empty")}
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {notifications.map((n) => {
                const isRead = readIds.has(n.id);
                return (
                  <motion.button
                    key={n.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => onNotificationTap(n)}
                    className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      isRead
                        ? "bg-card/60 border-border/40"
                        : "bg-card border-primary/30 shadow-soft"
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `color-mix(in oklch, var(--${n.iconColor}) 15%, transparent)`,
                      }}
                    >
                      <NotificationIcon name={n.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {n.title}
                        </span>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.desc}
                      </p>
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        {formatNotificationTime(n.at, t)}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NotificationIcon({ name }: { name: AppNotification["icon"] }) {
  const cls = "w-4 h-4 text-primary";
  switch (name) {
    case "trending":
      return <TrendingUp className={cls} />;
    case "zap":
      return <Zap className={cls} />;
    case "alert":
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    case "award":
      return <Award className={cls} />;
    default:
      return <Bell className={cls} />;
  }
}

function formatNotificationTime(at: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  const diffMs = Date.now() - at;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("app.notifications.now");
  if (diffMin < 60) return t("app.notifications.minAgo", { min: diffMin });
  return new Date(at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// Loading & error states
// ============================================================
function LoadingState() {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <CashPilotLogo size={56} />
      </motion.div>
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("app.loading")}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">😕</div>
      <h2 className="font-display font-bold text-lg">{t("app.error.title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">{message}</p>
      <Button onClick={onRetry} className="mt-4">
        {t("app.error.retry")}
      </Button>
    </div>
  );
}
