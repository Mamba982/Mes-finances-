import type { Metadata } from "next";
import { T } from "@/textes/fr-CA";
import { ScenarioProjets } from "./scenario";

export const metadata: Metadata = { title: T.scenario.titre };

export default function PageScenario() {
  return <ScenarioProjets />;
}
