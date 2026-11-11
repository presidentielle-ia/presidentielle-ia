// Outils communs aux scripts de sources.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export const UA = "presidentielle-ia-scraper (+https://presidentielle-ia.org)";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const flags = {
  offline: process.argv.includes("--offline"),
  ifMissing: process.argv.includes("--if-missing"),
  // FRESH=1 : ignore le cache et retélécharge (vérification quotidienne).
  fresh: process.env.FRESH === "1",
};

/** Télécharge une URL avec cache disque (.cache/<id>/), 1 s entre deux requêtes. */
export function fetcher(id) {
  const cache = new URL(`../../.cache/${id}/`, import.meta.url);
  return async function get(url) {
    await mkdir(cache, { recursive: true });
    const file = new URL(url.replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]+/gi, "_").slice(0, 180), cache);
    if (!flags.fresh && existsSync(file)) return readFile(file, "utf8");
    if (flags.offline) throw new Error(`absent du cache : ${url}`);
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`${res.status} sur ${url}`);
    const body = await res.text();
    await writeFile(file, body);
    await sleep(1000);
    return body;
  };
}

/** Retire le gras Markdown et normalise les espaces. */
export const plain = (s) =>
  String(s ?? "").replace(/\*\*/g, "").replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

/** Calcule les statistiques, vérifie un minimum, écrit data/<id>.json. */
export async function save(id, out, { minMeasures }) {
  const all = out.parts.flatMap((p) => p.chapters.flatMap((c) => c.sections.flatMap((s) => s.measures)));
  out.stats = {
    parts: out.parts.filter((p) => p.number > 0).length,
    chapters: out.parts.reduce((n, p) => n + p.chapters.length, 0),
    sections: out.parts.reduce((n, p) => n + p.chapters.reduce((m, c) => m + c.sections.length, 0), 0),
    measures: all.length,
    keyMeasures: all.filter((m) => m.key).length,
  };
  if (all.length < minMeasures) throw new Error(`${id} : ${all.length} mesures seulement, abandon`);
  const ids = new Set(all.map((m) => m.id));
  if (ids.size !== all.length) throw new Error(`${id} : identifiants de mesures en double`);
  const dest = new URL(`../../data/${id}.json`, import.meta.url);
  await mkdir(new URL("./", dest), { recursive: true });
  await writeFile(dest, JSON.stringify(out, null, 1) + "\n");
  console.log(`${id} :`, out.stats);
}

export const dataExists = (id) => existsSync(new URL(`../../data/${id}.json`, import.meta.url));
