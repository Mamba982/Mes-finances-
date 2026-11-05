"use client";

import Link from "next/link";
import { aFaireBudget, aFaireProjets, type ElementAFaire } from "@/domaine/accueil";
import { formaterMontant } from "@/domaine/argent";
import { bilan } from "@/domaine/budget";
import { ajouterMois, libelleDate, libelleMois, libelleMoisCourt, moisDe } from "@/domaine/dates";
import { resumeFactures } from "@/domaine/factures";
import { projetAAfficher } from "@/domaine/projets";
import { T } from "@/textes/fr-CA";
import { useCalculs } from "@/ui/calculs";
import { GraphiqueCourbes } from "@/ui/graphique";
import { Kpi } from "@/ui/kpi";

const a = T.accueil;
const PASTILLE = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" } as const;
const TON_STATUT = { depasse: "bad", nonfinance: "bad", retard: "warn", ok: "ok", atteint: "ok" } as const;
const COULEUR_STATUT = { ok: "text-ok", atteint: "text-ok", retard: "text-warn", nonfinance: "text-bad", depasse: "text-bad" } as const;

/**
 * Écran d'accueil fixe : trois chiffres, « À faire ce mois-ci », puis le mois en cours.
 * L'ordre et les libellés ne changent pas d'une version à l'autre.
 */
export function TableauAccueil() {
  const { categories, transactions, factures, index, capacite, repartition: r, radar, aujourdhui, devise } = useCalculs();
  const m0 = (c: number) => formaterMontant(c, 0, devise);
  const m2 = (c: number) => formaterMontant(c, 2, devise);
  const ym = moisDe(aujourdhui);
  const bil = bilan(transactions, ym, index);
  const aFaire = [...aFaireProjets(r), ...aFaireBudget({ transactions, categories, index, radar, aujourdhui, factures })];
  const vedette = projetAAfficher(r);
  const budgetTotal = categories.filter((c) => c.type === "depense").reduce((s, c) => s + c.budget, 0);
  const sixMois = Array.from({ length: 6 }, (_, i) => ajouterMois(ym, i - 5));
  const avecDonnees = sixMois.some((m) => transactions.some((t) => moisDe(t.date) === m));

  function texte(e: ElementAFaire) {
    switch (e.type) {
      case "manque":
        return (
          <>
            {a.itemManque(m0(e.montant))}{" "}
            <Link href="/projets/scenario" className="lien">
              {a.itemTester}
            </Link>
          </>
        );
      case "verser":
        return a.itemVerser(m0(e.montant), e.projet);
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
      case "relance":
        return (
          <>
            {a.itemRelance(e.client, e.numero, m2(e.total), e.jours)}{" "}
            <Link href="/affaires" className="lien">
              {a.itemVoir}
            </Link>
          </>
        );
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
          valeur={m0(capacite.valeur)}
          detail={
            capacite.source === "auto" ? (
              a.moyenneMois(capacite.nbMois ?? 0)
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
          libelle={r.ecart < 0 ? a.manque : a.marge}
          valeur={<span className={r.ecart < 0 ? "text-bad" : "text-ok"}>{m0(Math.abs(r.ecart))}</span>}
          detail={r.ecart < 0 ? a.projetsDemandent(m0(r.totaux.requis)) : a.apresEffort(m0(r.totaux.requis))}
          ton={r.ecart < 0 ? "bad" : "ok"}
        />
        {vedette ? (
          <Kpi
            libelle={vedette.aRisque ? a.risque : a.prochaineEcheance}
            valeur={vedette.calcul.projet.nom}
            detail={
              <>
                <span className={`font-bold ${COULEUR_STATUT[vedette.calcul.statut]}`}>{T.projets.statuts[vedette.calcul.statut]}</span> ·{" "}
                {a.echeanceLe(libelleDate(vedette.calcul.projet.echeance))}
              </>
            }
            ton={TON_STATUT[vedette.calcul.statut]}
          />
        ) : (
          <Kpi
            libelle={a.risque}
            valeur={a.aucunProjet}
            detail={
              <Link href="/projets" className="lien">
                {a.ajouterProjet}
              </Link>
            }
          />
        )}
      </div>

      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{a.aFaire}</h2>
      {aFaire.length ? (
        <ul className="grid gap-2">
          {aFaire.map((e, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
              <span aria-hidden="true" className={`mt-1.5 size-2.5 flex-none rounded-full ${PASTILLE[e.ton]}`} />
              <span>{texte(e)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="carte note py-6 text-center">{a.rienUrgent}</p>
      )}

      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{libelleMois(ym)}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <Kpi
          libelle={a.revenusMois}
          valeur={m0(bil.revenus)}
          detail={
            <Link href="/budget" className="lien">
              {a.voirBudget}
            </Link>
          }
        />
        <Kpi libelle={a.depensesMois} valeur={m0(bil.depenses)} detail={a.budgetTotal(m0(budgetTotal))} />
        <Kpi
          libelle={a.facturesARecevoir}
          valeur={m0(resumeFactures(factures, aujourdhui).aRecevoir)}
          detail={
            <Link href="/affaires" className="lien">
              {a.voirAffaires}
            </Link>
          }
        />
      </div>

      {avecDonnees ? (
        <>
          <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{a.graphiqueTitre}</h2>
          <div className="carte">
            <GraphiqueCourbes
              libelle={a.graphiqueLibelle}
              devise={devise}
              etiquettes={sixMois.map(libelleMoisCourt)}
              series={[
                { nom: a.legendeRevenus, points: sixMois.map((m) => bilan(transactions, m, index).revenus), couleur: "var(--ok)" },
                { nom: a.legendeDepenses, points: sixMois.map((m) => bilan(transactions, m, index).depenses), couleur: "var(--bad)" },
              ]}
            />
            <p className="note mt-1">{a.moisPartiel}</p>
          </div>
        </>
      ) : null}
    </>
  );
}
