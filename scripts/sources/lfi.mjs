// Source « lfi » : L'Avenir en commun (édition 2027), depuis le site officiel
// melenchon2027.fr → data/lfi.json.
// Usage : node scripts/sources/lfi.mjs [--offline] [--if-missing]
//   --offline     réutilise uniquement .cache/lfi/
//   --if-missing  ne fait rien si data/lfi.json existe déjà
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse } from "node-html-parser";

const BASE = "https://melenchon2027.fr";
const TOC = "/programme/livre/";
const CACHE = new URL("../../.cache/lfi/", import.meta.url);
const OUT = new URL("../../data/lfi.json", import.meta.url);
const OFFLINE = process.argv.includes("--offline");
const UA = "presidentielle-ia-scraper (+https://presidentielle-ia.org)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(path) {
  const file = new URL(path.replace(/^\/|\/$/g, "").replaceAll("/", "__") + ".html", CACHE);
  if (OFFLINE || existsSync(file)) {
    if (existsSync(file)) return readFile(file, "utf8");
  }
  if (OFFLINE) throw new Error(`absent du cache : ${path}`);
  const res = await fetch(BASE + path, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} sur ${path}`);
  const html = await res.text();
  await writeFile(file, html);
  await sleep(1000); // politesse envers le serveur officiel
  return html;
}

const clean = (s) =>
  s.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
const text = (el) => clean(el.textContent);

// Paragraphes de texte libre (hors listes de mesures et encadrés « mesure clé »).
function prose(container) {
  return container
    .querySelectorAll("p")
    .filter((p) => !p.closest(".mesure-cle") && !p.closest("li"))
    .map(text)
    .filter(Boolean);
}

function parseChapter(html, url) {
  const root = parse(html);
  const main = root.querySelector("main.chapitre");
  if (!main) {
    // Introduction ou page de partie : texte suivi, intertitres compris.
    const page = root.querySelector("main.introduction") ?? root.querySelector("main.partie");
    if (!page) throw new Error(`pas de <main> reconnu dans ${url}`);
    const body = page
      .querySelectorAll("section p, section h2, section h3")
      .map((el) => (el.tagName === "P" ? text(el) : `## ${text(el)}`))
      .filter(Boolean);
    return { title: "", sections: [], body };
  }
  const title = text(main.querySelector("header h1"));
  const sections = main.querySelectorAll(".chapitre_sections > section").map((sec) => {
    const h3 = sec.querySelector("h3");
    const keys = sec.querySelectorAll(".mesure-cle p").map(text).filter(Boolean);
    // Une « mesure » peut être un chapeau (« Reconstruire l'école publique : »)
    // suivi de « sous-mesures » ; le décompte officiel (1 069) inclut les deux.
    const measures = sec
      .querySelectorAll("li.mesure, li.sous_mesure")
      .map((li) => ({ sub: li.classList.contains("sous_mesure"), text: text(li) }))
      .filter((m) => m.text);
    return {
      slug: h3?.id ?? "",
      title: h3 ? text(h3) : "",
      intro: prose(sec),
      keyMeasures: keys,
      measures,
    };
  });
  return { title, sections, body: [] };
}

// m1, m2… pour les mesures ; m2.1, m2.2… pour les sous-mesures de m2.
function numberMeasures(sId, items) {
  const out = [];
  let m = 0;
  let sub = 0;
  for (const it of items) {
    if (!it.sub || m === 0) {
      m++;
      sub = 0;
      out.push({ id: `${sId}m${m}`, key: false, text: it.text });
    } else {
      sub++;
      out.push({ id: `${sId}m${m}.${sub}`, key: false, parent: `${sId}m${m}`, text: it.text });
    }
  }
  return out;
}

const EXPECTED_MIN_MEASURES = 1000; // garde-fou : 1 069 mesures dans l'édition 2027

async function main() {
  if (process.argv.includes("--if-missing") && existsSync(OUT)) return;
  await mkdir(new URL("./", OUT), { recursive: true });
  await mkdir(CACHE, { recursive: true });
  const tocHtml = await fetchPage(TOC);
  const toc = parse(tocHtml).querySelector("nav.tdm");
  if (!toc) throw new Error("table des matières introuvable");

  const parts = [];
  for (const block of toc.querySelectorAll("div.partie")) {
    const head = block.querySelector("h2 a");
    const partPath = head.getAttribute("href");
    const partTitle = text(head);
    const chapterLinks = block.querySelectorAll(":scope > a");
    const isIntro = chapterLinks.length === 0;
    console.log(`• ${partTitle}`);
    const partHtml = await fetchPage(partPath);
    const partPage = parseChapter(partHtml, partPath);

    const n = parts.length; // 0 = introduction
    const part = {
      id: isIntro ? "intro" : `p${n}`,
      number: isIntro ? 0 : n,
      title: partTitle.replace(/\s+/g, " "),
      url: BASE + partPath,
      intro: partPage.body,
      chapters: [],
    };

    let c = 0;
    for (const a of chapterLinks) {
      c++;
      const path = a.getAttribute("href");
      console.log(`   - ${text(a)}`);
      const ch = parseChapter(await fetchPage(path), path);
      const chId = `${part.id}c${c}`;
      part.chapters.push({
        id: chId,
        number: c,
        title: text(a),
        url: BASE + path,
        intro: ch.body,
        sections: ch.sections.map((s, i) => {
          const sId = `${chId}s${i + 1}`;
          return {
            id: sId,
            title: s.title,
            url: `${BASE}${path}#${s.slug}`,
            intro: s.intro,
            measures: [
              ...s.keyMeasures.map((t, k) => ({ id: `${sId}k${k + 1}`, key: true, text: t })),
              ...numberMeasures(sId, s.measures),
            ],
          };
        }),
      });
    }
    parts.push(part);
  }

  const all = parts.flatMap((p) => p.chapters.flatMap((c) => c.sections.flatMap((s) => s.measures)));
  const out = {
    title: "L'Avenir en commun — édition 2027",
    source: BASE + TOC,
    retrievedAt: new Date().toISOString().slice(0, 10),
    notice:
      "Texte reproduit à l'identique depuis le site officiel melenchon2027.fr. Projet citoyen non officiel, non affilié à la campagne.",
    stats: {
      parts: parts.filter((p) => p.number > 0).length,
      chapters: parts.reduce((n, p) => n + p.chapters.length, 0),
      sections: parts.reduce((n, p) => n + p.chapters.reduce((m, c) => m + c.sections.length, 0), 0),
      measures: all.length,
      keyMeasures: all.filter((m) => m.key).length,
    },
    parts,
  };
  // Une page officielle modifiée ou un piratage du site source ne doit pas
  // produire un jeu de données tronqué : on refuse d'écrire.
  if (out.stats.measures < EXPECTED_MIN_MEASURES || out.stats.chapters !== 23) {
    throw new Error(`structure inattendue, abandon : ${JSON.stringify(out.stats)}`);
  }
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
  console.log("\n", out.stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
