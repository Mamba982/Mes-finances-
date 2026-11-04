import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";

export const metadata: Metadata = { title: T.nav.affaires };

export default function Page() {
  return (
    <>
      <h1 className="text-xl font-extrabold">{T.nav.affaires}</h1>
      <p className="carte note mt-4 py-6 text-center">{T.vide.affaires}</p>
    </>
  );
}
