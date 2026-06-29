// CashPilot - Zustand store (client state with persistence)

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppView, AppTab, UserMode, AdminSection } from "./types";

interface CashPilotState {
  // Navigation
  view: AppView;
  tab: AppTab;
  // Session
  userId: string | null;
  phone: string | null;
  pendingPhone: string | null;
  // Onboarding
  hasSeenTutorial: boolean;
  // Mode (cache local pour la navigation; source de vérité = DB)
  mode: UserMode | null; // null = pas encore choisi
  // Contexte de sélection de mode (pour savoir où aller après)
  modeSelectionContext: "onboarding" | "switch";
  // UI
  depositOpen: boolean;
  withdrawOpen: boolean;
  subscriptionOpen: boolean; // dialog de paiement d'abonnement
  // Last gain animation trigger
  lastGainAmount: number | null;
  lastGainAt: number | null;
  // === Admin ===
  adminAuthed: boolean;
  adminSection: AdminSection;
  // Actions
  setView: (view: AppView) => void;
  setTab: (tab: AppTab) => void;
  setSession: (userId: string, phone: string) => void;
  setPendingPhone: (phone: string | null) => void;
  logout: () => void;
  markTutorialSeen: () => void;
  setMode: (mode: UserMode) => void;
  setModeSelectionContext: (ctx: "onboarding" | "switch") => void;
  setDepositOpen: (open: boolean) => void;
  setWithdrawOpen: (open: boolean) => void;
  setSubscriptionOpen: (open: boolean) => void;
  triggerGainAnimation: (amount: number) => void;
  clearGainAnimation: () => void;
  // Admin actions
  setAdminAuthed: (authed: boolean) => void;
  setAdminSection: (section: AdminSection) => void;
  adminLogout: () => void;
}

export const useCashPilotStore = create<CashPilotState>()(
  persist(
    (set) => ({
      view: "welcome",
      tab: "home",
      userId: null,
      phone: null,
      pendingPhone: null,
      hasSeenTutorial: false,
      mode: null,
      modeSelectionContext: "onboarding",
      depositOpen: false,
      withdrawOpen: false,
      subscriptionOpen: false,
      lastGainAmount: null,
      lastGainAt: null,
      adminAuthed: false,
      adminSection: "dashboard",

      setView: (view) => set({ view }),
      setTab: (tab) => set({ tab }),
      setSession: (userId, phone) => set({ userId, phone, view: "app", tab: "home" }),
      setPendingPhone: (phone) => set({ pendingPhone: phone }),
      logout: () =>
        set({
          userId: null,
          phone: null,
          pendingPhone: null,
          view: "welcome",
          tab: "home",
          hasSeenTutorial: false,
          mode: null,
        }),
      markTutorialSeen: () => set({ hasSeenTutorial: true }),
      setMode: (mode) => set({ mode }),
      setModeSelectionContext: (ctx) => set({ modeSelectionContext: ctx }),
      setDepositOpen: (open) => set({ depositOpen: open }),
      setWithdrawOpen: (open) => set({ withdrawOpen: open }),
      setSubscriptionOpen: (open) => set({ subscriptionOpen: open }),
      triggerGainAnimation: (amount) =>
        set({ lastGainAmount: amount, lastGainAt: Date.now() }),
      clearGainAnimation: () =>
        set({ lastGainAmount: null, lastGainAt: null }),
      setAdminAuthed: (authed) =>
        set({ adminAuthed: authed, view: authed ? "admin" : "welcome", adminSection: "dashboard" }),
      setAdminSection: (section) => set({ adminSection: section }),
      adminLogout: () =>
        set({ adminAuthed: false, view: "welcome", adminSection: "dashboard" }),
    }),
    {
      name: "cashpilot-store",
      partialize: (state) => ({
        userId: state.userId,
        phone: state.phone,
        hasSeenTutorial: state.hasSeenTutorial,
        view: state.adminAuthed
          ? "admin"
          : state.userId
          ? "app"
          : "welcome",
        tab: state.tab,
        mode: state.mode,
        adminAuthed: state.adminAuthed,
        adminSection: state.adminSection,
      }),
    }
  )
);
