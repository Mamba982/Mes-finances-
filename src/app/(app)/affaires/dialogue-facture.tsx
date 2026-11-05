"use client";

import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { centsVersDecimal, formaterMontant, lireMontant } from "@/domaine/argent";
import { ajouterJours, estDateISO, libelleDate } from "@/domaine/dates";
import { fraisCarte, prochainNumero, statutAffiche, taxes, totalFacture, type Facture, type StatutFacture } from "@/domaine/factures";
import { changerStatutFacture, creerFacture, modifierFacture, supprimerFacture, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { Dialogue } from "@/ui/dialogue";
import { htmlFacture, texteFacture } from "@/ui/facture-document";

const t = T.facture;

const schema = z.object({
  client: z.string().trim().min(1, { error: t.clientVide }).max(120),
  courriel: z
    .string()
    .trim()
    .max(254)
    .refine((s) => !s || z.email().safeParse(s).success, { error: t.courrielInvalide })
    .transform((s) => s || null),
  description: z.string().trim().min(1, { error: t.descriptionVide }).max(500),
  montantHt: z
    .string()
    .transform((s) => lireMontant(s))
    .refine((c): c is number => c !== null && c >= 0, { error: t.montantInvalide }),
  taxable: z.string().transform((s) => s === "1"),
  date: z.string().refine(estDateISO, { error: t.dateInvalide }),
  echeance: z
    .string()
    .refine((s) => !s || estDateISO(s), { error: t.dateInvalide })
    .transform((s) => s || null),
  statut: z.enum(["brouillon", "envoyee", "payee"]),
  datePaiement: z.string(),
});

const texte = (c: number) => centsVersDecimal(c).replace(".", ",").replace(/,00$/, "");
const taux = (n: number) => String(n).replace(".", ",");

export function DialogueFacture({ ouvert, facture, aujourdhui, onFermer }: { ouvert: boolean; facture: Facture | null; aujourdhui: string; onFermer: () => void }) {
  const { profil, factures } = useDonnees();
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [statut, setStatut] = useState<StatutFacture>(facture?.statut ?? "brouillon");
  const devise = profil?.devise ?? "CAD";
  const m2 = (c: number) => formaterMontant(c, 2, devise);
  const payee = facture?.statut === "payee";
  const tauxTps = facture?.tauxTps ?? profil?.taux_tps ?? 5;
  const tauxTvq = facture?.tauxTvq ?? profil?.taux_tvq ?? 9.975;

  function fermer() {
    setMessage(null);
    setConfirmer(false);
    onFermer();
  }

  async function agir(action: () => Promise<void>, fermerEnsuite = true) {
    setOccupe(true);
    setMessage(null);
    try {
      await action();
      if (fermerEnsuite) fermer();
    } catch (e) {
      setMessage(e instanceof Error && e.message === "numéro de facture" ? t.erreurNumero : T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!v.success) return setMessage(v.error.issues[0]?.message ?? t.montantInvalide);
    const { statut: nouveau, datePaiement, ...saisie } = v.data;
    if (nouveau === "payee" && !estDateISO(datePaiement)) return setMessage(t.dateInvalide);
    void agir(async () => {
      if (!facture) {
        await creerFacture(saisie, nouveau === "envoyee" ? "envoyee" : "brouillon");
        return;
      }
      await modifierFacture(facture.id, saisie);
      if (nouveau !== facture.statut) await changerStatutFacture(facture.id, nouveau, datePaiement);
    });
  }

  async function copier() {
    if (!facture) return;
    try {
      await navigator.clipboard.writeText(texteFacture(facture, profil));
      setMessage(t.copie);
    } catch {
      setMessage(t.copieImpossible);
    }
  }

  function telecharger() {
    if (!facture) return;
    const url = URL.createObjectURL(new Blob([htmlFacture(facture, profil)], { type: "text/html;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `Facture ${facture.numero}.html` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const champ = (nom: string, libelle: string, props: Record<string, unknown>) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${nom}`} className="etiquette">
        {libelle}
      </label>
      <input id={`${id}-${nom}`} name={nom} className="champ" disabled={payee} {...props} />
    </div>
  );

  const numero = facture?.numero ?? prochainNumero(factures.map((f) => f.numero), Number(aujourdhui.slice(0, 4)));
  const totaux = facture ? { ...taxes(facture.montantHt, facture.taxable, facture.tauxTps, facture.tauxTvq) } : null;

  return (
    <Dialogue ouvert={ouvert} titre={facture ? t.titre(facture.numero) : t.nouvelle} onFermer={fermer}>
      <form onSubmit={soumettre} noValidate className="flex flex-col gap-3">
        {!facture ? <p className="note">{t.numeroAuto(numero)}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          {champ("client", t.client, { defaultValue: facture?.client ?? "", maxLength: 120, required: true })}
          {champ("courriel", t.courriel, { type: "email", inputMode: "email", defaultValue: facture?.courriel ?? "", maxLength: 254 })}
        </div>
        {champ("description", t.description, { defaultValue: facture?.description ?? "", maxLength: 500, required: true })}
        <div className="grid grid-cols-3 gap-2">
          {champ("montantHt", t.montant, { inputMode: "decimal", defaultValue: facture ? texte(facture.montantHt) : "", required: true })}
          {champ("date", t.date, { type: "date", defaultValue: facture?.date ?? aujourdhui })}
          {champ("echeance", t.echeance, { type: "date", defaultValue: facture ? (facture.echeance ?? "") : ajouterJours(aujourdhui, 30) })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-taxable`} className="etiquette">
              {t.taxes}
            </label>
            <select id={`${id}-taxable`} name="taxable" defaultValue={facture?.taxable === false ? "" : "1"} className="champ" disabled={payee}>
              <option value="1">{t.avecTaxes(taux(tauxTps), taux(tauxTvq))}</option>
              <option value="">{t.sansTaxes}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-statut`} className="etiquette">
              {t.statut}
            </label>
            <select
              id={`${id}-statut`}
              name="statut"
              value={statut}
              onChange={(e) => setStatut(e.target.value as StatutFacture)}
              className="champ"
              disabled={payee}
            >
              <option value="brouillon">{T.affaires.statuts.brouillon}</option>
              <option value="envoyee">{T.affaires.statuts.envoyee}</option>
              {facture ? <option value="payee">{T.affaires.statuts.payee}</option> : null}
            </select>
          </div>
        </div>
        {statut === "payee" && !payee ? champ("datePaiement", t.datePaiement, { type: "date", defaultValue: aujourdhui }) : <input type="hidden" name="datePaiement" value="" />}
        {facture && totaux ? (
          <p className="note">{t.resume(m2(totaux.total), m2(totaux.tps), m2(totaux.tvq), m2(fraisCarte(totalFacture(facture), profil?.frais_carte_pct ?? 2.9, profil?.frais_carte_fixe ?? 25)))}</p>
        ) : null}
        {payee && facture?.datePaiement ? <p className="alerte border-ok">{t.payeeLe(libelleDate(facture.datePaiement))}</p> : null}
        {facture && statutAffiche(facture, aujourdhui) === "retard" ? <p className="alerte border-bad">{T.affaires.statuts.retard}</p> : null}
        {confirmer && payee ? <p className="alerte">{t.supprimerPayee}</p> : null}
        <p role="status" aria-live="polite" className={message ? "alerte" : "sr-only"}>
          {message}
        </p>
        <div className="sticky bottom-0 -mx-4 -mb-6 flex flex-wrap gap-2 border-t border-line bg-surface px-4 py-3">
          {!payee ? (
            <button type="submit" className="btn" disabled={occupe}>
              {t.enregistrer}
            </button>
          ) : null}
          {facture ? (
            <>
              <button type="button" className="btn-sec" onClick={() => void copier()}>
                {t.copier}
              </button>
              <button type="button" className="btn-sec" onClick={telecharger}>
                {t.telecharger}
              </button>
              <button
                type="button"
                className={confirmer ? "btn bg-bad text-bg" : "btn-sec"}
                disabled={occupe}
                onClick={() => (confirmer ? void agir(() => supprimerFacture(facture.id)) : setConfirmer(true))}
              >
                {confirmer ? t.confirmerSuppression : t.supprimer}
              </button>
            </>
          ) : null}
          <button type="button" className="btn-sec" onClick={fermer}>
            {t.fermer}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
