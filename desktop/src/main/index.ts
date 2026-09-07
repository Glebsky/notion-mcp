import { app, BrowserWindow, dialog, ipcMain, Menu, shell, Tray } from "electron";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { ServerManager } from "./server-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged && (process.env.NODE_ENV === "development" || !!process.env.VITE_DEV_SERVER_URL);
// dist-desktop/main -> dist-desktop -> projectRoot (2 levels up)
const projectRoot = path.resolve(__dirname, "../..");
const iconPath = path.join(projectRoot, "desktop", "icon.svg");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverManager: ServerManager | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 740,
    minWidth: 860,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    titleBarStyle: "hidden",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (isDev) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173");
  } else {
    const htmlPath = path.join(projectRoot, "dist-renderer", "index.html");
    void mainWindow.loadFile(htmlPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}


function createTray() {
  // Optional System Tray initialization
}


app.whenReady().then(() => {
  const configDir = app.isPackaged
    ? path.join(app.getPath("userData"), "config")
    : projectRoot;

  serverManager = new ServerManager(projectRoot, configDir);

  createWindow();
  createTray();


  // Setup callbacks from ServerManager to Renderer
  serverManager.setCallbacks(
    (log) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("log:entry", log);
      }
    },
    (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("server:status-change", status);
      }
    },
  );

  // IPC Handlers
  ipcMain.handle("server:start", async () => {
    return await serverManager?.start();
  });

  ipcMain.handle("server:stop", async () => {
    return await serverManager?.stop();
  });

  ipcMain.handle("server:restart", async () => {
    return await serverManager?.restart();
  });

  ipcMain.handle("server:status", async () => {
    return serverManager?.getStatus();
  });

  ipcMain.handle("config:get", async () => {
    return await serverManager?.getEnvConfig();
  });

  ipcMain.handle("config:save", async (_event, newConfig) => {
    return await serverManager?.saveEnvConfig(newConfig);
  });

  ipcMain.handle("dialog:select-folder", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Files Sandbox Root Directory",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("token:generate", async () => {
    return crypto.randomBytes(32).toString("hex");
  });

  ipcMain.handle("logs:clear", async () => {
    return;
  });

  // Window Controls
  ipcMain.on("window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on("window:close", () => {
    mainWindow?.close();
  });

  ipcMain.on("shell:open-external", (_event, url) => {
    if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
      void shell.openExternal(url);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", async () => {
  if (serverManager) {
    await serverManager.stop();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
