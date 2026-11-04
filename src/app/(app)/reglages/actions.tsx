"use client";

import { useId, useSyncExternalStore } from "react";
import { supabaseNavigateur } from "@/donnees/supabase-navigateur";
import { T } from "@/textes/fr-CA";

type Theme = "auto" | "clair" | "sombre";

function lireTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "clair" || t === "sombre" ? t : "auto";
  } catch {
    return "auto";
  }
}

const abonnes = new Set<() => void>();
function abonner(f: () => void) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

function choisir(t: Theme) {
  try {
    if (t === "auto") localStorage.removeItem("theme");
    else localStorage.setItem("theme", t);
  } catch {
    /* stockage bloqué : le choix vaut pour cette visite */
  }
  const el = document.documentElement;
  if (t === "auto") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t === "clair" ? "light" : "dark");
  abonnes.forEach((f) => f());
}

export function ChoixTheme() {
  const theme = useSyncExternalStore(abonner, lireTheme, () => "auto" as Theme);
  const id = useId();
  return (
    <fieldset>
      <legend className="font-bold">{T.theme.titre}</legend>
      <div className="mt-2 flex flex-wrap gap-4">
        {(["auto", "clair", "sombre"] as const).map((t) => (
          <label key={t} htmlFor={`${id}-${t}`} className="flex min-h-11 items-center gap-2">
            <input id={`${id}-${t}`} type="radio" name="theme" checked={theme === t} onChange={() => choisir(t)} className="size-5 accent-accent" />
            {T.theme[t]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Deconnexion() {
  return (
    <button type="button" className="btn-sec" onClick={() => void supabaseNavigateur().auth.signOut()}>
      {T.session.deconnexion}
    </button>
  );
}
