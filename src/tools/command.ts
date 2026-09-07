import { spawn } from "node:child_process";
import { config } from "../config.js";
import { auditLog } from "../utils/logger.js";
import { resolveTarget, getActiveWorkingDir, setActiveWorkingDir } from "./filesystem.js";

export interface CommandExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
}

export async function killProcessTree(childPid: number): Promise<void> {
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(childPid), "/T", "/F"], {
        windowsHide: true,
      });
      killer.once("close", () => resolve());
      killer.once("error", () => resolve());
    });
  } else {
    try {
      process.kill(-childPid, "SIGKILL");
    } catch {
      // Process already terminated
    }
  }
}

export async function executeCommand(
  command: string,
  shell: "powershell" | "cmd" = "powershell",
  cwd?: string,
  timeoutMs?: number,
): Promise<CommandExecutionResult> {
  const actualCwd = cwd
    ? resolveTarget(cwd)
    : getActiveWorkingDir();

  try {
    setActiveWorkingDir(actualCwd);
  } catch {}

  // Detect direct cd / Set-Location commands to update session working directory
  const cdMatch = command.match(/^\s*(?:cd|Set-Location)\s+['"]?([^'";\n\r]+)['"]?\s*$/i);
  if (cdMatch) {
    try {
      setActiveWorkingDir(cdMatch[1]);
    } catch {}
  }

  const timeout = Math.min(timeoutMs || config.commandTimeoutMs, 900_000);
  const executable = shell === "cmd" ? "cmd.exe" : "powershell.exe";

  // Ensure UTF-8 output encoding on Windows shells
  const utf8Command =
    shell === "cmd"
      ? `chcp 65001 > nul & ${command}`
      : `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`;

  const args =
    shell === "cmd"
      ? ["/d", "/s", "/c", utf8Command]
      : [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          utf8Command,
        ];

  const env = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    LANG: "en_US.UTF-8",
    LC_ALL: "en_US.UTF-8",
  };

  const result = await new Promise<CommandExecutionResult>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: actualCwd,
      windowsHide: true,
      detached: process.platform !== "win32",
      env,
    });

    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let truncated = false;
    let timedOut = false;

    const collect = (
      current: Buffer<ArrayBufferLike>,
      chunk: Buffer<ArrayBufferLike>,
    ): Buffer<ArrayBufferLike> => {
      if (current.length >= config.maxOutputBytes) {
        truncated = true;
        return current;
      }
      const remaining = config.maxOutputBytes - current.length;
      if (chunk.length > remaining) {
        truncated = true;
      }
      return Buffer.concat([current, chunk.subarray(0, remaining)]);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = collect(stdout, chunk);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = collect(stderr, chunk);
    });

    child.once("error", reject);

    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        void killProcessTree(child.pid);
      }
    }, timeout);

    child.once("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
        timedOut,
        truncated,
      });
    });
  });

  auditLog("terminal_execute", {
    command,
    shell,
    cwd: actualCwd,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
  });

  return result;
}
