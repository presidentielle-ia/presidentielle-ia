import { defineConfig } from "vitest/config";

// Les tests tournent sur un jeu de données fixe : le vrai programme LFI
// (régénéré localement) + un programme fictif + des candidats en attente.
export default defineConfig({
  test: {
    alias: [{ find: /^.*\/data\/bundle\.json$/, replacement: new URL("./test/fixtures/bundle.json", import.meta.url).pathname }],
  },
});
