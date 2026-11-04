"use client";

import { T } from "@/textes/fr-CA";

export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenu" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold">{T.erreurs.titre}</h1>
      <p className="note mt-2">{T.erreurs.texte}</p>
      <button type="button" className="btn mt-6" onClick={reset}>
        {T.erreurs.reessayer}
      </button>
    </main>
  );
}
