import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/** Isolated probe runner — not used by default CI (`bunx vitest run`). */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    include: ["docs/readiness/probes/**/*.probe.ts"],
    passWithNoTests: false,
  },
});
