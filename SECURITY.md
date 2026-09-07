# Security Policy

## Supported versions

Security fixes are applied to the latest release on the default branch.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature under the repository's **Security** tab. Do not disclose a suspected vulnerability in a public issue or discussion.

Include the affected version, reproduction steps, potential impact, and any suggested mitigation. Remove API keys, access tokens, personal paths, tunnel URLs, command output containing secrets, and other private data from the report.

## Operational Warning & Threat Model

This project exposes powerful host capabilities over MCP:
1. **Terminal Command Execution (`terminal_execute`)**: Powershell and CMD execution on the host machine.
2. **Filesystem Operations (`file_*`)**: Reading, writing, modifying, and deleting files and directories.
3. **Workspace Management (`workspace_*`)**: Switching active working directory across projects.
4. **Host Browser Automation (`browser_*`)**: Launching Chrome/Edge, interacting with DOM elements, evaluating arbitrary JavaScript, and accessing local web services (e.g. `http://localhost:*`).

### Security Controls & Best Practices

- **Sandboxing (`FULL_ACCESS=false`)**: Keep sandboxed mode enabled whenever possible. All filesystem operations and terminal working directories will be strictly restricted within `FILES_ROOT`. Any attempts at path traversal (`../`, absolute outside paths, symlink escapes) are rejected.
- **Unrestricted Mode (`FULL_ACCESS=true`)**: Grants remote MCP tools the full privileges of the Windows user account hosting the process. Only enable this in trusted, private local environments.
- **Authentication**: All MCP endpoints require a minimum 32-character secret key via `Authorization: Bearer <API_KEY>` or `x-api-key: <API_KEY>`, verified using timing-safe comparison (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.
- **Host Header Validation**: Prevents DNS rebinding and host spoofing attacks via `ALLOWED_HOSTS`.
- **Public Tunneling**: Never expose the local HTTP port directly to the raw internet without an authenticated HTTPS gateway or encrypted tunnel (Ngrok SDK or Cloudflare Tunnel).
