// Vérification quotidienne des programmes.
//   1. Retélécharge chaque programme intégré (FRESH=1) et détecte les
//      changements (mesures ajoutées / retirées) → data/meta.json + data/changelog.json.
//   2. Surveille les pages officielles des candidats sans programme intégré
//      (publication éventuelle) → data/watch.json.
// Garde-fous : un import en échec ou qui perd plus de 30 % des mesures est
// ignoré (on garde l'ancienne version) et signalé.
// Sortie : un résumé JSON sur stdout (dernière ligne).
import { existsSync } from "node:fs";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const dataDir = new URL("data/", root);
await mkdir(dataDir, { recursive: true });
// Dates au fuseau de Paris (élection française).
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const readJson = async (name, fallback) =>
  existsSync(new URL(name, dataDir)) ? JSON.parse(await readFile(new URL(name, dataDir), "utf8")) : fallback;

const registry = JSON.parse(await readFile(new URL("programmes/registry.json", root), "utf8"));
const meta = await readJson("meta.json", {});
const watch = await readJson("watch.json", {});
const changelog = await readJson("changelog.json", []);
const summary = { date: today, changed: [], unchanged: [], errors: [], anomalies: [], suspicious: [], watchChanged: [], watchErrors: [] };

// Texte suspect : instructions adressées à une IA cachées dans un programme
// (injection de consignes). Signalé pour vérification humaine.
const SUSPECT = /ignore[rz]? (les|toutes|tout|previous|all)|instructions? (précédentes|ci-dessus|système)|system prompt|en tant qu['’]ia|tu es (un|une) (ia|assistant|modèle)|chatgpt|openai|anthropic|\bllm\b|<\s*script|vote[rz]? pour (moi|nous|[A-ZÉ])/i;
const suspects = (texts) => texts.filter((t) => SUSPECT.test(t)).map((t) => t.slice(0, 200));

const measures = (d) => d.parts.flatMap((p) => p.chapters.flatMap((c) => c.sections.flatMap((s) => s.measures)));
const hashOf = (d) => createHash("sha256").update(JSON.stringify(measures(d).map((m) => [m.id, m.text]))).digest("hex").slice(0, 16);

for (const entry of registry.programmes) {
  const script = new URL(`scripts/sources/${entry.id}.mjs`, root);
  if (entry.statut !== "integre" || !existsSync(script)) continue;
  const file = new URL(`${entry.id}.json`, dataDir);
  const backup = new URL(`${entry.id}.json.bak`, dataDir);
  const old = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : null;
  if (old) await copyFile(file, backup);

  const r = spawnSync(process.execPath, [script.pathname], { env: { ...process.env, FRESH: "1" }, encoding: "utf8", timeout: 300_000 });
  if (r.status !== 0 || !existsSync(file)) {
    if (old) await copyFile(backup, file);
    summary.errors.push({ id: entry.id, error: (r.stderr || r.error?.message || "échec").trim().split("\n").slice(-2).join(" ") });
    continue;
  }
  const fresh = JSON.parse(await readFile(file, "utf8"));
  if (old && fresh.stats.measures < old.stats.measures * 0.7) {
    await copyFile(backup, file);
    summary.anomalies.push({ id: entry.id, avant: old.stats.measures, apres: fresh.stats.measures });
    continue;
  }

  const m = (meta[entry.id] ??= { firstSeenAt: old?.retrievedAt ?? today });
  const hash = hashOf(fresh);
  if (m.hash && m.hash !== hash) {
    const before = new Set(old ? measures(old).map((x) => x.text) : []);
    const after = new Set(measures(fresh).map((x) => x.text));
    const added = [...after].filter((t) => !before.has(t));
    const removed = [...before].filter((t) => !after.has(t));
    m.updatedAt = today;
    const sus = suspects(added);
    if (sus.length) summary.suspicious.push({ id: entry.id, textes: sus });
    const change = { date: today, id: entry.id, ajoutees: added.length, retirees: removed.length, total: fresh.stats.measures, exemples: added.slice(0, 3).map((t) => t.slice(0, 160)) };
    changelog.unshift(change);
    summary.changed.push(change);
  } else {
    summary.unchanged.push(entry.id);
  }
  m.hash = hash;
  m.checkedAt = today;
  m.measures = fresh.stats.measures;
}

// Pages officielles des candidats sans programme intégré.
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
for (const entry of registry.programmes) {
  if (entry.statut === "integre" || !entry.source) continue;
  const w = (watch[entry.id] ??= { url: entry.source });
  w.url = entry.source;
  try {
    const res = await fetch(entry.source, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; presidentielle-ia-veille; +https://presidentielle-ia.org)" },
      signal: AbortSignal.timeout(30_000),
    });
    w.status = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = visibleText(await res.text());
    const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
    if (w.hash && w.hash !== hash) {
      w.changedAt = today;
      summary.watchChanged.push({ id: entry.id, candidat: entry.candidat, url: entry.source });
    }
    w.hash = hash;
    w.length = text.length;
  } catch (e) {
    summary.watchErrors.push({ id: entry.id, error: String(e.message ?? e) });
  }
  w.checkedAt = today;
  await new Promise((r) => setTimeout(r, 500));
}

await writeFile(new URL("meta.json", dataDir), JSON.stringify(meta, null, 1) + "\n");
await writeFile(new URL("watch.json", dataDir), JSON.stringify(watch, null, 1) + "\n");
await writeFile(new URL("changelog.json", dataDir), JSON.stringify(changelog.slice(0, 300), null, 1) + "\n");
console.log(JSON.stringify(summary));
