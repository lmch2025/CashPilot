"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Delete,
  Lock,
  Loader2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCashPilotStore } from "@/lib/store";
import { formatXAF } from "@/lib/utils";
import { toast } from "sonner";

const MIN_WITHDRAW = 2000;

type Operator = "mtn" | "orange";

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
  onSuccess?: () => void;
}

export function WithdrawDialog({
  open,
  onOpenChange,
  balance,
  onSuccess,
}: WithdrawDialogProps) {
  const userId = useCashPilotStore((s) => s.userId);
  const [step, setStep] = useState<"amount" | "operator" | "pin" | "processing" | "success">(
    "amount"
  );
  const [amount, setAmount] = useState<number>(MIN_WITHDRAW);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    amount: number;
    operator: Operator;
    newBalance: number;
  } | null>(null);

  const reset = () => {
    setStep("amount");
    setAmount(MIN_WITHDRAW);
    setOperator(null);
    setPin("");
    setError(null);
    setResult(null);
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) setTimeout(reset, 300);
  };

  const onDigit = (d: string) => {
    setError(null);
    if (pin.length < 4) {
      const newPin = pin + d;
      setPin(newPin);
      if (newPin.length === 4) {
        // Auto-submit
        setTimeout(() => submitWithdraw(newPin), 150);
      }
    }
  };

  const onDelete = () => {
    setError(null);
    setPin(pin.slice(0, -1));
  };

  const submitWithdraw = async (pinValue: string) => {
    if (!userId || !operator) return;
    setStep("processing");
    setError(null);

    try {
      // Simuler le virement Mobile Money
      await new Promise((r) => setTimeout(r, 2500));

      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount, operator, pin: pinValue }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Échec du retrait. Réessayez.");
        setStep("pin");
        setPin("");
        return;
      }
      setResult({
        amount,
        operator,
        newBalance: json.balance,
      });
      setStep("success");
      onSuccess?.();
    } catch {
      setError("Problème de connexion. Réessayez.");
      setStep("pin");
      setPin("");
    }
  };

  const availableGains = Math.max(0, balance);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="font-display text-lg font-bold">
            Retirer mes gains
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
                <div className="rounded-xl bg-muted/60 p-4 mb-4 text-center">
                  <div className="text-xs text-muted-foreground">Solde disponible</div>
                  <div className="font-display font-bold text-2xl mt-1">
                    {formatXAF(availableGains)} XAF
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  Combien voulez-vous retirer ? Le minimum est de {formatXAF(MIN_WITHDRAW)} XAF.
                </p>

                <div className="relative mb-3">
                  <input
                    inputMode="numeric"
                    type="number"
                    value={amount || ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/\D/g, ""), 10);
                      setAmount(isNaN(v) ? 0 : v);
                      setError(null);
                    }}
                    className="w-full h-14 text-2xl font-display font-bold rounded-xl border-2 border-border bg-card px-4 pr-14 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    placeholder="2000"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    XAF
                  </span>
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => {
                      setAmount(Math.max(MIN_WITHDRAW, Math.floor(availableGains / 2)));
                      setError(null);
                    }}
                    className="flex-1 h-10 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted/50 transition-colors"
                  >
                    Moitié
                  </button>
                  <button
                    onClick={() => {
                      setAmount(availableGains);
                      setError(null);
                    }}
                    className="flex-1 h-10 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted/50 transition-colors"
                  >
                    Tout ({formatXAF(availableGains)} XAF)
                  </button>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive mb-3">
                    {error}
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (amount < MIN_WITHDRAW) {
                      setError(`Le retrait minimum est de ${formatXAF(MIN_WITHDRAW)} XAF.`);
                      return;
                    }
                    if (amount > availableGains) {
                      setError(`Solde insuffisant. Maximum: ${formatXAF(availableGains)} XAF.`);
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
                  <span className="text-sm text-muted-foreground">Vous retirez</span>
                  <span className="font-display font-bold text-xl">
                    {formatXAF(amount)} XAF
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-3">
                  Sur quel Mobile Money recevoir l'argent ?
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <OperatorCard
                    name="MTN Money"
                    emoji="🟡"
                    selected={operator === "mtn"}
                    onClick={() => setOperator("mtn")}
                  />
                  <OperatorCard
                    name="Orange Money"
                    emoji="🟠"
                    selected={operator === "orange"}
                    onClick={() => setOperator("orange")}
                  />
                </div>

                <div className="rounded-xl bg-accent/40 border border-accent/60 p-3 mb-4 flex items-start gap-2">
                  <Shield className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-accent-foreground leading-relaxed">
                    Virement en moins de 10 minutes. Aucun frais CashPilot.
                  </p>
                </div>

                <Button
                  onClick={() => setStep("pin")}
                  disabled={!operator}
                  size="lg"
                  className="w-full h-12 font-semibold rounded-xl group"
                >
                  Continuer
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            )}

            {/* Step 3: PIN */}
            {step === "pin" && (
              <motion.div
                key="pin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-4">
                  <button
                    onClick={() => {
                      setStep("operator");
                      setPin("");
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                  </button>
                </div>

                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="inline-flex w-14 h-14 rounded-2xl bg-brand-gradient items-center justify-center mx-auto shadow-soft"
                  >
                    <Lock className="w-7 h-7 text-primary-foreground" />
                  </motion.div>
                  <h3 className="mt-4 font-display font-bold text-lg">
                    Confirmez avec votre PIN
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Entrez votre code PIN à 4 chiffres pour valider le retrait de{" "}
                    <strong className="text-foreground">{formatXAF(amount)} XAF</strong>.
                  </p>

                  <div className="mt-6 flex justify-center gap-4">
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: pin.length === i + 1 ? [1, 1.3, 1] : 1,
                        }}
                        transition={{ duration: 0.2 }}
                        className={`pin-dot ${i < pin.length ? "filled" : ""}`}
                      />
                    ))}
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Numpad */}
                  <div className="mt-6 grid grid-cols-3 gap-2 max-w-xs mx-auto">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                      <motion.button
                        key={d}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onDigit(d)}
                        className="h-13 rounded-xl bg-card border border-border/60 font-display font-semibold text-xl hover:bg-muted/50 active:bg-muted transition-colors"
                      >
                        {d}
                      </motion.button>
                    ))}
                    <div className="h-13" />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onDigit("0")}
                      className="h-13 rounded-xl bg-card border border-border/60 font-display font-semibold text-xl hover:bg-muted/50 active:bg-muted transition-colors"
                    >
                      0
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={onDelete}
                      disabled={pin.length === 0}
                      className="h-13 rounded-xl bg-card border border-border/60 flex items-center justify-center hover:bg-muted/50 active:bg-muted transition-colors disabled:opacity-30"
                    >
                      <Delete className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Processing */}
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
                  Virement en cours...
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Envoi de {formatXAF(amount)} XAF vers votre{" "}
                  {operator === "mtn" ? "MTN Money" : "Orange Money"}.
                </p>
              </motion.div>
            )}

            {/* Step 5: Success */}
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
                  className="inline-flex w-20 h-20 rounded-full bg-gold-gradient items-center justify-center mx-auto shadow-gold"
                >
                  <Check className="w-10 h-10 text-accent-foreground" strokeWidth={3} />
                </motion.div>

                <h3 className="mt-6 font-display font-bold text-xl">
                  Virement effectué !
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  <strong className="text-foreground">{formatXAF(result.amount)} XAF</strong> envoyés sur votre{" "}
                  {result.operator === "mtn" ? "MTN Money" : "Orange Money"}.
                </p>

                <div className="mt-5 rounded-xl bg-muted/60 p-4">
                  <div className="text-xs text-muted-foreground">Nouveau solde</div>
                  <div className="font-display font-bold text-lg mt-1">
                    {formatXAF(result.newBalance)} XAF
                  </div>
                </div>

                <Button
                  onClick={() => handleClose(false)}
                  size="lg"
                  className="w-full h-12 mt-5 font-semibold rounded-xl"
                >
                  Fermer
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
  emoji,
  selected,
  onClick,
}: {
  name: string;
  emoji: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl p-4 border-2 transition-all text-left bg-card ${
        selected ? "border-primary shadow-soft" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="text-3xl mb-2">{emoji}</div>
      <div className="font-display font-bold text-sm text-foreground">{name}</div>
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
