# Release verification gates

Use disposable local directories/profiles and dedicated test mounts. These gates must not operate destructively on personal files or ordinary network mounts.

## Automated checks

- Run `npm run test:regression`. Linux UI tests automatically run under Xvfb with Electron forced onto X11 and inherited Wayland/desktop activation variables removed; install `xvfb-run` first. Playwright rejects focused tests when `CI` is set.
- Build the actual target artifact. Packaging includes `src`, production dependencies and package metadata; first-party tests, historical backups and previous `dist` installers are excluded.
- Set `EFM_PACKAGED_EXECUTABLE` to the built executable and run `npm run test:e2e -- e2e/packaged.spec.js`. With no executable configured this test is explicitly skipped. It checks packaged launch, navigation, copying/renaming/deleting fixture files, source preservation, icons, PNG decoding, ZIP dependency loading/output, About and shutdown. Linux uses an empty PATH to test absent optional desktop commands. Test launch explicitly uses `--no-sandbox`; certify the intended installed sandbox configuration separately.
- On Windows, run the Windows Shell integration scenario on Windows itself. Simulated providers and Windows dependency-collection tests do not satisfy this gate.
- Run a fresh production dependency audit before release and review advisories. Do not change dependencies automatically based only on an audit result.

## Required target/environment checks still open

- Actual Windows installer/build and native Shell/helper behavior; macOS if shipping it.
- Real keyring/DPAPI credential round-trip, unavailable/locked backend and recovery. Linux `basic_text` is not accepted for new password storage. Legacy plaintext remains private and recoverable while storage is unavailable; successful migration removes plaintext from the active and last-good files. A connection may succeed while reporting that saving failed.
- Supplementary-group and ACL behavior using real unprivileged identities/ACL fixtures; mode-bit metadata is not a full ACL evaluator.
- Disposable physical USB/MTP insertion, removal, mount/unmount and reconnect, with descriptive names and no duplicate entries. Never certify this using simulated IPC alone.
- Disposable real-network mounts: blocked/disconnected access and recovery, accurate URI/GVFS capacity, navigation/close during pending work and resource bounds. Remaining synchronous main-process filesystem calls are tracked in R23.
- Dedicated cross-device transfers, interrupted overwrite publication, conflict/cancel, filesystems without hard-link support, orphan locks and external-writer races. Keep safety limits open until established directly.
- Native Recent-file discovery; keyboard-only/accessibility flows for special views; real remote/photo-directory performance.
- XCF/other codec compatibility and decoder behavior on every shipping target. GIF/WebP intentionally render directly through Chromium; the cache budget protects served URLs for the app session and is soft while those files are pinned. OS-killed decoder temporary files still need a retention policy.

Record the artifact/runtime, OS, sandbox mode, dataset, actual results, failures and skipped gates with each release. A passing development suite or a Linux unpacked smoke is not cross-platform certification.

## Dependency audit follow-up (2026-10-31)

The lockfile audit started at 47 findings (2 critical, 4 high, 40 moderate, 1 low). Jest 25 was upgraded to 30.5.2, Archiver 4 to 8.0.0, and compatible transitive fixes were applied. Archiver now uses its named ZIP/TAR constructors through asynchronous ESM import; the unit command enables Jest's VM module support. Electron remains 44.9.3.

Only `readdir-glob` overrides minimatch to `^11.0.3`: its matcher calls use `Minimatch.match`, which remains available. This removes the runtime matcher advisory. `npm audit --omit=dev` reports zero findings. The full audit still reports 32 findings (31 moderate, 1 low), all in development dependencies, primarily propagated from glob/minimatch and deepmerge.

Do not apply `npm audit fix --force` indiscriminately: npm proposes an obsolete electron-builder downgrade. Do not globally override minimatch or glob: minimatch 11 removes regex/internal APIs used by legacy consumers, and glob 14 changes matcher representations. The installed deepmerge 4.3.1 is still its latest release and has an unpatched low-severity advisory. Revisit these findings when upstream Jest/build-tool dependencies adopt compatible patched versions.

The installed dependency tree now matches the manifest and lockfile (`npm ls --depth=0` succeeds). Earlier local node_modules had different Jest, Archiver and electron-builder versions, so historical test results did not verify that exact old lockfile.

Linux focused tests use `npm run test:e2e -- -g "test title"`. This uses the same isolated display as the full suite. Direct `npx playwright test` bypasses the Xvfb wrapper and is reserved for intentional visible debugging.
