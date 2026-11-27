import Link from "next/link";
import { asset, contactHref, CONTACT_EMAIL } from "@/lib/site";

const NAV = [
  { label: "Services", href: "/#services" },
  { label: "Réalisations", href: "/#realisations" },
  { label: "Méthode", href: "/#methode" },
  { label: "À propos", href: "/#apropos" },
  { label: "FAQ", href: "/#faq" },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`text-[19px] font-semibold tracking-[-0.03em] ${className}`}>
      bnia<span className="text-accent">.</span>lab
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#0c0c0e]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-soft md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={asset(n.href)} className="transition-colors hover:text-foreground">
              {n.label}
            </a>
          ))}
        </nav>
        <a
          href={contactHref}
          {...(CONTACT_EMAIL ? {} : { target: "_blank", rel: "noopener" })}
          className="btn-primary rounded-full px-4 py-2 text-sm font-medium"
        >
          Démarrer un projet
        </a>
      </div>
    </header>
  );
}
