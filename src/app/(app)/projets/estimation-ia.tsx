"use client";

import { useId, useState } from "react";
import { z } from "zod";
import { centsVersDecimal, formaterMontant, lireMontant } from "@/domaine/argent";
import type { Projet } from "@/domaine/projets";
import { ajouterPoste, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { useIaDisponible } from "@/ui/ia";

const t = T.estimation;
const schemaReponse = z.object({
  postes: z.array(z.object({ nom: z.string(), quantite: z.number(), prixUnitaire: z.number().int(), montant: z.number().int(), explication: z.string().nullable() })),
});
const schemaErreur = z.object({ erreur: z.string() });

interface PosteRevue {
  nom: string;
  detail: string;
  explication: string | null;
  montant: string; // saisi, relu par lireMontant() à l'ajout
  garder: boolean;
}

/** Estimation des postes par l'IA, avec liste de revue : rien n'est ajouté sans ta confirmation. */
export function EstimationIa({ projet, aujourdhui, devise }: { projet: Projet; aujourdhui: string; devise: string }) {
  const { profil } = useDonnees();
  const disponible = useIaDisponible();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [description, setDescription] = useState(projet.notes ?? "");
  const [postes, setPostes] = useState<PosteRevue[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  if (!disponible || !profil?.ia_active) return null;

  async function estimer() {
    setOccupe(true);
    setMessage(null);
    setPostes(null);
    try {
      const r = await fetch("/api/ia/estimation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: projet.nom, description: description.trim().slice(0, 500), echeance: projet.echeance, aujourdhui }),
      });
      const j: unknown = await r.json().catch(() => null);
      if (!r.ok) return setMessage(schemaErreur.safeParse(j).data?.erreur ?? T.ia.erreurs.connexion);
      const v = schemaReponse.safeParse(j);
      if (!v.success) return setMessage(T.ia.erreurs.reponse);
      if (!v.data.postes.length) return setMessage(t.aucun);
      setPostes(
        v.data.postes.map((p) => ({
          nom: p.nom,
          detail: t.detail(String(p.quantite).replace(".", ","), formaterMontant(p.prixUnitaire, 2, devise)),
          explication: p.explication,
          montant: centsVersDecimal(p.montant).replace(".", ","),
          garder: true,
        })),
      );
    } catch {
      setMessage(T.ia.erreurs.connexion);
    } finally {
      setOccupe(false);
    }
  }

  async function ajouter() {
    if (!postes) return;
    const retenus = postes.filter((p) => p.garder).map((p) => ({ ...p, cents: lireMontant(p.montant) }));
    if (retenus.some((p) => p.cents === null || p.cents < 0)) return setMessage(T.projets.formulaire.montantInvalide);
    setOccupe(true);
    setMessage(null);
    try {
      for (const p of retenus) await ajouterPoste(projet.id, p.nom, p.cents!, p.explication);
      setPostes(null);
      setOuvert(false);
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  const changer = (i: number, c: Partial<PosteRevue>) => setPostes((l) => (l ? l.map((p, j) => (j === i ? { ...p, ...c } : p)) : l));

  if (!ouvert)
    return (
      <button type="button" className="btn-sec mt-2" onClick={() => setOuvert(true)}>
        {t.ouvrir}
      </button>
    );

  const n = postes?.filter((p) => p.garder).length ?? 0;
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-line p-3">
      <label htmlFor={`${id}-d`} className="etiquette">
        {t.description}
      </label>
      <textarea id={`${id}-d`} rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className="champ text-sm" />
      <p className="note">{t.envoye}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={occupe} onClick={() => void estimer()}>
          {occupe && !postes ? t.enCours : t.estimer}
        </button>
        <button type="button" className="btn-sec" disabled={occupe} onClick={() => setOuvert(false)}>
          {t.fermer}
        </button>
      </div>
      {postes ? (
        <>
          <p className="alerte border-warn">{t.revue}</p>
          <ul className="divide-y divide-line">
            {postes.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                <input type="checkbox" className="size-5 accent-accent" checked={p.garder} onChange={(e) => changer(i, { garder: e.target.checked })} aria-label={t.garder(p.nom)} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{p.nom}</p>
                  <p className="text-mute">
                    {p.detail}
                    {p.explication ? ` · ${p.explication}` : ""}
                  </p>
                </div>
                <input
                  inputMode="decimal"
                  value={p.montant}
                  onChange={(e) => changer(i, { montant: e.target.value })}
                  aria-label={t.montant(p.nom)}
                  className="champ w-28 py-1.5 text-right"
                />
              </li>
            ))}
          </ul>
          <button type="button" className="btn self-start" disabled={occupe || n === 0} onClick={() => void ajouter()}>
            {t.ajouter(n)}
          </button>
        </>
      ) : null}
      <p role="status" aria-live="polite" className={message ? "alerte" : "sr-only"}>
        {message}
      </p>
    </div>
  );
}
