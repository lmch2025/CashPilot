"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowRight, ArrowLeft, Wallet, Bot, Banknote, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { useCashPilotStore } from "@/lib/store";

const TUTORIAL_STEPS = [
  {
    icon: Wallet,
    title: "Déposez votre argent",
    description:
      "Via MTN Money ou Orange Money, dès 10 000 XAF. C'est aussi simple que d'envoyer de l'argent à un proche.",
    color: "oklch(0.45 0.1 155)",
    bg: "oklch(0.95 0.02 130)",
  },
  {
    icon: Bot,
    title: "Le robot fait tout",
    description:
      "Notre robot intelligent achète et revend automatiquement sur plusieurs marchés, 24h/24. Vous n'avez rien à faire.",
    color: "oklch(0.6 0.13 85)",
    bg: "oklch(0.95 0.03 90)",
  },
  {
    icon: Banknote,
    title: "Retirez vos gains",
    description:
      "Quand vous voulez, dès 2 000 XAF. L'argent arrive sur votre Mobile Money en moins de 10 minutes.",
    color: "oklch(0.45 0.1 155)",
    bg: "oklch(0.95 0.02 155)",
  },
];

export function OnboardingTutorialScreen() {
  const setView = useCashPilotStore((s) => s.setView);
  const markTutorialSeen = useCashPilotStore((s) => s.markTutorialSeen);
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < TUTORIAL_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      markTutorialSeen();
      setView("app");
    }
  };

  const prev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-4 sm:px-6 h-16 flex items-center justify-between">
        <CashPilotLogo size={36} withText />
        <button
          onClick={() => {
            markTutorialSeen();
            setView("app");
          }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Passer
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-md">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-10">
            {TUTORIAL_STEPS.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === step ? 28 : 8,
                  backgroundColor:
                    i === step
                      ? "oklch(0.38 0.09 155)"
                      : i < step
                      ? "oklch(0.55 0.09 152)"
                      : "oklch(0.92 0.01 130)",
                }}
                className="h-2 rounded-full"
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 0.7, bounce: 0.4 }}
                className="inline-flex w-28 h-28 rounded-3xl items-center justify-center mx-auto shadow-soft-lg"
                style={{ background: current.bg }}
              >
                <current.icon
                  className="w-14 h-14"
                  style={{ color: current.color }}
                />
              </motion.div>

              <h1 className="mt-8 font-display text-2xl sm:text-3xl font-bold">
                {current.title}
              </h1>
              <p className="mt-4 text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {current.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 flex items-center gap-3">
            {step > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={prev}
                className="h-13 px-5 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="lg"
              onClick={next}
              className="flex-1 h-13 font-semibold rounded-xl group"
            >
              {isLast ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  C'est parti !
                </>
              ) : (
                <>
                  Suivant
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
