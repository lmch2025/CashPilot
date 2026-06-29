"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Users,
  Crown,
  Wallet,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  Activity,
  Receipt,
  Banknote,
  HandCoins,
  type LucideIcon,
} from "lucide-react";
import { AnimatedNumber } from "@/components/cashpilot/animated-number";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatXAF } from "@/lib/utils";
import type { AdminStats } from "@/lib/types";

type Period = "7d" | "30d" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "all", label: "Tout" },
];

const BRAND_GREEN = "oklch(0.45 0.1 155)";
const BRAND_GREEN_DARK = "oklch(0.38 0.09 155)";
const BRAND_GOLD = "oklch(0.82 0.13 88)";
const BRAND_GOLD_DARK = "oklch(0.7 0.13 80)";
const CHART_TEAL = "oklch(0.55 0.08 170)";

const PLAN_COLORS = [BRAND_GREEN, BRAND_GOLD, CHART_TEAL, BRAND_GREEN_DARK];
const TX_TYPE_COLORS = [BRAND_GREEN, BRAND_GOLD, CHART_TEAL, BRAND_GREEN_DARK];

// ===== Helpers =====

function formatCompactXAF(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)}k`;
  return `${n}`;
}

function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  } catch {
    return iso;
  }
}

function translateTransactionType(type: string): string {
  const map: Record<string, string> = {
    deposit: "Dépôts",
    withdraw: "Retraits",
    gain: "Gains",
    subscription: "Abonnements",
  };
  return map[type] || type;
}

function translatePlan(plan: string): string {
  const map: Record<string, string> = {
    decouverte: "Découverte",
    standard: "Standard",
    premium: "Premium",
  };
  return map[plan] || plan;
}

// ===== Custom Tooltip =====

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
  valueFormatter?: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs shadow-soft-lg">
      {label && <div className="font-medium text-foreground mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-[2px]"
            style={{ background: (p.color as string) || BRAND_GREEN }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-semibold text-foreground tabular-nums">
            {valueFormatter ? valueFormatter(Number(p.value)) : Number(p.value).toLocaleString("fr-FR")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ===== KPI Card =====

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  format: (n: number) => string;
  iconBg: string;
  iconColor: string;
  accentBar: string;
  delay?: number;
  suffix?: string;
}

function KpiCard({ icon: Icon, label, value, format, iconBg, iconColor, accentBar, delay = 0, suffix }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="relative rounded-2xl bg-card border border-border/60 shadow-soft p-5 overflow-hidden hover:shadow-soft-lg transition-shadow"
    >
      <div className="absolute left-0 top-5 bottom-5 w-1 rounded-r-full" style={{ background: accentBar }} />
      <div className="flex items-start justify-between pl-2">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: iconBg }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
      </div>
      <div className="mt-4 pl-2">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
        <div className="mt-1 font-display font-extrabold text-2xl sm:text-3xl text-foreground tabular-nums">
          <AnimatedNumber value={value} format={format} duration={1.1} />
          {suffix && <span className="text-base font-semibold text-muted-foreground ml-1">{suffix}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border/60 p-5">
      <Skeleton className="w-11 h-11 rounded-xl" />
      <Skeleton className="h-3 w-24 mt-4" />
      <Skeleton className="h-8 w-32 mt-2" />
    </div>
  );
}

// ===== Chart Card =====

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

function ChartCard({ title, subtitle, children, delay = 0, className }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={`rounded-2xl bg-card border border-border/60 shadow-soft p-5 ${className || ""}`}
    >
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold text-base text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border/60 p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-24 mt-1" />
      <Skeleton className="h-56 w-full mt-4" />
    </div>
  );
}

// ===== Quick Stat =====

interface QuickStatProps {
  icon: LucideIcon;
  label: string;
  value: number;
  format: (n: number) => string;
  delay?: number;
}

function QuickStat({ icon: Icon, label, value, format, delay = 0 }: QuickStatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className="rounded-xl bg-card border border-border/60 p-4 hover:border-border transition-colors"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 font-display font-bold text-lg text-foreground tabular-nums">
        <AnimatedNumber value={value} format={format} duration={0.9} />
      </div>
    </motion.div>
  );
}

function QuickStatSkeleton() {
  return (
    <div className="rounded-xl bg-card border border-border/60 p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-5 w-28 mt-2" />
    </div>
  );
}

// ===== Main View =====

export function AdminDashboardView() {
  const [period, setPeriod] = useState<Period>("30d");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stats?period=${p}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Erreur inconnue");
      setStats(json.stats as AdminStats);
    } catch {
      setError("Impossible de charger les statistiques. Vérifiez que l'API /api/admin/stats est disponible.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(period);
  }, [period]);

  // Prepare chart data with translations
  const usersGrowthData = useMemo(() => {
    if (!stats?.usersGrowth) return [];
    return stats.usersGrowth.map((p) => ({ ...p, label: formatDateShort(p.date) }));
  }, [stats]);

  const revenueByPlanData = useMemo(() => {
    if (!stats?.revenueByPlan) return [];
    return stats.revenueByPlan.map((p) => ({ ...p, plan: translatePlan(p.plan) }));
  }, [stats]);

  const transactionsByTypeData = useMemo(() => {
    if (!stats?.transactionsByType) return [];
    return stats.transactionsByType.map((p) => ({ ...p, type: translateTransactionType(p.type) }));
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Header row: title + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground">
            Vue d'ensemble
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Indicateurs clés de performance et tendances de la plateforme.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-card border border-border/60 p-1 shadow-soft">
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  active
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="admin-period-active"
                    className="absolute inset-0 rounded-lg bg-brand-gradient"
                    transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                  />
                )}
                <span className="relative z-10">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* KPI skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
            {/* Charts skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
            <ChartSkeleton />
            {/* Quick stats skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => <QuickStatSkeleton key={i} />)}
            </div>
          </motion.div>
        )}

        {error && !loading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <h3 className="mt-4 font-display font-bold text-lg text-foreground">
              Données indisponibles
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{error}</p>
            <Button
              onClick={() => fetchStats(period)}
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réessayer
            </Button>
          </motion.div>
        )}

        {stats && !loading && !error && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={Users}
                label="Utilisateurs totaux"
                value={stats.totalUsers}
                format={(n) => Math.round(n).toString()}
                iconBg="oklch(0.45 0.1 155 / 0.12)"
                iconColor={BRAND_GREEN_DARK}
                accentBar={BRAND_GREEN}
                delay={0}
              />
              <KpiCard
                icon={Crown}
                label="Abonnements actifs"
                value={stats.activeSubscriptions}
                format={(n) => Math.round(n).toString()}
                iconBg="oklch(0.82 0.13 88 / 0.18)"
                iconColor={BRAND_GOLD_DARK}
                accentBar={BRAND_GOLD}
                delay={0.05}
              />
              <KpiCard
                icon={Wallet}
                label="Capital géré"
                value={stats.totalCapital}
                format={(n) => formatXAF(n)}
                iconBg="oklch(0.45 0.1 155 / 0.12)"
                iconColor={BRAND_GREEN_DARK}
                accentBar={BRAND_GREEN}
                delay={0.1}
                suffix="XAF"
              />
              <KpiCard
                icon={TrendingUp}
                label="Revenu mensuel (MRR)"
                value={stats.mrr}
                format={(n) => formatXAF(n)}
                iconBg="oklch(0.82 0.13 88 / 0.18)"
                iconColor={BRAND_GOLD_DARK}
                accentBar={BRAND_GOLD}
                delay={0.15}
                suffix="XAF"
              />
            </div>

            {/* Charts row 1: Users growth (full width on lg) + Revenue by plan */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="Croissance des utilisateurs"
                subtitle={`Nouveaux comptes cumulés · ${PERIODS.find((p) => p.id === period)?.label.toLowerCase()}`}
                delay={0.2}
              >
                <div className="h-64 -ml-2">
                  {usersGrowthData.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={usersGrowthData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="usersGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={BRAND_GREEN} stopOpacity={0.45} />
                            <stop offset="100%" stopColor={BRAND_GREEN} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 130)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "oklch(0.5 0.02 140)" }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={20}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "oklch(0.5 0.02 140)" }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          width={32}
                        />
                        <RechartsTooltip
                          content={<ChartTooltip valueFormatter={(n) => `${Math.round(n)} utilisateurs`} />}
                          cursor={{ stroke: BRAND_GREEN, strokeWidth: 1, strokeDasharray: "3 3" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          name="Utilisateurs"
                          stroke={BRAND_GREEN_DARK}
                          strokeWidth={2.5}
                          fill="url(#usersGrowthGradient)"
                          dot={false}
                          activeDot={{ r: 5, fill: BRAND_GREEN_DARK, stroke: "#fff", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>

              <ChartCard
                title="Revenu par plan"
                subtitle="Revenu abonnements (XAF) par offre"
                delay={0.25}
              >
                <div className="h-64 -ml-2">
                  {revenueByPlanData.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueByPlanData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 130)" vertical={false} />
                        <XAxis
                          dataKey="plan"
                          tick={{ fontSize: 11, fill: "oklch(0.5 0.02 140)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "oklch(0.5 0.02 140)" }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                          tickFormatter={(v) => formatCompactXAF(Number(v))}
                        />
                        <RechartsTooltip
                          content={<ChartTooltip valueFormatter={(n) => `${formatXAF(n)} XAF`} />}
                          cursor={{ fill: "oklch(0.45 0.1 155 / 0.06)" }}
                        />
                        <Bar
                          dataKey="revenue"
                          name="Revenu"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={64}
                        >
                          {revenueByPlanData.map((_, i) => (
                            <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {/* Legend with counts */}
                {revenueByPlanData.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {revenueByPlanData.map((p, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span
                          className="w-2.5 h-2.5 rounded-[3px]"
                          style={{ background: [BRAND_GREEN, BRAND_GOLD, CHART_TEAL][i % 3] }}
                        />
                        <span className="font-medium text-foreground">{p.plan}</span>
                        <span>·</span>
                        <span>{p.count} abonné{p.count > 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            </div>

            {/* Charts row 2: Transactions by type (full width) */}
            <ChartCard
              title="Volumes par type de transaction"
              subtitle="Montants cumulés par catégorie (XAF)"
              delay={0.3}
            >
              <div className="h-72 -ml-2">
                {transactionsByTypeData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transactionsByTypeData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 130)" vertical={false} />
                      <XAxis
                        dataKey="type"
                        tick={{ fontSize: 11, fill: "oklch(0.5 0.02 140)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "oklch(0.5 0.02 140)" }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        tickFormatter={(v) => formatCompactXAF(Number(v))}
                      />
                      <RechartsTooltip
                        content={<ChartTooltip valueFormatter={(n) => `${formatXAF(n)} XAF`} />}
                        cursor={{ fill: "oklch(0.82 0.13 88 / 0.08)" }}
                      />
                      <Bar
                        dataKey="amount"
                        name="Montant"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={88}
                      >
                        {transactionsByTypeData.map((_, i) => (
                          <Cell key={i} fill={TX_TYPE_COLORS[i % TX_TYPE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {transactionsByTypeData.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {transactionsByTypeData.map((t, i) => (
                    <div key={i} className="rounded-lg bg-muted/40 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: [BRAND_GREEN, BRAND_GOLD, CHART_TEAL, BRAND_GREEN_DARK][i % 4] }}
                        />
                        <span className="text-[11px] font-medium text-muted-foreground">{t.type}</span>
                      </div>
                      <div className="mt-1 font-display font-bold text-sm text-foreground tabular-nums">
                        {formatXAF(t.amount)} XAF
                      </div>
                      <div className="text-[10px] text-muted-foreground">{t.count} transactions</div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            {/* Quick stats grid */}
            <div>
              <h3 className="font-display font-bold text-base text-foreground mb-3">
                Statistiques globales
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <QuickStat
                  icon={ArrowUpRight}
                  label="Gains distribués"
                  value={stats.totalGains}
                  format={(n) => formatXAF(n)}
                  delay={0.05}
                />
                <QuickStat
                  icon={Activity}
                  label="Échanges (robot)"
                  value={stats.totalExchanges}
                  format={(n) => Math.round(n).toString()}
                  delay={0.1}
                />
                <QuickStat
                  icon={Banknote}
                  label="Dépôts"
                  value={stats.totalDeposits}
                  format={(n) => formatXAF(n)}
                  delay={0.15}
                />
                <QuickStat
                  icon={HandCoins}
                  label="Retraits"
                  value={stats.totalWithdrawals}
                  format={(n) => formatXAF(n)}
                  delay={0.2}
                />
                <QuickStat
                  icon={Receipt}
                  label="Revenu abonnements"
                  value={stats.totalSubscriptionRevenue}
                  format={(n) => formatXAF(n)}
                  delay={0.25}
                />
              </div>
            </div>

            {/* User split: managed vs alerts */}
            <div className="rounded-2xl bg-brand-gradient p-5 text-primary-foreground shadow-soft-lg overflow-hidden relative">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white blur-3xl" />
              </div>
              <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <div className="text-[11px] font-medium text-primary-foreground/70 uppercase tracking-wide">
                    Répartition par mode
                  </div>
                  <div className="mt-1 font-display font-bold text-lg">
                    Mode géré vs Mode alerte
                  </div>
                  <p className="mt-1 text-xs text-primary-foreground/70">
                    Profil d'utilisation de la base utilisateurs.
                  </p>
                </div>
                <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/15 p-4">
                    <div className="text-[11px] text-primary-foreground/70 font-medium">
                      Mode géré (robot)
                    </div>
                    <div className="mt-1 font-display font-extrabold text-2xl">
                      <AnimatedNumber value={stats.managedUsers} duration={0.9} />
                    </div>
                    <div className="text-[11px] text-primary-foreground/60 mt-0.5">
                      {stats.totalUsers > 0
                        ? `${Math.round((stats.managedUsers / stats.totalUsers) * 100)}% des utilisateurs`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/15 p-4">
                    <div className="text-[11px] text-primary-foreground/70 font-medium">
                      Mode alerte (opportunités)
                    </div>
                    <div className="mt-1 font-display font-extrabold text-2xl">
                      <AnimatedNumber value={stats.alertsUsers} duration={0.9} />
                    </div>
                    <div className="text-[11px] text-primary-foreground/60 mt-0.5">
                      {stats.totalUsers > 0
                        ? `${Math.round((stats.alertsUsers / stats.totalUsers) * 100)}% des utilisateurs`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== EmptyChart helper =====

function EmptyChart() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
        <Activity className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground max-w-[200px]">
        Aucune donnée à afficher pour cette période.
      </p>
    </div>
  );
}
