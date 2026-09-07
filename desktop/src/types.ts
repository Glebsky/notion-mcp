export interface ServerStatus {
  state: "offline" | "starting" | "running" | "error";
  port: number;
  host: string;
  ngrokEnabled: boolean;
  ngrokDomain?: string;
  ngrokUrl?: string;
  apiKey: string;
  fullAccess: boolean;
  filesRoot: string;
  error?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "audit" | "error" | "warn" | "mcp";
  category?: "command" | "file" | "auth" | "general";
  message: string;
  raw?: string;
}

export interface EnvConfig {
  PORT: string;
  HOST: string;
  MCP_API_KEY: string;
  FULL_ACCESS: string;
  FILES_ROOT: string;
  NGROK_ENABLED: string;
  NGROK_AUTHTOKEN: string;
  NGROK_DOMAIN: string;
  ALLOWED_HOSTS: string;
  COMMAND_TIMEOUT_MS: string;
  MAX_OUTPUT_BYTES: string;
  MAX_FILE_BYTES: string;
}

export interface ElectronAPI {
  // Server Management
  startServer: () => Promise<{ success: boolean; error?: string }>;
  stopServer: () => Promise<{ success: boolean }>;
  restartServer: () => Promise<{ success: boolean; error?: string }>;
  getServerStatus: () => Promise<ServerStatus>;

  // Configuration
  getConfig: () => Promise<EnvConfig>;
  saveConfig: (config: Partial<EnvConfig>) => Promise<{ success: boolean; error?: string }>;
  selectFolder: () => Promise<string | null>;
  generateToken: () => Promise<string>;

  // Logs
  onLog: (callback: (log: LogEntry) => void) => () => void;
  onStatusChange: (callback: (status: ServerStatus) => void) => () => void;
  clearLogs: () => Promise<void>;

  // Window Controls & Tray
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  hideToTray: () => void;
  exitApp: () => void;

  // External Links / System
  openExternal: (url: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
