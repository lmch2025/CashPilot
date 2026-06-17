"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Calendar,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCashPilotStore } from "@/lib/store";
import {
  formatXAF,
  formatDateTime,
  formatTime,
  isToday,
} from "@/lib/utils";
import type { Transaction, TransactionType } from "@/lib/types";

type Period = "today" | "week" | "month" | "all";
type FilterType = "all" | TransactionType;

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "all", label: "Tout" },
];

export function HistoryTab() {
  const userId = useCashPilotStore((s) => s.userId);
  const [period, setPeriod] = useState<Period>("today");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId,
        period,
        type: filterType,
      });
      const res = await fetch(`/api/transactions?${params}`);
      const json = await res.json();
      if (json.ok) {
        setTransactions(json.transactions);
      }
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, [userId, period, filterType]);

  useEffect(() => {
    load();
  }, [load]);

  // Calcul des totaux
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === "gain") acc.gains += t.amount;
      if (t.type === "deposit") acc.deposits += t.amount;
      if (t.type === "withdraw") acc.withdrawals += Math.abs(t.amount);
      return acc;
    },
    { gains: 0, deposits: 0, withdrawals: 0 }
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Historique</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toutes vos opérations, en toute transparence.
        </p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium transition-all ${
              period === p.value
                ? "bg-brand-gradient text-primary-foreground shadow-soft"
                : "bg-card border border-border/60 text-foreground hover:bg-muted/50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          label="Gains"
          value={formatXAF(totals.gains)}
          unit="XAF"
          color="oklch(0.45 0.1 155)"
          bg="oklch(0.95 0.02 130)"
          icon={TrendingUp}
        />
        <SummaryCard
          label="Dépôts"
          value={formatXAF(totals.deposits)}
          unit="XAF"
          color="oklch(0.6 0.13 85)"
          bg="oklch(0.95 0.03 90)"
          icon={ArrowDownToLine}
        />
        <SummaryCard
          label="Retraits"
          value={formatXAF(totals.withdrawals)}
          unit="XAF"
          color="oklch(0.5 0.02 150)"
          bg="oklch(0.95 0.01 140)"
          icon={ArrowUpFromLine}
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 text-sm">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Filtrer:</span>
        <div className="flex gap-1">
          {[
            { v: "all" as const, label: "Tout" },
            { v: "gain" as const, label: "Gains" },
            { v: "deposit" as const, label: "Dépôts" },
            { v: "withdraw" as const, label: "Retraits" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilterType(f.v)}
              className={`h-7 px-3 rounded-full text-xs font-medium transition-all ${
                filterType === f.v
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions list */}
      <div className="rounded-2xl bg-card border border-border/60 p-2 shadow-soft">
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm font-medium text-foreground">Aucune opération</p>
            <p className="text-xs text-muted-foreground mt-1">
              Aucune opération pour cette période.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            <AnimatePresence initial={false}>
              {transactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex items-center gap-3 p-3"
                >
                  <TransactionIcon type={tx.type} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {tx.type === "gain"
                        ? "Gain du robot"
                        : tx.type === "deposit"
                        ? "Dépôt Mobile Money"
                        : "Retrait Mobile Money"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isToday(tx.createdAt)
                        ? `Aujourd'hui à ${formatTime(tx.createdAt)}`
                        : formatDateTime(tx.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-display font-bold text-sm ${
                        tx.amount > 0
                          ? "text-[oklch(0.45_0.1_155)]"
                          : "text-foreground"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {formatXAF(tx.amount)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">XAF</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

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
      className="rounded-xl bg-card border border-border/60 p-3 shadow-soft"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
        style={{ background: bg }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
        {label}
      </div>
      <div className="font-display font-bold text-sm mt-0.5">
        {value}
        <span className="text-[10px] text-muted-foreground ml-1 font-normal">{unit}</span>
      </div>
    </motion.div>
  );
}

function TransactionIcon({ type }: { type: string }) {
  if (type === "gain") {
    return (
      <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
        <TrendingUp className="w-4 h-4 text-primary-foreground" />
      </div>
    );
  }
  if (type === "deposit") {
    return (
      <div className="w-10 h-10 rounded-full bg-[oklch(0.95_0.03_90)] flex items-center justify-center shrink-0">
        <ArrowDownToLine className="w-4 h-4 text-[oklch(0.6_0.13_85)]" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
      <ArrowUpFromLine className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}
