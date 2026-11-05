import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { VueProjets } from "./vue";

export const metadata: Metadata = { title: T.nav.projets };

export default function PageProjets() {
  return <VueProjets />;
}
