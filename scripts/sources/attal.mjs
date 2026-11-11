// Source « attal » : mesures de Gabriel Attal (Renaissance), via les flux RSS
// officiels de attalpresident.fr (texte intégral) → data/attal.json.
// Programme en cours de publication : « chantiers capitaux » + mesures annoncées.
import { parse } from "node-html-parser";
import { dataExists, fetcher, flags, plain, save } from "./common.mjs";

const ID = "attal";
const BASE = "https://attalpresident.fr";
if (flags.ifMissing && dataExists(ID)) process.exit(0);
const get = fetcher(ID);

// RSS analysé par expressions régulières : un parseur HTML traiterait <link> comme une balise vide.
const decode = (s) => plain(parse(s.replace(/^<!\[CDATA\[|\]\]>$/g, "")).textContent);
const items = (xml) =>
  [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const field = (name) => it.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? "";
    return {
      title: decode(field("title")),
      link: decode(field("link")),
      description: decode(field("description")),
      html: field("content:encoded").replace(/^<!\[CDATA\[|\]\]>$/g, ""),
      categories: [...it.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((m) => decode(m[1])),
    };
  });

const priorites = items(await get(`${BASE}/flux/priorites.xml`));
const mesures = items(await get(`${BASE}/flux/mesures.xml`));

// Regroupement par thématique (première catégorie de chaque mesure), par ordre alphabétique.
const byTheme = new Map();
for (const m of mesures) {
  const theme = m.categories[0] ?? "Autres";
  if (!byTheme.has(theme)) byTheme.set(theme, []);
  byTheme.get(theme).push(m);
}
const chapters = [...byTheme.entries()]
  .sort(([a], [b]) => a.localeCompare(b, "fr"))
  .map(([theme, list], i) => {
    const cId = `p1c${i + 1}`;
    return {
      id: cId,
      number: i + 1,
      title: theme,
      url: `${BASE}/programme`,
      intro: [],
      sections: [
        {
          id: `${cId}s1`,
          title: theme,
          url: `${BASE}/programme`,
          intro: [],
          measures: list
            .sort((a, b) => a.title.localeCompare(b.title, "fr"))
            .map((m, k) => ({ id: `${cId}s1m${k + 1}`, key: false, text: `${m.title} : ${m.description}`, url: m.link })),
        },
      ],
    };
  });

await save(
  ID,
  {
    title: "Mesures de Gabriel Attal pour 2027",
    source: `${BASE}/programme`,
    retrievedAt: new Date().toISOString().slice(0, 10),
    parts: [
      {
        id: "intro",
        number: 0,
        title: "Les chantiers capitaux",
        url: `${BASE}/programme`,
        intro: priorites.map((p) => `${p.title} : ${p.description} (${p.link})`),
        chapters: [],
      },
      { id: "p1", number: 1, title: "Les mesures, par thématique", url: `${BASE}/programme`, intro: [], chapters },
    ],
  },
  { minMeasures: 50 },
);
