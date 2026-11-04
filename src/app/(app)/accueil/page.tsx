import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { TableauAccueil } from "./tableau";

export const metadata: Metadata = { title: T.nav.accueil };

export default function PageAccueil() {
  return <TableauAccueil />;
}
