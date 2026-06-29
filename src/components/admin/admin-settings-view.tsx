"use client";

/**
 * Admin view — Paramètres globaux.
 *
 * Fetches all configs on mount, edits the `global` section, sends only that
 * part via PUT /api/admin/config on save. The maintenance toggle lives in a
 * danger-zone card with a red border.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Wallet,
  Smartphone,
  Bell,
  LifeBuoy,
  AlertTriangle,
  TriangleAlert,
  Mail,
  Globe,
  MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatXAF } from "@/lib/utils";
import {
  DEFAULT_GLOBAL_CONFIG,
  type GlobalConfig,
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

export function AdminSettingsView() {
  const { configs, loading, error, refetch, setConfigs } = useAllConfigs();
  const [form, setForm] = useState<GlobalConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (configs?.global) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(configs.global);
    }
  }, [configs]);

  const saved = configs?.global ?? null;
  const dirty = form != null && saved != null && isDirty(form, saved);

  const set = <K extends keyof GlobalConfig>(
    key: K,
    value: GlobalConfig[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleOperator = (op: "mtn" | "orange") => {
    if (!form) return;
    const has = form.operatorsEnabled.includes(op);
    set(
      "operatorsEnabled",
      has
        ? form.operatorsEnabled.filter((x) => x !== op)
        : [...form.operatorsEnabled, op]
    );
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const ok = await putConfig({ global: form });
    setSaving(false);
    if (ok) {
      setConfigs((prev) => (prev ? { ...prev, global: form } : prev));
      toast.success("Paramètres globaux enregistrés");
      if (form.maintenanceMode) {
        toast.warning("Mode maintenance activé — l'app est inaccessible.");
      }
    }
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_GLOBAL_CONFIG });
    toast.info("Valeurs par défaut restaurées");
  };

  if (loading || (!configs && !error)) return <ConfigLoader />;
  if (error || !configs || !form) {
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
        icon={<Settings className="w-6 h-6" />}
        title="Paramètres globaux"
        subtitle="Configuration générale de l'application"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Montants */}
        <ConfigSection
          title="Montants"
          description="Dépôts / retraits minimums et délais affichés à l'utilisateur."
          icon={<Wallet className="w-5 h-5" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Dépôt minimum">
              <NumberField
                value={form.minDeposit}
                onChange={(v) => set("minDeposit", Math.max(0, Math.round(v)))}
                min={0}
                step={500}
                suffix="XAF"
                large
              />
            </FormField>
            <FormField label="Retrait minimum">
              <NumberField
                value={form.minWithdraw}
                onChange={(v) =>
                  set("minWithdraw", Math.max(0, Math.round(v)))
                }
                min={0}
                step={500}
                suffix="XAF"
                large
              />
            </FormField>
            <FormField label="Délai de retrait affiché" hint="En minutes">
              <NumberField
                value={form.withdrawDelayMin}
                onChange={(v) =>
                  set("withdrawDelayMin", Math.max(0, Math.round(v)))
                }
                min={0}
                step={1}
                suffix="min"
              />
            </FormField>
            <FormField label="Délai de dépôt simulé" hint="En secondes">
              <NumberField
                value={form.depositDelaySec}
                onChange={(v) =>
                  set("depositDelaySec", Math.max(0, Math.round(v)))
                }
                min={0}
                step={1}
                suffix="s"
              />
            </FormField>
          </div>
          <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-3 text-xs text-muted-foreground">
            Aperçu : dépôt min.{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {formatXAF(form.minDeposit)} XAF
            </span>{" "}
            · retrait min.{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {formatXAF(form.minWithdraw)} XAF
            </span>{" "}
            · traitement{" "}
            <span className="font-semibold text-foreground">
              ~{form.depositDelaySec}s
            </span>{" "}
            /{" "}
            <span className="font-semibold text-foreground">
              {form.withdrawDelayMin} min
            </span>
          </div>
        </ConfigSection>

        {/* 2. Opérateurs Mobile Money */}
        <ConfigSection
          title="Opérateurs Mobile Money"
          description="Activez ou désactivez les opérateurs disponibles pour les dépôts et retraits."
          icon={<Smartphone className="w-5 h-5" />}
        >
          <ToggleField
            label="MTN Money"
            description="MoMo — paiement mobile MTN."
            checked={form.operatorsEnabled.includes("mtn")}
            onCheckedChange={() => toggleOperator("mtn")}
          />
          <ToggleField
            label="Orange Money"
            description="OM — paiement mobile Orange."
            checked={form.operatorsEnabled.includes("orange")}
            onCheckedChange={() => toggleOperator("orange")}
          />
          {form.operatorsEnabled.length === 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              Aucun opérateur activé — les dépôts/retraits seront indisponibles.
            </div>
          )}
        </ConfigSection>

        {/* 3. Notifications */}
        <ConfigSection
          title="Notifications"
          description="Canaux de notification utilisés pour informer les utilisateurs."
          icon={<Bell className="w-5 h-5" />}
        >
          <ToggleField
            label="Notifications SMS"
            description="Envoi d'alertes par SMS (impacte la facturation)."
            checked={form.smsEnabled}
            onCheckedChange={(v) => set("smsEnabled", v)}
          />
          <ToggleField
            label="Notifications Push"
            description="Envoi d'alertes push dans l'app."
            checked={form.pushEnabled}
            onCheckedChange={(v) => set("pushEnabled", v)}
          />
        </ConfigSection>

        {/* 4. Support */}
        <ConfigSection
          title="Support"
          description="Coordonnées affichées dans la section support de l'app."
          icon={<LifeBuoy className="w-5 h-5" />}
        >
          <FormField label="Numéro WhatsApp">
            <div className="relative">
              <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={form.supportWhatsapp}
                onChange={(e) => set("supportWhatsapp", e.target.value)}
                placeholder="+237 XXX XXX XXX"
                className="pl-9"
              />
            </div>
          </FormField>
          <FormField label="Email">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={form.supportEmail}
                onChange={(e) => set("supportEmail", e.target.value)}
                placeholder="contact@cashpilot.africa"
                className="pl-9"
              />
            </div>
          </FormField>
          <FormField label="Site web">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={form.supportWebsite}
                onChange={(e) => set("supportWebsite", e.target.value)}
                placeholder="www.cashpilot.africa"
                className="pl-9"
              />
            </div>
          </FormField>
        </ConfigSection>
      </div>

      {/* 5. Maintenance — danger zone, full width */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-soft"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
            <TriangleAlert className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-base text-destructive">
              Maintenance
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Zone sensible — active le mode maintenance de l'application.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Mode maintenance</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                L'app sera inaccessible aux utilisateurs. Seuls les
                administrateurs peuvent se connecter.
              </p>
            </div>
            <Switch
              checked={form.maintenanceMode}
              onCheckedChange={(v) => set("maintenanceMode", v)}
              className="data-[state=checked]:bg-destructive"
            />
          </div>
          {form.maintenanceMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                <strong>Attention :</strong> le mode maintenance est actuellement
                <strong> activé</strong>. Les utilisateurs verront un écran de
                maintenance à la place de l'app.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>

      <ConfigActionBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        saveLabel="Enregistrer les paramètres"
      />
    </div>
  );
}
