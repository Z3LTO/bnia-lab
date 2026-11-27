import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import "./globals.css";
import { SiteHeader, Logo } from "@/components/site-header";
import { asset, contactHref, CONTACT_EMAIL, INSTAGRAM_URL, INSTAGRAM_HANDLE } from "@/lib/site";

export const metadata: Metadata = {
  title: "bnia.lab — Sites, applications et intégration IA à La Rochelle",
  description:
    "bnia.lab conçoit des sites web, des applications métier et des assistants IA sur mesure pour les artisans, TPE et PME, autour de La Rochelle et à distance.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230E0E10'/%3E%3Ccircle cx='32' cy='32' r='9' fill='%23FF4D00'/%3E%3C/svg%3E",
  },
  openGraph: {
    title: "bnia.lab — Sites, applications et intégration IA",
    description: "Moins d'administratif, plus de temps pour votre métier.",
    locale: "fr_FR",
    type: "website",
  },
};

function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.07]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 text-sm text-soft sm:grid-cols-3">
        <div>
          <Logo className="text-foreground" />
          <p className="mt-3 max-w-xs">Sites, applications et intégration de l&apos;IA sur mesure pour les TPE, PME et indépendants.</p>
        </div>
        <div className="space-y-2">
          <p className="text-foreground">Le site</p>
          <a className="block hover:text-foreground" href={asset("/#services")}>Services</a>
          <a className="block hover:text-foreground" href={asset("/#realisations")}>Réalisations</a>
          <a className="block hover:text-foreground" href={asset("/#faq")}>Questions fréquentes</a>
        </div>
        <div className="space-y-2">
          <p className="text-foreground">Contact</p>
          {CONTACT_EMAIL && <a className="block hover:text-foreground" href={contactHref}>{CONTACT_EMAIL}</a>}
          <a className="block hover:text-foreground" href={INSTAGRAM_URL} target="_blank" rel="noopener">Instagram · {INSTAGRAM_HANDLE}</a>
          <p>La Rochelle · interventions à distance</p>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 border-t border-white/[0.07] px-6 py-6 text-xs text-soft">
        <p>© 2026 bnia.lab</p>
        <Link href="/mentions-legales" className="underline-offset-4 hover:text-foreground hover:underline">Mentions légales</Link>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`dark ${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
