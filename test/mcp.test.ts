import { describe, expect, it } from "vitest";
import { handleMcp } from "../src/core/http.js";
import { INTEGRATED, PROGRAMMES, measuresById, programmesById } from "../src/core/data.js";

let nextId = 1;
async function rpc(method: string, params: unknown = {}) {
  const res = await handleMcp(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as any;
}
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await rpc("tools/call", { name, arguments: args })).result;
const txt = (r: any) => r.content[0].text as string;
// Les tests sur le texte réel ne tournent que si `pnpm scrape` a récupéré LFI.
const LFI = programmesById.has("lfi");

describe("données", () => {
  it.skipIf(!LFI)("le programme LFI contient les 1 069 mesures annoncées", () => {
    expect(programmesById.get("lfi")!.stats).toMatchObject({ parts: 6, chapters: 23, sections: 111, measures: 1069, keyMeasures: 107 });
  });
  it("les candidats sont triés par nom de famille", () => {
    const names = PROGRAMMES.map((p) => p.candidat.split(" ").at(-1)!);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "fr")));
  });
  it("chaque mesure a un texte, un identifiant global et un lien", () => {
    for (const [gid, r] of measuresById) {
      expect(gid.startsWith(`${r.programme.id}:`)).toBe(true);
      expect(r.measure.text.length).toBeGreaterThan(3);
      expect(r.section.url.startsWith("https://")).toBe(true);
    }
  });
});

describe("protocole MCP", () => {
  it("initialise et expose des instructions de neutralité", async () => {
    const r = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
    expect(r.result.serverInfo.name).toBe("presidentielle-ia");
    expect(r.result.instructions).toContain("Neutralité");
    expect(r.result.instructions).toContain("Camille Attente");
  });
  it("liste les outils, tous en lecture seule", async () => {
    const { tools } = (await rpc("tools/list")).result;
    expect(tools.map((t: any) => t.name).sort()).toEqual(
      ["comparer", "fetch", "lire_introduction", "lire_mesures", "lire_section", "lister_programmes", "mesures_cles", "rechercher", "search", "suivi_programmes", "table_des_matieres"],
    );
    for (const t of tools) expect(t.annotations.readOnlyHint).toBe(true);
  });
  it("refuse GET, et les corps trop gros", async () => {
    expect((await handleMcp(new Request("http://localhost/mcp"))).status).toBe(405);
    const big = await handleMcp(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(1e6) },
        body: "x".repeat(1e6),
      }),
    );
    expect(big.status).toBe(413);
  });
});

describe("outils", () => {
  it("lister_programmes montre les statuts", async () => {
    const t = txt(await call("lister_programmes"));
    expect(t).toContain("Alex Exemple (Parti de démonstration)** — disponible");
    expect(t).toContain("Camille Attente (Mouvement en attente)** — pas encore publié");
    expect(t).toContain("Dominique Publié (Parti publié)** — publié, pas encore intégré");
  });
  it("rechercher couvre tous les programmes, regroupés et plafonnés", async () => {
    const t = txt(await call("rechercher", { requete: "retraite", limite_par_programme: 2 }));
    expect(t).toContain("## Alex Exemple");
    expect(t.match(/^- \[demo:/gm)!.length).toBeLessThanOrEqual(2);
    if (LFI) {
      expect(t.indexOf("## Alex Exemple")).toBeLessThan(t.indexOf("## Jean-Luc Mélenchon"));
      expect(t.match(/^- \[lfi:/gm)!.length).toBeLessThanOrEqual(2);
    }
    expect(t).toContain("pas encore disponibles");
  });
  it.skipIf(!LFI)("rechercher trouve la retraite à 60 ans en tête pour LFI", async () => {
    const t = txt(await call("rechercher", { requete: "retraite à 60 ans", programmes: ["lfi"], limite_par_programme: 3 }));
    expect(t.split("\n").find((l) => l.startsWith("- [lfi:"))).toContain("retraite à 60 ans");
  });
  it.skipIf(!LFI)("rechercher ignore accents et pluriels", async () => {
    expect(txt(await call("rechercher", { requete: "hopitaux", programmes: ["lfi"] }))).toMatch(/hôpita/i);
  });
  it("rechercher rejette une requête démesurée ou un programme inconnu", async () => {
    expect((await call("rechercher", { requete: "a".repeat(500) })).isError).toBe(true);
    expect((await call("rechercher", { requete: "smic", programmes: ["zzz"] })).isError).toBe(true);
  });
  it("comparer met chaque programme côte à côte", async () => {
    const t = txt(await call("comparer", { sujet: "SMIC" }));
    expect(t).toContain("[demo:p1c1s1m2]");
    if (LFI) expect(t).toContain("[lfi:p2c2s3k1]");
  });
  it.skipIf(!LFI)("lire_section renvoie le texte intégral", async () => {
    const t = txt(await call("lire_section", { id: "lfi:p1c1s1" }));
    expect(t).toContain("règle verte");
    expect(t).toContain("[lfi:p1c1s1k1]");
    expect(txt(await call("lire_section", { id: "lfi:p1c1" }))).toContain("Les Outre-mer");
    expect((await call("lire_section", { id: "lfi:p9c9s9" })).isError).toBe(true);
  });
  it.skipIf(!LFI)("lire_mesures rattache une sous-mesure à son chapeau", async () => {
    const sub = [...measuresById.values()].find((r) => r.measure.parent)!;
    const t = txt(await call("lire_mesures", { ids: [sub.gid, "zzz"] }));
    expect(t).toContain("sous-mesure de");
    expect(t).toContain("[zzz] identifiant inconnu");
  });
  it("mesures_cles et table_des_matieres par programme", async () => {
    if (LFI) {
      const t = txt(await call("mesures_cles", { programme: "lfi" }));
      expect(t.split("\n").filter((l) => l.startsWith("- [")).length).toBe(107);
    }
    expect(txt(await call("table_des_matieres", { programme: "demo" }))).toContain("Retraites (demo:p1c1s1");
  });
  it.skipIf(!LFI)("lire_introduction", async () => {
    expect(txt(await call("lire_introduction", { programme: "lfi", partie: "intro" }))).toContain("cinquième édition");
  });
  it("suivi_programmes : chronologie datée, plus récent d'abord, filtre par date", async () => {
    const t = txt(await call("suivi_programmes", { programmes: ["demo"] }));
    expect(t).toContain("8 novembre 2026");
    expect(t).toContain("mise à jour détectée : +1");
    expect(t.indexOf("8 novembre 2026")).toBeLessThan(t.indexOf("1er octobre 2026"));
    const recent = txt(await call("suivi_programmes", { programmes: ["demo"], depuis: "2026-11-01" }));
    expect(recent).not.toContain("**1er octobre 2026**");
    expect(recent).toContain("5 novembre 2026");
  });
  it("les mesures datées affichent leur date de publication", async () => {
    expect(txt(await call("lire_mesures", { ids: ["demo:p1c1s1m2"] }))).toContain("publiée le 5 novembre 2026");
  });
  it("search/fetch respectent le format ChatGPT et couvrent plusieurs programmes", async () => {
    const { results } = JSON.parse(txt(await call("search", { query: "retraite" })));
    expect(new Set(results.map((r: any) => r.id.split(":")[0]))).toEqual(new Set(INTEGRATED.map((p) => p.id)));
    const doc = JSON.parse(txt(await call("fetch", { id: results[0].id })));
    expect(doc).toMatchObject({ id: results[0].id, text: expect.any(String), url: expect.any(String) });
  });
});
