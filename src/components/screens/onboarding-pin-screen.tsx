"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Lock, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { useCashPilotStore } from "@/lib/store";

export function OnboardingPinScreen() {
  const setView = useCashPilotStore((s) => s.setView);
  const pendingPhone = useCashPilotStore((s) => s.pendingPhone);
  const setSession = useCashPilotStore((s) => s.setSession);
  const [isNew, setIsNew] = useState<boolean>(true);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsNew(sessionStorage.getItem("cashpilot-is-new") !== "0");
  }, []);

  const submit = async () => {
    setError(null);
    if (isNew) {
      // Pour un nouvel utilisateur: créer le compte
      setLoading(true);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: pendingPhone, pin }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.error || "Erreur lors de la création du compte.");
          setPin("");
          return;
        }
        // Nettoyer le storage
        sessionStorage.removeItem("cashpilot-demo-code");
        sessionStorage.removeItem("cashpilot-is-new");
        setSession(json.userId, json.phone);
        setView("onboarding-tutorial");
      } catch {
        setError("Problème de connexion. Réessayez.");
        setPin("");
      } finally {
        setLoading(false);
      }
    } else {
      // Utilisateur existant: vérifier le PIN via login API
      setLoading(true);
      try {
        // Pour la démo, on simule une connexion en récupérant l'utilisateur via le phone
        // On appelle verify-pin avec le pin (mais il faut l'userId)
        // Simplifions: on suppose qu'on a un endpoint login complet
        // En réalité, on devrait avoir un vrai login flow, mais pour la démo on charge l'user via dashboard
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: pendingPhone, pin }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.error || "PIN incorrect.");
          setPin("");
          return;
        }
        sessionStorage.removeItem("cashpilot-demo-code");
        sessionStorage.removeItem("cashpilot-is-new");
        setSession(json.userId, json.phone);
        setView("app");
      } catch {
        setError("Problème de connexion. Réessayez.");
        setPin("");
      } finally {
        setLoading(false);
      }
    }
  };

  const onDigit = (d: string) => {
    setError(null);
    if (step === "create") {
      if (pin.length < 4) {
        const newPin = pin + d;
        setPin(newPin);
        if (newPin.length === 4) {
          if (isNew) {
            setTimeout(() => setStep("confirm"), 200);
          } else {
            setTimeout(() => submit(), 200);
          }
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const newPin = confirmPin + d;
        setConfirmPin(newPin);
        if (newPin.length === 4) {
          if (newPin !== pin) {
            setError("Les deux PIN ne sont pas identiques. Réessayez.");
            setTimeout(() => {
              setPin("");
              setConfirmPin("");
              setStep("create");
              setError(null);
            }, 1500);
          } else {
            setTimeout(() => submit(), 200);
          }
        }
      }
    }
  };

  const onDelete = () => {
    setError(null);
    if (step === "create") {
      setPin(pin.slice(0, -1));
    } else {
      const newPin = confirmPin.slice(0, -1);
      setConfirmPin(newPin);
      if (newPin.length === 0) {
        setStep("create");
        setPin("");
      }
    }
  };

  const currentPin = step === "create" ? pin : confirmPin;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 h-16 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (step === "confirm") {
              setStep("create");
              setPin("");
              setConfirmPin("");
              setError(null);
            } else {
              setView("onboarding-code");
            }
          }}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
            className="inline-flex w-16 h-16 rounded-2xl bg-brand-gradient items-center justify-center mx-auto shadow-soft"
          >
            <Lock className="w-8 h-8 text-primary-foreground" />
          </motion.div>

          <h1 className="mt-6 font-display text-2xl sm:text-3xl font-bold">
            {isNew
              ? step === "create"
                ? "Créez votre code PIN"
                : "Confirmez votre PIN"
              : "Entrez votre PIN"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {isNew
              ? step === "create"
                ? "4 chiffres pour sécuriser votre compte. Ce code sera demandé pour chaque retrait."
                : "Retapez votre code PIN pour confirmer."
              : "Entrez votre code PIN à 4 chiffres pour vous connecter."}
          </p>

          {/* PIN dots */}
          <div className="mt-8 flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: currentPin.length === i + 1 ? [1, 1.3, 1] : 1,
                }}
                transition={{ duration: 0.2 }}
                className={`pin-dot ${i < currentPin.length ? "filled" : ""}`}
              />
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Création de votre compte...
            </motion.div>
          )}

          {/* Numpad */}
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <motion.button
                key={d}
                whileTap={{ scale: 0.95 }}
                onClick={() => onDigit(d)}
                disabled={loading}
                className="h-16 rounded-2xl bg-card border border-border/60 font-display font-semibold text-2xl hover:bg-muted/50 active:bg-muted transition-colors shadow-soft"
              >
                {d}
              </motion.button>
            ))}
            <div className="h-16" />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onDigit("0")}
              disabled={loading}
              className="h-16 rounded-2xl bg-card border border-border/60 font-display font-semibold text-2xl hover:bg-muted/50 active:bg-muted transition-colors shadow-soft"
            >
              0
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onDelete}
              disabled={loading || currentPin.length === 0}
              className="h-16 rounded-2xl bg-card border border-border/60 flex items-center justify-center hover:bg-muted/50 active:bg-muted transition-colors shadow-soft disabled:opacity-30"
            >
              <Delete className="w-6 h-6" />
            </motion.button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
