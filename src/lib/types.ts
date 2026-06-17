// CashPilot - Types partagés

export type UserLevel = "starter" | "croissance";

export type UserStatus = "active" | "paused";

export type TransactionType = "deposit" | "withdraw" | "gain";

export type MobileOperator = "mtn" | "orange";

export type AppView =
  | "welcome"
  | "onboarding-phone"
  | "onboarding-code"
  | "onboarding-pin"
  | "onboarding-tutorial"
  | "app";

export type AppTab = "home" | "history" | "account";

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
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // positif pour depot/gain, négatif pour retrait
  balanceAfter: number;
  description: string;
  operator?: MobileOperator | null;
  createdAt: string;
}

export interface RobotEvent {
  id: string;
  gain: number;
  market: string;
  pair: string;
  createdAt: string;
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
}

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  phone: string | null;
  pendingPhone: string | null;
  pendingCode: string | null;
}
