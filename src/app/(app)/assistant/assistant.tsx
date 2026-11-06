"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { resumeFinancier } from "@/domaine/assistant";
import { MAX_QUESTION } from "@/ia/assistant";
import { T } from "@/textes/fr-CA";
import { useCalculs } from "@/ui/calculs";
import { useIaDisponible } from "@/ui/ia";

const t = T.assistant;
const schemaReponse = z.object({ reponse: z.string() });
const schemaErreur = z.object({ erreur: z.string() });

/** Questions à l'assistant : le résumé chiffré est calculé ici, par le domaine, puis envoyé avec la question. */
export function Assistant() {
  const c = useCalculs();
  const disponible = useIaDisponible();
  const id = useId();
  const [question, setQuestion] = useState("");
  const [reponse, setReponse] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  if (!disponible) return <p className="carte note mt-4 py-6 text-center">{T.vide.assistant}</p>;
  if (!c.profil?.ia_active)
    return (
      <div className="carte mt-4 flex flex-col items-start gap-3">
        <p>{t.iaInactive}</p>
        <Link href="/reglages" className="btn-sec">
          {t.ouvrirReglages}
        </Link>
      </div>
    );

  async function demander(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3) return setMessage(t.questionCourte);
    if (q.length > MAX_QUESTION) return setMessage(t.questionLongue(MAX_QUESTION));
    setOccupe(true);
    setMessage(null);
    setReponse(null);
    try {
      const resume = resumeFinancier({
        aujourdhui: c.aujourdhui,
        capacite: c.capacite,
        repartition: c.repartition,
        transactions: c.transactions,
        index: c.index,
        comptes: c.comptes,
        libellesStatut: T.projets.statuts,
        devise: c.devise,
      });
      const r = await fetch("/api/ia/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, resume }) });
      const j: unknown = await r.json().catch(() => null);
      if (!r.ok) return setMessage(schemaErreur.safeParse(j).data?.erreur ?? T.ia.erreurs.connexion);
      const v = schemaReponse.safeParse(j);
      if (!v.success) return setMessage(T.ia.erreurs.reponse);
      setReponse(v.data.reponse);
    } catch {
      setMessage(T.ia.erreurs.connexion);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="note">{t.intro}</p>
      <form onSubmit={(e) => void demander(e)} noValidate className="carte flex flex-col gap-2">
        <label htmlFor={id} className="etiquette">
          {t.question}
        </label>
        <textarea id={id} rows={3} maxLength={MAX_QUESTION + 50} value={question} onChange={(e) => setQuestion(e.target.value)} className="champ" />
        <div className="flex flex-wrap gap-2">
          {t.exemples.map((x) => (
            <button key={x} type="button" className="rounded-full border border-line px-3 py-1.5 text-sm" onClick={() => setQuestion(x)}>
              {x}
            </button>
          ))}
        </div>
        <button type="submit" className="btn self-start" disabled={occupe}>
          {occupe ? t.enCours : t.demander}
        </button>
        <p className="note">{t.envoye}</p>
      </form>
      <p role="status" aria-live="polite" className={message ? "alerte border-bad" : "sr-only"}>
        {message}
      </p>
      {reponse ? (
        <section className="carte flex flex-col gap-2" aria-labelledby={`${id}-reponse`}>
          <h2 id={`${id}-reponse`} className="font-bold">
            {t.reponse}
          </h2>
          <p className="whitespace-pre-line">{reponse}</p>
          <p className="note">{t.avertissement}</p>
        </section>
      ) : null}
    </div>
  );
}
