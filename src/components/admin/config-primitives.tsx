"use client";

/**
 * Shared primitives + hooks for the 4 admin config views.
 *
 * - ConfigSection: card wrapper with title/description/icon
 * - FormField: label + description + control
 * - SliderField: slider + numeric input bound to the same value
 * - ToggleField: row with label + Switch
 * - NumberField: numeric input with optional prefix/suffix
 * - useAllConfigs: fetch all configs on mount, expose refetch/setConfigs
 * - putConfig: PUT a single config part to /api/admin/config
 * - ConfigActionBar: sticky Save + Reset bar with unsaved-changes dot
 * - ConfigLoader / ConfigError: load + error states
 */

import { useEffect, useState, useCallback } from "react";
import { Save, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type {
  RobotConfig,
  OpportunitiesConfig,
  GlobalConfig,
  PlanConfig,
  AdminConfig,
  DistributionConfig,
} from "@/lib/config-defaults";

export interface AllConfigs {
  robot: RobotConfig;
  opportunities: OpportunitiesConfig;
  global: GlobalConfig;
  plans: PlanConfig[];
  admin: AdminConfig;
  distribution: DistributionConfig;
}

export type ConfigPatch = Partial<{
  robot: RobotConfig;
  opportunities: OpportunitiesConfig;
  global: GlobalConfig;
  plans: PlanConfig[];
  admin: AdminConfig;
  distribution: DistributionConfig;
}>;

interface AllConfigsResponse {
  ok: boolean;
  configs?: AllConfigs;
  error?: string;
}

/**
 * Fetch all configs on mount; expose refetch + setConfigs so views can
 * optimistically update after a save.
 */
export function useAllConfigs() {
  const [configs, setConfigs] = useState<AllConfigs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/config", { cache: "no-store" });
      const json: AllConfigsResponse = await res.json();
      if (!json.ok || !json.configs) {
        throw new Error(json.error || "Erreur de chargement");
      }
      setConfigs(json.configs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { configs, loading, error, refetch, setConfigs };
}

/**
 * PUT a single config part. Returns true on success, shows toast on error.
 */
export async function putConfig(part: ConfigPatch): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(part),
    });
    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || "Erreur d'enregistrement");
    }
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Erreur d'enregistrement");
    return false;
  }
}

/**
 * Deep-equal via JSON.stringify — used for "dirty" detection.
 */
export function isDirty<T>(a: T, b: T): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/* ---------------- Cards & fields ---------------- */

export function ConfigSection({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl bg-card border border-border/60 p-5 shadow-soft " +
        (className ?? "")
      }
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-base">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

export function FormField({
  label,
  description,
  hint,
  children,
}: {
  label: string;
  description?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground">{label}</label>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
      <div className="mt-2">{children}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Row with label + description on left, Switch on right.
 */
export function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
  danger,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div
      className={
        "flex items-start justify-between gap-4 rounded-xl border p-3.5 " +
        (danger
          ? "border-destructive/30 bg-destructive/5"
          : "border-border/60 bg-muted/30")
      }
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/**
 * Slider + numeric input bound to the same display value.
 *
 * Value/onChange work in "display units" (e.g. percent 0.6, not 0.006).
 * The caller is responsible for any conversion to/from the raw config value.
 */
export function SliderField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  formatLabel,
  disabled,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  formatLabel?: (v: number) => string;
  disabled?: boolean;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const fmt = (v: number) =>
    formatLabel
      ? formatLabel(v)
      : Number.isInteger(v)
        ? String(v)
        : v.toFixed(step < 0.1 ? 2 : 1);
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
            disabled={disabled}
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
      <div className="mt-3">
        <Slider
          value={[safe]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={(arr) => onChange(arr[0])}
        />
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>
            {fmt(min)}
            {suffix ? suffix : ""}
          </span>
          <span>
            {fmt(max)}
            {suffix ? suffix : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Numeric input with optional prefix/suffix and helper text.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  placeholder,
  disabled,
  large,
}: {
  value: number | "";
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  disabled?: boolean;
  large?: boolean;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(0);
            return;
          }
          const n = parseFloat(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className={
          (prefix ? "pl-12 " : "") +
          (suffix ? "pr-12 " : "") +
          (large ? "h-11 text-base tabular-nums" : "h-9 text-sm tabular-nums")
        }
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

/* ---------------- Action bar + states ---------------- */

export function DirtyDot({ dirty }: { dirty: boolean }) {
  if (!dirty) return null;
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--brand-gold)] animate-ping opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand-gold)]" />
    </span>
  );
}

export function ConfigLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mb-3" />
      <p className="text-sm">Chargement de la configuration...</p>
    </div>
  );
}

export function ConfigError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <p className="text-sm font-medium text-destructive mb-3">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}

export function ConfigActionBar({
  dirty,
  saving,
  onSave,
  onReset,
  saveLabel = "Enregistrer les modifications",
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="sticky bottom-0 z-20 mt-6 -mx-4 px-4 sm:mx-0 sm:px-0 py-3 bg-background/85 backdrop-blur-md border-t border-border/60 sm:rounded-2xl sm:border sm:bg-card/95 sm:shadow-soft-lg">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-2 min-h-[1rem]">
          {dirty ? (
            <>
              <DirtyDot dirty />
              <span className="text-[var(--brand-gold-dark)] dark:text-[var(--brand-gold)]">
                Modifications non enregistrées
              </span>
            </>
          ) : (
            <span>Toutes les modifications sont enregistrées</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={saving || !dirty}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser
          </Button>
          <Button onClick={onSave} disabled={!dirty || saving} size="sm">
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saveLabel}
            {dirty && <DirtyDot dirty />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Shared header ---------------- */

export function ConfigHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="font-display font-bold text-xl sm:text-2xl leading-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
