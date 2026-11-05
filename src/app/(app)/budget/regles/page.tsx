import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { GestionRegles } from "./regles";

export const metadata: Metadata = { title: T.regles.titre };

export default function PageRegles() {
  return <GestionRegles />;
}
