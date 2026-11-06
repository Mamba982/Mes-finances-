import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Politique de confidentialité" };

const RESPONSABLE = { nom: "Jonathan Mboko", courriel: "jonathanmboko985@gmail.com" };

/** Politique de confidentialité (Loi 25). Contenu long : rédigé ici plutôt que dans textes/fr-CA.ts. */
export default function Confidentialite() {
  const titre = "mt-6 text-lg font-bold";
  return (
    <main id="contenu" className="mx-auto max-w-2xl px-4 py-10 leading-relaxed">
      <h1 className="text-2xl font-extrabold">Politique de confidentialité</h1>
      <p className="note mt-1">En vigueur le 6 novembre 2026. Application en usage personnel, avant ouverture au public.</p>

      <h2 className={titre}>Responsable de la protection des renseignements personnels</h2>
      <p className="mt-2">
        {RESPONSABLE.nom}, <a className="lien" href={`mailto:${RESPONSABLE.courriel}`}>{RESPONSABLE.courriel}</a>. Écris à cette adresse
        pour toute question, demande d&apos;accès, de rectification ou de suppression, ou pour signaler un incident.
      </p>

      <h2 className={titre}>Renseignements recueillis et pourquoi</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Ton courriel : pour t&apos;envoyer le lien de connexion. Aucun mot de passe n&apos;est conservé.</li>
        <li>Les transactions que tu importes ou saisis, tes catégories, budgets et règles de classement : pour ton budget.</li>
        <li>Tes projets, versements et postes de dépense : pour planifier ton épargne.</li>
        <li>Tes factures, reçus (et leurs photos, si tu en ajoutes) et les réglages de ton entreprise : pour tes affaires et ton état des résultats.</li>
        <li>Tes comptes et leurs soldes : pour ton avoir net.</li>
      </ul>
      <p className="mt-2">
        Aucune connexion à ta banque n&apos;est faite : tu importes tes relevés toi-même, et les fichiers CSV sont lus sur ton appareil.
        L&apos;application n&apos;utilise ni publicité, ni pistage, ni revente de données.
      </p>

      <h2 className={titre}>Où sont les données</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Base de données et photos de reçus : Supabase, région Canada (Montréal). Chaque compte ne peut lire que ses propres données.</li>
        <li>
          Pages de l&apos;application : Vercel, réseau mondial. Les quelques fonctions du serveur (confirmation du lien de connexion,
          suppression du compte) s&apos;exécutent aux États-Unis (Washington) et ne conservent aucune donnée financière.
        </li>
        <li>Sur ton appareil : une copie des données déjà vues, pour l&apos;affichage rapide et hors ligne. Elle est effacée quand tu te déconnectes.</li>
        <li>
          Intelligence artificielle (Anthropic, États-Unis) : facultative et éteinte par défaut. Tu l&apos;actives toi-même dans
          les réglages. Ensuite, rien n&apos;est envoyé sans une action de ta part : classer des transactions (date, description et
          montant), lire un relevé PDF ou une capture d&apos;écran, lire un reçu, estimer un projet, ou poser une question à
          l&apos;assistant (ta question et un résumé de tes chiffres : capacité d&apos;épargne, totaux par catégorie, projets, noms et
          soldes des comptes). Les numéros de compte et de carte sont masqués dans les textes avant l&apos;envoi ; ils ne peuvent pas
          l&apos;être dans une image, d&apos;où le rappel de les cacher avant l&apos;envoi. Anthropic n&apos;utilise pas ces données
          pour entraîner ses modèles. L&apos;application ne garde ni les textes ni les images envoyés : seulement, pour la limite
          quotidienne, la date, la fonction utilisée et le nombre de jetons de chaque demande.
        </li>
      </ul>

      <h2 className={titre}>Conservation</h2>
      <p className="mt-2">Tes données sont gardées tant que ton compte existe. La suppression du compte les efface définitivement, photos comprises.</p>

      <h2 className={titre}>Tes droits</h2>
      <p className="mt-2">
        Dans les réglages, tu peux à tout moment consulter et corriger tes données, les télécharger (JSON complet ou CSV) et supprimer
        ton compte avec toutes ses données. Tu peux aussi écrire au responsable ci-dessus ; il répond dans un délai de 30 jours.
      </p>

      <Link href="/accueil" className="lien mt-8 inline-block">
        Retour
      </Link>
    </main>
  );
}
