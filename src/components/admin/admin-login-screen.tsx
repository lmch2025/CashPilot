"use client";

import { motion } from "framer-motion";
import { useState, useRef } from "react";
import { ArrowLeft, Loader2, Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { useCashPilotStore } from "@/lib/store";
import { toast } from "sonner";

export function AdminLoginScreen() {
  const setView = useCashPilotStore((s) => s.setView);
  const setAdminAuthed = useCashPilotStore((s) => s.setAdminAuthed);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!code.trim()) {
      setError("Entrez le code d'accès admin.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Code incorrect.");
        setCode("");
        inputRef.current?.focus();
        return;
      }
      toast.success("Accès admin accordé");
      setAdminAuthed(true);
    } catch {
      setError("Problème de connexion. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="px-4 sm:px-6 h-16 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("welcome")}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
              className="inline-flex w-16 h-16 rounded-2xl bg-muted items-center justify-center mx-auto border-2 border-border"
            >
              <Shield className="w-8 h-8 text-muted-foreground" />
            </motion.div>
            <h1 className="mt-6 font-display text-2xl font-bold">
              Accès administration
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Cette zone est réservée aux administrateurs de CashPilot.
              Entrez votre code d'accès.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <label className="text-sm font-medium text-foreground">
              Code d'accès
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="password"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) handleSubmit();
                }}
                placeholder="••••••••"
                className="pl-10 h-13 text-lg rounded-xl"
                autoFocus
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!code.trim() || loading}
              size="lg"
              className="w-full h-13 font-semibold rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Accéder à l'administration"
              )}
            </Button>
          </div>

          <div className="mt-6 rounded-xl bg-muted/60 border border-border/60 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Démo — code par défaut:{" "}
              <code className="font-mono font-semibold text-foreground">
                cashpilot2025
              </code>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
