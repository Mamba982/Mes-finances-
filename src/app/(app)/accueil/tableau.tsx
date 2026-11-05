"use client";

import Link from "next/link";
import { useMemo } from "react";
import { aFaireBudget, type ElementAFaire } from "@/domaine/accueil";
import { formaterMontant } from "@/domaine/argent";
import { bilan, capacite, indexer } from "@/domaine/budget";
import { aujourdhuiLocal, libelleMois, moisDe } from "@/domaine/dates";
import { radar } from "@/domaine/radar";
import { useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { Kpi } from "@/ui/kpi";

const a = T.accueil;
const PASTILLE = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" } as const;

/**
 * Écran d'accueil fixe : trois chiffres, « À faire ce mois-ci », puis le mois en cours.
 * L'ordre et les libellés ne changent pas ; les projets (phase 3) s'ajoutent dans les mêmes cases.
 */
export function TableauAccueil() {
  const { profil, categories, transactions } = useDonnees();
  const aujourdhui = aujourdhuiLocal();
  const devise = profil?.devise ?? "CAD";
  const m0 = (c: number) => formaterMontant(c, 0, devise);
  const m2 = (c: number) => formaterMontant(c, 2, devise);

  const calc = useMemo(() => {
    const index = indexer(categories);
    const cap = capacite(
      { mode: profil?.mode_capacite ?? "auto", manuelle: profil?.capacite_manuelle ?? 0 },
      transactions,
      index,
      aujourdhui,
    );
    const rd = radar(transactions, index, aujourdhui);
    return {
      cap,
      bil: bilan(transactions, moisDe(aujourdhui), index),
      aFaire: aFaireBudget({ transactions, categories, index, radar: rd, aujourdhui }),
    };
  }, [categories, transactions, profil, aujourdhui]);

  const effortRequis = 0; // projets : phase 3
  const ecart = calc.cap.valeur - effortRequis;
  const budgetTotal = categories.filter((c) => c.type === "depense").reduce((s, c) => s + c.budget, 0);

  function texte(e: ElementAFaire) {
    switch (e.type) {
      case "aucune-transaction":
        return (
          <>
            {a.itemAucuneTransaction}{" "}
            <Link href="/budget/importer" className="lien">
              {a.itemImporter}
            </Link>{" "}
            {a.itemFormats}
          </>
        );
      case "a-classer":
        return (
          <>
            <b>{a.itemAClasser(e.nombre)}</b>{" "}
            <Link href="/budget" className="lien">
              {a.itemOuvrirBudget}
            </Link>
          </>
        );
      case "budget-depasse":
        return a.itemDepasse(e.categorie, m0(e.depassement));
      case "frais":
        return (
          <>
            {a.itemFrais(m2(e.total))}{" "}
            <Link href="/budget" className="lien">
              {a.itemDetail}
            </Link>
          </>
        );
    }
  }

  return (
    <>
      <h1 className="sr-only">{T.nav.accueil}</h1>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Kpi
          libelle={a.epargnePossible}
          valeur={m0(calc.cap.valeur)}
          detail={
            calc.cap.source === "auto" ? (
              a.moyenneMois(calc.cap.nbMois ?? 0)
            ) : (
              <>
                {a.montantManuel} ·{" "}
                <Link href="/reglages" className="lien">
                  {a.modifier}
                </Link>
              </>
            )
          }
        />
        <Kpi
          libelle={ecart < 0 ? a.manque : a.marge}
          valeur={<span className={ecart < 0 ? "text-bad" : "text-ok"}>{m0(Math.abs(ecart))}</span>}
          detail={a.apresEffort(m0(effortRequis))}
          ton={ecart < 0 ? "bad" : "ok"}
        />
        <Kpi
          libelle={a.risque}
          valeur={a.aucunProjet}
          detail={
            <Link href="/projets" className="lien">
              {a.ajouterProjet}
            </Link>
          }
        />
      </div>

      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{a.aFaire}</h2>
      {calc.aFaire.length ? (
        <ul className="grid gap-2">
          {calc.aFaire.map((e, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
              <span aria-hidden="true" className={`mt-1.5 size-2.5 flex-none rounded-full ${PASTILLE[e.ton]}`} />
              <span>{texte(e)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="carte note py-6 text-center">{a.rienUrgent}</p>
      )}

      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{libelleMois(moisDe(aujourdhui))}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <Kpi
          libelle={a.revenusMois}
          valeur={m0(calc.bil.revenus)}
          detail={
            <Link href="/budget" className="lien">
              {a.voirBudget}
            </Link>
          }
        />
        <Kpi libelle={a.depensesMois} valeur={m0(calc.bil.depenses)} detail={a.budgetTotal(m0(budgetTotal))} />
      </div>
    </>
  );
}
