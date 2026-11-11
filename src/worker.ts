// Cloudflare Worker : serveur MCP seul (/mcp). Pour un site complet, servir
// des fichiers statiques à côté (voir README).
import { handleMcp } from "./core/http.js";

interface Env {
  MCP_LIMITER?: RateLimit;
}

const HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

function secure(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(HEADERS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

const HOME = `Serveur MCP Présidentielle IA : programmes officiels de la présidentielle 2027.
Ajoute l'adresse de ce serveur suivie de /mcp comme connecteur dans ton assistant IA.
Code source : https://github.com/presidentielle-ia/presidentielle-ia
`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
      // Limite par IP. Les clients hébergés (Claude, ChatGPT…) partagent des IP
      // de sortie : la limite est donc large ; la vraie protection anti-flood
      // est une règle WAF en amont (voir SECURITY.md).
      if (env.MCP_LIMITER && request.method === "POST") {
        const ip = request.headers.get("cf-connecting-ip") ?? "inconnue";
        const { success } = await env.MCP_LIMITER.limit({ key: ip });
        if (!success) {
          return secure(
            new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Trop de requêtes, réessaie dans une minute." }, id: null }), {
              status: 429,
              headers: { "content-type": "application/json", "retry-after": "60", "access-control-allow-origin": "*" },
            }),
          );
        }
      }
      return secure(await handleMcp(request));
    }
    if (url.pathname === "/health") return secure(new Response("ok", { headers: { "cache-control": "no-store" } }));
    if (url.pathname === "/") return secure(new Response(HOME, { headers: { "content-type": "text/plain; charset=utf-8" } }));
    return secure(new Response("Not found", { status: 404 }));
  },
} satisfies ExportedHandler<Env>;
