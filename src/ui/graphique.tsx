import { formaterMontant } from "@/domaine/argent";
import { T } from "@/textes/fr-CA";

export interface Serie {
  nom: string;
  points: number[]; // cents
  couleur: string; // variable CSS, ex. var(--accent)
  pointille?: boolean;
  remplir?: boolean;
}

/**
 * Graphique en courbes (repris du prototype). Pour les lecteurs d'écran, les mêmes valeurs
 * sont fournies dans un tableau masqué visuellement.
 */
export function GraphiqueCourbes({ series, etiquettes, libelle, devise = "CAD" }: { series: Serie[]; etiquettes: string[]; libelle: string; devise?: string }) {
  const W = 640;
  const H = 220;
  const G = 64;
  const D = 30;
  const Hh = 12;
  const B = 28;
  const tous = series.flatMap((s) => s.points.map((p) => p / 100));
  const max = Math.max(1, ...tous);
  let min = Math.min(0, ...tous);
  let pas = 10 ** Math.floor(Math.log10(max - min || 1));
  let haut = Math.ceil(max / pas) * pas;
  if (haut / pas > 8) {
    pas *= 2;
    haut = Math.ceil(max / pas) * pas;
  }
  min = Math.floor(min / pas) * pas;
  const n = Math.max(...series.map((s) => s.points.length));
  const X = (i: number) => G + (n <= 1 ? 0 : (i * (W - G - D)) / (n - 1));
  const Y = (v: number) => Hh + (H - Hh - B) * (1 - (v - min) / (haut - min || 1));
  const graduations: number[] = [];
  for (let v = min; v <= haut + 1e-9; v += pas) graduations.push(v);
  const chaque = Math.ceil(n / 8);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={libelle} className="block h-auto w-full">
        {graduations.map((v) => (
          <g key={v}>
            <line x1={G} x2={W - D} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={G - 8} y={Y(v) + 4} textAnchor="end" fill="var(--mute)" fontSize={12}>
              {formaterMontant(v * 100, 0, devise)}
            </text>
          </g>
        ))}
        {etiquettes.map((e, i) =>
          i % chaque === 0 || i === n - 1 ? (
            <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fill="var(--mute)" fontSize={12}>
              {e}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const d = s.points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p / 100).toFixed(1)}`).join(" ");
          const dernier = s.points.length - 1;
          return (
            <g key={s.nom}>
              {s.remplir ? <path d={`${d} L${X(dernier)} ${Y(min)} L${X(0)} ${Y(min)} Z`} fill={s.couleur} opacity={0.12} /> : null}
              <path d={d} fill="none" stroke={s.couleur} strokeWidth={2.5} strokeLinejoin="round" strokeDasharray={s.pointille ? "5 4" : undefined} />
              <circle cx={X(dernier)} cy={Y((s.points[dernier] ?? 0) / 100)} r={4} fill={s.couleur} />
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mute">
        {series.map((s) => (
          <span key={s.nom} className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="inline-block h-[3px] w-3 rounded" style={{ background: s.couleur }} />
            {s.nom}
          </span>
        ))}
      </figcaption>
      {/* Un tableau ignore la largeur de 1 px de sr-only : on masque son conteneur. */}
      <div className="sr-only">
      <table>
        <caption>{libelle}</caption>
        <thead>
          <tr>
            <th scope="col">{T.graphique.mois}</th>
            {series.map((s) => (
              <th key={s.nom} scope="col">
                {s.nom}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {etiquettes.map((e, i) => (
            <tr key={i}>
              <th scope="row">{e}</th>
              {series.map((s) => (
                <td key={s.nom}>{formaterMontant(s.points[i] ?? 0, 0, devise)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
