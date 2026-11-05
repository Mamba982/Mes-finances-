/** Contrôles d'accès d'une requête IA, dans l'ordre. Fonction pure, testée sans réseau. */

export type RefusIa = "indisponible" | "session" | "desactivee" | "limite";

export interface EtatAcces {
  disponible: boolean; // clé et modèle configurés sur le serveur
  connecte: boolean;
  iaActive: boolean; // réglage de l'utilisateur (éteint par défaut)
  utilisationsDuJour: number;
  limite: number;
}

export const STATUT_REFUS: Record<RefusIa, number> = { indisponible: 503, session: 401, desactivee: 403, limite: 429 };

export function verifierAcces(e: EtatAcces): { ok: true } | { ok: false; refus: RefusIa; statut: number } {
  const refus: RefusIa | null = !e.disponible
    ? "indisponible"
    : !e.connecte
      ? "session"
      : !e.iaActive
        ? "desactivee"
        : e.utilisationsDuJour >= e.limite
          ? "limite"
          : null;
  return refus ? { ok: false, refus, statut: STATUT_REFUS[refus] } : { ok: true };
}
