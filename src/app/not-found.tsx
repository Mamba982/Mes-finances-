import Link from "next/link";
import { T } from "@/textes/fr-CA";

export default function Introuvable() {
  return (
    <main id="contenu" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold">{T.erreurs.introuvableTitre}</h1>
      <p className="note mt-2">{T.erreurs.introuvable}</p>
      <Link href="/accueil" className="btn mt-6">
        {T.erreurs.retourAccueil}
      </Link>
    </main>
  );
}
