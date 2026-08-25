import { config } from "./config.js";
import { createApp } from "./server.js";
import { startNgrokTunnel, stopNgrokTunnel } from "./tunnel/ngrok.js";

const app = createApp();

const server = app.listen(config.port, config.host, async () => {
  console.log(`Notion Terminal MCP listening on http://${config.host}:${config.port}/mcp`);
  console.log(
    `Filesystem mode: ${config.fullAccess ? "FULL HOST ACCESS (UNRESTRICTED)" : `restricted to ${config.filesRoot}`}`,
  );

  await startNgrokTunnel();
});

let isShuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  await stopNgrokTunnel();

  server.close(() => {
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
