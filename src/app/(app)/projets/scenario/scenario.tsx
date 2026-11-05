"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { arrondirCents, centsVersDecimal, formaterMontant, lireMontant } from "@/domaine/argent";
import { estDateISO } from "@/domaine/dates";
import { comparerScenario, type Repartition, type Scenario } from "@/domaine/projets";
import { appliquerScenario } from "@/donnees/magasin";
import { T } from "@/textes/fr-CA";
import { useCalculs } from "@/ui/calculs";
import { Kpi } from "@/ui/kpi";

const s = T.scenario;
const COULEUR = { ok: "text-ok", atteint: "text-ok", retard: "text-warn", nonfinance: "text-bad", depasse: "text-bad" } as const;
const texte = (c: number) => centsVersDecimal(c).replace(".", ",").replace(/,00$/, "");

export function ScenarioProjets() {
  const { projets, capacite, aujourdhui, devise } = useCalculs();
  const router = useRouter();
  const id = useId();
  const m0 = (c: number) => formaterMontant(c, 0, devise);
  const [delta, setDelta] = useState("");
  const [saisies, setSaisies] = useState<Record<string, { echeance: string; cout: string }>>(() =>
    Object.fromEntries(projets.map((p) => [p.id, { echeance: p.echeance, cout: texte(p.cout) }])),
  );
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Lecture des saisies : une valeur invalide garde la valeur d'origine et bloque « Appliquer ».
  const { scenario, valide } = useMemo(() => {
    let ok = true;
    const d = delta.trim() ? lireMontant(delta) : 0;
    if (d === null) ok = false;
    const sc: Scenario = { delta: d ?? 0, projets: {} };
    for (const p of projets) {
      const v = saisies[p.id];
      if (!v) continue;
      const cout = lireMontant(v.cout);
      if (cout === null || cout <= 0 || !estDateISO(v.echeance)) ok = false;
      sc.projets[p.id] = { echeance: estDateISO(v.echeance) ? v.echeance : p.echeance, cout: cout && cout > 0 ? cout : p.cout };
    }
    return { scenario: sc, valide: ok };
  }, [delta, saisies, projets]);

  const { avant, apres } = comparerScenario(projets, capacite.valeur, scenario, aujourdhui);

  async function appliquer() {
    if (!valide) return setErreur(s.invalide);
    setOccupe(true);
    setErreur(null);
    try {
      const modifies = projets
        .map((p) => ({ id: p.id, echeance: scenario.projets[p.id]?.echeance ?? p.echeance, cout: scenario.projets[p.id]?.cout ?? p.cout }))
        .filter((m) => {
          const p = projets.find((x) => x.id === m.id)!;
          return m.echeance !== p.echeance || m.cout !== p.cout;
        });
      const nouvelleCapacite = scenario.delta ? arrondirCents(Math.max(0, capacite.valeur + scenario.delta)) : null;
      await appliquerScenario(modifies, nouvelleCapacite);
      router.push("/projets");
    } catch {
      setErreur(T.budget.erreurEnregistrement);
      setOccupe(false);
    }
  }

  const resume = (r: Repartition) => (r.ecart < 0 ? <span className="text-bad">{s.manque(m0(-r.ecart))}</span> : <span className="text-ok">{s.marge(m0(r.ecart))}</span>);

  if (!projets.length) {
    return (
      <>
        <h1 className="text-xl font-extrabold">{s.titre}</h1>
        <p className="carte note mt-4 py-6 text-center">{s.aucunProjet}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-extrabold">{s.titre}</h1>
      <p className="note mt-1">{s.intro}</p>

      <div className="carte mt-3 flex flex-col gap-1">
        <label htmlFor={`${id}-delta`} className="etiquette">
          {s.delta}
        </label>
        <input id={`${id}-delta`} inputMode="decimal" value={delta} onChange={(e) => setDelta(e.target.value)} className="champ" placeholder="0" />
        <p className="note">{s.deltaNote}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5" aria-live="polite">
        <Kpi libelle={s.aujourdhui} valeur={resume(avant)} detail={s.epargneMois(m0(avant.capacite))} />
        <Kpi libelle={s.avecScenario} valeur={resume(apres)} detail={s.epargneMois(m0(apres.capacite))} ton={apres.ecart < 0 ? "bad" : "ok"} />
      </div>

      <ul className="carte mt-3 divide-y divide-line p-0">
        {projets.map((p) => (
          <li key={p.id} className="grid grid-cols-2 gap-2 px-3 py-2.5">
            <p className="col-span-2 font-semibold">{p.nom}</p>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-e-${p.id}`} className="etiquette">
                {s.nouvelleEcheance}
              </label>
              <input
                id={`${id}-e-${p.id}`}
                type="date"
                value={saisies[p.id]?.echeance ?? p.echeance}
                onChange={(e) => setSaisies((x) => ({ ...x, [p.id]: { ...x[p.id]!, echeance: e.target.value } }))}
                className="champ py-2"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-c-${p.id}`} className="etiquette">
                {s.nouveauCout}
              </label>
              <input
                id={`${id}-c-${p.id}`}
                inputMode="decimal"
                value={saisies[p.id]?.cout ?? ""}
                onChange={(e) => setSaisies((x) => ({ ...x, [p.id]: { ...x[p.id]!, cout: e.target.value } }))}
                className="champ chiffre py-2"
              />
            </div>
          </li>
        ))}
      </ul>

      <table className="carte mt-2.5 w-full text-sm">
        <thead>
          <tr className="text-left text-mute">
            <th scope="col" className="py-1.5 font-semibold">{s.projet}</th>
            <th scope="col" className="py-1.5 font-semibold">{s.avant}</th>
            <th scope="col" className="py-1.5 font-semibold">{s.apres}</th>
            <th scope="col" className="py-1.5 text-right font-semibold">{T.projets.requisMois}</th>
          </tr>
        </thead>
        <tbody>
          {apres.projets.map((x, i) => {
            const y = avant.projets[i]!;
            return (
              <tr key={x.projet.id} className="border-t border-line">
                <td className="py-1.5">{x.projet.nom}</td>
                <td className={`py-1.5 font-bold ${COULEUR[y.statut]}`}>{T.projets.statuts[y.statut]}</td>
                <td className={`py-1.5 font-bold ${COULEUR[x.statut]}`}>{T.projets.statuts[x.statut]}</td>
                <td className="chiffre py-1.5 text-right">{m0(x.requis)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p role="status" aria-live="polite" className={erreur || !valide ? "alerte mt-3" : "sr-only"}>
        {erreur ?? (valide ? "" : s.invalide)}
      </p>
      <div className="sticky bottom-20 mt-3 flex gap-2 bg-bg py-2">
        <button type="button" className="btn flex-1" disabled={occupe || !valide} onClick={() => void appliquer()}>
          {s.appliquer}
        </button>
        <Link href="/projets" className="btn-sec">
          {s.fermer}
        </Link>
      </div>
    </>
  );
}
