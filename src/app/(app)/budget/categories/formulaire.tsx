"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { centsVersDecimal, lireMontant } from "@/domaine/argent";
import { enregistrerCategories, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";

const t = T.categories;

export function FormulaireCategories() {
  const { categories } = useDonnees();
  const router = useRouter();
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const modifs: { id: string; nom: string; budget: number }[] = [];
    for (const c of categories) {
      const nom = String(f.get(`nom-${c.id}`) ?? "").trim();
      if (!nom) return setMessage(t.nomVide);
      const brut = String(f.get(`budget-${c.id}`) ?? "").trim();
      const budget = c.type === "depense" ? (brut ? lireMontant(brut) : 0) : c.budget;
      if (budget === null || budget < 0) return setMessage(t.budgetInvalide);
      modifs.push({ id: c.id, nom: nom.slice(0, 60), budget });
    }
    const nomNouvelle = String(f.get("nouvelle-nom") ?? "").trim().slice(0, 60);
    const noms = [...modifs.map((m) => m.nom.toLowerCase()), ...(nomNouvelle ? [nomNouvelle.toLowerCase()] : [])];
    if (new Set(noms).size !== noms.length) return setMessage(t.nomDouble);
    const type = f.get("nouvelle-type") === "revenu" ? "revenu" : "depense";
    setOccupe(true);
    try {
      await enregistrerCategories(modifs, nomNouvelle ? { nom: nomNouvelle, type } : null);
      router.push("/budget");
    } catch {
      setMessage(T.budget.erreurEnregistrement);
      setOccupe(false);
    }
  }

  return (
    <form onSubmit={soumettre} noValidate>
      <h1 className="text-xl font-extrabold">{t.titre}</h1>
      <ul className="carte mt-4 divide-y divide-line p-0">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${id}-n-${c.id}`} className="sr-only">
                {t.nom}
              </label>
              <input id={`${id}-n-${c.id}`} name={`nom-${c.id}`} defaultValue={c.nom} maxLength={60} className="champ py-1.5" />
              <p className="mt-0.5 text-xs text-mute">{t.types[c.type]}</p>
            </div>
            {c.type === "depense" ? (
              <div className="w-28">
                <label htmlFor={`${id}-b-${c.id}`} className="sr-only">
                  {`${t.budgetMois} : ${c.nom}`}
                </label>
                <input
                  id={`${id}-b-${c.id}`}
                  name={`budget-${c.id}`}
                  inputMode="decimal"
                  defaultValue={c.budget ? centsVersDecimal(c.budget).replace(".", ",").replace(/,00$/, "") : ""}
                  placeholder="0"
                  className="champ chiffre py-1.5 text-right"
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <fieldset className="carte mt-3 grid grid-cols-2 gap-2">
        <legend className="sr-only">{t.nouvelle}</legend>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-nn`} className="etiquette">
            {t.nouvelle}
          </label>
          <input id={`${id}-nn`} name="nouvelle-nom" placeholder={t.exemple} maxLength={60} className="champ" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-nt`} className="etiquette">
            {t.type}
          </label>
          <select id={`${id}-nt`} name="nouvelle-type" className="champ">
            <option value="depense">{t.types.depense}</option>
            <option value="revenu">{t.types.revenu}</option>
          </select>
        </div>
      </fieldset>
      <p role="status" aria-live="polite" className={message ? "alerte mt-3" : "sr-only"}>
        {message}
      </p>
      <div className="sticky bottom-20 mt-3 flex gap-2 bg-bg py-2">
        <button type="submit" className="btn" disabled={occupe}>
          {t.enregistrer}
        </button>
        <Link href="/budget" className="btn-sec">
          {t.annuler}
        </Link>
      </div>
    </form>
  );
}
