import type { Request, Response, NextFunction } from "express";

// Only authenticated MCP payload bodies are measured. Headers and network framing
// are intentionally excluded, and neither tokens nor payload contents are retained.
const requestSizes = new WeakMap<Request, number>();
let enabled = true;
let received = 0;
let sent = 0;
let totalReceived = 0;
let totalSent = 0;
let totalRequests = 0;
let nextId = 0;
let getOpenSseCount: () => number = () => 0;
export function setSseCountProvider(provider: () => number): void { getOpenSseCount = provider; }
const active = new Map<number, { client: string; operation: string; kind: "sse" | "http" }>();
const recent = new Map<string, { client: string; operation: string; lastSeen: string; requests: number }>();
const operations = new Map<string, { received: number; sent: number }>();

export function recordRequestBody(req: Request, body: Buffer): void {
  requestSizes.set(req, body.length);
}

function sizeOf(chunk: unknown, encoding?: unknown): number {
  if (typeof chunk === "string") return Buffer.byteLength(chunk, typeof encoding === "string" ? encoding as BufferEncoding : "utf8");
  return chunk instanceof Uint8Array ? chunk.byteLength : 0;
}

function addBytes(operation: string, direction: "received" | "sent", count: number): void {
  if (!enabled || !count) return;
  const item = operations.get(operation) || { received: 0, sent: 0 };
  item[direction] += count;
  operations.set(operation, item);
  if (direction === "received") { received += count; totalReceived += count; }
  else { sent += count; totalSent += count; }
}

function safeLabel(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 80) || fallback : fallback;
}

export function monitorRequest(req: Request, res: Response, next: NextFunction): void {
  if (!process.send) { next(); return; }
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const method = safeLabel(body.method, `${req.method} ${req.path}`);
  const operation = method === "tools/call" ? safeLabel(body.params?.name, method) : method;
  // Address is the direct socket peer, not the easily spoofed X-Forwarded-For.
  // Behind a tunnel this may identify the tunnel rather than the original user.
  const peer = safeLabel(req.socket.remoteAddress, "unknown peer");
  const agent = safeLabel(body.params?.clientInfo?.name || req.get("user-agent"), "unknown client");
  const client = `${agent} · ${peer}`;
  const id = ++nextId;
  if (enabled) {
    const previous = recent.get(client);
    recent.delete(client);
    recent.set(client, { client, operation, lastSeen: new Date().toISOString(), requests: (previous?.requests || 0) + 1 });
    while (recent.size > 50) recent.delete(recent.keys().next().value!);
    totalRequests++;
    active.set(id, { client, operation, kind: req.path === "/sse" ? "sse" : "http" });
    addBytes(operation, "received", requestSizes.get(req) || 0);
  }

  const write = res.write.bind(res);
  const end = res.end.bind(res);
  res.write = ((chunk: unknown, ...args: unknown[]) => {
    addBytes(operation, "sent", sizeOf(chunk, args[0]));
    return (write as (...args: any[]) => boolean)(chunk, ...args);
  }) as typeof res.write;
  res.end = ((...args: unknown[]) => {
    addBytes(operation, "sent", sizeOf(args[0], args[1]));
    return (end as (...args: any[]) => Response)(...args);
  }) as typeof res.end;
  res.once("close", () => active.delete(id));
  next();
}

export function setMonitoringEnabled(value: boolean): void {
  enabled = value;
  received = sent = totalReceived = totalSent = totalRequests = 0;
  operations.clear();
  active.clear();
  recent.clear();
}

const timer = setInterval(() => {
  if (!enabled || !process.connected || !process.send) return;
  const snapshot = {
    received, sent, totalReceived, totalSent, totalRequests,
    activeRequests: getOpenSseCount() + [...active.values()].filter(item => item.kind === "http").length,
    activeSse: getOpenSseCount(),
    activeHttp: [...active.values()].filter(item => item.kind === "http").length,
    recentClients: [...recent.values()].reverse(),
    operations: [...operations.entries()].map(([operation, bytes]) => ({ operation, ...bytes })),
    sampledAt: Date.now(),
  };
  received = sent = 0;
  operations.clear();
  try { process.send({ type: "monitor:snapshot", snapshot }, () => {}); } catch { /* parent disconnected */ }
}, 1000);
timer.unref();
