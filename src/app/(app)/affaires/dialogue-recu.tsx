"use client";

import { useId, useState, type FormEvent } from "react";
import { lireMontant } from "@/domaine/argent";
import { estDateISO } from "@/domaine/dates";
import { ajouterRecu, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { Dialogue } from "@/ui/dialogue";
import { compresserImage } from "@/ui/image";

const t = T.recu;

/**
 * Saisie d'un reçu à la main, avec photo facultative. La lecture automatique de la photo
 * par l'IA arrive à la phase 6 ; elle préremplira ces mêmes champs, toujours vérifiés ici.
 */
export function DialogueRecu({ ouvert, aujourdhui, onFermer }: { ouvert: boolean; aujourdhui: string; onFermer: () => void }) {
  const { categories } = useDonnees();
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const depenses = categories.filter((c) => c.type === "depense");
  const affaires = categories.find((c) => c.code === "affaires")?.id ?? "";

  function fermer() {
    setMessage(null);
    onFermer();
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
      <form onSubmit={soumettre} noValidate className="flex flex-col gap-3">
        {champ("photo", t.photo, { type: "file", accept: "image/jpeg,image/png,image/webp", capture: "environment" })}
        <p className="note">{t.notePhoto}</p>
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
