"use client";

import { useState } from "react";
import { z } from "zod";
import { classerLot, useDonnees } from "@/donnees/magasin";
import { MAX_TRANSACTIONS } from "@/ia/categoriser";
import { T } from "@/textes/fr-CA";
import { useIaDisponible } from "@/ui/ia";

const schemaReponse = z.object({ resultats: z.array(z.object({ id: z.uuid(), categorieId: z.uuid() })) });
const schemaErreur = z.object({ erreur: z.string() });

/**
 * Bouton « Classer N avec l'IA ». Affiché seulement si l'IA est configurée sur le serveur
 * ET activée par l'utilisateur. Sans clé, rien ne s'affiche et rien n'est envoyé.
 */
export function ClasserAvecIa() {
  const { profil, transactions } = useDonnees();
  const disponible = useIaDisponible();
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const aClasser = transactions.filter((t) => !t.categorieId).slice(0, MAX_TRANSACTIONS);
  if (!disponible || !profil?.ia_active || (!aClasser.length && !message)) return null;

  async function lancer() {
    setOccupe(true);
    setMessage(null);
    try {
      const r = await fetch("/api/ia/categoriser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: aClasser.map((t) => ({ id: t.id, libelle: t.libelle, montant: t.montant })) }),
      });
      const j: unknown = await r.json().catch(() => null);
      if (!r.ok) return setMessage(schemaErreur.safeParse(j).data?.erreur ?? T.ia.erreurs.connexion);
      const v = schemaReponse.safeParse(j);
      if (!v.success) return setMessage(T.ia.erreurs.reponse);
      const n = await classerLot(v.data.resultats);
      setMessage(T.ia.resultat(n, aClasser.length - n));
    } catch {
      setMessage(T.ia.erreurs.connexion);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {aClasser.length ? (
        <button type="button" className="btn-sec" disabled={occupe} onClick={() => void lancer()}>
          {occupe ? T.ia.enCours : T.ia.classerAvecIa(aClasser.length)}
        </button>
      ) : null}
      <p role="status" aria-live="polite" className={message ? "note" : "sr-only"}>
        {message}
      </p>
    </div>
  );
}
