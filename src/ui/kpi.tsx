import type { ReactNode } from "react";

type Ton = "ok" | "warn" | "bad" | null;

const BORDURE: Record<Exclude<Ton, null>, string> = {
  ok: "border-l-4 border-l-ok",
  warn: "border-l-4 border-l-warn",
  bad: "border-l-4 border-l-bad",
};

export function Kpi({ libelle, valeur, detail, ton = null }: { libelle: string; valeur: ReactNode; detail?: ReactNode; ton?: Ton }) {
  return (
    <div className={`carte ${ton ? BORDURE[ton] : ""}`}>
      <p className="text-sm text-mute">{libelle}</p>
      <p className="chiffre font-display mt-0.5 text-2xl font-extrabold">{valeur}</p>
      {detail ? <p className="mt-0.5 text-sm text-mute">{detail}</p> : null}
    </div>
  );
}
