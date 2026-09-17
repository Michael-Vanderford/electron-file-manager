## Todo List

### P0 - Security and Data Safety

- [ ] Remove the generic `command` IPC channel in `src/main/main.js`; replace it with narrowly scoped handlers using validated arguments and `execFile()`.
- [ ] Replace shell interpolation of file paths in `src/main/main.js`, `src/common/libfs.js`, and `src/workers/compression_worker.js` with argument-based process APIs or Node filesystem APIs.
- [ ] Replace filesystem-controlled `innerHTML` assignments in `src/main/preload.js`, renderer scripts, and dialogs with `textContent` or explicit DOM construction.
- [ ] Harden the main `BrowserWindow`: disable renderer Node integration, keep context isolation and sandbox enabled, remove the `--no-sandbox` start flag, and expose only required APIs through `contextBridge`.
- [ ] Move saved network passwords out of plaintext `network.json`; use Electron `safeStorage` or the system keyring and migrate existing credentials.
- [ ] Make overwrite operations atomic: copy to a temporary sibling, verify success, then replace the destination. Preserve the original when copy, move, cancellation, or disk-full handling fails.
- [ ] Prevent directory moves from deleting the source tree after partial failure. Report `complete`, `partial`, and `failed` outcomes with failed paths.

### P1 - Correctness and Reliability

- [ ] Keep mounted-device discovery single-sourced through `get_mounts()`; do not merge the same GIO mount list from `get_drives()` into the sidebar.
- [ ] Add a focused regression test proving one sidebar entry per GIO mount and covering the current `mounts` IPC payload.
- [ ] Make copy, move, delete, compress, and extract workers return structured results with failure counts and affected paths instead of unconditional success messages.
- [ ] Refactor archive error handling into one cleanup path that closes streams, removes incomplete archives when appropriate, clears progress state, and emits an explicit failure event.
- [ ] Add cancellation and failure-injection tests for overwrite, copy, move, compression, and extraction operations.
- [ ] Review watcher lifecycle handling for repeated navigation and window close; verify that every watcher is stopped and no stale callback remains.

### P1 - Test Infrastructure

- [ ] Keep Jest and Playwright test discovery separate so unit tests never parse E2E files.
- [ ] Remove `test.only` from `src/main/tests/autocomplete.test.js` and restore guaranteed Electron cleanup in `afterAll`.
- [ ] Make `npm test` run the intended complete unit suite and document the focused E2E command separately.
- [ ] Fix the autocomplete E2E timeout, then run the full E2E suite with a fresh profile and verify the app process always exits.
- [ ] Add smoke coverage for launch, initial directory rendering, sidebar mount listing, navigation, and clean shutdown.
- [ ] Remove or refresh obsolete snapshots after confirming they are no longer needed.

### P2 - Maintainability and Product Quality

- [ ] Consolidate duplicated logic between `src/main/main.js` and `src/main/bak/main.js`, or clearly mark the backup file as excluded from maintenance.
- [ ] Replace remaining shell-based disk usage and launcher operations with safe platform APIs where possible.
- [ ] Document Linux runtime prerequisites for GIO, `udisksctl`, SSHFS, SMB, MTP, and optional external applications.
- [ ] Add user-visible error states for unavailable mounts, permission failures, cancelled operations, and inaccessible network locations.
- [ ] Add coverage for hidden files, broken symlinks, remote mounts, escaped mount paths, and read-only locations.
- [ ] Run `npm audit --omit=dev --audit-level=high` before releases and record the result in release notes.

### Completed

- [x] Add terminal command in settings
