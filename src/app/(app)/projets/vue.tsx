"use client";

import Link from "next/link";
import { useState } from "react";
import { formaterMontant } from "@/domaine/argent";
import { libelleMoisCourt } from "@/domaine/dates";
import { epargneCumulee, trierPourAffichage, type Projet } from "@/domaine/projets";
import { T } from "@/textes/fr-CA";
import { useCalculs } from "@/ui/calculs";
import { GraphiqueCourbes } from "@/ui/graphique";
import { CarteProjet, EtiquetteHorizon } from "./carte-projet";
import { DialogueProjet } from "./dialogue-projet";

const t = T.projets;

export function VueProjets() {
  const { repartition: r, capacite, projets, aujourdhui, devise } = useCalculs();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<{ projet: Projet | null } | null>(null);
  const m0 = (c: number) => formaterMontant(c, 0, devise);
  const liste = trierPourAffichage(r);
  const points = epargneCumulee(r, aujourdhui);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">{t.titre}</h1>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => setDialogue({ projet: null })}>
            {t.nouveau}
          </button>
          {projets.length ? (
            <Link href="/projets/scenario" className="btn-sec">
              {t.scenario}
            </Link>
          ) : null}
        </div>
      </div>

      {capacite.valeur <= 0 && projets.length ? (
        <p className="alerte mt-3">
          {t.capaciteNulle}{" "}
          <Link href="/reglages" className="lien">
            {t.reglages}
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {(["court", "moyen", "long"] as const).map((h) => (
          <section key={h} className="carte" aria-label={t.horizons[h]}>
            <EtiquetteHorizon horizon={h} />
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm sm:grid-cols-1">
              <div>
                <dt className="text-mute">{t.nombre}</dt>
                <dd className="chiffre font-semibold">{r.parHorizon[h].nombre}</dd>
              </div>
              <div>
                <dt className="text-mute">{t.resteAFinancer}</dt>
                <dd className="chiffre font-semibold">{m0(r.parHorizon[h].reste)}</dd>
              </div>
              <div>
                <dt className="text-mute">{t.requisMois}</dt>
                <dd className="chiffre font-semibold">{m0(r.parHorizon[h].requis)}</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
      <p className="note mt-1.5">{t.noteHorizons}</p>

      <div className="mt-3 grid gap-2.5">
        {liste.length ? (
          liste.map((x) => (
            <CarteProjet
              key={x.projet.id}
              calcul={x}
              ouvert={ouvert === x.projet.id}
              aujourdhui={aujourdhui}
              devise={devise}
              onBasculer={() => setOuvert((o) => (o === x.projet.id ? null : x.projet.id))}
              onModifier={() => setDialogue({ projet: x.projet })}
            />
          ))
        ) : (
          <p className="carte note py-6 text-center">{t.vide}</p>
        )}
      </div>

      {liste.length ? (
        <>
          <h2 className="mt-6 mb-2.5 text-[17px] font-bold">{t.graphiqueTitre}</h2>
          <div className="carte">
            <GraphiqueCourbes
              libelle={t.graphiqueLibelle}
              devise={devise}
              etiquettes={points.map((p) => libelleMoisCourt(p.mois))}
              series={[
                { nom: t.legendePrevue, points: points.map((p) => p.prevue), couleur: "var(--accent)", remplir: true },
                { nom: t.legendeEchu, points: points.map((p) => p.coutEchu), couleur: "var(--warn)", pointille: true },
              ]}
            />
            <p className="note mt-1.5">{t.noteGraphique}</p>
          </div>
          <p className="note mt-2.5">{t.noteRepartition}</p>
        </>
      ) : null}

      <DialogueProjet
        ouvert={dialogue !== null}
        projet={dialogue?.projet ?? null}
        onFermer={() => setDialogue(null)}
        onCree={(id) => setOuvert(id)}
      />
    </>
  );
}
