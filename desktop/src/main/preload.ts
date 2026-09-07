import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI, EnvConfig, LogEntry, ServerStatus } from "../types.js";

const api: ElectronAPI = {
  startServer: () => ipcRenderer.invoke("server:start"),
  stopServer: () => ipcRenderer.invoke("server:stop"),
  restartServer: () => ipcRenderer.invoke("server:restart"),
  getServerStatus: () => ipcRenderer.invoke("server:status"),

  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config: Partial<EnvConfig>) => ipcRenderer.invoke("config:save", config),
  selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),
  generateToken: () => ipcRenderer.invoke("token:generate"),

  onLog: (callback: (log: LogEntry) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, log: LogEntry) => callback(log);
    ipcRenderer.on("log:entry", handler);
    return () => {
      ipcRenderer.removeListener("log:entry", handler);
    };
  },

  onStatusChange: (callback: (status: ServerStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: ServerStatus) => callback(status);
    ipcRenderer.on("server:status-change", handler);
    return () => {
      ipcRenderer.removeListener("server:status-change", handler);
    };
  },

  clearLogs: () => ipcRenderer.invoke("logs:clear"),

  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),

  openExternal: (url: string) => ipcRenderer.send("shell:open-external", url),
};

contextBridge.exposeInMainWorld("electronAPI", api);
