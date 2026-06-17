// CashPilot - Zustand store (client state with persistence)

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppView, AppTab } from "./types";

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
  // UI
  depositOpen: boolean;
  withdrawOpen: boolean;
  // Last gain animation trigger
  lastGainAmount: number | null;
  lastGainAt: number | null;
  // Actions
  setView: (view: AppView) => void;
  setTab: (tab: AppTab) => void;
  setSession: (userId: string, phone: string) => void;
  setPendingPhone: (phone: string | null) => void;
  logout: () => void;
  markTutorialSeen: () => void;
  setDepositOpen: (open: boolean) => void;
  setWithdrawOpen: (open: boolean) => void;
  triggerGainAnimation: (amount: number) => void;
  clearGainAnimation: () => void;
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
      depositOpen: false,
      withdrawOpen: false,
      lastGainAmount: null,
      lastGainAt: null,

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
        }),
      markTutorialSeen: () => set({ hasSeenTutorial: true }),
      setDepositOpen: (open) => set({ depositOpen: open }),
      setWithdrawOpen: (open) => set({ withdrawOpen: open }),
      triggerGainAnimation: (amount) =>
        set({ lastGainAmount: amount, lastGainAt: Date.now() }),
      clearGainAnimation: () =>
        set({ lastGainAmount: null, lastGainAt: null }),
    }),
    {
      name: "cashpilot-store",
      partialize: (state) => ({
        userId: state.userId,
        phone: state.phone,
        hasSeenTutorial: state.hasSeenTutorial,
        view: state.userId ? "app" : "welcome",
        tab: state.tab,
      }),
    }
  )
);
