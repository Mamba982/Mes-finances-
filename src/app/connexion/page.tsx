import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { T } from "@/textes/fr-CA";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: T.connexion.titre };

export default function PageConnexion() {
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <p className="font-display text-sm font-bold text-accent">{T.app.nom}</p>
      <h1 className="mt-1 text-2xl font-extrabold">{T.connexion.titre}</h1>
      <p className="note mt-2">{T.connexion.intro}</p>
      <Suspense fallback={<p className="note mt-6">{T.session.chargement}</p>}>
        <FormulaireConnexion />
      </Suspense>
      <p className="note mt-8">{T.connexion.sansBanque}</p>
      <Link href="/confidentialite" className="lien mt-2 text-sm">
        {T.connexion.confidentialite}
      </Link>
    </main>
  );
}
