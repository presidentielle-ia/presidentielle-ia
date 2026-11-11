import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";

const MAX_BODY = 64 * 1024; // les requêtes MCP légitimes font quelques Ko

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

function withHeaders(res: Response, extra: Record<string, string>): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  h.set("cache-control", "no-store");
  h.set("x-content-type-options", "nosniff");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

const jsonError = (status: number, message: string, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }), {
    status,
    headers: { "content-type": "application/json", ...CORS, ...extra },
  });

/**
 * Point d'entrée MCP « Streamable HTTP » sans état, sur l'API Fetch standard
 * (Cloudflare Workers, Node, Deno, Bun). Données publiques en lecture seule :
 * aucune authentification, aucune session, aucun cookie.
 */
export async function handleMcp(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  // Sans état : pas de flux SSE serveur→client (GET) ni de session à fermer (DELETE).
  if (request.method !== "POST") return jsonError(405, "Méthode non autorisée", { allow: "POST, OPTIONS" });

  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) return jsonError(413, "Requête trop volumineuse");

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY,
  });
  const server = createServer();
  await server.connect(transport);
  try {
    const res = await transport.handleRequest(request);
    return withHeaders(res, CORS);
  } finally {
    // réponse JSON déjà matérialisée : on libère tout de suite
    void server.close();
  }
}
