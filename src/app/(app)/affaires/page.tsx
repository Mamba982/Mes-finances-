import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { VueAffaires } from "./vue";

export const metadata: Metadata = { title: T.nav.affaires };

export default function PageAffaires() {
  return <VueAffaires />;
}
