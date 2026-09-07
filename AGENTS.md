# Agent Specification: Notion Terminal MCP

Technical specification and operational guide for AI Agents (Notion Custom Agents, Claude, Cursor, Antigravity, and autonomous LLM agents) interacting with this MCP server.

---

## 1. System Overview

- **Server Identifier**: `notion-terminal-files`
- **Protocol**: [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- **Transport**: Streamable HTTP (`/mcp`)
- **Health Check**: `GET /health`
- **Authentication**: HTTP Authorization header (`Authorization: Bearer <API_KEY>`) or `x-api-key: <API_KEY>`

```
┌────────────────────────────────────────┐
│        AI Agent (e.g. Notion)          │
└───────────────────┬────────────────────┘
                    │  Streamable HTTP (JSON-RPC / MCP)
                    ▼
┌────────────────────────────────────────┐
│          Ngrok / Public Tunnel         │
└───────────────────┬────────────────────┘
                    │
┌───────────────────▼────────────────────┐
│      Notion Terminal MCP Server        │
│  - Timing-Safe Authentication          │
│  - Host Header Validation              │
│  - Sandboxed / Full Access FS          │
│  - UTF-8 Windows Console Integration   │
│  - Structured Audit Logging            │
└────────────────────────────────────────┘
```

---

## 2. Security & Execution Model

### 2.1 Sandboxing (`FULL_ACCESS`)
- **When `FULL_ACCESS=false` (Default Sandbox)**:
  - All file and directory paths are strictly jailed within `FILES_ROOT` (e.g., `./workspace` or custom configured path).
  - Path traversal attempts (`../`, symlink escapes, absolute paths pointing outside `FILES_ROOT`) are immediately rejected with an error.
  - Working directories (`cwd`) for `terminal_execute` default to `FILES_ROOT`.
- **When `FULL_ACCESS=true` (Unrestricted Mode)**:
  - The agent has full access to the host filesystem with permissions of the host user running the server.

### 2.2 Limits and Buffers
- `MAX_OUTPUT_BYTES` (default: 1 MB): Terminal output exceeding this limit is capped with `truncated: true`.
- `MAX_FILE_BYTES` (default: 10 MB): File read/write operations exceeding this limit require offset pagination or are rejected.
- `COMMAND_TIMEOUT_MS` (default: 120,000 ms, max: 900,000 ms): Long running processes are automatically killed with their full process tree.

---

## 3. Tool Specifications

### 3.1 `terminal_execute`
Execute a terminal command on the host (PowerShell or cmd.exe) with native UTF-8 encoding.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `command` | `string` | Yes | - | The shell command string to execute. |
| `shell` | `"powershell" \| "cmd"` | No | `"powershell"` | Target Windows shell interpreter. |
| `cwd` | `string` | No | Sandbox root | Absolute or relative working directory. |
| `timeout_ms` | `number` | No | Server default | Execution timeout in milliseconds (max: 900,000). |

#### Response Format
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"exitCode\": 0,\n  \"stdout\": \"...\",\n  \"stderr\": \"...\",\n  \"timedOut\": false,\n  \"truncated\": false\n}"
    }
  ],
  "isError": false
}
```

---

### 3.2 `file_search`
Search files by glob pattern (e.g., `*.ts`) and/or search for text/regex inside file contents (Grep).

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Base directory to search within. |
| `pattern` | `string` | No | - | Filename glob pattern (e.g. `*.ts`, `*config*`). |
| `query` | `string` | No | - | Substring or regex pattern to search within files. |
| `case_sensitive` | `boolean` | No | `false` | Case sensitive search matching. |
| `max_results` | `number` | No | `100` | Maximum number of matches to return (max: 1,000). |

#### Response Format
```json
{
  "root": "C:\\workspace\\project",
  "results": [
    {
      "path": "C:\\workspace\\project\\src\\config.ts",
      "line": 15,
      "snippet": "const PORT = integerEnv(\"PORT\", 3000);"
    }
  ],
  "truncated": false
}
```

---

### 3.3 `file_replace`
Replace an exact block of code or text inside a file without rewriting the entire file.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Path to the target file. |
| `target` | `string` | Yes | - | Exact string/block of code to replace. |
| `replacement` | `string` | Yes | - | Replacement string/block of code. |
| `allow_multiple` | `boolean` | No | `false` | Allow replacing multiple occurrences across the file. |

#### Response Format
```json
{
  "path": "C:\\workspace\\project\\src\\config.ts",
  "replacements": 1
}
```

---

### 3.4 `file_read`
Read text or binary files with optional chunking/offset.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Path to the file. |
| `encoding` | `"utf8" \| "base64"` | No | `"utf8"` | Content encoding ("utf8" for text, "base64" for binaries). |
| `offset` | `number` | No | `0` | Byte offset to begin reading. |
| `length` | `number` | No | `MAX_FILE_BYTES` | Maximum number of bytes to read. |

#### Response Format
```json
{
  "path": "C:\\workspace\\project\\src\\main.ts",
  "size": 4096,
  "offset": 0,
  "bytes_read": 4096,
  "truncated": false,
  "encoding": "utf8",
  "data": "... file content ..."
}
```

---

### 3.5 `file_write`
Create, overwrite, or append content to a file. Missing parent directories are created automatically.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Path to target file. |
| `data` | `string` | Yes | - | Text content or base64-encoded binary data. |
| `encoding` | `"utf8" \| "base64"` | No | `"utf8"` | Encoding of `data`. |
| `append` | `boolean` | No | `false` | If `true`, appends data instead of overwriting. |

#### Response Format
```json
{
  "path": "C:\\workspace\\project\\src\\main.ts",
  "bytes_written": 128,
  "appended": false
}
```

---

### 3.6 `file_list`
List files and subdirectories in a directory path.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Directory path. |
| `recursive` | `boolean` | No | `false` | Scan directory recursively. |
| `max_entries` | `number` | No | `500` | Max entries to return (max: 10,000). |

---

### 3.7 `file_stat`
Inspect file or directory metadata (size, created/modified timestamps, mode).

#### Input Schema
| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | Yes | Target path to inspect. |

---

### 3.8 `file_mkdir`
Create a directory and all missing parent directories.

#### Input Schema
| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | Yes | Path of directory to create. |

---

### 3.9 `file_move`
Move or rename a file or directory.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | `string` | Yes | - | Source path. |
| `destination` | `string` | Yes | - | Destination path. |
| `overwrite` | `boolean` | No | `false` | Overwrite destination if it already exists. |

---

### 3.10 `file_delete`
Delete a file or directory.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Path to delete. |
| `recursive` | `boolean` | No | `false` | Set to `true` to delete non-empty directories. |

---

### 3.11 `workspace_get_cwd`
Get the current active working directory and root directory path.

#### Input Schema
*(No parameters)*

#### Response Format
```json
{
  "cwd": "C:\\OSPanel\\home\\sandustry",
  "files_root": "C:\\OSPanel\\home"
}
```

---

### 3.12 `workspace_set_cwd`
Change the active working directory for subsequent file operations and terminal commands (e.g. switch to `"sandustry"`). Allows using short relative paths within that project.

#### Input Schema
| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | Yes | Subdirectory name (e.g. `"sandustry"`) or path to set as current working directory. |

#### Response Format
```json
{
  "cwd": "C:\\OSPanel\\home\\sandustry",
  "files_root": "C:\\OSPanel\\home",
  "message": "Active working directory switched to: C:\\OSPanel\\home\\sandustry"
}
```

---

## 4. Agent Best Practices & Recommended Workflows

### 1. Code Editing Workflow
- **Search first**: Use `file_search` with `query` to locate the exact file and line number containing relevant functions or classes.
- **Inspect**: Use `file_read` to inspect surrounding code context.
- **Targeted Edits**: Use `file_replace` with a distinct surrounding chunk of code to perform edits cleanly without rewriting entire files.

### 2. Terminal Commands
- UTF-8 encoding is enabled by default for both PowerShell and cmd.exe. Cyrillic and multilingual characters are preserved properly.
- Long-running commands automatically terminate after `COMMAND_TIMEOUT_MS` along with any spawned child processes.

### 3. Relative Paths & Multi-Project Workspaces
- You can freely use short relative paths like `src/index.ts`, `sandustry/src/index.ts`, or `./package.json`.
- The server automatically resolves relative paths against the active project folder.
- Use `workspace_set_cwd(path: "project_name")` or pass `cwd` in `terminal_execute` or inspect a directory with `file_list` / `file_search` to switch the active project directory at any time.
