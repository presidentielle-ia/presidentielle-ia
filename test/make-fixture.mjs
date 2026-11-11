// Jeu de test : un programme fictif + deux candidats en attente, et le vrai
// programme LFI s'il a été téléchargé (data/lfi.json, via `pnpm scrape`).
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const lfiFile = new URL("../data/lfi.json", import.meta.url);
const lfi = existsSync(lfiFile) ? JSON.parse(await readFile(lfiFile, "utf8")) : null;
if (!lfi) console.warn("data/lfi.json absent : les tests sur le texte réel seront ignorés");
const registry = JSON.parse(await readFile(new URL("../programmes/registry.json", import.meta.url), "utf8"));
const meta = registry.programmes.find((p) => p.id === "lfi");
const demo = {
  id: "demo", candidat: "Alex Exemple", parti: "Parti de démonstration", titre: "Programme de test", statut: "integre",
  source: "https://example.org/programme", retrievedAt: "2026-11-10",
  stats: { parts: 1, chapters: 1, sections: 1, measures: 3, keyMeasures: 1 },
  parts: [{ id: "p1", number: 1, title: "Partie 1 – Social", url: "https://example.org/p1", intro: ["Intro de test."],
    chapters: [{ id: "p1c1", number: 1, title: "Chapitre 1 : Travail", url: "https://example.org/p1c1", intro: [],
      sections: [{ id: "p1c1s1", title: "Retraites", url: "https://example.org/p1c1#retraites", intro: ["Texte."],
        measures: [
          { id: "p1c1s1k1", key: true, text: "Maintenir l'âge légal de départ à la retraite à 64 ans", date: "2026-10-01" },
          { id: "p1c1s1m1", key: false, text: "Créer une retraite par capitalisation complémentaire", date: "2026-10-01" },
          { id: "p1c1s1m2", key: false, text: "Augmenter le SMIC de 5 %", date: "2026-11-05" },
        ] }] }] }],
};
const programmes = [
  ...(lfi ? [{ ...meta, retrievedAt: lfi.retrievedAt, stats: lfi.stats, parts: lfi.parts }] : []),
  demo,
  { id: "attente", candidat: "Camille Attente", parti: "Mouvement en attente", statut: "attendu" },
  { id: "publie", candidat: "Dominique Publié", parti: "Parti publié", statut: "publie", source: "https://example.org/publie" },
].sort((a, b) => a.candidat.split(" ").at(-1).localeCompare(b.candidat.split(" ").at(-1), "fr"));
await mkdir(new URL("./fixtures/", import.meta.url), { recursive: true });
const changelog = [{ date: "2026-11-08", id: "demo", ajoutees: 1, retirees: 0, total: 3, exemples: ["Augmenter le SMIC de 5 %"] }];
await writeFile(new URL("./fixtures/bundle.json", import.meta.url), JSON.stringify({ generatedAt: "test", programmes, changelog }));
