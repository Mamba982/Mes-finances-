"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { centsVersDecimal, lireMontant } from "@/domaine/argent";
import { estDateISO } from "@/domaine/dates";
import { ajouterRecu, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { Dialogue } from "@/ui/dialogue";
import { useIaDisponible } from "@/ui/ia";
import { compresserImage, imagePourIa } from "@/ui/image";

const t = T.recu;

const cents = z.number().int().nullable();
const schemaLu = z.object({
  recu: z.object({ date: z.string().nullable(), marchand: z.string().nullable(), description: z.string().nullable(), total: cents, tps: cents, tvq: cents }),
});
const schemaErreur = z.object({ erreur: z.string() });

/**
 * Saisie d'un reçu, avec photo facultative. Si l'IA est activée, elle peut lire la photo et
 * préremplir ces mêmes champs : ce formulaire est l'écran de revue, rien n'est enregistré avant « Ajouter ».
 */
export function DialogueRecu({ ouvert, aujourdhui, onFermer }: { ouvert: boolean; aujourdhui: string; onFermer: () => void }) {
  const { categories, profil } = useDonnees();
  const id = useId();
  const formulaire = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [rappel, setRappel] = useState(false);
  const iaUtilisable = useIaDisponible() && Boolean(profil?.ia_active);
  const depenses = categories.filter((c) => c.type === "depense");
  const affaires = categories.find((c) => c.code === "affaires")?.id ?? "";

  function fermer() {
    setMessage(null);
    setPhoto(null);
    setRappel(false);
    onFermer();
  }

  function remplir(nom: string, valeur: string | null) {
    const champ = formulaire.current?.elements.namedItem(nom);
    if (valeur !== null && champ instanceof HTMLInputElement) champ.value = valeur;
  }

  async function lireAvecIa() {
    if (!photo) return;
    setRappel(false);
    setOccupe(true);
    setMessage(t.lectureIa);
    try {
      const r = await fetch("/api/ia/recu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await imagePourIa(photo)) });
      const j: unknown = await r.json().catch(() => null);
      if (!r.ok) return setMessage(schemaErreur.safeParse(j).data?.erreur ?? T.ia.erreurs.connexion);
      const v = schemaLu.safeParse(j);
      if (!v.success) return setMessage(T.ia.erreurs.reponse);
      const l = v.data.recu;
      const decimal = (c: number | null) => (c === null ? null : centsVersDecimal(c).replace(".", ","));
      remplir("date", l.date);
      remplir("marchand", l.marchand);
      remplir("description", l.description);
      remplir("total", decimal(l.total));
      remplir("tps", decimal(l.tps));
      remplir("tvq", decimal(l.tvq));
      setMessage(l.marchand || l.total !== null ? t.prerempli : t.rienLu);
    } catch {
      setMessage(T.ia.erreurs.connexion);
    } finally {
      setOccupe(false);
    }
  }

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const texte = (k: string) => String(d.get(k) ?? "").trim();
    const marchand = texte("marchand");
    const total = lireMontant(texte("total"));
    const tps = texte("tps") ? lireMontant(texte("tps")) : 0;
    const tvq = texte("tvq") ? lireMontant(texte("tvq")) : 0;
    const date = texte("date");
    if (!estDateISO(date)) return setMessage(T.transaction.dateInvalide);
    if (!marchand) return setMessage(t.marchandVide);
    if (total === null || total === 0) return setMessage(t.totalInvalide);
    if (tps === null || tvq === null || tps < 0 || tvq < 0) return setMessage(t.taxeInvalide);
    const fichier = d.get("photo");
    setOccupe(true);
    setMessage(null);
    let photo: Blob | null = null;
    if (fichier instanceof File && fichier.size > 0) {
      try {
        photo = await compresserImage(fichier);
      } catch {
        setOccupe(false);
        return setMessage(t.photoIllisible);
      }
    }
    try {
      await ajouterRecu(
        { date, marchand: marchand.slice(0, 120), description: texte("description").slice(0, 150), total, tps, tvq, categorieId: texte("categorie") || null },
        photo,
      );
      fermer();
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  const champ = (nom: string, libelle: string, props: Record<string, unknown> = {}) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${nom}`} className="etiquette">
        {libelle}
      </label>
      <input id={`${id}-${nom}`} name={nom} className="champ" {...props} />
    </div>
  );

  return (
    <Dialogue ouvert={ouvert} titre={t.titre} onFermer={fermer}>
      <form ref={formulaire} onSubmit={soumettre} noValidate className="flex flex-col gap-3">
        {champ("photo", t.photo, {
          type: "file",
          accept: "image/jpeg,image/png,image/webp",
          capture: "environment",
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPhoto(e.target.files?.[0] ?? null),
        })}
        <p className="note">{t.notePhoto}</p>
        {iaUtilisable && photo && !rappel ? (
          <button type="button" className="btn-sec self-start" disabled={occupe} onClick={() => setRappel(true)}>
            {t.lireIa}
          </button>
        ) : null}
        {rappel ? (
          <div className="alerte flex flex-col gap-2 border-warn">
            <p>{t.rappelIa}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => void lireAvecIa()}>
                {t.envoyerIa}
              </button>
              <button type="button" className="btn-sec" onClick={() => setRappel(false)}>
                {t.annuler}
              </button>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {champ("date", t.date, { type: "date", defaultValue: aujourdhui })}
          {champ("marchand", t.marchand, { maxLength: 120, required: true })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {champ("total", t.total, { inputMode: "decimal", required: true })}
          {champ("tps", t.tps, { inputMode: "decimal" })}
          {champ("tvq", t.tvq, { inputMode: "decimal" })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-categorie`} className="etiquette">
              {t.categorie}
            </label>
            <select id={`${id}-categorie`} name="categorie" defaultValue={affaires} className="champ">
              {depenses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
          {champ("description", t.description, { maxLength: 150 })}
        </div>
        <p className="note">{t.verifier}</p>
        <p role="status" aria-live="polite" className={message ? "alerte" : "sr-only"}>
          {message}
        </p>
        <div className="sticky bottom-0 -mx-4 -mb-6 flex flex-wrap gap-2 border-t border-line bg-surface px-4 py-3">
          <button type="submit" className="btn" disabled={occupe}>
            {t.ajouter}
          </button>
          <button type="button" className="btn-sec" onClick={fermer}>
            {t.annuler}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
