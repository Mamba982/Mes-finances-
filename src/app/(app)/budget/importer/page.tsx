import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { ImportReleve } from "./import";

export const metadata: Metadata = { title: T.importer.titre };

export default function PageImporter() {
  return <ImportReleve />;
}
