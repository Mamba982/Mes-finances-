"use client";

import { useId, useMemo, useState } from "react";
import { formaterMontant, lireMontant } from "@/domaine/argent";
import { libelleDate } from "@/domaine/dates";
import { coutEncaissement, etatResultats, fraisCarte, resumeFactures, statutAffiche, totalFacture, type Facture } from "@/domaine/factures";
import { lienRecu } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { useCalculs } from "@/ui/calculs";
import { Kpi } from "@/ui/kpi";
import { Dialogue } from "@/ui/dialogue";
import { DialogueFacture } from "./dialogue-facture";
import { DialogueRecu } from "./dialogue-recu";

const a = T.affaires;
const PUCE = { brouillon: "text-mute", envoyee: "text-warn", retard: "text-bad", payee: "text-ok" } as const;

export function VueAffaires() {
  const { factures, transactions, index, profil, aujourdhui, devise } = useCalculs();
  const id = useId();
  const [annee, setAnnee] = useState(Number(aujourdhui.slice(0, 4)));
  const [dialogue, setDialogue] = useState<{ facture: Facture | null; cle: number } | null>(null);
  const [recu, setRecu] = useState(false);
  const [montantCalc, setMontantCalc] = useState("1500");
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ url: string; libelle: string } | null>(null);
  const m2 = (c: number) => formaterMontant(c, 2, devise);
  /** Montant soustrait : « −40,00 $ », mais « 0,00 $ » quand il n'y a rien. */
  const moins = (c: number) => (c ? `−${m2(c)}` : m2(0));

  const resume = resumeFactures(factures, aujourdhui);
  const er = useMemo(() => etatResultats(factures, transactions, index, annee, T.budget.aClasser), [factures, transactions, index, annee]);
  const frais = { cartePct: profil?.frais_carte_pct ?? 2.9, carteFixe: profil?.frais_carte_fixe ?? 25, interac: profil?.frais_interac ?? 0 };
  const montant = lireMontant(montantCalc) ?? 0;
  const calc = coutEncaissement(montant, frais);
  const recus = transactions.filter((t) => t.recuChemin).slice(0, 10);

  async function voirPhoto(chemin: string, libelle: string) {
    setErreurPhoto(null);
    try {
      setPhoto({ url: await lienRecu(chemin), libelle });
    } catch {
      setErreurPhoto(T.erreurs.lecture);
    }
  }

  const ligne = (libelle: string, valeur: string, opts: { gras?: boolean; muet?: boolean; ton?: string } = {}) => (
    <tr className="border-t border-line first:border-t-0">
      <td className={`py-1.5 ${opts.muet ? "text-mute" : ""} ${opts.gras ? "font-bold" : ""}`}>{libelle}</td>
      <td className={`chiffre py-1.5 text-right ${opts.muet ? "text-mute" : ""} ${opts.gras ? "font-bold" : ""} ${opts.ton ?? ""}`}>{valeur}</td>
    </tr>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">{a.factures}</h1>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => setDialogue({ facture: null, cle: Date.now() })}>
            {a.nouvelle}
          </button>
          <button type="button" className="btn-sec" onClick={() => setRecu(true)}>
            {a.ajouterRecu}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Kpi libelle={a.aRecevoir} valeur={m2(resume.aRecevoir)} />
        <Kpi libelle={a.enRetard} valeur={<span className={resume.enRetard ? "text-bad" : ""}>{m2(resume.enRetard)}</span>} ton={resume.enRetard ? "bad" : null} />
        <Kpi libelle={a.encaisse(Number(aujourdhui.slice(0, 4)))} valeur={m2(etatResultats(factures, [], index, Number(aujourdhui.slice(0, 4)), "").revenus)} />
      </div>

      {factures.length ? (
        <ul className="carte mt-3 divide-y divide-line p-0">
          {factures.map((f) => {
            const st = statutAffiche(f, aujourdhui);
            const total = totalFacture(f);
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{f.client}</p>
                  <p className="truncate text-sm text-mute">
                    {f.numero} · {f.echeance ? a.echeance(libelleDate(f.echeance, false)) : f.description}
                  </p>
                  <p className={`text-xs font-bold ${PUCE[st]}`}>{a.statuts[st]}</p>
                </div>
                <div className="text-right">
                  <p className="chiffre font-semibold">{m2(total)}</p>
                  {st !== "payee" ? <p className="chiffre text-xs text-mute">{a.carte(m2(fraisCarte(total, frais.cartePct, frais.carteFixe)))}</p> : null}
                </div>
                <button type="button" className="lien min-h-11 px-1 text-sm" onClick={() => setDialogue({ facture: f, cle: Date.now() })}>
                  {a.ouvrir}
                  <span className="sr-only"> {f.numero}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="carte note mt-3 py-6 text-center">{a.aucune}</p>
      )}

      <div className="mt-6 mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">{a.resultatsTitre(annee)}</h2>
        <div className="flex gap-2">
          <button type="button" className="btn-sec px-3" aria-label={a.anneePrecedente} onClick={() => setAnnee((x) => x - 1)}>
            ‹
          </button>
          <button type="button" className="btn-sec px-3" aria-label={a.anneeSuivante} onClick={() => setAnnee((x) => x + 1)}>
            ›
          </button>
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <section className="carte" aria-label={a.benefice}>
          <table className="w-full text-sm">
            <tbody>
              {ligne(a.revenusEncaisses, m2(er.revenus))}
              {[...er.parCategorie].map(([nom, v]) => (
                <tr key={nom} className="border-t border-line">
                  <td className="py-1.5 text-mute">{nom}</td>
                  <td className="chiffre py-1.5 text-right text-mute">{moins(v)}</td>
                </tr>
              ))}
              {ligne(a.depensesDeductibles, moins(er.depenses))}
              {ligne(a.benefice, m2(er.benefice), { gras: true, ton: er.benefice < 0 ? "text-bad" : "text-ok" })}
            </tbody>
          </table>
          <p className="note mt-2">{a.noteDepenses}</p>
        </section>
        <section className="carte" aria-label={a.taxesNettes}>
          <table className="w-full text-sm">
            <tbody>
              {ligne(a.tpsPercue, m2(er.tpsPercue))}
              {ligne(a.cti, moins(er.cti))}
              {ligne(a.tvqPercue, m2(er.tvqPercue))}
              {ligne(a.rti, moins(er.rti))}
              {ligne(a.taxesNettes, m2(er.taxesNettes), { gras: true })}
            </tbody>
          </table>
          <p className="note mt-2">{a.noteTaxes}</p>
        </section>
      </div>

      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{a.encaissementTitre}</h2>
      <section className="carte">
        <div className="flex max-w-56 flex-col gap-1">
          <label htmlFor={`${id}-calc`} className="etiquette">
            {a.montantFacture}
          </label>
          <input id={`${id}-calc`} inputMode="decimal" value={montantCalc} onChange={(e) => setMontantCalc(e.target.value)} className="champ" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2" aria-live="polite">
          <div>
            <p className="text-sm text-mute">{a.parCarte}</p>
            <p className="chiffre font-display text-xl font-extrabold text-bad">{moins(calc.carte)}</p>
            <p className="text-sm text-mute">{a.tuRecois(m2(montant - calc.carte))}</p>
          </div>
          <div>
            <p className="text-sm text-mute">{a.parInterac}</p>
            <p className="chiffre font-display text-xl font-extrabold">{moins(calc.interac)}</p>
            <p className="text-sm text-mute">{a.tuRecois(m2(montant - calc.interac))}</p>
          </div>
          <div>
            <p className="text-sm text-mute">{a.difference}</p>
            <p className="chiffre font-display text-xl font-extrabold">{m2(calc.difference)}</p>
            <p className="text-sm text-mute">{calc.conseillerVirement ? a.demanderVirement : a.ecartFaible}</p>
          </div>
        </div>
        <p className="note mt-2">{a.noteEncaissement}</p>
      </section>

      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{a.recusTitre}</h2>
      {erreurPhoto ? (
        <p className="alerte mb-2 border-bad" role="alert">
          {erreurPhoto}
        </p>
      ) : null}
      {recus.length ? (
        <ul className="carte divide-y divide-line p-0">
          {recus.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.libelle}</p>
                <p className="text-sm text-mute">{libelleDate(t.date)}</p>
              </div>
              <p className="chiffre font-semibold">{m2(t.montant)}</p>
              <button type="button" className="lien min-h-11 px-1 text-sm" onClick={() => void voirPhoto(t.recuChemin!, t.libelle)}>
                {a.voirPhoto}
                <span className="sr-only"> {t.libelle}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="carte note py-6 text-center">{a.aucunRecu}</p>
      )}

      <DialogueFacture
        key={dialogue?.cle ?? 0}
        ouvert={dialogue !== null}
        facture={dialogue?.facture ?? null}
        aujourdhui={aujourdhui}
        onFermer={() => setDialogue(null)}
      />
      <Dialogue ouvert={photo !== null} titre={a.voirPhoto} onFermer={() => setPhoto(null)}>
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire, hors de l'optimiseur d'images */}
            <img src={photo.url} alt={T.recu.altPhoto(photo.libelle)} className="max-h-[70dvh] w-full rounded-lg object-contain" />
            <button type="button" className="btn-sec mt-3" onClick={() => setPhoto(null)}>
              {T.facture.fermer}
            </button>
          </>
        ) : null}
      </Dialogue>
      <DialogueRecu ouvert={recu} aujourdhui={aujourdhui} onFermer={() => setRecu(false)} />
    </>
  );
}
