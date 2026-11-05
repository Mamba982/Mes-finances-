"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

let cache: Promise<boolean> | null = null;

/** L'IA est-elle configurée sur le serveur ? (une seule requête par visite ; hors ligne : non) */
export function useIaDisponible(): boolean {
  const [dispo, setDispo] = useState(false);
  useEffect(() => {
    cache ??= fetch("/api/ia/etat", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => z.object({ disponible: z.boolean() }).parse(j).disponible)
      .catch(() => false);
    let actif = true;
    void cache.then((d) => {
      if (actif) setDispo(d);
    });
    return () => {
      actif = false;
    };
  }, []);
  return dispo;
}
