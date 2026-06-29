"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Eye,
  Ban,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users as UsersIcon,
  X,
  ArrowUpDown,
  Phone,
  Crown,
  Bot,
  Bell,
  Wallet,
  TrendingUp,
  Repeat,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatXAF,
  formatDateTime,
  formatPhoneDisplay,
} from "@/lib/utils";
import { toast } from "sonner";
import { SUBSCRIPTION_PLANS } from "@/lib/plans";
import type {
  AdminUser,
  AdminTransaction,
  UserMode,
  UserStatus,
  UserLevel,
  TransactionType,
} from "@/lib/types";

// === Types locaux ===

type ModeFilter = "all" | UserMode;
type StatusFilter = "all" | UserStatus;
type SortField = "createdAt" | "balance" | "totalGains" | "totalExchanges";
type SortOrder = "asc" | "desc";

interface UsersResponse {
  ok: boolean;
  users?: AdminUser[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
}

interface UserDetailResponse {
  ok: boolean;
  user?: AdminUser;
  // Le contrat spec dit "transactions", mais l'implémentation actuelle renvoie
  // "recentTransactions". On accepte les deux.
  transactions?: AdminTransaction[];
  recentTransactions?: AdminTransaction[];
  error?: string;
}

interface PatchResponse {
  ok: boolean;
  user?: AdminUser;
  error?: string;
}

// === Helpers ===

const PAGE_SIZE = 20;

function planName(planId: string | null): string | null {
  if (!planId) return null;
  const p = SUBSCRIPTION_PLANS.find((x) => x.id === planId);
  return p ? p.name : planId;
}

function daysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// === Badges ===

function ModeBadge({ mode }: { mode: UserMode }) {
  const isManaged = mode === "managed";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        isManaged
          ? "bg-primary/10 text-primary border border-primary/20"
          : "bg-accent/40 text-accent-foreground border border-accent/60"
      }`}
    >
      {isManaged ? (
        <Bot className="w-3 h-3" />
      ) : (
        <Bell className="w-3 h-3" />
      )}
      {isManaged ? "Géré" : "Alerte"}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        isActive
          ? "bg-primary/10 text-primary border border-primary/20"
          : "bg-destructive/10 text-destructive border border-destructive/20"
      }`}
    >
      {isActive ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <Ban className="w-3 h-3" />
      )}
      {isActive ? "Actif" : "Suspendu"}
    </span>
  );
}

function LevelBadge({ level }: { level: UserLevel }) {
  const isStarter = level === "starter";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
        isStarter
          ? "bg-muted text-muted-foreground border-border/60"
          : "bg-primary/10 text-primary border-primary/20"
      }`}
    >
      {isStarter ? "Starter" : "Croissance"}
    </span>
  );
}

function TxTypeBadge({ type }: { type: TransactionType }) {
  const styles: Record<TransactionType, string> = {
    gain: "bg-primary/10 text-primary border-primary/20",
    deposit: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    withdraw: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    subscription: "bg-accent/40 text-accent-foreground border-accent/60",
  };
  const labels: Record<TransactionType, string> = {
    gain: "Gain",
    deposit: "Dépôt",
    withdraw: "Retrait",
    subscription: "Abonnement",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[type]}`}
    >
      {labels[type]}
    </span>
  );
}

// === Composant principal ===

export function AdminUsersView() {
  // Filtres
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort: sortField,
        order: sortOrder,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (modeFilter !== "all") params.set("mode", modeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const json: UsersResponse = await res.json();
      if (json.ok) {
        setUsers(json.users ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      } else {
        toast.error(json.error || "Erreur lors du chargement.");
        setUsers([]);
      }
    } catch {
      toast.error("Problème de connexion au serveur.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, modeFilter, statusFilter, sortField, sortOrder]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleStatus = async (
    user: AdminUser,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    const newStatus: UserStatus =
      user.status === "active" ? "paused" : "active";
    const label = newStatus === "active" ? "activé" : "suspendu";
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json: PatchResponse = await res.json();
      if (json.ok) {
        toast.success(`Utilisateur ${label}.`, {
          description: formatPhoneDisplay(user.phone),
        });
        // Mettre à jour localement + recharger la liste
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
        );
        loadUsers();
      } else {
        toast.error(json.error || "Échec de la mise à jour.");
      }
    } catch {
      toast.error("Problème de connexion.");
    }
  };

  // Pages à afficher (max 5)
  const visiblePages = buildVisiblePages(page, totalPages);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-soft">
            <UsersIcon className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Utilisateurs</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gérez et suivez les comptes CashPilot
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border/60 shadow-soft">
          <UsersIcon className="w-3.5 h-3.5 text-primary" />
          <span className="font-display font-bold text-sm tabular-nums">
            {total}
          </span>
          <span className="text-xs text-muted-foreground">
            {total > 1 ? "utilisateurs" : "utilisateur"}
          </span>
        </div>
      </div>

      {/* Filters bar (sticky) */}
      <div className="sticky top-0 z-30 -mx-2 sm:-mx-4 px-2 sm:px-4 py-3 bg-background/85 backdrop-blur-md border-b border-border/40">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="tel"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par téléphone (ex: 699123456)..."
              className="pl-9 h-10 rounded-xl bg-card border-border/60"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Effacer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mode filter (segmented) */}
          <div className="flex gap-1 p-1 rounded-xl bg-card border border-border/60">
            {(
              [
                { v: "all" as const, label: "Tous" },
                { v: "managed" as const, label: "Géré" },
                { v: "alerts" as const, label: "Alerte" },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => {
                  setModeFilter(opt.v);
                  setPage(1);
                }}
                className={`h-8 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  modeFilter === opt.v
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Status filter (segmented) */}
          <div className="flex gap-1 p-1 rounded-xl bg-card border border-border/60">
            {(
              [
                { v: "all" as const, label: "Tous" },
                { v: "active" as const, label: "Actifs" },
                { v: "paused" as const, label: "Suspendus" },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => {
                  setStatusFilter(opt.v);
                  setPage(1);
                }}
                className={`h-8 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  statusFilter === opt.v
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <Select
            value={sortField}
            onValueChange={(v) => setSortField(v as SortField)}
          >
            <SelectTrigger className="h-10 w-full sm:w-[180px] rounded-xl bg-card border-border/60">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Date d'inscription</SelectItem>
              <SelectItem value="balance">Solde</SelectItem>
              <SelectItem value="totalGains">Gains totaux</SelectItem>
              <SelectItem value="totalExchanges">Échanges</SelectItem>
            </SelectContent>
          </Select>

          {/* Order toggle */}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl bg-card border-border/60 shrink-0"
            onClick={() =>
              setSortOrder((o) => (o === "desc" ? "asc" : "desc"))
            }
            title={sortOrder === "desc" ? "Décroissant" : "Croissant"}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="sr-only">Basculer l'ordre</span>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <UsersTableSkeleton />
      ) : users.length === 0 ? (
        <EmptyState
          title="Aucun utilisateur trouvé"
          description="Essayez d'ajuster vos filtres ou votre recherche."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-2xl bg-card border border-border/60 shadow-soft overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4 text-xs uppercase tracking-wide text-muted-foreground">
                    Utilisateur
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Mode
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Niveau
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                    Solde
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                    Capital
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                    Gains
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                    Échanges
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Abonnement
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Statut
                  </TableHead>
                  <TableHead className="text-right pr-4 text-xs uppercase tracking-wide text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, i) => (
                  <TableRow
                    key={u.id}
                    className={i % 2 === 1 ? "bg-muted/20" : ""}
                  >
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                          {(u.name || u.phone).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">
                            {u.name || "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            {formatPhoneDisplay(u.phone)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ModeBadge mode={u.mode} />
                    </TableCell>
                    <TableCell>
                      <LevelBadge level={u.level} />
                    </TableCell>
                    <TableCell className="text-right font-display font-semibold tabular-nums">
                      {formatXAF(u.balance)}
                      <span className="text-[10px] text-muted-foreground ml-1 font-normal">
                        XAF
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {formatXAF(u.capital)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-primary font-semibold">
                      {formatXAF(u.totalGains)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {u.totalExchanges}
                    </TableCell>
                    <TableCell>
                      <SubscriptionCell user={u} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 rounded-lg"
                          onClick={() => setSelectedId(u.id)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Voir
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            u.status === "active" ? "destructive" : "default"
                          }
                          className="h-7 px-2 rounded-lg"
                          onClick={(e) => handleToggleStatus(u, e)}
                        >
                          {u.status === "active" ? (
                            <>
                              <Ban className="w-3.5 h-3.5 mr-1" />
                              Suspendre
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Activer
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                onView={() => setSelectedId(u.id)}
                onToggleStatus={(e) => handleToggleStatus(u, e)}
              />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {!loading && users.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          visiblePages={visiblePages}
          onPage={setPage}
          total={total}
          pageSize={PAGE_SIZE}
        />
      )}

      {/* User detail drawer */}
      <UserDetailDrawer
        userId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={() => loadUsers()}
      />
    </div>
  );
}

// === Sous-composants ===

function SubscriptionCell({ user }: { user: AdminUser }) {
  if (user.mode !== "alerts" || !user.subscriptionPlan) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const plan = planName(user.subscriptionPlan);
  const days = daysRemaining(user.subscriptionExpiresAt);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-foreground">{plan}</span>
      {days !== null && (
        <span
          className={`text-[10px] ${
            days > 7 ? "text-muted-foreground" : "text-destructive font-medium"
          }`}
        >
          {days}j restants
        </span>
      )}
    </div>
  );
}

function UserCard({
  user,
  onView,
  onToggleStatus,
}: {
  user: AdminUser;
  onView: () => void;
  onToggleStatus: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card border border-border/60 shadow-soft p-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
          {(user.name || user.phone).slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {user.name || "Sans nom"}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {formatPhoneDisplay(user.phone)}
              </div>
            </div>
            <StatusBadge status={user.status} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <ModeBadge mode={user.mode} />
            <LevelBadge level={user.level} />
            {user.mode === "alerts" && user.subscriptionPlan && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/40 text-accent-foreground border border-accent/60">
                {planName(user.subscriptionPlan)}
                {daysRemaining(user.subscriptionExpiresAt) !== null &&
                  ` · ${daysRemaining(user.subscriptionExpiresAt)}j`}
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <MobileStat
              label="Solde"
              value={formatXAF(user.balance)}
              color="text-foreground"
            />
            <MobileStat
              label="Capital"
              value={formatXAF(user.capital)}
              color="text-foreground"
            />
            <MobileStat
              label="Gains"
              value={formatXAF(user.totalGains)}
              color="text-primary"
            />
            <MobileStat
              label="Échanges"
              value={String(user.totalExchanges)}
              color="text-foreground"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-9 rounded-xl"
              onClick={onView}
            >
              <Eye className="w-4 h-4 mr-1.5" />
              Voir
            </Button>
            <Button
              size="sm"
              variant={user.status === "active" ? "destructive" : "default"}
              className="flex-1 h-9 rounded-xl"
              onClick={onToggleStatus}
            >
              {user.status === "active" ? (
                <>
                  <Ban className="w-4 h-4 mr-1.5" />
                  Suspendre
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Activer
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MobileStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 py-1.5">
      <div className={`font-display font-bold text-xs ${color} tabular-nums`}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border/60 shadow-soft py-16 text-center">
      <div className="text-4xl mb-3">🔍</div>
      <p className="font-display font-bold text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border/60 shadow-soft overflow-hidden">
      <div className="p-3 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-40" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function buildVisiblePages(page: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function Pagination({
  page,
  totalPages,
  visiblePages,
  onPage,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  visiblePages: number[];
  onPage: (p: number) => void;
  total: number;
  pageSize: number;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
      <p className="text-xs text-muted-foreground order-2 sm:order-1">
        Affichage de{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {from}
        </span>
        –
        <span className="font-semibold text-foreground tabular-nums">
          {to}
        </span>{" "}
        sur{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {total}
        </span>
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="h-8 w-8 p-0 rounded-lg"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {visiblePages.map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPage(p)}
            className={`h-8 w-8 p-0 rounded-lg tabular-nums ${
              p === page ? "shadow-soft" : ""
            }`}
          >
            {p}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="h-8 w-8 p-0 rounded-lg"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
          Page{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {page}
          </span>{" "}
          sur{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {totalPages}
          </span>
        </span>
      </div>
    </div>
  );
}

// === Detail Drawer ===

function UserDetailDrawer({
  userId,
  onClose,
  onUpdated,
}: {
  userId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const open = userId !== null;
  const [user, setUser] = useState<AdminUser | null>(null);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const lastFetchedId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setUser(null);
      setTransactions([]);
      lastFetchedId.current = null;
      return;
    }
    if (lastFetchedId.current === userId) return;
    lastFetchedId.current = userId;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        const json: UserDetailResponse = await res.json();
        if (cancelled) return;
        if (json.ok) {
          setUser(json.user ?? null);
          setTransactions(
            json.transactions ?? json.recentTransactions ?? []
          );
        } else {
          toast.error(json.error || "Erreur de chargement du détail.");
          onClose();
        }
      } catch {
        if (!cancelled) {
          toast.error("Problème de connexion.");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, onClose]);

  const patch = async (payload: {
    status?: UserStatus;
    mode?: UserMode;
    level?: UserLevel;
  }) => {
    if (!user) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json: PatchResponse = await res.json();
      if (json.ok && json.user) {
        setUser(json.user);
        toast.success("Modification enregistrée.");
        onUpdated();
      } else {
        toast.error(json.error || "Échec de la mise à jour.");
      }
    } catch {
      toast.error("Problème de connexion.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 gap-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <SheetTitle className="font-display text-lg font-bold flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-primary" />
            Détail de l'utilisateur
          </SheetTitle>
          <SheetDescription className="sr-only">
            Détails complets de l'utilisateur sélectionné
          </SheetDescription>
        </SheetHeader>

        {loading || !user ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scroll-thin">
            {/* Profile header */}
            <div className="px-5 py-4 bg-gradient-to-br from-primary/5 to-accent/10 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center text-primary-foreground text-xl font-bold shadow-soft">
                  {(user.name || user.phone).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-lg text-foreground truncate">
                    {user.name || "Sans nom"}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                    <Phone className="w-3.5 h-3.5" />
                    {formatPhoneDisplay(user.phone)}
                  </div>
                </div>
                <StatusBadge status={user.status} />
              </div>
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <ModeBadge mode={user.mode} />
                <LevelBadge level={user.level} />
                {user.mode === "alerts" && user.subscriptionPlan && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/40 text-accent-foreground border border-accent/60">
                    <Crown className="w-3 h-3" />
                    {planName(user.subscriptionPlan)}
                    {daysRemaining(user.subscriptionExpiresAt) !== null &&
                      ` · ${daysRemaining(user.subscriptionExpiresAt)}j restants`}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/60">
                  <Calendar className="w-3 h-3" />
                  Inscrit le {formatDate(user.createdAt)}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-border/40">
              <DetailStat
                icon={Wallet}
                label="Solde"
                value={formatXAF(user.balance)}
                unit="XAF"
                color="text-foreground"
              />
              <DetailStat
                icon={Wallet}
                label="Capital"
                value={formatXAF(user.capital)}
                unit="XAF"
                color="text-foreground"
              />
              <DetailStat
                icon={TrendingUp}
                label="Gains totaux"
                value={formatXAF(user.totalGains)}
                unit="XAF"
                color="text-primary"
              />
              <DetailStat
                icon={Repeat}
                label="Échanges"
                value={String(user.totalExchanges)}
                color="text-foreground"
              />
            </div>

            {/* Admin actions */}
            <div className="px-5 py-4 border-b border-border/40">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">
                Actions d'administration
              </h3>
              <div className="space-y-3">
                {/* Status */}
                <ActionRow label="Statut du compte">
                  <Button
                    size="sm"
                    variant={
                      user.status === "active" ? "destructive" : "default"
                    }
                    className="h-9 rounded-lg"
                    disabled={updating}
                    onClick={() =>
                      patch({
                        status:
                          user.status === "active" ? "paused" : "active",
                      })
                    }
                  >
                    {user.status === "active" ? (
                      <>
                        <Ban className="w-4 h-4 mr-1.5" />
                        Suspendre
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        Activer
                      </>
                    )}
                  </Button>
                </ActionRow>

                {/* Mode */}
                <ActionRow label="Mode de fonctionnement">
                  <Select
                    value={user.mode}
                    disabled={updating}
                    onValueChange={(v) => patch({ mode: v as UserMode })}
                  >
                    <SelectTrigger className="h-9 w-[160px] rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="managed">Géré (robot)</SelectItem>
                      <SelectItem value="alerts">Alerte (abonnement)</SelectItem>
                    </SelectContent>
                  </Select>
                </ActionRow>

                {/* Level */}
                <ActionRow label="Niveau">
                  <Select
                    value={user.level}
                    disabled={updating}
                    onValueChange={(v) => patch({ level: v as UserLevel })}
                  >
                    <SelectTrigger className="h-9 w-[160px] rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="croissance">Croissance</SelectItem>
                    </SelectContent>
                  </Select>
                </ActionRow>
              </div>
              {updating && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Mise à jour...
                </div>
              )}
            </div>

            {/* Recent transactions */}
            <div className="px-5 py-4">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">
                Transactions récentes (20 max)
              </h3>
              {transactions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Aucune transaction.
                </div>
              ) : (
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-xs uppercase text-muted-foreground">
                          Date
                        </TableHead>
                        <TableHead className="text-xs uppercase text-muted-foreground">
                          Type
                        </TableHead>
                        <TableHead className="text-xs uppercase text-muted-foreground">
                          Description
                        </TableHead>
                        <TableHead className="text-right text-xs uppercase text-muted-foreground">
                          Montant
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.slice(0, 20).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDateTime(t.createdAt)}
                          </TableCell>
                          <TableCell>
                            <TxTypeBadge type={t.type} />
                          </TableCell>
                          <TableCell className="text-xs text-foreground max-w-[200px] truncate">
                            {t.description}
                          </TableCell>
                          <TableCell
                            className={`text-right font-display font-semibold tabular-nums text-xs ${
                              t.amount > 0
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {t.amount > 0 ? "+" : ""}
                            {formatXAF(t.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailStat({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`font-display font-bold text-sm mt-1 ${color} tabular-nums`}>
        {value}
        {unit && (
          <span className="text-[10px] text-muted-foreground ml-1 font-normal">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function ActionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}
