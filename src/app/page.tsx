"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCashPilotStore } from "@/lib/store";
import { WelcomeScreen } from "@/components/screens/welcome-screen";
import { OnboardingPhoneScreen } from "@/components/screens/onboarding-phone-screen";
import { OnboardingCodeScreen } from "@/components/screens/onboarding-code-screen";
import { OnboardingPinScreen } from "@/components/screens/onboarding-pin-screen";
import { OnboardingTutorialScreen } from "@/components/screens/onboarding-tutorial-screen";
import { AppShell } from "@/components/screens/app-shell";
import { useEffect } from "react";

export default function HomePage() {
  const view = useCashPilotStore((s) => s.view);
  const userId = useCashPilotStore((s) => s.userId);

  // Si on a un userId mais la vue n'est pas "app", on force "app"
  useEffect(() => {
    if (userId && view !== "app" && view !== "onboarding-tutorial") {
      useCashPilotStore.getState().setView("app");
    }
  }, [userId, view]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {view === "welcome" && <WelcomeScreen />}
        {view === "onboarding-phone" && <OnboardingPhoneScreen />}
        {view === "onboarding-code" && <OnboardingCodeScreen />}
        {view === "onboarding-pin" && <OnboardingPinScreen />}
        {view === "onboarding-tutorial" && <OnboardingTutorialScreen />}
        {view === "app" && <AppShell />}
      </motion.div>
    </AnimatePresence>
  );
}
