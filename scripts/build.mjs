// Construit data/bundle.json : registre des candidats + textes disponibles.
// Usage : node scripts/build.mjs [--fetch]
//   --fetch                  lance les sources dont les données manquent
// Variables d'environnement :
//   STRICT_DATA=1            échoue si un programme « integre » n'a pas de données
//                            (à utiliser pour tout déploiement : évite qu'un
//                            candidat disparaisse silencieusement)
//   REQUIRE_REUSE_RIGHTS=1   n'intègre que les programmes dont la réutilisation
//                            est permise (champ « reutilisation » du registre) ;
//                            les autres sont affichés comme publiés, en attente.
// Retrait : `"reutilisation": "retire"` dans le registre retire le texte d'un
// programme dans tous les modes (demande d'un ayant droit).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("programmes/registry.json", root), "utf8"));
const STRICT = process.env.STRICT_DATA === "1";
const RIGHTS = process.env.REQUIRE_REUSE_RIGHTS === "1";
const REUSE_OK = new Set(["licence", "autorisation"]);

const meta = existsSync(new URL("data/meta.json", root)) ? JSON.parse(await readFile(new URL("data/meta.json", root), "utf8")) : {};
const programmes = [];
const missing = [];
for (const entry of registry.programmes) {
  const dataFile = new URL(`data/${entry.id}.json`, root);
  const sourceScript = new URL(`scripts/sources/${entry.id}.mjs`, root);
  if (process.argv.includes("--fetch") && !existsSync(dataFile) && existsSync(sourceScript)) {
    const r = spawnSync(process.execPath, [sourceScript.pathname], { stdio: "inherit" });
    if (r.status !== 0) console.warn(`⚠ source ${entry.id} en échec`);
  }
  if (entry.statut === "integre" && entry.reutilisation === "retire") {
    programmes.push({ ...entry, statut: "publie", note: "Texte retiré à la demande de l'ayant droit ; voir le site officiel" });
  } else if (entry.statut === "integre" && RIGHTS && !REUSE_OK.has(entry.reutilisation)) {
    // Même règle pour tous : pas d'autorisation de réutilisation → pas de texte.
    programmes.push({ ...entry, statut: "publie", note: "Programme publié ; en attente d'autorisation de reproduction" });
  } else if (entry.statut === "integre" && existsSync(dataFile)) {
    const data = JSON.parse(await readFile(dataFile, "utf8"));
    const m = meta[entry.id] ?? {};
    // Dates : publication et mise à jour officielles si la source les donne,
    // sinon celles que nous avons constatées ; vérification = dernier passage.
    const updates = [data.sourceUpdatedAt, m.updatedAt].filter(Boolean).sort();
    const dates = {
      publication: data.publishedAt ?? entry.publieLe ?? null,
      miseAJour: updates.at(-1) ?? null,
      verification: m.checkedAt ?? data.retrievedAt,
    };
    programmes.push({ ...entry, retrievedAt: data.retrievedAt, dates, stats: data.stats, parts: data.parts });
  } else {
    if (entry.statut === "integre") missing.push(entry.id);
    programmes.push({ ...entry, statut: entry.statut === "integre" ? "publie" : entry.statut });
  }
}
if (missing.length) {
  const msg = `données absentes pour : ${missing.join(", ")} (lancer \`pnpm scrape\`)`;
  if (STRICT) {
    console.error(`✖ ${msg}`);
    process.exit(1);
  }
  console.warn(`⚠ ${msg} — affichés comme « publiés »`);
}
// Tri par nom de famille (champ « nom » si le dernier mot ne suffit pas, ex. « Le Pen »).
const lastName = (p) => p.nom ?? p.candidat.split(" ").at(-1);
const byName = (a, b) => lastName(a).localeCompare(lastName(b), "fr");
programmes.sort(byName);

await mkdir(new URL("data/", root), { recursive: true });
const changelog = existsSync(new URL("data/changelog.json", root)) ? JSON.parse(await readFile(new URL("data/changelog.json", root), "utf8")).slice(0, 100) : [];
await writeFile(new URL("data/bundle.json", root), JSON.stringify({ generatedAt: new Date().toISOString(), programmes, changelog }));

console.log(`bundle : ${programmes.length} entrées, ${programmes.filter((p) => p.statut === "integre").length} intégrée(s)${RIGHTS ? " (droits de réutilisation exigés)" : ""}`);
