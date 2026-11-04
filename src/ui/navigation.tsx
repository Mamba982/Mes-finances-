"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@/textes/fr-CA";

/** Onglets fixes : l'ordre et les libellés ne changent pas d'une version à l'autre. */
export const ONGLETS = [
  { href: "/accueil", libelle: T.nav.accueil, icone: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/budget", libelle: T.nav.budget, icone: "M4 5h16v14H4zM4 10h16M9 15h6" },
  { href: "/projets", libelle: T.nav.projets, icone: "M12 3v18M5 8l7-5 7 5M5 21h14" },
  { href: "/affaires", libelle: T.nav.affaires, icone: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" },
  { href: "/placements", libelle: T.nav.placements, icone: "M4 19l5-6 4 3 7-9M15 7h5v5" },
] as const;

function Icone({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function NavigationBas() {
  const chemin = usePathname();
  return (
    <nav
      aria-label={T.nav.titre}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {ONGLETS.map((o) => {
          const actif = chemin === o.href || chemin.startsWith(`${o.href}/`);
          return (
            <li key={o.href}>
              <Link
                href={o.href}
                aria-current={actif ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${actif ? "text-accent" : "text-mute"}`}
              >
                <Icone d={o.icone} />
                {o.libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function EnTete() {
  const chemin = usePathname();
  const lien = (href: string, libelle: string) => (
    <Link
      href={href}
      aria-current={chemin === href ? "page" : undefined}
      className={`rounded-lg px-3 py-2 text-sm font-semibold ${chemin === href ? "bg-soft text-ink" : "text-mute"}`}
    >
      {libelle}
    </Link>
  );
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
        <p className="font-display text-lg font-extrabold">{T.app.nom}</p>
        <div className="flex gap-1">
          {lien("/assistant", T.nav.assistant)}
          {lien("/reglages", T.nav.reglages)}
        </div>
      </div>
    </header>
  );
}
