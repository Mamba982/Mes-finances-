"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formaterMontant } from "@/domaine/argent";
import { lireProfil, type Profil } from "@/donnees/profil";
import { T } from "@/textes/fr-CA";
import { Kpi } from "@/ui/kpi";

/**
 * Écran d'accueil fixe : trois chiffres, puis « À faire ce mois-ci ».
 * Phase 1 : capacité lue dans le profil. Les transactions et les projets s'y branchent aux phases 2 et 3.
 */
export function TableauAccueil() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    lireProfil().then(setProfil, () => setErreur(true));
  }, []);

  if (erreur) return <p className="alerte border-bad">{T.erreurs.lecture}</p>;

  const capacite = profil ? profil.capacite_manuelle : null;
  const devise = profil?.devise ?? "CAD";
  const v = (c: number | null) => (c === null ? "…" : formaterMontant(c, 0, devise));

  return (
    <>
      <h1 className="sr-only">{T.nav.accueil}</h1>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Kpi libelle={T.accueil.epargnePossible} valeur={v(capacite)} detail="montant entré à la main" />
        <Kpi libelle={T.accueil.marge} valeur={<span className="text-ok">{v(capacite)}</span>} detail={`après l'effort requis de ${v(0)}`} ton="ok" />
        <Kpi
          libelle={T.accueil.risque}
          valeur={T.accueil.aucunProjet}
          detail={
            <Link href="/projets" className="lien">
              {T.accueil.ajouterProjet}
            </Link>
          }
        />
      </div>
      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{T.accueil.aFaire}</h2>
      <ul className="grid gap-2">
        <li className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
          <span aria-hidden="true" className="mt-1.5 size-2.5 flex-none rounded-full bg-warn" />
          <span>
            Aucune transaction récente.{" "}
            <Link href="/budget" className="lien">
              Importe ton dernier relevé
            </Link>{" "}
            (CSV, PDF ou capture d&apos;écran).
          </span>
        </li>
      </ul>
    </>
  );
}
