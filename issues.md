# Code Review Issues

Review date: 2026-08-28

This review covers the application source, IPC surface, worker operations, and current test setup. Production dependency audit: no known high-severity advisories (`npm audit --omit=dev --audit-level=high`).

## Critical

### 1. Renderer HTML injection can execute host code

**Locations:** `src/main/preload.js:6314`, `src/main/preload.js:8475`, `src/main/main.js:3068-3076`, `package.json:8`

Filesystem-controlled values such as `f.display_name`, `f.name`, and `f.destination` are inserted with `innerHTML`. A file named, for example, `<img src=x onerror="require('child_process').exec('...')">`, is interpreted as markup when listed or shown in an overwrite dialog. The window runs with `nodeIntegration: true`, `contextIsolation: false`, `sandbox: false`, and the start script adds `--no-sandbox`, so renderer script injection becomes arbitrary code execution as the current user.

Replace all untrusted `innerHTML` assignments with `textContent` (or construct elements explicitly). Then harden the BrowserWindow: enable `contextIsolation` and sandboxing, disable renderer Node integration, remove `--no-sandbox`, and expose a narrowly scoped API through `contextBridge`.

### 2. Any renderer code can run arbitrary shell commands

**Location:** `src/main/main.js:1112-1114`

The `command` IPC listener passes its `cmd` argument directly to `child_process.exec()` and ignores errors. Any renderer script, including an injected script, can execute an arbitrary command line.

Remove this generic IPC channel. For each necessary action, provide a dedicated IPC handler that validates inputs and uses `execFile()` with an argument array, or a safer Electron shell API.

### 3. File names and paths are interpolated into shell commands

**Locations:** `src/main/main.js:3341`, `src/main/main.js:3366`, `src/main/main.js:3419`, `src/main/main.js:3552`, `src/main/main.js:4017-4020`, `src/workers/compression_worker.js:519`, `src/workers/compression_worker.js:536`

Context-menu actions and archive extraction interpolate user-controlled paths into `exec()` or `execSync()` strings. Quoting is inconsistent and does not safely handle quote characters in a filename. Launcher metadata is also passed to a shell without a strict format contract.

Use `execFile()`/`spawn()` with fixed executable names and argument arrays. Replace the `du | awk` pipeline with Node filesystem accounting or a non-shell subprocess. Do not build executable shell strings from paths or `.desktop` launcher fields.

## High

### 4. Overwrite deletes the destination before a replacement succeeds

**Locations:** `src/main/main.js:968-1011`

`overwrite_one` and `overwrite_all` synchronously remove the existing destination, then dispatch asynchronous copy or move work. A worker failure, cancellation, disk-full condition, or later race leaves the original permanently deleted and the replacement absent.

Implement overwrite in the worker as an atomic workflow: copy to a unique temporary sibling, verify completion, then replace the old destination. Offer a trash/backup path where atomic replacement is unavailable. Add failure-injection tests for copy and move overwrite flows.

### 5. A partially failed directory move can delete source files that did not move

**Location:** `src/workers/move_worker.js:115-123`, `src/workers/move_worker.js:164-176`

Failed per-file moves are caught, reported, and skipped. Unless the user explicitly cancels, the worker then recursively removes every source directory. This can erase files that failed to move, converting a recoverable partial operation into data loss. The completion message also states that all files were moved.

Track failures and do not remove a source directory unless all of its descendants moved successfully. Return a failed/partial status and a list of failed entries to the UI. Test a forced `gio.mv` failure inside a directory tree.

### 6. Saved network credentials are stored in plaintext

**Locations:** `src/main/main.js:2505-2515`, `src/main/main.js:2519-2531`

Saved connection settings, including passwords supplied by the network-connect dialog, are serialized into `network.json` under Electron user data without encryption or access controls beyond the user account.

Store secrets in the system keyring or encrypt them with Electron `safeStorage`; persist only a connection identifier and non-sensitive metadata in `network.json`. Add migration for existing plaintext password fields and remove them after successful migration.

## Medium

### 7. Copy and move report success after per-file failures

**Locations:** `src/workers/paste_worker.js:156-192`, `src/workers/paste_worker.js:216-233`, `src/workers/move_worker.js:115-123`, `src/workers/move_worker.js:188-198`

Both workers catch individual operation failures and continue. They then emit `cp_done`/`mv_done` and a generic "Done" message without a failure count or failed-item list. The caller cannot reliably distinguish a complete operation from a partial one.

Collect structured failures, use a `partial` or `failed` completion state, and display the affected entries. Ensure callers only refresh or mutate UI state for entries whose operation succeeded.

### 8. The documented test command does not run the test suite

**Locations:** `package.json:8`, `package.json:9`, `src/main/tests/autocomplete.test.js:1`, `src/main/tests/autocomplete.test.js:11-13`

`npm test` runs only `node`, rather than Jest or Playwright. Running Jest directly currently fails because it discovers the Playwright ESM test and cannot parse its `import` syntax. The Playwright test is also marked `test.only`, and its Electron cleanup is commented out.

Define separate scripts, for example `test:unit` for Jest and `test:e2e` for Playwright, with separate test-match configuration. Remove `test.only` and always close the Electron instance in `afterAll`. At review time, `npx jest --runInBand` reported 14 passing assertions in two suites but failed the autocomplete suite during parsing.

### 9. Archive worker error handlers throw outside the operation flow

**Location:** `src/workers/compression_worker.js:133-147`

`archiver` warning/error event listeners report a message and then throw. The throw is not coordinated with cleanup or a structured completion event, so the main process can be left with an incomplete archive, stale progress UI, and no reliable failure state.

Convert archive errors to one guarded failure path that closes the output stream, removes the partial archive where appropriate, clears progress, and sends an explicit `compress_failed` message. Add a test that forces an archiver stream error.

## Verification Performed

- Static inspection of main process, preload, renderer, and worker code.
- `npx jest --runInBand`: two test suites passed; the Playwright autocomplete test failed Jest parsing.
- `npm audit --omit=dev --audit-level=high`: no known production dependency vulnerabilities.