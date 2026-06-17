"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  X,
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCashPilotStore } from "@/lib/store";
import { formatXAF } from "@/lib/utils";
import { toast } from "sonner";
import { CashPilotLogo } from "@/components/cashpilot/logo";

const MIN_DEPOSIT = 10000;
const QUICK_AMOUNTS = [10000, 25000, 50000, 100000];

type Operator = "mtn" | "orange";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DepositDialog({
  open,
  onOpenChange,
  onSuccess,
}: DepositDialogProps) {
  const userId = useCashPilotStore((s) => s.userId);
  const [step, setStep] = useState<"amount" | "operator" | "processing" | "success">(
    "amount"
  );
  const [amount, setAmount] = useState<number>(MIN_DEPOSIT);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    amount: number;
    operator: Operator;
    becameCroissance: boolean;
    newBalance: number;
  } | null>(null);

  const reset = () => {
    setStep("amount");
    setAmount(MIN_DEPOSIT);
    setOperator(null);
    setError(null);
    setResult(null);
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setTimeout(reset, 300);
    }
  };

  const handleConfirm = async () => {
    if (!userId || !operator) return;
    setStep("processing");
    setError(null);

    try {
      // Simuler le paiement Mobile Money (3s)
      await new Promise((r) => setTimeout(r, 2800));

      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount, operator }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Échec du dépôt. Réessayez.");
        setStep("operator");
        return;
      }
      setResult({
        amount,
        operator,
        becameCroissance: json.becameCroissance,
        newBalance: json.balance,
      });
      setStep("success");
      if (json.becameCroissance) {
        toast.success("🎉 Vous êtes passé au niveau Croissance !", {
          description: "Retraits prioritaires et rapport hebdomadaire.",
        });
      }
      onSuccess?.();
    } catch {
      setError("Problème de connexion. Réessayez.");
      setStep("operator");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="font-display text-lg font-bold">
            Déposer mes fonds
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5">
          <AnimatePresence mode="wait">
            {/* Step 1: Amount */}
            {step === "amount" && (
              <motion.div
                key="amount"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Combien voulez-vous déposer ? Le minimum est de{" "}
                  <strong className="text-foreground">{formatXAF(MIN_DEPOSIT)} XAF</strong>.
                </p>

                <div className="relative mb-4">
                  <Input
                    inputMode="numeric"
                    type="number"
                    value={amount || ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/\D/g, ""), 10);
                      setAmount(isNaN(v) ? 0 : v);
                      setError(null);
                    }}
                    className="h-14 text-2xl font-display font-bold rounded-xl pr-14"
                    placeholder="10000"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    XAF
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setAmount(q);
                        setError(null);
                      }}
                      className={`h-11 rounded-xl border-2 font-semibold text-sm transition-all ${
                        amount === q
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      {formatXAF(q)} XAF
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive mb-3">
                    {error}
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (amount < MIN_DEPOSIT) {
                      setError(`Le dépôt minimum est de ${formatXAF(MIN_DEPOSIT)} XAF.`);
                      return;
                    }
                    setStep("operator");
                  }}
                  size="lg"
                  className="w-full h-12 font-semibold rounded-xl group"
                >
                  Continuer
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            )}

            {/* Step 2: Operator */}
            {step === "operator" && (
              <motion.div
                key="operator"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-4">
                  <button
                    onClick={() => setStep("amount")}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Modifier le montant
                  </button>
                </div>

                <div className="rounded-xl bg-muted/60 p-4 mb-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vous déposez</span>
                  <span className="font-display font-bold text-xl">
                    {formatXAF(amount)} XAF
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-3">
                  Choisissez votre opérateur Mobile Money:
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <OperatorCard
                    name="MTN Money"
                    color="oklch(0.96 0.05 250)"
                    textColor="oklch(0.5 0.18 255)"
                    emoji="🟡"
                    selected={operator === "mtn"}
                    onClick={() => setOperator("mtn")}
                  />
                  <OperatorCard
                    name="Orange Money"
                    color="oklch(0.95 0.04 50)"
                    textColor="oklch(0.55 0.18 45)"
                    emoji="🟠"
                    selected={operator === "orange"}
                    onClick={() => setOperator("orange")}
                  />
                </div>

                <div className="rounded-xl bg-accent/40 border border-accent/60 p-3 mb-4 flex items-start gap-2">
                  <Shield className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-accent-foreground leading-relaxed">
                    Vous confirmerez le paiement avec votre PIN Mobile Money habituel. Aucun frais CashPilot.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive mb-3">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleConfirm}
                  disabled={!operator}
                  size="lg"
                  className="w-full h-12 font-semibold rounded-xl group"
                >
                  Payer {formatXAF(amount)} XAF
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            )}

            {/* Step 3: Processing */}
            {step === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="inline-flex w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary items-center justify-center mx-auto"
                >
                  <span className="text-2xl">{operator === "mtn" ? "🟡" : "🟠"}</span>
                </motion.div>
                <h3 className="mt-6 font-display font-bold text-lg">
                  Traitement du paiement...
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Confirmez le paiement sur votre téléphone avec votre PIN {operator === "mtn" ? "MTN" : "Orange"} Money.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cela peut prendre quelques secondes...
                </div>
              </motion.div>
            )}

            {/* Step 4: Success */}
            {step === "success" && result && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6, bounce: 0.5 }}
                  className="inline-flex w-20 h-20 rounded-full bg-brand-gradient items-center justify-center mx-auto shadow-soft-lg"
                >
                  <Check className="w-10 h-10 text-primary-foreground" strokeWidth={3} />
                </motion.div>

                <h3 className="mt-6 font-display font-bold text-xl">
                  Dépôt réussi !
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Votre dépôt de <strong className="text-foreground">{formatXAF(result.amount)} XAF</strong> via{" "}
                  {result.operator === "mtn" ? "MTN Money" : "Orange Money"} est confirmé.
                </p>

                {result.becameCroissance && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4 rounded-xl bg-gold-gradient p-3 flex items-center gap-2"
                  >
                    <Sparkles className="w-5 h-5 text-accent-foreground" />
                    <div className="text-left text-xs">
                      <div className="font-bold text-accent-foreground">Niveau Croissance débloqué !</div>
                      <div className="text-accent-foreground/80">Retraits prioritaires + rapport hebdo</div>
                    </div>
                  </motion.div>
                )}

                <div className="mt-5 rounded-xl bg-muted/60 p-4">
                  <div className="text-xs text-muted-foreground">Votre robot démarre maintenant</div>
                  <div className="mt-1 font-display font-bold text-lg">
                    Nouveau solde: {formatXAF(result.newBalance)} XAF
                  </div>
                </div>

                <Button
                  onClick={() => handleClose(false)}
                  size="lg"
                  className="w-full h-12 mt-5 font-semibold rounded-xl"
                >
                  Voir mes gains
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OperatorCard({
  name,
  color,
  textColor,
  emoji,
  selected,
  onClick,
}: {
  name: string;
  color: string;
  textColor: string;
  emoji: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl p-4 border-2 transition-all text-left ${
        selected
          ? "border-primary shadow-soft"
          : "border-border hover:border-primary/40"
      }`}
      style={{ background: color }}
    >
      <div className="text-3xl mb-2">{emoji}</div>
      <div className="font-display font-bold text-sm" style={{ color: textColor }}>
        {name}
      </div>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
        </motion.div>
      )}
    </button>
  );
}
