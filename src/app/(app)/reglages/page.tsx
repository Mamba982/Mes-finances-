import type { Metadata } from "next";
import Link from "next/link";
import { T } from "@/textes/fr-CA";
import { ChoixTheme, Deconnexion } from "./actions";
import { FormulaireAffaires } from "./affaires";
import { FormulaireCapacite } from "./capacite";
import { ExportDonnees, SuppressionCompte } from "./donnees";
import { ReglageIa } from "./ia";

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
        <ReglageIa />
      </section>
      <section className="carte mt-3">
        <ChoixTheme />
      </section>
      <section className="carte mt-3">
        <ExportDonnees />
      </section>
      <section className="mt-6 flex flex-wrap items-center gap-4">
        <Deconnexion />
        <Link href="/confidentialite" className="lien text-sm">
          {T.connexion.confidentialite}
        </Link>
      </section>
      <section className="carte mt-6 border-bad">
        <SuppressionCompte />
      </section>
    </>
  );
}
