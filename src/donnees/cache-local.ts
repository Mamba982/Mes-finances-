"use client";

/**
 * Copie locale des données déjà vues (IndexedDB), par utilisateur : l'accueil s'affiche tout de suite
 * et reste consultable hors ligne. Effacée à la déconnexion. Toute erreur est silencieuse :
 * sans cette copie, l'application lit simplement le réseau.
 */
const BASE = "mes-finances";
const MAGASIN = "instantanes";

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === "undefined") return ko(new Error("indexedDB"));
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function operation<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await ouvrir();
  try {
    return await new Promise<T>((ok, ko) => {
      const r = f(db.transaction(MAGASIN, mode).objectStore(MAGASIN));
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  } finally {
    db.close();
  }
}

export interface Instantane<D> {
  enregistreLe: string; // ISO
  donnees: D;
}

export async function lireInstantane<D>(idUtilisateur: string): Promise<Instantane<D> | null> {
  try {
    return ((await operation("readonly", (s) => s.get(idUtilisateur))) as Instantane<D> | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function ecrireInstantane<D>(idUtilisateur: string, donnees: D): Promise<void> {
  try {
    await operation("readwrite", (s) => s.put({ enregistreLe: new Date().toISOString(), donnees } satisfies Instantane<D>, idUtilisateur));
  } catch {
    /* stockage plein ou bloqué : l'application continue sans copie locale */
  }
}

export async function effacerInstantanes(): Promise<void> {
  try {
    await operation("readwrite", (s) => s.clear());
  } catch {
    /* rien à effacer */
  }
}
