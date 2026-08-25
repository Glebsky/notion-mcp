/**
 * Audit Logger for MCP actions executed by remote AI agents.
 */
export function auditLog(action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const serialized = Object.entries(details)
    .filter(([_, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v)}`)
    .join(" ");

  console.log(`[AUDIT] ${timestamp} | ${action.padEnd(17)} | ${serialized}`);
}
