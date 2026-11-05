import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { ChoixTheme, Deconnexion } from "./actions";
import { FormulaireAffaires } from "./affaires";
import { FormulaireCapacite } from "./capacite";

export const metadata: Metadata = { title: T.nav.reglages };

export default function Page() {
  return (
    <>
      <h1 className="text-xl font-extrabold">{T.nav.reglages}</h1>
      <section className="carte mt-4">
        <FormulaireCapacite />
      </section>
      <section className="carte mt-3">
        <FormulaireAffaires />
      </section>
      <section className="carte mt-3">
        <ChoixTheme />
      </section>
      <section className="mt-6">
        <Deconnexion />
      </section>
    </>
  );
}
