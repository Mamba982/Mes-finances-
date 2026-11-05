"use client";

import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { oublierAppareil } from "@/donnees/magasin";
import { supabaseNavigateur } from "@/donnees/supabase-navigateur";
import { T } from "@/textes/fr-CA";

const ContexteSession = createContext<Session | null>(null);

/**
 * Garde côté navigateur. Elle sert l'ergonomie (rediriger vers la connexion) ;
 * la sécurité des données repose sur la RLS, pas sur cette garde.
 * getSession() lit la session locale : l'accueil s'affiche aussi hors ligne.
 */
export function FournisseurSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const sb = supabaseNavigateur();
    let actif = true;
    void sb.auth.getSession().then(({ data }) => {
      if (!actif) return;
      setSession(data.session);
      if (!data.session) router.replace("/connexion");
    });
    const { data } = sb.auth.onAuthStateChange((evt, s) => {
      // Déconnexion explicite : la copie locale des données est effacée de l'appareil.
      if (evt === "SIGNED_OUT") void oublierAppareil();
      setSession(s);
      if (!s) router.replace("/connexion");
    });
    return () => {
      actif = false;
      data.subscription.unsubscribe();
    };
  }, [router]);

  if (!session) {
    return (
      <p className="note py-10 text-center" role="status">
        {T.session.chargement}
      </p>
    );
  }
  return <ContexteSession value={session}>{children}</ContexteSession>;
}

export function useSession(): Session {
  const s = use(ContexteSession);
  if (!s) throw new Error("useSession hors de FournisseurSession");
  return s;
}
