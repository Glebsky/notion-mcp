import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "../config.js";
import { textResult, errorResult } from "./types.js";
import { executeCommand } from "./command.js";
import {
  readFile,
  writeFile,
  replaceInFile,
  searchFiles,
  listFiles,
  statPath,
  createDirectory,
  movePath,
  deletePath,
  getActiveWorkingDir,
  setActiveWorkingDir,
} from "./filesystem.js";

export function registerAllTools(server: McpServer): void {
  server.registerTool(
    "terminal_execute",
    {
      title: "Execute a terminal command",
      description:
        "Execute a PowerShell or cmd command on the host. This has unrestricted host privileges when FULL_ACCESS=true.",
      inputSchema: {
        command: z.string().min(1).describe("The command to execute"),
        shell: z.enum(["powershell", "cmd"]).default("powershell").describe("Shell type to execute command in"),
        cwd: z.string().optional().describe("Working directory for command execution"),
        timeout_ms: z
          .number()
          .int()
          .positive()
          .max(900_000)
          .optional()
          .describe("Command timeout in milliseconds (default: COMMAND_TIMEOUT_MS, max: 900000)"),
      },
    },
    async ({ command, shell, cwd, timeout_ms }) => {
      try {
        const result = await executeCommand(command, shell, cwd, timeout_ms);
        return textResult(result, result.exitCode !== 0 || result.timedOut);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "file_read",
    {
      title: "Read a file",
      description: "Read a text or binary file from the host filesystem.",
      inputSchema: {
        path: z.string().min(1).describe("Path to the file to read"),
        encoding: z.enum(["utf8", "base64"]).default("utf8").describe("File content encoding"),
        offset: z.number().int().nonnegative().default(0).describe("Byte offset to start reading from"),
        length: z
          .number()
          .int()
          .positive()
          .max(config.maxFileBytes)
          .optional()
          .describe(`Number of bytes to read (max: ${config.maxFileBytes})`),
      },
    },
    async ({ path: inputPath, encoding, offset, length }) => {
      try {
        const result = await readFile(inputPath, encoding, offset, length);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "file_write",
    {
      title: "Write a file",
      description: "Create, overwrite, or append to a file. Parent directories are created automatically.",
      inputSchema: {
        path: z.string().min(1).describe("Path to the file to write"),
        data: z.string().describe("Content to write into the file"),
        encoding: z.enum(["utf8", "base64"]).default("utf8").describe("Encoding of input data"),
        append: z.boolean().default(false).describe("If true, appends data to the end of the file"),
      },
    },
    async ({ path: inputPath, data, encoding, append }) => {
      try {
        const result = await writeFile(inputPath, data, encoding, append);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "file_replace",
    {
      title: "Replace text in file",
      description:
        "Replace an exact substring or block of code in a file without rewriting the whole file.",
      inputSchema: {
        path: z.string().min(1).describe("Path to the file"),
        target: z.string().min(1).describe("The exact text/code chunk to replace"),
        replacement: z.string().describe("The replacement text/code chunk"),
        allow_multiple: z
          .boolean()
          .default(false)
          .describe("If true, replaces all occurrences. If false, fails if target appears more than once."),
      },
    },
    async ({ path: inputPath, target, replacement, allow_multiple }) => {
      try {
        const result = await replaceInFile(inputPath, target, replacement, allow_multiple);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "file_search",
    {
      title: "Search files",
      description:
        "Search files by name pattern (e.g. *.ts) and/or search for text/regex inside file contents.",
      inputSchema: {
        path: z.string().min(1).describe("Base directory to search in"),
        pattern: z
          .string()
          .optional()
          .describe("Filename glob pattern (e.g. *.ts, *config*, *.json)"),
        query: z
          .string()
          .optional()
          .describe("Text or regex to search inside file contents"),
        case_sensitive: z
          .boolean()
          .default(false)
          .describe("Whether content search is case sensitive"),
        max_results: z
          .number()
          .int()
          .positive()
          .max(1000)
          .default(100)
          .describe("Maximum number of results to return"),
      },
    },
    async ({ path: inputPath, pattern, query, case_sensitive, max_results }) => {
      try {
        const result = await searchFiles(inputPath, pattern, query, case_sensitive, max_results);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "file_list",
    {
      title: "List files",
      description: "List files and directories at a host path.",
      inputSchema: {
        path: z.string().min(1).describe("Directory path to list"),
        recursive: z.boolean().default(false).describe("Whether to list subdirectories recursively"),
        max_entries: z
          .number()
          .int()
          .positive()
          .max(10_000)
          .default(500)
          .describe("Maximum number of items to return"),
      },
    },
    async ({ path: inputPath, recursive, max_entries }) => {
      try {
        const result = await listFiles(inputPath, recursive, max_entries);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "file_stat",
    {
      title: "Inspect a path",
      description: "Return metadata for a file or directory.",
      inputSchema: {
        path: z.string().min(1).describe("Path to inspect"),
      },
    },
    async ({ path: inputPath }) => {
      try {
        const result = await statPath(inputPath);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "file_mkdir",
    {
      title: "Create a directory",
      description: "Create a directory and any missing parent directories.",
      inputSchema: {
        path: z.string().min(1).describe("Path of directory to create"),
      },
    },
    async ({ path: inputPath }) => {
      try {
        const result = await createDirectory(inputPath);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "file_move",
    {
      title: "Move or rename a path",
      description: "Move or rename a file or directory.",
      inputSchema: {
        source: z.string().min(1).describe("Source path"),
        destination: z.string().min(1).describe("Destination path"),
        overwrite: z.boolean().default(false).describe("Whether to overwrite existing destination"),
      },
    },
    async ({ source, destination, overwrite }) => {
      try {
        const result = await movePath(source, destination, overwrite);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "file_delete",
    {
      title: "Delete a path",
      description:
        "Permanently delete a file or directory. Recursive directory deletion must be explicitly enabled.",
      inputSchema: {
        path: z.string().min(1).describe("Path of file or directory to delete"),
        recursive: z.boolean().default(false).describe("Required to be true to delete non-empty directories"),
      },
    },
    async ({ path: inputPath, recursive }) => {
      try {
        const result = await deletePath(inputPath, recursive);
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "workspace_get_cwd",
    {
      title: "Get current working directory",
      description: "Get the current active working directory and files root.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult({
          cwd: getActiveWorkingDir(),
          files_root: config.filesRoot,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "workspace_set_cwd",
    {
      title: "Set current working directory",
      description:
        "Change the active working directory for subsequent file operations and terminal commands (e.g. 'sandustry'). Allows using short relative paths within that project.",
      inputSchema: {
        path: z.string().min(1).describe("Subdirectory name or path to set as current working directory"),
      },
    },
    async ({ path: inputPath }) => {
      try {
        const cwd = setActiveWorkingDir(inputPath);
        return textResult({
          cwd,
          files_root: config.filesRoot,
          message: `Active working directory switched to: ${cwd}`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
