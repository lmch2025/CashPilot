// CashPilot - Configuration defaults (admin-editable)
// These are seeded into the Config table and editable via the admin interface.

export interface RobotConfig {
  dailyRateLow: number; // 0.006 = 0.6% per day
  dailyRateHigh: number; // 0.016 = 1.6% per day
  ticksPerDay: number; // number of robot ticks per day (for gain calc)
  demoMultiplier: number; // multiplier to make demo gains more visible
  successRate: number; // 0.85 = 85% chance of acting per tick
  minCapital: number; // minimum deposit to activate robot (XAF)
  commissionRate: number; // 0.10 = 10% commission on gains
  croissanceThreshold: number; // 50000 XAF to upgrade to Croissance level
}

export interface OpportunitiesConfig {
  generationIntervalSec: number; // how often the hook polls (client-side)
  maxActive: number; // max active opportunities per user
  minActiveToGenerate: number; // generate new if active < this
  spreadLow: number; // 0.01 = 1% min spread
  spreadHigh: number; // 0.04 = 4% max spread
  validUntilMinMin: number; // 5 minutes min validity
  validUntilMaxMin: number; // 15 minutes max validity
  usdtPriceLow: number; // 580 XAF min buy price for USDT
  usdtPriceHigh: number; // 610 XAF max buy price for USDT
  btcPriceLow: number; // 42M XAF min for BTC
  btcPriceHigh: number; // 45M XAF max for BTC
  usdcPriceLow: number; // USDC stablecoin min (same range as USDT)
  usdcPriceHigh: number; // USDC stablecoin max
  ethPriceLow: number; // Ethereum min (~2M XAF)
  ethPriceHigh: number; // Ethereum max (~2.5M XAF)
  trxPriceLow: number; // Tron min (~5 XAF, very low)
  trxPriceHigh: number; // Tron max (~7 XAF)
  solPriceLow: number; // Solana min (~150K XAF)
  solPriceHigh: number; // Solana max (~200K XAF)
  referenceCapital: number; // 50000 XAF reference for estimated gain
  markets: string[]; // enabled markets
  pairs: string[]; // enabled pairs
}

export interface GlobalConfig {
  minDeposit: number; // 10000 XAF
  minWithdraw: number; // 2000 XAF
  operatorsEnabled: string[]; // ["mtn", "orange"]
  supportWhatsapp: string;
  supportEmail: string;
  supportWebsite: string;
  maintenanceMode: boolean;
  smsEnabled: boolean; // enable SMS notifications
  pushEnabled: boolean; // enable push notifications
  withdrawDelayMin: number; // simulated withdraw delay (minutes) for display
  depositDelaySec: number; // simulated deposit delay (seconds)
}

export interface PlanConfig {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  period: string;
  tagline: string;
  color: string;
  features: string[];
  highlight: boolean;
  maxOpportunitiesPerDay: number; // -1 = illimité
  hasSmsAlerts: boolean;
  priorityAccess: boolean;
  supportHours: string;
  active: boolean; // can be toggled off by admin
}

export interface AdminConfig {
  accessCode: string; // admin access code
  sessionTimeoutMin: number; // admin session timeout
}

export const DEFAULT_ROBOT_CONFIG: RobotConfig = {
  dailyRateLow: 0.006,
  dailyRateHigh: 0.016,
  ticksPerDay: 150,
  demoMultiplier: 4,
  successRate: 0.85,
  minCapital: 10000,
  commissionRate: 0.10,
  croissanceThreshold: 50000,
};

export const DEFAULT_OPPORTUNITIES_CONFIG: OpportunitiesConfig = {
  generationIntervalSec: 30,
  maxActive: 5,
  minActiveToGenerate: 3,
  spreadLow: 0.01,
  spreadHigh: 0.04,
  validUntilMinMin: 5,
  validUntilMaxMin: 15,
  usdtPriceLow: 580,
  usdtPriceHigh: 610,
  btcPriceLow: 42000000,
  btcPriceHigh: 45000000,
  usdcPriceLow: 580,
  usdcPriceHigh: 610,
  ethPriceLow: 2000000,
  ethPriceHigh: 2500000,
  trxPriceLow: 5,
  trxPriceHigh: 7,
  solPriceLow: 150000,
  solPriceHigh: 200000,
  referenceCapital: 50000,
  markets: [
    "Binance P2P",
    "Yellow Card",
    "Paxful",
    "Bitget",
    "KuCoin P2P",
    "OKX P2P",
    "Remitano",
    "Bybit P2P",
  ],
  pairs: ["USDT/XAF", "BTC/XAF", "USDC/XAF", "ETH/XAF", "TRX/XAF", "SOL/XAF"],
};

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  minDeposit: 10000,
  minWithdraw: 2000,
  operatorsEnabled: ["mtn", "orange"],
  supportWhatsapp: "+237 XXX XXX XXX",
  supportEmail: "contact@cashpilot.africa",
  supportWebsite: "www.cashpilot.africa",
  maintenanceMode: false,
  smsEnabled: true,
  pushEnabled: true,
  withdrawDelayMin: 10,
  depositDelaySec: 3,
};

export const DEFAULT_PLANS_CONFIG: PlanConfig[] = [
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
    active: true,
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
    active: true,
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
    active: true,
  },
];

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  accessCode: "cashpilot2025",
  sessionTimeoutMin: 60,
};

// === Distribution config (gains exposure + prorata distribution) ===

export interface DistributionConfig {
  // Proportion des gains RÉELS exposés aux utilisateurs (0-1)
  // Ex: 0.5 = 50% du bénéfice réel est déclaré/distribué, 50% est retenu caché par la plateforme
  exposureRate: number;
  // Commission CashPilot prélevée sur les gains EXPOSÉS (0-1)
  // Ex: 0.10 = 10% des gains exposés vont à CashPilot, 90% aux utilisateurs
  commissionRate: number;
  // Mode d'arrondi des gains par utilisateur
  roundingMode: "floor" | "round" | "ceil";
  // Gain minimum par utilisateur par distribution (XAF) — évite les micro-gains
  minGainPerUser: number;
  // Intervalle minimum entre deux distributions (secondes) — anti double-distribution
  minIntervalSec: number;
  // Si true, les utilisateurs suspendus (status=paused) ne reçoivent pas de gains
  excludePausedUsers: boolean;
}

export const DEFAULT_DISTRIBUTION_CONFIG: DistributionConfig = {
  exposureRate: 0.5, // 50% du bénéfice réel exposé
  commissionRate: 0.1, // 10% de commission sur les gains exposés
  roundingMode: "round",
  minGainPerUser: 5, // minimum 5 XAF par utilisateur
  minIntervalSec: 15, // 15 secondes entre distributions
  excludePausedUsers: true,
};

// === Distribution state (cumulative stats, updated on each distribution) ===

export interface DistributionState {
  lastDistributionAt: string; // ISO date of last distribution
  totalActualProfit: number; // bénéfice réel total généré par les trades
  totalExposedProfit: number; // bénéfice total exposé aux utilisateurs
  totalCommission: number; // commission totale CashPilot
  totalHiddenRetention: number; // rétention cachée totale (platform profit)
  totalDistributedToUsers: number; // total effectivement distribué aux utilisateurs
  distributionCount: number; // nombre de distributions effectuées
  lastTradeActualProfit: number; // bénéfice réel du dernier trade
  lastTradeExposedProfit: number; // bénéfice exposé du dernier trade
  lastTradeUserCount: number; // nombre d'utilisateurs du dernier trade
  lastTradeTotalCapital: number; // capital total du dernier trade
}

export const DEFAULT_DISTRIBUTION_STATE: DistributionState = {
  lastDistributionAt: new Date(0).toISOString(),
  totalActualProfit: 0,
  totalExposedProfit: 0,
  totalCommission: 0,
  totalHiddenRetention: 0,
  totalDistributedToUsers: 0,
  distributionCount: 0,
  lastTradeActualProfit: 0,
  lastTradeExposedProfit: 0,
  lastTradeUserCount: 0,
  lastTradeTotalCapital: 0,
};

export const CONFIG_KEYS = {
  robot: "robot",
  opportunities: "opportunities",
  global: "global",
  plans: "plans",
  admin: "admin",
  distribution: "distribution",
  distributionState: "distribution-state",
  automation: "automation",
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

// === Automation config (opportunity scanner + API integration) ===

export interface AutomationConfig {
  // Mode global
  dryRun: boolean; // true = simulation (aucun trade réel), false = exécution réelle
  scannerEnabled: boolean; // active/désactive le scanner
  scanIntervalMin: number; // intervalle entre les scans (minutes) — pour cron-job.org

  // Plateformes activées
  platforms: {
    binance: boolean;
    bybit: boolean;
    yellowcard: boolean;
    noones: boolean;
    polymarket: boolean;
    kalshi: boolean;
    mintos: boolean;
    betfair: boolean;
  };

  // Types d'arbitrage activés
  arbitrageTypes: {
    p2pArbitrage: boolean;       // #1 USDT/FCFA P2P
    interPlatform: boolean;      // #2 inter-plateforme USDT
    triangular: boolean;         // #3 triangulaire crypto
    basisTrade: boolean;         // #4 spot vs futures
    staking: boolean;            // #5 staking rate
    fundingRate: boolean;        // #8 funding rate arbitrage
    predictionInternal: boolean; // #11 Polymarket interne
    predictionInter: boolean;    // #12 Polymarket vs Kalshi
    p2pLending: boolean;         // #13 Mintos
    sportsBetting: boolean;      // #14 Betfair/Smarkets
  };

  // Seuils de détection
  minSpreadPercent: number;      // spread minimum pour détecter une opportunité (ex: 0.5%)
  minEstimatedGain: number;      // gain minimum en XAF (ex: 500)
  maxRiskLevel: string;          // niveau de risque maximum ("low" | "medium" | "high")
  capitalReference: number;      // capital de référence pour calculer le gain (ex: 50000 XAF)

  // Auto-approbation
  autoApproveLowRisk: boolean;   // auto-approuver les opportunités low risk
  autoApproveSpreadMin: number;  // spread minimum pour auto-approbation (ex: 2%)

  // API keys (vide = utilise les endpoints publics)
  binanceApiKey: string;
  binanceApiSecret: string;
  bybitApiKey: string;
  bybitApiSecret: string;

  // ScraperApi (pour contourner les restrictions géographiques)
  scraperApiKey: string;         // clé ScraperApi
  useScraperForGeoblocked: boolean; // utiliser ScraperApi pour les plateformes géo-bloquées

  // cron-job.org
  cronJobOrgUrl: string;         // URL du webhook (ex: https://cash-pilot.vercel.app/api/cron/scan)
  cronJobOrgKey: string;         // clé secrète pour authentifier le cron
}

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  dryRun: true, // DRY-RUN par défaut — simulation seulement
  scannerEnabled: false, // désactivé par défaut, l'admin l'active
  scanIntervalMin: 5, // toutes les 5 minutes

  platforms: {
    binance: true,
    bybit: true,
    yellowcard: false, // pas d'API publique directe
    noones: false,
    polymarket: false,
    kalshi: false,
    mintos: false,
    betfair: false,
  },

  arbitrageTypes: {
    p2pArbitrage: true,
    interPlatform: true,
    triangular: true,
    basisTrade: false, // désactivé par défaut (niveau intermédiaire)
    staking: false,
    fundingRate: false,
    predictionInternal: false,
    predictionInter: false,
    p2pLending: false,
    sportsBetting: false,
  },

  minSpreadPercent: 0.5,
  minEstimatedGain: 500,
  maxRiskLevel: "medium",
  capitalReference: 50000,

  autoApproveLowRisk: false, // l'admin doit approuver manuellement par défaut
  autoApproveSpreadMin: 3,

  binanceApiKey: "",
  binanceApiSecret: "",
  bybitApiKey: "",
  bybitApiSecret: "",

  scraperApiKey: "",
  useScraperForGeoblocked: true,

  cronJobOrgUrl: "",
  cronJobOrgKey: "cashpilot-cron-secret-2025",
};
