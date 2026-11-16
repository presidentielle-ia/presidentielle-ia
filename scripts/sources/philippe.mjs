// Source « philippe » : programme d'Édouard Philippe (Horizons), pages
// thématiques de edouardphilippe.fr/programme → data/philippe.json.
// Chaque thématique = un chapitre : « Nos propositions phares » (mesures clés)
// puis une section par question-réponse (chaque paragraphe = une mesure).
import { parse } from "node-html-parser";
import { dataExists, fetcher, flags, plain, save } from "./common.mjs";

const ID = "philippe";
const BASE = "https://www.edouardphilippe.fr";
if (flags.ifMissing && dataExists(ID)) process.exit(0);
const get = fetcher(ID);

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const toIso = (s) => {
  const m = /(\d{1,2})(?:er)? (\p{L}+) (\d{4})/u.exec(s ?? "");
  const mois = m && MOIS.indexOf(m[2].toLowerCase());
  return m && mois >= 0 ? `${m[3]}-${String(mois + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

// Le menu latéral d'une page thématique donne les grandes priorités et leurs thématiques.
const index = parse(await get(`${BASE}/programme`));
const firstTheme = index.querySelector('a[href^="https://www.edouardphilippe.fr/programme/"]')?.getAttribute("href");
if (!firstTheme) throw new Error(`aucune thématique sur ${BASE}/programme`);
const nav = parse(await get(firstTheme)).querySelector('aside[aria-label="Navigation du programme"]');
if (!nav) throw new Error(`menu des thématiques introuvable sur ${firstTheme}`);
const groups = [];
for (const el of nav.querySelectorAll("p.nav-prio, a")) {
  if (el.tagName === "P") groups.push({ title: plain(el.textContent), urls: [] });
  else if (groups.length && /^https:\/\/www\.edouardphilippe\.fr\/programme\/[a-z0-9-]+$/.test(el.getAttribute("href") ?? ""))
    groups.at(-1).urls.push(el.getAttribute("href"));
}

const dates = [];
const parts = [];
for (const [i, g] of groups.entries()) {
  const pId = `p${i + 1}`;
  const chapters = [];
  for (const [j, url] of g.urls.entries()) {
    const page = parse(await get(url));
    const cId = `${pId}c${j + 1}`;
    const maj = toIso(page.querySelector(".thematique-maj")?.textContent);
    if (maj) dates.push(maj);
    const phares = page.querySelector("section.propositions");
    if (!phares) throw new Error(`pas de propositions phares sur ${url}`);
    const sections = [
      {
        id: `${cId}s1`,
        title: plain(phares.querySelector(".propositions__label")?.textContent) || "Nos propositions phares",
        url,
        intro: phares.querySelectorAll(".propositions__accroche").map((p) => plain(p.textContent)).filter(Boolean),
        measures: phares.querySelectorAll("li").map((li, k) => ({ id: `${cId}s1m${k + 1}`, key: true, text: plain(li.textContent), updated: maj ?? undefined })),
      },
    ];
    for (const qa of page.querySelectorAll("section.qa")) {
      const sId = `${cId}s${sections.length + 1}`;
      const reponse = qa.querySelector(".qa__reponse");
      const blocs = reponse ? reponse.querySelectorAll("p, li").filter((el) => !el.closest("li") || el.tagName === "LI") : [];
      sections.push({
        id: sId,
        title: plain(qa.querySelector("summary h2")?.textContent),
        url: `${url}#${qa.getAttribute("id")}`,
        intro: [],
        measures: blocs.map((el) => plain(el.textContent)).filter(Boolean).map((text, k) => ({ id: `${sId}m${k + 1}`, key: false, text, updated: maj ?? undefined })),
      });
    }
    chapters.push({ id: cId, number: j + 1, title: plain(page.querySelector("h1")?.textContent), url, intro: [], sections });
  }
  parts.push({ id: pId, number: i + 1, title: g.title, url: `${BASE}/programme`, intro: [], chapters });
}

await save(
  ID,
  {
    title: "Le programme d'Édouard Philippe",
    sourceUpdatedAt: dates.sort().at(-1) ?? null,
    source: `${BASE}/programme`,
    retrievedAt: new Date().toISOString().slice(0, 10),
    parts,
  },
  { minMeasures: 150 },
);
