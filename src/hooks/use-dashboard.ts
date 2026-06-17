"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { DashboardData } from "@/lib/types";
import { useCashPilotStore } from "@/lib/store";

interface UseDashboardReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastGain: { amount: number; at: number } | null;
}

/**
 * Hook qui charge les données du dashboard et poll le robot toutes les ~20 secondes.
 * Déclenche l'animation de gain quand un nouveau gain est détecté.
 */
export function useDashboard(): UseDashboardReturn {
  const userId = useCashPilotStore((s) => s.userId);
  const triggerGainAnimation = useCashPilotStore((s) => s.triggerGainAnimation);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastGain, setLastGain] = useState<{ amount: number; at: number } | null>(null);
  const lastBalanceRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/dashboard?userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || "Erreur de chargement");
      }
      const newData = json as DashboardData;
      // Détecter un nouveau gain (balance augmentée)
      if (
        lastBalanceRef.current !== null &&
        newData.user.balance > lastBalanceRef.current
      ) {
        const gain = newData.user.balance - lastBalanceRef.current;
        setLastGain({ amount: gain, at: Date.now() });
        triggerGainAnimation(gain);
      }
      lastBalanceRef.current = newData.user.balance;
      setData(newData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [userId, triggerGainAnimation]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    refresh();
  }, [userId, refresh]);

  // Polling du robot: toutes les 20 secondes, on appelle le tick
  useEffect(() => {
    if (!userId) return;
    const tick = async () => {
      try {
        const res = await fetch("/api/robot/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const json = await res.json();
        if (json.ok && json.acted) {
          // Le robot a fait un gain, on rafraîchit le dashboard
          await refresh();
        }
      } catch {
        // silencieux
      }
    };

    // Premier tick après 8s (laisser le temps de voir le dashboard initial)
    const initialTimeout = setTimeout(tick, 8000);
    const interval = setInterval(tick, 20000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [userId, refresh]);

  // Clear le "lastGain" après 4 secondes
  useEffect(() => {
    if (!lastGain) return;
    const t = setTimeout(() => setLastGain(null), 4000);
    return () => clearTimeout(t);
  }, [lastGain]);

  return { data, loading, error, refresh, lastGain };
}
