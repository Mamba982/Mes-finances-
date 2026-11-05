import type { LigneReleve } from "./csv/lire";

/**
 * Point d'extension pour une future connexion à un agrégateur ou à l'open banking canadien.
 * Non implémenté en v1 : l'utilisateur importe ses relevés (CSV, PDF, image).
 * Toute source doit produire des LigneReleve, qui passent ensuite par l'écran de revue
 * et la détection de doublons comme un fichier importé.
 */
export interface CompteBancaire {
  idExterne: string;
  nom: string;
  institution: string;
  devise: string;
}

export type EtatConnexion = { etat: "connecte"; expireLe: string | null } | { etat: "a-reconnecter"; raison: string } | { etat: "deconnecte" };

export interface SourceBancaire {
  /** Identifiant stable du fournisseur (ex. « open-banking-ca »). */
  readonly id: string;
  /** Nom affiché à l'utilisateur, en français. */
  readonly nom: string;
  etat(): Promise<EtatConnexion>;
  comptes(): Promise<CompteBancaire[]>;
  /** Transactions d'un compte entre deux dates incluses (AAAA-MM-JJ). */
  transactions(idCompte: string, depuis: string, jusqua: string): Promise<LigneReleve[]>;
  deconnecter(): Promise<void>;
}
