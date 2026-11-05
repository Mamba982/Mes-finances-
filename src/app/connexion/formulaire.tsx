"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { z } from "zod";
import { supabaseNavigateur } from "@/donnees/supabase-navigateur";
import { T } from "@/textes/fr-CA";

const t = T.connexion;
const schemaCourriel = z.email({ error: t.courrielInvalide }).max(254);
/** Longueur réglée dans Supabase (6 à 10 chiffres ; 8 pour ce projet) : l'écran ne l'annonce pas. */
const schemaCode = z.string().regex(/^\d{6,10}$/, { error: t.codeInvalide });
/** Garde l'étape « code » si iOS recharge l'application pendant que tu lis ton courriel. */
const CLE_ATTENTE = "mes-finances:connexion-courriel";

const abonnes = new Set<() => void>();
let enMemoire: string | null = null; // repli si le stockage du navigateur est refusé
const attente = {
  lire(): string | null {
    try {
      return sessionStorage.getItem(CLE_ATTENTE);
    } catch {
      return enMemoire;
    }
  },
  ecrire(courriel: string | null) {
    enMemoire = courriel;
    try {
      if (courriel) sessionStorage.setItem(CLE_ATTENTE, courriel);
      else sessionStorage.removeItem(CLE_ATTENTE);
    } catch {
      // stockage refusé : la valeur en mémoire suffit, sans survivre à un rechargement
    }
    abonnes.forEach((f) => f());
  },
  abonner(f: () => void) {
    abonnes.add(f);
    return () => abonnes.delete(f);
  },
};

/**
 * Connexion sans mot de passe : un courriel porte à la fois un lien et un code.
 * Le code se vérifie ici, dans ce navigateur : il marche quand Gmail ouvre le lien ailleurs,
 * et dans l'application installée sur iPhone.
 */
export function FormulaireConnexion() {
  const params = useSearchParams();
  const erreurLien = params.get("erreur") === "lien";
  const compteSupprime = params.get("compte") === "supprime";
  // Lu après l'hydratation (page statique) ; null côté serveur.
  const courriel = useSyncExternalStore(attente.abonner, attente.lire, () => null);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(
    erreurLien ? t.erreurLien : compteSupprime ? t.compteSupprime : null,
  );
  const idCourriel = useId();
  const idCode = useId();
  const idMessage = useId();

  const choisir = (c: string | null) => attente.ecrire(c);

  function lireCourriel(form: HTMLFormElement): string | null {
    const v = schemaCourriel.safeParse(String(new FormData(form).get("courriel") ?? "").trim().toLowerCase());
    if (!v.success) {
      setMessage(v.error.issues[0]?.message ?? t.courrielInvalide);
      return null;
    }
    return v.data;
  }

  async function envoyer(c: string) {
    if (!navigator.onLine) return setMessage(t.horsLigne);
    setOccupe(true);
    setMessage(null);
    const { error } = await supabaseNavigateur().auth.signInWithOtp({
      email: c,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmer`, shouldCreateUser: true },
    });
    setOccupe(false);
    if (error) return setMessage(error.status === 429 ? t.tropEssais : t.erreurEnvoi);
    choisir(c);
  }

  async function verifier(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!courriel) return;
    // Les espaces (copier-coller « 123 456 ») ne comptent pas.
    const v = schemaCode.safeParse(String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, ""));
    if (!v.success) return setMessage(v.error.issues[0]?.message ?? t.codeInvalide);
    if (!navigator.onLine) return setMessage(t.horsLigne);
    setOccupe(true);
    setMessage(null);
    const { error } = await supabaseNavigateur().auth.verifyOtp({ email: courriel, token: v.data, type: "email" });
    if (error) {
      setOccupe(false);
      return setMessage(error.status === 429 ? t.tropEssais : t.codeRefuse);
    }
    attente.ecrire(null);
    // Navigation complète : l'accueil repart avec la session toute neuve.
    window.location.replace("/accueil");
  }

  const zoneMessage = (
    <p id={idMessage} role="status" aria-live="polite" className={message ? "alerte mt-3" : "sr-only"}>
      {message}
    </p>
  );

  if (courriel) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <p className="alerte border-accent">{t.envoye(courriel)}</p>
        <form onSubmit={verifier} noValidate className="flex flex-col gap-3">
          <label htmlFor={idCode} className="etiquette">
            {t.codeEtiquette}
          </label>
          <input
            id={idCode}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={12}
            aria-describedby={idMessage}
            className="champ max-w-48 text-center text-xl tracking-[0.3em]"
          />
          <button type="submit" className="btn" disabled={occupe}>
            {occupe ? t.codeVerification : t.codeValider}
          </button>
        </form>
        <p className="note">{t.codeAide}</p>
        {zoneMessage}
        <button type="button" className="btn-sec" disabled={occupe} onClick={() => void envoyer(courriel)}>
          {t.renvoyer}
        </button>
        <button
          type="button"
          className="lien self-start text-sm"
          onClick={() => {
            choisir(null);
            setMessage(null);
          }}
        >
          {t.autreCourriel}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = lireCourriel(e.currentTarget);
        if (c) void envoyer(c);
      }}
      noValidate
      className="mt-6 flex flex-col gap-3"
    >
      <label htmlFor={idCourriel} className="etiquette">
        {t.courriel}
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
        {occupe ? t.envoi : t.envoyer}
      </button>
      <button
        type="button"
        className="lien self-start text-sm"
        disabled={occupe}
        onClick={(e) => {
          const c = lireCourriel(e.currentTarget.form!);
          if (c) {
            setMessage(null);
            choisir(c);
          }
        }}
      >
        {t.dejaUnCode}
      </button>
      {zoneMessage}
    </form>
  );
}
