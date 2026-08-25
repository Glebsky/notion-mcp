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
┌─────────────────────────────────┐
│     AI Agent (e.g. Notion)      │
└────────────────┬────────────────┘
                 │  Streamable HTTP (JSON-RPC / MCP)
                 ▼
┌─────────────────────────────────┐
│       Ngrok / Reverse Proxy     │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│   Notion Terminal MCP Server    │
│  - Timing-Safe Authentication   │
│  - Host Header Validation       │
│  - Sandboxed / Full Access FS   │
│  - Process Tree Manager         │
└─────────────────────────────────┘
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
Execute a terminal command on the host (PowerShell or cmd.exe).

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

#### Operational Guidelines for Agents
- Prefer `shell: "powershell"` for modern scripts, JSON manipulation, and file searches.
- In PowerShell, avoid interactive commands that block awaiting stdin (e.g., interactive prompts, `Read-Host`, nano, vim).
- Output is truncated at `MAX_OUTPUT_BYTES`. If `truncated: true`, direct output to a temporary file and read with `file_read` using `offset`.

---

### 3.2 `file_read`
Read text or binary files with optional chunking/offset.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Path to the file. |
| `encoding` | `"utf8" \| "base64"` | No | `"utf8"` | Content encoding ("utf8" for code/text, "base64" for binaries/images). |
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

### 3.3 `file_write`
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

### 3.4 `file_list`
List files and subdirectories in a directory path.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Directory path. |
| `recursive` | `boolean` | No | `false` | Scan directory recursively. |
| `max_entries` | `number` | No | `500` | Max entries to return (max: 10,000). |

#### Response Format
```json
{
  "root": "C:\\workspace\\project",
  "entries": [
    {
      "path": "C:\\workspace\\project\\package.json",
      "type": "file",
      "size": 1024
    },
    {
      "path": "C:\\workspace\\project\\src",
      "type": "directory"
    }
  ],
  "truncated": false
}
```

---

### 3.5 `file_stat`
Inspect file or directory metadata.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Target path. |

#### Response Format
```json
{
  "path": "C:\\workspace\\project\\package.json",
  "type": "file",
  "size": 1024,
  "created_at": "2026-08-25T08:00:00.000Z",
  "modified_at": "2026-08-25T08:30:00.000Z",
  "mode": 33206
}
```

---

### 3.6 `file_mkdir`
Create a directory and all missing parent directories.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Path of directory to create. |

#### Response Format
```json
{
  "path": "C:\\workspace\\project\\src\\components",
  "created": true
}
```

---

### 3.7 `file_move`
Move or rename a file or directory.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | `string` | Yes | - | Source path. |
| `destination` | `string` | Yes | - | Destination path. |
| `overwrite` | `boolean` | No | `false` | Overwrite destination if it already exists. |

#### Response Format
```json
{
  "source": "C:\\workspace\\project\\old_name.ts",
  "destination": "C:\\workspace\\project\\new_name.ts"
}
```

---

### 3.8 `file_delete`
Delete a file or directory.

#### Input Schema
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | `string` | Yes | - | Path to delete. |
| `recursive` | `boolean` | No | `false` | Set to `true` to delete non-empty directories. |

#### Response Format
```json
{
  "path": "C:\\workspace\\project\\temp.log",
  "deleted": true
}
```

---

## 4. Error Handling Protocol

When a tool fails, the response has `isError: true` with a formatted error message in JSON:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"error\": \"Access denied: path is outside sandbox directory\"\n}"
    }
  ],
  "isError": true
}
```

### Common Error Codes & Recovery Strategies
1. **Access denied (Outside sandbox)**: Check configured `FILES_ROOT` or work within current relative directory.
2. **Command Timed Out (`timedOut: true`)**: Split heavy operations into background scripts, smaller tasks, or pass an explicit `timeout_ms`.
3. **Truncated Output (`truncated: true`)**: Paginate output using `file_read` with `offset` and `length`.
4. **Refusing to delete filesystem root**: Safety check preventing accidental deletion of root drives (`C:\`, `/`).

---

## 5. Agent Workflow Recommendations

### Reading Large Codebases
1. Call `file_list` with `recursive: false` to understand repository structure.
2. Target specific directories rather than performing unbounded recursive listings.
3. Use `file_read` for individual files. If `size > 1,000,000`, read in segments via `offset`.

### Executing Terminal Tasks
1. Verify prerequisites before executing scripts (e.g. check if `node`, `python`, `git` are installed).
2. For long build commands, check `exitCode === 0`.
3. Read `stderr` even if `exitCode === 0` to catch non-fatal warnings and diagnostic info.
