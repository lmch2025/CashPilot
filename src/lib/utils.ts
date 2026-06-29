import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createHash } from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un montant en XAF avec séparateur de milliers (espaces).
 * Ex: 15000 -> "15 000"
 */
export function formatXAF(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("fr-FR").replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
  return amount < 0 ? `-${formatted}` : formatted;
}

/**
 * Formate un montant avec le suffixe "XAF"
 */
export function formatXAFWithSymbol(amount: number): string {
  return `${formatXAF(amount)} XAF`;
}

/**
 * Hash le PIN avec SHA-256 + salt (synchrone, utilise Node.js crypto).
 * Compatible avec tous les environnements (dev, Vercel serverless, etc.).
 */
export function hashPin(pin: string): string {
  return createHash("sha256")
    .update(`cashpilot-salt::${pin}`)
    .digest("hex");
}

/**
 * Vérifie un PIN contre son hash
 */
export function verifyPin(pin: string, hash: string): boolean {
  const computed = hashPin(pin);
  return computed === hash;
}

/**
 * Génère un code SMS à 4 chiffres
 */
export function generateSmsCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Valide un numéro de téléphone camerounais
 * Formats acceptés: 6XXXXXXXX, +2376XXXXXXXX, 2376XXXXXXXX
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+237")) {
    cleaned = cleaned.slice(4);
  } else if (cleaned.startsWith("237")) {
    cleaned = cleaned.slice(3);
  }
  return cleaned;
}

export function isValidCameroonPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^6[5-9]\d{7}$/.test(normalized);
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 9) {
    return `+237 ${normalized.slice(0, 2)} ${normalized.slice(2, 5)} ${normalized.slice(5, 7)} ${normalized.slice(7, 9)}`;
  }
  return phone;
}

/**
 * Formate une date en français, format relatif (il y a X min)
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 30) return "à l'instant";
  if (diffMin < 1) return `il y a ${diffSec}s`;
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour}h`;
  if (diffDay < 7) return `il y a ${diffDay}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export function isThisWeek(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
}

export function isThisMonth(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  );
}

// === LocalStorage settings helper (Task 2-c-dash) ===
// Type-safe localStorage wrapper for user preferences.
const SETTINGS_PREFIX = "cashpilot-setting:";

export function getSetting(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SETTINGS_PREFIX + key);
    if (raw === null) return false;
    return raw === "true";
  } catch {
    return false;
  }
}

export function setSetting(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_PREFIX + key, String(value));
    // Notify listeners (other components on the same page)
    window.dispatchEvent(
      new CustomEvent("cashpilot-setting-change", { detail: { key, value } })
    );
  } catch {
    // ignore
  }
}

/**
 * Compute a live countdown to a future date.
 * Returns days, hours, minutes (and whether expired).
 */
export interface Countdown {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
}

export function computeCountdown(targetIso: string | null): Countdown | null {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const totalMs = target - now;
  if (totalMs <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, totalMs: 0 };
  }
  const days = Math.floor(totalMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((totalMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000));
  return { expired: false, days, hours, minutes, totalMs };
}
