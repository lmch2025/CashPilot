// CashPilot - Market data shared types
// Types communs pour les fetchers de données de marché (Binance, Bybit, etc.)

/**
 * Prix de marché spot (ou ticker) pour une paire donnée.
 * Ex: Binance BTC/USDT → { platform: "binance", pair: "BTC/USDT", price: 65000.5, ... }
 */
export interface MarketPrice {
  platform: string; // "binance" | "bybit" | ...
  pair: string; // "BTC/USDT" | "ETH/USDT" | "USDT/XAF" | ...
  price: number; // prix actuel (dernier trade)
  bid?: number; // meilleur prix d'achat (bid)
  ask?: number; // meilleur prix de vente (ask)
  volume24h?: number; // volume 24h en base currency
}

/**
 * Prix P2P pour un actif donné (ex: USDT en XAF).
 * tradeType "BUY" = utilisateurs achètent USDT (prix généralement + élevé).
 * tradeType "SELL" = utilisateurs vendent USDT (prix généralement - élevé).
 */
export interface P2PPrice {
  platform: string; // "binance" | "bybit" | ...
  asset: string; // "USDT" | "BTC" | ...
  fiat: string; // "XAF" | "USD" | ...
  tradeType: "BUY" | "SELL"; // BUY = acheter l'asset, SELL = vendre l'asset
  price: number; // prix unitaire en fiat
  availableAmount?: number; // montant disponible (en asset)
  minLimit?: number; // limite minimum (en fiat)
  maxLimit?: number; // limite maximum (en fiat)
  advertiserName?: string; // nom du vendeur/acheteur
  paymentMethods?: string[]; // méthodes de paiement acceptées
}

/**
 * Taux de financement pour contrats perpétuels (futures).
 * Utilisé pour l'arbitrage cash & carry (spot vs futures).
 */
export interface FundingRate {
  platform: string; // "binance" | ...
  symbol: string; // "BTCUSDT" | ...
  fundingRate: number; // taux de financement (ex: 0.0001 = 0.01%)
  markPrice: number; // prix mark actuel
  nextFundingTime?: number; // timestamp du prochain financement (ms)
}

/**
 * Résultat d'un fetch groupé (toutes les plateformes).
 * Utilisé pour agréger les données avant détection.
 */
export interface MarketSnapshot {
  spotPrices: MarketPrice[];
  p2pPrices: P2PPrice[];
  fundingRates: FundingRate[];
  fetchedAt: Date;
  errors: string[]; // erreurs non fatales (une plateforme a échoué)
}
