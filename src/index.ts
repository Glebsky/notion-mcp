import { config } from "./config.js";
import { createApp, getActiveSessions } from "./server.js";
import { startNgrokTunnel, stopNgrokTunnel } from "./tunnel/ngrok.js";

const app = createApp();

const httpServer = app.listen(config.port, config.host, async () => {
  console.log(`Notion Terminal MCP listening on http://${config.host}:${config.port}/mcp`);
  console.log(
    `Filesystem mode: ${config.fullAccess ? "FULL HOST ACCESS (UNRESTRICTED)" : `restricted to ${config.filesRoot}`}`,
  );

  await startNgrokTunnel();
});

// Set server-level keepalive timeout to match transport headers
httpServer.keepAliveTimeout = 65_000;
httpServer.headersTimeout = 70_000;

let isShuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  // Close all active MCP sessions
  const sessions = getActiveSessions();
  if (sessions.size > 0) {
    console.log(`Closing ${sessions.size} active MCP session(s)...`);
    await Promise.allSettled([...sessions.values()].map((t) => t.close()));
    sessions.clear();
  }

  await stopNgrokTunnel();

  httpServer.close(() => {
    console.log("MCP HTTP server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.warn("Forced shutdown after timeout.");
    process.exit(0);
  }, 3000).unref();
}

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

process.on("message", (msg: unknown) => {
  if (typeof msg === "object" && msg !== null && (msg as { type?: string }).type === "shutdown") {
    void gracefulShutdown("IPC");
  }
});

