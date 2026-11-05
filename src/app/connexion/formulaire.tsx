"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabaseNavigateur } from "@/donnees/supabase-navigateur";
import { T } from "@/textes/fr-CA";

const schemaCourriel = z.email({ error: T.connexion.courrielInvalide }).max(254);

/**
 * Connexion par lien magique seulement (modèle de courriel par défaut de Supabase).
 * Le lien porte un code PKCE : il doit être ouvert dans le navigateur qui l'a demandé.
 * Le code à 6 chiffres reviendra quand un SMTP permettra de modifier le modèle (phase 7).
 */
export function FormulaireConnexion() {
  const erreurLien = useSearchParams().get("erreur") === "lien";
  const [envoyeA, setEnvoyeA] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(erreurLien ? T.connexion.erreurLien : null);
  const idCourriel = useId();
  const idMessage = useId();

  async function envoyer(courriel: string) {
    if (!navigator.onLine) return setMessage(T.connexion.horsLigne);
    setOccupe(true);
    setMessage(null);
    const { error } = await supabaseNavigateur().auth.signInWithOtp({
      email: courriel,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmer`, shouldCreateUser: true },
    });
    setOccupe(false);
    if (error) return setMessage(T.connexion.erreurEnvoi);
    setEnvoyeA(courriel);
  }

  function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const brut = new FormData(e.currentTarget).get("courriel");
    const v = schemaCourriel.safeParse(String(brut ?? "").trim().toLowerCase());
    if (!v.success) return setMessage(v.error.issues[0]?.message ?? T.connexion.courrielInvalide);
    void envoyer(v.data);
  }

  const zoneMessage = (
    <p id={idMessage} role="status" aria-live="polite" className={message ? "alerte mt-3" : "sr-only"}>
      {message}
    </p>
  );

  if (envoyeA) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <p className="alerte border-accent" role="status">
          {T.connexion.envoye(envoyeA)}
        </p>
        <p className="note">{T.connexion.memeAppareil}</p>
        <button type="button" className="btn-sec" disabled={occupe} onClick={() => void envoyer(envoyeA)}>
          {occupe ? T.connexion.envoi : T.connexion.renvoyer}
        </button>
        <button
          type="button"
          className="lien self-start text-sm"
          onClick={() => {
            setEnvoyeA(null);
            setMessage(null);
          }}
        >
          {T.connexion.autreCourriel}
        </button>
        {zoneMessage}
      </div>
    );
  }

  return (
    <form onSubmit={soumettre} noValidate className="mt-6 flex flex-col gap-3">
      <label htmlFor={idCourriel} className="etiquette">
        {T.connexion.courriel}
      </label>
      <input
        id={idCourriel}
        name="courriel"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        aria-describedby={idMessage}
        className="champ"
      />
      <button type="submit" className="btn" disabled={occupe}>
        {occupe ? T.connexion.envoi : T.connexion.envoyer}
      </button>
      {zoneMessage}
    </form>
  );
}
