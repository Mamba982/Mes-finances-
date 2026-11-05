"use client";

import { useId, useState, type FormEvent } from "react";
import { capaciteAuto } from "@/domaine/budget";
import { centsVersDecimal, formaterMontant, lireMontant } from "@/domaine/argent";
import { modifierCapacite } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { useCalculs } from "@/ui/calculs";

const t = T.capacite;

export function FormulaireCapacite() {
  const { profil, transactions, index, aujourdhui, devise } = useCalculs();
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const auto = capaciteAuto(transactions, index, aujourdhui);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const brut = String(d.get("manuelle") ?? "").trim();
    const manuelle = brut ? lireMontant(brut) : 0;
    if (manuelle === null || manuelle < 0) return setMessage(t.invalide);
    setOccupe(true);
    try {
      await modifierCapacite(d.get("mode") === "manuel" ? "manuel" : "auto", manuelle);
      setMessage(t.enregistre);
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-3">
      <h2 className="font-bold">{t.titre}</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-mode`} className="etiquette">
          {t.mode}
        </label>
        <select id={`${id}-mode`} name="mode" defaultValue={profil?.mode_capacite ?? "auto"} className="champ">
          <option value="auto">{t.auto(auto ? formaterMontant(auto.valeur, 0, devise) : null)}</option>
          <option value="manuel">{t.manuel}</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-montant`} className="etiquette">
          {t.montant}
        </label>
        <input
          id={`${id}-montant`}
          name="manuelle"
          inputMode="decimal"
          defaultValue={profil ? centsVersDecimal(profil.capacite_manuelle).replace(".", ",").replace(/,00$/, "") : ""}
          className="champ"
        />
        <p className="note">{t.note}</p>
      </div>
      <p role="status" aria-live="polite" className={message ? "alerte border-accent" : "sr-only"}>
        {message}
      </p>
      <button type="submit" className="btn self-start" disabled={occupe}>
        {t.enregistrer}
      </button>
    </form>
  );
}
