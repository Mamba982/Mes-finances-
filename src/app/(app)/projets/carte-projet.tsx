"use client";

import { useId, useState, type FormEvent } from "react";
import { formaterMontant, lireMontant } from "@/domaine/argent";
import { estDateISO, libelleDate, libelleMois, moisDe } from "@/domaine/dates";
import type { CalculProjet } from "@/domaine/projets";
import { ajouterPoste, ajouterVersement, changerCoutProjet, supprimerPoste, supprimerProjet, supprimerVersement } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";

const t = T.projets;
const COULEUR_STATUT = { ok: "text-ok", atteint: "text-ok", retard: "text-warn", nonfinance: "text-bad", depasse: "text-bad" } as const;
const FOND_HORIZON = { court: "bg-court", moyen: "bg-moyen", long: "bg-long" } as const;

export function EtiquetteHorizon({ horizon }: { horizon: CalculProjet["horizon"] }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs font-bold text-bg ${FOND_HORIZON[horizon]}`}>{t.horizons[horizon]}</span>;
}

export function CarteProjet({
  calcul,
  ouvert,
  aujourdhui,
  devise,
  onBasculer,
  onModifier,
}: {
  calcul: CalculProjet;
  ouvert: boolean;
  aujourdhui: string;
  devise: string;
  onBasculer: () => void;
  onModifier: () => void;
}) {
  const p = calcul.projet;
  const id = useId();
  const m0 = (c: number) => formaterMontant(c, 0, devise);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const totalPostes = p.postes.reduce((s, q) => s + q.montant, 0);

  async function agir(action: () => Promise<void>) {
    setMessage(null);
    setOccupe(true);
    try {
      await action();
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  function soumettreVersement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const montant = lireMontant(String(d.get("montant") ?? ""));
    const date = String(d.get("date") ?? "");
    if (montant === null || montant <= 0) return setMessage(t.formulaire.montantInvalide);
    if (!estDateISO(date)) return setMessage(t.formulaire.echeanceInvalide);
    void agir(async () => {
      await ajouterVersement(p.id, montant * (d.get("type") === "-1" ? -1 : 1), date);
      form.reset();
    });
  }

  function soumettrePoste(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const nom = String(d.get("nom") ?? "").trim();
    const montant = lireMontant(String(d.get("montant") ?? ""));
    if (!nom) return setMessage(t.formulaire.nomVide);
    if (montant === null || montant < 0) return setMessage(t.formulaire.montantInvalide);
    void agir(async () => {
      await ajouterPoste(p.id, nom.slice(0, 80), montant, String(d.get("explication") ?? "").trim() || null);
      form.reset();
    });
  }

  return (
    <article className="carte" aria-labelledby={`${id}-nom`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id={`${id}-nom`} className="text-[17px] font-bold">
            {p.nom}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <EtiquetteHorizon horizon={calcul.horizon} />
            <span className="rounded-full bg-soft px-2 py-0.5 text-xs font-bold text-mute">{t.priorite(t.priorites[p.priorite].toLowerCase())}</span>
          </div>
        </div>
        <p className={`text-sm font-bold whitespace-nowrap ${COULEUR_STATUT[calcul.statut]}`}>{t.statuts[calcul.statut]}</p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-soft"
        role="progressbar"
        aria-label={t.epargne}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(calcul.pourcentage * 100)}
      >
        <i className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(calcul.pourcentage * 100)}%` }} />
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-3.5 gap-y-1.5 text-sm">
        <div>
          <dt className="text-mute">{t.epargne}</dt>
          <dd className="chiffre font-semibold">
            {m0(calcul.epargne)} ({Math.round(calcul.pourcentage * 100)} %)
          </dd>
        </div>
        <div>
          <dt className="text-mute">{t.coutTotal}</dt>
          <dd className="chiffre font-semibold">{m0(calcul.cout)}</dd>
        </div>
        <div>
          <dt className="text-mute">{t.echeance}</dt>
          <dd className="font-semibold">{libelleDate(p.echeance)}</dd>
        </div>
        {calcul.reste > 0 ? (
          <>
            <div>
              <dt className="text-mute">{t.requisMois}</dt>
              <dd className="chiffre font-semibold">{m0(calcul.requis)}</dd>
            </div>
            <div>
              <dt className="text-mute">{t.allouMois}</dt>
              <dd className="chiffre font-semibold">{m0(calcul.alloue)}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {calcul.statut === "retard" && calcul.atteinteProjetee ? (
        <p className="alerte mt-2.5">{t.alerteRetard(libelleMois(moisDe(calcul.atteinteProjetee)).toLowerCase())}</p>
      ) : null}
      {calcul.statut === "nonfinance" ? <p className="alerte mt-2.5 border-bad">{t.alerteNonFinance}</p> : null}
      {calcul.statut === "depasse" ? <p className="alerte mt-2.5 border-bad">{t.alerteDepasse(m0(calcul.reste))}</p> : null}

      <button type="button" className="lien mt-2.5 min-h-11" aria-expanded={ouvert} onClick={onBasculer}>
        {ouvert ? t.masquerDetail : t.afficherDetail}
      </button>

      {ouvert ? (
        <div className="mt-1 border-t border-line pt-2.5">
          {p.notes ? <p className="note mb-2">{p.notes}</p> : null}

          <h4 className="text-sm font-bold">{t.postesTitre}</h4>
          {p.postes.length ? (
            <>
              <table className="mt-1 w-full text-sm">
                <tbody>
                  {p.postes.map((q) => (
                    <tr key={q.id} className="border-b border-line">
                      <td className="py-1.5">
                        {q.nom}
                        {q.explication ? <span className="block text-mute">{q.explication}</span> : null}
                      </td>
                      <td className="chiffre py-1.5 text-right">{m0(q.montant)}</td>
                      <td className="py-1.5 text-right">
                        <button type="button" className="lien min-h-11 px-1 text-sm" disabled={occupe} onClick={() => void agir(() => supprimerPoste(q.id))}>
                          {t.retirer}
                          <span className="sr-only"> {q.nom}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 font-bold">{t.totalPostes}</td>
                    <td className="chiffre py-1.5 text-right font-bold">{m0(totalPostes)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
              {Math.abs(totalPostes - calcul.cout) > 100 ? (
                <p className="note mt-1">
                  {t.ecartPostes(m0(calcul.cout))}{" "}
                  <button type="button" className="lien" disabled={occupe} onClick={() => void agir(() => changerCoutProjet(p.id, totalPostes))}>
                    {t.utiliser(m0(totalPostes))}
                  </button>
                </p>
              ) : null}
            </>
          ) : (
            <p className="note mt-1">{t.aucunPoste}</p>
          )}
          <form onSubmit={soumettrePoste} noValidate className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-pn`} className="etiquette">
                {t.nomPoste}
              </label>
              <input id={`${id}-pn`} name="nom" maxLength={80} className="champ py-2" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-pm`} className="etiquette">
                {t.montantPoste}
              </label>
              <input id={`${id}-pm`} name="montant" inputMode="decimal" className="champ py-2" />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label htmlFor={`${id}-pe`} className="etiquette">
                {t.explicationPoste}
              </label>
              <input id={`${id}-pe`} name="explication" maxLength={500} className="champ py-2" />
            </div>
            <button type="submit" className="btn-sec col-span-2 justify-self-start" disabled={occupe}>
              {t.ajouterPoste}
            </button>
          </form>

          <form onSubmit={soumettreVersement} noValidate className="mt-4">
            <h4 className="text-sm font-bold">{t.versementTitre}</h4>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-vm`} className="etiquette">
                  {t.montant}
                </label>
                <input id={`${id}-vm`} name="montant" inputMode="decimal" required className="champ py-2" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-vt`} className="etiquette">
                  {t.type}
                </label>
                <select id={`${id}-vt`} name="type" className="champ py-2">
                  <option value="1">{t.versement}</option>
                  <option value="-1">{t.retrait}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-vd`} className="etiquette">
                  {t.date}
                </label>
                <input id={`${id}-vd`} name="date" type="date" defaultValue={aujourdhui} className="champ py-2" />
              </div>
            </div>
            <button type="submit" className="btn mt-2" disabled={occupe}>
              {t.ajouter}
            </button>
          </form>
          {p.versements.length ? (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {p.versements.map((v) => (
                  <tr key={v.id} className="border-b border-line">
                    <td className="py-1.5">
                      {libelleDate(v.date)}
                      {v.note ? ` · ${v.note}` : ""}
                    </td>
                    <td className={`chiffre py-1.5 text-right ${v.montant < 0 ? "text-bad" : "text-ok"}`}>
                      {v.montant < 0 ? "−" : "+"}
                      {m0(Math.abs(v.montant))}
                    </td>
                    <td className="py-1.5 text-right">
                      <button type="button" className="lien min-h-11 px-1 text-sm" disabled={occupe} onClick={() => void agir(() => supprimerVersement(v.id))}>
                        {t.retirer}
                        <span className="sr-only"> {libelleDate(v.date)}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="note mt-1.5">{t.aucunVersement}</p>
          )}

          <p role="status" aria-live="polite" className={message ? "alerte mt-2" : "sr-only"}>
            {message}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-sec" onClick={onModifier}>
              {t.modifier}
            </button>
            {confirmer ? (
              <>
                <button type="button" className="btn bg-bad text-bg" disabled={occupe} onClick={() => void agir(() => supprimerProjet(p.id))}>
                  {t.confirmerSuppression}
                </button>
                <button type="button" className="btn-sec" onClick={() => setConfirmer(false)}>
                  {t.annuler}
                </button>
              </>
            ) : (
              <button type="button" className="btn-sec" onClick={() => setConfirmer(true)}>
                {t.supprimer}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
