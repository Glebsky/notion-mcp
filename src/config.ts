import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";

function integerEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return /^true$/i.test(value.trim());
}

const PORT = integerEnv("PORT", 3000);
const HOST = process.env.HOST || "127.0.0.1";
const API_KEY = process.env.MCP_API_KEY || "";
const FULL_ACCESS = booleanEnv("FULL_ACCESS", false);
const FILES_ROOT = path.resolve(process.env.FILES_ROOT || path.join(process.cwd(), "workspace"));
const COMMAND_TIMEOUT_MS = integerEnv("COMMAND_TIMEOUT_MS", 120_000);
const MAX_OUTPUT_BYTES = integerEnv("MAX_OUTPUT_BYTES", 1_048_576);
const MAX_FILE_BYTES = integerEnv("MAX_FILE_BYTES", 10_485_760);

const NGROK_ENABLED = booleanEnv("NGROK_ENABLED", false);
const NGROK_AUTHTOKEN = (process.env.NGROK_AUTHTOKEN || process.env.NGROK_TOKEN || "").trim();
const NGROK_DOMAIN = (process.env.NGROK_DOMAIN || "").trim();

const ALLOWED_HOSTS = new Set<string>(
  (process.env.ALLOWED_HOSTS || `localhost:${PORT};127.0.0.1:${PORT}`)
    .split(";")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

if (NGROK_DOMAIN) {
  ALLOWED_HOSTS.add(NGROK_DOMAIN.toLowerCase());
}

if (API_KEY.length < 32) {
  throw new Error("MCP_API_KEY must contain at least 32 characters. Generate one with: npm run token");
}

// Ensure sandbox directory exists
await fs.mkdir(FILES_ROOT, { recursive: true });

export const config = {
  port: PORT,
  host: HOST,
  apiKey: API_KEY,
  fullAccess: FULL_ACCESS,
  filesRoot: FILES_ROOT,
  commandTimeoutMs: COMMAND_TIMEOUT_MS,
  maxOutputBytes: MAX_OUTPUT_BYTES,
  maxFileBytes: MAX_FILE_BYTES,
  allowedHosts: ALLOWED_HOSTS,
  ngrok: {
    enabled: NGROK_ENABLED,
    authtoken: NGROK_AUTHTOKEN || undefined,
    domain: NGROK_DOMAIN || undefined,
  },
} as const;

export type Config = typeof config;
