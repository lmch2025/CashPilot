"use client";

/**
 * Admin view — Scanner d'opportunités.
 *
 * 4 tabs:
 *   1. Détection     — live feed of detected arbitrage opportunities
 *                       (manual scan trigger, filters, approve/reject)
 *   2. Configuration — full AutomationConfig form (8 sections + sticky
 *                       save bar + confirmation dialog when leaving DRY-RUN)
 *   3. Données marché — latest fetched market prices (refresh)
 *   4. Logs          — scan history table with pagination
 *
 * Auto-refreshes the opportunities list every 30 seconds while the
 * Détection tab is active. All API failures are surfaced as toast errors
 * and the view stays usable (the backend is being built in parallel).
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Radar,
  Play,
  Check,
  X,
  RefreshCw,
  Settings,
  Database,
  ScrollText,
  Zap,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Loader2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Globe2,
  KeyRound,
  Timer,
  Coins,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatXAF, formatDateTime } from "@/lib/utils";
import {
  type AutomationConfig,
  DEFAULT_AUTOMATION_CONFIG,
} from "@/lib/config-defaults";
import {
  ConfigSection,
  FormField,
  ToggleField,
  NumberField,
  SliderField,
  ConfigActionBar,
  ConfigHeader,
} from "./config-primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================== Types ============================== */

type TabId = "detection" | "config" | "market" | "logs";
type AutomationLevel = "full_auto" | "semi_auto" | "manual";
type RiskLevel = "low" | "medium" | "high";
type OpportunityStatus = "pending" | "approved" | "rejected" | "expired";
type ScanTrigger = "cron" | "manual" | "admin";
type ScanStatus = "success" | "error" | "partial";

interface Opportunity {
  id: string;
  type: string;
  automationLevel: AutomationLevel;
  riskLevel: RiskLevel;
  status: OpportunityStatus;
  buyPlatform: string;
  buyPrice: number;
  sellPlatform: string;
  sellPrice: number;
  spreadPercent: number;
  estimatedGain: number;
  capitalRequired: number;
  validUntil: string;
  description?: string;
  raw?: unknown;
  createdAt: string;
}

interface ScanResult {
  ok: true;
  scannedAt: string;
  durationMs: number;
  platformsScanned: string[];
  opportunitiesFound: number;
  opportunities: Opportunity[];
}

interface ScanLog {
  id: string;
  createdAt: string;
  trigger: ScanTrigger;
  status: ScanStatus;
  platformsScanned: string[];
  opportunitiesFound: number;
  durationMs: number;
  errorMessage?: string;
}

interface MarketData {
  id: string;
  platform: string;
  pair: string;
  price: number;
  bid?: number;
  ask?: number;
  volume24h?: number;
  change24h?: number;
  lastUpdated: string;
}

interface LastScanInfo {
  scannedAt: string;
  opportunitiesFound: number;
}

/* ============================== Constants ============================== */

const TABS: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "detection", label: "Détection", icon: Radar },
  { id: "config", label: "Configuration", icon: Settings },
  { id: "market", label: "Données marché", icon: Database },
  { id: "logs", label: "Logs", icon: ScrollText },
];

const TYPE_LABELS: Record<string, string> = {
  p2p: "P2P",
  p2p_arbitrage: "P2P",
  inter_platform: "Inter-plateforme",
  triangular: "Triangulaire",
  basis: "Spot vs Futures",
  basis_trade: "Spot vs Futures",
  staking: "Staking",
  funding: "Funding rate",
  funding_rate: "Funding rate",
  prediction_internal: "Prédiction interne",
  prediction_inter: "Prédiction inter",
  p2p_lending: "Prêts P2P",
  sports_betting: "Paris sportifs",
};

const PLATFORMS: {
  key: keyof AutomationConfig["platforms"];
  label: string;
  icon: string;
}[] = [
  { key: "binance", label: "Binance", icon: "🟡" },
  { key: "bybit", label: "Bybit", icon: "🟠" },
  { key: "yellowcard", label: "Yellow Card", icon: "💛" },
  { key: "noones", label: "Noones", icon: "🔷" },
  { key: "polymarket", label: "Polymarket", icon: "🔮" },
  { key: "kalshi", label: "Kalshi", icon: "📊" },
  { key: "mintos", label: "Mintos", icon: "💰" },
  { key: "betfair", label: "Betfair", icon: "🏇" },
];

const ARBITRAGE_TYPES: {
  key: keyof AutomationConfig["arbitrageTypes"];
  label: string;
  description: string;
}[] = [
  {
    key: "p2pArbitrage",
    label: "Arbitrage P2P USDT/FCFA",
    description: "Achat USDT via P2P à bas prix, revente ailleurs (#1)",
  },
  {
    key: "interPlatform",
    label: "Arbitrage inter-plateforme",
    description: "Différence de prix USDT entre plateformes (#2)",
  },
  {
    key: "triangular",
    label: "Arbitrage triangulaire",
    description: "Cycle BTC → ETH → USDT sur une même plateforme (#3)",
  },
  {
    key: "basisTrade",
    label: "Spot vs Futures",
    description: "Écart entre prix spot et contrat futures (#4)",
  },
  {
    key: "staking",
    label: "Staking rate",
    description: "Différentiels de taux de staking (#5)",
  },
  {
    key: "fundingRate",
    label: "Funding rate",
    description: "Arbitrage du funding rate perpétuel (#8)",
  },
  {
    key: "predictionInternal",
    label: "Prédiction interne (Polymarket)",
    description: "Incohérences entre marchés Polymarket (#11)",
  },
  {
    key: "predictionInter",
    label: "Prédiction inter-plateforme",
    description: "Polymarket vs Kalshi sur même événement (#12)",
  },
  {
    key: "p2pLending",
    label: "Prêts P2P (Mintos)",
    description: "Différentiels de taux P2P lending (#13)",
  },
  {
    key: "sportsBetting",
    label: "Paris sportifs (Betfair)",
    description: "Arbitrage entre bookmakers (#14)",
  },
];

const STATUS_FILTERS: { v: OpportunityStatus | "all"; label: string }[] = [
  { v: "all", label: "Tous" },
  { v: "pending", label: "En attente" },
  { v: "approved", label: "Approuvées" },
  { v: "rejected", label: "Rejetées" },
  { v: "expired", label: "Expirées" },
];

const LEVEL_FILTERS: { v: AutomationLevel | "all"; label: string }[] = [
  { v: "all", label: "Tous niveaux" },
  { v: "full_auto", label: "Auto 100%" },
  { v: "semi_auto", label: "Semi-auto" },
  { v: "manual", label: "Manuel" },
];

const PAGE_SIZE = 20;

/* ============================== Helpers ============================== */

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

function formatRelativeFromNow(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "à l'instant";
  if (diff < 30_000) return "il y a quelques secondes";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

function formatCountdown(targetIso: string): { text: string; expired: boolean; urgent: boolean } {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return { text: "Expirée", expired: true, urgent: false };
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return { text: `${h}h ${String(m).padStart(2, "0")}m`, expired: false, urgent: false };
  }
  return {
    text: `${min}m ${String(sec).padStart(2, "0")}s`,
    expired: false,
    urgent: ms < 120_000,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function buildVisiblePages(current: number, total: number): number[] {
  if (total <= 1) return [1];
  const pages: number[] = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ============================== Badges ============================== */

function TypeBadge({ type }: { type: string }) {
  const label = typeLabel(type);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-primary/10 text-primary border-primary/20">
      <Zap className="w-3 h-3" />
      {label}
    </span>
  );
}

function AutomationBadge({ level }: { level: AutomationLevel }) {
  const map: Record<AutomationLevel, { label: string; cls: string; icon: ReactNode }> = {
    full_auto: {
      label: "Auto 100%",
      cls: "bg-primary/10 text-primary border-primary/20",
      icon: <Sparkles className="w-3 h-3" />,
    },
    semi_auto: {
      label: "Semi-auto",
      cls: "bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] border-[var(--brand-gold)]/40",
      icon: <Shield className="w-3 h-3" />,
    },
    manual: {
      label: "Manuel",
      cls: "bg-muted text-muted-foreground border-border/60",
      icon: <Eye className="w-3 h-3" />,
    },
  };
  const cfg = map[level] ?? map.manual;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, { label: string; cls: string }> = {
    low: { label: "Faible", cls: "bg-primary/10 text-primary border-primary/20" },
    medium: {
      label: "Moyen",
      cls: "bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] border-[var(--brand-gold)]/40",
    },
    high: { label: "Élevé", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const cfg = map[level] ?? map.medium;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}
    >
      <ShieldAlert className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: OpportunityStatus }) {
  const map: Record<OpportunityStatus, { label: string; cls: string }> = {
    pending: {
      label: "En attente",
      cls: "bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] border-[var(--brand-gold)]/40",
    },
    approved: { label: "Approuvée", cls: "bg-primary/10 text-primary border-primary/20" },
    rejected: { label: "Rejetée", cls: "bg-destructive/10 text-destructive border-destructive/20" },
    expired: { label: "Expirée", cls: "bg-muted text-muted-foreground border-border/60" },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

function ModeBadge({ dryRun }: { dryRun: boolean }) {
  return dryRun ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] border-[var(--brand-gold)]/40">
      <Shield className="w-3 h-3" />
      Dry-run
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-primary/15 text-primary border-primary/30">
      <Zap className="w-3 h-3" />
      Réel
    </span>
  );
}

function TriggerBadge({ trigger }: { trigger: ScanTrigger }) {
  const map: Record<ScanTrigger, { label: string; cls: string }> = {
    cron: { label: "Cron", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    manual: { label: "Manuel", cls: "bg-muted text-muted-foreground border-border/60" },
    admin: { label: "Admin", cls: "bg-primary/10 text-primary border-primary/20" },
  };
  const cfg = map[trigger] ?? map.manual;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

function ScanStatusBadge({ status }: { status: ScanStatus }) {
  const map: Record<ScanStatus, { label: string; cls: string }> = {
    success: { label: "Succès", cls: "bg-primary/10 text-primary border-primary/20" },
    partial: {
      label: "Partiel",
      cls: "bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] border-[var(--brand-gold)]/40",
    },
    error: { label: "Erreur", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const cfg = map[status] ?? map.error;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

/* ============================== Countdown timer (live) ============================== */

function CountdownTimer({ validUntil }: { validUntil: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => (n + 1) % 1_000_000), 1000);
    return () => clearInterval(t);
  }, []);
  const c = formatCountdown(validUntil);
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${
        c.expired
          ? "text-muted-foreground"
          : c.urgent
            ? "text-destructive"
            : "text-muted-foreground"
      }`}
    >
      <Clock className="w-3 h-3" />
      {c.text}
    </span>
  );
}

/* ============================== Segmented tab bar ============================== */

function TabBar({
  active,
  onChange,
  counts,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  counts?: Partial<Record<TabId, number>>;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-card border border-border/60 shadow-soft overflow-x-auto scroll-thin">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        const count = counts?.[tab.id];
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative h-9 px-3.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap inline-flex items-center gap-2 ${
              isActive
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {typeof count === "number" && count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================== Opportunity card ============================== */

function OpportunityCard({
  opp,
  dryRun,
  onAction,
  acting,
}: {
  opp: Opportunity;
  dryRun: boolean;
  onAction: (opp: Opportunity, action: "approve" | "reject") => void;
  acting?: string | null; // oppId currently being approved/rejected
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = opp.status === "pending";
  const isActing = acting === opp.id;

  let rawPreview: string | null = null;
  if (opp.raw != null) {
    try {
      rawPreview = JSON.stringify(opp.raw, null, 2);
    } catch {
      rawPreview = String(opp.raw);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-2xl bg-card border border-border/60 shadow-soft p-4 flex flex-col gap-3"
    >
      {/* Header row: badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={opp.type} />
        <AutomationBadge level={opp.automationLevel} />
        <RiskBadge level={opp.riskLevel} />
        <StatusBadge status={opp.status} />
        <ModeBadge dryRun={dryRun} />
      </div>

      {/* Buy/Sell details */}
      <div className="rounded-xl bg-muted/40 border border-border/40 p-3 space-y-1.5">
        <div className="flex items-start gap-2 text-sm">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-0.5 w-12 shrink-0">
            Achat
          </span>
          <span className="font-medium">{opp.buyPlatform}</span>
          <span className="ml-auto font-mono tabular-nums text-sm">
            {formatXAF(opp.buyPrice)} XAF
          </span>
        </div>
        <div className="flex items-center gap-2 pl-12 text-muted-foreground">
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-start gap-2 text-sm">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-0.5 w-12 shrink-0">
            Vente
          </span>
          <span className="font-medium">{opp.sellPlatform}</span>
          <span className="ml-auto font-mono tabular-nums text-sm">
            {formatXAF(opp.sellPrice)} XAF
          </span>
        </div>
      </div>

      {/* Spread / Gain */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Spread</p>
          <p className="text-base font-bold font-mono tabular-nums text-primary">
            +{opp.spreadPercent.toFixed(2)}%
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Gain estimé
          </p>
          <p className="text-base font-bold font-mono tabular-nums text-primary">
            +{formatXAF(opp.estimatedGain)} XAF
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Coins className="w-3 h-3" />
          Capital : {formatXAF(opp.capitalRequired)} XAF
        </span>
        <CountdownTimer validUntil={opp.validUntil} />
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatRelativeFromNow(opp.createdAt)}
        </span>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
        {expanded ? "Masquer les détails" : "Voir les détails"}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {opp.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {opp.description}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Capital requis
                </p>
                <p className="text-sm font-mono tabular-nums">
                  {formatXAF(opp.capitalRequired)} XAF
                </p>
              </div>
              {rawPreview && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Données brutes
                  </p>
                  <pre className="text-[10px] font-mono bg-muted/40 border border-border/40 rounded-lg p-2.5 overflow-x-auto scroll-thin max-h-48">
                    {rawPreview}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action row */}
      {isPending && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onAction(opp, "approve")}
            disabled={isActing}
            className="flex-1 gap-1.5 bg-primary hover:bg-primary/90"
          >
            {isActing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Approuver
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(opp, "reject")}
            disabled={isActing}
            className="flex-1 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-3.5 h-3.5" />
            Rejeter
          </Button>
        </div>
      )}
    </motion.div>
  );
}

/* ============================== Detection tab ============================== */

function DetectionTab({
  dryRun,
  configVersion,
}: {
  dryRun: boolean;
  configVersion: number; // bump after save to force re-fetch
}) {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | "all">("pending");
  const [levelFilter, setLevelFilter] = useState<AutomationLevel | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<LastScanInfo | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const loadOpps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await fetch(
        `/api/admin/scanner/opportunities?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.ok) {
        setOpps(json.opportunities ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      } else {
        // Graceful: API not yet built — keep empty state
        setOpps([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch {
      setOpps([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, levelFilter, typeFilter, configVersion]);

  useEffect(() => {
    loadOpps();
  }, [loadOpps]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => {
      loadOpps();
    }, 30_000);
    return () => clearInterval(t);
  }, [loadOpps]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/scanner/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual" }),
      });
      const json: ScanResult | { ok: false; error?: string } = await res.json();
      if (json.ok) {
        const r = json as ScanResult;
        setLastScan({
          scannedAt: r.scannedAt,
          opportunitiesFound: r.opportunitiesFound,
        });
        toast.success("Scan terminé", {
          description: `${r.opportunitiesFound} opportunité${
            r.opportunitiesFound > 1 ? "s" : ""
          } détectée${r.opportunitiesFound > 1 ? "s" : ""} en ${formatDuration(
            r.durationMs
          )}.`,
        });
        // Reset to first page + reload
        setPage(1);
        // Force reload
        setTimeout(() => loadOpps(), 100);
      } else {
        const err = json as { ok: false; error?: string };
        toast.error(err.error || "Échec du scan");
      }
    } catch {
      toast.error("Problème de connexion au scanner");
    } finally {
      setScanning(false);
    }
  };

  const handleAction = async (opp: Opportunity, action: "approve" | "reject") => {
    setActing(opp.id);
    try {
      const res = await fetch(`/api/admin/scanner/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success(
          action === "approve" ? "Opportunité approuvée" : "Opportunité rejetée",
          {
            description: `${opp.buyPlatform} → ${opp.sellPlatform} (+${opp.spreadPercent.toFixed(
              2
            )}%)`,
          }
        );
        // Optimistic local update + reload
        setOpps((prev) =>
          prev.map((o) =>
            o.id === opp.id
              ? {
                  ...o,
                  status: action === "approve" ? "approved" : "rejected",
                }
              : o
          )
        );
        setTimeout(() => loadOpps(), 200);
      } else {
        toast.error(json.error || "Échec de l'action");
      }
    } catch {
      toast.error("Problème de connexion");
    } finally {
      setActing(null);
    }
  };

  const visiblePages = buildVisiblePages(page, totalPages);

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={handleScan}
            disabled={scanning}
            className="gap-2 bg-brand-gradient hover:opacity-95"
            size="lg"
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {scanning ? "Scan en cours..." : "Scanner maintenant"}
          </Button>
          <div className="text-xs text-muted-foreground leading-tight">
            {lastScan ? (
              <>
                <span className="font-medium text-foreground/80">
                  Dernier scan : {formatRelativeFromNow(lastScan.scannedAt)}
                </span>
                <br />
                <span>
                  {lastScan.opportunitiesFound} opportunité
                  {lastScan.opportunitiesFound > 1 ? "s" : ""} trouvée
                  {lastScan.opportunitiesFound > 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <span>Aucun scan récent — lancez le scanner pour détecter des opportunités.</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <ModeBadge dryRun={dryRun} />
          <span className="text-muted-foreground">
            {dryRun
              ? "Simulation — aucun trade ne sera exécuté"
              : "Mode réel — les opportunités approuvées seront exécutées"}
          </span>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 rounded-xl bg-card border border-border/60">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.v}
              onClick={() => {
                setStatusFilter(opt.v);
                setPage(1);
              }}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                statusFilter === opt.v
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Select
          value={levelFilter}
          onValueChange={(v) => {
            setLevelFilter(v as AutomationLevel | "all");
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-[140px] bg-card">
            <SelectValue placeholder="Niveau" />
          </SelectTrigger>
          <SelectContent>
            {LEVEL_FILTERS.map((opt) => (
              <SelectItem key={opt.v} value={opt.v}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-[180px] bg-card">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={loadOpps}
          disabled={loading}
          className="ml-auto gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Opportunities grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-3" />
          <p className="text-sm">Chargement des opportunités...</p>
        </div>
      ) : opps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
            <Radar className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-display font-bold text-lg text-foreground">
            Aucune opportunité détectée
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Lancez un scan pour détecter des opportunités d'arbitrage en temps réel.
          </p>
          <Button
            onClick={handleScan}
            disabled={scanning}
            className="mt-5 gap-2"
            size="sm"
          >
            {scanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Lancer un scan
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{total}</span> opportunité
              {total > 1 ? "s" : ""} — page {page} / {totalPages}
            </p>
          </div>
          <motion.div
            layout
            className="grid grid-cols-1 lg:grid-cols-2 gap-3"
          >
            <AnimatePresence mode="popLayout">
              {opps.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opp={opp}
                  dryRun={dryRun}
                  onAction={handleAction}
                  acting={acting}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {visiblePages.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-8 min-w-8 px-2 rounded-md text-xs font-medium tabular-nums transition-all ${
                    p === page
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================== Configuration tab ============================== */

function ConfigTab({
  onSaved,
}: {
  onSaved: (cfg: AutomationConfig) => void;
}) {
  const [saved, setSaved] = useState<AutomationConfig | null>(null);
  const [form, setForm] = useState<AutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReal, setConfirmReal] = useState(false);
  const [pendingDryRun, setPendingDryRun] = useState<boolean | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scanner/config", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        const cfg = json.config as AutomationConfig;
        setSaved(cfg);
        setForm(cfg);
      } else {
        // Fall back to defaults so the form is still usable while backend is built
        setSaved({ ...DEFAULT_AUTOMATION_CONFIG });
        setForm({ ...DEFAULT_AUTOMATION_CONFIG });
      }
    } catch {
      setSaved({ ...DEFAULT_AUTOMATION_CONFIG });
      setForm({ ...DEFAULT_AUTOMATION_CONFIG });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mb-3" />
        <p className="text-sm">Chargement de la configuration...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-destructive mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={loadConfig}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (!form || !saved) return null;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const set = <K extends keyof AutomationConfig>(
    key: K,
    value: AutomationConfig[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const setPlatform = (key: keyof AutomationConfig["platforms"], value: boolean) => {
    setForm((prev) =>
      prev ? { ...prev, platforms: { ...prev.platforms, [key]: value } } : prev
    );
  };

  const setArb = (
    key: keyof AutomationConfig["arbitrageTypes"],
    value: boolean
  ) => {
    setForm((prev) =>
      prev
        ? { ...prev, arbitrageTypes: { ...prev.arbitrageTypes, [key]: value } }
        : prev
    );
  };

  const handleDryRunChange = (nextDryRun: boolean) => {
    // Going from dry-run=true → false (entering RÉEL mode) requires confirmation
    if (!nextDryRun && form.dryRun) {
      setPendingDryRun(false);
      setConfirmReal(true);
      return;
    }
    set("dryRun", nextDryRun);
  };

  const confirmRealMode = () => {
    setConfirmReal(false);
    if (pendingDryRun !== null) {
      set("dryRun", pendingDryRun);
      setPendingDryRun(null);
      toast.info("Mode réel activé — les opportunités approuvées seront exécutées.");
    }
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/scanner/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: form }),
      });
      const json = await res.json();
      if (json.ok) {
        const cfg = json.config as AutomationConfig;
        setSaved(cfg);
        setForm(cfg);
        onSaved(cfg);
        toast.success("Configuration du scanner enregistrée");
      } else {
        toast.error(json.error || "Erreur d'enregistrement");
      }
    } catch {
      toast.error("Problème de connexion au serveur");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...saved });
    toast.info("Modifications annulées");
  };

  const handleCopyCronUrl = async () => {
    const url = buildCronUrl(form);
    const ok = await copyToClipboard(url);
    if (ok) toast.success("URL copiée", { description: url });
    else toast.error("Impossible de copier l'URL");
  };

  return (
    <div className="space-y-4">
      {/* Section 1: Mode de fonctionnement */}
      <ConfigSection
        title="Mode de fonctionnement"
        description="Contrôle principal du scanner et du mode de simulation."
        icon={<Zap className="w-5 h-5" />}
      >
        {/* Big prominent dry-run toggle */}
        <div
          className={`rounded-xl border p-4 transition-colors ${
            form.dryRun
              ? "border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/5"
              : "border-primary/30 bg-primary/5"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Shield
                  className={`w-4 h-4 ${
                    form.dryRun ? "text-[var(--brand-gold-dark)]" : "text-primary"
                  }`}
                />
                <p className="text-sm font-bold">
                  Mode simulation (DRY-RUN)
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {form.dryRun
                  ? "Le scanner détecte des opportunités mais aucun trade réel n'est exécuté. Les opportunités approuvées restent en simulation."
                  : "Mode réel — les opportunités approuvées seront exécutées avec votre capital."}
              </p>
            </div>
            <Switch
              checked={form.dryRun}
              onCheckedChange={handleDryRunChange}
              className="scale-125 origin-right"
            />
          </div>
        </div>

        <ToggleField
          label="Scanner activé"
          description="Active ou désactive le scanner automatique d'opportunités."
          checked={form.scannerEnabled}
          onCheckedChange={(v) => set("scannerEnabled", v)}
        />

        <FormField
          label="Intervalle de scan"
          description="Minutes entre deux scans automatiques (utilisé par cron-job.org)."
          hint="Ex : 5 = un scan toutes les 5 minutes."
        >
          <NumberField
            value={form.scanIntervalMin}
            onChange={(v) => set("scanIntervalMin", v)}
            min={1}
            max={1440}
            step={1}
            suffix="min"
            large
          />
        </FormField>
      </ConfigSection>

      {/* Section 2: Plateformes surveillées */}
      <ConfigSection
        title="Plateformes surveillées"
        description="Activez les plateformes que le scanner doit interroger."
        icon={<Globe2 className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PLATFORMS.map((p) => (
            <div
              key={p.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 p-3.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg leading-none">{p.icon}</span>
                <span className="text-sm font-medium truncate">{p.label}</span>
              </div>
              <Switch
                checked={form.platforms[p.key]}
                onCheckedChange={(v) => setPlatform(p.key, v)}
              />
            </div>
          ))}
        </div>
      </ConfigSection>

      {/* Section 3: Types d'arbitrage */}
      <ConfigSection
        title="Types d'arbitrage"
        description="Sélectionnez les stratégies que le scanner doit rechercher."
        icon={<Radar className="w-5 h-5" />}
      >
        <div className="space-y-2.5">
          {ARBITRAGE_TYPES.map((t) => (
            <div
              key={t.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.description}
                </p>
              </div>
              <Switch
                checked={form.arbitrageTypes[t.key]}
                onCheckedChange={(v) => setArb(t.key, v)}
              />
            </div>
          ))}
        </div>
      </ConfigSection>

      {/* Section 4: Seuils de détection */}
      <ConfigSection
        title="Seuils de détection"
        description="Filtrez les opportunités selon le spread, le gain et le risque."
        icon={<Activity className="w-5 h-5" />}
      >
        <SliderField
          label="Spread minimum"
          description="Écart minimum entre prix d'achat et de vente pour déclencher une détection."
          value={form.minSpreadPercent}
          onChange={(v) => set("minSpreadPercent", v)}
          min={0}
          max={10}
          step={0.1}
          suffix="%"
          formatLabel={(v) => `${v.toFixed(1)}%`}
        />

        <FormField
          label="Gain minimum"
          description="Gain estimé minimum en XAF pour qu'une opportunité soit conservée."
        >
          <NumberField
            value={form.minEstimatedGain}
            onChange={(v) => set("minEstimatedGain", v)}
            min={0}
            step={50}
            suffix="XAF"
            large
          />
        </FormField>

        <FormField
          label="Risque maximum"
          description="Niveau de risque maximum autorisé pour les opportunités détectées."
        >
          <Select
            value={form.maxRiskLevel}
            onValueChange={(v) => set("maxRiskLevel", v)}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Faible</SelectItem>
              <SelectItem value="medium">Moyen</SelectItem>
              <SelectItem value="high">Élevé</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label="Capital de référence"
          description="Capital utilisé pour calculer le gain estimé de chaque opportunité."
        >
          <NumberField
            value={form.capitalReference}
            onChange={(v) => set("capitalReference", v)}
            min={1000}
            step={1000}
            suffix="XAF"
            large
          />
        </FormField>
      </ConfigSection>

      {/* Section 5: Auto-approbation */}
      <ConfigSection
        title="Auto-approbation"
        description="Approuver automatiquement les opportunités faible risque, sans intervention manuelle."
        icon={<Sparkles className="w-5 h-5" />}
      >
        <ToggleField
          label="Auto-approuver les opportunités faible risque"
          description="Les opportunités 'low risk' seront automatiquement approuvées si leur spread dépasse le seuil ci-dessous."
          checked={form.autoApproveLowRisk}
          onCheckedChange={(v) => set("autoApproveLowRisk", v)}
        />

        <FormField
          label="Spread minimum pour auto-approbation"
          description="Seuil de spread que les opportunités faible risque doivent dépasser pour être auto-approuvées."
        >
          <NumberField
            value={form.autoApproveSpreadMin}
            onChange={(v) => set("autoApproveSpreadMin", v)}
            min={0}
            step={0.1}
            suffix="%"
          />
        </FormField>
      </ConfigSection>

      {/* Section 6: API Keys */}
      <ConfigSection
        title="Clés API"
        description="Clés privées pour accéder aux endpoints authentifiés. Laissez vide pour utiliser les endpoints publics."
        icon={<KeyRound className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Binance API Key">
            <Input
              type="password"
              value={form.binanceApiKey}
              onChange={(e) => set("binanceApiKey", e.target.value)}
              placeholder="Laissez vide pour endpoints publics"
              className="bg-background font-mono text-xs"
              autoComplete="off"
            />
          </FormField>
          <FormField label="Binance API Secret">
            <Input
              type="password"
              value={form.binanceApiSecret}
              onChange={(e) => set("binanceApiSecret", e.target.value)}
              placeholder="Laissez vide pour endpoints publics"
              className="bg-background font-mono text-xs"
              autoComplete="off"
            />
          </FormField>
          <FormField label="Bybit API Key">
            <Input
              type="password"
              value={form.bybitApiKey}
              onChange={(e) => set("bybitApiKey", e.target.value)}
              placeholder="Laissez vide pour endpoints publics"
              className="bg-background font-mono text-xs"
              autoComplete="off"
            />
          </FormField>
          <FormField label="Bybit API Secret">
            <Input
              type="password"
              value={form.bybitApiSecret}
              onChange={(e) => set("bybitApiSecret", e.target.value)}
              placeholder="Laissez vide pour endpoints publics"
              className="bg-background font-mono text-xs"
              autoComplete="off"
            />
          </FormField>
        </div>
      </ConfigSection>

      {/* Section 7: ScraperApi */}
      <ConfigSection
        title="ScraperApi — contournement géographique"
        description="ScraperApi permet de contourner les restrictions géographiques pour les plateformes comme Binance P2P."
        icon={<Globe2 className="w-5 h-5" />}
      >
        <FormField label="ScraperApi Key">
          <Input
            type="password"
            value={form.scraperApiKey}
            onChange={(e) => set("scraperApiKey", e.target.value)}
            placeholder="Votre clé ScraperApi"
            className="bg-background font-mono text-xs"
            autoComplete="off"
          />
        </FormField>

        <ToggleField
          label="Utiliser ScraperApi pour les plateformes géo-bloquées"
          description="Route les requêtes vers les plateformes géo-bloquées via ScraperApi."
          checked={form.useScraperForGeoblocked}
          onCheckedChange={(v) => set("useScraperForGeoblocked", v)}
        />
      </ConfigSection>

      {/* Section 8: cron-job.org */}
      <ConfigSection
        title="cron-job.org"
        description="Configurez le webhook cron-job.org pour exécuter le scanner automatiquement."
        icon={<Timer className="w-5 h-5" />}
      >
        <FormField
          label="URL du webhook"
          description="URL à configurer sur cron-job.org avec l'intervalle choisi."
        >
          <div className="flex gap-2">
            <Input
              readOnly
              value={buildCronUrl(form)}
              className="bg-muted/40 font-mono text-xs text-muted-foreground"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCronUrl}
              className="shrink-0 gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copier
            </Button>
          </div>
        </FormField>

        <FormField
          label="Clé secrète"
          description="Clé utilisée pour authentifier les appels cron entrants."
          hint="Cette clé est incluse dans l'URL du webhook ci-dessus."
        >
          <Input
            type="text"
            value={form.cronJobOrgKey}
            onChange={(e) => set("cronJobOrgKey", e.target.value)}
            placeholder="cashpilot-cron-secret-..."
            className="bg-background font-mono text-xs"
            autoComplete="off"
          />
        </FormField>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <p className="font-semibold mb-1">Instructions cron-job.org</p>
          <p>
            Configurez l'URL ci-dessus sur{" "}
            <a
              href="https://cron-job.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              cron-job.org
            </a>{" "}
            avec l'intervalle choisi (par défaut : toutes les{" "}
            <span className="font-mono">{form.scanIntervalMin}</span> minutes).
            Le scanner s'exécutera automatiquement à chaque appel.
          </p>
        </div>
      </ConfigSection>

      {/* Sticky save bar */}
      <ConfigActionBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        saveLabel="Enregistrer la configuration"
      />

      {/* Confirmation dialog for switching to RÉEL mode */}
      <AlertDialog open={confirmReal} onOpenChange={setConfirmReal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Passer en mode réel ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de désactiver le mode simulation (DRY-RUN).
              Les opportunités <strong>approuvées</strong> seront{" "}
              <strong>exécutées avec votre capital réel</strong> sur les
              plateformes configurées. Assurez-vous que les clés API et les
              seuils sont correctement configurés avant de continuer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingDryRun(null);
              }}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRealMode}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Confirmer le mode réel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function buildCronUrl(cfg: AutomationConfig): string {
  const base =
    cfg.cronJobOrgUrl && cfg.cronJobOrgUrl.length > 0
      ? cfg.cronJobOrgUrl
      : "https://cash-pilot-wheat.vercel.app/api/cron/scan";
  const sep = base.includes("?") ? "&" : "?";
  const key = cfg.cronJobOrgKey || "";
  return `${base}${sep}key=${encodeURIComponent(key)}`;
}

/* ============================== Market data tab ============================== */

function MarketDataTab() {
  const [data, setData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scanner/market-data", {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.ok) {
        setData(json.data ?? []);
      } else {
        setError(json.error || "Erreur de chargement");
        setData([]);
      }
    } catch {
      setError("Problème de connexion au serveur");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">Données marché en temps réel</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Derniers prix récupérés par le scanner sur les plateformes activées.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-3" />
          <p className="text-sm">Chargement des données marché...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-destructive mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Réessayer
          </Button>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
            <Database className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-display font-bold text-lg text-foreground">
            Aucune donnée marché disponible
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Lancez un scan pour récupérer les prix en temps réel depuis les
            plateformes activées.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((d) => {
            const changeUp = (d.change24h ?? 0) >= 0;
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="rounded-2xl bg-card border border-border/60 shadow-soft p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground truncate">
                      {d.platform}
                    </p>
                    <p className="font-display font-bold text-sm mt-0.5">{d.pair}</p>
                  </div>
                  {typeof d.change24h === "number" && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
                        changeUp ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {changeUp ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {changeUp ? "+" : ""}
                      {d.change24h!.toFixed(2)}%
                    </span>
                  )}
                </div>
                <motion.p
                  key={d.price}
                  initial={{ opacity: 0.6, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="mt-3 text-2xl font-bold font-mono tabular-nums"
                >
                  {formatXAF(d.price)}
                  <span className="text-xs font-medium text-muted-foreground ml-1.5">
                    XAF
                  </span>
                </motion.p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  {typeof d.bid === "number" && (
                    <div className="rounded-md border border-border/40 bg-background/50 px-2 py-1">
                      <p className="text-[9px] uppercase text-muted-foreground">Bid</p>
                      <p className="font-mono tabular-nums">{formatXAF(d.bid)}</p>
                    </div>
                  )}
                  {typeof d.ask === "number" && (
                    <div className="rounded-md border border-border/40 bg-background/50 px-2 py-1">
                      <p className="text-[9px] uppercase text-muted-foreground">Ask</p>
                      <p className="font-mono tabular-nums">{formatXAF(d.ask)}</p>
                    </div>
                  )}
                  {typeof d.volume24h === "number" && (
                    <div className="rounded-md border border-border/40 bg-background/50 px-2 py-1 col-span-2">
                      <p className="text-[9px] uppercase text-muted-foreground">
                        Volume 24h
                      </p>
                      <p className="font-mono tabular-nums">
                        {formatXAF(d.volume24h)} XAF
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatRelativeFromNow(d.lastUpdated)}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================== Logs tab ============================== */

function LogsTab() {
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/scanner/logs?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.ok) {
        setLogs(json.logs ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      } else {
        setLogs([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch {
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const visiblePages = buildVisiblePages(page, totalPages);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">Historique des scans</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tous les déclenchements du scanner (cron, manuel, admin).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-3" />
          <p className="text-sm">Chargement des logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
            <ScrollText className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-display font-bold text-lg text-foreground">
            Aucun log de scan
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Les scans effectués apparaîtront ici avec leur statut, durée et
            opportunités détectées.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-card border border-border/60 shadow-soft overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Date/heure
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Déclencheur
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Statut
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Plateformes
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">
                    Opp.
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">
                    Durée
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Erreur
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="text-xs">
                    <TableCell className="font-mono whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <TriggerBadge trigger={log.trigger} />
                    </TableCell>
                    <TableCell>
                      <ScanStatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.platformsScanned && log.platformsScanned.length > 0 ? (
                        <span className="inline-flex flex-wrap gap-1">
                          {log.platformsScanned.slice(0, 3).map((p, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px]"
                            >
                              {p}
                            </span>
                          ))}
                          {log.platformsScanned.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{log.platformsScanned.length - 3}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {log.opportunitiesFound}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {formatDuration(log.durationMs)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs">
                      {log.errorMessage ? (
                        <span className="text-destructive line-clamp-2">
                          {log.errorMessage}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{total}</span> logs — page {page} / {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {visiblePages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-8 min-w-8 px-2 rounded-md text-xs font-medium tabular-nums transition-all ${
                      p === page
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================== Main view ============================== */

export function AdminScannerView() {
  const [tab, setTab] = useState<TabId>("detection");
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [configVersion, setConfigVersion] = useState(0);

  // Try to fetch the current config on mount so the mode badge (Dry-run / Réel)
  // reflects the server-side state. If the backend isn't ready yet, fall back
  // to defaults — the badge will still display correctly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/scanner/config", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!cancelled && json.ok) {
          setConfig(json.config as AutomationConfig);
        } else if (!cancelled) {
          setConfig({ ...DEFAULT_AUTOMATION_CONFIG });
        }
      } catch {
        if (!cancelled) setConfig({ ...DEFAULT_AUTOMATION_CONFIG });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfigSaved = (cfg: AutomationConfig) => {
    setConfig(cfg);
    setConfigVersion((n) => n + 1);
  };

  const dryRun = config?.dryRun ?? DEFAULT_AUTOMATION_CONFIG.dryRun;

  return (
    <div className="space-y-5">
      <ConfigHeader
        icon={<Radar className="w-5 h-5" />}
        title="Scanner d'opportunités"
        subtitle="Détectez, approuvez et exécutez des opportunités d'arbitrage en temps réel."
      />

      {/* Mode badge summary */}
      {config && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3.5 py-2.5">
          <ModeBadge dryRun={dryRun} />
          <span className="text-xs text-muted-foreground">
            {dryRun
              ? "Mode simulation actif — aucun trade réel ne sera exécuté."
              : "Mode réel actif — les opportunités approuvées seront exécutées."}
          </span>
          {config.scannerEnabled ? (
            <span className="inline-flex items-center gap-1 ml-auto text-[11px] font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Scanner actif (toutes les {config.scanIntervalMin} min)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 ml-auto text-[11px] font-medium text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              Scanner désactivé
            </span>
          )}
        </div>
      )}

      <TabBar active={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {tab === "detection" && (
            <DetectionTab dryRun={dryRun} configVersion={configVersion} />
          )}
          {tab === "config" && <ConfigTab onSaved={handleConfigSaved} />}
          {tab === "market" && <MarketDataTab />}
          {tab === "logs" && <LogsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
