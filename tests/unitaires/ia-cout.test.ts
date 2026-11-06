import { describe, expect, it } from "vitest";
import { coutUsd } from "@/ia/cout";

describe("coût d'un appel à l'IA", () => {
  it("Sonnet 5.5 : 2 $ / 10 $ par million", () => expect(coutUsd("claude-sonnet-5-5", 10_000, 2_000)).toBeCloseTo(0.04, 10));
  it("Haiku 5.5 : 0,10 $ / 0,50 $ par million", () => expect(coutUsd("claude-haiku-5-5", 3_000, 1_000)).toBeCloseTo(0.0008, 10));
  it("modèle inconnu : pas d'estimation", () => expect(coutUsd("autre", 1, 1)).toBeNull());
});
