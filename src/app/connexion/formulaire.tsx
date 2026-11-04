"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabaseNavigateur } from "@/donnees/supabase-navigateur";
import { T } from "@/textes/fr-CA";

const schemaCourriel = z.email({ error: T.connexion.courrielInvalide }).max(254);
const schemaCode = z.string().regex(/^\d{6}$/, { error: T.connexion.codeInvalide });

type Etat = { etape: "courriel" } | { etape: "code"; courriel: string };

export function FormulaireConnexion() {
  const router = useRouter();
  const erreurLien = useSearchParams().get("erreur") === "lien";
  const [etat, setEtat] = useState<Etat>({ etape: "courriel" });
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(erreurLien ? T.connexion.erreurLien : null);
  const idCourriel = useId();
  const idCode = useId();
  const idMessage = useId();

  async function envoyerLien(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const brut = new FormData(e.currentTarget).get("courriel");
    const v = schemaCourriel.safeParse(String(brut ?? "").trim().toLowerCase());
    if (!v.success) return setMessage(v.error.issues[0]?.message ?? T.connexion.courrielInvalide);
    if (!navigator.onLine) return setMessage(T.connexion.horsLigne);
    setOccupe(true);
    setMessage(null);
    const { error } = await supabaseNavigateur().auth.signInWithOtp({
      email: v.data,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmer`, shouldCreateUser: true },
    });
    setOccupe(false);
    if (error) return setMessage(T.connexion.erreurEnvoi);
    setEtat({ etape: "code", courriel: v.data });
  }

  async function validerCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (etat.etape !== "code") return;
    const v = schemaCode.safeParse(String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, ""));
    if (!v.success) return setMessage(v.error.issues[0]?.message ?? T.connexion.codeInvalide);
    setOccupe(true);
    setMessage(null);
    const { error } = await supabaseNavigateur().auth.verifyOtp({ email: etat.courriel, token: v.data, type: "email" });
    setOccupe(false);
    if (error) return setMessage(T.connexion.erreurCode);
    router.replace("/accueil");
  }

  const zoneMessage = (
    <p id={idMessage} role="status" aria-live="polite" className={message ? "alerte mt-3" : "sr-only"}>
      {message}
    </p>
  );

  if (etat.etape === "courriel") {
    return (
      <form onSubmit={envoyerLien} noValidate className="mt-6 flex flex-col gap-3">
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

  return (
    <form onSubmit={validerCode} noValidate className="mt-6 flex flex-col gap-3">
      <p className="alerte border-accent">{T.connexion.envoye(etat.courriel)}</p>
      <label htmlFor={idCode} className="etiquette">
        {T.connexion.code}
      </label>
      <input
        id={idCode}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        required
        aria-describedby={idMessage}
        className="champ tracking-[0.3em]"
      />
      <button type="submit" className="btn" disabled={occupe}>
        {occupe ? T.connexion.validation : T.connexion.valider}
      </button>
      <button
        type="button"
        className="lien self-start text-sm"
        onClick={() => {
          setEtat({ etape: "courriel" });
          setMessage(null);
        }}
      >
        {T.connexion.autreCourriel}
      </button>
      {zoneMessage}
    </form>
  );
}
