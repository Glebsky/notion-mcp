import { config } from "../config.js";
import { startNgrokTunnel, stopNgrokTunnel } from "./ngrok.js";
import { startCliTunnel, stopCliTunnel } from "./cli.js";
import { getTunnelStatus, tunnelStatus, type TunnelSnapshot } from "./status.js";
export interface TunnelAdapter { start(): Promise<void>; stop(): Promise<void>; status(): TunnelSnapshot }
const ngrok: TunnelAdapter = { start: async () => { await startNgrokTunnel(); }, stop: stopNgrokTunnel, status: getTunnelStatus };
const cli = (provider: "tuna" | "cloudflare" | "localtunnel"): TunnelAdapter => ({ start: () => startCliTunnel(provider), stop: stopCliTunnel, status: getTunnelStatus });
const adapters: Record<typeof config.tunnelProvider, TunnelAdapter> = {
  none: { start: async () => tunnelStatus("none", "disabled"), stop: async () => tunnelStatus("none", "disabled"), status: getTunnelStatus },
  ngrok, tuna: cli("tuna"), cloudflare: cli("cloudflare"), localtunnel: cli("localtunnel"),
};
let active: TunnelAdapter | undefined;
export async function startTunnel(): Promise<void> {
  if (active) return;
  active = adapters[config.tunnelProvider];
  await active.start();
}
export async function stopTunnel(): Promise<void> {
  const adapter = active; active = undefined;
  await adapter?.stop();
}
