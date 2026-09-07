import puppeteer, { type Browser, type Page } from "puppeteer-core";
import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { auditLog } from "../utils/logger.js";
import { resolveTarget } from "./filesystem.js";
import { config } from "../config.js";

export interface BrowserOpenOptions {
  url: string;
  headless?: boolean;
  browser?: "chrome" | "edge";
}

export interface BrowserNavigateOptions {
  url: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle0";
  timeoutMs?: number;
}

export interface BrowserEvaluateOptions {
  script: string;
}

export interface BrowserClickOptions {
  selector: string;
  timeoutMs?: number;
}

export interface BrowserTypeOptions {
  selector: string;
  text: string;
  clear?: boolean;
  timeoutMs?: number;
}

export interface BrowserGetContentOptions {
  type?: "text" | "html" | "title";
  selector?: string;
}

export interface BrowserScreenshotOptions {
  path?: string;
  fullPage?: boolean;
}

export interface ConsoleLogMessage {
  type: string;
  text: string;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private activePage: Page | null = null;
  private isHeadless: boolean = false;
  private consoleLogs: ConsoleLogMessage[] = [];

  /**
   * Find the path to Google Chrome or Microsoft Edge on the host system.
   */
  public getBrowserExecutable(preferred: "chrome" | "edge" = "chrome"): string {
    if (process.env.BROWSER_EXECUTABLE_PATH && fsSync.existsSync(process.env.BROWSER_EXECUTABLE_PATH)) {
      return process.env.BROWSER_EXECUTABLE_PATH;
    }
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fsSync.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const localAppData = process.env.LOCALAPPDATA || "";
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

    const chromePaths = [
      path.join(programFiles, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(programFilesX86, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(localAppData, "Google\\Chrome\\Application\\chrome.exe"),
    ];

    const edgePaths = [
      path.join(programFilesX86, "Microsoft\\Edge\\Application\\msedge.exe"),
      path.join(programFiles, "Microsoft\\Edge\\Application\\msedge.exe"),
      path.join(localAppData, "Microsoft\\Edge\\Application\\msedge.exe"),
    ];

    const primaryPaths = preferred === "edge" ? edgePaths : chromePaths;
    const secondaryPaths = preferred === "edge" ? chromePaths : edgePaths;

    for (const p of [...primaryPaths, ...secondaryPaths]) {
      if (fsSync.existsSync(p)) {
        return p;
      }
    }

    throw new Error(
      "No supported browser (Google Chrome or Microsoft Edge) found on the host system. " +
      "Please ensure Chrome or Edge is installed or specify BROWSER_EXECUTABLE_PATH."
    );
  }

  /**
   * Ensure browser instance is launched and ready.
   */
  private async ensureBrowser(headless = false, preferred: "chrome" | "edge" = "chrome"): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      if (this.isHeadless !== headless) {
        await this.close();
      } else {
        return this.browser;
      }
    }

    const executablePath = this.getBrowserExecutable(preferred);
    this.isHeadless = headless;

    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-infobars",
      "--disable-blink-features=AutomationControlled",
    ];

    if (!headless) {
      args.push("--start-maximized");
    }

    this.browser = await puppeteer.launch({
      executablePath,
      headless,
      defaultViewport: headless ? { width: 1280, height: 800 } : null,
      args,
    });

    this.browser.on("disconnected", () => {
      this.browser = null;
      this.activePage = null;
      this.consoleLogs = [];
    });

    return this.browser;
  }

  /**
   * Ensure an active page is available and set up listeners.
   */
  private async ensurePage(headless = false, preferred: "chrome" | "edge" = "chrome"): Promise<Page> {
    const browser = await this.ensureBrowser(headless, preferred);

    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    this.consoleLogs = [];
    page.on("console", (msg) => {
      this.consoleLogs.push({ type: msg.type(), text: msg.text() });
      if (this.consoleLogs.length > 100) this.consoleLogs.shift();
    });

    page.on("pageerror", (err: unknown) => {
      const text = err instanceof Error ? err.message : String(err);
      this.consoleLogs.push({ type: "error", text });
      if (this.consoleLogs.length > 100) this.consoleLogs.shift();
    });

    page.on("close", () => {
      if (this.activePage === page) {
        this.activePage = null;
      }
    });

    this.activePage = page;
    return page;
  }

  /**
   * Open browser and navigate to the specified URL.
   */
  public async open(options: BrowserOpenOptions) {
    const { url, headless = false, browser = "chrome" } = options;
    const page = await this.ensurePage(headless, browser);

    const fullUrl = url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")
      ? url
      : `http://${url}`;

    const response = await page.goto(fullUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    const title = await page.title();
    const currentUrl = page.url();

    auditLog("BROWSER_OPEN", { url: fullUrl, headless, title });

    return {
      url: currentUrl,
      title,
      status: response ? response.status() : 200,
      headless,
      message: `Browser opened and navigated to ${currentUrl}`,
    };
  }

  /**
   * Navigate active page to a new URL.
   */
  public async navigate(options: BrowserNavigateOptions) {
    const { url, waitUntil = "load", timeoutMs = 30_000 } = options;
    const page = await this.ensurePage();

    const fullUrl = url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")
      ? url
      : `http://${url}`;

    const response = await page.goto(fullUrl, {
      waitUntil,
      timeout: timeoutMs,
    });

    const title = await page.title();
    const currentUrl = page.url();

    auditLog("BROWSER_NAVIGATE", { url: fullUrl, title });

    return {
      url: currentUrl,
      title,
      status: response ? response.status() : 200,
    };
  }

  /**
   * Evaluate custom JavaScript in the browser context.
   */
  public async evaluate(options: BrowserEvaluateOptions) {
    const { script } = options;
    const page = await this.ensurePage();

    const result = await page.evaluate(async (code: string) => {
      try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const hasReturn = /\breturn\b/.test(code);
        const fn = new AsyncFunction(hasReturn ? code : `return (${code})`);
        const val = await fn();

        if (val === undefined) return null;
        if (typeof val === "object" && val !== null) {
          try {
            return JSON.parse(JSON.stringify(val));
          } catch {
            return String(val);
          }
        }
        return val;
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err));
      }
    }, script);

    auditLog("BROWSER_EVALUATE", {
      scriptSnippet: script.slice(0, 100),
      hasResult: result !== undefined,
    });

    return {
      result,
      url: page.url(),
      title: await page.title(),
    };
  }

  /**
   * Click an element matching a CSS selector.
   */
  public async click(options: BrowserClickOptions) {
    const { selector, timeoutMs = 10_000 } = options;
    const page = await this.ensurePage();

    await page.waitForSelector(selector, { timeout: timeoutMs, visible: true });
    await page.click(selector);

    auditLog("BROWSER_CLICK", { selector });

    return {
      clicked: true,
      selector,
      url: page.url(),
      title: await page.title(),
    };
  }

  /**
   * Type text into an input or textarea element.
   */
  public async type(options: BrowserTypeOptions) {
    const { selector, text, clear = false, timeoutMs = 10_000 } = options;
    const page = await this.ensurePage();

    await page.waitForSelector(selector, { timeout: timeoutMs, visible: true });

    if (clear) {
      await page.click(selector, { count: 3 });
      await page.keyboard.press("Backspace");
    }

    await page.type(selector, text, { delay: 15 });

    auditLog("BROWSER_TYPE", { selector, textLength: text.length });

    return {
      typed: true,
      selector,
      textLength: text.length,
    };
  }

  /**
   * Get page or element text / HTML / title.
   */
  public async getContent(options: BrowserGetContentOptions) {
    const { type = "text", selector } = options;
    const page = await this.ensurePage();

    let content: string;
    if (type === "title") {
      content = await page.title();
    } else if (type === "html") {
      if (selector) {
        await page.waitForSelector(selector, { timeout: 5000 });
        content = await page.$eval(selector, (el) => el.outerHTML);
      } else {
        content = await page.content();
      }
    } else {
      if (selector) {
        await page.waitForSelector(selector, { timeout: 5000 });
        content = await page.$eval(selector, (el) => (el as HTMLElement).innerText || el.textContent || "");
      } else {
        content = await page.evaluate(() => document.body ? document.body.innerText : "");
      }
    }

    const truncated = content.length > config.maxOutputBytes;
    const data = truncated ? content.slice(0, config.maxOutputBytes) : content;

    auditLog("BROWSER_GET_CONTENT", { type, selector, length: data.length, truncated });

    return {
      type,
      selector: selector || (type === "html" ? "html" : "body"),
      content: data,
      length: data.length,
      truncated,
    };
  }

  /**
   * Capture a screenshot of the page and optionally save it to a file.
   */
  public async screenshot(options: BrowserScreenshotOptions) {
    const { path: outputPath, fullPage = false } = options;
    const page = await this.ensurePage();

    const buffer = await page.screenshot({
      fullPage,
      type: "png",
    });

    let savedPath: string | undefined;

    if (outputPath) {
      savedPath = resolveTarget(outputPath);
      await fs.mkdir(path.dirname(savedPath), { recursive: true });
      await fs.writeFile(savedPath, buffer);
    }

    auditLog("BROWSER_SCREENSHOT", {
      savedTo: savedPath,
      fullPage,
      sizeBytes: buffer.length,
    });

    return {
      saved_to: savedPath,
      full_page: fullPage,
      size_bytes: buffer.length,
      encoding: "image/png",
      base64: savedPath ? undefined : Buffer.from(buffer).toString("base64"),
    };
  }

  /**
   * Retrieve recent console and error logs emitted by the page.
   */
  public getConsoleLogs(): ConsoleLogMessage[] {
    return [...this.consoleLogs];
  }

  /**
   * Close the browser instance.
   */
  public async close() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
      this.activePage = null;
      this.consoleLogs = [];
      auditLog("BROWSER_CLOSE", {});
    }

    return {
      closed: true,
      message: "Browser closed successfully",
    };
  }
}

export const browserManager = new BrowserManager();

// Automatically close browser on process termination
process.on("beforeExit", () => {
  void browserManager.close();
});
process.on("SIGINT", () => {
  void browserManager.close();
});
process.on("SIGTERM", () => {
  void browserManager.close();
});
