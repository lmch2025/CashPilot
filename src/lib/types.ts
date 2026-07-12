// CashPilot - Types partagés

export type UserLevel = "starter" | "croissance";

export type UserStatus = "active" | "paused";

// Nouveau: mode de fonctionnement
export type UserMode = "managed" | "alerts";

export type TransactionType = "deposit" | "withdraw" | "gain" | "subscription";

export type MobileOperator = "mtn" | "orange";

// Nouveau: identifiants de plans d'abonnement
export type SubscriptionPlanId = "decouverte" | "standard" | "premium";

export type OpportunityStatus = "active" | "expired" | "executed" | "skipped";

export type AppView =
  | "welcome"
  | "onboarding-phone"
  | "onboarding-code"
  | "onboarding-pin"
  | "onboarding-tutorial"
  | "mode-selection" // Nouveau: choix entre managed et alerts
  | "plans" // Nouveau: sélection du plan d'abonnement (mode alerts)
  | "admin-login" // Nouveau: accès admin
  | "app"
  | "admin"; // Nouveau: interface admin

export type AppTab = "home" | "opportunities" | "history" | "account";

export interface User {
  id: string;
  phone: string;
  name: string | null;
  level: UserLevel;
  balance: number;
  capital: number;
  totalGains: number;
  totalExchanges: number;
  status: UserStatus;
  // Nouveau
  mode: UserMode;
  subscriptionPlan: SubscriptionPlanId | null;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // positif pour depot/gain/subscription, négatif pour retrait
  balanceAfter: number;
  description: string;
  operator?: MobileOperator | null;
  planId?: SubscriptionPlanId | null; // Nouveau: pour type=subscription
  createdAt: string;
}

export interface RobotEvent {
  id: string;
  gain: number;
  market: string;
  pair: string;
  createdAt: string;
}

// Nouveau: Opportunité d'achat-vente (mode alerts)
export interface Opportunity {
  id: string;
  market: string;
  pair: string;
  buyPrice: number;
  sellPrice: number;
  estimatedGain: number;
  estimatedGainPercent: number;
  validUntil: string;
  status: OpportunityStatus;
  createdAt: string;
}

// Nouveau: Définition d'un plan d'abonnement
export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  price: number; // en XAF par mois
  priceLabel: string;
  period: string;
  tagline: string;
  color: string; // couleur d'accent oklch
  features: string[];
  highlight: boolean;
  maxOpportunitiesPerDay: number; // -1 = illimité
  hasSmsAlerts: boolean;
  priorityAccess: boolean; // accès anticipé aux opportunités
  supportHours: string; // ex: "48h", "24h", "4h"
}

export interface DashboardData {
  user: User;
  todayGains: number;
  todayExchanges: number;
  lastExchange: {
    gain: number;
    market: string;
    pair: string;
    createdAt: string;
  } | null;
  recentTransactions: Transaction[];
  gainsHistory: { time: string; value: number }[];
  // Nouveau: infos d'abonnement (pour le mode alerts)
  subscription: {
    isActive: boolean;
    daysRemaining: number;
    plan: SubscriptionPlan | null;
  };
  // Nouveau: stats d'opportunités (pour le mode alerts)
  opportunitiesStats: {
    todayCount: number;
    totalReceived: number;
    totalExecuted: number;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  phone: string | null;
  pendingPhone: string | null;
  pendingCode: string | null;
}

// === Admin types ===

export type AdminSection =
  | "dashboard"
  | "users"
  | "transactions"
  | "robot"
  | "distribution"
  | "opportunities"
  | "scanner"
  | "plans"
  | "settings";

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  level: UserLevel;
  balance: number;
  capital: number;
  totalGains: number;
  totalExchanges: number;
  status: UserStatus;
  mode: UserMode;
  subscriptionPlan: SubscriptionPlanId | null;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

export interface AdminTransaction {
  id: string;
  userId: string;
  userPhone: string;
  userName: string | null;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  operator: MobileOperator | null;
  planId: SubscriptionPlanId | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  managedUsers: number;
  alertsUsers: number;
  activeSubscriptions: number;
  totalCapital: number;
  totalGains: number;
  totalExchanges: number;
  mrr: number; // monthly recurring revenue from subscriptions
  totalDeposits: number;
  totalWithdrawals: number;
  totalSubscriptionRevenue: number;
  // Pour les graphiques
  usersGrowth: { date: string; count: number }[];
  revenueByPlan: { plan: string; count: number; revenue: number }[];
  transactionsByType: { type: string; count: number; amount: number }[];
  // Métriques de la distribution pool-based
  distribution?: AdminDistributionStats;
}

export interface AdminDistributionStats {
  totalActualProfit: number;
  totalExposedProfit: number;
  totalCommission: number;
  totalHiddenRetention: number;
  totalDistributedToUsers: number;
  distributionCount: number;
  lastTradeActualProfit: number;
  lastTradeUserCount: number;
  lastTradeAt: string;
}
