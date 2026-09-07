import { app, BrowserWindow, dialog, ipcMain, Menu, shell, Tray, nativeImage } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { ServerManager } from "./server-manager.js";
import type { ServerStatus } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged && (process.env.NODE_ENV === "development" || !!process.env.VITE_DEV_SERVER_URL);
// dist-desktop/main -> dist-desktop -> projectRoot (2 levels up)
const projectRoot = path.resolve(__dirname, "../..");
const pngIconPath = path.join(projectRoot, "desktop", "icon.png");
const svgIconPath = path.join(projectRoot, "desktop", "icon.svg");
const appIconPath = fs.existsSync(pngIconPath) ? pngIconPath : svgIconPath;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverManager: ServerManager | null = null;
let isQuitting = false;
let hasShownTrayNotification = false;

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();

  if (!hasShownTrayNotification && tray) {
    hasShownTrayNotification = true;
    try {
      tray.displayBalloon({
        title: "Notion Terminal MCP",
        content: "Приложение свернуто в трей и продолжает работать. Кликните по значку в трее, чтобы открыть его.",
      });
    } catch {
      // Ignore balloon errors
    }
  }
  updateTrayMenu(serverManager?.getStatus());
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isVisible()) {
    if (mainWindow.isFocused()) {
      hideMainWindow();
    } else {
      mainWindow.focus();
    }
  } else {
    showMainWindow();
  }
}

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
    icon: appIconPath,
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

  // Intercept window close to minimize to tray instead of quitting
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideMainWindow();
      return false;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("show", () => {
    updateTrayMenu(serverManager?.getStatus());
  });

  mainWindow.on("hide", () => {
    updateTrayMenu(serverManager?.getStatus());
  });
}

function updateTrayMenu(status?: ServerStatus) {
  if (!tray) return;

  const currentStatus = status || serverManager?.getStatus();
  const isRunning = currentStatus?.state === "running";
  const isStarting = currentStatus?.state === "starting";
  const isWindowVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();

  const statusLabel = isRunning
    ? `Статус: Работает (порт ${currentStatus?.port})`
    : isStarting
      ? "Статус: Запуск сервера..."
      : currentStatus?.state === "error"
        ? "Статус: Ошибка"
        : "Статус: Остановлен";

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: isWindowVisible ? "Скрыть окно в трей" : "Открыть Notion Terminal",
      click: () => {
        if (isWindowVisible) {
          hideMainWindow();
        } else {
          showMainWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: statusLabel,
      enabled: false,
    },
  ];

  if (currentStatus?.ngrokUrl) {
    template.push({
      label: "🌐 Открыть Ngrok Live URL",
      click: () => {
        if (currentStatus.ngrokUrl) void shell.openExternal(currentStatus.ngrokUrl);
      },
    });
  }

  template.push(
    { type: "separator" },
    isRunning
      ? {
          label: "Остановить сервер",
          click: async () => {
            await serverManager?.stop();
          },
        }
      : {
          label: "Запустить сервер",
          enabled: !isStarting,
          click: async () => {
            await serverManager?.start();
          },
        },
    {
      label: "Перезапустить сервер",
      enabled: isRunning && !isStarting,
      click: async () => {
        await serverManager?.restart();
      },
    },
    { type: "separator" },
    {
      label: "Выход из приложения",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  );

  const contextMenu = Menu.buildFromTemplate(template);
  tray.setContextMenu(contextMenu);

  const tooltipText = isRunning
    ? `Notion Terminal MCP — Работает (порт ${currentStatus?.port})`
    : "Notion Terminal MCP — Остановлен";
  tray.setToolTip(tooltipText);
}

function createTray() {
  if (tray) return;

  const trayIcon = nativeImage.createFromPath(fs.existsSync(pngIconPath) ? pngIconPath : appIconPath);
  tray = new Tray(trayIcon);

  tray.on("click", () => {
    toggleMainWindow();
  });

  tray.on("double-click", () => {
    showMainWindow();
  });

  updateTrayMenu();
}

app.whenReady().then(() => {
  const configDir = app.isPackaged
    ? path.join(app.getPath("userData"), "config")
    : projectRoot;

  serverManager = new ServerManager(projectRoot, configDir);

  createWindow();
  createTray();

  // Setup callbacks from ServerManager to Renderer and Tray
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
      updateTrayMenu(status);
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

  // Window Controls & Tray
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

  ipcMain.on("window:hide-to-tray", () => {
    hideMainWindow();
  });

  ipcMain.on("app:quit", () => {
    isQuitting = true;
    app.quit();
  });

  ipcMain.on("shell:open-external", (_event, url) => {
    if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
      void shell.openExternal(url);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showMainWindow();
    }
  });
});

app.on("before-quit", async () => {
  isQuitting = true;
  if (serverManager) {
    await serverManager.stop();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});
