"use client";

import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { aujourdhuiLocal } from "@/domaine/dates";
import { nomFichier } from "@/domaine/export";
import { exportComplet, exportCsv, telecharger } from "@/donnees/export";
import { oublierAppareil } from "@/donnees/magasin";
import { supabaseNavigateur } from "@/donnees/supabase-navigateur";
import { T } from "@/textes/fr-CA";

const d = T.donnees;
const s = T.compte.suppression;

/** Export de toutes les données (Loi 25 : portabilité). */
export function ExportDonnees() {
  const [occupe, setOccupe] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function exporter(cle: string, action: () => Promise<void>) {
    setOccupe(cle);
    setMessage(null);
    try {
      await action();
      setMessage(d.pret);
    } catch {
      setMessage(d.echec);
    } finally {
      setOccupe(null);
    }
  }

  const csv = (nom: "transactions" | "projets" | "factures" | "comptes") => (
    <button
      type="button"
      className="btn-sec"
      disabled={occupe !== null}
      onClick={() => void exporter(nom, async () => telecharger(await exportCsv(nom), nomFichier(nom, aujourdhuiLocal(), "csv"), "text/csv;charset=utf-8"))}
    >
      {occupe === nom ? d.enCours : d[nom]}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-bold">{d.titre}</h2>
      <p className="note">{d.intro}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn"
          disabled={occupe !== null}
          onClick={() => void exporter("complet", async () => telecharger(await exportComplet(), nomFichier("complet", aujourdhuiLocal(), "json"), "application/json"))}
        >
          {occupe === "complet" ? d.enCours : d.complet}
        </button>
        {csv("transactions")}
        {csv("projets")}
        {csv("factures")}
        {csv("comptes")}
      </div>
      <p className="note">{d.noteCsv}</p>
      <p role="status" aria-live="polite" className={message ? "alerte border-accent" : "sr-only"}>
        {message}
      </p>
    </div>
  );
}

/** Suppression définitive du compte et de toutes les données (Loi 25). */
export function SuppressionCompte() {
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const confirmation = String(new FormData(e.currentTarget).get("confirmation") ?? "").trim();
    if (confirmation !== "SUPPRIMER") return setMessage(s.confirmationInvalide);
    setOccupe(true);
    setMessage(null);
    try {
      const r = await fetch("/api/compte/supprimer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      if (!r.ok) {
        const j: unknown = await r.json().catch(() => null);
        setMessage(z.object({ erreur: z.string() }).safeParse(j).data?.erreur ?? s.echec);
        setOccupe(false);
        return;
      }
      await oublierAppareil();
      await supabaseNavigateur().auth.signOut({ scope: "local" });
      // Navigation complète : elle l'emporte sur la redirection déclenchée par la déconnexion.
      window.location.replace("/connexion?compte=supprime");
    } catch {
      setMessage(s.echec);
      setOccupe(false);
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-2">
      <h2 className="font-bold text-bad">{s.titre}</h2>
      <p className="note">{s.texte}</p>
      <label htmlFor={id} className="etiquette">
        {s.champ}
      </label>
      <input id={id} name="confirmation" autoComplete="off" autoCapitalize="characters" className="champ max-w-60" />
      <p role="status" aria-live="polite" className={message ? "alerte border-bad" : "sr-only"}>
        {message}
      </p>
      <button type="submit" className="btn self-start bg-bad text-bg" disabled={occupe}>
        {occupe ? s.enCours : s.bouton}
      </button>
    </form>
  );
}
