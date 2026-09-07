import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as crypto from "node:crypto";
import type { EnvConfig, LogEntry, ServerStatus } from "../types.js";

export class ServerManager {
  private process: ChildProcess | null = null;
  private status: ServerStatus = {
    state: "offline",
    port: 3000,
    host: "127.0.0.1",
    ngrokEnabled: false,
    apiKey: "",
    fullAccess: false,
    filesRoot: "./workspace",
  };

  private projectRoot: string;
  private configDir: string;
  private onLogCallback: ((log: LogEntry) => void) | null = null;
  private onStatusChangeCallback: ((status: ServerStatus) => void) | null = null;

  constructor(projectRoot: string, configDir: string) {
    this.projectRoot = projectRoot;
    this.configDir = configDir;
    void this.init();
  }

  private async init() {
    await this.ensureEnvExists();
    await this.reloadConfig();
  }

  public setCallbacks(
    onLog: (log: LogEntry) => void,
    onStatusChange: (status: ServerStatus) => void,
  ) {
    this.onLogCallback = onLog;
    this.onStatusChangeCallback = onStatusChange;
  }

  public getStatus(): ServerStatus {
    return { ...this.status };
  }

  private updateStatus(newStatus: Partial<ServerStatus>) {
    this.status = { ...this.status, ...newStatus };
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(this.getStatus());
    }
  }

  private emitLog(
    message: string,
    type: LogEntry["type"] = "info",
    category?: LogEntry["category"],
    raw?: string,
  ) {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour12: false }),
      type,
      category,
      message,
      raw,
    };
    if (this.onLogCallback) {
      this.onLogCallback(entry);
    }
  }

  public getEnvPath(): string {
    return path.join(this.configDir, ".env");
  }

  private async ensureEnvExists(): Promise<void> {
    const envPath = this.getEnvPath();
    try {
      await fs.access(envPath);
    } catch {
      // Create default .env in config directory
      await fs.mkdir(this.configDir, { recursive: true });
      const defaultApiKey = crypto.randomBytes(32).toString("hex");
      const defaultWorkspace = path.join(this.configDir, "workspace");
      await fs.mkdir(defaultWorkspace, { recursive: true });

      const defaultContent = [
        `MCP_API_KEY=${defaultApiKey}`,
        `PORT=3000`,
        `HOST=127.0.0.1`,
        `ALLOWED_HOSTS=localhost:3000;127.0.0.1:3000;*.ngrok-free.app;*.ngrok.app;*.ngrok-free.dev`,
        `NGROK_ENABLED=false`,
        `NGROK_AUTHTOKEN=`,
        `NGROK_DOMAIN=`,
        `FULL_ACCESS=false`,
        `FILES_ROOT=${defaultWorkspace}`,
        `COMMAND_TIMEOUT_MS=120000`,
        `MAX_OUTPUT_BYTES=1048576`,
        `MAX_FILE_BYTES=10485760`,
      ].join("\n") + "\n";

      await fs.writeFile(envPath, defaultContent, "utf8");
    }
  }

  public async getEnvConfig(): Promise<EnvConfig> {
    await this.ensureEnvExists();
    const envPath = this.getEnvPath();
    const defaultConfig: EnvConfig = {
      PORT: "3000",
      HOST: "127.0.0.1",
      MCP_API_KEY: "",
      FULL_ACCESS: "false",
      FILES_ROOT: path.join(this.configDir, "workspace"),
      NGROK_ENABLED: "false",
      NGROK_AUTHTOKEN: "",
      NGROK_DOMAIN: "",
      ALLOWED_HOSTS: "localhost:3000;127.0.0.1:3000;*.ngrok-free.app;*.ngrok.app;*.ngrok-free.dev",
      COMMAND_TIMEOUT_MS: "120000",
      MAX_OUTPUT_BYTES: "1048576",
      MAX_FILE_BYTES: "10485760",
    };

    try {
      const content = await fs.readFile(envPath, "utf8");
      const lines = content.split(/\r?\n/);
      const parsed: Record<string, string> = {};

      for (const line of lines) {
        const match = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*)$/);
        if (match) {
          parsed[match[1].trim()] = match[2].trim();
        }
      }

      return { ...defaultConfig, ...parsed };
    } catch {
      return defaultConfig;
    }
  }

  public async saveEnvConfig(newConfig: Partial<EnvConfig>): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureEnvExists();
      const current = await this.getEnvConfig();
      const updated = { ...current, ...newConfig };
      const envPath = this.getEnvPath();

      const lines = [
        `MCP_API_KEY=${updated.MCP_API_KEY}`,
        `PORT=${updated.PORT}`,
        `HOST=${updated.HOST}`,
        `ALLOWED_HOSTS=${updated.ALLOWED_HOSTS}`,
        `NGROK_ENABLED=${updated.NGROK_ENABLED}`,
        `NGROK_AUTHTOKEN=${updated.NGROK_AUTHTOKEN}`,
        `NGROK_DOMAIN=${updated.NGROK_DOMAIN}`,
        `FULL_ACCESS=${updated.FULL_ACCESS}`,
        `FILES_ROOT=${updated.FILES_ROOT}`,
        `COMMAND_TIMEOUT_MS=${updated.COMMAND_TIMEOUT_MS}`,
        `MAX_OUTPUT_BYTES=${updated.MAX_OUTPUT_BYTES}`,
        `MAX_FILE_BYTES=${updated.MAX_FILE_BYTES}`,
      ];

      await fs.writeFile(envPath, lines.join("\n") + "\n", "utf8");
      await this.reloadConfig();
      this.emitLog(`Configuration updated and saved to ${envPath}`, "info");
      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.emitLog(`Failed to save .env: ${error}`, "error");
      return { success: false, error };
    }
  }

  public async reloadConfig() {
    const config = await this.getEnvConfig();
    this.updateStatus({
      port: Number.parseInt(config.PORT, 10) || 3000,
      host: config.HOST || "127.0.0.1",
      apiKey: config.MCP_API_KEY || "",
      fullAccess: config.FULL_ACCESS === "true",
      filesRoot: config.FILES_ROOT || path.join(this.configDir, "workspace"),
      ngrokEnabled: config.NGROK_ENABLED === "true",
      ngrokDomain: config.NGROK_DOMAIN || undefined,
    });
  }

  public async start(): Promise<{ success: boolean; error?: string }> {
    if (this.process && !this.process.killed) {
      return { success: true };
    }

    await this.reloadConfig();
    this.updateStatus({ state: "starting", error: undefined, ngrokUrl: undefined });
    this.emitLog("Starting Notion Terminal MCP Server...", "info");

    const serverScript = path.join(this.projectRoot, "dist", "index.js");

    try {
      await fs.access(serverScript);
    } catch {
      const error = `Server entrypoint not found at ${serverScript}. Run 'npm run build' first.`;
      this.updateStatus({ state: "error", error });
      this.emitLog(error, "error");
      return { success: false, error };
    }

    try {
      const envPath = this.getEnvPath();

      this.process = spawn(process.execPath, [serverScript], {
        cwd: this.configDir,
        env: {
          ...process.env,
          DOTENV_PATH: envPath,
          ELECTRON_RUN_AS_NODE: "1",
          FORCE_COLOR: "1",
        },
        windowsHide: true,
      });

      this.process.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        this.parseOutput(text);
      });

      this.process.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        this.emitLog(text.trim(), "error", undefined, text);
      });

      this.process.on("close", (code) => {
        const wasRunning = this.status.state === "running" || this.status.state === "starting";
        this.process = null;
        this.updateStatus({
          state: code === 0 || !wasRunning ? "offline" : "error",
          ngrokUrl: undefined,
        });
        this.emitLog(`MCP Server stopped (exit code: ${code})`, code === 0 ? "info" : "warn");
      });

      this.process.on("error", (err) => {
        this.process = null;
        this.updateStatus({ state: "error", error: err.message, ngrokUrl: undefined });
        this.emitLog(`Process error: ${err.message}`, "error");
      });

      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.updateStatus({ state: "error", error, ngrokUrl: undefined });
      this.emitLog(`Failed to spawn server process: ${error}`, "error");
      return { success: false, error };
    }
  }

  public async stop(): Promise<{ success: boolean }> {
    if (!this.process || this.process.killed) {
      this.updateStatus({ state: "offline", ngrokUrl: undefined });
      return { success: true };
    }

    this.emitLog("Stopping MCP server process...", "info");

    return new Promise((resolve) => {
      if (this.process?.pid && process.platform === "win32") {
        const killer = spawn("taskkill", ["/pid", String(this.process.pid), "/T", "/F"], {
          windowsHide: true,
        });
        killer.once("close", () => {
          this.process = null;
          this.updateStatus({ state: "offline", ngrokUrl: undefined });
          resolve({ success: true });
        });
      } else {
        this.process?.kill("SIGTERM");
        setTimeout(() => {
          if (this.process) {
            this.process.kill("SIGKILL");
          }
          this.process = null;
          this.updateStatus({ state: "offline", ngrokUrl: undefined });
          resolve({ success: true });
        }, 1500);
      }
    });
  }

  public async restart(): Promise<{ success: boolean; error?: string }> {
    await this.stop();
    return await this.start();
  }

  private parseOutput(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    for (const line of lines) {
      if (line.startsWith("[AUDIT]")) {
        const match = line.match(/\[AUDIT\]\s*([^|]+)\|\s*([^|]+)\|\s*(.*)/);
        if (match) {
          const action = match[2].trim();
          const details = match[3].trim();
          const category: LogEntry["category"] = action.startsWith("file")
            ? "file"
            : action.startsWith("terminal")
              ? "command"
              : "general";

          this.emitLog(`[AUDIT] ${action.toUpperCase()}: ${details}`, "audit", category, line);
          continue;
        }
      }

      if (line.includes("Notion Terminal MCP listening on")) {
        this.updateStatus({ state: "running" });
        this.emitLog(line, "mcp");
        continue;
      }

      const ngrokMatch = line.match(/URL to paste into Notion:\s*(https:\/\/[^\s]+)/i);
      if (ngrokMatch) {
        let url = ngrokMatch[1].trim();
        // If the logged URL ends with /mcp, extract the base domain URL
        if (url.endsWith("/mcp")) {
          url = url.slice(0, -4);
        }
        this.updateStatus({ ngrokUrl: url });
        this.emitLog(`Public Ngrok Tunnel Ready: ${url}`, "mcp");
        continue;
      }

      const isError = line.toLowerCase().includes("error") || line.toLowerCase().includes("failed");
      this.emitLog(line, isError ? "error" : "info", undefined, line);
    }
  }
}
