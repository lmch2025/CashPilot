"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Filter,
  Search,
  X,
  Download,
  ChevronRight,
  Info,
  Wallet,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCashPilotStore } from "@/lib/store";
import {
  formatXAF,
  formatDateTime,
  formatTime,
  isToday,
} from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import { toast } from "sonner";
import type { Transaction, TransactionType } from "@/lib/types";

type Period = "today" | "week" | "month" | "all";
type FilterType = "all" | TransactionType;
type ChartMetric = "gains" | "deposits" | "withdrawals" | "balance";

const PERIODS: { value: Period; labelKey: string }[] = [
  { value: "today", labelKey: "common.today" },
  { value: "week", labelKey: "common.week" },
  { value: "month", labelKey: "common.month" },
  { value: "all", labelKey: "common.all" },
];

const METRICS: { value: ChartMetric; labelKey: string; color: string }[] = [
  { value: "gains", labelKey: "history.chart.gains", color: "oklch(0.45 0.1 155)" },
  { value: "deposits", labelKey: "history.chart.deposits", color: "oklch(0.6 0.13 85)" },
  { value: "withdrawals", labelKey: "history.chart.withdrawals", color: "oklch(0.5 0.02 150)" },
  { value: "balance", labelKey: "history.chart.balance", color: "oklch(0.45 0.09 100)" },
];

export function HistoryTab() {
  const t = useT();
  const userId = useCashPilotStore((s) => s.userId);
  const [period, setPeriod] = useState<Period>("today");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("gains");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected transaction for detail modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

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

  // Debounced search: 300ms after last input
  useEffect(() => {
    const tm = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(tm);
  }, [searchInput]);

  // Filtered transactions based on search query
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter((tx) => {
      const desc = (tx.description ?? "").toLowerCase();
      const amountStr = String(tx.amount).toLowerCase();
      const formattedAmount = formatXAF(tx.amount).toLowerCase();
      const dateStr = formatDateTime(tx.createdAt).toLowerCase();
      const timeStr = formatTime(tx.createdAt).toLowerCase();
      return (
        desc.includes(q) ||
        amountStr.includes(q) ||
        formattedAmount.includes(q) ||
        dateStr.includes(q) ||
        timeStr.includes(q)
      );
    });
  }, [transactions, searchQuery]);

  // Calcul des totaux (sur les transactions filtrées par type, pas par search)
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === "gain") acc.gains += t.amount;
      if (t.type === "deposit") acc.deposits += t.amount;
      if (t.type === "withdraw") acc.withdrawals += Math.abs(t.amount);
      return acc;
    },
    { gains: 0, deposits: 0, withdrawals: 0 }
  );

  const handleResetFilters = () => {
    setFilterType("all");
    setSearchInput("");
    setSearchQuery("");
  };

  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) {
      toast.error(t("history.search.noResults", { query: searchQuery || "—" }));
      return;
    }
    const headers = ["Date", "Type", "Description", "Montant (XAF)", "Solde après (XAF)", "Operateur"];
    const rows = filteredTransactions.map((tx) => {
      const date = new Date(tx.createdAt).toLocaleString("fr-FR");
      const type = tx.type;
      const desc = (tx.description ?? "").replace(/"/g, '""');
      const amount = tx.amount;
      const balance = tx.balanceAfter;
      const operator = tx.operator ?? "";
      return [date, type, `"${desc}"`, amount, balance, operator].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `cashpilot-historique-${today}.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t("history.exported"));
  };

  // Period date range label
  const periodRange = useMemo(() => buildPeriodRange(period, transactions), [period, transactions]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">{t("history.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("history.subtitle")}
        </p>
      </div>

      {/* Period selector with date range */}
      <div className="space-y-1.5">
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
              {t(p.labelKey)}
            </button>
          ))}
        </div>
        {periodRange && (
          <div className="px-1 text-[11px] text-muted-foreground">
            {periodRange}
          </div>
        )}
      </div>

      {/* Gains chart */}
      <GainsChart
        transactions={transactions}
        metric={chartMetric}
        onMetricChange={setChartMetric}
      />

      {/* Summary cards (tappable) */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          label={t("history.summary.gains")}
          value={formatXAF(totals.gains)}
          unit="XAF"
          color="oklch(0.45 0.1 155)"
          bg="oklch(0.95 0.02 130)"
          icon={TrendingUp}
          selected={filterType === "gain"}
          onClick={() => setFilterType(filterType === "gain" ? "all" : "gain")}
        />
        <SummaryCard
          label={t("history.summary.deposits")}
          value={formatXAF(totals.deposits)}
          unit="XAF"
          color="oklch(0.6 0.13 85)"
          bg="oklch(0.95 0.03 90)"
          icon={ArrowDownToLine}
          selected={filterType === "deposit"}
          onClick={() => setFilterType(filterType === "deposit" ? "all" : "deposit")}
        />
        <SummaryCard
          label={t("history.summary.withdrawals")}
          value={formatXAF(totals.withdrawals)}
          unit="XAF"
          color="oklch(0.5 0.02 150)"
          bg="oklch(0.95 0.01 140)"
          icon={ArrowUpFromLine}
          selected={filterType === "withdraw"}
          onClick={() => setFilterType(filterType === "withdraw" ? "all" : "withdraw")}
        />
      </div>

      {/* Search bar + export */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("history.search.placeholder")}
            className="w-full h-10 pl-9 pr-9 rounded-xl bg-card border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/70"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
              }}
              aria-label={t("history.search.clear")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl shrink-0"
          onClick={handleExportCsv}
          aria-label={t("history.export")}
          title={t("history.export")}
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {[
              { v: "all" as const, label: t("history.filter.all") },
              { v: "gain" as const, label: t("history.filter.gains") },
              { v: "deposit" as const, label: t("history.filter.deposits") },
              { v: "withdraw" as const, label: t("history.filter.withdrawals") },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFilterType(f.v)}
                className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium transition-all ${
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
        {(filterType !== "all" || searchQuery) && (
          <button
            onClick={handleResetFilters}
            className="shrink-0 h-7 px-2.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            {t("history.resetFilters")}
          </button>
        )}
      </div>

      {/* Search results count */}
      <AnimatePresence>
        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-muted-foreground"
          >
            {filteredTransactions.length > 0
              ? t("history.search.results", {
                  count: filteredTransactions.length,
                  plural: filteredTransactions.length > 1 ? "s" : "",
                })
              : t("history.search.noResults", { query: searchQuery })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transactions list */}
      <div className="rounded-2xl bg-card border border-border/60 p-2 shadow-soft">
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm font-medium text-foreground">{t("history.empty.title")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery
                ? t("history.search.noResults", { query: searchQuery })
                : t("history.empty.desc")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            <AnimatePresence initial={false}>
              {filteredTransactions.map((tx, i) => (
                <motion.button
                  key={tx.id}
                  type="button"
                  onClick={() => setSelectedTx(tx)}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <TransactionIcon type={tx.type} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {tx.type === "gain"
                        ? t("history.tx.gain")
                        : tx.type === "deposit"
                        ? t("history.tx.deposit")
                        : tx.type === "withdraw"
                        ? t("history.tx.withdraw")
                        : t("history.tx.subscription", { plan: "" })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isToday(tx.createdAt)
                        ? t("history.todayAt", { time: formatTime(tx.createdAt) })
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
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <TransactionDetailModal
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Gains chart                                                             */
/* ----------------------------------------------------------------------- */

function GainsChart({
  transactions,
  metric,
  onMetricChange,
}: {
  transactions: Transaction[];
  metric: ChartMetric;
  onMetricChange: (m: ChartMetric) => void;
}) {
  const t = useT();

  // Build chart data: sorted by date asc, accumulate per metric
  const chartData = useMemo(() => {
    if (transactions.length === 0) return [];
    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    let acc = 0;
    return sorted.map((tx) => {
      let delta = 0;
      if (metric === "gains" && tx.type === "gain") delta = tx.amount;
      else if (metric === "deposits" && tx.type === "deposit") delta = tx.amount;
      else if (metric === "withdrawals" && tx.type === "withdraw")
        delta = Math.abs(tx.amount);
      acc += delta;
      const value =
        metric === "balance" ? tx.balanceAfter : acc;
      return {
        date: tx.createdAt,
        value,
        label: formatTime(tx.createdAt),
        fullDate: formatDateTime(tx.createdAt),
      };
    });
  }, [transactions, metric]);

  const activeMetric = METRICS.find((m) => m.value === metric)!;
  const chartColor = activeMetric.color;

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display font-semibold text-sm text-foreground">
          {t("history.chart.title")}
        </div>
      </div>

      {/* Metric toggle */}
      <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar -mx-1 px-1">
        {METRICS.map((m) => (
          <button
            key={m.value}
            onClick={() => onMetricChange(m.value)}
            className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium transition-all ${
              metric === m.value
                ? "text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
            style={
              metric === m.value
                ? { backgroundColor: m.color }
                : undefined
            }
          >
            {t(m.labelKey)}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length < 2 ? (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
          {t("history.chart.empty")}
        </div>
      ) : (
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={metric}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gainsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border/40"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={32}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    tickFormatter={(v: number) => formatXAF(v)}
                  />
                  <RechartsTooltip
                    cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: "3 3" }}
                    content={<CustomTooltip color={chartColor} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2.5}
                    fill="url(#gainsGradient)"
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: chartColor,
                      stroke: "white",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  color,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { fullDate?: string; value?: number } }>;
  color: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-lg bg-popover/95 border border-border/60 shadow-soft px-3 py-2 text-xs">
      <div className="font-medium text-foreground">
        {formatXAF(p.value ?? 0)} XAF
      </div>
      {p.fullDate && (
        <div className="text-muted-foreground mt-0.5">{p.fullDate}</div>
      )}
      <div
        className="mt-1 h-0.5 w-8 rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Summary card (interactive)                                              */
/* ----------------------------------------------------------------------- */

function SummaryCard({
  label,
  value,
  unit,
  color,
  bg,
  icon: Icon,
  selected,
  onClick,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  bg: string;
  icon: React.ElementType;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`text-left rounded-xl bg-card border p-3 shadow-soft transition-colors ${
        selected
          ? "border-primary/60 ring-2 ring-primary/30"
          : "border-border/60"
      }`}
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
    </motion.button>
  );
}

/* ----------------------------------------------------------------------- */
/* Transaction detail modal                                                */
/* ----------------------------------------------------------------------- */

function TransactionDetailModal({
  transaction,
  onClose,
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Dialog
      open={transaction !== null}
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogContent aria-describedby={undefined} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-lg">
            {t("history.detail.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("history.detail.title")}
          </DialogDescription>
        </DialogHeader>

        {transaction && (
          <div className="space-y-4">
            {/* Top hero with icon + amount */}
            <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3 border border-border/60">
              <TransactionIcon type={transaction.type} />
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold text-sm">
                  {transaction.type === "gain"
                    ? t("history.tx.gain")
                    : transaction.type === "deposit"
                    ? t("history.tx.deposit")
                    : transaction.type === "withdraw"
                    ? t("history.tx.withdraw")
                    : t("history.tx.subscription", { plan: "" })}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(transaction.createdAt)}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`font-display font-extrabold text-lg ${
                    transaction.amount > 0
                      ? "text-[oklch(0.45_0.1_155)]"
                      : "text-foreground"
                  }`}
                >
                  {transaction.amount > 0 ? "+" : ""}
                  {formatXAF(transaction.amount)}
                </div>
                <div className="text-[10px] text-muted-foreground">XAF</div>
              </div>
            </div>

            {/* Detail rows */}
            <div className="space-y-2.5">
              <DetailRow
                label={t("history.detail.type")}
                value={
                  transaction.type === "gain"
                    ? t("history.tx.gain")
                    : transaction.type === "deposit"
                    ? t("history.tx.deposit")
                    : transaction.type === "withdraw"
                    ? t("history.tx.withdraw")
                    : t("history.tx.subscription", { plan: "" })
                }
              />
              <DetailRow
                label={t("history.detail.amount")}
                value={`${transaction.amount > 0 ? "+" : ""}${formatXAF(transaction.amount)} XAF`}
              />
              <DetailRow
                label={t("history.detail.date")}
                value={formatDateTime(transaction.createdAt)}
              />
              <DetailRow
                label={t("history.detail.balanceAfter")}
                value={`${formatXAF(transaction.balanceAfter)} XAF`}
                icon={Wallet}
              />
              <DetailRow
                label={t("history.detail.description")}
                value={transaction.description || t("history.detail.notAvailable")}
              />
              {transaction.type === "gain" && (
                <>
                  <DetailRow
                    label={t("history.detail.market")}
                    value={t("history.detail.notAvailable")}
                  />
                  <DetailRow
                    label={t("history.detail.pair")}
                    value={t("history.detail.notAvailable")}
                  />
                </>
              )}
              {(transaction.type === "deposit" || transaction.type === "withdraw") && (
                <DetailRow
                  label={t("history.detail.operator")}
                  value={
                    transaction.operator === "mtn"
                      ? "MTN Money"
                      : transaction.operator === "orange"
                      ? "Orange Money"
                      : t("history.detail.notAvailable")
                  }
                />
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                toast.info(t("history.detail.viewMore"));
              }}
            >
              <Info className="w-4 h-4" />
              {t("history.detail.viewMore")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <div className="text-sm font-medium text-foreground text-right max-w-[60%] break-words">
        {value}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Transaction icon                                                        */
/* ----------------------------------------------------------------------- */

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

/* ----------------------------------------------------------------------- */
/* Period range helper                                                     */
/* ----------------------------------------------------------------------- */

function buildPeriodRange(
  period: Period,
  transactions: Transaction[]
): string | null {
  const fmt = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

  const now = new Date();
  if (period === "today") {
    return fmt(now);
  }
  if (period === "week") {
    const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    return `${fmt(start)} - ${fmt(now)}`;
  }
  if (period === "month") {
    const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    return `${fmt(start)} - ${fmt(now)}`;
  }
  // all: derive from earliest transaction
  if (transactions.length === 0) return null;
  const earliest = transactions.reduce((acc, tx) => {
    const d = new Date(tx.createdAt).getTime();
    return d < acc ? d : acc;
  }, Date.now());
  return `${fmt(new Date(earliest))} - ${fmt(now)}`;
}
