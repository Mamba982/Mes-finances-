"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { formaterMontant } from "@/domaine/argent";
import { bilan, indexer, SANS_CATEGORIE, type Transaction } from "@/domaine/budget";
import { ajouterMois, aujourdhuiLocal, libelleDate, libelleMois, moisDe } from "@/domaine/dates";
import { radar as calculerRadar } from "@/domaine/radar";
import { classer, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { Kpi } from "@/ui/kpi";
import { DialogueTransaction } from "./transaction-dialogue";

const b = T.budget;

export function VueBudget() {
  const { categories, transactions, profil } = useDonnees();
  const aujourdhui = aujourdhuiLocal();
  const params = useSearchParams();
  const router = useRouter();
  const mois = /^\d{4}-\d{2}$/.test(params.get("mois") ?? "") ? params.get("mois")! : moisDe(aujourdhui);
  const devise = profil?.devise ?? "CAD";
  const m0 = (c: number) => formaterMontant(c, 0, devise);
  const m2 = (c: number) => formaterMontant(c, 2, devise);

  const [recherche, setRecherche] = useState("");
  const [dialogue, setDialogue] = useState<{ tx: Transaction | null } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const idRecherche = useId();

  const cats = useMemo(() => indexer(categories), [categories]);
  const bil = useMemo(() => bilan(transactions, mois, cats), [transactions, mois, cats]);
  const rd = useMemo(() => calculerRadar(transactions, cats, aujourdhui), [transactions, cats, aujourdhui]);
  const duMois = transactions.filter((t) => moisDe(t.date) === mois);
  const q = recherche.trim().toLowerCase();
  const visibles = q
    ? duMois.filter((t) => `${t.libelle} ${t.marchand} ${(t.categorieId && cats.get(t.categorieId)?.nom) || b.aClasser}`.toLowerCase().includes(q))
    : duMois;

  const lignesCategories = categories
    .filter((c) => c.type === "depense" && (c.budget > 0 || (bil.parCategorie.get(c.id) ?? 0) > 0))
    .map((c) => ({ id: c.id, nom: c.nom, budget: c.budget }));
  if (bil.parCategorie.get(SANS_CATEGORIE)) lignesCategories.push({ id: SANS_CATEGORIE, nom: b.aClasser, budget: 0 });

  const changerMois = (k: number) => router.replace(`/budget?mois=${ajouterMois(mois, k)}`, { scroll: false });

  async function changerCategorie(id: string, categorieId: string) {
    setErreur(null);
    try {
      await classer(id, categorieId || null);
    } catch {
      setErreur(b.erreurEnregistrement);
    }
  }

  return (
    <>
      <h1 className="sr-only">{T.nav.budget}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" className="btn-sec px-3" aria-label={b.moisPrecedent} onClick={() => changerMois(-1)}>
            ‹
          </button>
          <p className="font-display min-w-36 text-center text-[17px] font-bold" aria-live="polite">
            {libelleMois(mois)}
          </p>
          <button type="button" className="btn-sec px-3" aria-label={b.moisSuivant} onClick={() => changerMois(1)}>
            ›
          </button>
        </div>
        <div className="flex gap-2">
          <Link href="/budget/importer" className="btn">
            {b.importer}
          </Link>
          <button type="button" className="btn-sec" onClick={() => setDialogue({ tx: null })}>
            {b.ajouter}
          </button>
        </div>
      </div>

      {params.get("importees") !== null ? (
        <p className="alerte mt-3 border-ok" role="status">
          {T.importer.resultat(Number(params.get("importees")), Number(params.get("ecartees") ?? 0))}
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi libelle={b.revenus} valeur={m0(bil.revenus)} />
        <Kpi libelle={b.depenses} valeur={m0(bil.depenses)} />
        <Kpi libelle={b.misDeCote} valeur={m0(bil.epargne)} detail={b.misDeCoteDetail} />
        <Kpi
          libelle={b.reste}
          valeur={<span className={bil.solde - bil.epargne < 0 ? "text-bad" : "text-ok"}>{m0(bil.solde - bil.epargne)}</span>}
          detail={b.resteDetail}
        />
      </div>

      <div className="mt-6 mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">{b.parCategorie}</h2>
        <Link href="/budget/categories" className="lien text-sm">
          {b.modifierBudgets}
        </Link>
      </div>
      <div className="carte grid gap-3 sm:grid-cols-2">
        {lignesCategories.length ? (
          lignesCategories.map((c) => {
            const depense = bil.parCategorie.get(c.id) ?? 0;
            const ratio = c.budget > 0 ? depense / c.budget : depense > 0 ? 1 : 0;
            const couleur = ratio > 1 ? "bg-bad" : ratio > 0.9 ? "bg-warn" : "bg-accent";
            return (
              <div key={c.id}>
                <div className="flex justify-between gap-2 text-sm">
                  <span>{c.nom}</span>
                  <span className="chiffre">
                    {m0(depense)}
                    {c.budget ? <span className="text-mute"> / {m0(c.budget)}</span> : null}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft" aria-hidden="true">
                  <i className={`block h-full rounded-full ${couleur}`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <p className="note">{b.aucuneDepense}</p>
        )}
      </div>

      <div className="mt-6 mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">{b.transactions(duMois.length)}</h2>
        <div>
          <label htmlFor={idRecherche} className="sr-only">
            {b.rechercher}
          </label>
          <input
            id={idRecherche}
            type="search"
            placeholder={b.rechercher}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="champ w-44 py-2"
          />
        </div>
      </div>
      {erreur ? (
        <p className="alerte mb-2 border-bad" role="alert">
          {erreur}
        </p>
      ) : null}
      {visibles.length ? (
        <ul className="carte divide-y divide-line p-0">
          {visibles.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {t.marchand}
                  {t.deductible ? <span className="ml-1.5 rounded bg-soft px-1.5 text-xs font-bold">{b.deductible}</span> : null}
                </p>
                <p className="truncate text-sm text-mute">
                  {libelleDate(t.date, false)} · {t.libelle}
                </p>
              </div>
              <p className={`chiffre font-semibold ${t.montant > 0 ? "text-ok" : ""}`}>{m2(t.montant)}</p>
              <div className="flex w-full items-center gap-2">
                <label className="sr-only" htmlFor={`cat-${t.id}`}>
                  {`${b.categorie} : ${t.marchand}`}
                </label>
                <select
                  id={`cat-${t.id}`}
                  value={t.categorieId ?? ""}
                  onChange={(e) => void changerCategorie(t.id, e.target.value)}
                  className="champ flex-1 py-1.5 text-sm"
                >
                  <option value="">{b.aClasser}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
                <button type="button" className="lien min-h-11 px-1 text-sm" onClick={() => setDialogue({ tx: t })}>
                  {b.modifier}
                  <span className="sr-only"> {t.marchand}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="carte note py-6 text-center">{b.aucuneTransaction(libelleMois(mois).toLowerCase())}</p>
      )}

      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{b.radarTitre}</h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <section className="carte" aria-label={b.fraisTitre}>
          <p className="text-sm text-mute">{b.fraisTitre}</p>
          <p className="chiffre font-display text-2xl font-extrabold text-bad">{m2(rd.totalFrais)}</p>
          {Object.keys(rd.parType).length ? (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {Object.entries(rd.parType).map(([k, v]) => (
                  <tr key={k} className="border-t border-line">
                    <td className="py-1.5">{k}</td>
                    <td className="chiffre py-1.5 text-right">{m2(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="note mt-1">{b.aucunFrais}</p>
          )}
          {rd.parType["Frais de change"] ? <p className="note mt-2">{b.conseilChange}</p> : null}
        </section>
        <section className="carte" aria-label={b.recurrentsTitre}>
          <p className="text-sm text-mute">{b.recurrentsTitre}</p>
          <p className="chiffre font-display text-2xl font-extrabold">{m0(rd.totalRecurrents)}</p>
          {rd.recurrents.length ? (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {rd.recurrents.slice(0, 8).map((r) => (
                  <tr key={r.nom} className="border-t border-line">
                    <td className="py-1.5">
                      {r.nom}
                      <span className="block text-mute">{b.recurrentDetail(m2(r.mensuel), r.nbMois)}</span>
                    </td>
                    <td className="chiffre py-1.5 text-right">
                      {m0(r.annuel)} {b.parAn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="note mt-1">{b.recurrentsVide}</p>
          )}
        </section>
      </div>

      <DialogueTransaction
        ouvert={dialogue !== null}
        transaction={dialogue?.tx ?? null}
        aujourdhui={aujourdhui}
        categories={categories}
        onFermer={() => setDialogue(null)}
      />
    </>
  );
}
