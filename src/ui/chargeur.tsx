"use client";

import { useEffect, type ReactNode } from "react";
import { charger, useDonnees, vider } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { useSession } from "./session";

/** Charge les données de l'utilisateur connecté ; affiche un message clair si la lecture échoue. */
export function ChargeurDonnees({ children }: { children: ReactNode }) {
  const idUtilisateur = useSession().user.id;
  const { statut } = useDonnees();

  useEffect(() => {
    void charger().catch(() => undefined);
    return () => vider();
  }, [idUtilisateur]);

  if (statut === "erreur") {
    return (
      <div className="alerte border-bad" role="alert">
        <p>{T.erreurs.lecture}</p>
        <button type="button" className="btn-sec mt-2" onClick={() => void charger().catch(() => undefined)}>
          {T.erreurs.reessayer}
        </button>
      </div>
    );
  }
  if (statut !== "pret") {
    return (
      <p className="note py-10 text-center" role="status">
        {T.session.chargement}
      </p>
    );
  }
  return children;
}
