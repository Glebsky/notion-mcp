import type NgrokNamespace from "@ngrok/ngrok";
import { config } from "../config.js";
import { tunnelStatus, redactTunnelError } from "./status.js";

type NgrokType = typeof NgrokNamespace;
let ngrokModule: NgrokType | null = null;
let listener: Awaited<ReturnType<NgrokType["forward"]>> | null = null;
let isShuttingDown = false;
let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | undefined;
let connecting = false;
let generation = 0;

async function getNgrok(): Promise<NgrokType> {
  if (!ngrokModule) {
    try {
      const imported = await import("@ngrok/ngrok");
      ngrokModule = ((imported as unknown as { default?: NgrokType }).default ?? imported) as unknown as NgrokType;
    } catch (err) {
      const msg = redactTunnelError(err);
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
    connecting = true;
    try {
      await listener.close();
    } catch {
      // Ignore cleanup error
    } finally { connecting = false; }
    listener = null;
  }

  const ngrok = await getNgrok();

  const forwardOptions: Parameters<typeof ngrok.forward>[0] = {
    addr: "http://" + (["0.0.0.0", "::"].includes(config.host) ? "127.0.0.1" : config.host.includes(":") && !config.host.startsWith("[") ? "[" + config.host + "]" : config.host) + ":" + config.port,
    force_new_session: true,
    // onStatusChange: 'closed' fires when the tunnel drops; 'connected' fires on reconnect
    onStatusChange: (status: string) => {
      if (isShuttingDown || connecting) return;
      if (status === "closed") {
        tunnelStatus("ngrok", "starting");
        console.warn(`[Ngrok] Tunnel status: closed. Reconnecting...`);
        void scheduleReconnect();
      } else if (status === "connected") {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        const url = listener?.url();
        if (url) tunnelStatus("ngrok", "connected", url);
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

  const session = generation;
  connecting = true;
  let next: Awaited<ReturnType<NgrokType["forward"]>>;
  try { next = await ngrok.forward(forwardOptions); } finally { connecting = false; }
  if (isShuttingDown || session !== generation) { await next.close(); return null; }
  listener = next;

  const tunnelUrl = listener.url();

  if (tunnelUrl) {
    tunnelStatus("ngrok", "connected", tunnelUrl);
    console.log(`[Tunnel] ngrok ready: ${tunnelUrl}/mcp`);
  }

  return tunnelUrl;
}

function scheduleReconnect(): void {
  if (isShuttingDown || reconnectTimer) return;
  const delay = reconnectDelay(reconnectAttempt++);
  console.log("[Ngrok] Reconnect attempt #" + reconnectAttempt + " in " + delay / 1000 + "s...");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    if (isShuttingDown) return;
    void connectNgrok().then(() => { reconnectAttempt = 0; }).catch((error: unknown) => {
      if (isShuttingDown) return;
      console.warn("[Ngrok] Reconnect failed: " + redactTunnelError(error));
      tunnelStatus("ngrok", "error", undefined, "Unable to connect to ngrok; check provider token and network. Retrying.");
      scheduleReconnect();
    });
  }, delay);
}

export async function startNgrokTunnel(): Promise<string | null> {
  if (!config.ngrok.enabled) {
    return null;
  }

  ++generation;
  isShuttingDown = false;
  reconnectAttempt = 0;
  tunnelStatus("ngrok", "starting");

  try {
    console.log("Starting ngrok tunnel...");
    return await connectNgrok();
  } catch (error) {
    const msg = redactTunnelError(error);
    console.error("[Ngrok] Failed to start tunnel:", msg);
    tunnelStatus("ngrok", "error", undefined, "Unable to connect to ngrok; check token and network. Retrying.");
    // Schedule reconnect — don't give up on first failure
    void scheduleReconnect();
    return null;
  }
}

export async function stopNgrokTunnel(): Promise<void> {
  ++generation;
  isShuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  tunnelStatus("ngrok", "disabled");

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
