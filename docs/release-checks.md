# Release verification gates

Use disposable local directories/profiles and dedicated test mounts. These gates must not operate destructively on personal files or ordinary network mounts.

## Automated checks

- Run `npm run test:regression` (on a headless Linux host, `xvfb-run -a npm run test:regression`). Playwright rejects focused tests when `CI` is set.
- Build the actual target artifact. Packaging includes `src`, production dependencies and package metadata; first-party tests, historical backups and previous `dist` installers are excluded.
- Set `EFM_PACKAGED_EXECUTABLE` to the built executable and run `npx playwright test e2e/packaged.spec.js` (under Xvfb on Linux). With no executable configured this test is explicitly skipped. It checks packaged launch, navigation, copying/renaming/deleting fixture files, source preservation, icons, PNG decoding, ZIP dependency loading/output, About and shutdown. Linux uses an empty PATH to test absent optional desktop commands. Test launch explicitly uses `--no-sandbox`; certify the intended installed sandbox configuration separately.
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
