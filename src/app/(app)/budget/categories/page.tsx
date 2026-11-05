import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { FormulaireCategories } from "./formulaire";

export const metadata: Metadata = { title: T.categories.titre };

export default function PageCategories() {
  return <FormulaireCategories />;
}
