import express, { type Express } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { config } from "./config.js";
import { authenticate } from "./middleware/auth.js";
import { validateHost } from "./middleware/host.js";
import { registerAllTools } from "./tools/index.js";

// Active SSE sessions for standard MCP SSE transport (/sse + /messages)
const sseSessions = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

// Active Streamable HTTP transports for graceful shutdown
const activeStreamableTransports = new Set<StreamableHTTPServerTransport>();

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "notion-terminal-files",
    version: "1.0.0",
  });

  registerAllTools(server);
  return server;
}

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  // Keep-alive settings to prevent hanging connections
  app.use((_req, res, next) => {
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Keep-Alive", "timeout=60, max=100");
    next();
  });

  // Root endpoint info
  app.get("/", (_req, res) => {
    res.json({
      name: "Notion Terminal MCP Server",
      status: "running",
      protocol: "Model Context Protocol (Streamable HTTP + SSE)",
      endpoints: {
        mcp: "/mcp",
        sse: "/sse",
        messages: "/messages",
        health: "/health",
      },
      auth_required: true,
      auth_type: "Bearer Token",
      active_sse_sessions: sseSessions.size,
      active_streamable_connections: activeStreamableTransports.size,
    });
  });

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "notion-terminal-files",
      full_access: config.fullAccess,
      active_sse_sessions: sseSessions.size,
      active_streamable_connections: activeStreamableTransports.size,
    });
  });

  // 1. Streamable HTTP MCP endpoint (/mcp)
  // Uses stateless mode (sessionIdGenerator: undefined) so clients can connect
  // directly without strict session validation errors (HTTP 400).
  app.all("/mcp", validateHost, authenticate, async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    activeStreamableTransports.add(transport);

    res.on("close", () => {
      activeStreamableTransports.delete(transport);
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      activeStreamableTransports.delete(transport);
      console.error(new Date().toISOString(), "MCP /mcp Request Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal MCP server error" });
      }
    }
  });

  // 2. Standard MCP SSE transport endpoint (/sse)
  // For clients (like older Notion integrations or Cursor) that use the standard
  // SSE handshake: GET /sse -> sends endpoint event -> client POSTs to /messages?sessionId=...
  app.get("/sse", validateHost, authenticate, async (req, res) => {
    const server = createMcpServer();
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;

    sseSessions.set(sessionId, { transport, server });
    console.log(`[SSE] Client connected: session ${sessionId} (active: ${sseSessions.size})`);

    res.on("close", () => {
      sseSessions.delete(sessionId);
      void transport.close();
      void server.close();
      console.log(`[SSE] Client disconnected: session ${sessionId} (active: ${sseSessions.size})`);
    });

    try {
      await server.connect(transport);
    } catch (error) {
      sseSessions.delete(sessionId);
      console.error(new Date().toISOString(), "SSE Handshake Error:", error);
    }
  });

  // Message receiver for standard SSE transport
  app.post("/messages", validateHost, authenticate, async (req, res) => {
    const sessionId = (req.query.sessionId as string | undefined)?.trim();
    if (!sessionId || !sseSessions.has(sessionId)) {
      res.status(404).json({ error: "SSE session not found or expired" });
      return;
    }

    const session = sseSessions.get(sessionId)!;
    try {
      await session.transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error(new Date().toISOString(), "SSE Message Handling Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal MCP server error" });
      }
    }
  });

  return app;
}

// Export for graceful shutdown
export function getActiveSessions(): Map<string, { close: () => Promise<void> }> {
  const result = new Map<string, { close: () => Promise<void> }>();
  for (const [id, s] of sseSessions.entries()) {
    result.set(`sse-${id}`, s.transport);
  }
  let index = 0;
  for (const t of activeStreamableTransports) {
    result.set(`streamable-${index++}`, t);
  }
  return result;
}
