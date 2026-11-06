import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

/**
 * Contrat d'un appel au modèle, indépendant du client réel : les fonctions de src/ia/ le reçoivent
 * en paramètre, les tests leur passent un faux. Le modèle ne renvoie que des données conformes au
 * schéma (extraction ou classement) ; tout calcul reste dans src/domaine/.
 */
export type ContenuModele = string | Anthropic.ContentBlockParam[];

export interface DemandeModele<S extends z.ZodType> {
  systeme: string;
  contenu: ContenuModele;
  schema: S;
  /** « rapide » : modèle de catégorisation (Haiku, sans réflexion) ; « complet » : lecture de documents et assistant. */
  gamme: "rapide" | "complet";
  maxJetons?: number;
}

export interface Consommation {
  modele: string;
  jetonsEntree: number;
  jetonsSortie: number;
}

export interface ReponseModele<T> extends Consommation {
  donnees: T;
}

export type AppelModele = <S extends z.ZodType>(d: DemandeModele<S>) => Promise<ReponseModele<z.infer<S>>>;

/** Réponse illisible ou hors schéma : rien n'est enregistré. Porte la consommation pour le journal. */
export class ReponseIaInvalide extends Error {
  constructor(
    message: string,
    readonly consommation?: Consommation,
  ) {
    super(message);
  }
}

/** Le modèle a refusé de répondre (classificateurs de sécurité d'Anthropic). */
export class RefusModele extends ReponseIaInvalide {}

/** Valide le texte JSON renvoyé par le modèle contre le schéma attendu. Fonction pure, testée sans réseau. */
export function lireReponseStructuree<S extends z.ZodType>(texte: string, schema: S, consommation: Consommation): z.infer<S> {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new ReponseIaInvalide("JSON illisible", consommation);
  }
  const v = schema.safeParse(brut);
  if (!v.success) throw new ReponseIaInvalide("schéma", consommation);
  return v.data;
}
