// Source « philippe » : premières orientations d'Édouard Philippe (Horizons),
// 4 pages « priorités » de edouardphilippe.fr → data/philippe.json.
import { parse } from "node-html-parser";
import { dataExists, fetcher, flags, plain, save } from "./common.mjs";

const ID = "philippe";
const BASE = "https://www.edouardphilippe.fr";
const PAGES = [
  "pour-une-france-plus-sure",
  "pour-une-france-plus-prospere",
  "pour-une-france-plus-conquerante",
  "pour-une-france-plus-attentive-a-ses-enfants",
];
if (flags.ifMissing && dataExists(ID)) process.exit(0);
const get = fetcher(ID);

const chapters = [];
for (const [i, slug] of PAGES.entries()) {
  const url = `${BASE}/priorites/${slug}`;
  const article = parse(await get(url)).querySelector("main article");
  if (!article) throw new Error(`pas d'article sur ${url}`);
  const cId = `p1c${i + 1}`;
  const sections = [];
  let current = null;
  const intro = [];
  // Parcours à plat : chaque <h3> ouvre une section, les <li> qui suivent sont ses mesures.
  for (const el of article.querySelectorAll("h3, li, p")) {
    if (el.tagName === "H3") {
      current = { id: `${cId}s${sections.length + 1}`, title: plain(el.textContent), url, intro: [], measures: [] };
      sections.push(current);
    } else if (el.tagName === "LI" && current) {
      current.measures.push({ id: `${current.id}m${current.measures.length + 1}`, key: false, text: plain(el.textContent) });
    } else if (el.tagName === "P" && !el.closest("li")) {
      const t = plain(el.textContent);
      if (!t || t === "Les priorités") continue;
      (current ? current.intro : intro).push(t);
    }
  }
  chapters.push({ id: cId, number: i + 1, title: plain(article.querySelector("h1").textContent), url, intro, sections });
}

await save(
  ID,
  {
    title: "Premières orientations d'Édouard Philippe",
    source: `${BASE}/#priorites`,
    retrievedAt: new Date().toISOString().slice(0, 10),
    parts: [{ id: "p1", number: 1, title: "Les priorités", url: `${BASE}/#priorites`, intro: [], chapters }],
  },
  { minMeasures: 60 },
);
