"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Bot,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  Sparkles,
  Zap,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/cashpilot/animated-number";
import { useCashPilotStore } from "@/lib/store";
import {
  formatXAF,
  formatRelativeTime,
  formatTime,
} from "@/lib/utils";
import type { DashboardData } from "@/lib/types";

interface HomeTabProps {
  data: DashboardData;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export function HomeTab({ data, onDeposit, onWithdraw }: HomeTabProps) {
  const { user, todayGains, todayExchanges, lastExchange, recentTransactions, gainsHistory } = data;

  const hasCapital = user.capital > 0;
  const gainsAvailable = user.balance; // tout le solde est retirable

  return (
    <div className="space-y-4">
      {/* Hero balance card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-3xl bg-brand-gradient p-6 text-primary-foreground shadow-soft-lg overflow-hidden"
      >
        {/* Decorative blob */}
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.2, 1], x: [0, 20, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-12 -right-8 w-48 h-48 rounded-full bg-[oklch(0.82_0.13_88)]"
          />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-primary-foreground/80">
              Vos gains totaux
            </div>
            <RobotStatusBadge active={hasCapital && user.status === "active"} />
          </div>

          <div className="mt-2 font-display font-extrabold text-4xl sm:text-5xl tracking-tight">
            <AnimatedNumber
              value={user.totalGains}
              format={(n) => formatXAF(Math.round(n))}
            />
            <span className="text-lg font-semibold ml-2 text-primary-foreground/80">XAF</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs font-semibold">
              <TrendingUp className="w-3 h-3" />
              +{formatXAF(todayGains)} XAF aujourd'hui
            </div>
            <div className="text-xs text-primary-foreground/70">
              {todayExchanges} échange{todayExchanges > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <ActionButton
          icon={ArrowDownToLine}
          label="Déposer"
          sublabel="Ajouter des fonds"
          onClick={onDeposit}
          variant="primary"
        />
        <ActionButton
          icon={ArrowUpFromLine}
          label="Retirer"
          sublabel={hasCapital ? `${formatXAF(gainsAvailable)} XAF` : "Aucun fond"}
          onClick={onWithdraw}
          variant="gold"
          disabled={!hasCapital || gainsAvailable < 2000}
        />
      </div>

      {/* Empty state: pas encore de capital */}
      {!hasCapital && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-accent/40 border border-accent/60 p-5"
        >
          <div className="flex items-start gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0"
            >
              <Sparkles className="w-5 h-5 text-accent-foreground" />
            </motion.div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-foreground">
                Activez votre robot 🚀
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Déposez dès 10 000 XAF via Mobile Money. Le robot démarrera automatiquement.
              </p>
              <Button
                onClick={onDeposit}
                size="sm"
                className="mt-3 h-9 font-semibold rounded-lg"
              >
                Faire mon premier dépôt
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Wallet}
          label="Capital déposé"
          value={`${formatXAF(user.capital)} XAF`}
          color="oklch(0.45 0.1 155)"
          bg="oklch(0.95 0.02 130)"
        />
        <StatCard
          icon={Activity}
          label="Solde disponible"
          value={`${formatXAF(user.balance)} XAF`}
          color="oklch(0.6 0.13 85)"
          bg="oklch(0.95 0.03 90)"
        />
        <StatCard
          icon={Zap}
          label="Échanges totaux"
          value={user.totalExchanges.toString()}
          color="oklch(0.45 0.1 155)"
          bg="oklch(0.95 0.02 155)"
        />
        <StatCard
          icon={Sparkles}
          label="Niveau"
          value={user.level === "croissance" ? "Croissance" : "Starter"}
          color="oklch(0.55 0.13 85)"
          bg="oklch(0.95 0.03 95)"
          highlight={user.level === "croissance"}
        />
      </div>

      {/* Gains chart */}
      {hasCapital && gainsHistory.length > 0 && (
        <GainsChart data={gainsHistory} />
      )}

      {/* Last exchange */}
      {lastExchange && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
        >
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Dernier échange du robot</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{lastExchange.market}</div>
              <div className="font-display font-bold text-lg text-foreground">
                +{formatXAF(lastExchange.gain)} XAF
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(lastExchange.createdAt)}
              </div>
            </div>
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-14 h-14 rounded-full bg-brand-gradient flex items-center justify-center"
            >
              <TrendingUp className="w-7 h-7 text-primary-foreground" />
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Recent activity */}
      <div className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm">Activité récente</h3>
          <span className="text-xs text-muted-foreground">
            {recentTransactions.length} opération{recentTransactions.length > 1 ? "s" : ""}
          </span>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">📊</div>
            <p className="text-sm text-muted-foreground">
              Aucune activité pour le moment.
              <br />
              {hasCapital
                ? "Le robot va bientôt faire ses premiers échanges."
                : "Déposez des fonds pour démarrer."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {recentTransactions.slice(0, 6).map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 py-2"
                >
                  <TransactionIcon type={tx.type} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {tx.type === "gain"
                        ? "Gain du robot"
                        : tx.type === "deposit"
                        ? "Dépôt"
                        : "Retrait"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(tx.createdAt)}
                    </div>
                  </div>
                  <div
                    className={`font-display font-bold text-sm ${
                      tx.amount > 0
                        ? "text-[oklch(0.45_0.1_155)]"
                        : "text-foreground"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {formatXAF(tx.amount)} XAF
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

function RobotStatusBadge({ active }: { active: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1">
      <motion.div
        animate={active ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
        className={`w-2 h-2 rounded-full ${
          active ? "bg-[oklch(0.85_0.18_150)]" : "bg-primary-foreground/40"
        }`}
      />
      <span className="text-[11px] font-semibold">
        {active ? "Robot actif" : "En attente"}
      </span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  sublabel,
  onClick,
  variant,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  onClick: () => void;
  variant: "primary" | "gold";
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative rounded-2xl p-4 text-left shadow-soft overflow-hidden transition-opacity ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${
        variant === "primary"
          ? "bg-brand-gradient text-primary-foreground"
          : "bg-gold-gradient text-accent-foreground"
      }`}
    >
      <Icon className="w-5 h-5 mb-2" />
      <div className="font-display font-bold text-base">{label}</div>
      <div
        className={`text-xs ${
          variant === "primary" ? "text-primary-foreground/70" : "text-accent-foreground/70"
        }`}
      >
        {sublabel}
      </div>
    </motion.button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
  highlight?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`rounded-2xl p-4 border shadow-soft ${
        highlight ? "border-accent bg-accent/30" : "border-border/60 bg-card"
      }`}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
        style={{ background: bg }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-base mt-0.5">{value}</div>
    </motion.div>
  );
}

function TransactionIcon({ type }: { type: string }) {
  if (type === "gain") {
    return (
      <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
        <TrendingUp className="w-4 h-4 text-primary-foreground" />
      </div>
    );
  }
  if (type === "deposit") {
    return (
      <div className="w-9 h-9 rounded-full bg-[oklch(0.95_0.03_90)] flex items-center justify-center shrink-0">
        <ArrowDownToLine className="w-4 h-4 text-[oklch(0.6_0.13_85)]" />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
      <ArrowUpFromLine className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}

function GainsChart({ data }: { data: { time: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - (d.value / max) * 100,
    value: d.value,
  }));

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display font-semibold text-sm">Vos gains sur 24h</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cumul des gains par heure
          </p>
        </div>
        <TrendingUp className="w-4 h-4 text-[oklch(0.45_0.1_155)]" />
      </div>

      <div className="relative h-32 w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="gains-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.45 0.1 155)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="oklch(0.45 0.1 155)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={areaD}
            fill="url(#gains-gradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
          <motion.path
            d={pathD}
            fill="none"
            stroke="oklch(0.45 0.1 155)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
          />
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Il y a 24h</span>
        <span className="font-semibold text-[oklch(0.45_0.1_155)]">
          +{formatXAF(data[data.length - 1]?.value || 0)} XAF
        </span>
        <span>Maintenant</span>
      </div>
    </motion.div>
  );
}
