"use client";

import { useEffect, type ReactNode } from "react";
import { charger, useDonnees, vider } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { useSession } from "./session";

const heure = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Charge les données de l'utilisateur connecté. La copie locale s'affiche tout de suite ;
 * hors ligne, elle reste consultable avec un avis, et tout se recharge au retour du réseau.
 */
export function ChargeurDonnees({ children }: { children: ReactNode }) {
  const idUtilisateur = useSession().user.id;
  const { statut, horsLigne, copieDu } = useDonnees();

  useEffect(() => {
    const recharger = () => void charger(idUtilisateur).catch(() => undefined);
    recharger();
    window.addEventListener("online", recharger);
    return () => {
      window.removeEventListener("online", recharger);
      vider();
    };
  }, [idUtilisateur]);

  if (statut === "erreur") {
    return (
      <div className="alerte border-bad" role="alert">
        <p>{T.erreurs.lecture}</p>
        <button type="button" className="btn-sec mt-2" onClick={() => void charger(idUtilisateur).catch(() => undefined)}>
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
  return (
    <>
      {horsLigne && copieDu ? (
        <p className="alerte mb-3" role="status">
          {T.session.horsLigne(heure.format(new Date(copieDu)))}
        </p>
      ) : null}
      {children}
    </>
  );
}
