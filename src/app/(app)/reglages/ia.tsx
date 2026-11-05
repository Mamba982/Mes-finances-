"use client";

import { useId, useState } from "react";
import { modifierIa, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { useIaDisponible } from "@/ui/ia";

const t = T.ia;

/** Réglage de l'IA : éteint par défaut ; inutilisable tant qu'aucune clé n'est configurée sur le serveur. */
export function ReglageIa() {
  const { profil } = useDonnees();
  const disponible = useIaDisponible();
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function changer(active: boolean) {
    setOccupe(true);
    setMessage(null);
    try {
      await modifierIa(active);
      setMessage(t.enregistre);
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-bold">{t.titre}</h2>
      {!disponible ? <p className="note">{t.nonConfiguree}</p> : null}
      <label htmlFor={id} className={`flex min-h-11 items-center gap-2 ${disponible ? "" : "text-mute"}`}>
        <input
          id={id}
          type="checkbox"
          className="size-5 accent-accent"
          checked={Boolean(profil?.ia_active)}
          disabled={!disponible || occupe}
          onChange={(e) => void changer(e.target.checked)}
          aria-describedby={`${id}-consentement`}
        />
        {t.activer}
      </label>
      <p id={`${id}-consentement`} className="note">
        {t.consentement}
      </p>
      <p role="status" aria-live="polite" className={message ? "alerte border-accent" : "sr-only"}>
        {message}
      </p>
    </div>
  );
}
