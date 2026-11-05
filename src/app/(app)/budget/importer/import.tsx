"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ChangeEvent } from "react";
import { formaterMontant } from "@/domaine/argent";
import { categorieAuto } from "@/domaine/categorisation";
import { libelleDate, moisDe } from "@/domaine/dates";
import { empreintes, marquerDoublons, type StatutDoublon } from "@/domaine/doublons";
import { lireCsv, type LigneReleve } from "@/import/csv/lire";
import { importer, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";

const t = T.importer;

interface LigneRevue extends LigneReleve {
  categorieId: string | null;
  statut: StatutDoublon;
  retenue: boolean;
}

interface Revue {
  nomFichier: string;
  format: "csv" | "texte";
  source: string;
  lues: number;
  lignes: LigneRevue[];
}

export function ImportReleve() {
  const { categories, transactions, profil } = useDonnees();
  const router = useRouter();
  const [revue, setRevue] = useState<Revue | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const idFichier = useId();
  const idTexte = useId();
  const devise = profil?.devise ?? "CAD";
  const parCode = useMemo(() => new Map(categories.filter((c) => c.code).map((c) => [c.code!, c.id])), [categories]);

  function preparer(texte: string, nomFichier: string, format: "csv" | "texte", source: string) {
    const r = lireCsv(texte);
    if (!r.lignes.length) {
      setMessage(t.rien);
      return;
    }
    if (r.lignes.length > 5000) {
      setMessage(t.tropDeLignes);
      return;
    }
    const statuts = marquerDoublons(r.lignes, transactions);
    setMessage(null);
    setRevue({
      nomFichier,
      format,
      source,
      lues: r.lues,
      lignes: r.lignes.map((l, i) => {
        const code = categorieAuto(l.libelle, l.montant);
        return { ...l, categorieId: (code && parCode.get(code)) ?? null, statut: statuts[i]!, retenue: !statuts[i] };
      }),
    });
  }

  async function choisirFichier(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const nom = f.name.toLowerCase();
    if (/\.(csv|txt)$/.test(nom) || /csv|text\/plain/.test(f.type)) {
      setMessage(t.lecture);
      preparer(await f.text(), f.name, "csv", t.sourceCsv);
    } else {
      setMessage(/\.pdf$/.test(nom) || f.type.startsWith("image/") ? t.sansIa : t.formatNonPrisEnCharge);
    }
  }

  function lireColle() {
    const v = (document.getElementById(idTexte) as HTMLTextAreaElement | null)?.value ?? "";
    if (!v.trim()) return setMessage(t.colleVide);
    preparer(v, t.sourceColle, "texte", t.sourceColle);
  }

  function modifierLigne(i: number, changement: Partial<LigneRevue>) {
    setRevue((r) => (r ? { ...r, lignes: r.lignes.map((l, j) => (j === i ? { ...l, ...changement } : l)) } : r));
  }

  async function confirmer() {
    if (!revue) return;
    setOccupe(true);
    setMessage(null);
    try {
      // Empreintes calculées sur tout le fichier, dans l'ordre : le rang des lignes identiques reste stable.
      const e = await empreintes(revue.lignes);
      const retenues = revue.lignes.map((l, i) => ({ ...l, empreinte: e[i]! })).filter((l) => l.retenue);
      const r = await importer({ nomFichier: revue.nomFichier, format: revue.format, lues: revue.lues, lignes: retenues });
      const mois = retenues[0] ? moisDe(retenues[0].date) : moisDe(revue.lignes[0]!.date);
      router.push(`/budget?mois=${mois}&importees=${r.importees}&ecartees=${r.ecartees}`);
    } catch {
      setMessage(t.erreur);
      setOccupe(false);
    }
  }

  const zoneMessage = (
    <p role="status" aria-live="polite" className={message ? "alerte mt-3" : "sr-only"}>
      {message}
    </p>
  );

  if (!revue) {
    return (
      <>
        <h1 className="text-xl font-extrabold">{t.titre}</h1>
        <p className="note mt-2">{t.intro}</p>
        <div className="carte mt-4 flex flex-col gap-2">
          <label htmlFor={idFichier} className="font-semibold">
            {t.fichier}
          </label>
          <input id={idFichier} type="file" accept=".csv,.txt,text/csv,.pdf,application/pdf,image/*" onChange={(e) => void choisirFichier(e)} className="champ" />
          <p className="note">{t.sansIa}</p>
        </div>
        <div className="carte mt-3 flex flex-col gap-2">
          <label htmlFor={idTexte} className="font-semibold">
            {t.ouColler}
          </label>
          <textarea id={idTexte} rows={5} placeholder={t.exempleColle} className="champ text-sm" />
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={lireColle}>
              {t.lireTexte}
            </button>
            <Link href="/budget" className="btn-sec">
              {t.annuler}
            </Link>
          </div>
        </div>
        {zoneMessage}
      </>
    );
  }

  const nRetenues = revue.lignes.filter((l) => l.retenue).length;
  const nDoublons = revue.lignes.filter((l) => l.statut).length;

  return (
    <>
      <h1 className="text-xl font-extrabold">{t.revueTitre}</h1>
      <p className="note mt-2">{t.revueIntro(revue.lignes.length, revue.source, nDoublons)}</p>
      <ul className="carte mt-3 divide-y divide-line p-0">
        {revue.lignes.map((l, i) => (
          <li key={i} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 ${l.retenue ? "" : "bg-soft"}`}>
            <input
              id={`ligne-${i}`}
              type="checkbox"
              checked={l.retenue}
              onChange={(e) => modifierLigne(i, { retenue: e.target.checked })}
              className="size-5 accent-accent"
              aria-label={`${t.importerLigne} : ${l.libelle}, ${formaterMontant(l.montant, 2, devise)}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{l.libelle}</p>
              <p className="text-sm text-mute">
                {libelleDate(l.date)}
                {l.statut ? (
                  <span className={`ml-2 rounded px-1.5 text-xs font-bold ${l.statut === "exact" ? "bg-soft text-bad" : "bg-soft text-warn"}`}>
                    {l.statut === "exact" ? t.dejaImportee : t.doublonProbable}
                  </span>
                ) : null}
              </p>
            </div>
            <p className={`chiffre font-semibold ${l.montant > 0 ? "text-ok" : ""}`}>{formaterMontant(l.montant, 2, devise)}</p>
            <label className="sr-only" htmlFor={`cat-ligne-${i}`}>
              {`${T.budget.categorie} : ${l.libelle}`}
            </label>
            <select
              id={`cat-ligne-${i}`}
              value={l.categorieId ?? ""}
              onChange={(e) => modifierLigne(i, { categorieId: e.target.value || null })}
              className="champ w-full py-1.5 text-sm"
            >
              <option value="">{T.budget.aClasser}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-20 mt-3 flex gap-2 bg-bg py-2">
        <button type="button" className="btn flex-1" disabled={occupe || nRetenues === 0} onClick={() => void confirmer()}>
          {occupe ? t.enCours : t.importerN(nRetenues)}
        </button>
        <button type="button" className="btn-sec" disabled={occupe} onClick={() => setRevue(null)}>
          {t.annuler}
        </button>
      </div>
      {zoneMessage}
    </>
  );
}
