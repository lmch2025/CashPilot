"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCashPilotStore } from "@/lib/store";
import { WelcomeScreen } from "@/components/screens/welcome-screen";
import { OnboardingPhoneScreen } from "@/components/screens/onboarding-phone-screen";
import { OnboardingCodeScreen } from "@/components/screens/onboarding-code-screen";
import { OnboardingPinScreen } from "@/components/screens/onboarding-pin-screen";
import { OnboardingTutorialScreen } from "@/components/screens/onboarding-tutorial-screen";
import { ModeSelectionScreen } from "@/components/screens/mode-selection-screen";
import { PlansScreen } from "@/components/screens/plans-screen";
import { AppShell } from "@/components/screens/app-shell";
import { AdminLoginScreen } from "@/components/admin/admin-login-screen";
import { AdminShell } from "@/components/admin/admin-shell";
import { useEffect } from "react";

// Vues valides pour un utilisateur connecté (les autres forcent "app")
const AUTHED_VIEWS = new Set([
  "app",
  "onboarding-tutorial",
  "mode-selection",
  "plans",
]);

export default function HomePage() {
  const view = useCashPilotStore((s) => s.view);
  const userId = useCashPilotStore((s) => s.userId);
  const adminAuthed = useCashPilotStore((s) => s.adminAuthed);

  // Si on a un userId mais la vue n'est pas autorisée, on force "app"
  // (sauf si on est en mode admin)
  useEffect(() => {
    if (adminAuthed) return;
    if (userId && !AUTHED_VIEWS.has(view)) {
      useCashPilotStore.getState().setView("app");
    }
  }, [userId, view, adminAuthed]);

  // Admin prend la priorité
  if (adminAuthed || view === "admin") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="admin"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AdminShell />
        </motion.div>
      </AnimatePresence>
    );
  }

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
        {view === "mode-selection" && <ModeSelectionScreen />}
        {view === "plans" && <PlansScreen />}
        {view === "admin-login" && <AdminLoginScreen />}
        {view === "app" && <AppShell />}
      </motion.div>
    </AnimatePresence>
  );
}
