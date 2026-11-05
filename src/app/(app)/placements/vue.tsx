"use client";

import { useId, useState } from "react";
import { formaterMontant, lireMontant } from "@/domaine/argent";
import { libelleDate } from "@/domaine/dates";
import { borneDuree, coutChange, croissance, enveloppe, patrimoine, type Compte } from "@/domaine/placements";
import { T } from "@/textes/fr-CA";
import { useCalculs } from "@/ui/calculs";
import { GraphiqueCourbes } from "@/ui/graphique";
import { Kpi } from "@/ui/kpi";
import { EtiquetteHorizon } from "../projets/carte-projet";
import { DialogueCompte } from "./dialogue-compte";

const p = T.placements;

/** Nombre décimal saisi (« 1,5 », « 2.25 ») ; null si invalide ou négatif. */
function nombre(s: string): number | null {
  const v = Number(s.trim().replace(/\s/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(v) && v >= 0 ? v : null;
}

export function VuePlacements() {
  const { comptes, repartition, profil, aujourdhui, devise } = useCalculs();
  const id = useId();
  const [dialogue, setDialogue] = useState<{ compte: Compte | null; cle: number } | null>(null);
  const [sim, setSim] = useState({ depart: "1000", mensuel: "200", duree: "10", rendement: "5", frais: "2" });
  const [change, setChange] = useState({ montant: "5000", frais: String(profil?.frais_change_pct ?? 1.5).replace(".", ",") });
  const m0 = (c: number) => formaterMontant(c, 0, devise);
  const m2 = (c: number) => formaterMontant(c, 2, devise);
  const pat = patrimoine(comptes);

  const depart = lireMontant(sim.depart);
  const mensuel = lireMontant(sim.mensuel);
  const duree = nombre(sim.duree);
  const rendement = nombre(sim.rendement);
  const fraisPct = nombre(sim.frais);
  const simValide = depart !== null && depart >= 0 && mensuel !== null && mensuel >= 0 && duree !== null && rendement !== null && fraisPct !== null;
  const g = simValide ? croissance(depart, mensuel, rendement, fraisPct, borneDuree(duree)) : null;
  const ans = simValide ? borneDuree(duree) : 0;
  const etiquettes = g
    ? g.points.map((_, i) => (i === 0 ? p.depart0 : i === g.points.length - 1 ? p.ans(Math.round(ans * 10) / 10) : p.ans(i)))
    : [];

  const montantChange = lireMontant(change.montant);
  const fraisChange = nombre(change.frais);
  const c = montantChange !== null && montantChange >= 0 && fraisChange !== null ? coutChange(montantChange, fraisChange, profil?.abonnement_compte_us ?? 1000) : null;

  const champ = (cle: string, libelle: string, valeur: string, changer: (v: string) => void) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${cle}`} className="etiquette">
        {libelle}
      </label>
      <input id={`${id}-${cle}`} inputMode="decimal" value={valeur} onChange={(e) => changer(e.target.value)} className="champ" />
    </div>
  );

  return (
    <>
      <h1 className="sr-only">{T.nav.placements}</h1>
      <p className="alerte border-accent">{T.vide.infoGenerale}</p>

      <div className="mt-5 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">{p.comptesTitre}</h2>
        <button type="button" className="btn" onClick={() => setDialogue({ compte: null, cle: Date.now() })}>
          {p.ajouterCompte}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Kpi libelle={p.actifs} valeur={m0(pat.actifs)} />
        <Kpi libelle={p.dettes} valeur={<span className={pat.dettes ? "text-bad" : ""}>{m0(pat.dettes)}</span>} />
        <Kpi libelle={p.avoirNet} valeur={m0(pat.net)} detail={p.actifsMoinsDettes} ton={pat.net < 0 ? "bad" : "ok"} />
      </div>
      {comptes.length ? (
        <ul className="carte mt-3 divide-y divide-line p-0">
          {comptes.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{k.nom}</p>
                <p className="text-sm text-mute">
                  <span className={`font-bold ${k.type === "dette" ? "text-bad" : ""}`}>{p.types[k.type]}</span> · {p.majLe(libelleDate(k.majLe))}
                </p>
              </div>
              <p className="chiffre font-semibold">
                {k.type === "dette" ? "−" : ""}
                {m2(k.solde)}
              </p>
              <button type="button" className="lien min-h-11 px-1 text-sm" onClick={() => setDialogue({ compte: k, cle: Date.now() })}>
                {p.modifier}
                <span className="sr-only"> {k.nom}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="carte note mt-3 py-6 text-center">{T.vide.placements}</p>
      )}

      {repartition.projets.length ? (
        <>
          <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{p.ouGarderTitre}</h2>
          <div className="grid gap-2.5">
            {repartition.projets.map((x) => {
              const [titre, explication] = p.enveloppes[enveloppe(x)];
              return (
                <section key={x.projet.id} className="carte" aria-label={x.projet.nom}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold">{x.projet.nom}</h3>
                    <span className="flex items-center gap-1.5 text-sm text-mute">
                      <EtiquetteHorizon horizon={x.horizon} /> {p.mois(Math.max(0, x.mois))}
                    </span>
                  </div>
                  <p className="mt-1.5 font-semibold">{titre}</p>
                  <p className="note">{explication}</p>
                </section>
              );
            })}
          </div>
        </>
      ) : null}

      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{p.simulateurTitre}</h2>
      <section className="carte">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {champ("depart", p.depart, sim.depart, (v) => setSim((s) => ({ ...s, depart: v })))}
          {champ("mensuel", p.mensuel, sim.mensuel, (v) => setSim((s) => ({ ...s, mensuel: v })))}
          {champ("duree", p.duree, sim.duree, (v) => setSim((s) => ({ ...s, duree: v })))}
          {champ("rendement", p.rendement, sim.rendement, (v) => setSim((s) => ({ ...s, rendement: v })))}
          {champ("frais", p.frais, sim.frais, (v) => setSim((s) => ({ ...s, frais: v })))}
        </div>
        {g ? (
          <div aria-live="polite">
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Kpi libelle={p.totalVerse} valeur={m0(g.totalVerse)} />
              <Kpi libelle={p.valeurFinale} valeur={m0(g.valeurFinale)} />
              <Kpi libelle={p.sansFrais} valeur={m0(g.valeurSansFrais)} />
              <Kpi libelle={p.coutFrais} valeur={<span className="text-bad">{m0(g.coutDesFrais)}</span>} />
            </div>
            <div className="mt-3">
              <GraphiqueCourbes
                libelle={p.graphiqueLibelle}
                devise={devise}
                etiquettes={etiquettes}
                series={[
                  { nom: p.sansFraisLegende, points: g.pointsSansFrais, couleur: "var(--mute)", pointille: true },
                  { nom: p.avecFraisLegende, points: g.points, couleur: "var(--accent)" },
                ]}
              />
            </div>
          </div>
        ) : (
          <p className="alerte mt-3" role="status">
            {p.valeurInvalide}
          </p>
        )}
        <p className="note mt-2">{p.noteSimulateur}</p>
      </section>

      <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{p.changeTitre}</h2>
      <section className="carte">
        <div className="grid grid-cols-2 gap-2">
          {champ("change-montant", p.montantConverti, change.montant, (v) => setChange((s) => ({ ...s, montant: v })))}
          {champ("change-frais", p.fraisConversion, change.frais, (v) => setChange((s) => ({ ...s, frais: v })))}
        </div>
        {c ? (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3" aria-live="polite">
            <Kpi libelle={p.coutAller} valeur={m2(c.allerMensuel)} />
            <Kpi libelle={p.allerRetour} valeur={m2(c.allerRetourMensuel)} detail={p.surUnAn(m0(c.allerRetourAnnuel))} />
            <Kpi
              libelle={p.compteUs(m0(profil?.abonnement_compte_us ?? 1000))}
              valeur={c.compteUsRentable ? <span className="text-ok">{p.rentable}</span> : p.pasRentable}
              detail={p.rentableAuDela(m0(c.seuilRentabilite))}
            />
          </div>
        ) : (
          <p className="alerte mt-3" role="status">
            {p.valeurInvalide}
          </p>
        )}
        <p className="note mt-2">{p.noteChange}</p>
      </section>

      <DialogueCompte key={dialogue?.cle ?? 0} ouvert={dialogue !== null} compte={dialogue?.compte ?? null} aujourdhui={aujourdhui} onFermer={() => setDialogue(null)} />
    </>
  );
}
