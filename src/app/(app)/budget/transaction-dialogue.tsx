"use client";

import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { centsVersDecimal, lireMontant } from "@/domaine/argent";
import type { Categorie, Transaction } from "@/domaine/budget";
import { estDateISO } from "@/domaine/dates";
import { ajouterTransaction, modifierTransaction, supprimerTransaction, type SaisieTransaction } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { Dialogue } from "@/ui/dialogue";

const t = T.transaction;

const schema = z.object({
  date: z.string().refine(estDateISO, { error: t.dateInvalide }),
  libelle: z.string().trim().min(1, { error: t.descriptionVide }).max(300),
  montant: z
    .string()
    .transform((s) => lireMontant(s))
    .refine((c): c is number => c !== null && c !== 0, { error: t.montantInvalide }),
  categorieId: z.string().transform((s) => s || null),
  deductible: z.string().transform((s) => s === "1"),
  tps: z
    .string()
    .transform((s) => (s.trim() ? lireMontant(s) : 0))
    .refine((c): c is number => c !== null && c >= 0, { error: t.taxeInvalide }),
  tvq: z
    .string()
    .transform((s) => (s.trim() ? lireMontant(s) : 0))
    .refine((c): c is number => c !== null && c >= 0, { error: t.taxeInvalide }),
});

const versTexte = (c: number) => centsVersDecimal(c).replace(".", ",");

export function DialogueTransaction({
  transaction,
  ouvert,
  aujourdhui,
  categories,
  onFermer,
}: {
  transaction: Transaction | null;
  ouvert: boolean;
  aujourdhui: string;
  categories: readonly Categorie[];
  onFermer: () => void;
}) {
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [confirmer, setConfirmer] = useState(false);

  function fermer() {
    setMessage(null);
    setConfirmer(false);
    onFermer();
  }

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!v.success) return setMessage(v.error.issues[0]?.message ?? t.montantInvalide);
    setOccupe(true);
    try {
      const s: SaisieTransaction = v.data;
      if (transaction) await modifierTransaction(transaction.id, s);
      else await ajouterTransaction(s);
      fermer();
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  async function supprimer() {
    if (!transaction) return;
    if (!confirmer) return setConfirmer(true);
    setOccupe(true);
    try {
      await supprimerTransaction(transaction.id);
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
    <Dialogue ouvert={ouvert} titre={transaction ? t.modifier : t.nouvelle} onFermer={fermer}>
      <form onSubmit={soumettre} noValidate className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {champ("date", t.date, { type: "date", defaultValue: transaction?.date ?? aujourdhui, required: true })}
          {champ("montant", t.montant, { inputMode: "decimal", defaultValue: transaction ? versTexte(transaction.montant) : "", placeholder: "-45,99", required: true })}
        </div>
        {champ("libelle", t.description, { defaultValue: transaction?.libelle ?? "", required: true, maxLength: 300 })}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-cat`} className="etiquette">
              {T.budget.categorie}
            </label>
            <select id={`${id}-cat`} name="categorieId" defaultValue={transaction?.categorieId ?? ""} className="champ">
              <option value="">{T.budget.aClasser}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-ded`} className="etiquette">
              {t.entreprise}
            </label>
            <select id={`${id}-ded`} name="deductible" defaultValue={transaction?.deductible ? "1" : ""} className="champ">
              <option value="">{t.non}</option>
              <option value="1">{t.ouiDeductible}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {champ("tps", t.tps, { inputMode: "decimal", defaultValue: transaction?.tps ? versTexte(transaction.tps) : "" })}
          {champ("tvq", t.tvq, { inputMode: "decimal", defaultValue: transaction?.tvq ? versTexte(transaction.tvq) : "" })}
        </div>
        <p role="status" aria-live="polite" className={message ? "alerte" : "sr-only"}>
          {message}
        </p>
        <div className="sticky bottom-0 -mx-4 -mb-6 flex flex-wrap gap-2 border-t border-line bg-surface px-4 py-3">
          <button type="submit" className="btn" disabled={occupe}>
            {t.enregistrer}
          </button>
          {transaction ? (
            <button type="button" className={confirmer ? "btn bg-bad text-bg" : "btn-sec"} disabled={occupe} onClick={() => void supprimer()}>
              {confirmer ? t.confirmerSuppression : t.supprimer}
            </button>
          ) : null}
          <button type="button" className="btn-sec" onClick={fermer}>
            {t.annuler}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
