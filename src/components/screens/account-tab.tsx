"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  User,
  Crown,
  MessageCircle,
  LogOut,
  Send,
  Loader2,
  Bot,
  Sparkles,
  Phone,
  Mail,
  Globe,
  ChevronRight,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCashPilotStore } from "@/lib/store";
import { formatXAF, formatPhoneDisplay } from "@/lib/utils";
import { toast } from "sonner";
import type { DashboardData } from "@/lib/types";

interface AccountTabProps {
  data: DashboardData;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AccountTab({ data }: AccountTabProps) {
  const { user } = data;
  const logout = useCashPilotStore((s) => s.logout);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Mon compte</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez votre profil et accédez au support.
        </p>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-gradient flex items-center justify-center text-primary-foreground font-display font-bold text-xl shrink-0">
            {user.name ? user.name[0].toUpperCase() : "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-lg truncate">
              {user.name || "Utilisateur CashPilot"}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatPhoneDisplay(user.phone)}
            </div>
          </div>
          <div
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
              user.level === "croissance"
                ? "bg-gold-gradient text-accent-foreground shadow-gold"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {user.level === "croissance" && <Crown className="w-3 h-3" />}
            {user.level === "croissance" ? "Croissance" : "Starter"}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-border/50">
          <div>
            <div className="text-xs text-muted-foreground">Membre depuis</div>
            <div className="font-display font-semibold text-sm mt-0.5">
              {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Échanges réalisés</div>
            <div className="font-display font-semibold text-sm mt-0.5">
              {user.totalExchanges}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Level card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
      >
        <div className="flex items-center gap-2 mb-4">
          <Crown
            className={`w-4 h-4 ${
              user.level === "croissance" ? "text-accent-foreground" : "text-muted-foreground"
            }`}
          />
          <h3 className="font-display font-semibold text-sm">Votre niveau</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <LevelCard
            name="Starter"
            active={user.level === "starter"}
            minCapital={10000}
            features={["Retrait < 10 min", "Rapport mensuel", "Support 48h"]}
          />
          <LevelCard
            name="Croissance"
            active={user.level === "croissance"}
            minCapital={50000}
            features={["Retrait < 5 min", "Rapport hebdo", "Support prioritaire 4h"]}
            highlight
          />
        </div>

        {user.level === "starter" && (
          <p className="mt-3 text-xs text-muted-foreground">
            💡 Déposez au moins {formatXAF(50000)} XAF pour passer au niveau Croissance et bénéficier de retraits prioritaires.
          </p>
        )}
      </motion.div>

      {/* Support section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft"
      >
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-sm">Support & aide</h3>
        </div>

        <Button
          onClick={() => setChatOpen(true)}
          className="w-full h-12 rounded-xl font-semibold group"
        >
          <Bot className="w-4 h-4 mr-2" />
          Parler à l'assistant CashPilot
          <Sparkles className="w-3 h-3 ml-2" />
        </Button>

        <div className="mt-3 space-y-2">
          <ContactRow
            icon={Phone}
            label="WhatsApp"
            value="+237 XXX XXX XXX"
            note="7j/7, 7h à 22h"
          />
          <ContactRow
            icon={Mail}
            label="Email"
            value="contact@cashpilot.africa"
          />
          <ContactRow
            icon={Globe}
            label="Site web"
            value="www.cashpilot.africa"
          />
        </div>
      </motion.div>

      {/* Transparency */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl bg-accent/30 border border-accent/60 p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-accent-foreground" />
          <h3 className="font-display font-semibold text-sm">Nos engagements</h3>
        </div>
        <ul className="space-y-2 text-sm text-foreground">
          <li className="flex items-start gap-2">
            <span className="text-[oklch(0.45_0.1_155)] font-bold">✓</span>
            <span>Aucun frais caché. Tous les frais sont affichés avant confirmation.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[oklch(0.45_0.1_155)] font-bold">✓</span>
            <span>Chaque opération du robot est visible dans votre historique.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[oklch(0.45_0.1_155)] font-bold">✓</span>
            <span>Vos fonds sont séparés de ceux de l'entreprise.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[oklch(0.45_0.1_155)] font-bold">✓</span>
            <span>Votre argent est disponible pour un retrait en moins de 10 minutes.</span>
          </li>
        </ul>
      </motion.div>

      {/* Logout */}
      <Button
        variant="outline"
        onClick={() => {
          logout();
          toast.success("Vous êtes déconnecté.");
        }}
        className="w-full h-12 rounded-xl font-semibold text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Se déconnecter
      </Button>

      <p className="text-center text-xs text-muted-foreground pb-2">
        CashPilot v1.0 · Douala, Cameroun 🌍
      </p>

      <SupportChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}

function LevelCard({
  name,
  active,
  minCapital,
  features,
  highlight,
}: {
  name: string;
  active: boolean;
  minCapital: number;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl p-3 border-2 transition-all ${
        active
          ? highlight
            ? "border-accent bg-accent/30 shadow-gold"
            : "border-primary bg-primary/5"
          : "border-border/60 bg-muted/30"
      }`}
    >
      {active && (
        <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-brand-gradient text-primary-foreground text-[10px] font-bold">
          Votre niveau
        </div>
      )}
      <div className="font-display font-bold text-sm mt-1">{name}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        dès {formatXAF(minCapital)} XAF
      </div>
      <ul className="mt-2 space-y-1">
        {features.map((f) => (
          <li key={f} className="text-[11px] text-foreground flex items-start gap-1">
            <span className="text-[oklch(0.45_0.1_155)] font-bold">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground truncate">{value}</div>
      </div>
      {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
    </div>
  );
}

// === Support Chat Dialog ===
function SupportChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Bonjour 👋 Je suis l'assistant CashPilot. Posez-moi vos questions en français, simplement.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-6),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setMessages([...newMessages, { role: "assistant", content: json.response }]);
      } else {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content:
              "Désolé, je suis temporairement indisponible. Écrivez-nous sur WhatsApp 💚",
          },
        ]);
      }
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Problème de connexion. Réessayez dans un instant.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden h-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-border/60 flex flex-row items-center gap-3 space-y-0">
          <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <DialogTitle className="font-display font-bold text-base">
              Assistant CashPilot
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-[oklch(0.7_0.18_150)]"
              />
              <span className="text-[11px] text-muted-foreground">
                En ligne · Répond en français
              </span>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3 bg-muted/30"
        >
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-brand-gradient text-primary-foreground rounded-br-md"
                    : "bg-card border border-border/60 text-foreground rounded-bl-md shadow-soft"
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-4 py-3 shadow-soft">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border/60 bg-card">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Posez votre question..."
              disabled={loading}
              className="flex-1 h-11 rounded-xl border border-border bg-background px-4 text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
            <Button
              onClick={send}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-11 w-11 rounded-xl shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
