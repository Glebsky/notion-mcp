import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function resolveTunnelCommand(provider: string, executable: string): Promise<{ command: string; prefix: string[] }> {
  if (!executable || /[\r\n\0]/.test(executable)) throw new Error("Choose a CLI executable, not a shell command.");
  const isPath = path.isAbsolute(executable) || executable.includes("/") || executable.includes("\\");
  const directories = isPath ? [""] : (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32" && !path.extname(executable) ? [".exe", ".cmd"] : [""];
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = isPath ? path.resolve(executable + extension) : path.join(directory.replace(/^"|"$/g, ""), executable + extension);
      try { if (!(await fs.stat(candidate)).isFile()) continue; } catch { continue; }
      // npm's Windows shim cannot be spawned without a shell. Run its fixed JS entry instead.
      if (provider === "localtunnel" && /\.cmd$/i.test(candidate)) {
        const script = path.join(path.dirname(candidate), "node_modules", "localtunnel", "bin", "lt.js");
        await fs.access(script);
        return { command: process.execPath, prefix: [script] };
      }
      if (/\.(cmd|bat|ps1)$/i.test(candidate)) continue;
      if (provider === "localtunnel" && /\.js$/i.test(candidate) && path.basename(candidate) === "lt.js") return { command: process.execPath, prefix: [candidate] };
      return { command: candidate, prefix: [] };
    }
  }
  const instructions: Record<string, string> = {
    tuna: "Install Tuna CLI: https://tuna.am/docs/ (then tuna login).",
    cloudflare: "Install cloudflared: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/",
    localtunnel: "Install LocalTunnel explicitly: npm install -g localtunnel (https://github.com/localtunnel/localtunnel).",
  };
  throw new Error("CLI not found. " + (instructions[provider] || "Install the provider CLI.") + " Restart the desktop app after changing PATH, or choose its executable path in Settings.");
}

export async function terminateTunnelProcess(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null || !proc.pid) return;
  const pid = proc.pid;
  const exited = new Promise<void>((resolve) => proc.once("close", () => resolve()));
  if (process.platform === "win32") {
    // Kill the complete tree, including any helper spawned by the CLI.
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, shell: false });
      const timer = setTimeout(() => { killer.kill(); resolve(); }, 1800);
      const done = () => { clearTimeout(timer); resolve(); };
      killer.once("error", done); killer.once("close", done);
    });
  } else {
    try { process.kill(-pid, "SIGTERM"); } catch { proc.kill("SIGTERM"); }
    await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 600))]);
    if (proc.exitCode === null) {
      try { process.kill(-pid, "SIGKILL"); } catch { proc.kill("SIGKILL"); }
    }
  }
  await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 300))]);
}
