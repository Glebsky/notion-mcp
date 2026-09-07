import * as fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import * as path from "node:path";

import { config } from "../config.js";
import { auditLog } from "../utils/logger.js";

import * as fsSync from "node:fs";

let currentWorkingDir: string = config.filesRoot;

export function getActiveWorkingDir(): string {
  return currentWorkingDir;
}

export function setActiveWorkingDir(newDir: string): string {
  const resolved = resolveTarget(newDir);
  try {
    const stat = fsSync.statSync(resolved);
    if (stat.isDirectory()) {
      currentWorkingDir = resolved;
      return currentWorkingDir;
    }
  } catch {
    // Keep resolved path
  }
  currentWorkingDir = resolved;
  return currentWorkingDir;
}

/**
 * Resolves a given path against the active working directory or FILES_ROOT
 * with smart candidate resolution for subprojects and sandbox validation.
 */
export function resolveTarget(input: string): string {
  let cleaned = (input || "").trim();
  if (!cleaned) {
    return currentWorkingDir;
  }

  // Strip leading slash from Windows absolute paths like "/C:/foo"
  if (/^[/\\][a-zA-Z]:/.test(cleaned)) {
    cleaned = cleaned.slice(1);
  }

  let target: string;

  if (path.isAbsolute(cleaned)) {
    target = path.resolve(cleaned);
  } else {
    // Relative path resolution with intelligent candidate matching
    const fromCwd = path.resolve(currentWorkingDir, cleaned);
    const fromRoot = path.resolve(config.filesRoot, cleaned);

    // 1. If cwd is a subproject and fromCwd exists, use it
    if (currentWorkingDir !== config.filesRoot && fsSync.existsSync(fromCwd)) {
      target = fromCwd;
    }
    // 2. If path starts with a project folder from root (e.g. "sandustry/src/...") and exists from root
    else if (fsSync.existsSync(fromRoot)) {
      target = fromRoot;
      const rel = path.relative(config.filesRoot, target);
      const topDir = rel.split(path.sep)[0];
      if (topDir && topDir !== "..") {
        const subproject = path.join(config.filesRoot, topDir);
        try {
          if (fsSync.statSync(subproject).isDirectory()) {
            currentWorkingDir = subproject;
          }
        } catch {}
      }
    }
    // 3. Search immediate subdirectories under filesRoot for an existing match
    else {
      let foundInSub: string | null = null;
      let matchedSubdir: string | null = null;

      try {
        const subdirs = fsSync
          .readdirSync(config.filesRoot, { withFileTypes: true })
          .filter((d) => d.isDirectory() && !d.name.startsWith("."))
          .map((d) => d.name);

        for (const sub of subdirs) {
          const candidate = path.resolve(config.filesRoot, sub, cleaned);
          if (fsSync.existsSync(candidate)) {
            foundInSub = candidate;
            matchedSubdir = path.join(config.filesRoot, sub);
            break;
          }
        }

        // If file doesn't exist, check if parent directory exists in a subdirectory (for creating new files)
        if (!foundInSub) {
          const dirPart = path.dirname(cleaned);
          if (dirPart && dirPart !== ".") {
            for (const sub of subdirs) {
              const candidateDir = path.resolve(config.filesRoot, sub, dirPart);
              if (fsSync.existsSync(candidateDir)) {
                foundInSub = path.resolve(config.filesRoot, sub, cleaned);
                matchedSubdir = path.join(config.filesRoot, sub);
                break;
              }
            }
          }
        }
      } catch {
        // Ignore fsSync errors
      }

      if (foundInSub && matchedSubdir) {
        target = foundInSub;
        currentWorkingDir = matchedSubdir;
      } else if (currentWorkingDir !== config.filesRoot) {
        target = fromCwd;
      } else {
        target = fromRoot;
      }
    }
  }

  if (config.fullAccess) return target;

  const relative = path.relative(config.filesRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Access denied: path "${input}" is outside sandbox directory (${config.filesRoot}). Set FULL_ACCESS=true to permit arbitrary paths.`,
    );
  }
  return target;
}

export async function readFile(
  inputPath: string,
  encoding: "utf8" | "base64" = "utf8",
  offset = 0,
  length?: number,
) {
  const target = resolveTarget(inputPath);
  const handle = await fs.open(target, "r");

  try {
    const stat = await handle.stat();
    const bytesToRead = Math.min(
      length || config.maxFileBytes,
      Math.max(0, stat.size - offset),
      config.maxFileBytes,
    );
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, offset);

    return {
      path: target,
      size: stat.size,
      offset,
      bytes_read: bytesRead,
      truncated: offset + bytesRead < stat.size,
      encoding,
      data: buffer.subarray(0, bytesRead).toString(encoding),
    };
  } finally {
    await handle.close();
  }
}

export async function writeFile(
  inputPath: string,
  data: string,
  encoding: "utf8" | "base64" = "utf8",
  append = false,
) {
  const target = resolveTarget(inputPath);
  const buffer = Buffer.from(data, encoding);

  if (buffer.length > config.maxFileBytes) {
    throw new Error(`Write exceeds MAX_FILE_BYTES (${config.maxFileBytes})`);
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer, { flag: append ? "a" : "w" });

  auditLog("file_write", { path: target, bytes: buffer.length, appended: append });

  return {
    path: target,
    bytes_written: buffer.length,
    appended: append,
  };
}

export async function replaceInFile(
  inputPath: string,
  targetContent: string,
  replacementContent: string,
  allowMultiple = false,
) {
  const target = resolveTarget(inputPath);
  const original = await fs.readFile(target, "utf8");

  if (!original.includes(targetContent)) {
    throw new Error(`Target content was not found in file "${inputPath}". Verify exact whitespace, indentation, and newlines.`);
  }

  const occurrences = original.split(targetContent).length - 1;
  if (occurrences > 1 && !allowMultiple) {
    throw new Error(
      `Target content appears ${occurrences} times in file "${inputPath}". Provide more unique surrounding context or set allow_multiple: true.`,
    );
  }

  const updated = allowMultiple
    ? original.replaceAll(targetContent, replacementContent)
    : original.replace(targetContent, replacementContent);

  await fs.writeFile(target, updated, "utf8");

  auditLog("file_replace", { path: target, replacements: occurrences });

  return {
    path: target,
    replacements: allowMultiple ? occurrences : 1,
  };
}

export interface FileEntry {
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
}

export async function listFiles(
  inputPath: string,
  recursive = false,
  maxEntries = 500,
) {
  const root = resolveTarget(inputPath);
  try {
    const stat = await fs.stat(root);
    if (stat.isDirectory()) {
      currentWorkingDir = root;
    }
  } catch {}

  const entries: FileEntry[] = [];

  const visit = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entries.length >= maxEntries) return;
      const fullPath = path.join(directory, entry.name);
      const item: FileEntry = {
        path: fullPath,
        type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
      };

      if (entry.isFile()) {
        item.size = (await fs.stat(fullPath)).size;
      }

      entries.push(item);
      if (recursive && entry.isDirectory()) {
        await visit(fullPath);
      }
    }
  };

  await visit(root);
  return {
    root,
    entries,
    truncated: entries.length >= maxEntries,
  };
}

function matchesGlob(filename: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  const regex = new RegExp(`^${regexPattern}$`, "i");
  return regex.test(filename);
}

export interface SearchMatch {
  path: string;
  line?: number;
  snippet?: string;
}

export async function searchFiles(
  inputPath: string,
  pattern?: string,
  query?: string,
  caseSensitive = false,
  maxResults = 100,
) {
  const root = resolveTarget(inputPath);
  try {
    const stat = await fs.stat(root);
    if (stat.isDirectory()) {
      currentWorkingDir = root;
    }
  } catch {}

  const results: SearchMatch[] = [];

  let queryRegex: RegExp | null = null;
  if (query) {
    queryRegex = new RegExp(query, caseSensitive ? "g" : "gi");
  }

  const visit = async (directory: string): Promise<void> => {
    if (results.length >= maxResults) return;

    let dirEntries: Dirent[] = [];
    try {

      dirEntries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of dirEntries) {
      if (results.length >= maxResults) return;
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // Skip common noisy directories
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
          continue;
        }
        await visit(fullPath);
      } else if (entry.isFile()) {
        const filenameMatches = !pattern || matchesGlob(entry.name, pattern);
        if (!filenameMatches) continue;

        if (!queryRegex) {
          // Filename only match
          results.push({ path: fullPath });
        } else {
          // Content search
          try {
            const stat = await fs.stat(fullPath);
            if (stat.size > 2 * 1024 * 1024) continue; // Skip files > 2MB for grep

            const content = await fs.readFile(fullPath, "utf8");
            const lines = content.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) break;
              if (queryRegex.test(lines[i])) {
                queryRegex.lastIndex = 0; // Reset regex state
                results.push({
                  path: fullPath,
                  line: i + 1,
                  snippet: lines[i].trim(),
                });
              }
            }
          } catch {
            // Skip non-text or unreadable files
          }
        }
      }
    }
  };

  await visit(root);

  auditLog("file_search", {
    path: root,
    pattern: pattern || undefined,
    query: query || undefined,
    results: results.length,
  });

  return {
    root,
    results,
    truncated: results.length >= maxResults,
  };
}

export async function statPath(inputPath: string) {
  const target = resolveTarget(inputPath);
  const stat = await fs.stat(target);

  return {
    path: target,
    type: stat.isDirectory() ? "directory" : "file",
    size: stat.size,
    created_at: stat.birthtime.toISOString(),
    modified_at: stat.mtime.toISOString(),
    mode: stat.mode,
  };
}

export async function createDirectory(inputPath: string) {
  const target = resolveTarget(inputPath);
  await fs.mkdir(target, { recursive: true });
  auditLog("file_mkdir", { path: target });
  return { path: target, created: true };
}

export async function movePath(
  source: string,
  destination: string,
  overwrite = false,
) {
  const from = resolveTarget(source);
  const to = resolveTarget(destination);

  await fs.mkdir(path.dirname(to), { recursive: true });
  if (overwrite) {
    await fs.rm(to, { recursive: true, force: true });
  }

  await fs.rename(from, to);
  auditLog("file_move", { from, to, overwrite });
  return { source: from, destination: to };
}

export async function deletePath(inputPath: string, recursive = false) {
  const target = resolveTarget(inputPath);
  const parsed = path.parse(target);

  if (target === parsed.root) {
    throw new Error("Refusing to delete a filesystem root directory");
  }

  const stat = await fs.stat(target);
  if (stat.isDirectory() && !recursive) {
    throw new Error("recursive=true is required to delete a directory");
  }

  await fs.rm(target, { recursive, force: false });
  auditLog("file_delete", { path: target, recursive });
  return { path: target, deleted: true };
}
