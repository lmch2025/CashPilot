"use client";

/**
 * Admin view — Distribution des gains.
 *
 * Two parts:
 *  - Top: live distribution stats (from /api/admin/distribution-stats)
 *    including a flow diagram, 4 KPI cards, last trade details,
 *    cumulative stats and a live example card.
 *  - Bottom: configuration form (exposure rate, commission, rounding,
 *    min gain, interval, exclude paused users).
 *
 * The example card at the top of the page updates LIVE as the admin drags
 * the exposure / commission sliders in the form below (uses local form state,
 * not the saved config).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PieChart,
  TrendingUp,
  Eye,
  Crown,
  Lock,
  ArrowDown,
  RefreshCw,
  Activity,
  Users,
  Wallet,
  Clock,
  Layers,
  Calculator,
  Settings2,
  AlertTriangle,
} from "lucide-react";
import { AnimatedNumber } from "@/components/cashpilot/animated-number";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { formatXAF } from "@/lib/utils";
import {
  DEFAULT_DISTRIBUTION_CONFIG,
  type DistributionConfig,
  type DistributionState,
} from "@/lib/config-defaults";
import {
  ConfigSection,
  FormField,
  NumberField,
  ToggleField,
  ConfigHeader,
  ConfigActionBar,
  ConfigLoader,
  ConfigError,
  useAllConfigs,
  putConfig,
  isDirty,
} from "./config-primitives";

/* ============================== Types ============================== */

interface DistributionMetrics {
  effectiveExposureRate: number;
  effectiveCommissionRate: number;
  averageGainPerDistribution: number;
  platformTotalRevenue: number;
}

interface DistributionStats {
  ok: true;
  state: DistributionState;
  config: DistributionConfig;
  metrics: DistributionMetrics;
}

/* ============================== Constants ============================== */

// Live example values
const EXAMPLE_ACTUAL_PROFIT = 10000;
const EXAMPLE_USER_CAPITAL = 100000;
const EXAMPLE_TOTAL_CAPITAL = 1000000;

/* ============================== Helpers ============================== */

function computeExample(
  exposureRate: number,
  commissionRate: number,
  userCapital: number,
  totalCapital: number
) {
  const actualProfit = EXAMPLE_ACTUAL_PROFIT;
  const exposed = actualProfit * exposureRate;
  const commission = exposed * commissionRate;
  const distributable = exposed - commission;
  const userShare = totalCapital > 0 ? userCapital / totalCapital : 0;
  const userGain = Math.round(distributable * userShare);
  const hiddenRetention = actualProfit - exposed;
  return {
    actualProfit,
    exposed,
    commission,
    distributable,
    userGain,
    hiddenRetention,
  };
}

function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (d.getFullYear() < 1971) return "—";
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ============================== Main component ============================== */

export function AdminDistributionConfig() {
  const { configs, loading, error, refetch, setConfigs } = useAllConfigs();
  const [form, setForm] = useState<DistributionConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Distribution stats (separate endpoint, non-blocking)
  const [stats, setStats] = useState<DistributionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/admin/distribution-stats", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || "Erreur de chargement");
      }
      setStats(json as DistributionStats);
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Initialize form when configs arrive
  useEffect(() => {
    if (configs?.distribution) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(configs.distribution);
    }
  }, [configs]);

  const saved = configs?.distribution ?? null;
  const dirty = form != null && saved != null && isDirty(form, saved);

  const set = <K extends keyof DistributionConfig>(
    key: K,
    value: DistributionConfig[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const ok = await putConfig({ distribution: form });
    setSaving(false);
    if (ok) {
      setConfigs((prev) =>
        prev ? { ...prev, distribution: form } : prev
      );
      toast.success("Configuration de distribution enregistrée");
      // Refetch stats since the config feeds the metrics
      fetchStats();
    }
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_DISTRIBUTION_CONFIG });
    toast.info("Valeurs par défaut restaurées");
  };

  // Live example: react to the FORM (not the saved config) so the example
  // card updates instantly as the admin drags the sliders.
  const example = useMemo(() => {
    if (!form) return null;
    return computeExample(
      form.exposureRate,
      form.commissionRate,
      EXAMPLE_USER_CAPITAL,
      EXAMPLE_TOTAL_CAPITAL
    );
  }, [form]);

  if (loading || (!configs && !error)) return <ConfigLoader />;
  if (error || !configs || !form) {
    return (
      <ConfigError
        message={error ?? "Configuration introuvable"}
        onRetry={refetch}
      />
    );
  }

  const state = stats?.state;
  const metrics = stats?.metrics;

  return (
    <div className="space-y-6">
      <ConfigHeader
        icon={<PieChart className="w-6 h-6" />}
        title="Distribution des gains"
        subtitle="Contrôlez la part des bénéfices réels exposée aux investisseurs et la commission CashPilot."
      />

      {/* =================== PART 1: STATS =================== */}
      <div className="space-y-5">
        <DistributionFlowCard
          exposureRate={form.exposureRate}
          commissionRate={form.commissionRate}
          onRefresh={fetchStats}
          statsLoading={statsLoading}
          lastDistributionAt={state?.lastDistributionAt}
        />

        {/* 4 KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Bénéfice réel total"
            value={state?.totalActualProfit ?? 0}
            tone="green"
            loading={statsLoading}
            sub={
              state && state.distributionCount > 0
                ? `${state.distributionCount} distribution${state.distributionCount > 1 ? "s" : ""}`
                : "—"
            }
          />
          <KpiCard
            icon={<Eye className="w-5 h-5" />}
            label="Total exposé aux utilisateurs"
            value={state?.totalExposedProfit ?? 0}
            tone="green"
            loading={statsLoading}
            sub={
              metrics
                ? `Effectif : ${formatPct(metrics.effectiveExposureRate)}`
                : undefined
            }
          />
          <KpiCard
            icon={<Crown className="w-5 h-5" />}
            label="Commission CashPilot"
            value={state?.totalCommission ?? 0}
            tone="gold"
            loading={statsLoading}
            sub={
              metrics
                ? `Effectif : ${formatPct(metrics.effectiveCommissionRate)}`
                : undefined
            }
          />
          <KpiCard
            icon={<Lock className="w-5 h-5" />}
            label="Rétention cachée plateforme"
            value={state?.totalHiddenRetention ?? 0}
            tone="dark"
            loading={statsLoading}
            sub="Bénéfice non exposé"
          />
        </div>

        {/* Last trade + Cumulative stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <LastTradeCard state={state} loading={statsLoading} />
          <CumulativeStatsCard
            state={state}
            metrics={metrics}
            loading={statsLoading}
          />
        </div>

        {/* Live example card (updates with form) */}
        {example && (
          <ExampleCard
            example={example}
            exposureRate={form.exposureRate}
            commissionRate={form.commissionRate}
            userCapital={EXAMPLE_USER_CAPITAL}
            totalCapital={EXAMPLE_TOTAL_CAPITAL}
          />
        )}

        {/* Non-blocking stats error banner */}
        {statsError && !statsLoading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">
                Impossible de charger les statistiques
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {statsError}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchStats}>
              <RefreshCw className="w-3.5 h-3.5" />
              Réessayer
            </Button>
          </div>
        )}
      </div>

      {/* =================== PART 2: CONFIG FORM =================== */}
      <ConfigSection
        title="Configuration de la distribution"
        description="Paramètres contrôlant le calcul et la répartition des gains entre investisseurs et plateforme."
        icon={<Settings2 className="w-5 h-5" />}
      >
        {/* 1. Exposure rate — green track */}
        <TonalSliderField
          label="Taux d'exposition"
          description="Proportion du bénéfice réel exposé aux investisseurs. Le reste est retenu par la plateforme."
          value={form.exposureRate * 100}
          onChange={(v) => set("exposureRate", v / 100)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          tone="green"
          big
        />

        {/* 2. Commission rate — gold track */}
        <TonalSliderField
          label="Commission CashPilot"
          description="Commission prélevée sur les gains exposés (avant distribution aux investisseurs)."
          value={form.commissionRate * 100}
          onChange={(v) => set("commissionRate", v / 100)}
          min={0}
          max={30}
          step={1}
          suffix="%"
          tone="gold"
        />

        {/* 3. Rounding mode */}
        <FormField
          label="Mode d'arrondi"
          description="Comment arrondir les gains par utilisateur."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <RoundingButton
              active={form.roundingMode === "floor"}
              onClick={() => set("roundingMode", "floor")}
              label="Arrondi inférieur"
              hint="Toujours vers le bas"
            />
            <RoundingButton
              active={form.roundingMode === "round"}
              onClick={() => set("roundingMode", "round")}
              label="Arrondi standard"
              hint="Au plus proche"
            />
            <RoundingButton
              active={form.roundingMode === "ceil"}
              onClick={() => set("roundingMode", "ceil")}
              label="Arrondi supérieur"
              hint="Toujours vers le haut"
            />
          </div>
        </FormField>

        {/* 4 + 5. Min gain + Min interval */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Gain minimum par utilisateur"
            description="Gain minimum distribué par trade. Évite les micro-gains insignifiants."
            hint="1 à 1000 XAF"
          >
            <NumberField
              value={form.minGainPerUser}
              onChange={(v) =>
                set(
                  "minGainPerUser",
                  Math.max(1, Math.min(1000, Math.round(v)))
                )
              }
              min={1}
              max={1000}
              step={1}
              suffix="XAF"
            />
          </FormField>
          <FormField
            label="Intervalle minimum"
            description="Temps minimum entre deux distributions. Protège contre la double-distribution."
            hint="5 à 300 secondes"
          >
            <NumberField
              value={form.minIntervalSec}
              onChange={(v) =>
                set(
                  "minIntervalSec",
                  Math.max(5, Math.min(300, Math.round(v)))
                )
              }
              min={5}
              max={300}
              step={1}
              suffix="sec"
            />
          </FormField>
        </div>

        {/* 6. excludePausedUsers */}
        <ToggleField
          label="Exclure les utilisateurs suspendus"
          description="Les utilisateurs suspendus ne reçoivent pas de gains."
          checked={form.excludePausedUsers}
          onCheckedChange={(v) => set("excludePausedUsers", v)}
        />
      </ConfigSection>

      <ConfigActionBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        saveLabel="Enregistrer la distribution"
      />
    </div>
  );
}

/* ============================== Sub-components ============================== */

function DistributionFlowCard({
  exposureRate,
  commissionRate,
  onRefresh,
  statsLoading,
  lastDistributionAt,
}: {
  exposureRate: number;
  commissionRate: number;
  onRefresh: () => void;
  statsLoading: boolean;
  lastDistributionAt?: string;
}) {
  const exposedPct = Math.round(exposureRate * 100);
  const hiddenPct = 100 - exposedPct;
  const commissionPct = Math.round(commissionRate * 100);
  const distributedPct = 100 - commissionPct;

  return (
    <div className="rounded-2xl bg-card border border-border/60 shadow-soft p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-base sm:text-lg">
            Flux de distribution des gains
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Du bénéfice réel du trade jusqu'au gain individuel de l'investisseur.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={statsLoading}
        >
          <RefreshCw
            className={"w-3.5 h-3.5 " + (statsLoading ? "animate-spin" : "")}
          />
          Rafraîchir
        </Button>
      </div>

      {/* Flow diagram */}
      <div className="rounded-xl bg-muted/30 border border-border/60 p-4 sm:p-5">
        {/* Root */}
        <div className="rounded-xl border border-border/60 bg-foreground/[0.04] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">
                Bénéfice réel du trade
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Capital × taux de gain
              </p>
            </div>
            <span className="text-sm font-bold tabular-nums shrink-0">
              100%
            </span>
          </div>
        </div>

        <FlowArrow
          label={`${exposedPct}% exposé · ${hiddenPct}% retenu`}
        />

        {/* Two branches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Exposed branch */}
          <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3.5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  Exposé aux utilisateurs
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {exposedPct}% du bénéfice réel
                </p>
              </div>
            </div>

            <div className="space-y-2 pl-1">
              <div className="flex items-center gap-2 rounded-lg bg-[var(--brand-gold)]/15 px-3 py-2 border border-[var(--brand-gold)]/30">
                <Crown className="w-3.5 h-3.5 text-[var(--brand-gold-dark)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight">
                    Commission CashPilot
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {commissionPct}% de l'exposé
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-primary/20 px-3 py-2 border border-primary/30">
                <Wallet className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight">
                    Distribué aux investisseurs
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {distributedPct}% de l'exposé
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Hidden retention branch */}
          <div className="rounded-xl border border-border/60 bg-muted/50 p-3.5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-foreground/10 text-foreground/70 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  Rétention cachée plateforme
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {hiddenPct}% du bénéfice réel
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
              Bénéfice réel non déclaré aux utilisateurs. Conservé par la
              plateforme comme revenu brut.
            </p>
          </div>
        </div>
      </div>

      {/* Last distribution timestamp */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" />
        <span>Dernière distribution :</span>
        <span className="font-medium text-foreground tabular-nums">
          {lastDistributionAt ? formatDateTime(lastDistributionAt) : "—"}
        </span>
      </div>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center my-2.5 select-none">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground tabular-nums">
        <span className="h-px w-6 bg-border/60" />
        <ArrowDown className="w-3 h-3" />
        <span>{label}</span>
        <ArrowDown className="w-3 h-3" />
        <span className="h-px w-6 bg-border/60" />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
  sub,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "green" | "gold" | "dark";
  sub?: string;
  loading?: boolean;
}) {
  const toneCls =
    tone === "green"
      ? "bg-primary/10 text-primary"
      : tone === "gold"
        ? "bg-[var(--brand-gold)]/20 text-[var(--brand-gold-dark)]"
        : "bg-foreground/10 text-foreground/70";
  return (
    <div className="rounded-2xl bg-card border border-border/60 shadow-soft p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground leading-tight">
          {label}
        </p>
        <div
          className={
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 " +
            toneCls
          }
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 min-h-[1.75rem]">
        {loading ? (
          <div className="h-7 w-24 rounded-md bg-muted/60 animate-pulse" />
        ) : (
          <AnimatedNumber
            value={value}
            format={(n) => `${formatXAF(n)} XAF`}
            className="block text-xl font-display font-bold tabular-nums"
          />
        )}
      </div>
      {sub && (
        <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
          {sub}
        </p>
      )}
    </div>
  );
}

function LastTradeCard({
  state,
  loading,
}: {
  state: DistributionState | undefined;
  loading?: boolean;
}) {
  return (
    <ConfigSection
      title="Dernier trade distribué"
      description="Détails du dernier trade traité par le moteur de distribution."
      icon={<Activity className="w-5 h-5" />}
    >
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-muted/60 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-muted/60 animate-pulse" />
        </div>
      ) : !state || state.distributionCount === 0 ? (
        <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune distribution effectuée pour l'instant.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Les statistiques du dernier trade apparaîtront ici après le
            premier cycle du robot.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            icon={<Clock className="w-4 h-4" />}
            label="Date / heure"
            value={formatDateTime(state.lastDistributionAt)}
            span2
          />
          <StatItem
            icon={<TrendingUp className="w-4 h-4" />}
            label="Bénéfice réel"
            value={`${formatXAF(state.lastTradeActualProfit)} XAF`}
            tone="green"
          />
          <StatItem
            icon={<Eye className="w-4 h-4" />}
            label="Bénéfice exposé"
            value={`${formatXAF(state.lastTradeExposedProfit)} XAF`}
            tone="green"
          />
          <StatItem
            icon={<Users className="w-4 h-4" />}
            label="Investisseurs"
            value={String(state.lastTradeUserCount)}
          />
          <StatItem
            icon={<Wallet className="w-4 h-4" />}
            label="Capital total"
            value={`${formatXAF(state.lastTradeTotalCapital)} XAF`}
          />
        </div>
      )}
    </ConfigSection>
  );
}

function CumulativeStatsCard({
  state,
  metrics,
  loading,
}: {
  state: DistributionState | undefined;
  metrics: DistributionMetrics | undefined;
  loading?: boolean;
}) {
  return (
    <ConfigSection
      title="Statistiques cumulatives"
      description="Totaux depuis la mise en service du moteur de distribution."
      icon={<Layers className="w-5 h-5" />}
    >
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-muted/60 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-muted/60 animate-pulse" />
        </div>
      ) : !state ? (
        <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Statistiques indisponibles.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            icon={<Wallet className="w-4 h-4" />}
            label="Total distribué aux utilisateurs"
            value={`${formatXAF(state.totalDistributedToUsers)} XAF`}
            tone="green"
            span2
          />
          <StatItem
            icon={<Activity className="w-4 h-4" />}
            label="Nombre de distributions"
            value={String(state.distributionCount)}
          />
          <StatItem
            icon={<TrendingUp className="w-4 h-4" />}
            label="Gain moyen / distribution"
            value={
              metrics
                ? `${formatXAF(Math.round(metrics.averageGainPerDistribution))} XAF`
                : "—"
            }
            tone="green"
          />
          <StatItem
            icon={<Crown className="w-4 h-4" />}
            label="Revenu total plateforme"
            value={
              metrics
                ? `${formatXAF(Math.round(metrics.platformTotalRevenue))} XAF`
                : "—"
            }
            tone="gold"
            span2
          />
        </div>
      )}
    </ConfigSection>
  );
}

function StatItem({
  icon,
  label,
  value,
  tone,
  span2,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "green" | "gold";
  span2?: boolean;
}) {
  const toneCls =
    tone === "green"
      ? "bg-primary/10 text-primary"
      : tone === "gold"
        ? "bg-[var(--brand-gold)]/20 text-[var(--brand-gold-dark)]"
        : "bg-muted/60 text-muted-foreground";
  return (
    <div
      className={
        "rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 " +
        (span2 ? "col-span-2" : "")
      }
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={
            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 " +
            toneCls
          }
        >
          {icon}
        </div>
        <p className="text-[11px] text-muted-foreground leading-tight">
          {label}
        </p>
      </div>
      <p className="text-sm font-semibold tabular-nums pl-8">{value}</p>
    </div>
  );
}

function ExampleCard({
  example,
  exposureRate,
  commissionRate,
  userCapital,
  totalCapital,
}: {
  example: ReturnType<typeof computeExample>;
  exposureRate: number;
  commissionRate: number;
  userCapital: number;
  totalCapital: number;
}) {
  const userSharePct = totalCapital > 0 ? (userCapital / totalCapital) * 100 : 0;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-5 sm:p-6 shadow-soft">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Calculator className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-base">
            Exemple de distribution
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mise à jour en direct selon les curseurs du formulaire ci-dessous.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-card/80 border border-border/60 p-4 space-y-2.5">
        <ExampleRow
          label="Bénéfice réel du trade"
          value={`${formatXAF(example.actualProfit)} XAF`}
          tone="root"
        />
        <div className="ml-3 pl-3 border-l-2 border-primary/40 space-y-2">
          <ExampleRow
            label={`Exposé aux utilisateurs (${Math.round(exposureRate * 100)}%)`}
            value={`${formatXAF(example.exposed)} XAF`}
            tone="green"
          />
          <div className="ml-3 pl-3 border-l-2 border-[var(--brand-gold)]/50 space-y-2">
            <ExampleRow
              label={`Commission CashPilot (${Math.round(commissionRate * 100)}%)`}
              value={`${formatXAF(example.commission)} XAF`}
              tone="gold"
            />
            <ExampleRow
              label={`Distribué aux investisseurs (${100 - Math.round(commissionRate * 100)}%)`}
              value={`${formatXAF(example.distributable)} XAF`}
              tone="green-bright"
            />
          </div>
        </div>
        <div className="ml-3 pl-3 border-l-2 border-border/60">
          <ExampleRow
            label={`Rétention cachée plateforme (${100 - Math.round(exposureRate * 100)}%)`}
            value={`${formatXAF(example.hiddenRetention)} XAF`}
            tone="dark"
          />
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-[var(--brand-gold)]/10 border border-[var(--brand-gold)]/30 p-4">
        <p className="text-xs text-muted-foreground mb-1">
          Exemple pour un investisseur
        </p>
        <p className="text-sm text-foreground leading-relaxed">
          Si un utilisateur possède{" "}
          <span className="font-semibold tabular-nums">
            {formatXAF(userCapital)} XAF
          </span>{" "}
          sur un pool total de{" "}
          <span className="font-semibold tabular-nums">
            {formatXAF(totalCapital)} XAF
          </span>{" "}
          <span className="text-muted-foreground tabular-nums">
            ({userSharePct.toFixed(1).replace(".", ",")}%)
          </span>
          , il reçoit :
        </p>
        <p className="mt-2 text-2xl font-display font-bold text-primary tabular-nums">
          {formatXAF(example.userGain)} XAF
        </p>
      </div>
    </div>
  );
}

function ExampleRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "root" | "green" | "green-bright" | "gold" | "dark";
}) {
  const dotCls =
    tone === "root"
      ? "bg-foreground/40"
      : tone === "green"
        ? "bg-primary"
        : tone === "green-bright"
          ? "bg-[var(--brand-green-light)]"
          : tone === "gold"
            ? "bg-[var(--brand-gold)]"
            : "bg-foreground/30";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={"w-2 h-2 rounded-full shrink-0 " + dotCls} />
        <span className="text-xs text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold tabular-nums shrink-0">
        {value}
      </span>
    </div>
  );
}

function RoundingButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-xl border px-3 py-2.5 text-left transition-colors " +
        (active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground")
      }
    >
      <p className="text-sm font-medium leading-tight">{label}</p>
      <p className="text-[11px] mt-0.5 opacity-80">{hint}</p>
    </button>
  );
}

/**
 * Slider field with a custom track color (green or gold) and an optional
 * big percentage display for the headline exposure / commission sliders.
 *
 * The track color is applied by overriding Radix's data-slot selectors via
 * arbitrary Tailwind variants.
 */
function TonalSliderField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  tone,
  big,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  tone: "green" | "gold";
  big?: boolean;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const rangeColorCls =
    tone === "green"
      ? "[&_[data-slot=slider-range]]:bg-primary"
      : "[&_[data-slot=slider-range]]:bg-[var(--brand-gold)]";
  const thumbColorCls =
    tone === "green"
      ? "[&_[data-slot=slider-thumb]]:border-primary"
      : "[&_[data-slot=slider-thumb]]:border-[var(--brand-gold)]";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            value={safe}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (!Number.isNaN(n)) onChange(n);
            }}
            className="w-24 h-8 text-sm tabular-nums"
          />
          {suffix && (
            <span className="text-xs text-muted-foreground w-3">{suffix}</span>
          )}
        </div>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <div className={"flex-1 " + rangeColorCls + " " + thumbColorCls}>
          <Slider
            value={[safe]}
            min={min}
            max={max}
            step={step}
            onValueChange={(arr) => onChange(arr[0])}
          />
        </div>
        {big && (
          <div className="shrink-0 text-right">
            <p
              className={
                "font-display font-bold tabular-nums leading-none " +
                (tone === "green"
                  ? "text-primary"
                  : "text-[var(--brand-gold-dark)]")
              }
              style={{ fontSize: "1.5rem" }}
            >
              {Math.round(safe)}
              <span className="text-sm font-semibold ml-0.5">{suffix}</span>
            </p>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>
          {min}
          {suffix ? suffix : ""}
        </span>
        <span>
          {max}
          {suffix ? suffix : ""}
        </span>
      </div>
    </div>
  );
}
