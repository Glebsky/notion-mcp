# Notion Terminal MCP

[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-7c3aed)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An authenticated, production-ready remote **Model Context Protocol (MCP)** server providing **Terminal Execution** and **Filesystem Tools** to **Notion Custom Agents**, Claude, Cursor, and autonomous AI agents over **Streamable HTTP**.

Includes built-in zero-config public tunneling via the official **Ngrok Node.js SDK** (`@ngrok/ngrok`).

📖 **Документация на русском языке доступна в [USER_GUIDE_RU.md](USER_GUIDE_RU.md)**.
🤖 **Agent Specifications & JSON Schemas available in [AGENTS.md](AGENTS.md)**.

---

## Features

- 🖥️ **Liquid Glass Desktop GUI App**: Modern Electron + React desktop interface with system tray integration (hide from taskbar, background execution), live status cards, real-time audit log stream, one-click Notion credentials copy, and visual settings editor.
- ⚡ **Streamable HTTP Transport**: Modern MCP server implementation running on Express.

- 🌐 **Built-in Ngrok Tunnel**: Expose your local MCP server to Notion with a single command (`npm run start` or `npm run dev`) using `@ngrok/ngrok`.
- 💻 **Terminal Execution**: Execute PowerShell or cmd commands with configurable timeouts, working directories, and recursive process tree termination.
- 🌍 **Browser Automation**: Launch host browsers (Chrome/Edge), navigate, execute arbitrary JavaScript, click elements, fill inputs, extract DOM text/HTML, and capture screenshots.
- 📁 **Filesystem Operations**: Full set of tools for reading, writing, moving, listing, statting, and deleting files and directories.
- 🔒 **Security & Sandboxing**:
  - **Sandboxed Mode (`FULL_ACCESS=false`)**: Strict path containment inside a configured `FILES_ROOT` with path traversal defense.
  - **Full Host Mode (`FULL_ACCESS=true`)**: Unrestricted access when you need full host automation.
  - **Timing-Safe Auth**: Constant-time comparison (`crypto.timingSafeEqual`) for Bearer tokens and API keys.
  - **Host Header Validation**: Prevents DNS rebinding and unauthorized host header spoofing.
- 🤖 **Agent-First Design**: Detailed specifications and JSON schemas optimized for AI models ([AGENT_SPEC.md](AGENT_SPEC.md)).

---

## Quick Start

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Speedstu/notion-terminal-mcp.git
cd notion-terminal-mcp
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` or run the setup script:

```powershell
# Automated setup (generates a secure 32+ character API key)
.\setup.ps1
```

Or manually:

```powershell
Copy-Item .env.example .env
# Generate a secure token:
npm run token
```

Edit your `.env` file:

```ini
# Required: Secure API Key for Notion
MCP_API_KEY=your_generated_32_char_api_key

PORT=3000
HOST=127.0.0.1

# Ngrok Public Tunnel (Optional but recommended for Notion)
NGROK_ENABLED=true
NGROK_AUTHTOKEN=your_ngrok_authtoken_here
NGROK_DOMAIN=your-static-name.ngrok-free.app

# Security & Sandboxing
FULL_ACCESS=false
FILES_ROOT=./workspace
ALLOWED_HOSTS=localhost:3000;127.0.0.1:3000;*.ngrok-free.app;*.ngrok.app;*.ngrok-free.dev
```

### 3. Build & Run

```bash
# Build TypeScript
npm run build

# Start production server
npm run start
```

For development with hot reload:

```bash
npm run dev
```

When started with `NGROK_ENABLED=true`, the server will output connection details ready to paste into Notion:

```text
============================================================
             NOTION MCP AGENT CONNECTION READY             
============================================================
URL to paste into Notion:  https://your-domain.ngrok-free.app/mcp

Authentication Header:
  Header Name:   Authorization
  Header Value:  Bearer <your_token>
============================================================
```

---

## Connecting to Notion Custom Agents

1. In Notion, open **Settings & members** → **Connections** (or open your **Notion Agent configuration**).
2. Add a new **Custom MCP Connection**.
3. Set **Server URL** to:
   ```text
   https://your-domain.ngrok-free.app/mcp
   ```
4. Set **Authentication**:
   - Header Name: `Authorization`
   - Header Value: `Bearer <YOUR_MCP_API_KEY>`
5. Test the connection. Notion will automatically discover all 7 tools (`terminal_execute`, `file_read`, `file_write`, `file_list`, `file_stat`, `file_mkdir`, `file_move`, `file_delete`).

---

## Available MCP Tools

See [AGENT_SPEC.md](AGENT_SPEC.md) for full JSON schemas, parameters, and return types.

| Tool | Description |
|---|---|
| `terminal_execute` | Execute PowerShell or cmd commands with UTF-8 encoding and timeout options. |
| `file_search` | Search files by name glob (`*.ts`) and/or search for text/regex inside files (Grep). |
| `file_replace` | Safely replace an exact block of code or text in a file without rewriting it completely. |
| `file_read` | Read file contents (UTF-8 or Base64) with offset pagination for large files. |
| `file_write` | Create, overwrite, or append content to files (creates missing directories). |
| `file_list` | List directory contents recursively or flat with file sizes. |
| `file_stat` | Inspect file/directory metadata (size, created/modified timestamps, mode). |
| `file_mkdir` | Create directories recursively. |
| `file_move` | Move or rename files and directories. |
| `file_delete` | Safely delete files or directories (`recursive: true` required for directories). |


---

## Configuration Reference (`.env`)

| Variable | Default | Description |
|---|---|---|
| `MCP_API_KEY` | *required* | Secret key for authentication (min 32 characters). |
| `PORT` | `3000` | Port for the HTTP server. |
| `HOST` | `127.0.0.1` | Host address to bind to. |
| `NGROK_ENABLED` | `false` | Enable/disable automatic ngrok tunnel creation on start. |
| `NGROK_AUTHTOKEN` | `""` | Ngrok authtoken (optional if configured globally via ngrok CLI). |
| `NGROK_DOMAIN` | `""` | Static/custom ngrok domain (e.g. `xyz.ngrok-free.app`). |
| `ALLOWED_HOSTS` | `localhost:3000;...` | Semicolon-separated list of allowed `Host` headers. |
| `FULL_ACCESS` | `false` | When `false`, restricts file operations and terminal `cwd` to `FILES_ROOT`. |
| `FILES_ROOT` | `./workspace` | Base directory for the sandbox when `FULL_ACCESS=false`. |
| `COMMAND_TIMEOUT_MS` | `120000` | Default timeout for terminal commands (2 minutes). |
| `MAX_OUTPUT_BYTES` | `1048576` | Max stdout/stderr capture size (1 MB). |
| `MAX_FILE_BYTES` | `10485760` | Max file size read/write limit per request (10 MB). |

---

## Project Structure

```
notion-terminal-mcp/
├── src/
│   ├── config.ts              # Type-safe environment and validation
│   ├── index.ts               # Server entry point & lifecycle
│   ├── server.ts              # Express setup & MCP Streamable HTTP endpoint
│   ├── middleware/
│   │   ├── auth.ts            # Timing-safe token authentication
│   │   └── host.ts            # Host header validation
│   ├── tools/
│   │   ├── command.ts         # Process tree management & execution
│   │   ├── filesystem.ts      # Sandboxed filesystem CRUD operations
│   │   ├── index.ts           # MCP tool registrations
│   │   └── types.ts           # MCP result helpers & interfaces
│   └── tunnel/
│       └── ngrok.ts           # Ngrok SDK manager & Notion connection banner
├── AGENT_SPEC.md              # Technical specification for AI Agents
├── package.json
├── tsconfig.json
└── setup.ps1                  # PowerShell initial setup script
```

---

## NPM Scripts

- `npm run app:start` — Build and launch the **Desktop GUI App** (Electron + Liquid Glass UI) for local use/testing without packaging into exe.
- `npm run app:dev` — Launch the Desktop App in live development mode with hot-reload.
- `npm run package:portable` — Build a standalone **Portable `.exe`** (no installation required). Output: `release/Notion Terminal MCP <version>-portable.exe`.
- `npm run package:installer` — Build a Windows **Setup/Installer `.exe`** (NSIS wizard). Output: `release/Notion Terminal MCP <version>.exe`.
- `npm run package:exe` — Build **both** Portable and Installer executable packages at once.
- `npm run build` — Compile TypeScript server, Electron scripts, and React renderer.
- `npm run start` — Run headless MCP server from `dist/index.js` (CLI mode).
- `npm run dev` — Run headless MCP server with `tsx watch` (CLI dev mode).
- `npm run check` — Type-check TypeScript codebase without emitting files.
- `npm run token` — Generate a cryptographically secure random token for `MCP_API_KEY`.

---

## Packaging Executables (.exe)

When you need standalone Windows binaries (`.exe`), run:

| Command | Target | Output in `release/` |
|---|---|---|
| `npm run package:portable` | Portable single executable | `Notion Terminal MCP <version>-portable.exe` |
| `npm run package:installer` | NSIS Setup Wizard (Start Menu & Desktop shortcuts) | `Notion Terminal MCP <version>.exe` |
| `npm run package:exe` | Both targets (Portable + Installer) | Both files above |

> [!NOTE]
> `npm run app:start` only compiles TypeScript and runs Electron live in development/test mode. It does **not** create `.exe` files in `release/`. To generate `.exe` binaries, always use the `npm run package:*` commands.


---

## Security Policy

Please review [SECURITY.md](SECURITY.md) for security considerations and vulnerability reporting guidelines.
