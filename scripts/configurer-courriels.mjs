// Applique le SMTP (ex. Brevo) et les modèles de courriel en français au projet Supabase.
// Ne fait rien tant que les variables SMTP sont vides (usage personnel : envoi intégré de Supabase).
// Usage : node --env-file=.env.local scripts/configurer-courriels.mjs
// Demande aussi SUPABASE_ACCESS_TOKEN (jeton personnel, Supabase > Account > Access Tokens) et SUPABASE_PROJECT_REF.
// Note : les noms de champs de l'API de gestion n'ont pas encore été vérifiés contre un vrai appel ;
// en cas d'erreur, la réponse de Supabase est affichée telle quelle et rien n'est modifié.
import { readFileSync } from "node:fs";

const e = process.env;
const smtp = {
  smtp_host: e.SMTP_HOTE,
  smtp_port: e.SMTP_PORT,
  smtp_user: e.SMTP_UTILISATEUR,
  smtp_pass: e.SMTP_MOT_DE_PASSE,
  smtp_admin_email: e.SMTP_EXPEDITEUR_COURRIEL,
  smtp_sender_name: e.SMTP_EXPEDITEUR_NOM || "Mes finances",
};
const manquants = Object.entries(smtp).filter(([, v]) => !v).map(([k]) => k);
if (manquants.length) {
  console.log(`SMTP non configuré (${manquants.join(", ")} vide) : rien n'est modifié. L'envoi intégré de Supabase reste en place.`);
  process.exit(0);
}
if (!e.SUPABASE_ACCESS_TOKEN || !e.SUPABASE_PROJECT_REF) {
  console.error("SUPABASE_ACCESS_TOKEN et SUPABASE_PROJECT_REF sont requis.");
  process.exit(1);
}
const modele = (f) => readFileSync(new URL(`../supabase/modeles/${f}`, import.meta.url), "utf8");
const corps = {
  ...smtp,
  mailer_subjects_magic_link: "Ton lien de connexion à Mes finances",
  mailer_templates_magic_link_content: modele("lien-magique.html"),
  mailer_subjects_confirmation: "Confirme ton courriel pour Mes finances",
  mailer_templates_confirmation_content: modele("confirmation.html"),
};
const r = await fetch(`https://api.supabase.com/v1/projects/${e.SUPABASE_PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${e.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(corps),
});
if (!r.ok) {
  console.error(`Échec ${r.status} :`, await r.text());
  process.exit(1);
}
console.log("SMTP et modèles de courriel appliqués : le courriel de connexion contient maintenant le lien et le code.");
