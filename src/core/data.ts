import bundle from "../../data/bundle.json" with { type: "json" };

export interface Measure {
  id: string;
  key: boolean;
  parent?: string;
  text: string;
  /** page dédiée à la mesure sur le site officiel, si elle existe */
  url?: string;
}
export interface Section {
  id: string;
  title: string;
  url: string;
  intro: string[];
  measures: Measure[];
}
export interface Chapter {
  id: string;
  number: number;
  title: string;
  url: string;
  intro: string[];
  sections: Section[];
}
export interface Part {
  id: string;
  number: number;
  title: string;
  url: string;
  intro: string[];
  chapters: Chapter[];
}
export type Status = "integre" | "publie" | "attendu";
export interface Programme {
  id: string;
  candidat: string;
  /** nom de famille pour le tri, si le dernier mot ne suffit pas */
  nom?: string;
  parti: string;
  titre?: string;
  statut: Status;
  etendue?: "complet" | "partiel";
  source?: string;
  publieLe?: string;
  licence?: string;
  note?: string;
  retrievedAt?: string;
  stats?: { parts: number; chapters: number; sections: number; measures: number; keyMeasures: number };
  parts?: Part[];
}
export interface Integrated extends Programme {
  statut: "integre";
  titre: string;
  source: string;
  retrievedAt: string;
  stats: NonNullable<Programme["stats"]>;
  parts: Part[];
}

/** Mesure enrichie de son contexte. Les identifiants sont globaux : « lfi:p3c1s7k1 ». */
export interface MeasureRef {
  gid: string;
  programme: Integrated;
  measure: Measure;
  section: Section;
  chapter: Chapter;
  part: Part;
}
export interface SectionRef {
  gid: string;
  programme: Integrated;
  section: Section;
  chapter: Chapter;
  part: Part;
}

/** Tous les candidats suivis, dans l'ordre alphabétique. */
export const PROGRAMMES = (bundle as { programmes: Programme[] }).programmes;
export const INTEGRATED = PROGRAMMES.filter((p): p is Integrated => p.statut === "integre" && !!p.parts);
export const programmesById = new Map(INTEGRATED.map((p) => [p.id, p]));

export const measuresById = new Map<string, MeasureRef>();
export const sectionsById = new Map<string, SectionRef>();
export const chaptersById = new Map<string, { programme: Integrated; chapter: Chapter; part: Part }>();
export const partsById = new Map<string, { programme: Integrated; part: Part }>();

export const gid = (programmeId: string, localId: string) => `${programmeId}:${localId}`;

for (const programme of INTEGRATED) {
  for (const part of programme.parts) {
    partsById.set(gid(programme.id, part.id), { programme, part });
    for (const chapter of part.chapters) {
      chaptersById.set(gid(programme.id, chapter.id), { programme, chapter, part });
      for (const section of chapter.sections) {
        const sid = gid(programme.id, section.id);
        sectionsById.set(sid, { gid: sid, programme, section, chapter, part });
        for (const measure of section.measures) {
          const mid = gid(programme.id, measure.id);
          measuresById.set(mid, { gid: mid, programme, measure, section, chapter, part });
        }
      }
    }
  }
}

export const label = (p: Programme) => `${p.candidat} (${p.parti})`;

export const path = (r: { part: Part; chapter: Chapter; section?: Section }) =>
  [r.part.title, r.chapter.title, r.section?.title].filter(Boolean).join(" › ");
