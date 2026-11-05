"use client";

import { useId, useState, type FormEvent } from "react";
import { centsVersDecimal, lireMontant } from "@/domaine/argent";
import { modifierProfilAffaires, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";

const t = T.affairesReglages;
const texte = (c: number) => centsVersDecimal(c).replace(".", ",");
const nombre = (s: string): number | null => {
  const v = Number(s.trim().replace(",", "."));
  return s.trim() && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
};

export function FormulaireAffaires() {
  const { profil } = useDonnees();
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const txt = (k: string) => String(d.get(k) ?? "").trim();
    const tps = nombre(txt("taux_tps"));
    const tvq = nombre(txt("taux_tvq"));
    const pct = nombre(txt("frais_carte_pct"));
    const fixe = txt("frais_carte_fixe") ? lireMontant(txt("frais_carte_fixe")) : 0;
    const interac = txt("frais_interac") ? lireMontant(txt("frais_interac")) : 0;
    const change = nombre(txt("frais_change_pct"));
    const abonnement = txt("abonnement_compte_us") ? lireMontant(txt("abonnement_compte_us")) : 0;
    if (tps === null || tvq === null || pct === null || change === null || fixe === null || interac === null || abonnement === null) return setMessage(t.invalide);
    if (fixe < 0 || interac < 0 || abonnement < 0) return setMessage(t.invalide);
    setOccupe(true);
    try {
      await modifierProfilAffaires({
        entreprise_nom: txt("entreprise_nom").slice(0, 120) || null,
        entreprise_adresse: txt("entreprise_adresse").slice(0, 300) || null,
        no_tps: txt("no_tps").slice(0, 30) || null,
        no_tvq: txt("no_tvq").slice(0, 30) || null,
        taux_tps: tps,
        taux_tvq: tvq,
        frais_carte_pct: pct,
        frais_carte_fixe: fixe,
        frais_interac: interac,
        frais_change_pct: change,
        abonnement_compte_us: abonnement,
      });
      setMessage(t.enregistre);
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  const champ = (nom: string, libelle: string, valeur: string, props: Record<string, unknown> = {}) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${nom}`} className="etiquette">
        {libelle}
      </label>
      <input id={`${id}-${nom}`} name={nom} defaultValue={valeur} className="champ" {...props} />
    </div>
  );

  return (
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-3">
      <h2 className="font-bold">{t.titre}</h2>
      {champ("entreprise_nom", t.entreprise, profil?.entreprise_nom ?? "", { maxLength: 120 })}
      {champ("entreprise_adresse", t.adresse, profil?.entreprise_adresse ?? "", { maxLength: 300 })}
      <div className="grid grid-cols-2 gap-2">
        {champ("no_tps", t.noTps, profil?.no_tps ?? "", { maxLength: 30 })}
        {champ("no_tvq", t.noTvq, profil?.no_tvq ?? "", { maxLength: 30 })}
        {champ("taux_tps", t.tauxTps, String(profil?.taux_tps ?? 5).replace(".", ","), { inputMode: "decimal" })}
        {champ("taux_tvq", t.tauxTvq, String(profil?.taux_tvq ?? 9.975).replace(".", ","), { inputMode: "decimal" })}
        {champ("frais_carte_pct", t.fraisCartePct, String(profil?.frais_carte_pct ?? 2.9).replace(".", ","), { inputMode: "decimal" })}
        {champ("frais_carte_fixe", t.fraisCarteFixe, texte(profil?.frais_carte_fixe ?? 25), { inputMode: "decimal" })}
        {champ("frais_interac", t.fraisInterac, texte(profil?.frais_interac ?? 0), { inputMode: "decimal" })}
        {champ("frais_change_pct", t.fraisChange, String(profil?.frais_change_pct ?? 1.5).replace(".", ","), { inputMode: "decimal" })}
        {champ("abonnement_compte_us", t.abonnementUs, texte(profil?.abonnement_compte_us ?? 1000), { inputMode: "decimal" })}
      </div>
      <p className="note">{t.noteTaux}</p>
      <p role="status" aria-live="polite" className={message ? "alerte border-accent" : "sr-only"}>
        {message}
      </p>
      <button type="submit" className="btn self-start" disabled={occupe}>
        {t.enregistrer}
      </button>
    </form>
  );
}
