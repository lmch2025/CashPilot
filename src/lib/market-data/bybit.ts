// CashPilot - Bybit market data fetcher
// Récupère les vraies données de marché depuis les APIs publiques Bybit.
//
// Endpoints utilisés (aucune authentification requise pour les endpoints publics):
//  - Spot tickers:    https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT
//  - P2P item list:   https://api2.bybit.com/fiat/otc/item/online (POST)
//
// Notes:
//  - Tous les appels HTTP ont un timeout de 8s (AbortController) — Vercel hobby = 10s max.
//  - Si config.useScraperForGeoblocked && config.scraperApiKey, on route via ScraperApi.
//  - Les erreurs d'un endpoint ne font jamais crasher le fetcher: on log et on renvoie [].

import { db } from "@/lib/db";
import type { AutomationConfig } from "@/lib/config-defaults";
import type { MarketPrice, P2PPrice } from "./types";

const SPOT_ENDPOINT = "https://api.bybit.com/v5/market/tickers";
const P2P_ENDPOINT = "https://api2.bybit.com/fiat/otc/item/online";

const SPOT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const TIMEOUT_MS = 8000;

function buildUrl(url: string, config: AutomationConfig): string {
  if (config.useScraperForGeoblocked && config.scraperApiKey) {
    return `https://api.scraperapi.com/?api_key=${encodeURIComponent(
      config.scraperApiKey
    )}&url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        ...(init?.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function persistMarketData(
  platform: string,
  pair: string,
  price: number,
  extra: { bid?: number; ask?: number; volume24h?: number; rawData?: unknown } = {}
): Promise<void> {
  try {
    await db.marketData.create({
      data: {
        platform,
        pair,
        price,
        bid: extra.bid ?? null,
        ask: extra.ask ?? null,
        volume24h: extra.volume24h ?? null,
        rawData: extra.rawData ? JSON.stringify(extra.rawData) : null,
      },
    });
  } catch (err) {
    console.error(`[bybit] persistMarketData(${platform}, ${pair}) error:`, err);
  }
}

/**
 * Fetch spot tickers for configured symbols.
 * Bybit v5 returns shape: { result: { list: [{ symbol, lastPrice, bid1Price, ask1Price, volume24h }] } }
 */
export async function fetchBybitSpotPrices(
  config: AutomationConfig
): Promise<MarketPrice[]> {
  const settled = await Promise.allSettled(
    SPOT_SYMBOLS.map(async (symbol): Promise<MarketPrice> => {
      const url = buildUrl(
        `${SPOT_ENDPOINT}?category=spot&symbol=${symbol}`,
        config
      );
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Bybit spot ${symbol} HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        retCode: number;
        retMsg: string;
        result?: {
          list?: Array<{
            symbol: string;
            lastPrice: string;
            bid1Price: string;
            ask1Price: string;
            volume24h: string;
            turnover24h: string;
          }>;
        };
      };
      if (data.retCode !== 0 || !data.result?.list?.length) {
        throw new Error(
          `Bybit spot ${symbol} API error: ${data.retMsg} (code ${data.retCode})`
        );
      }
      const row = data.result.list[0];
      const price = parseFloat(row.lastPrice);
      const bid = parseFloat(row.bid1Price);
      const ask = parseFloat(row.ask1Price);
      const volume24h = parseFloat(row.turnover24h);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`Bybit spot ${symbol} prix invalide: ${row.lastPrice}`);
      }
      const pair = symbolToPair(symbol);
      const mp: MarketPrice = {
        platform: "bybit",
        pair,
        price,
        bid,
        ask,
        volume24h,
      };
      await persistMarketData("bybit", pair, price, { bid, ask, volume24h, rawData: row });
      return mp;
    })
  );

  const results: MarketPrice[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      results.push(s.value);
    } else {
      console.error(
        `[bybit] spot ${SPOT_SYMBOLS[i]} failed:`,
        (s.reason as Error)?.message ?? s.reason
      );
    }
  }
  return results;
}

/**
 * Fetch Bybit P2P quotes for USDT/XAF.
 * Bybit P2P API is undocumented and unstable; we wrap it defensively.
 * Returns BUY and SELL quotes (2 POST calls).
 */
export async function fetchBybitP2PPrices(
  config: AutomationConfig,
  asset: string = "USDT",
  fiat: string = "XAF"
): Promise<P2PPrice[]> {
  const tradeTypes: Array<"BUY" | "SELL"> = ["BUY", "SELL"];

  const settled = await Promise.allSettled(
    tradeTypes.map(async (tradeType): Promise<P2PPrice[]> => {
      // Bybit uses "0" = buy, "1" = sell in some endpoints; this varies.
      // We try the standard side param first.
      const body = {
        userId: "",
        tokenId: asset,
        currencyId: fiat,
        payment: [],
        side: tradeType === "BUY" ? "0" : "1",
        size: 5,
        page: 1,
        amount: "",
        authMaker: false,
        canTrade: false,
      };
      const url = buildUrl(P2P_ENDPOINT, config);
      const res = await fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(
          `Bybit P2P ${asset}/${fiat} ${tradeType} HTTP ${res.status}`
        );
      }
      const data = (await res.json()) as {
        ret_code?: number;
        ret_msg?: string;
        result?: {
          items?: Array<{
            price?: string;
            quantity?: string;
            nickName?: string;
            payments?: string[];
            minAmount?: string;
            maxAmount?: string;
          }>;
        };
      };
      if (data.ret_code !== 0 || !data.result?.items?.length) {
        // Bybit P2P often geo-blocks; return empty instead of crashing.
        return [];
      }
      const p2pPrices: P2PPrice[] = data.result.items.slice(0, 3).map((row) => ({
        platform: "bybit",
        asset,
        fiat,
        tradeType,
        price: parseFloat(row.price ?? "0"),
        availableAmount: row.quantity ? parseFloat(row.quantity) : undefined,
        minLimit: row.minAmount ? parseFloat(row.minAmount) : undefined,
        maxLimit: row.maxAmount ? parseFloat(row.maxAmount) : undefined,
        advertiserName: row.nickName,
        paymentMethods: row.payments,
      }));

      if (p2pPrices.length > 0) {
        const best = p2pPrices[0];
        if (Number.isFinite(best.price) && best.price > 0) {
          const pair = `${asset}/${fiat}`;
          await persistMarketData("bybit_p2p", pair, best.price, {
            rawData: { ...best, tradeType },
          });
        }
      }
      return p2pPrices;
    })
  );

  const results: P2PPrice[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      results.push(...s.value);
    } else {
      console.error(
        `[bybit] P2P ${asset}/${fiat} ${tradeTypes[i]} failed:`,
        (s.reason as Error)?.message ?? s.reason
      );
    }
  }
  return results;
}

function symbolToPair(symbol: string): string {
  const quotes = ["USDT", "USDC", "BUSD", "BTC", "ETH", "BNB", "XAF"];
  for (const q of quotes) {
    if (symbol.endsWith(q)) {
      return `${symbol.slice(0, -q.length)}/${q}`;
    }
  }
  return symbol;
}
