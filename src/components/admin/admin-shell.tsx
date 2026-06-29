"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, type ElementType, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Bot,
  Bell,
  Crown,
  Settings,
  LogOut,
  Menu,
  Shield,
  Construction,
  PieChart,
} from "lucide-react";
import { useCashPilotStore } from "@/lib/store";
import { CashPilotLogo } from "@/components/cashpilot/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AdminSection } from "@/lib/types";
import { AdminDashboardView } from "@/components/admin/admin-dashboard-view";
import { AdminUsersView } from "@/components/admin/admin-users-view";
import { AdminTransactionsView } from "@/components/admin/admin-transactions-view";
import { AdminRobotConfig } from "@/components/admin/admin-robot-config";
import { AdminDistributionConfig } from "@/components/admin/admin-distribution-config";
import { AdminOpportunitiesConfig } from "@/components/admin/admin-opportunities-config";
import { AdminPlansConfig } from "@/components/admin/admin-plans-config";
import { AdminSettingsView } from "@/components/admin/admin-settings-view";

// ===== Navigation config =====

interface NavItem {
  id: AdminSection;
  label: string;
  icon: ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "users", label: "Utilisateurs", icon: Users },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "robot", label: "Robot — mode géré", icon: Bot },
  { id: "distribution", label: "Distribution des gains", icon: PieChart },
  { id: "opportunities", label: "Opportunités — mode alerte", icon: Bell },
  { id: "plans", label: "Abonnements", icon: Crown },
  { id: "settings", label: "Paramètres globaux", icon: Settings },
];

const SECTION_TITLES: Record<AdminSection, string> = {
  dashboard: "Tableau de bord",
  users: "Utilisateurs",
  transactions: "Transactions",
  robot: "Robot — mode géré",
  distribution: "Distribution des gains",
  opportunities: "Opportunités — mode alerte",
  plans: "Abonnements",
  settings: "Paramètres globaux",
};

// ===== Placeholder for sections built by other subagents =====

interface PlaceholderProps {
  title: string;
  hint?: string;
}

function SectionPlaceholder({ title, hint }: PlaceholderProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-10 sm:p-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
        <Construction className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-display font-bold text-lg text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {hint ||
          "Cette section est en cours de construction par un autre module de l'équipe. Elle sera disponible prochainement."}
      </p>
    </div>
  );
}

// ===== Sidebar content (shared between desktop rail + mobile sheet) =====

interface SidebarContentProps {
  layoutIdPrefix: string;
  onNavigate?: (section: AdminSection) => void;
}

function SidebarContent({ layoutIdPrefix, onNavigate }: SidebarContentProps) {
  const adminSection = useCashPilotStore((s) => s.adminSection);
  const setAdminSection = useCashPilotStore((s) => s.setAdminSection);
  const adminLogout = useCashPilotStore((s) => s.adminLogout);

  const handleNav = (section: AdminSection) => {
    setAdminSection(section);
    onNavigate?.(section);
  };

  return (
    <div className="flex flex-col h-full text-primary-foreground">
      {/* Brand block */}
      <div className="px-5 py-5 flex items-center gap-3">
        <CashPilotLogo size={36} />
        <div className="flex flex-col leading-none">
          <span className="font-display font-extrabold text-base">CashPilot</span>
          <span className="text-[10px] font-semibold text-primary-foreground/60 tracking-[0.18em] uppercase mt-0.5">
            Administration
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scroll-thin">
        {NAV_ITEMS.map((item) => {
          const active = adminSection === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active
                  ? "text-primary-foreground"
                  : "text-primary-foreground/65 hover:text-primary-foreground hover:bg-primary-foreground/5"
              }`}
            >
              {active && (
                <motion.span
                  layoutId={`${layoutIdPrefix}-active-bg`}
                  className="absolute inset-0 rounded-lg bg-primary-foreground/10"
                  transition={{ type: "spring", duration: 0.45, bounce: 0.2 }}
                />
              )}
              {active && (
                <motion.span
                  layoutId={`${layoutIdPrefix}-active-accent`}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gold-gradient"
                  transition={{ type: "spring", duration: 0.45, bounce: 0.2 }}
                />
              )}
              <Icon className="w-4 h-4 relative z-10 shrink-0" />
              <span className="relative z-10 truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer: exit admin */}
      <div className="p-3 border-t border-primary-foreground/10">
        <button
          onClick={adminLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-foreground/65 hover:text-primary-foreground hover:bg-primary-foreground/5 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Quitter le mode admin
        </button>
      </div>
    </div>
  );
}

// ===== Section router =====

function renderSection(section: AdminSection): ReactNode {
  switch (section) {
    case "dashboard":
      return <AdminDashboardView />;
    case "users":
      return <AdminUsersView />;
    case "transactions":
      return <AdminTransactionsView />;
    case "robot":
      return <AdminRobotConfig />;
    case "distribution":
      return <AdminDistributionConfig />;
    case "opportunities":
      return <AdminOpportunitiesConfig />;
    case "plans":
      return <AdminPlansConfig />;
    case "settings":
      return <AdminSettingsView />;
    default:
      return null;
  }
}

// ===== Main shell =====

export function AdminShell() {
  const adminSection = useCashPilotStore((s) => s.adminSection);
  const adminLogout = useCashPilotStore((s) => s.adminLogout);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // Live clock — start null to avoid hydration mismatch
  useEffect(() => {
    // Initial paint: queue a microtask so we don't call setState synchronously
    // inside the effect body (avoids the react-hooks/set-state-in-effect rule).
    const t = setInterval(() => setNow(new Date()), 1000);
    // First tick happens immediately via a 0-delay timeout (not in effect body)
    const initial = setTimeout(() => setNow(new Date()), 0);
    return () => {
      clearInterval(t);
      clearTimeout(initial);
    };
  }, []);

  return (
    <div className="flex h-screen w-full bg-muted/20 overflow-hidden">
      {/* Desktop sidebar rail */}
      <div className="hidden md:flex w-60 shrink-0 bg-brand-gradient relative">
        {/* Decorative subtle gold glow */}
        <div className="pointer-events-none absolute -top-20 -right-16 w-48 h-48 rounded-full opacity-10 blur-3xl bg-[oklch(0.85_0.13_90)]" />
        <div className="relative w-full">
          <SidebarContent layoutIdPrefix="admin-desktop" />
        </div>
      </div>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0 bg-brand-gradient border-0 text-primary-foreground [&>button]:text-primary-foreground [&>button]:hover:opacity-100 [&>button]:right-3 [&>button]:top-3"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation administration</SheetTitle>
          </SheetHeader>
          <SidebarContent
            layoutIdPrefix="admin-mobile"
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-16 flex items-center justify-between px-4 sm:px-6 bg-background/95 backdrop-blur-md border-b border-border/60">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden -ml-1"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="font-display font-bold text-lg sm:text-xl text-foreground truncate">
              {SECTION_TITLES[adminSection]}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-soft">
              <Shield className="w-3 h-3" />
              Mode admin
            </span>
            <span
              className="hidden md:inline text-xs text-muted-foreground font-mono tabular-nums"
              suppressHydrationWarning
            >
              {now
                ? now.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "--:--:--"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={adminLogout}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Quitter</span>
            </Button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto scroll-thin p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={adminSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {renderSection(adminSection)}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
