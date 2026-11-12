// Import du PDF Tondelier (scripts/sources/tondelier.mjs) : structure et texte.
// Ne tourne que si data/tondelier.json a été produit (PDF en cache, cf. la source).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const file = new URL("../data/tondelier.json", import.meta.url);
const data = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
const measures = data ? data.parts.flatMap((p: any) => p.chapters.flatMap((c: any) => c.sections.flatMap((s: any) => s.measures))) : [];
const byId = new Map(measures.map((m: any) => [m.id, m.text]));

describe.skipIf(!data)("programme Tondelier (PDF)", () => {
  it("8 parties, 66 chapitres, 551 mesures numérotées", () => {
    expect(data.stats).toMatchObject({ parts: 8, chapters: 66, sections: 66, measures: 551 });
  });
  it("identifiants = numérotation d'origine (dont les anomalies du PDF)", () => {
    expect(byId.has("p1c4s1m6")).toBe(false); // le chapitre 4 passe de 5 à 7
    expect(byId.has("p7c57s1m4b")).toBe(true); // deux mesures « 4. » au chapitre 57
    expect(byId.get("p3c20s1m5")).toMatch(/^Soutenir l’électrification des procédés/); // « proposition 20-5 »
  });
  it("aucun titre courant, folio ni page de partie dans les mesures", () => {
    for (const t of measures.map((m: any) => m.text)) {
      expect(t).not.toMatch(/\b\d{1,2}\. (Atteindre|Accomplir) l'égalité|PARTIE [IVX]|lesecologistes\.fr/);
      expect(t.length).toBeGreaterThan(50);
    }
  });
  it("mesures reconstituées malgré l'ordre des cadres du PDF", () => {
    expect(byId.get("p4c24s1m3")).toBe(
      "Mieux encadrer la qualité des formations de l’enseignement supérieur privé à but lucratif en créant une autorité publique de contrôle des holdings de l’enseignement privé. Diminuer et conditionner les subventions d’apprentissage à des critères d’équité sociale et de transparence pédagogique. Les suspendre en cas de fraudes. Imposer une présence d’administrateurs publics au Conseil d’administration en cas de part supérieure à 20 % de recettes publiques calculées au niveau du groupe.",
    );
  });
  it("césures : traits d'union réels conservés, coupures typographiques soudées", () => {
    const all = measures.map((m: any) => m.text).join(" ");
    expect(all).toContain("Outre-mer");
    expect(all).toContain("Éco-prêt");
    expect(all).toContain("méga-bassines");
    expect(all).not.toMatch(/\bnéces- ?saires\b|\bkilo-métriques\b/);
  });
});
