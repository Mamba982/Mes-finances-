"use client";

import { useId, useState, type FormEvent } from "react";
import { centsVersDecimal, lireMontant } from "@/domaine/argent";
import { TYPES_COMPTE, type Compte, type TypeCompte } from "@/domaine/placements";
import { enregistrerCompte, supprimerCompte } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { Dialogue } from "@/ui/dialogue";

const t = T.compte;

export function DialogueCompte({ ouvert, compte, aujourdhui, onFermer }: { ouvert: boolean; compte: Compte | null; aujourdhui: string; onFermer: () => void }) {
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [confirmer, setConfirmer] = useState(false);

  function fermer() {
    setMessage(null);
    setConfirmer(false);
    onFermer();
  }

  async function agir(action: () => Promise<void>) {
    setOccupe(true);
    setMessage(null);
    try {
      await action();
      fermer();
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const nom = String(d.get("nom") ?? "").trim();
    const type = String(d.get("type")) as TypeCompte;
    const solde = lireMontant(String(d.get("solde") ?? ""));
    if (!nom) return setMessage(t.nomVide);
    if (solde === null || solde < 0 || !TYPES_COMPTE.includes(type)) return setMessage(t.soldeInvalide);
    void agir(() => enregistrerCompte(compte?.id ?? null, { nom: nom.slice(0, 80), type, solde }, aujourdhui));
  }

  return (
    <Dialogue ouvert={ouvert} titre={compte ? t.modifier : t.nouveau} onFermer={fermer}>
      <form onSubmit={soumettre} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-nom`} className="etiquette">
            {t.nom}
          </label>
          <input id={`${id}-nom`} name="nom" defaultValue={compte?.nom ?? ""} placeholder={t.exempleNom} maxLength={80} className="champ" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-type`} className="etiquette">
              {t.type}
            </label>
            <select id={`${id}-type`} name="type" defaultValue={compte?.type ?? "celi"} className="champ">
              {TYPES_COMPTE.map((k) => (
                <option key={k} value={k}>
                  {T.placements.types[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-solde`} className="etiquette">
              {t.solde}
            </label>
            <input
              id={`${id}-solde`}
              name="solde"
              inputMode="decimal"
              defaultValue={compte ? centsVersDecimal(compte.solde).replace(".", ",").replace(/,00$/, "") : ""}
              className="champ"
            />
          </div>
        </div>
        <p role="status" aria-live="polite" className={message ? "alerte" : "sr-only"}>
          {message}
        </p>
        <div className="sticky bottom-0 -mx-4 -mb-6 flex flex-wrap gap-2 border-t border-line bg-surface px-4 py-3">
          <button type="submit" className="btn" disabled={occupe}>
            {t.enregistrer}
          </button>
          {compte ? (
            <button
              type="button"
              className={confirmer ? "btn bg-bad text-bg" : "btn-sec"}
              disabled={occupe}
              onClick={() => (confirmer ? void agir(() => supprimerCompte(compte.id)) : setConfirmer(true))}
            >
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
