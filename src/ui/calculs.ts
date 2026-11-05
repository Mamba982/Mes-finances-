"use client";

import { useMemo } from "react";
import { capacite, indexer } from "@/domaine/budget";
import { aujourdhuiLocal } from "@/domaine/dates";
import { repartir } from "@/domaine/projets";
import { radar } from "@/domaine/radar";
import { useDonnees } from "@/donnees/magasin";

/** Calculs partagés par l'accueil, le budget et les projets (toujours les mêmes fonctions du domaine). */
export function useCalculs() {
  const donnees = useDonnees();
  const { profil, categories, transactions, projets } = donnees;
  const aujourdhui = aujourdhuiLocal();
  return useMemo(() => {
    const index = indexer(categories);
    const cap = capacite(
      { mode: profil?.mode_capacite ?? "auto", manuelle: profil?.capacite_manuelle ?? 0 },
      transactions,
      index,
      aujourdhui,
    );
    return {
      ...donnees,
      aujourdhui,
      devise: profil?.devise ?? "CAD",
      index,
      capacite: cap,
      repartition: repartir(projets, cap.valeur, aujourdhui),
      radar: radar(transactions, index, aujourdhui),
    };
  }, [donnees, profil, categories, transactions, projets, aujourdhui]);
}
