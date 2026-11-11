// Mode local (stdio) pour Claude Desktop, Cursor, etc. sans serveur distant.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./core/server.js";

await createServer().connect(new StdioServerTransport());
