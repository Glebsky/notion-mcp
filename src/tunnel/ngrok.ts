import type NgrokNamespace from "@ngrok/ngrok";
import { config } from "../config.js";

type NgrokType = typeof NgrokNamespace;
let ngrokModule: NgrokType | null = null;
let listener: Awaited<ReturnType<NgrokType["forward"]>> | null = null;
let isShuttingDown = false;
let reconnectAttempt = 0;

async function getNgrok(): Promise<NgrokType> {
  if (!ngrokModule) {
    try {
      const imported = await import("@ngrok/ngrok");
      ngrokModule = ((imported as unknown as { default?: NgrokType }).default ?? imported) as unknown as NgrokType;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load @ngrok/ngrok native module. Ensure that @ngrok/ngrok-win32-x64-msvc is available. Details: ${msg}`);
    }
  }
  return ngrokModule;
}

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;

function reconnectDelay(attempt: number): number {
  const delay = RECONNECT_BASE_MS * Math.pow(2, attempt);
  return Math.min(delay, RECONNECT_MAX_MS);
}

async function connectNgrok(): Promise<string | null> {
  if (listener) {
    try {
      await listener.close();
    } catch {
      // Ignore cleanup error
    }
    listener = null;
  }

  const ngrok = await getNgrok();

  const forwardOptions: Parameters<typeof ngrok.forward>[0] = {
    addr: config.port,
    force_new_session: true,
    // onStatusChange: 'closed' fires when the tunnel drops; 'connected' fires on reconnect
    onStatusChange: (status: string) => {
      if (isShuttingDown) return;
      if (status === "closed") {
        listener = null;
        console.warn(`[Ngrok] Tunnel status: closed. Reconnecting...`);
        void scheduleReconnect();
      } else if (status === "connected") {
        console.log(`[Ngrok] Tunnel status: reconnected.`);
        reconnectAttempt = 0;
      }
    },
  };

  if (config.ngrok.authtoken) {
    forwardOptions.authtoken = config.ngrok.authtoken;
  } else {
    forwardOptions.authtoken_from_env = true;
  }

  if (config.ngrok.domain) {
    forwardOptions.domain = config.ngrok.domain;
  }

  listener = await ngrok.forward(forwardOptions);

  const tunnelUrl = listener.url();

  if (tunnelUrl) {
    try {
      const parsedHost = new URL(tunnelUrl).host.toLowerCase();
      config.allowedHosts.add(parsedHost);
    } catch {
      // Ignore URL parse errors
    }

    printNotionBanner(tunnelUrl);
  }

  return tunnelUrl;
}

async function scheduleReconnect(): Promise<void> {
  if (isShuttingDown) return;

  const delay = reconnectDelay(reconnectAttempt);
  reconnectAttempt++;

  console.log(`[Ngrok] Reconnect attempt #${reconnectAttempt} in ${delay / 1000}s...`);
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (isShuttingDown) return;

  try {
    await connectNgrok();
    console.log(`[Ngrok] Tunnel reconnected successfully (attempt #${reconnectAttempt}).`);
    reconnectAttempt = 0; // Reset backoff on success
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("ERR_NGROK_334") || msg.includes("already online")) {
      console.warn(`[Ngrok] Previous tunnel session is still releasing in ngrok cloud. Waiting to reconnect...`);
    } else {
      console.error(`[Ngrok] Reconnect attempt #${reconnectAttempt} failed: ${msg}`);
    }
    void scheduleReconnect();
  }
}

export async function startNgrokTunnel(): Promise<string | null> {
  if (!config.ngrok.enabled) {
    return null;
  }

  isShuttingDown = false;
  reconnectAttempt = 0;

  try {
    console.log("Starting ngrok tunnel...");
    return await connectNgrok();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Ngrok] Failed to start tunnel:", msg);
    // Schedule reconnect — don't give up on first failure
    void scheduleReconnect();
    return null;
  }
}

export async function stopNgrokTunnel(): Promise<void> {
  isShuttingDown = true;

  if (listener) {
    try {
      await listener.close();
    } catch {
      // Ignore close errors on exit
    }
    listener = null;
  }

  if (ngrokModule) {
    try {
      await ngrokModule.disconnect();
      await ngrokModule.kill();
    } catch {
      // Ignore disconnect errors on exit
    }
  }
}

function printNotionBanner(tunnelUrl: string): void {
  const notionUrl = `${tunnelUrl}/mcp`;
  console.log("");
  console.log("============================================================");
  console.log("             NOTION MCP AGENT CONNECTION READY             ");
  console.log("============================================================");
  console.log(`URL to paste into Notion:  ${notionUrl}`);
  console.log("");
  console.log("Authentication Header:");
  console.log("  Header Name:   Authorization");
  console.log(`  Header Value:  Bearer ${config.apiKey}`);
  console.log("============================================================");
  console.log("Keep this process running. Press Ctrl+C to stop.\n");
}
