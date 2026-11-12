// Source « tondelier » : « Pour une prospérité écologique », programme des
// Écologistes porté par Marine Tondelier (PDF officiel, version de référence
// communiquée par l'équipe de campagne le 12/11/2026) → data/tondelier.json.
// Usage : node scripts/sources/tondelier.mjs [--offline] [--if-missing]
// Le site officiel est derrière une protection anti-robots (403 aux requêtes
// directes) : si le téléchargement échoue, le PDF déjà présent dans
// .cache/tondelier/ est utilisé. Extraction : pdftotext (poppler).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { UA, dataExists, flags, save } from "./common.mjs";

const ID = "tondelier";
const PDF = "https://lesecologistes.fr/document/3N4JsAEmq6vsx42IITGNZa/vdef-programme-1.pdf";
const CACHE = new URL(`../../.cache/${ID}/`, import.meta.url);
const FILE = new URL("vdef-programme-1.pdf", CACHE);
if (flags.ifMissing && dataExists(ID)) process.exit(0);

// 1. PDF : téléchargement (si possible), sinon cache.
await mkdir(CACHE, { recursive: true });
if (!flags.offline && (flags.fresh || !existsSync(FILE))) {
  try {
    const res = await fetch(PDF, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`${res.status} sur ${PDF}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error(`réponse non PDF sur ${PDF}`);
    await writeFile(FILE, buf);
  } catch (e) {
    if (!existsSync(FILE)) throw new Error(`${e.message} et PDF absent du cache (${FILE.pathname})`);
    console.warn(`⚠ ${e.message} : PDF en cache utilisé`);
  }
}
if (!existsSync(FILE)) throw new Error(`absent du cache : ${PDF}`);
const bin = ["/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "/usr/bin/pdftotext"].find(existsSync) ?? "pdftotext";
// Texte reconstruit d'après la position des lignes (-bbox-layout) : l'ordre interne
// du PDF ne suit pas toujours l'ordre de lecture (cadres InDesign). Par page : bandes
// délimitées par les lignes pleine largeur, colonne gauche puis colonne droite dans
// chaque bande. Saut vertical ou changement de colonne → ligne vide. Les tirets de fin
// de ligne sont conservés tels quels ; la césure est tranchée plus bas.
const html = execFileSync(bin, ["-enc", "UTF-8", "-bbox-layout", FILE.pathname, "-"], { encoding: "utf8", maxBuffer: 256 << 20 });
const entity = (s) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const MID = 297.6; // milieu de la page A4 (595,3 pt)
const pages = [...html.matchAll(/<page [^>]*>([\s\S]*?)<\/page>/g)].map(([, body]) => {
  const lines = [...body.matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g)].map(
    ([, x0, y0, x1, y1, inner]) => ({
      x0: +x0, y0: +y0, x1: +x1, y1: +y1,
      text: [...inner.matchAll(/>([^<]*)<\/word>/g)].map((w) => entity(w[1])).join(" "),
    }),
  );
  const col = (l) => (l.x0 < MID - 10 && l.x1 > MID + 10 ? "full" : l.x0 < MID ? "left" : "right");
  const full = lines.filter((l) => col(l) === "full").sort((a, b) => a.y0 - b.y0);
  const cuts = [-Infinity, ...full.map((l) => l.y0), Infinity];
  const out = [];
  let prev = null;
  const emit = (l, newBlock) => {
    const gap = prev && (newBlock || l.y0 - prev.y1 > 0.6 * (prev.y1 - prev.y0));
    if (gap) out.push("");
    out.push(l.text);
    prev = l;
  };
  for (let i = 0; i < cuts.length - 1; i++) {
    if (i > 0) emit(full[i - 1], false);
    for (const side of ["left", "right"]) {
      const band = lines.filter((l) => col(l) === side && l.y0 >= cuts[i] && l.y0 < cuts[i + 1]).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      band.forEach((l, j) => emit(l, j === 0));
    }
  }
  return out.join("\n");
});
const text = pages.join("\n");

// Espaces normalisés ; césures conditionnelles (U+00AD, invisibles à l'écran) retirées.
const norm = (s) => s.replace(/­/g, "").replace(/[  \t]+/g, " ").trim();
// Fin de ligne en « - » : trait d'union réel (« lui-même », « Outre-mer ») ou césure
// typographique (« néces-saires »). Tranché d'après le reste du document : forme avec
// trait d'union attestée en milieu de ligne → conservée ; forme soudée attestée → soudée ;
// sinon trait d'union conservé devant une majuscule, soudé devant une minuscule.
const words = new Set(text.replace(/\u00ad/g, "").split(/[^\p{L}\p{N}-]+/u).filter(Boolean).map((w) => w.toLowerCase()));
// Préfixes que le document écrit avec trait d'union en milieu de ligne (« éco-organismes »,
// « méga-bassines », « anti-trust »…) : même graphie en fin de ligne.
const prefixes = new Set([...words].filter((w) => /^[\p{L}]+-[\p{L}]{2,}/u.test(w)).map((w) => w.split("-")[0]));
// Composés sans autre occurrence dans le document, graphie usuelle avec trait d'union.
const HYPHENATED = new Set(["part-pairing", "pollueur-payeur", "aide-soignant", "pseudo-accords", "contre-pouvoirs", "grand-parent", "indo-pacifique", "extra-atmosphérique", "ouest-africaine", "pro-business", "musculo-squelettiques"]);
const SOLID = new Set(["bientraitance"]); // « bien-être » ne vaut pas pour « bientraitance »
const hyphenChoices = [];
const join = (lines) =>
  norm(
    lines.reduce((acc, l) => {
      const m = acc.match(/([\p{L}\p{N}]+)-$/u);
      const n = l.match(/^[\p{L}\p{N}]+/u);
      if (!acc || !m || !n) return acc ? `${acc} ${l}` : l;
      const hy = `${m[1]}-${n[0]}`.toLowerCase();
      const solid = `${m[1]}${n[0]}`.toLowerCase();
      const frag = m[1].toLowerCase();
      const keep = words.has(hy) || HYPHENATED.has(hy) ? true : words.has(solid) || SOLID.has(solid) ? false : prefixes.has(frag) || /^\p{Lu}/u.test(n[0]);
      if (!words.has(hy) && !words.has(solid) && !HYPHENATED.has(hy)) hyphenChoices.push(keep ? hy : solid);
      return keep ? acc + l : acc.slice(0, -1) + l;
    }, ""),
  );

// 2. Sommaire (pages 11-12) : parties en chiffres romains, chapitres numérotés 1 à 66.
const tocText = execFileSync(bin, ["-enc", "UTF-8", "-layout", "-f", "11", "-l", "12", FILE.pathname, "-"], { encoding: "utf8" });
const tocLines = tocText.split("\n").map(norm).filter(Boolean);
const parts = [];
for (let i = 0; i < tocLines.length; i++) {
  const l = tocLines[i];
  let m;
  if ((m = l.match(/^([IVX]+)\. (.+)$/))) {
    parts.push({ roman: m[1], title: m[2], chapters: [] });
  } else if ((m = l.match(/^(\d+) (.+?) (\d+)$/)) && parts.length) {
    parts.at(-1).chapters.push({ title: m[2], page: +m[3] });
  } else if ((m = l.match(/^(\d+) (.+)$/)) && parts.length && /^(.+?) (\d+)$/.test(tocLines[i + 1] ?? "")) {
    // titre sur deux lignes (chapitre 43)
    const [, rest, page] = tocLines[++i].match(/^(.+?) (\d+)$/);
    parts.at(-1).chapters.push({ title: `${m[2]} ${rest}`, page: +page });
  }
}
// Numérotation séquentielle : le sommaire numérote deux chapitres « 45 » (coquille ; le second est le 46).
const chapters = parts.flatMap((p) => p.chapters);
chapters.forEach((c, i) => (c.number = i + 1));
if (parts.length !== 8 || chapters.length !== 66) throw new Error(`sommaire inattendu : ${parts.length} parties, ${chapters.length} chapitres`);

// 3. Pages de chaque chapitre : de sa page d'ouverture à la page précédant le chapitre suivant
// (ou l'ouverture de la partie suivante). Page d'ouverture = texte d'introduction ;
// pages suivantes = mesures numérotées, sous un titre courant « N. Titre du chapitre ».
// Pages d'ouverture de partie (« PARTIE I. »…), suivies de leur texte d'introduction.
const partPages = pages.flatMap((t, i) => (/^\s*PARTIE\b/.test(t) ? [i + 1] : []));
if (partPages.length !== parts.length) throw new Error(`${partPages.length} pages « PARTIE » pour ${parts.length} parties`);
const partStart = (p) => partPages[parts.indexOf(p)];
const lastPage = pages.findLastIndex((t) => /^\s*\d+\.\s/m.test(t)) + 1; // la dernière page est la 4e de couverture
const out = [];
for (const [pi, p] of parts.entries()) {
  const part = { id: `p${pi + 1}`, number: pi + 1, title: p.title, url: `${PDF}#page=${partStart(p)}`, intro: [], chapters: [] };
  const nextPart = parts[pi + 1];
  for (const [ci, c] of p.chapters.entries()) {
    const end = (p.chapters[ci + 1]?.page ?? (nextPart ? partStart(nextPart) : lastPage + 1)) - 1;
    const cId = `${part.id}c${c.number}`;
    const section = { id: `${cId}s1`, title: c.title, url: `${PDF}#page=${c.page}`, intro: [], measures: [] };
    // Page d'ouverture : numéro et titre (coupé librement sur plusieurs lignes),
    // texte d'introduction (paragraphes séparés par une ligne vide ; il peut
    // déborder sur la page suivante), puis les premières mesures. Pages suivantes : titre courant « N. Titre », mesures
    // numérotées « 1. », « 2. »… (une mesure peut se poursuivre sur la colonne
    // ou la page suivante), folio.
    const key = (w) => w.toLowerCase().replace(/[’']/g, "'");
    const want = [String(c.number), ...norm(c.title).split(" ")].map(key);
    const header = key(norm(`${c.number}. ${c.title}`));
    const intro = [];
    let block = [];
    let cur = null;
    for (let pg = c.page; pg <= end; pg++) {
      const lines = pages[pg - 1].split("\n");
      let first = true;
      for (const raw of lines) {
        let words = norm(raw).split(" ").filter(Boolean);
        while (pg === c.page && want.length && words.length) {
          const i = want.indexOf(key(words[0]));
          if (i === -1) throw new Error(`chapitre ${c.number} : titre introuvable p. ${c.page} (« ${raw} »)`);
          want.splice(i, 1);
          words.shift();
        }
        const l = words.join(" ");
        if (!l) {
          // fin de paragraphe, sauf phrase coupée par un changement de page
          if (!cur && block.length && /[.!?…»:]$/.test(block.at(-1))) intro.push(join(block)), (block = []);
          continue;
        }
        if (first && pg > c.page) {
          // titre courant (parfois libellé autrement que dans le sommaire, ex. chapitre 46)
          if (!l.startsWith(`${c.number}. `)) throw new Error(`chapitre ${c.number} p. ${pg} : titre courant attendu (« ${l} »)`);
          first = false;
          continue;
        }
        first = false;
        if (/^\d+$/.test(l) && +l === pg) continue; // folio
        // Les cadres de texte ne sont pas toujours dans l'ordre de lecture : toute ligne
        // « N. » ouvre une mesure, les mesures sont triées par numéro ensuite.
        const m = l.match(/^(\d{1,2})\.(?:\s+(.*))?$/);
        if (m && +m[1] <= 30) {
          if (block.length) intro.push(join(block)), (block = []);
          cur = { n: +m[1], page: pg, lines: m[2] ? [m[2]] : [] };
          section.measures.push(cur);
        } else if (cur) cur.lines.push(l);
        else block.push(l);
      }
    }
    if (block.length) intro.push(join(block));
    section.measures.sort((a, b) => a.n - b.n);
    if (process.env.DEBUG) for (const [i, m] of section.measures.entries()) if (section.measures[i + 1]?.n === m.n) console.log("double", c.number, m.n, m.page, join(m.lines).slice(0, 80), "/", join(section.measures[i + 1].lines).slice(0, 80));
    // Identifiant = numéro d'origine (« proposition 20-5 » → p3c20s1m5) ; un numéro
    // présent deux fois dans le PDF (chapitre 57, « 4. ») reçoit le suffixe « b ».
    section.measures = section.measures.map((m, i, all) => ({
      id: `${section.id}m${m.n}${all[i - 1]?.n === m.n ? "b" : ""}`,
      key: false,
      text: join(m.lines),
      url: `${PDF}#page=${m.page}`,
    }));
    section.intro = [];
    part.chapters.push({ id: cId, number: c.number, title: c.title, url: section.url, intro, sections: [section] });
  }
  out.push(part);
}

if (process.env.DEBUG) console.log("césures sans attestation :", [...new Set(hyphenChoices)].join(", "));
await save(
  ID,
  {
    title: "Pour une prospérité écologique — le nouveau programme des Écologistes",
    source: PDF,
    retrievedAt: new Date().toISOString().slice(0, 10),
    parts: out,
  },
  { minMeasures: 500 },
);
