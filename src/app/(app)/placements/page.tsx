import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";

export const metadata: Metadata = { title: T.nav.placements };

export default function Page() {
  return (
    <>
      <h1 className="text-xl font-extrabold">{T.nav.placements}</h1>
      <p className="alerte mt-4 border-accent">{T.vide.infoGenerale}</p>
      <p className="carte note mt-4 py-6 text-center">{T.vide.placements}</p>
    </>
  );
}
