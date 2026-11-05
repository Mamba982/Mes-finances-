import { z } from "zod";
import { decimalVersCents } from "@/domaine/argent";

const montant = z.union([z.string(), z.number()]).transform((v) => decimalVersCents(v));
const taux = z.union([z.string(), z.number()]).transform((v) => Number(v));

export const schemaProfil = z.object({
  devise: z.string().length(3),
  mode_capacite: z.enum(["auto", "manuel"]),
  capacite_manuelle: montant,
  frais_carte_pct: taux,
  frais_carte_fixe: montant,
  frais_interac: montant,
  frais_change_pct: taux,
  abonnement_compte_us: montant,
  taux_tps: taux,
  taux_tvq: taux,
  entreprise_nom: z.string().nullable(),
  entreprise_adresse: z.string().nullable(),
  no_tps: z.string().nullable(),
  no_tvq: z.string().nullable(),
  ia_active: z.boolean(),
});
export type Profil = z.infer<typeof schemaProfil>;
