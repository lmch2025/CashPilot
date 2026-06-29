"use client";

/**
 * Admin view — Gestion des abonnements (mode "CashPilot alerte").
 *
 * Edits the 3 subscription plans. The "highlight" toggle is exclusive: only
 * one plan can be highlighted at a time. Saves all 3 plans at once via
 * PUT /api/admin/config { plans: [...] }.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Star,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Phone,
  Zap,
  Bell,
  EyeOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatXAF } from "@/lib/utils";
import {
  DEFAULT_PLANS_CONFIG,
  type PlanConfig,
} from "@/lib/config-defaults";
import {
  ConfigHeader,
  ConfigActionBar,
  ConfigLoader,
  ConfigError,
  ToggleField,
  FormField,
  useAllConfigs,
  putConfig,
  isDirty,
} from "./config-primitives";

const PRESET_COLORS = [
  { name: "Vert foncé", value: "oklch(0.38 0.09 155)" },
  { name: "Vert clair", value: "oklch(0.55 0.09 152)" },
  { name: "Sapin", value: "oklch(0.45 0.1 155)" },
  { name: "Or", value: "oklch(0.82 0.13 88)" },
  { name: "Or foncé", value: "oklch(0.7 0.13 80)" },
  { name: "Crème", value: "oklch(0.78 0.06 95)" },
  { name: "Ardoise", value: "oklch(0.4 0.04 250)" },
  { name: "Terracotta", value: "oklch(0.6 0.13 50)" },
];

export function AdminPlansConfig() {
  const { configs, loading, error, refetch, setConfigs } = useAllConfigs();
  const [plans, setPlans] = useState<PlanConfig[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (configs?.plans) {
      // Deep clone so we don't mutate the fetched state directly.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlans(JSON.parse(JSON.stringify(configs.plans)) as PlanConfig[]);
    }
  }, [configs]);

  const saved = configs?.plans ?? null;
  const dirty =
    plans != null && saved != null && isDirty(plans, saved);

  const updatePlan = (id: string, patch: Partial<PlanConfig>) => {
    setPlans((prev) =>
      prev ? prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) : prev
    );
  };

  const setHighlight = (id: string, value: boolean) => {
    // Exclusive: only one plan can be highlighted at a time.
    setPlans((prev) =>
      prev
        ? prev.map((p) => ({
            ...p,
            highlight: p.id === id ? value : false,
          }))
        : prev
    );
  };

  const handleSave = async () => {
    if (!plans) return;
    setSaving(true);
    const ok = await putConfig({ plans });
    setSaving(false);
    if (ok) {
      setConfigs((prev) => (prev ? { ...prev, plans } : prev));
      toast.success("Plans d'abonnement enregistrés");
    }
  };

  const handleReset = () => {
    setPlans(JSON.parse(JSON.stringify(DEFAULT_PLANS_CONFIG)) as PlanConfig[]);
    toast.info("Plans par défaut restaurés");
  };

  if (loading || (!configs && !error)) return <ConfigLoader />;
  if (error || !configs || !plans) {
    return (
      <ConfigError
        message={error ?? "Configuration introuvable"}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ConfigHeader
        icon={<Crown className="w-6 h-6" />}
        title="Gestion des abonnements"
        subtitle="Configurez les 3 plans d'abonnement du mode alerte"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {plans.map((plan, idx) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onChange={(patch) => updatePlan(plan.id, patch)}
            onHighlight={(v) => setHighlight(plan.id, v)}
            index={idx}
          />
        ))}
      </div>

      <ConfigActionBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        saveLabel="Enregistrer les plans"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PlanCard({
  plan,
  onChange,
  onHighlight,
  index,
}: {
  plan: PlanConfig;
  onChange: (patch: Partial<PlanConfig>) => void;
  onHighlight: (value: boolean) => void;
  index: number;
}) {
  const setFeature = (i: number, value: string) => {
    const features = [...plan.features];
    features[i] = value;
    onChange({ features });
  };
  const addFeature = () => {
    onChange({ features: [...plan.features, "Nouvelle fonctionnalité"] });
  };
  const removeFeature = (i: number) => {
    onChange({ features: plan.features.filter((_, idx) => idx !== i) });
  };
  const moveFeature = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= plan.features.length) return;
    const features = [...plan.features];
    [features[i], features[j]] = [features[j], features[i]];
    onChange({ features });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="rounded-2xl bg-card border border-border/60 shadow-soft overflow-hidden flex flex-col"
    >
      {/* Colored header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{
          backgroundColor: `color-mix(in oklch, ${plan.color} 18%, transparent)`,
          borderBottom: `2px solid ${plan.color}`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {plan.highlight && (
            <Star
              className="w-4 h-4 shrink-0"
              style={{ color: plan.color, fill: plan.color }}
            />
          )}
          <h3
            className="font-display font-bold text-base truncate"
            style={{ color: plan.color }}
          >
            {plan.name || "Sans nom"}
          </h3>
        </div>
        <Badge
          variant={plan.active ? "default" : "outline"}
          className="rounded-full px-2 py-0.5 text-[10px]"
        >
          {plan.active ? "Actif" : "Inactif"}
        </Badge>
      </div>

      <div className="p-5 space-y-4 flex-1">
        {/* Identity */}
        <FormField label="Nom du plan">
          <Input
            value={plan.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Découverte"
          />
        </FormField>

        <FormField label="Prix mensuel (XAF)">
          <div className="relative">
            <Input
              type="number"
              value={plan.price}
              min={0}
              step={500}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) onChange({ price: n, priceLabel: `${formatXAF(n)} XAF` });
              }}
              className="pr-12 tabular-nums"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              XAF
            </span>
          </div>
        </FormField>

        <FormField label="Slogan">
          <Input
            value={plan.tagline}
            onChange={(e) => onChange({ tagline: e.target.value })}
            placeholder="Pour tester en douceur"
          />
        </FormField>

        {/* Color */}
        <FormField
          label="Couleur"
          description="Couleur d'accent du plan."
        >
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => {
              const selected = plan.color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  onClick={() => onChange({ color: c.value })}
                  className={
                    "w-7 h-7 rounded-full border-2 transition-all " +
                    (selected
                      ? "border-foreground scale-110"
                      : "border-border hover:scale-105")
                  }
                  style={{ backgroundColor: c.value }}
                />
              );
            })}
          </div>
        </FormField>

        {/* Flags */}
        <ToggleField
          label="Mis en avant"
          description="Un seul plan peut être mis en avant."
          checked={plan.highlight}
          onCheckedChange={(v) => onHighlight(v)}
        />
        <ToggleField
          label="Actif"
          description="Désactivé : non visible par les utilisateurs."
          checked={plan.active}
          onCheckedChange={(v) => onChange({ active: v })}
        />

        {/* Quotas */}
        <FormField
          label="Opportunités / jour"
          description="-1 = illimité."
        >
          <Input
            type="number"
            value={plan.maxOpportunitiesPerDay}
            min={-1}
            step={1}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) onChange({ maxOpportunitiesPerDay: n });
            }}
            className="tabular-nums"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3">
          <ToggleField
            label="Alertes SMS"
            checked={plan.hasSmsAlerts}
            onCheckedChange={(v) => onChange({ hasSmsAlerts: v })}
          />
          <ToggleField
            label="Accès prioritaire"
            description="Avance de 15 min sur les opportunités."
            checked={plan.priorityAccess}
            onCheckedChange={(v) => onChange({ priorityAccess: v })}
          />
        </div>

        <FormField
          label="Délai support"
          description="Ex : 48h, 24h, 4h."
        >
          <Input
            value={plan.supportHours}
            onChange={(e) => onChange({ supportHours: e.target.value })}
            placeholder="48h"
            className="max-w-[120px]"
          />
        </FormField>

        {/* Features list editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">
              Fonctionnalités
            </label>
            <span className="text-xs text-muted-foreground">
              {plan.features.length}
            </span>
          </div>
          <div className="space-y-2">
            {plan.features.map((f, i) => (
              <FeatureRow
                key={i}
                value={f}
                onChange={(v) => setFeature(i, v)}
                onRemove={() => removeFeature(i)}
                onUp={() => moveFeature(i, -1)}
                onDown={() => moveFeature(i, 1)}
                canUp={i > 0}
                canDown={i < plan.features.length - 1}
              />
            ))}
            {plan.features.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Aucune fonctionnalité — ajoutez-en une ci-dessous.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addFeature}
            className="mt-2 w-full border-dashed"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter une fonctionnalité
          </Button>
        </div>
      </div>

      {/* Footer preview */}
      <div
        className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {plan.hasSmsAlerts ? (
            <Bell className="w-3.5 h-3.5 text-primary" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
          {plan.priorityAccess && <Zap className="w-3.5 h-3.5 text-primary" />}
          <Phone className="w-3.5 h-3.5" />
          <span>{plan.supportHours}</span>
        </div>
        <span
          className="font-display font-bold text-sm tabular-nums"
          style={{ color: plan.color }}
        >
          {formatXAF(plan.price)} XAF
          <span className="text-muted-foreground font-normal text-xs">
            /{plan.period}
          </span>
        </span>
      </div>
    </motion.div>
  );
}

function FeatureRow({
  value,
  onChange,
  onRemove,
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col">
        <button
          type="button"
          onClick={onUp}
          disabled={!canUp}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
          aria-label="Monter"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDown}
          disabled={!canDown}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
          aria-label="Descendre"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm flex-1"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
        aria-label="Supprimer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

