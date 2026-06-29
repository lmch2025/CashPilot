"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { useCashPilotStore } from "@/lib/store";
import { isValidCameroonPhone, normalizePhone, formatPhoneDisplay } from "@/lib/utils";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/context";

export function OnboardingPhoneScreen() {
  const t = useT();
  const setView = useCashPilotStore((s) => s.setView);
  const setPendingPhone = useCashPilotStore((s) => s.setPendingPhone);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizePhone(phone);
  const valid = isValidCameroonPhone(normalized);

  const handleSubmit = async () => {
    setError(null);
    if (!valid) {
      setError(t("onboarding.phone.invalid"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || t("toast.connectionError"));
        return;
      }
      setPendingPhone(normalized);
      // Passer à l'écran code, en transmettant le code démo via sessionStorage
      if (json.demoCode) {
        sessionStorage.setItem("cashpilot-demo-code", json.demoCode);
        sessionStorage.setItem("cashpilot-is-new", json.isNew ? "1" : "0");
      }
      setView("onboarding-code");
    } catch {
      setError(t("toast.connectionError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 h-16 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("welcome")}
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
            <CashPilotLogo size={64} className="mx-auto" animated />
            <h1 className="mt-6 font-display text-2xl sm:text-3xl font-bold">
              {t("onboarding.phone.title")}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {t("onboarding.phone.subtitle")}
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <label className="text-sm font-medium text-foreground">
              {t("onboarding.phone.label")}
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                inputMode="numeric"
                placeholder={t("onboarding.phone.placeholder")}
                value={phone}
                onChange={(e) => {
                  // Garder seulement les chiffres, max 9
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 9);
                  setPhone(cleaned);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && valid && !loading) {
                    handleSubmit();
                  }
                }}
                className="pl-10 h-13 text-lg font-medium tracking-wide rounded-xl"
                autoFocus
              />
            </div>

            {phone.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {valid ? (
                  <span className="text-[oklch(0.45_0.1_155)] font-medium">
                    {t("onboarding.phone.valid")} {formatPhoneDisplay(normalized)}
                  </span>
                ) : (
                  <span>{t("onboarding.phone.hint")}</span>
                )}
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              onClick={handleSubmit}
              disabled={!valid || loading}
              size="lg"
              className="w-full h-13 mt-2 font-semibold rounded-xl group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("onboarding.phone.sending")}
                </>
              ) : (
                <>
                  {t("onboarding.phone.submit")}
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("onboarding.phone.terms")}
          </p>
        </motion.div>
      </main>
    </div>
  );
}
