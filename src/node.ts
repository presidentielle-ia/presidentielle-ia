// Auto-hébergement Node : `node dist/node.js` (PORT=8787 par défaut).
// Sert le endpoint MCP sur /mcp, et un site statique si SITE_DIR est défini.
import { serve } from "@hono/node-server";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { handleMcp } from "./core/http.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";
const SITE = process.env.SITE_DIR;
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

async function staticFile(pathname: string): Promise<Response> {
  if (!SITE) return new Response("Serveur MCP Présidentielle IA : ajoute /mcp à cette adresse dans ton assistant IA.\n");
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  let rel = normalize(decoded).replace(/^([/\\])+/, "");
  if (rel.includes("..")) return new Response("Not found", { status: 404 });
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  for (const candidate of [rel, `${rel}.html`, join(rel, "index.html")]) {
    try {
      const body = await readFile(join(SITE, candidate));
      return new Response(body, { headers: { "content-type": TYPES[extname(candidate)] ?? "application/octet-stream" } });
    } catch {}
  }
  return new Response("Not found", { status: 404 });
}

serve({
  hostname: HOST,
  port: PORT,
  fetch: async (req) => {
    const { pathname } = new URL(req.url);
    if (pathname === "/mcp" || pathname === "/mcp/") return handleMcp(req);
    if (pathname === "/health") return new Response("ok");
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    return staticFile(pathname);
  },
});
console.log(`presidentielle-ia → http://${HOST}:${PORT}/mcp`);
