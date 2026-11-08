# Windows packaging and HTTP 504

Run `build-portable.bat` or `npm run package:portable` from the project directory. The default output is `release/MCP Terminal Portable.exe`. No running MCP server needs to be restarted for packaging.

## Reuse the installed Electron runtime

`electron-builder.yml` sets `electronDist: node_modules/electron/dist`. The Windows x64 build reuses Electron already installed by npm instead of downloading another copy during packaging. The installed Electron version must match `node_modules/electron/package.json`, and its architecture must match the x64 target.

If that directory or `electron.exe` is missing, install the project dependencies normally (`npm ci`) with access to the official package/download services. Do not point `electronDist` at an unrelated application or a different Electron version.

## If a gateway timeout occurs

HTTP 504 is a response from a remote gateway, not a TypeScript compilation error. Preserve the log lines immediately before the stack trace: they identify the requested artifact and stage. Reusing local Electron avoids its redundant download, but first-time packaging can still need official builder helpers (NSIS, icons, compression tools) unless they are already cached.

Do not clear working caches as the first response, disable TLS/certificate validation, disable integrity checks, or download replacement binaries from an untrusted mirror. If an official helper download fails, retry after the service or network recovers and keep the original error/URL.

Portable compression can take several minutes, depending on disk and CPU. A message saying `building target=portable` means work has started, not that the final EXE is complete. Wait for electron-builder to exit with code 0 before copying or launching the result.

## Isolated verification

To avoid overwriting an existing or running release, use `node node_modules/electron-builder/cli.js --win portable --x64 --publish never --config.directories.output=release/packaging-diagnostic`. A successful diagnostic build writes its EXE into that separate folder. Never delete the entire release directory to fix a download error: it may contain portable user data.
