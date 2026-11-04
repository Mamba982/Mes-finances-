import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { ChoixTheme, Deconnexion } from "./actions";

export const metadata: Metadata = { title: T.nav.reglages };

export default function Page() {
  return (
    <>
      <h1 className="text-xl font-extrabold">{T.nav.reglages}</h1>
      <section className="carte mt-4">
        <ChoixTheme />
      </section>
      <section className="mt-6">
        <Deconnexion />
      </section>
    </>
  );
}
