// Construit data/bundle.json : registre des candidats + textes disponibles.
// Usage : node scripts/build.mjs [--fetch]   (--fetch = lance les sources manquantes)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("programmes/registry.json", root), "utf8"));

const programmes = [];
for (const entry of registry.programmes) {
  const dataFile = new URL(`data/${entry.id}.json`, root);
  const sourceScript = new URL(`scripts/sources/${entry.id}.mjs`, root);
  if (process.argv.includes("--fetch") && !existsSync(dataFile) && existsSync(sourceScript)) {
    const r = spawnSync(process.execPath, [sourceScript.pathname], { stdio: "inherit" });
    if (r.status !== 0) console.warn(`⚠ source ${entry.id} en échec, ignorée`);
  }
  if (entry.statut === "integre" && existsSync(dataFile)) {
    const data = JSON.parse(await readFile(dataFile, "utf8"));
    programmes.push({ ...entry, retrievedAt: data.retrievedAt, stats: data.stats, parts: data.parts });
  } else {
    if (entry.statut === "integre") console.warn(`⚠ ${entry.id} : données absentes, affiché comme « publié »`);
    programmes.push({ ...entry, statut: entry.statut === "integre" ? "publie" : entry.statut });
  }
}
// Tri par nom de famille (champ « nom » si le dernier mot ne suffit pas, ex. « Le Pen »).
const lastName = (p) => p.nom ?? p.candidat.split(" ").at(-1);
const byName = (a, b) => lastName(a).localeCompare(lastName(b), "fr");
programmes.sort(byName);

await mkdir(new URL("data/", root), { recursive: true });
await writeFile(new URL("data/bundle.json", root), JSON.stringify({ generatedAt: new Date().toISOString(), programmes }));

console.log(`bundle : ${programmes.length} entrées, ${programmes.filter((p) => p.statut === "integre").length} intégrée(s)`);
