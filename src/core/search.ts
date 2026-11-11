import MiniSearch, { type SearchOptions } from "minisearch";
import { measuresById, type MeasureRef } from "./data.js";

// Normalisation française : minuscules, sans accents, élisions retirées,
// pluriels simples ramenés au singulier.
export function normalize(term: string): string | null {
  const t = term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(?:l|d|j|m|n|s|t|c|qu)['’]/, "");
  if (t.length < 2 || STOPWORDS.has(t)) return null;
  return t.length > 4 ? t.replace(/(?:aux|eaux)$/, "al").replace(/[sx]$/, "") : t;
}

const STOPWORDS = new Set(
  ("le la les un une des du de et en a au aux ou par pour sur dans avec sans ce ces cet cette " +
    "est sont qui que quoi dont il elle ils elles on nous vous leur leurs son sa ses se ne pas plus " +
    "tout tous toute toutes y l d qu c s n").split(" "),
);

interface Doc {
  id: string;
  text: string;
  section: string;
  chapter: string;
  part: string;
  programme: string;
  key: boolean;
}

const docs: Doc[] = [];
for (const [id, r] of measuresById) {
  // Une sous-mesure hérite du chapeau de sa mesure parente pour le contexte.
  const parent = r.measure.parent ? measuresById.get(`${r.programme.id}:${r.measure.parent}`)?.measure.text : undefined;
  docs.push({
    id,
    text: parent ? `${parent} ${r.measure.text}` : r.measure.text,
    section: `${r.section.title} ${r.section.intro.join(" ")}`,
    chapter: r.chapter.title,
    part: r.part.title,
    programme: r.programme.id,
    key: r.measure.key,
  });
}

const index = new MiniSearch<Doc>({
  fields: ["text", "section", "chapter", "part"],
  storeFields: ["programme", "key"],
  processTerm: normalize,
  searchOptions: {
    boost: { text: 3, section: 1, chapter: 0.5, part: 0.3 },
    prefix: (term) => term.length >= 4,
    fuzzy: (term) => (term.length >= 6 ? 0.15 : false),
  },
});
index.addAll(docs);

export interface SearchOpts {
  programmes?: string[];
  keyOnly?: boolean;
  /** nombre maximum de résultats par programme (équité entre programmes) */
  perProgramme: number;
}

/** Résultats regroupés par programme ; chaque programme a le même plafond. */
export function search(query: string, opts: SearchOpts): Map<string, MeasureRef[]> {
  const common: SearchOptions = {
    filter: (r) =>
      (!opts.programmes?.length || opts.programmes.includes(r.programme)) && (!opts.keyOnly || r.key === true),
    boostDocument: (_id, _t, stored) => (stored?.key ? 1.3 : 1),
  };
  // D'abord les mesures qui contiennent tous les termes, puis les autres.
  const all = index.search(query, { ...common, combineWith: "AND" });
  const seen = new Set(all.map((r) => r.id));
  for (const r of index.search(query, { ...common, combineWith: "OR" })) if (!seen.has(r.id)) all.push(r);

  const grouped = new Map<string, MeasureRef[]>();
  for (const r of all) {
    const ref = measuresById.get(r.id as string)!;
    const list = grouped.get(ref.programme.id) ?? [];
    if (list.length < opts.perProgramme) list.push(ref);
    grouped.set(ref.programme.id, list);
  }
  return grouped;
}
