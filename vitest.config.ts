import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unitaires", include: ["tests/unitaires/**/*.test.ts"], environment: "node" } },
      { resolve: { alias }, test: { name: "rls", include: ["tests/rls/**/*.test.ts"], environment: "node", fileParallelism: false } },
    ],
  },
});
