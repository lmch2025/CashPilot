import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  title: "CashPilot — Votre argent travaille. 24h/24. Automatiquement.",
  description:
    "CashPilot est l'application qui fait travailler votre argent automatiquement. Déposez via Mobile Money, le robot fait le reste. Dès 10 000 XAF.",
  keywords: [
    "CashPilot",
    "revenus passifs",
    "Mobile Money",
    "MTN Money",
    "Orange Money",
    "Cameroun",
    "XAF",
    "arbitrage",
  ],
  authors: [{ name: "CashPilot" }],
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CashPilot",
  },
  openGraph: {
    title: "CashPilot — Votre argent travaille. 24h/24.",
    description:
      "L'application qui fait travailler votre argent automatiquement. Dès 10 000 XAF via Mobile Money.",
    siteName: "CashPilot",
    type: "website",
    locale: "fr_FR",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a5d4f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <I18nProvider>
          {children}
        </I18nProvider>
        <Toaster />
        <SonnerToaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
