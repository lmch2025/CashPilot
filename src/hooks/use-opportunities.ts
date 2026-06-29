"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useCashPilotStore } from "@/lib/store";
import type { Opportunity } from "@/lib/types";

export interface OpportunityStats {
  todayCount: number;
  totalReceived: number;
  totalExecuted: number;
}

interface UseOpportunitiesReturn {
  opportunities: Opportunity[];
  stats: OpportunityStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  actOnOpportunity: (
    opportunityId: string,
    action: "executed" | "skipped"
  ) => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000; // 30 secondes

/**
 * Hook qui charge les opportunités du mode alerts et rafraîchit toutes les 30s.
 * - Récupère userId depuis le store Zustand.
 * - Poll silencieusement (erreurs non-bloquantes).
 * - Permet d'agir sur une opportunité (executed/skipped) avec mise à jour optimiste.
 */
export function useOpportunities(): UseOpportunitiesReturn {
  const userId = useCashPilotStore((s) => s.userId);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<OpportunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pour éviter les appels concurrents et les fuites d'état après unmount
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    // Éviter deux fetch simultanés
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/opportunities?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!mountedRef.current) return;
      if (!json.ok) {
        throw new Error(json.error || "Erreur de chargement");
      }
      setOpportunities(json.opportunities ?? []);
      setStats(json.stats ?? null);
      setError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      // Silencieux: on garde l'erreur en interne sans spammer de toast
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  const actOnOpportunity = useCallback(
    async (
      opportunityId: string,
      action: "executed" | "skipped"
    ): Promise<void> => {
      if (!userId) return;

      // Mise à jour optimiste: on marque immédiatement la carte
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === opportunityId
            ? { ...o, status: action as Opportunity["status"] }
            : o
        )
      );

      try {
        const res = await fetch("/api/opportunities/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, opportunityId, action }),
        });
        const json = await res.json();
        if (!mountedRef.current) return;
        if (!json.ok) {
          throw new Error(json.error || "Action impossible");
        }
        // Appliquer la version serveur (cohérence des timestamps/status)
        const updated: Opportunity = json.opportunity;
        setOpportunities((prev) =>
          prev.map((o) => (o.id === opportunityId ? updated : o))
        );
      } catch {
        // Revenir à l'état serveur en cas d'échec
        if (mountedRef.current) {
          await refresh();
        }
      }
    },
    [userId, refresh]
  );

  // Charge initiale quand userId change
  useEffect(() => {
    mountedRef.current = true;
    if (!userId) {
      setLoading(false);
      setOpportunities([]);
      setStats(null);
      return;
    }
    setLoading(true);
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [userId, refresh]);

  // Polling toutes les 30s
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      // Polling silencieux: ne pas recharger l'état "loading"
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, refresh]);

  return {
    opportunities,
    stats,
    loading,
    error,
    refresh,
    actOnOpportunity,
  };
}
