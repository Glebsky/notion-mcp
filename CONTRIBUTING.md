# Contributing

Thanks for helping improve Notion Terminal MCP.

## Development Workflow

### 1. Environment Setup

```powershell
npm install
Copy-Item .env.example .env
npm run token
```

### 2. Running in Development Mode

- **Headless MCP Server (CLI)**:
  ```powershell
  npm run dev
  ```
- **Desktop Application (Electron + Vite React)**:
  ```powershell
  npm run app:dev
  ```

### 3. Verification & Type Checking

Before submitting changes, make sure all TypeScript projects compile cleanly without errors:

```powershell
npm run check
npm run build
```

### 4. Testing Windows Executable Packaging

To verify that packaging of Windows binaries functions correctly:

```powershell
npm run package:portable   # Test Portable binary in release/
npm run package:installer  # Test NSIS setup installer in release/
npm run package:exe        # Test both
```

Keep restricted mode (`FULL_ACCESS=false`) enabled while developing. Never commit `.env`, secret API keys, access tokens, personal filesystem paths, tunnel logs, generated output in `release/`, or downloaded `tools/cloudflared.exe`.

## Adding or Modifying Tools

When adding or modifying an MCP tool:
1. Implement the tool handler in `src/tools/` with strict Zod input schemas.
2. Register the tool in `src/tools/index.ts`.
3. Update [AGENTS.md](AGENTS.md) with exact input schemas, response formats, and agent best practices.
4. Update the tool tables in both [README.md](README.md) and [USER_GUIDE_RU.md](USER_GUIDE_RU.md).

## Pull Requests

1. Keep each change focused and minimal.
2. Explain the rationale and security implications of your change.
3. Verify that `npm run check` and `npm run build` succeed with zero errors.
4. Ensure documentation is kept in sync across English and Russian docs.

Security vulnerabilities must be reported privately as described in [SECURITY.md](SECURITY.md).

