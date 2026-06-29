"use client";

/**
 * Admin view — Configuration des opportunités (mode "CashPilot alerte").
 *
 * Fetches all configs on mount, edits the `opportunities` section, sends only
 * that part via PUT /api/admin/config on save. Includes a live preview that
 * shows a sample generated opportunity based on the current config.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Clock,
  Percent,
  Timer,
  Coins,
  Layers,
  Eye,
  RefreshCw,
  TrendingUp,
  Repeat,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatXAF } from "@/lib/utils";
import {
  DEFAULT_OPPORTUNITIES_CONFIG,
  type OpportunitiesConfig,
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

const ALL_MARKETS = [
  "Binance P2P",
  "Yellow Card",
  "Paxful",
  "Bitget",
  "KuCoin P2P",
  "OKX P2P",
  "Remitano",
  "Bybit P2P",
];
const ALL_PAIRS = [
  "USDT/XAF",
  "BTC/XAF",
  "USDC/XAF",
  "ETH/XAF",
  "TRX/XAF",
  "SOL/XAF",
];

export function AdminOpportunitiesConfig() {
  const { configs, loading, error, refetch, setConfigs } = useAllConfigs();
  const [form, setForm] = useState<OpportunitiesConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [seed, setSeed] = useState(0); // re-roll the preview

  useEffect(() => {
    if (configs?.opportunities) {
      setForm(configs.opportunities);
    }
  }, [configs]);

  const saved = configs?.opportunities ?? null;
  const dirty = form != null && saved != null && isDirty(form, saved);

  const set = <K extends keyof OpportunitiesConfig>(
    key: K,
    value: OpportunitiesConfig[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const ok = await putConfig({ opportunities: form });
    setSaving(false);
    if (ok) {
      setConfigs((prev) => (prev ? { ...prev, opportunities: form } : prev));
      toast.success("Configuration des opportunités enregistrée");
    }
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_OPPORTUNITIES_CONFIG });
    toast.info("Valeurs par défaut restaurées");
  };

  const toggleMarket = (m: string) => {
    if (!form) return;
    const has = form.markets.includes(m);
    set("markets", has ? form.markets.filter((x) => x !== m) : [...form.markets, m]);
  };
  const togglePair = (p: string) => {
    if (!form) return;
    const has = form.pairs.includes(p);
    set("pairs", has ? form.pairs.filter((x) => x !== p) : [...form.pairs, p]);
  };

  /* ----- Sample opportunity preview ----- */
  const sample = useMemo(() => {
    if (!form) return null;
    const s = seed; // dependency for re-roll
    void s;
    const markets = form.markets.length ? form.markets : ALL_MARKETS;
    const pairs = form.pairs.length ? form.pairs : ALL_PAIRS;
    const market = markets[Math.floor(Math.random() * markets.length)];
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    const spread =
      form.spreadLow + Math.random() * Math.max(0, form.spreadHigh - form.spreadLow);
    const validMin =
      form.validUntilMinMin +
      Math.random() * Math.max(0, form.validUntilMaxMin - form.validUntilMinMin);
    // Plage de prix selon la paire
    let priceLow = form.usdtPriceLow;
    let priceHigh = form.usdtPriceHigh;
    if (pair.startsWith("BTC")) {
      priceLow = form.btcPriceLow;
      priceHigh = form.btcPriceHigh;
    } else if (pair.startsWith("USDC")) {
      priceLow = form.usdcPriceLow;
      priceHigh = form.usdcPriceHigh;
    } else if (pair.startsWith("ETH")) {
      priceLow = form.ethPriceLow;
      priceHigh = form.ethPriceHigh;
    } else if (pair.startsWith("TRX")) {
      priceLow = form.trxPriceLow;
      priceHigh = form.trxPriceHigh;
    } else if (pair.startsWith("SOL")) {
      priceLow = form.solPriceLow;
      priceHigh = form.solPriceHigh;
    }
    const price = Math.round(
      priceLow + Math.random() * Math.max(0, priceHigh - priceLow)
    );
    const gain = Math.round(form.referenceCapital * spread);
    const expiresAt = new Date(Date.now() + validMin * 60 * 1000);
    return {
      market,
      pair,
      spread,
      validMin,
      price,
      gain,
      expiresAt,
    };
  }, [form, seed]);

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
        icon={<Bell className="w-6 h-6" />}
        title="Configuration des opportunités"
        subtitle="Mode CashPilot alerte — paramètres des opportunités envoyées aux utilisateurs"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ----- Main form (left, spans 2) ----- */}
        <div className="lg:col-span-2 space-y-5">
          {/* 1. Génération */}
          <ConfigSection
            title="Génération"
            description="Cadence de génération et nombre d'opportunités actives par utilisateur."
            icon={<RefreshCw className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                label="Intervalle de vérification"
                description="Secondes entre deux polls."
              >
                <NumberField
                  value={form.generationIntervalSec}
                  onChange={(v) =>
                    set("generationIntervalSec", Math.max(1, Math.round(v)))
                  }
                  min={1}
                  step={1}
                  suffix="s"
                />
              </FormField>
              <FormField
                label="Actives maximum"
                description="Par utilisateur."
              >
                <NumberField
                  value={form.maxActive}
                  onChange={(v) => set("maxActive", Math.max(1, Math.round(v)))}
                  min={1}
                  step={1}
                />
              </FormField>
              <FormField
                label="Seuil de génération"
                description="Générer si < N actives."
              >
                <NumberField
                  value={form.minActiveToGenerate}
                  onChange={(v) =>
                    set("minActiveToGenerate", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={1}
                />
              </FormField>
            </div>
          </ConfigSection>

          {/* 2. Spreads & gains */}
          <ConfigSection
            title="Spreads & gains"
            description="Plage de spreads des opportunités et capital de référence pour le gain estimé."
            icon={<Percent className="w-5 h-5" />}
          >
            <SliderField
              label="Spread minimum"
              value={form.spreadLow * 100}
              onChange={(v) => set("spreadLow", v / 100)}
              min={0.5}
              max={5}
              step={0.1}
              suffix="%"
              formatLabel={(v) => v.toFixed(1)}
            />
            <SliderField
              label="Spread maximum"
              value={form.spreadHigh * 100}
              onChange={(v) => set("spreadHigh", v / 100)}
              min={1}
              max={10}
              step={0.1}
              suffix="%"
              formatLabel={(v) => v.toFixed(1)}
            />
            <FormField
              label="Capital de référence pour gain estimé"
              description="Capital utilisé pour calculer le gain affiché sur chaque opportunité."
            >
              <NumberField
                value={form.referenceCapital}
                onChange={(v) =>
                  set("referenceCapital", Math.max(0, Math.round(v)))
                }
                min={0}
                step={5000}
                suffix="XAF"
                large
              />
            </FormField>
            <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Gain estimé type : </span>
              <span className="font-semibold tabular-nums">
                +{formatXAF(Math.round(form.referenceCapital * form.spreadLow))}{" "}
                à +{formatXAF(Math.round(form.referenceCapital * form.spreadHigh))}{" "}
                XAF (
                {(form.spreadLow * 100).toFixed(1)}–
                {(form.spreadHigh * 100).toFixed(1)}%)
              </span>
              <span className="text-muted-foreground">
                {" "}
                pour {formatXAF(form.referenceCapital)} XAF
              </span>
            </div>
          </ConfigSection>

          {/* 3. Validité */}
          <ConfigSection
            title="Validité"
            description="Durée pendant laquelle une opportunité reste valide."
            icon={<Timer className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Durée minimum" hint="1 à 60 minutes">
                <NumberField
                  value={form.validUntilMinMin}
                  onChange={(v) =>
                    set(
                      "validUntilMinMin",
                      Math.max(1, Math.min(60, Math.round(v)))
                    )
                  }
                  min={1}
                  max={60}
                  step={1}
                  suffix="min"
                />
              </FormField>
              <FormField label="Durée maximum" hint="5 à 120 minutes">
                <NumberField
                  value={form.validUntilMaxMin}
                  onChange={(v) =>
                    set(
                      "validUntilMaxMin",
                      Math.max(5, Math.min(120, Math.round(v)))
                    )
                  }
                  min={5}
                  max={120}
                  step={1}
                  suffix="min"
                />
              </FormField>
            </div>
          </ConfigSection>

          {/* 4. Prix des actifs */}
          <ConfigSection
            title="Prix des actifs"
            description="Plages de prix XAF utilisées pour générer les opportunités."
            icon={<Coins className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="USDT/XAF — prix minimum">
                <NumberField
                  value={form.usdtPriceLow}
                  onChange={(v) =>
                    set("usdtPriceLow", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={10}
                  suffix="XAF"
                />
              </FormField>
              <FormField label="USDT/XAF — prix maximum">
                <NumberField
                  value={form.usdtPriceHigh}
                  onChange={(v) =>
                    set("usdtPriceHigh", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={10}
                  suffix="XAF"
                />
              </FormField>
              <FormField label="BTC/XAF — prix minimum">
                <NumberField
                  value={form.btcPriceLow}
                  onChange={(v) =>
                    set("btcPriceLow", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={100000}
                  suffix="XAF"
                  large
                />
              </FormField>
              <FormField label="BTC/XAF — prix maximum">
                <NumberField
                  value={form.btcPriceHigh}
                  onChange={(v) =>
                    set("btcPriceHigh", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={100000}
                  suffix="XAF"
                  large
                />
              </FormField>
              <FormField label="USDC/XAF — prix minimum">
                <NumberField
                  value={form.usdcPriceLow}
                  onChange={(v) =>
                    set("usdcPriceLow", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={10}
                  suffix="XAF"
                />
              </FormField>
              <FormField label="USDC/XAF — prix maximum">
                <NumberField
                  value={form.usdcPriceHigh}
                  onChange={(v) =>
                    set("usdcPriceHigh", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={10}
                  suffix="XAF"
                />
              </FormField>
              <FormField label="ETH/XAF — prix minimum">
                <NumberField
                  value={form.ethPriceLow}
                  onChange={(v) =>
                    set("ethPriceLow", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={50000}
                  suffix="XAF"
                  large
                />
              </FormField>
              <FormField label="ETH/XAF — prix maximum">
                <NumberField
                  value={form.ethPriceHigh}
                  onChange={(v) =>
                    set("ethPriceHigh", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={50000}
                  suffix="XAF"
                  large
                />
              </FormField>
              <FormField label="TRX/XAF — prix minimum">
                <NumberField
                  value={form.trxPriceLow}
                  onChange={(v) =>
                    set("trxPriceLow", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={1}
                  suffix="XAF"
                />
              </FormField>
              <FormField label="TRX/XAF — prix maximum">
                <NumberField
                  value={form.trxPriceHigh}
                  onChange={(v) =>
                    set("trxPriceHigh", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={1}
                  suffix="XAF"
                />
              </FormField>
              <FormField label="SOL/XAF — prix minimum">
                <NumberField
                  value={form.solPriceLow}
                  onChange={(v) =>
                    set("solPriceLow", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={5000}
                  suffix="XAF"
                  large
                />
              </FormField>
              <FormField label="SOL/XAF — prix maximum">
                <NumberField
                  value={form.solPriceHigh}
                  onChange={(v) =>
                    set("solPriceHigh", Math.max(0, Math.round(v)))
                  }
                  min={0}
                  step={5000}
                  suffix="XAF"
                  large
                />
              </FormField>
            </div>
          </ConfigSection>

          {/* 5. Marchés & paires */}
          <ConfigSection
            title="Marchés & paires"
            description="Marchés et paires surveillés par le générateur d'opportunités."
            icon={<Layers className="w-5 h-5" />}
          >
            <FormField label="Marchés activés">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_MARKETS.map((m) => {
                  const checked = form.markets.includes(m);
                  return (
                    <label
                      key={m}
                      className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 cursor-pointer hover:bg-muted/60 transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleMarket(m)}
                      />
                      <span className="text-sm font-medium select-none">
                        {m}
                      </span>
                    </label>
                  );
                })}
              </div>
            </FormField>
            <FormField label="Paires activées">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_PAIRS.map((p) => {
                  const checked = form.pairs.includes(p);
                  return (
                    <label
                      key={p}
                      className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 cursor-pointer hover:bg-muted/60 transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePair(p)}
                      />
                      <span className="text-sm font-medium select-none">
                        {p}
                      </span>
                    </label>
                  );
                })}
              </div>
            </FormField>
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">
                    Opportunité type
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Générée d'après la config actuelle.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSeed((s) => s + 1)}
                title="Régénérer"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {sample && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className="rounded-full px-2.5 py-0.5"
                    >
                      {sample.market}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      expire à{" "}
                      {sample.expiresAt.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-lg font-bold">
                      {sample.pair}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      @ {formatXAF(sample.price)} XAF
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Gain estimé
                      </p>
                      <p className="text-xl font-display font-bold text-primary tabular-nums">
                        +{formatXAF(sample.gain)} XAF
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Spread
                      </p>
                      <p className="text-sm font-semibold tabular-nums">
                        {(sample.spread * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>

                <PreviewStat
                  icon={<Clock className="w-4 h-4" />}
                  label="Validité"
                  value={`${Math.round(sample.validMin)} min`}
                />
                <PreviewStat
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Capital de référence"
                  value={`${formatXAF(form.referenceCapital)} XAF`}
                />
                <PreviewStat
                  icon={<Repeat className="w-4 h-4" />}
                  label="Intervalle de génération"
                  value={`${form.generationIntervalSec}s`}
                />
                <PreviewStat
                  icon={<Layers className="w-4 h-4" />}
                  label="Marchés / paires actives"
                  value={`${form.markets.length} / ${form.pairs.length}`}
                />
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
        saveLabel="Enregistrer les opportunités"
      />
    </div>
  );
}

function PreviewStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted/60 text-muted-foreground flex items-center justify-center shrink-0">
        {icon}
      </div>
      <p className="text-xs text-muted-foreground flex-1">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-right">{value}</p>
    </div>
  );
}
