// CashPilot - Définitions des plans d'abonnement (mode alerts)
// Ces plans sont affichés à l'utilisateur lors du choix du mode "CashPilot alerte"

import type { SubscriptionPlan, SubscriptionPlanId } from "./types";

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "decouverte",
    name: "Découverte",
    price: 5000,
    priceLabel: "5 000 XAF",
    period: "mois",
    tagline: "Pour tester en douceur",
    color: "oklch(0.55 0.09 152)",
    features: [
      "10 opportunités par jour",
      "Alertes en temps réel dans l'app",
      "Guide pas-à-pas pour chaque opportunité",
      "Toutes les plateformes surveillées",
      "Support WhatsApp (réponse sous 48h)",
    ],
    highlight: false,
    maxOpportunitiesPerDay: 10,
    hasSmsAlerts: false,
    priorityAccess: false,
    supportHours: "48h",
  },
  {
    id: "standard",
    name: "Standard",
    price: 15000,
    priceLabel: "15 000 XAF",
    period: "mois",
    tagline: "Le préféré des utilisateurs",
    color: "oklch(0.7 0.13 85)",
    features: [
      "Opportunités illimitées",
      "Alertes Push + SMS en temps réel",
      "Calcul automatique du gain estimé",
      "Toutes les plateformes surveillées",
      "Support WhatsApp (réponse sous 24h)",
    ],
    highlight: true,
    maxOpportunitiesPerDay: -1,
    hasSmsAlerts: true,
    priorityAccess: false,
    supportHours: "24h",
  },
  {
    id: "premium",
    name: "Premium",
    price: 30000,
    priceLabel: "30 000 XAF",
    period: "mois",
    tagline: "Pour maximiser ses gains",
    color: "oklch(0.45 0.1 155)",
    features: [
      "Tout Standard inclus",
      "Opportunités prioritaires (15 min d'avance)",
      "Analyses de marché détaillées",
      "Rapport hebdomadaire personnalisé",
      "Support prioritaire (réponse sous 4h)",
    ],
    highlight: false,
    maxOpportunitiesPerDay: -1,
    hasSmsAlerts: true,
    priorityAccess: true,
    supportHours: "4h",
  },
];

export function getPlanById(id: string | null | undefined): SubscriptionPlan | null {
  if (!id) return null;
  return SUBSCRIPTION_PLANS.find((p) => p.id === id) || null;
}

// Marchés surveillés (pour l'affichage)
export const MARKETS = [
  { name: "Binance P2P", emoji: "🟡", color: "oklch(0.85 0.15 70)" },
  { name: "Yellow Card", emoji: "🟣", color: "oklch(0.65 0.15 300)" },
  { name: "Paxful", emoji: "🔵", color: "oklch(0.6 0.15 250)" },
  { name: "Bitget", emoji: "🟢", color: "oklch(0.7 0.15 150)" },
];
