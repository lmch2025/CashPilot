"use client";

import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp,
  Clock,
  Check,
  X,
  ChevronDown,
  Bell,
  Loader2,
  Zap,
  Award,
  Activity,
  AlertCircle,
  Crown,
  BadgeCheck,
  ExternalLink,
  ShieldCheck,
  Timer,
  Search,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCashPilotStore } from "@/lib/store";
import { useOpportunities } from "@/hooks/use-opportunities";
import { formatXAF, isToday, formatTime } from "@/lib/utils";
import { getPlanById } from "@/lib/plans";
import { ModeSwitcher } from "@/components/cashpilot/mode-switcher";
import { ModeSwitchDialog } from "@/components/cashpilot/mode-switch-dialog";
import { useT } from "@/lib/i18n/context";
import type {
  Opportunity,
  OpportunityStatus,
  SubscriptionPlan,
  DashboardData,
  UserMode,
} from "@/lib/types";
import { toast } from "sonner";

const MARKET_EMOJIS: Record<string, string> = {
  "Binance P2P": "🟡",
  "Yellow Card": "🟣",
  "Paxful": "🔵",
  "Bitget": "🟢",
  "KuCoin P2P": "🟠",
  "OKX P2P": "⚫",
  "Remitano": "🔴",
  "Bybit P2P": "🟤",
};

function getMarketEmoji(market: string): string {
  return MARKET_EMOJIS[market] ?? "🔘";
}

interface SubscriptionInfo {
  isActive: boolean;
  daysRemaining: number;
  plan: SubscriptionPlan | null;
}

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY = 500;

/**
 * Onglet "Opportunités" — remplace l'onglet Accueil en mode alerts.
 * Affiche le flux temps réel des opportunités d'achat-vente.
 */
export function OpportunitiesTab() {
  const t = useT();
  const userId = useCashPilotStore((s) => s.userId);
  const {
    opportunities,
    stats,
    loading,
    actOnOpportunity,
  } = useOpportunities();

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [userData, setUserData] = useState<DashboardData["user"] | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);

  // Stats sheet state
  const [statsSheet, setStatsSheet] = useState<null | "today" | "all" | "executed">(null);

  // New-opportunity detection: keep a Set of seen ids in a ref.
  // When opportunities grows with unseen ids, mark them as new for 3s.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (opportunities.length === 0) {
      // Still record nothing
      return;
    }
    if (firstLoadRef.current) {
      // On first load, just record all current ids without flagging any as new.
      opportunities.forEach((o) => seenIdsRef.current.add(o.id));
      firstLoadRef.current = false;
      return;
    }
    // Find ids we haven't seen before
    const freshlyNew = opportunities.filter(
      (o) => !seenIdsRef.current.has(o.id)
    );
    if (freshlyNew.length === 0) return;
    freshlyNew.forEach((o) => seenIdsRef.current.add(o.id));
    const newSet = new Set(freshlyNew.map((o) => o.id));
    setNewIds((prev) => {
      const merged = new Set(prev);
      newSet.forEach((id) => merged.add(id));
      return merged;
    });
    // Auto-clear each new id after 3s
    freshlyNew.forEach((o) => {
      const id = o.id;
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 3000);
    });
  }, [opportunities]);

  // Récupère l'info d'abonnement (1 fois au mount) depuis /api/dashboard
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/dashboard?userId=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (cancelled || !json.ok) return;
        if (json.user) {
          setUserData(json.user as DashboardData["user"]);
        }
        if (json.subscription) {
          setSubscription({
            isActive: Boolean(json.subscription.isActive),
            daysRemaining: Number(json.subscription.daysRemaining ?? 0),
            plan: json.subscription.plan ?? null,
          });
        } else if (json.user) {
          // Repli: déduire l'abonnement depuis l'utilisateur
          const u = json.user;
          const plan = getPlanById(u.subscriptionPlan);
          const expiresAt = u.subscriptionExpiresAt
            ? new Date(u.subscriptionExpiresAt).getTime()
            : 0;
          const daysRemaining = Math.max(
            0,
            Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
          );
          setSubscription({
            isActive: plan !== null && expiresAt > Date.now(),
            daysRemaining,
            plan,
          });
        }
      } catch {
        // silencieux
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleAction = useCallback(
    async (
      opportunityId: string,
      action: "executed" | "skipped",
      market: string
    ) => {
      // Toast immédiat pour feedback
      if (action === "executed") {
        toast.success(t("opportunities.toast.executed"), {
          description: t("opportunities.toast.executedDesc", { market }),
          duration: 2500,
        });
      } else {
        toast(t("opportunities.toast.skipped"), {
          description: t("opportunities.toast.skippedDesc"),
          duration: 2000,
        });
      }
      await actOnOpportunity(opportunityId, action);
    },
    [actOnOpportunity, t]
  );

  // Tri: actives en premier (par date de création décroissante), puis les autres
  const sortedOpportunities = [...opportunities].sort((a, b) => {
    const rank: Record<OpportunityStatus, number> = {
      active: 0,
      expired: 1,
      skipped: 2,
      executed: 3,
    };
    if (rank[a.status] !== rank[b.status]) {
      return rank[a.status] - rank[b.status];
    }
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  const activeCount = opportunities.filter((o) => o.status === "active").length;

  return (
    <div className="space-y-4">
      {/* Mode switcher (en haut, toujours visible) */}
      {userData && subscription && (
        <ModeSwitcher
          data={{
            user: userData,
            subscription: {
              isActive: subscription.isActive,
              daysRemaining: subscription.daysRemaining,
              plan: subscription.plan,
            },
          } as DashboardData}
          onSwitch={() => setSwitchOpen(true)}
        />
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="pt-1"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-soft">
            <Bell className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-xl leading-tight text-foreground">
              {t("opportunities.title")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("opportunities.subtitle")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Live market sentiment banner */}
      <MarketSentimentBanner activeCount={activeCount} loading={loading} />

      {/* Stats row (tappable) */}
      <StatsRow
        stats={stats}
        loading={loading}
        onItemTap={(key) => setStatsSheet(key)}
      />

      {/* Subscription banner */}
      <SubscriptionBanner subscription={subscription} />

      {/* Opportunities feed */}
      {loading && opportunities.length === 0 ? (
        <FeedSkeleton />
      ) : sortedOpportunities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {sortedOpportunities.map((opp, i) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                index={i}
                isNew={newIds.has(opp.id)}
                onAction={(action) =>
                  handleAction(opp.id, action, opp.market)
                }
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info helper */}
      <HowItWorks />

      {/* Dialog de changement de mode */}
      {userData && subscription && (
        <ModeSwitchDialog
          open={switchOpen}
          onOpenChange={setSwitchOpen}
          targetMode={"managed" as UserMode}
          data={{
            user: userData,
            subscription: {
              isActive: subscription.isActive,
              daysRemaining: subscription.daysRemaining,
              plan: subscription.plan,
            },
          } as DashboardData}
        />
      )}

      {/* Stats sheet */}
      <StatsSheet
        open={statsSheet !== null}
        kind={statsSheet}
        opportunities={sortedOpportunities}
        stats={stats}
        onClose={() => setStatsSheet(null)}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Market sentiment banner                                                  */
/* ----------------------------------------------------------------------- */

function MarketSentimentBanner({
  activeCount,
  loading,
}: {
  activeCount: number;
  loading: boolean;
}) {
  const t = useT();

  if (loading && activeCount === 0) {
    return (
      <div className="h-10 rounded-xl bg-card border border-border/60 shimmer" />
    );
  }

  const isFavorable = activeCount >= 3;
  const isModerate = activeCount >= 1 && activeCount < 3;
  const isCalm = activeCount === 0;

  const dotClass = isFavorable
    ? "bg-[oklch(0.55_0.13_150)]"
    : isModerate
    ? "bg-[oklch(0.7_0.15_85)]"
    : "bg-destructive";

  const textClass = isFavorable
    ? "text-[oklch(0.45_0.1_155)]"
    : isModerate
    ? "text-[oklch(0.5_0.11_85)]"
    : "text-destructive";

  const bgClass = isFavorable
    ? "bg-[oklch(0.45_0.1_155)]/10 border-[oklch(0.45_0.1_155)]/30"
    : isModerate
    ? "bg-[oklch(0.7_0.15_85)]/10 border-[oklch(0.7_0.15_85)]/30"
    : "bg-destructive/10 border-destructive/30";

  const label = isFavorable
    ? t("opportunities.sentiment.favorable", {
        count: activeCount,
        plural: activeCount > 1 ? "s" : "",
      })
    : isModerate
    ? t("opportunities.sentiment.moderate", {
        count: activeCount,
        plural: activeCount > 1 ? "s" : "",
      })
    : t("opportunities.sentiment.calm");

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${bgClass}`}
    >
      <span className="relative inline-flex w-2.5 h-2.5">
        <motion.span
          className={`absolute inset-0 rounded-full ${dotClass}`}
          animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${dotClass}`} />
      </span>
      <span className={`text-xs font-semibold ${textClass}`}>{label}</span>
    </motion.div>
  );
}

/* ----------------------------------------------------------------------- */
/* Stats row                                                               */
/* ----------------------------------------------------------------------- */

function StatsRow({
  stats,
  loading,
  onItemTap,
}: {
  stats: { todayCount: number; totalReceived: number; totalExecuted: number } | null;
  loading: boolean;
  onItemTap: (key: "today" | "all" | "executed") => void;
}) {
  const t = useT();
  const items: Array<{
    key: "today" | "all" | "executed";
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
    bg: string;
  }> = [
    {
      key: "today",
      icon: Zap,
      label: t("opportunities.stats.today"),
      value: stats?.todayCount ?? 0,
      color: "oklch(0.45 0.1 155)",
      bg: "oklch(0.95 0.02 155)",
    },
    {
      key: "all",
      icon: Bell,
      label: t("opportunities.stats.received"),
      value: stats?.totalReceived ?? 0,
      color: "oklch(0.55 0.13 85)",
      bg: "oklch(0.95 0.03 90)",
    },
    {
      key: "executed",
      icon: Check,
      label: t("opportunities.stats.executed"),
      value: stats?.totalExecuted ?? 0,
      color: "oklch(0.55 0.13 150)",
      bg: "oklch(0.95 0.03 150)",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item, i) => (
        <motion.button
          key={item.key}
          type="button"
          onClick={() => onItemTap(item.key)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + i * 0.05 }}
          className="text-left rounded-2xl bg-card border border-border/60 p-3 shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5"
            style={{ background: item.bg }}
          >
            <item.icon
              className="w-4 h-4"
              style={{ color: item.color }}
            />
          </div>
          <div className="font-display font-bold text-lg leading-none">
            {loading && stats === null ? (
              <span className="inline-block w-6 h-4 rounded shimmer align-middle" />
            ) : (
              item.value
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {item.label}
          </div>
        </motion.button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Stats sheet                                                             */
/* ----------------------------------------------------------------------- */

function StatsSheet({
  open,
  kind,
  opportunities,
  stats,
  onClose,
}: {
  open: boolean;
  kind: "today" | "all" | "executed" | null;
  opportunities: Opportunity[];
  stats: { todayCount: number; totalReceived: number; totalExecuted: number } | null;
  onClose: () => void;
}) {
  const t = useT();
  if (!kind) return null;

  const titleKey =
    kind === "today"
      ? "opportunities.stats.todaySheet"
      : kind === "all"
      ? "opportunities.stats.allTimeSheet"
      : "opportunities.stats.executedSheet";

  const todayOpportunities = opportunities.filter((o) =>
    isToday(o.createdAt)
  );
  const executedOpportunities = opportunities.filter(
    (o) => o.status === "executed"
  );
  const activeCount = opportunities.filter((o) => o.status === "active").length;
  const skippedCount = opportunities.filter((o) => o.status === "skipped").length;
  const expiredCount = opportunities.filter((o) => o.status === "expired").length;
  const executedCount = opportunities.filter((o) => o.status === "executed").length;
  const totalDecided = executedCount + skippedCount;
  const successRate =
    totalDecided > 0 ? Math.round((executedCount / totalDecided) * 100) : 0;

  const list =
    kind === "today"
      ? todayOpportunities
      : kind === "executed"
      ? executedOpportunities
      : opportunities;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] flex flex-col gap-0 rounded-t-2xl p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/60">
          <SheetTitle className="font-display font-bold text-base">
            {t(titleKey)}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Stats summary block */}
          {kind === "all" && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <MiniStat
                label={t("opportunities.stats.total")}
                value={stats?.totalReceived ?? 0}
              />
              <MiniStat
                label={t("opportunities.stats.active")}
                value={activeCount}
                accent="primary"
              />
              <MiniStat
                label={t("opportunities.stats.executed")}
                value={executedCount}
                accent="green"
              />
              <MiniStat
                label={t("opportunities.stats.skipped")}
                value={skippedCount}
                accent="muted"
              />
            </div>
          )}

          {kind === "executed" && (
            <div className="rounded-2xl bg-brand-gradient p-4 text-primary-foreground mb-3 shadow-soft">
              <div className="text-xs text-primary-foreground/80 font-medium">
                {t("opportunities.stats.successRate")}
              </div>
              <div className="font-display font-extrabold text-3xl mt-1">
                {successRate}%
              </div>
              <div className="text-xs text-primary-foreground/80 mt-1">
                {executedCount}/{totalDecided} {t("opportunities.stats.executed").toLowerCase()}
              </div>
            </div>
          )}

          {/* List */}
          {list.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("opportunities.stats.empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-center gap-3 rounded-xl bg-card border border-border/60 p-3"
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {getMarketEmoji(opp.market)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold text-sm truncate">
                      {opp.market}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {opp.pair} · {formatTime(opp.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-sm text-[oklch(0.45_0.1_155)]">
                      +{formatXAF(opp.estimatedGain)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">XAF</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 p-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={onClose}
          >
            {t("opportunities.stats.close")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number;
  accent?: "default" | "primary" | "green" | "muted";
}) {
  const valueClass =
    accent === "primary"
      ? "text-primary"
      : accent === "green"
      ? "text-[oklch(0.45_0.1_155)]"
      : accent === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="rounded-xl bg-card border border-border/60 p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
        {label}
      </div>
      <div className={`font-display font-bold text-xl mt-0.5 ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Subscription banner                                                     */
/* ----------------------------------------------------------------------- */

function SubscriptionBanner({ subscription }: { subscription: SubscriptionInfo | null }) {
  const t = useT();
  // Pas encore chargé: on n'affiche rien (évite le flash)
  if (subscription === null) return null;

  if (!subscription.isActive) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-sm text-foreground">
              {t("opportunities.subscription.expired")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("opportunities.subscription.expiredDesc")}
            </p>
            <RenewButton />
          </div>
        </div>
      </motion.div>
    );
  }

  const planName = subscription.plan?.name ?? "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl bg-gold-gradient p-4 text-accent-foreground shadow-gold overflow-hidden"
    >
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.15, 1], x: [0, 10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-[oklch(0.45_0.09_155)]"
        />
      </div>
      <div className="relative flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-foreground/15 flex items-center justify-center shrink-0">
          <Crown className="w-5 h-5 text-accent-foreground" />
        </div>
        <div className="flex-1">
          <div className="font-display font-bold text-sm">
            {t("opportunities.subscription.active", { plan: planName })}
          </div>
          <div className="text-xs text-accent-foreground/80">
            {subscription.daysRemaining > 0
              ? t("opportunities.subscription.expires", {
                  days: subscription.daysRemaining,
                  plural: subscription.daysRemaining > 1 ? "s" : "",
                })
              : t("opportunities.subscription.expiresToday")}
          </div>
        </div>
        <BadgeCheck className="w-4 h-4 text-accent-foreground/70" />
      </div>
    </motion.div>
  );
}

function RenewButton() {
  const t = useT();
  const setSubscriptionOpen = useCashPilotStore((s) => s.setSubscriptionOpen);
  return (
    <Button
      size="sm"
      variant="default"
      className="mt-2 h-8 text-xs font-semibold rounded-lg"
      onClick={() => setSubscriptionOpen(true)}
    >
      {t("opportunities.subscription.renew")}
    </Button>
  );
}

/* ----------------------------------------------------------------------- */
/* Opportunity card                                                        */
/* ----------------------------------------------------------------------- */

interface OpportunityCardProps {
  opportunity: Opportunity;
  index: number;
  isNew: boolean;
  onAction: (action: "executed" | "skipped") => void;
}

function OpportunityCard({ opportunity, index, isNew, onAction }: OpportunityCardProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(isNew);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const x = useMotionValue(0);

  const remaining = useCountdown(opportunity.validUntil);
  const expired = remaining <= 0;
  const isUrgent = !expired && remaining < 60;
  const isVeryUrgent = !expired && remaining < 30;
  const isPast = opportunity.status !== "active" || expired;
  const isInteractive = opportunity.status === "active" && !expired;

  // Total duration for the progress ring
  const totalDuration = Math.max(
    1,
    Math.floor(
      (new Date(opportunity.validUntil).getTime() -
        new Date(opportunity.createdAt).getTime()) /
        1000
    )
  );

  // Overlay opacities based on drag x
  const rightOverlayOpacity = useTransform(x, [10, 80], [0, 1]);
  const leftOverlayOpacity = useTransform(x, [-80, -10], [1, 0]);

  // Show swipe hint on first load only (if interactive)
  useEffect(() => {
    if (!isInteractive) return;
    // Show hint briefly on the very first card the user sees (using localStorage flag)
    try {
      const seen = localStorage.getItem("cp_swipe_hint_seen");
      if (!seen && index === 0) {
        setShowSwipeHint(true);
        const tm = setTimeout(() => {
          setShowSwipeHint(false);
          localStorage.setItem("cp_swipe_hint_seen", "1");
        }, 3500);
        return () => clearTimeout(tm);
      }
    } catch {
      // ignore
    }
  }, [isInteractive, index]);

  // Scroll the new card into view smoothly
  useEffect(() => {
    if (isNew && cardRef.current) {
      try {
        cardRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch {
        // ignore
      }
    }
  }, [isNew]);

  // Hide new badge after 3s
  useEffect(() => {
    if (!isNew) {
      setShowNewBadge(false);
      return;
    }
    setShowNewBadge(true);
    const tm = setTimeout(() => setShowNewBadge(false), 3000);
    return () => clearTimeout(tm);
  }, [isNew]);

  const handleAct = async (action: "executed" | "skipped") => {
    if (acting) return;
    setActing(true);
    try {
      onAction(action);
      // petit délai pour laisser l'animation jouer
      await new Promise((r) => setTimeout(r, 250));
    } finally {
      setActing(false);
    }
  };

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    dragOffsetRef.current = info.offset.x;
    if (
      info.offset.x > SWIPE_THRESHOLD ||
      info.velocity.x > SWIPE_VELOCITY
    ) {
      // Swipe right → execute: snap back then trigger
      x.set(0);
      handleAct("executed");
    } else if (
      info.offset.x < -SWIPE_THRESHOLD ||
      info.velocity.x < -SWIPE_VELOCITY
    ) {
      // Swipe left → skip: snap back then trigger
      x.set(0);
      handleAct("skipped");
    } else {
      // Snap back to center
      x.set(0);
    }
    // Reset drag offset ref after click handler has had a chance to read it
    setTimeout(() => {
      dragOffsetRef.current = 0;
    }, 120);
  };

  const handleClick = () => {
    if (Math.abs(dragOffsetRef.current) > 8) return;
    if (acting) return;
    setExpanded((e) => !e);
  };

  // Vibration keyframes for new card (inline animation)
  const shakeAnimate = isNew
    ? { x: [0, -2, 2, -2, 2, 0] }
    : { x: 0 };
  const shakeTransition = isNew
    ? { duration: 0.4, ease: "easeInOut" as const }
    : { duration: 0 };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.04, 0.3),
        type: "spring",
        bounce: 0.15,
      }}
      className="relative"
      ref={cardRef}
    >
      {/* New badge */}
      <AnimatePresence>
        {showNewBadge && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute -top-2 left-4 z-20 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground shadow-soft"
          >
            <Zap className="w-3 h-3" />
            {t("opportunities.newBadge")}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe hint */}
      <AnimatePresence>
        {showSwipeHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -bottom-6 left-0 right-0 z-10 text-center text-[10px] text-muted-foreground"
          >
            {t("opportunities.swipe.hint")}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe overlays (background) */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0 flex items-center justify-start px-5 bg-[oklch(0.45_0.1_155)]"
          style={{ opacity: rightOverlayOpacity }}
        >
          <div className="flex items-center gap-2 text-primary-foreground font-bold">
            <Check className="w-5 h-5" />
            {t("opportunities.swipe.execute")}
          </div>
        </motion.div>
        <motion.div
          className="absolute inset-0 flex items-center justify-end px-5 bg-muted"
          style={{ opacity: leftOverlayOpacity }}
        >
          <div className="flex items-center gap-2 text-muted-foreground font-bold">
            {t("opportunities.swipe.skip")}
            <X className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* Draggable card */}
      <motion.div
        drag={isInteractive ? "x" : false}
        dragConstraints={{ left: -160, right: 160 }}
        dragElastic={0.5}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        style={{ x }}
        animate={shakeAnimate}
        transition={shakeTransition}
        className={`relative rounded-2xl bg-card border shadow-soft overflow-hidden transition-[border-color] ${
          isNew
            ? "border-accent/80 ring-2 ring-accent/30"
            : "border-border/60"
        } ${isPast ? "opacity-70" : ""} ${
          expanded ? "ring-1 ring-primary/30" : ""
        }`}
      >
        {/* New-card gold flash */}
        {isNew && (
          <motion.div
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 z-10 pointer-events-none bg-accent"
          />
        )}

        {/* Top row */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg leading-none" aria-hidden>
              {getMarketEmoji(opportunity.market)}
            </span>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-foreground truncate">
                {opportunity.market}
              </div>
              <div className="text-[11px] text-muted-foreground leading-none">
                {opportunity.pair}
              </div>
            </div>
          </div>

          <CountdownPill
            remaining={remaining}
            expired={expired}
            urgent={isUrgent}
            veryUrgent={isVeryUrgent}
            totalDuration={totalDuration}
          />
        </div>

        {/* Status badge for past opportunities */}
        <AnimatePresence>
          {opportunity.status !== "active" && (
            <motion.div
              key={`status-${opportunity.status}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4"
            >
              <StatusBadge status={opportunity.status} />
            </motion.div>
          )}
          {opportunity.status === "active" && expired && (
            <motion.div
              key="status-expired-clock"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4"
            >
              <StatusBadge status="expired" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prices row */}
        <div className="grid grid-cols-2 gap-2 px-4 py-3">
          <PriceCell
            label={t("opportunities.buy")}
            value={opportunity.buyPrice}
            tone="muted"
          />
          <PriceCell
            label={t("opportunities.sell")}
            value={opportunity.sellPrice}
            tone="gold"
          />
        </div>

        {/* Gain highlight */}
        <div className="px-4 pb-3">
          <motion.div
            initial={{ opacity: 0.9 }}
            animate={isPast ? { opacity: 0.7 } : { opacity: 1 }}
            className="rounded-xl bg-brand-gradient p-3 text-primary-foreground shadow-soft"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary-foreground/80">
                <TrendingUp className="w-3.5 h-3.5" />
                {t("opportunities.estimatedGain")}
              </div>
              <div className="text-[11px] text-primary-foreground/80">
                {t("opportunities.forCapital", { amount: formatXAF(50000) })}
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display font-extrabold text-2xl leading-none">
                +{formatXAF(opportunity.estimatedGain)}
              </span>
              <span className="text-sm font-semibold text-primary-foreground/80">
                XAF
              </span>
              <span className="ml-auto inline-flex items-center rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs font-bold">
                +{opportunity.estimatedGainPercent.toFixed(1)}%
              </span>
            </div>
          </motion.div>
        </div>

        {/* Expanded detail */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-border/40"
            >
              <ExpandedDetails opportunity={opportunity} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons (only if active & not expired) */}
        <AnimatePresence>
          {opportunity.status === "active" && !expired && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="px-4 pb-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="h-10 rounded-xl bg-brand-gradient text-primary-foreground font-semibold shadow-soft hover:opacity-95"
                  disabled={acting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAct("executed");
                  }}
                >
                  {acting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {t("opportunities.execute")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 rounded-xl font-semibold"
                  disabled={acting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAct("skipped");
                  }}
                >
                  <X className="w-4 h-4" />
                  {t("opportunities.skip")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expandable guide */}
        <div className="border-t border-border/40">
          <ExpandableGuide opportunity={opportunity} />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------------- */
/* Expanded details                                                        */
/* ----------------------------------------------------------------------- */

function ExpandedDetails({ opportunity }: { opportunity: Opportunity }) {
  const t = useT();

  // Simulated market analysis: derive a plausible range from buy/sell prices.
  const low = Math.round(opportunity.buyPrice * 0.98);
  const high = Math.round(opportunity.sellPrice * 1.02);

  // Risk level based on spread (estimatedGainPercent)
  const riskPercent = opportunity.estimatedGainPercent;
  const riskLevel: "high" | "medium" | "low" =
    riskPercent >= 8 ? "high" : riskPercent >= 4 ? "medium" : "low";

  const riskConfig = {
    low: {
      label: t("opportunities.detail.riskLow"),
      color: "oklch(0.55 0.13 150)",
      bg: "oklch(0.95 0.03 150)",
      dots: 1,
    },
    medium: {
      label: t("opportunities.detail.riskMedium"),
      color: "oklch(0.65 0.15 85)",
      bg: "oklch(0.95 0.03 90)",
      dots: 2,
    },
    high: {
      label: t("opportunities.detail.riskHigh"),
      color: "oklch(0.55 0.18 25)",
      bg: "oklch(0.95 0.04 25)",
      dots: 3,
    },
  }[riskLevel];

  // Estimated execution time (between 2 and 6 min)
  const execMinutes = 2 + Math.floor((opportunity.estimatedGain % 5));

  const handleOpenMarket = () => {
    toast.info(
      t("opportunities.detail.redirecting", { market: opportunity.market }),
      { duration: 2200 }
    );
  };

  return (
    <div className="px-4 py-3 space-y-3 bg-muted/30">
      {/* Market analysis */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
          <Search className="w-3 h-3" />
          {t("opportunities.detail.marketAnalysis")}
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-3">
          <div className="text-xs text-muted-foreground">
            {t("opportunities.detail.marketPrice")}
          </div>
          <div className="font-display font-bold text-base text-foreground mt-0.5">
            {formatXAF(low)} – {formatXAF(high)} XAF
          </div>
        </div>
      </div>

      {/* Risk + Execution time */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-xl border p-3"
          style={{ background: riskConfig.bg, borderColor: "transparent" }}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            {t("opportunities.detail.risk")}
          </div>
          <div
            className="font-display font-bold text-base mt-0.5 flex items-center gap-1.5"
            style={{ color: riskConfig.color }}
          >
            {riskConfig.label}
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: i < riskConfig.dots ? riskConfig.color : "currentColor",
                    opacity: i < riskConfig.dots ? 1 : 0.2,
                  }}
                />
              ))}
            </span>
          </div>
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {t("opportunities.detail.executionTime")}
          </div>
          <div className="font-display font-bold text-base mt-0.5 text-foreground">
            {t("opportunities.detail.minutes", { count: execMinutes })}
          </div>
        </div>
      </div>

      {/* Open market button (simulated) */}
      <Button
        variant="outline"
        className="w-full h-10 rounded-xl font-semibold border-accent/40 text-accent-foreground hover:bg-accent/15"
        onClick={handleOpenMarket}
      >
        <ExternalLink className="w-4 h-4" />
        {t("opportunities.detail.openMarket", { market: opportunity.market })}
      </Button>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Expandable guide (wrapped for tap independence)                          */
/* ----------------------------------------------------------------------- */

function ExpandableGuide({ opportunity }: { opportunity: Opportunity }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            {t("opportunities.guide")}
          </span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="px-4 pb-4 pt-1"
        >
          <ol className="space-y-2">
            <GuideStep
              n={1}
              text={t("opportunities.guide.step1", { market: opportunity.market })}
            />
            <GuideStep
              n={2}
              text={t("opportunities.guide.step2", { price: formatXAF(opportunity.buyPrice) })}
            />
            <GuideStep
              n={3}
              text={t("opportunities.guide.step3", { price: formatXAF(opportunity.sellPrice) })}
            />
            <GuideStep
              n={4}
              text={t("opportunities.guide.step4", { amount: formatXAF(opportunity.estimatedGain) })}
              highlight
            />
          </ol>
          {/* Tap-to-expand hint */}
          <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <ChevronRight className="w-3 h-3" />
            {t("opportunities.detail.title")}
          </div>
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ----------------------------------------------------------------------- */
/* Countdown                                                               */
/* ----------------------------------------------------------------------- */

function calcRemaining(validUntil: string): number {
  const end = new Date(validUntil).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

function useCountdown(validUntil: string): number {
  // On stocke juste un "tick" pour forcer le re-render chaque seconde.
  // La valeur restante est calculée à chaque rendertick depuis validUntil.
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => (t + 1) % 1_000_000);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return calcRemaining(validUntil);
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function CountdownPill({
  remaining,
  expired,
  urgent,
  veryUrgent,
  totalDuration,
}: {
  remaining: number;
  expired: boolean;
  urgent: boolean;
  veryUrgent: boolean;
  totalDuration: number;
}) {
  const t = useT();
  const progress = expired
    ? 0
    : Math.max(0, Math.min(1, remaining / totalDuration));
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 text-xs font-bold tabular-nums transition-colors ${
        expired
          ? "bg-muted text-muted-foreground"
          : urgent
          ? "bg-destructive/15 text-destructive"
          : "bg-primary/10 text-primary"
      }`}
    >
      {/* Circular progress ring */}
      <div className="relative w-6 h-6 flex items-center justify-center">
        <svg
          className="w-6 h-6 -rotate-90"
          viewBox="0 0 28 28"
          aria-hidden
        >
          <circle
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-25"
          />
          <motion.circle
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </svg>
        {!expired && !urgent && (
          <Clock className="absolute w-2.5 h-2.5" />
        )}
        {urgent && !expired && (
          <motion.div
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Clock className="w-2.5 h-2.5" />
          </motion.div>
        )}
        {expired && <Clock className="absolute w-2.5 h-2.5 opacity-60" />}
      </div>

      <motion.span
        animate={
          urgent && !expired
            ? { scale: [1, 1.12, 1] }
            : { scale: 1 }
        }
        transition={{
          duration: 0.6,
          repeat: urgent && !expired ? Infinity : 0,
          ease: "easeInOut",
        }}
        className={expired ? "line-through" : ""}
      >
        {expired
          ? t("common.expired")
          : formatCountdown(remaining)}
      </motion.span>

      <AnimatePresence>
        {veryUrgent && !expired && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-[9px] font-extrabold uppercase tracking-tight"
          >
            {t("opportunities.expireSoon")}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Price cell                                                              */
/* ----------------------------------------------------------------------- */

function PriceCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "gold";
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        tone === "gold"
          ? "bg-accent/40 border-accent/60"
          : "bg-muted/40 border-border/40"
      }`}
    >
      <div className="text-[10px] font-semibold tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-0.5 font-display font-extrabold text-xl leading-none ${
          tone === "gold" ? "text-[oklch(0.45_0.09_100)]" : "text-foreground"
        }`}
      >
        {formatXAF(value)}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">XAF</div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Status badge                                                            */
/* ----------------------------------------------------------------------- */

function StatusBadge({ status }: { status: OpportunityStatus }) {
  const t = useT();
  const config: Record<
    OpportunityStatus,
    { label: string; icon: React.ElementType; className: string }
  > = {
    active: {
      label: t("common.active"),
      icon: Activity,
      className: "bg-primary/10 text-primary",
    },
    executed: {
      label: t("common.executed"),
      icon: Check,
      className: "bg-[oklch(0.45_0.1_155)]/15 text-[oklch(0.45_0.1_155)]",
    },
    skipped: {
      label: t("common.ignored"),
      icon: X,
      className: "bg-muted text-muted-foreground",
    },
    expired: {
      label: t("common.expired"),
      icon: Clock,
      className: "bg-muted text-muted-foreground",
    },
  };
  const { label, icon: Icon, className } = config[status];
  return (
    <div
      className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Guide step                                                              */
/* ----------------------------------------------------------------------- */

function GuideStep({
  n,
  text,
  highlight,
}: {
  n: number;
  text: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <div
        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
          highlight
            ? "bg-brand-gradient text-primary-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        {n}
      </div>
      <div
        className={`text-xs leading-relaxed pt-0.5 ${
          highlight ? "font-semibold text-foreground" : "text-muted-foreground"
        }`}
      >
        {text}
      </div>
    </li>
  );
}

/* ----------------------------------------------------------------------- */
/* Empty state                                                             */
/* ----------------------------------------------------------------------- */

function EmptyState() {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl bg-card border border-dashed border-border/70 p-8 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="inline-flex w-16 h-16 rounded-full bg-brand-gradient items-center justify-center shadow-soft-lg mx-auto"
      >
        <Bell className="w-7 h-7 text-primary-foreground" />
      </motion.div>
      <h3 className="mt-4 font-display font-bold text-base text-foreground">
        {t("opportunities.empty.title")}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto">
        {t("opportunities.empty.desc")}
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-primary"
        />
        {t("opportunities.empty.watching")}
      </div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------------- */
/* Loading skeleton                                                        */
/* ----------------------------------------------------------------------- */

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-card border border-border/60 p-4 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full shimmer" />
              <div className="space-y-1">
                <div className="w-24 h-3 rounded shimmer" />
                <div className="w-12 h-2 rounded shimmer" />
              </div>
            </div>
            <div className="w-12 h-6 rounded-full shimmer" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="h-16 rounded-xl shimmer" />
            <div className="h-16 rounded-xl shimmer" />
          </div>
          <div className="h-12 rounded-xl shimmer mt-3" />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* How it works                                                            */
/* ----------------------------------------------------------------------- */

function HowItWorks() {
  const t = useT();
  return (
    <Collapsible>
      <div className="rounded-2xl bg-card border border-border/60 shadow-soft overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center">
                <Award className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="font-display font-semibold text-sm text-foreground">
                {t("opportunities.how.title")}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground collapsible-icon transition-transform" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0">
            <div className="space-y-3 pt-1 border-t border-border/40 pt-3">
              <Step
                n={1}
                title={t("opportunities.how.step1.title")}
                text={t("opportunities.how.step1.desc")}
              />
              <Step
                n={2}
                title={t("opportunities.how.step2.title")}
                text={t("opportunities.how.step2.desc")}
              />
              <Step
                n={3}
                title={t("opportunities.how.step3.title")}
                text={t("opportunities.how.step3.desc")}
              />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function Step({
  n,
  title,
  text,
}: {
  n: number;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-primary-foreground font-display font-bold text-sm">
        {n}
      </div>
      <div>
        <div className="font-display font-semibold text-sm text-foreground">
          {title}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
}
