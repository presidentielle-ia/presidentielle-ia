// Source « retailleau » : projet de Bruno Retailleau (LR), via l'API JSON
// publique du site de campagne avecretailleau.fr → data/retailleau.json.
// Licence affichée : « partagés à des fins non commerciales avec mention de la source ».
import { dataExists, fetcher, flags, plain, save } from "./common.mjs";

const ID = "retailleau";
const BASE = "https://www.avecretailleau.fr";
if (flags.ifMissing && dataExists(ID)) process.exit(0);

const get = fetcher(ID);
const api = JSON.parse(await get(`${BASE}/api/programme`));

const themes = [...api.themes].sort((a, b) => a.ref.localeCompare(b.ref));
const chapters = themes.map((t, i) => {
  const cId = `p1c${i + 1}`;
  const measures = api.mesures
    .filter((m) => m.theme === t.ref)
    .sort((a, b) => a.ref.localeCompare(b.ref))
    .map((m, k) => ({
      id: `${cId}s1m${k + 1}`,
      key: false,
      text: `${plain(m.titre)} : ${plain(m.engagement)}`,
      url: `${BASE}/projet/mesure/${m.slug}`,
    }));
  return {
    id: cId,
    number: i + 1,
    title: plain(t.nom),
    url: `${BASE}/projet/theme/${t.slug}`,
    intro: [],
    sections: [{ id: `${cId}s1`, title: plain(t.nom), url: `${BASE}/projet/theme/${t.slug}`, intro: [plain(t.accroche)].filter(Boolean), measures }],
  };
});

// Dates officielles fournies par l'API : création et dernière modification.
const isoDates = (key) => [...api.mesures, ...api.themes].map((x) => x[key]).filter(Boolean).sort();
const created = isoDates("creeIso");
const updated = isoDates("majIso");

await save(
  ID,
  {
    title: "Projet de Bruno Retailleau pour 2027",
    publishedAt: created[0]?.slice(0, 10) ?? null,
    sourceUpdatedAt: updated.at(-1)?.slice(0, 10) ?? null,
    source: `${BASE}/projet`,
    retrievedAt: new Date().toISOString().slice(0, 10),
    parts: [
      {
        id: "intro",
        number: 0,
        title: "Les trois ambitions",
        url: `${BASE}/projet`,
        intro: [
          ...api.ambitions.map((a) => `${plain(a.nom)} : ${plain(a.accroche)}`),
          `Thèmes encore en construction sur le site : ${api.themesEnConstruction.map((t) => plain(t.nom)).join(", ")}.`,
        ],
        chapters: [],
      },
      { id: "p1", number: 1, title: "Le projet, thème par thème", url: `${BASE}/projet`, intro: [], chapters },
    ],
  },
  { minMeasures: 100 },
);
