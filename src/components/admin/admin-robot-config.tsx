"use client";

/**
 * Admin view — Configuration du robot (mode "CashPilot gère").
 *
 * Fetches all configs on mount, edits the `robot` section, sends only that
 * part via PUT /api/admin/config on save. Includes a live preview that shows
 * estimated daily/monthly gains + CashPilot commission for a sample capital.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, TrendingUp, Clock, Wallet, Eye, Activity, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatXAF } from "@/lib/utils";
import {
  DEFAULT_ROBOT_CONFIG,
  type RobotConfig,
} from "@/lib/config-defaults";
import {
  ConfigSection,
  FormField,
  SliderField,
  NumberField,
  ConfigHeader,
  ConfigActionBar,
  ConfigLoader,
  ConfigError,
  useAllConfigs,
  putConfig,
  isDirty,
} from "./config-primitives";

const SAMPLE_CAPITAL = 50000;

export function AdminRobotConfig() {
  const { configs, loading, error, refetch, setConfigs } = useAllConfigs();
  const [form, setForm] = useState<RobotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewCapital, setPreviewCapital] = useState<number>(SAMPLE_CAPITAL);

  // Initialize form when configs arrive.
  useEffect(() => {
    if (configs?.robot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(configs.robot);
    }
  }, [configs]);

  const saved = configs?.robot ?? null;
  const dirty = form != null && saved != null && isDirty(form, saved);

  const set = <K extends keyof RobotConfig>(key: K, value: RobotConfig[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const ok = await putConfig({ robot: form });
    setSaving(false);
    if (ok) {
      // Optimistically mark as saved so the dirty dot disappears.
      setConfigs((prev) => (prev ? { ...prev, robot: form } : prev));
      toast.success("Configuration du robot enregistrée");
    }
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_ROBOT_CONFIG });
    toast.info("Valeurs par défaut restaurées");
  };

  /* ----- Live preview computations ----- */
  const preview = useMemo(() => {
    if (!form) return null;
    const cap = previewCapital > 0 ? previewCapital : 0;
    const dailyLow = cap * form.dailyRateLow;
    const dailyHigh = cap * form.dailyRateHigh;
    const monthlyLow = dailyLow * 30;
    const monthlyHigh = dailyHigh * 30;
    const avgDaily = (dailyLow + dailyHigh) / 2;
    const commissionMonthly = avgDaily * 30 * form.commissionRate;
    const avgGainPerTick =
      form.ticksPerDay > 0 ? avgDaily / form.ticksPerDay : 0;
    return {
      dailyLow,
      dailyHigh,
      monthlyLow,
      monthlyHigh,
      avgDaily,
      commissionMonthly,
      avgGainPerTick,
    };
  }, [form, previewCapital]);

  if (loading || (!configs && !error)) return <ConfigLoader />;
  if (error || !configs || !form) {
    return (
      <ConfigError
        message={error ?? "Configuration introuvable"}
        onRetry={refetch}
      />
    );
  }

  const markets = configs.opportunities.markets;

  return (
    <div className="space-y-6">
      <ConfigHeader
        icon={<Bot className="w-6 h-6" />}
        title="Configuration du robot"
        subtitle="Mode CashPilot gère — paramètres du robot de trading automatique"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ----- Main form (left, spans 2) ----- */}
        <div className="lg:col-span-2 space-y-5">
          {/* 1. Taux de gain */}
          <ConfigSection
            title="Taux de gain"
            description="Plage de gains quotidiens appliquée au capital de l'utilisateur."
            icon={<TrendingUp className="w-5 h-5" />}
          >
            <SliderField
              label="Taux quotidien minimum"
              value={form.dailyRateLow * 100}
              onChange={(v) => set("dailyRateLow", v / 100)}
              min={0.1}
              max={2}
              step={0.1}
              suffix="%"
              formatLabel={(v) => v.toFixed(1)}
              description="Gain minimal affiché par jour (mode géré)."
            />
            <SliderField
              label="Taux quotidien maximum"
              value={form.dailyRateHigh * 100}
              onChange={(v) => set("dailyRateHigh", v / 100)}
              min={0.5}
              max={5}
              step={0.1}
              suffix="%"
              formatLabel={(v) => v.toFixed(1)}
              description="Gain maximal affiché par jour (mode géré)."
            />
            <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Aperçu : </span>
              <span className="font-semibold tabular-nums">
                Pour {formatXAF(SAMPLE_CAPITAL)} XAF :{" "}
                {formatXAF(Math.round(SAMPLE_CAPITAL * form.dailyRateLow))}–
                {formatXAF(Math.round(SAMPLE_CAPITAL * form.dailyRateHigh))}{" "}
                XAF/jour
              </span>
            </div>
          </ConfigSection>

          {/* 2. Fréquence */}
          <ConfigSection
            title="Fréquence"
            description="Cadence des ticks du robot et taux de réussite."
            icon={<Clock className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Ticks par jour"
                description="Nombre de cycles de trading simulés par jour."
                hint="10 à 500"
              >
                <NumberField
                  value={form.ticksPerDay}
                  onChange={(v) =>
                    set("ticksPerDay", Math.max(10, Math.min(500, Math.round(v))))
                  }
                  min={10}
                  max={500}
                  step={1}
                  suffix="ticks"
                />
              </FormField>
              <FormField
                label="Multiplicateur démo"
                description="Rend les gains de démo plus visibles."
                hint="1 à 20"
              >
                <NumberField
                  value={form.demoMultiplier}
                  onChange={(v) =>
                    set(
                      "demoMultiplier",
                      Math.max(1, Math.min(20, Math.round(v)))
                    )
                  }
                  min={1}
                  max={20}
                  step={1}
                  suffix="×"
                />
              </FormField>
            </div>
            <SliderField
              label="Taux de réussite"
              value={form.successRate * 100}
              onChange={(v) => set("successRate", v / 100)}
              min={50}
              max={100}
              step={1}
              suffix="%"
              description="Probabilité qu'un tick produise un gain."
            />
            {preview && (
              <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Gain moyen par tick :{" "}
                </span>
                <span className="font-semibold tabular-nums">
                  ~{formatXAF(Math.round(preview.avgGainPerTick))} XAF
                </span>
              </div>
            )}
          </ConfigSection>

          {/* 3. Capital & commissions */}
          <ConfigSection
            title="Capital & commissions"
            description="Seuils de capital et commission prélevée par CashPilot sur les gains."
            icon={<Wallet className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Capital minimum"
                description="Dépôt minimum pour activer le robot."
              >
                <NumberField
                  value={form.minCapital}
                  onChange={(v) => set("minCapital", Math.max(0, Math.round(v)))}
                  min={0}
                  step={500}
                  suffix="XAF"
                  large
                />
              </FormField>
              <FormField
                label="Seuil niveau Croissance"
                description="Capital au-dessus duquel l'utilisateur passe en mode Croissance."
              >
                <NumberField
                  value={form.croissanceThreshold}
                  onChange={(v) =>
                    set("croissanceThreshold", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={5000}
                  suffix="XAF"
                  large
                />
              </FormField>
            </div>
            <SliderField
              label="Taux de commission sur gains"
              value={form.commissionRate * 100}
              onChange={(v) => set("commissionRate", v / 100)}
              min={0}
              max={30}
              step={1}
              suffix="%"
              description="Part des gains prélevée par CashPilot chaque mois."
            />
          </ConfigSection>

          {/* 4. Marchés surveillés (read-only info) */}
          <ConfigSection
            title="Marchés surveillés"
            description="Le robot opère sur ces marchés P2P. Modifiables dans la configuration des opportunités."
            icon={<Layers className="w-5 h-5" />}
          >
            <div className="flex flex-wrap gap-2">
              {markets.length > 0 ? (
                markets.map((m) => (
                  <Badge
                    key={m}
                    variant="secondary"
                    className="rounded-full px-3 py-1 text-xs"
                  >
                    {m}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">
                  Aucun marché activé.
                </span>
              )}
            </div>
          </ConfigSection>
        </div>

        {/* ----- Live preview (right, sticky) ----- */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:sticky lg:top-4 rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base">
                  Aperçu en direct
                </h3>
                <p className="text-xs text-muted-foreground">
                  Simulation pour un capital donné.
                </p>
              </div>
            </div>

            <FormField label="Capital de simulation" hint="">
              <NumberField
                value={previewCapital}
                onChange={(v) => setPreviewCapital(Math.max(0, Math.round(v)))}
                min={0}
                step={5000}
                suffix="XAF"
                large
              />
            </FormField>

            {preview && (
              <div className="mt-5 space-y-3">
                <PreviewRow
                  icon={<Activity className="w-4 h-4" />}
                  label="Gain quotidien"
                  value={`${formatXAF(Math.round(preview.dailyLow))} – ${formatXAF(
                    Math.round(preview.dailyHigh)
                  )} XAF`}
                  tone="green"
                />
                <PreviewRow
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Gain mensuel (30 j)"
                  value={`${formatXAF(Math.round(preview.monthlyLow))} – ${formatXAF(
                    Math.round(preview.monthlyHigh)
                  )} XAF`}
                  tone="green"
                />
                <div className="h-px bg-border/60 my-1" />
                <PreviewRow
                  icon={<Wallet className="w-4 h-4" />}
                  label="Commission CashPilot / mois"
                  value={`${formatXAF(Math.round(preview.commissionMonthly))} XAF`}
                  tone="gold"
                  sub={`Taux : ${Math.round(form.commissionRate * 100)}%`}
                />
                <div className="rounded-xl bg-muted/40 border border-border/60 px-3 py-2.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {form.ticksPerDay}
                  </span>{" "}
                  ticks/jour · multiplicateur démo{" "}
                  <span className="font-medium text-foreground">
                    {form.demoMultiplier}×
                  </span>{" "}
                  · réussite{" "}
                  <span className="font-medium text-foreground">
                    {Math.round(form.successRate * 100)}%
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <ConfigActionBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        saveLabel="Enregistrer le robot"
      />
    </div>
  );
}

function PreviewRow({
  icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "gold";
  sub?: string;
}) {
  const toneCls =
    tone === "green"
      ? "bg-primary/10 text-primary"
      : "bg-accent/50 text-accent-foreground";
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneCls}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
      <p className="text-sm font-semibold tabular-nums text-right">{value}</p>
    </div>
  );
}
