import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Politique de confidentialité" };

/** Version de travail : à faire valider (responsable de la protection des renseignements personnels à nommer). */
export default function Confidentialite() {
  return (
    <main id="contenu" className="mx-auto max-w-2xl px-4 py-10 leading-relaxed">
      <h1 className="text-2xl font-extrabold">Politique de confidentialité</h1>
      <p className="note mt-1">Version de travail du 4 novembre 2026.</p>

      <h2 className="mt-6 text-lg font-bold">Ce que l&apos;application conserve</h2>
      <p className="mt-2">
        Ton courriel, les transactions que tu importes ou saisis, tes catégories et budgets, tes projets, tes factures, tes
        comptes et leurs soldes, et les photos de reçus que tu ajoutes. Aucune connexion à ta banque n&apos;est faite : tu
        importes tes relevés toi-même.
      </p>

      <h2 className="mt-6 text-lg font-bold">Où sont les données</h2>
      <p className="mt-2">
        Base de données et fichiers : Supabase, région Canada (Montréal). Chaque utilisateur ne peut lire que ses propres
        données. Les fichiers CSV sont lus sur ton appareil.
      </p>
      <p className="mt-2">
        Fonctions d&apos;intelligence artificielle (lecture de PDF ou d&apos;images, classement, assistant) : le texte
        nécessaire est envoyé à Anthropic, aux États-Unis, seulement quand tu utilises ces fonctions. Elles sont
        facultatives.
      </p>

      <h2 className="mt-6 text-lg font-bold">Tes droits</h2>
      <p className="mt-2">
        Tu peux consulter, corriger, exporter (JSON et CSV) et supprimer toutes tes données à tout moment depuis les
        réglages. La suppression du compte efface définitivement tes données et tes fichiers.
      </p>

      <h2 className="mt-6 text-lg font-bold">Responsable de la protection des renseignements personnels</h2>
      <p className="mt-2">À désigner avant la mise en service publique.</p>

      <Link href="/connexion" className="lien mt-8 inline-block">
        Retour
      </Link>
    </main>
  );
}
