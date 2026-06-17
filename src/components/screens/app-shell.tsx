"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Home, Clock, User, Loader2 } from "lucide-react";
import { useCashPilotStore } from "@/lib/store";
import { useDashboard } from "@/hooks/use-dashboard";
import { HomeTab } from "@/components/screens/home-tab";
import { HistoryTab } from "@/components/screens/history-tab";
import { AccountTab } from "@/components/screens/account-tab";
import { DepositDialog } from "@/components/cashpilot/deposit-dialog";
import { WithdrawDialog } from "@/components/cashpilot/withdraw-dialog";
import { GainToast } from "@/components/cashpilot/gain-toast";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { Button } from "@/components/ui/button";

const TABS = [
  { id: "home" as const, label: "Accueil", icon: Home },
  { id: "history" as const, label: "Historique", icon: Clock },
  { id: "account" as const, label: "Compte", icon: User },
];

export function AppShell() {
  const tab = useCashPilotStore((s) => s.tab);
  const setTab = useCashPilotStore((s) => s.setTab);
  const depositOpen = useCashPilotStore((s) => s.depositOpen);
  const setDepositOpen = useCashPilotStore((s) => s.setDepositOpen);
  const withdrawOpen = useCashPilotStore((s) => s.withdrawOpen);
  const setWithdrawOpen = useCashPilotStore((s) => s.setWithdrawOpen);

  const { data, loading, error, refresh } = useDashboard();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/40">
        <div className="mx-auto max-w-md px-4 h-14 flex items-center justify-between">
          <CashPilotLogo size={32} withText />
          {data && (
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Solde</div>
              <div className="font-display font-bold text-sm leading-none">
                {data.user.balance.toLocaleString("fr-FR")} XAF
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-4 pb-28">
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "home" && (
                <HomeTab
                  data={data}
                  onDeposit={() => setDepositOpen(true)}
                  onWithdraw={() => setWithdrawOpen(true)}
                />
              )}
              {tab === "history" && <HistoryTab />}
              {tab === "account" && <AccountTab data={data} />}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-md px-2 h-16 flex items-center justify-around">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`relative flex items-center justify-center w-10 h-7 rounded-full transition-colors ${
                    active ? "bg-primary/10" : ""
                  }`}
                >
                  <t.icon
                    className={`w-5 h-5 transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </motion.div>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {t.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -top-px h-0.5 w-8 rounded-full bg-primary"
                    transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating gain toast */}
      <GainToast />

      {/* Dialogs */}
      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        onSuccess={refresh}
      />
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        balance={data?.user.balance ?? 0}
        onSuccess={refresh}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <CashPilotLogo size={56} />
      </motion.div>
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement de votre tableau de bord...
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">😕</div>
      <h2 className="font-display font-bold text-lg">Oups, ça n'a pas chargé</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">{message}</p>
      <Button onClick={onRetry} className="mt-4">
        Réessayer
      </Button>
    </div>
  );
}
