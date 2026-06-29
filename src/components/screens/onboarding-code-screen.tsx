"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, ArrowRight, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { useCashPilotStore } from "@/lib/store";
import { formatPhoneDisplay } from "@/lib/utils";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/context";

export function OnboardingCodeScreen() {
  const t = useT();
  const setView = useCashPilotStore((s) => s.setView);
  const pendingPhone = useCashPilotStore((s) => s.pendingPhone);
  const [code, setCode] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [isNew, setIsNew] = useState<boolean>(true);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setDemoCode(sessionStorage.getItem("cashpilot-demo-code"));
    setIsNew(sessionStorage.getItem("cashpilot-is-new") === "1");
    // Focus le premier input
    setTimeout(() => inputsRef.current[0]?.focus(), 200);
  }, []);

  const codeStr = code.join("");
  const complete = codeStr.length === 4;

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    // Auto-focus next
    if (digit && index < 3) {
      inputsRef.current[index + 1]?.focus();
    }
    // Auto-submit quand complet
    if (digit && index === 3) {
      const fullCode = newCode.join("");
      if (fullCode.length === 4) {
        submitCode(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length > 0) {
      const newCode = ["", "", "", ""];
      for (let i = 0; i < pasted.length; i++) {
        newCode[i] = pasted[i];
      }
      setCode(newCode);
      if (pasted.length === 4) {
        submitCode(pasted);
      } else {
        inputsRef.current[pasted.length]?.focus();
      }
    }
  };

  const submitCode = async (codeValue: string) => {
    if (!pendingPhone) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pendingPhone, code: codeValue }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || t("onboarding.code.error"));
        setCode(["", "", "", ""]);
        inputsRef.current[0]?.focus();
        return;
      }
      // Code vérifié. Si nouvel utilisateur: écran PIN, sinon: écran PIN (connexion)
      setView("onboarding-pin");
    } catch {
      setError(t("toast.connectionError"));
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCode = () => {
    if (demoCode) {
      setCode(demoCode.split(""));
      submitCode(demoCode);
    }
  };

  if (!pendingPhone) {
    // Rediriger vers phone
    setView("onboarding-phone");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 h-16 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("onboarding-phone")}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
              className="inline-flex w-16 h-16 rounded-2xl bg-accent/60 items-center justify-center mx-auto"
            >
              <MessageSquare className="w-8 h-8 text-accent-foreground" />
            </motion.div>
            <h1 className="mt-6 font-display text-2xl sm:text-3xl font-bold">
              {t("onboarding.code.title")}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {t("onboarding.code.subtitle")}{" "}
              <strong className="text-foreground font-semibold">
                {formatPhoneDisplay(pendingPhone)}
              </strong>
            </p>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                disabled={loading}
                className="w-16 h-20 text-center text-3xl font-bold rounded-2xl border-2 border-border bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              />
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Demo code helper (en production, ce serait un vrai SMS) */}
          {demoCode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 rounded-xl bg-muted/60 border border-border/60 px-4 py-3 text-center"
            >
              <p className="text-xs text-muted-foreground mb-1">
                {t("onboarding.code.demoLabel")}
              </p>
              <button
                onClick={fillDemoCode}
                disabled={loading}
                className="font-display font-bold text-xl text-primary tracking-widest hover:underline"
              >
                {demoCode}
              </button>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("onboarding.code.demoHint")}
              </p>
            </motion.div>
          )}

          <Button
            onClick={() => submitCode(codeStr)}
            disabled={!complete || loading}
            size="lg"
            className="w-full h-13 mt-6 font-semibold rounded-xl group"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("onboarding.code.verifying")}
              </>
            ) : (
              <>
                {t("common.continue")}
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>

          <button
            onClick={() => setView("onboarding-phone")}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("onboarding.code.resend")}
          </button>
        </motion.div>
      </main>
    </div>
  );
}
