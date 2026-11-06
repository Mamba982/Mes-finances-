"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ChangeEvent } from "react";
import { z } from "zod";
import { formaterMontant } from "@/domaine/argent";
import { libelleDate, moisDe } from "@/domaine/dates";
import { empreintes, marquerDoublons, type StatutDoublon } from "@/domaine/doublons";
import { classer } from "@/domaine/regles";
import { lireCsv, type LigneReleve } from "@/import/csv/lire";
import { lireTextePdf } from "@/import/pdf/lire";
import { importer, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { useIaDisponible } from "@/ui/ia";
import { compresserImage } from "@/ui/image";

const t = T.importer;

interface LigneRevue extends LigneReleve {
  categorieId: string | null;
  statut: StatutDoublon;
  retenue: boolean;
}

interface Revue {
  nomFichier: string;
  format: "csv" | "texte" | "pdf" | "image";
  source: string;
  lues: number;
  lignes: LigneRevue[];
  /** Lu par l'IA : nombre de lignes écartées (date ou montant illisible). */
  ia?: { ecartees: number };
}

const schemaLecture = z.object({
  lignes: z.array(z.object({ date: z.iso.date(), libelle: z.string().min(1), montant: z.number().int() })),
  ecartees: z.number().int().min(0),
});
const schemaErreur = z.object({ erreur: z.string() });

function enBase64(b: Blob): Promise<string> {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => ko(r.error);
    r.readAsDataURL(b);
  });
}

export function ImportReleve() {
  const { categories, transactions, profil, regles } = useDonnees();
  const router = useRouter();
  const [revue, setRevue] = useState<Revue | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const iaDisponible = useIaDisponible();
  const iaUtilisable = iaDisponible && Boolean(profil?.ia_active);
  const idFichier = useId();
  const idTexte = useId();
  const devise = profil?.devise ?? "CAD";
  const parCode = useMemo(() => new Map(categories.filter((c) => c.code).map((c) => [c.code!, c.id])), [categories]);

  function preparer(texte: string, nomFichier: string, format: "csv" | "texte", source: string) {
    const r = lireCsv(texte);
    preparerLignes(r.lignes, r.lues, nomFichier, format, source);
  }

  function preparerLignes(lignes: LigneReleve[], lues: number, nomFichier: string, format: Revue["format"], source: string, ia?: Revue["ia"]) {
    if (!lignes.length) {
      setMessage(t.rien);
      return;
    }
    if (lignes.length > 5000) {
      setMessage(t.tropDeLignes);
      return;
    }
    const statuts = marquerDoublons(lignes, transactions);
    setMessage(null);
    setRevue({
      nomFichier,
      format,
      source,
      lues,
      ia,
      lignes: lignes.map((l, i) => {
        // Tes règles d'abord (ajoutées ou retenues), puis les règles par défaut.
        const c = classer(l.libelle, l.montant, regles, parCode);
        return { ...l, categorieId: c?.categorieId ?? null, statut: statuts[i]!, retenue: !statuts[i] };
      }),
    });
  }

  /** Envoie à l'IA le texte masqué d'un PDF ou une capture ; la réponse passe par l'écran de revue. */
  async function lireAvecIa(corps: object, nomFichier: string, format: "pdf" | "image", source: string) {
    setOccupe(true);
    setMessage(t.lectureIa);
    try {
      const r = await fetch("/api/ia/releve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
      const j: unknown = await r.json().catch(() => null);
      if (!r.ok) return setMessage(schemaErreur.safeParse(j).data?.erreur ?? T.ia.erreurs.connexion);
      const v = schemaLecture.safeParse(j);
      if (!v.success) return setMessage(T.ia.erreurs.reponse);
      preparerLignes(v.data.lignes, v.data.lignes.length + v.data.ecartees, nomFichier, format, source, { ecartees: v.data.ecartees });
    } catch {
      setMessage(T.ia.erreurs.connexion);
    } finally {
      setOccupe(false);
    }
  }

  async function choisirFichier(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const nom = f.name.toLowerCase();
    const estPdf = /\.pdf$/.test(nom) || f.type === "application/pdf";
    if (/\.(csv|txt)$/.test(nom) || /csv|text\/plain/.test(f.type)) {
      setMessage(t.lecture);
      preparer(await f.text(), f.name, "csv", t.sourceCsv);
    } else if (!estPdf && !f.type.startsWith("image/")) {
      setMessage(t.formatNonPrisEnCharge);
    } else if (!iaUtilisable) {
      setMessage(iaDisponible ? t.iaInactive : t.sansIa);
    } else if (estPdf) {
      setMessage(t.lecture);
      const l = await lireTextePdf(f);
      if (!l.ok) {
        const messages = { "trop-de-pages": t.pdfTropDePages, "sans-texte": t.pdfSansTexte, "trop-long": t.pdfTropLong, illisible: t.pdfIllisible };
        return setMessage(messages[l.raison]);
      }
      await lireAvecIa({ source: "pdf", pages: l.pages }, f.name, "pdf", t.sourcePdf);
    } else {
      setMessage(null);
      setImage(f); // rappel avant l'envoi : recadrer ou cacher les numéros complets
    }
  }

  async function envoyerImage() {
    if (!image) return;
    const f = image;
    setImage(null);
    let donnees: string;
    try {
      donnees = await enBase64(await compresserImage(f));
    } catch {
      return setMessage(t.imageIllisible);
    }
    await lireAvecIa({ source: "image", type: "image/jpeg", donnees }, f.name, "image", t.sourceImage);
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
          <input
            id={idFichier}
            type="file"
            accept=".csv,.txt,text/csv,.pdf,application/pdf,image/*"
            disabled={occupe}
            onChange={(e) => void choisirFichier(e)}
            className="champ"
          />
          <p className="note">{iaUtilisable ? t.avecIa : iaDisponible ? t.iaInactive : t.sansIa}</p>
        </div>
        {image ? (
          <div className="carte mt-3 flex flex-col gap-2 border-warn" role="alertdialog" aria-labelledby="rappel-image" aria-describedby="rappel-image-texte">
            <h2 id="rappel-image" className="font-bold">
              {t.imageRappelTitre}
            </h2>
            <p id="rappel-image-texte">{t.imageRappel}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => void envoyerImage()}>
                {t.imageEnvoyer}
              </button>
              <button type="button" className="btn-sec" onClick={() => setImage(null)}>
                {t.annuler}
              </button>
            </div>
          </div>
        ) : null}
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
      {revue.ia ? <p className="alerte mt-2 border-warn">{t.noteIa(revue.ia.ecartees)}</p> : null}
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
