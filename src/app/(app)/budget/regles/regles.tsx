"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { classer, motifValide } from "@/domaine/regles";
import { ajouterRegle, classerLot, modifierRegle, supprimerRegle, useDonnees } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";

const t = T.regles;

export function GestionRegles() {
  const { regles, categories, transactions } = useDonnees();
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const parCode = useMemo(() => new Map(categories.filter((c) => c.code).map((c) => [c.code!, c.id])), [categories]);
  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]));

  // Transactions à classer auxquelles une règle (de l'utilisateur ou par défaut) s'applique.
  const applicables = transactions
    .filter((x) => !x.categorieId)
    .map((x) => ({ id: x.id, c: classer(x.libelle, x.montant, regles, parCode) }))
    .filter((x): x is { id: string; c: NonNullable<typeof x.c> } => x.c !== null);

  async function agir(action: () => Promise<string | null>) {
    setOccupe(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch {
      setMessage(T.budget.erreurEnregistrement);
    } finally {
      setOccupe(false);
    }
  }

  function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const motif = motifValide(String(d.get("motif") ?? ""));
    const categorieId = String(d.get("categorie") ?? "");
    if (!motif) return setMessage(t.motifInvalide);
    if (regles.some((r) => r.motif === motif)) return setMessage(t.motifDouble);
    void agir(async () => {
      await ajouterRegle(motif, categorieId);
      form.reset();
      return null;
    });
  }

  return (
    <>
      <h1 className="text-xl font-extrabold">{t.titre}</h1>
      <p className="note mt-1">{t.intro}</p>

      <form onSubmit={soumettre} noValidate className="carte mt-4 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-motif`} className="etiquette">
            {t.motCle}
          </label>
          <input id={`${id}-motif`} name="motif" placeholder={t.exemple} maxLength={80} className="champ" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-cat`} className="etiquette">
            {t.categorie}
          </label>
          <select id={`${id}-cat`} name="categorie" className="champ">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn col-span-2 justify-self-start" disabled={occupe}>
          {t.ajouter}
        </button>
      </form>

      <p role="status" aria-live="polite" className={message ? "alerte mt-3 border-accent" : "sr-only"}>
        {message}
      </p>

      <div className="mt-3">
        {applicables.length ? (
          <button
            type="button"
            className="btn-sec"
            disabled={occupe}
            onClick={() =>
              void agir(async () => t.classees(await classerLot(applicables.map((x) => ({ id: x.id, categorieId: x.c.categorieId })))))
            }
          >
            {t.appliquer(applicables.length)}
          </button>
        ) : (
          <p className="note">{t.rienAClasser}</p>
        )}
      </div>

      {regles.length ? (
        <ul className="carte mt-3 divide-y divide-line p-0">
          {regles.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">« {r.motif} »</p>
                <p className="text-xs font-bold text-mute">{r.origine === "auto" ? t.retenue : t.ajoutee}</p>
              </div>
              <label htmlFor={`${id}-r-${r.id}`} className="sr-only">
                {`${t.categorie} : ${r.motif}`}
              </label>
              <select
                id={`${id}-r-${r.id}`}
                value={r.categorieId}
                onChange={(e) => void agir(async () => (await modifierRegle(r.id, e.target.value), null))}
                className="champ w-auto max-w-48 py-1.5 text-sm"
                aria-describedby={`${id}-n-${r.id}`}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
              <span id={`${id}-n-${r.id}`} className="sr-only">
                {nomCategorie.get(r.categorieId)}
              </span>
              <button type="button" className="lien min-h-11 px-1 text-sm" disabled={occupe} onClick={() => void agir(async () => (await supprimerRegle(r.id), null))}>
                {t.supprimer}
                <span className="sr-only"> « {r.motif} »</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="carte note mt-3 py-6 text-center">{t.aucune}</p>
      )}
    </>
  );
}
