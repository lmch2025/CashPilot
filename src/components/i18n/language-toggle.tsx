"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from "@/lib/i18n/dictionaries";

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

export function LanguageToggle({ compact = false, className }: LanguageToggleProps) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border/60 px-3 h-9 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
        aria-label="Language selector"
      >
        <Globe className="w-3.5 h-3.5 text-primary" />
        <span>{LOCALE_FLAGS[locale]}</span>
        {!compact && <span>{LOCALE_LABELS[locale]}</span>}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 min-w-[160px] rounded-xl bg-card border border-border/60 shadow-soft-lg overflow-hidden"
          >
            {LOCALES.map((loc: Locale) => (
              <button
                key={loc}
                onClick={() => {
                  setLocale(loc);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  locale === loc
                    ? "bg-primary/5 text-primary font-semibold"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="text-base">{LOCALE_FLAGS[loc]}</span>
                <span className="flex-1 text-left">{LOCALE_LABELS[loc]}</span>
                {locale === loc && <Check className="w-4 h-4" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
