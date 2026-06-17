"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Shield, Zap, HeartHandshake, Sparkles } from "lucide-react";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { Button } from "@/components/ui/button";
import { useCashPilotStore } from "@/lib/store";
import { formatXAF } from "@/lib/utils";

export function WelcomeScreen() {
  const setView = useCashPilotStore((s) => s.setView);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen flex flex-col overflow-x-hidden"
    >
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <CashPilotLogo size={40} withText />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("onboarding-phone")}
            className="text-sm font-medium"
          >
            Se connecter
          </Button>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-10 sm:pt-16 pb-20">
        {/* Background decorative blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <motion.div
            className="absolute -top-20 -right-10 w-72 h-72 rounded-full opacity-20 blur-3xl"
            style={{ background: "oklch(0.78 0.13 88)" }}
            animate={{ scale: [1, 1.15, 1], x: [0, -20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-40 -left-20 w-80 h-80 rounded-full opacity-15 blur-3xl"
            style={{ background: "oklch(0.45 0.1 155)" }}
            animate={{ scale: [1, 1.2, 1], y: [0, 30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="text-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
            className="inline-flex"
          >
            <CashPilotLogo size={80} animated />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-6"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Sparkles className="w-3 h-3" />
              Cameroun · Dès 10 000 XAF
            </span>
          </motion.div>

          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="mt-5 font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05]"
          >
            Votre argent <br className="hidden sm:block" />
            <span className="text-brand-gradient">travaille</span> pour vous.
          </motion.h1>

          <motion.p
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="mt-5 mx-auto max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            Déposez votre argent via Mobile Money. Notre robot intelligent
            achète et revend pour vous, <strong className="text-foreground font-semibold">24h/24</strong>.
            Vous voyez vos gains grandir, sans rien faire.
          </motion.p>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.7 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button
              size="lg"
              onClick={() => setView("onboarding-phone")}
              className="w-full sm:w-auto h-13 px-7 text-base font-semibold rounded-xl shadow-soft group"
            >
              Commencer maintenant
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">2 minutes</span> pour s'inscrire
            </div>
          </motion.div>
        </motion.div>

        {/* Floating preview card */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="mt-14 mx-auto max-w-md"
        >
          <HeroPreviewCard />
        </motion.div>
      </section>

      {/* Three pillars */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            Simple. Sécurisé. Pour tous.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Pas besoin de connaître la technologie. CashPilot s'occupe de tout,
            comme un ami de confiance.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl bg-card border border-border/60 p-6 shadow-soft hover:shadow-soft-lg transition-shadow"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: p.bg }}
              >
                <p.icon className="w-6 h-6" style={{ color: p.color }} />
              </div>
              <h3 className="font-display font-semibold text-lg">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {p.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            Comment ça marche ?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Trois étapes, et votre argent se met à travailler.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="relative rounded-2xl bg-card border border-border/60 p-6 shadow-soft"
            >
              <div className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-gold-gradient flex items-center justify-center font-display font-bold text-sm text-accent-foreground shadow-gold">
                {i + 1}
              </div>
              <h3 className="font-display font-semibold text-lg mt-2">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Earnings teaser */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl bg-brand-gradient p-8 sm:p-12 text-primary-foreground shadow-soft-lg overflow-hidden relative"
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Combien puis-je gagner ?
            </h2>
            <p className="mt-2 text-primary-foreground/80 max-w-lg">
              Voici ce que vous pourriez gagner chaque mois, selon votre mise de départ.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {EARNINGS.map((e, i) => (
                <motion.div
                  key={e.capital}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="rounded-2xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 p-5"
                >
                  <div className="text-xs font-medium text-primary-foreground/70">
                    Vous déposez
                  </div>
                  <div className="font-display font-bold text-2xl mt-1">
                    {formatXAF(e.capital)} XAF
                  </div>
                  <div className="mt-3 text-xs font-medium text-primary-foreground/70">
                    Gain mensuel estimé
                  </div>
                  <div className="font-display font-bold text-xl text-[oklch(0.92 0.07 95)] mt-1">
                    {formatXAF(e.low)} – {formatXAF(e.high)} XAF
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="mt-6 text-xs text-primary-foreground/60 max-w-xl">
              Estimations indicatives basées sur les données de marché. Les performances passées ne garantissent pas les performances futures.
            </p>
          </div>
        </motion.div>
      </section>

      {/* CTA Final */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <CashPilotLogo size={56} className="mx-auto" />
          <h2 className="mt-6 font-display text-3xl sm:text-4xl font-bold">
            Prêt à faire travailler votre argent ?
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            Rejoignez les Camerounais qui génèrent des revenus automatiquement,
            dès 10 000 XAF.
          </p>
          <Button
            size="lg"
            onClick={() => setView("onboarding-phone")}
            className="mt-6 h-13 px-8 text-base font-semibold rounded-xl shadow-soft group"
          >
            Créer mon compte
            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CashPilotLogo size={36} withText />
            <div className="text-xs text-muted-foreground text-center sm:text-right">
              <p>CashPilot · Douala, Cameroun</p>
              <p className="mt-1">Votre argent travaille. 24h/24. Automatiquement.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroPreviewCard() {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      className="rounded-3xl bg-card border border-border/60 p-6 shadow-soft-lg"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[oklch(0.7_0.18_150)] robot-active-pulse" />
          <span className="text-xs font-medium text-muted-foreground">
            Votre robot est actif
          </span>
        </div>
        <span className="text-xs text-muted-foreground">24h/24</span>
      </div>

      <div className="mt-5">
        <div className="text-xs font-medium text-muted-foreground">
          Gains totaux
        </div>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="font-display font-extrabold text-3xl text-foreground"
        >
          42 850 XAF
        </motion.div>
        <div className="mt-1 text-xs font-semibold text-[oklch(0.45_0.1_155)]">
          +1 250 XAF aujourd'hui
        </div>
      </div>

      <div className="mt-4 h-16 flex items-end gap-1.5">
        {[40, 55, 45, 60, 70, 65, 80, 75, 90, 85, 95, 88, 100].map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: 1.4 + i * 0.04, duration: 0.4 }}
            className="flex-1 rounded-t bg-brand-gradient opacity-80"
            style={{ minHeight: 4 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

const PILLARS = [
  {
    icon: HeartHandshake,
    title: "Simple comme bonjour",
    desc: "Aucune connaissance technique. Déposez, regardez, retirez. C'est tout.",
    bg: "oklch(0.95 0.02 130)",
    color: "oklch(0.45 0.1 155)",
  },
  {
    icon: Shield,
    title: "Votre argent est protégé",
    desc: "Fonds séparés, PIN sécurisé, retrait possible à tout moment en 10 minutes.",
    bg: "oklch(0.95 0.03 90)",
    color: "oklch(0.6 0.13 85)",
  },
  {
    icon: Zap,
    title: "Le robot ne dort jamais",
    desc: "Il surveille 4 marchés en permanence, 24h/24, 7j/7, 365j/365.",
    bg: "oklch(0.95 0.02 155)",
    color: "oklch(0.45 0.1 155)",
  },
];

const STEPS = [
  {
    title: "Déposez via Mobile Money",
    desc: "MTN Money ou Orange Money, dès 10 000 XAF. Directement depuis l'app, sans frais cachés.",
  },
  {
    title: "Le robot travaille",
    desc: "Notre robot intelligent achète et revend automatiquement sur plusieurs marchés, en permanence.",
  },
  {
    title: "Retirez quand vous voulez",
    desc: "Vos gains sont disponibles en moins de 10 minutes sur votre Mobile Money, dès 2 000 XAF.",
  },
];

const EARNINGS = [
  { capital: 10000, low: 2000, high: 5000 },
  { capital: 50000, low: 15000, high: 30000 },
  { capital: 100000, low: 20000, high: 50000 },
];
