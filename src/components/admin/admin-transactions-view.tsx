"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Crown,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatXAF,
  formatDateTime,
  formatPhoneDisplay,
} from "@/lib/utils";
import { toast } from "sonner";
import { SUBSCRIPTION_PLANS } from "@/lib/plans";
import type {
  AdminTransaction,
  TransactionType,
  MobileOperator,
} from "@/lib/types";

// === Types locaux ===

type TypeFilter = "all" | TransactionType;
type DatePreset = "today" | "7d" | "30d" | "all";

interface TxResponse {
  ok: boolean;
  transactions?: AdminTransaction[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
}

const PAGE_SIZE = 50;

// === Helpers ===

function planName(planId: string | null): string | null {
  if (!planId) return null;
  const p = SUBSCRIPTION_PLANS.find((x) => x.id === planId);
  return p ? p.name : planId;
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportCSV(transactions: AdminTransaction[]) {
  const headers = [
    "Date",
    "Utilisateur",
    "Nom",
    "Type",
    "Montant",
    "Solde apres",
    "Description",
    "Operateur",
    "Plan",
  ];
  const rows = transactions.map((t) => [
    escapeCSV(new Date(t.createdAt).toLocaleString("fr-FR")),
    escapeCSV(t.userPhone),
    escapeCSV(t.userName || ""),
    escapeCSV(typeLabel(t.type)),
    escapeCSV(t.amount),
    escapeCSV(t.balanceAfter),
    escapeCSV(t.description),
    escapeCSV(t.operator ? operatorLabel(t.operator) : ""),
    escapeCSV(t.planId ? planName(t.planId) : ""),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function typeLabel(type: TransactionType): string {
  switch (type) {
    case "deposit":
      return "Dépôt";
    case "withdraw":
      return "Retrait";
    case "gain":
      return "Gain";
    case "subscription":
      return "Abonnement";
  }
}

function operatorLabel(op: MobileOperator): string {
  return op === "mtn" ? "MTN" : "Orange";
}

function operatorEmoji(op: MobileOperator): string {
  return op === "mtn" ? "🟡" : "🟠";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateInputValue(d: Date): string {
  // YYYY-MM-DD for <input type="date">
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// === Badges ===

function TypeBadge({ type }: { type: TransactionType }) {
  const styles: Record<TransactionType, string> = {
    gain: "bg-primary/10 text-primary border-primary/20",
    deposit: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    withdraw: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    subscription: "bg-accent/40 text-accent-foreground border-accent/60",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[type]}`}
    >
      {typeLabel(type)}
    </span>
  );
}

function OperatorBadge({ op }: { op: MobileOperator | null }) {
  if (!op) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-muted/50 text-foreground border-border/60">
      <span>{operatorEmoji(op)}</span>
      {operatorLabel(op)}
    </span>
  );
}

type SubscriptionPlanIdLike = string | null;

function PlanBadge({ planId }: { planId: SubscriptionPlanIdLike }) {
  const name = planName(planId);
  if (!name) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-accent/40 text-accent-foreground border-accent/60">
      <Crown className="w-3 h-3" />
      {name}
    </span>
  );
}

// === Composant principal ===

export function AdminTransactionsView() {
  // Filtres
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Data
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Quand l'utilisateur sélectionne un preset, on réinitialise les dates custom
  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Quand l'utilisateur choisit une date custom, on désactive le preset
  const onCustomStart = (v: string) => {
    setStartDate(v);
    setDatePreset("all");
    setPage(1);
  };
  const onCustomEnd = (v: string) => {
    setEndDate(v);
    setDatePreset("all");
    setPage(1);
  };

  // Calcul des dates selon le preset
  const computeDateRange = useCallback(():
    | { start: string; end: string }
    | null => {
    if (startDate || endDate) {
      const end = endDate ? new Date(endDate + "T23:59:59") : new Date();
      const start = startDate
        ? new Date(startDate + "T00:00:00")
        : new Date(0);
      return {
        start: start.toISOString(),
        end: end.toISOString(),
      };
    }
    const now = new Date();
    if (datePreset === "today") {
      const s = startOfDay(now);
      const e = new Date(now);
      e.setHours(23, 59, 59, 999);
      return { start: s.toISOString(), end: e.toISOString() };
    }
    if (datePreset === "7d") {
      const s = new Date(now);
      s.setDate(s.getDate() - 7);
      return { start: s.toISOString(), end: now.toISOString() };
    }
    if (datePreset === "30d") {
      const s = new Date(now);
      s.setDate(s.getDate() - 30);
      return { start: s.toISOString(), end: now.toISOString() };
    }
    return null; // "all"
  }, [datePreset, startDate, endDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const range = computeDateRange();
      if (range) {
        params.set("startDate", range.start);
        params.set("endDate", range.end);
      }

      const res = await fetch(`/api/admin/transactions?${params.toString()}`);
      const json: TxResponse = await res.json();
      if (json.ok) {
        setTransactions(json.transactions ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      } else {
        toast.error(json.error || "Erreur lors du chargement.");
        setTransactions([]);
      }
    } catch {
      toast.error("Problème de connexion au serveur.");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, computeDateRange]);

  useEffect(() => {
    load();
  }, [load]);

  // Calcul des totaux à partir des transactions chargées (page courante)
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === "deposit") acc.deposits += t.amount;
      else if (t.type === "withdraw")
        acc.withdrawals += Math.abs(t.amount);
      else if (t.type === "gain") acc.gains += t.amount;
      else if (t.type === "subscription") acc.subscriptions += t.amount;
      acc.volume += Math.abs(t.amount);
      return acc;
    },
    {
      deposits: 0,
      withdrawals: 0,
      gains: 0,
      subscriptions: 0,
      volume: 0,
    }
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      // Récupère toutes les transactions correspondant aux filtres actuels
      // (sans pagination) pour un export complet.
      let allTx: AdminTransaction[] = [];

      // Si on a déjà moins d'une page, exporter directement la page courante
      if (totalPages <= 1) {
        allTx = [...transactions];
      } else {
        const params = new URLSearchParams({
          page: "1",
          limit: String(Math.min(total, 10000)),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (typeFilter !== "all") params.set("type", typeFilter);
        const range = computeDateRange();
        if (range) {
          params.set("startDate", range.start);
          params.set("endDate", range.end);
        }
        const res = await fetch(
          `/api/admin/transactions?${params.toString()}`
        );
        const json: TxResponse = await res.json();
        if (json.ok && json.transactions) {
          allTx = json.transactions;
        } else {
          toast.error("Impossible de récupérer les transactions pour l'export.");
          return;
        }
      }

      if (allTx.length === 0) {
        toast.error("Aucune transaction à exporter.");
        return;
      }

      exportCSV(allTx);
      toast.success(`${allTx.length} transactions exportées.`, {
        description: "Fichier CSV téléchargé.",
      });
    } catch {
      toast.error("Échec de l'export CSV.");
    } finally {
      setExporting(false);
    }
  };

  const visiblePages = buildVisiblePages(page, totalPages);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-soft">
            <Receipt className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Transactions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Surveillance en temps réel de toutes les opérations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border/60 shadow-soft">
            <Receipt className="w-3.5 h-3.5 text-primary" />
            <span className="font-display font-bold text-sm tabular-nums">
              {total}
            </span>
            <span className="text-xs text-muted-foreground">
              {total > 1 ? "opérations" : "opération"}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/30 border border-accent/60 shadow-soft">
            <TrendingUp className="w-3.5 h-3.5 text-accent-foreground" />
            <span className="font-display font-bold text-sm tabular-nums">
              {formatXAF(totals.volume)}
            </span>
            <span className="text-xs text-muted-foreground">XAF volume</span>
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting || loading || transactions.length === 0}
            variant="outline"
            className="h-9 rounded-xl bg-card border-border/60"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Export...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-1.5" />
                Exporter CSV
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <SummaryCard
          label="Total dépôts"
          value={formatXAF(totals.deposits)}
          unit="XAF"
          color="oklch(0.45 0.1 155)"
          bg="oklch(0.95 0.02 130)"
          icon={ArrowDownToLine}
        />
        <SummaryCard
          label="Total retraits"
          value={formatXAF(totals.withdrawals)}
          unit="XAF"
          color="oklch(0.55 0.18 35)"
          bg="oklch(0.95 0.04 40)"
          icon={ArrowUpFromLine}
        />
        <SummaryCard
          label="Total gains"
          value={formatXAF(totals.gains)}
          unit="XAF"
          color="oklch(0.45 0.1 155)"
          bg="oklch(0.95 0.02 130)"
          icon={TrendingUp}
        />
        <SummaryCard
          label="Revenu abonnements"
          value={formatXAF(totals.subscriptions)}
          unit="XAF"
          color="oklch(0.6 0.13 85)"
          bg="oklch(0.95 0.04 90)"
          icon={Crown}
        />
      </div>

      {/* Filters bar (sticky) */}
      <div className="sticky top-0 z-30 -mx-2 sm:-mx-4 px-2 sm:px-4 py-3 bg-background/85 backdrop-blur-md border-b border-border/40 space-y-2">
        {/* Type filter (segmented) + Date presets */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex gap-1 p-1 rounded-xl bg-card border border-border/60 overflow-x-auto no-scrollbar">
            {(
              [
                { v: "all" as const, label: "Tous" },
                { v: "deposit" as const, label: "Dépôts" },
                { v: "withdraw" as const, label: "Retraits" },
                { v: "gain" as const, label: "Gains" },
                { v: "subscription" as const, label: "Abonnements" },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => {
                  setTypeFilter(opt.v);
                  setPage(1);
                }}
                className={`shrink-0 h-8 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  typeFilter === opt.v
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1 p-1 rounded-xl bg-card border border-border/60 overflow-x-auto no-scrollbar">
            {(
              [
                { v: "today" as const, label: "Aujourd'hui" },
                { v: "7d" as const, label: "7 jours" },
                { v: "30d" as const, label: "30 jours" },
                { v: "all" as const, label: "Tout" },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => applyPreset(opt.v)}
                className={`shrink-0 h-8 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  datePreset === opt.v && !startDate && !endDate
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + custom date range */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="tel"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par téléphone (ex: 699123456)..."
              className="pl-9 h-10 rounded-xl bg-card border-border/60"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Effacer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onCustomStart(e.target.value)}
              className="h-10 rounded-xl bg-card border-border/60 w-[150px]"
              aria-label="Date de début"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onCustomEnd(e.target.value)}
              className="h-10 rounded-xl bg-card border-border/60 w-[150px]"
              aria-label="Date de fin"
            />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <TxTableSkeleton />
      ) : transactions.length === 0 ? (
        <EmptyState
          title="Aucune transaction trouvée"
          description="Essayez d'ajuster vos filtres ou votre recherche."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-2xl bg-card border border-border/60 shadow-soft overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4 text-xs uppercase tracking-wide text-muted-foreground">
                    Date / Heure
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Utilisateur
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                    Montant
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                    Solde après
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Description
                  </TableHead>
                  <TableHead className="pr-4 text-xs uppercase tracking-wide text-muted-foreground">
                    Opérateur / Plan
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t, i) => (
                  <TableRow key={t.id} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                    <TableCell className="pl-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatDateTime(t.createdAt)}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground tabular-nums">
                          {formatPhoneDisplay(t.userPhone)}
                        </span>
                        {t.userName && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                            {t.userName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <TypeBadge type={t.type} />
                    </TableCell>
                    <TableCell
                      className={`py-2.5 text-right font-display font-semibold tabular-nums ${
                        t.amount > 0 ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {t.amount > 0 ? "+" : ""}
                      {formatXAF(t.amount)}
                      <span className="text-[10px] text-muted-foreground ml-1 font-normal">
                        XAF
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-right tabular-nums text-foreground text-sm">
                      {formatXAF(t.balanceAfter)}
                    </TableCell>
                    <TableCell className="py-2.5 max-w-[240px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-foreground truncate block cursor-help">
                              {t.description}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{t.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="pr-4 py-2.5">
                      {t.type === "subscription" ? (
                        <PlanBadge planId={t.planId} />
                      ) : (
                        <OperatorBadge op={t.operator} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            {transactions.map((t) => (
              <TxCard key={t.id} tx={t} />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {!loading && transactions.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          visiblePages={visiblePages}
          onPage={setPage}
          total={total}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}

// === Sous-composants ===

function SummaryCard({
  label,
  value,
  unit,
  color,
  bg,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  bg: string;
  icon: React.ElementType;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl bg-card border border-border/60 p-3 shadow-soft"
    >
      <div className="flex items-center justify-between">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: bg }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">
          {label}
        </span>
      </div>
      <div className="font-display font-bold text-base mt-2 tabular-nums">
        {value}
        <span className="text-[10px] text-muted-foreground ml-1 font-normal">
          {unit}
        </span>
      </div>
    </motion.div>
  );
}

function TxCard({ tx }: { tx: AdminTransaction }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card border border-border/60 shadow-soft p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TypeBadge type={tx.type} />
          <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
            {formatDateTime(tx.createdAt)}
          </span>
        </div>
        <div
          className={`font-display font-bold text-sm tabular-nums ${
            tx.amount > 0 ? "text-primary" : "text-foreground"
          }`}
        >
          {tx.amount > 0 ? "+" : ""}
          {formatXAF(tx.amount)}
          <span className="text-[10px] text-muted-foreground ml-1 font-normal">
            XAF
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground tabular-nums truncate">
            {formatPhoneDisplay(tx.userPhone)}
          </div>
          {tx.userName && (
            <div className="text-[11px] text-muted-foreground truncate">
              {tx.userName}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground">Solde après</div>
          <div className="text-xs font-semibold tabular-nums">
            {formatXAF(tx.balanceAfter)} XAF
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] text-foreground line-clamp-1 flex-1 min-w-0">
          {tx.description}
        </span>
        {tx.type === "subscription" ? (
          <PlanBadge planId={tx.planId} />
        ) : (
          <OperatorBadge op={tx.operator} />
        )}
      </div>
    </motion.div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border/60 shadow-soft py-16 text-center">
      <div className="text-4xl mb-3">🔍</div>
      <p className="font-display font-bold text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}

function TxTableSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border/60 shadow-soft overflow-hidden">
      <div className="p-3 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-3 w-24" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function buildVisiblePages(page: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function Pagination({
  page,
  totalPages,
  visiblePages,
  onPage,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  visiblePages: number[];
  onPage: (p: number) => void;
  total: number;
  pageSize: number;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
      <p className="text-xs text-muted-foreground order-2 sm:order-1">
        Affichage de{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {from}
        </span>
        –
        <span className="font-semibold text-foreground tabular-nums">
          {to}
        </span>{" "}
        sur{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {total}
        </span>
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="h-8 w-8 p-0 rounded-lg"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {visiblePages.map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPage(p)}
            className={`h-8 w-8 p-0 rounded-lg tabular-nums ${
              p === page ? "shadow-soft" : ""
            }`}
          >
            {p}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="h-8 w-8 p-0 rounded-lg"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
          Page{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {page}
          </span>{" "}
          sur{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {totalPages}
          </span>
        </span>
      </div>
    </div>
  );
}
