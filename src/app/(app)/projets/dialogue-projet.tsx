"use client";

import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { centsVersDecimal, lireMontant } from "@/domaine/argent";
import { estDateISO } from "@/domaine/dates";
import type { Projet } from "@/domaine/projets";
import { creerProjet, modifierProjet } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { Dialogue } from "@/ui/dialogue";

const f = T.projets.formulaire;

const schema = z.object({
  nom: z.string().trim().min(1, { error: f.nomVide }).max(80),
  cout: z
    .string()
    .transform((s) => lireMontant(s))
    .refine((c): c is number => c !== null && c > 0, { error: f.coutInvalide }),
  montantDepart: z
    .string()
    .transform((s) => (s.trim() ? lireMontant(s) : 0))
    .refine((c): c is number => c !== null && c >= 0, { error: f.departInvalide }),
  echeance: z.string().refine(estDateISO, { error: f.echeanceInvalide }),
  priorite: z.enum(["1", "2", "3"]).transform((p) => Number(p) as 1 | 2 | 3),
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((s) => s || null),
});

const texte = (c: number) => centsVersDecimal(c).replace(".", ",").replace(/,00$/, "");

export function DialogueProjet({
  ouvert,
  projet,
  onFermer,
  onCree,
}: {
  ouvert: boolean;
  projet: Projet | null;
  onFermer: () => void;
  onCree?: (id: string) => void;
}) {
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  function fermer() {
    setMessage(null);
    onFermer();
  }

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!v.success) return setMessage(v.error.issues[0]?.message ?? f.coutInvalide);
    setOccupe(true);
    try {
      if (projet) await modifierProjet(projet.id, v.data);
      else onCree?.(await creerProjet(v.data));
      fermer();
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  const champ = (nom: string, libelle: string, props: Record<string, unknown>) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${nom}`} className="etiquette">
        {libelle}
      </label>
      <input id={`${id}-${nom}`} name={nom} className="champ" {...props} />
    </div>
  );

  return (
    <Dialogue ouvert={ouvert} titre={projet ? f.modifier : f.nouveau} onFermer={fermer}>
      <form onSubmit={soumettre} noValidate className="flex flex-col gap-3">
        {champ("nom", f.nom, { defaultValue: projet?.nom ?? "", placeholder: f.exempleNom, maxLength: 80, required: true })}
        <div className="grid grid-cols-2 gap-2">
          {champ("cout", f.cout, { inputMode: "decimal", defaultValue: projet ? texte(projet.cout) : "", required: true })}
          {champ("montantDepart", f.depart, { inputMode: "decimal", defaultValue: projet ? texte(projet.montantDepart) : "", placeholder: "0" })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {champ("echeance", f.echeance, { type: "date", defaultValue: projet?.echeance ?? "", required: true })}
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-priorite`} className="etiquette">
              {f.priorite}
            </label>
            <select id={`${id}-priorite`} name="priorite" defaultValue={String(projet?.priorite ?? 2)} className="champ">
              {([1, 2, 3] as const).map((p) => (
                <option key={p} value={p}>
                  {T.projets.priorites[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {champ("notes", f.notes, { defaultValue: projet?.notes ?? "", maxLength: 1000 })}
        <p role="status" aria-live="polite" className={message ? "alerte" : "sr-only"}>
          {message}
        </p>
        <div className="sticky bottom-0 -mx-4 -mb-6 flex flex-wrap gap-2 border-t border-line bg-surface px-4 py-3">
          <button type="submit" className="btn" disabled={occupe}>
            {f.enregistrer}
          </button>
          <button type="button" className="btn-sec" onClick={fermer}>
            {f.annuler}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
