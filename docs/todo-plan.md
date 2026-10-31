# TODO implementation plan

Prepared 2026-10-30 from [TODO.md](../TODO.md) and the [feature inventory](features.md). This is an execution plan, not evidence that any open item is fixed. Work in the order below, taking one reviewable change at a time.

Implementation update: R08–R21 have been implemented. See the [P1 evidence and remaining verification limits](features.md#p1-implementation-follow-up-2026-10-30). P2 implementation and remaining work are recorded in the current handoff below; R22/R24/R25/R28/R29/R31/R32 and credential checks have since been implemented.

## Working agreement

- Recheck each finding against current code before implementing it. The backlog's line numbers and historical test counts are reference points, not current truth. R07/R08 and parts of R09/R10/R13 already have improvements; preserve them and target the remaining gaps.
- Before each change, identify affected feature IDs, trace shared-function callers, and define the observable failure and acceptance check. Include normal, grouped, virtual, empty, error, startup, and pending-navigation paths where relevant.
- Keep changes scoped. Preserve existing overwrite choices, link safety, recovery journals, device actions, and security bridges. Avoid a main/preload rewrite or a new general framework.
- Use isolated temporary fixtures and profiles. Destructive, hostile archive, and crash tests must never use personal files, the normal profile, or real network mounts. Restore fixture permissions and clean up child processes on failure.
- Run only affected unit checks and focused Electron scenarios for each change. Visible behavior needs a UI regression; helper mocks alone do not certify the flow. Do not run the full suite unless explicitly requested. R30's release-wide regression run remains a separate requested release activity.
- Update feature evidence with the exact checks, failures, skips, and limits. Close a TODO only when all of its acceptance criteria are established; otherwise narrow its remaining scope.

## Phase 1 — Finish file-operation result and lifetime guarantees

Features: FILE-02/03/05/06/08/09, NAV-03, STATUS-01.

1. **R07: filesystem outcomes.** Inventory callers of removal, creation, and copy helpers. Normalize success/failure handling at the smallest shared boundary and propagate failed paths. Preserve already-correct boolean checks. Test false returns, thrown errors, partial directory creation, and real temporary permission failures under an unprivileged process; do not count a root permission bypass as coverage. Verify failed delete cards remain and counts match disk state.
2. **R08: copy reporting and UI reconciliation.** Build on the existing per-entry outcomes rather than replacing them. Ensure completed, failed, skipped, and cancelled entries reconcile destination cards and preserve source identity. Exercise mixed results, missing sources, injected ENOSPC, and cancellation through the worker and Electron UI. Assert both bytes on disk and absence of ghost cards.
3. **R09: operation ownership.** Choose the simplest supported concurrency policy after tracing all launchers: serialize conflicting work where sufficient, and retain immutable operation, initiating window/tab, and destination context for every job. Scope replies and cancellation to that context, including when a sender closes. Test two windows, overlapping destinations, focus switches, queued jobs, and cancelling one job without cancelling another.
4. **R10: terminal cleanup.** On top of R09's ownership, make watcher suppression and worker/progress cleanup operation-scoped and idempotent. Cover success, skip-all conflicts, errors, cancellation, unexpected exit, and closed windows. Verify a subsequent real filesystem change is delivered and worker/stream counts return to baseline.
5. **R11: ordinary EXDEV moves.** Exercise the real `libfs.mv` fallback boundary, not only mocked move-worker failures. Preserve links, verify copied content before source cleanup, and retain uncopied or newly arrived source entries. Define the user-visible partial/cancelled outcome during in-flight copies. Inject copy, publication, and source-removal failures; follow with a controlled two-filesystem check when available.

Exit: operations report actual outcomes, one job cannot mutate another's state, terminal paths release resources, and EXDEV failures preserve uncopied source data. Keep real-network and platform limitations open until directly tested.

## Phase 2 — Make paths, tab models, and virtual views consistent

Features: NAV-01/03, VIEW-01–04, FILE-01–06/08, SPECIAL-01, STATUS-01.

1. **R12: path identity.** Find every path-ID producer and consumer, including worker output, DOM lookup, Recent, selection, and transfers. Adopt one UTF-8-safe contract compatible with sandboxed preloads; preserve existing ASCII identities where practical and handle any persisted IDs explicitly. Test emoji, CJK, accented, and mixed paths through navigation, grouping, selection, copy, move, and delete.
2. **R13: update data before rendering.** Route watcher and new-item insert/update/remove events through the owning tab's backing model before changing cards. Reuse existing location-scoped archive insertion where appropriate. Verify entries survive regrouping, sorting, view changes, hidden toggles, filtering, and later transfers. Distinguish simulated event-routing coverage from native watcher coverage.
3. **R15: complete backing data.** Retain hidden entries in the full model and derive visible rows without deleting source records. Test hide/refresh/show in grid/list, grouped/ungrouped, hidden-only directories, and folders that cross the virtualization threshold.
4. **R14: virtual tab lifetime.** Keep or restore each tab's virtual instance with its own scroll and selection state. Alternate two large folders and one small folder; verify rendered ranges and actions in grid/list/grouped views, then check scrolling becomes idle.
5. **R31: keyboard selection.** Synchronize keyboard and command selection through the existing selection model. Use physical keyboard input for grouped virtual Copy and Cut/Move; verify selected identities, destination contents, and source preservation/removal. Synthetic row clicks do not satisfy this item.
6. **R25: transient state.** After model/lifetime fixes, preserve valid filters, focus, selection, and scroll across copy/move/rename/delete. Define what happens when the focused or selected item disappears. Test filtered and scrolled grouped/virtual views plus empty-state transitions.

Exit: disk/model/card identities agree, view transformations retain entries, and switching tabs or performing operations preserves valid user state.

## Phase 3 — Scope navigation and asynchronous special views

Features: NAV-01–03, STATUS-01, SPECIAL-01, DEV-03.

1. **R17: listing terminal states.** Give success, partial, and error replies explicit request/destination identity. Avoid dispatching a known-invalid request, and define how the previous valid view, location input, history, and loading state behave on failure. Test missing/deleted/unreadable paths, metadata failures, and late replies after navigation.
2. **R16: session restoration.** Reuse explicit tab/request routing from R17, or restore sequentially if that is sufficient. Restart an isolated profile with three saved directories, a middle active tab, and a large folder. Check every tab's content, active identity, and history rather than only the final location.
3. **R18: Recent.** Normalize zero/one/many XBEL bookmarks, catch parsing and URI errors, and exclude stale entries without synthetic success metadata. Bind replies to their requesting tab. Test malformed fixtures, two Recent tabs, and navigation while a response is delayed.
4. **R19: Dashboard and disk space.** Attach per-tab generations and requested locations, scope DOM updates, and remove the duplicate chart navigation handler. Delay replies across navigation/close; assert current content and footer remain intact and each click adds exactly one history action.

Exit: every request settles deliberately, and stale results cannot populate a different tab or location.

## Phase 4 — Finish archive format and containment guarantees

Features: FILE-09, SEC-02, FILE-08. Build on Phase 1 cleanup and failure reporting.

1. **R21: containment first.** Establish an explicit entry/link validation and isolated staging policy before publishing extracted output. Check traversal, absolute paths, symlink/hardlink escapes, and writes through pre-existing destination links. Do not treat an external extractor's default behavior as proof of containment. Use isolated malicious fixtures with outside sentinel files.
2. **R20: formats and real XZ output.** Inventory advertised formats and existing runtime tools; use a real codec through literal process arguments or an existing suitable dependency. Verify magic bytes and independent round trips for ZIP, TAR, TAR.GZ, TAR.XZ, TAR.BZ2, and 7z. Check bytes, nesting, destination, and misleading parent-directory names. Record unavailable tooling as a gap rather than silently dropping a supported format.
3. **R21 completion: failure lifecycle.** Exercise malformed input, ENOSPC/EACCES, process/worker crash, and cancellation against the containment policy. Verify partial-output reporting/removal follows a documented policy, originals remain intact, outside sentinels are untouched, and progress/watchers recover.

Exit: output formats match their names, extraction cannot escape the isolated destination under the tested cases, and all archive terminal paths settle cleanly. Keep hostile extraction a release blocker until its acceptance checks pass.

## Phase 5 — Persistence, devices, and native events

1. **R22 — persistence** (SETTINGS-01, WORKSPACE-01, NAV-03): introduce minimal atomic replacement, validation, recoverable last-good state, and serialized field updates. Test truncated/malformed files, interrupted writes, and simultaneous windows without resetting unrelated preferences.
2. **Saved-network credentials:** trace encryption and migration paths; test encrypted round trips, plaintext migration, decryption failure, unavailable encryption, file modes, and Linux backend policy. Never log credentials. Any storage-policy change must preserve recoverable existing configurations and explain compatibility explicitly.
3. **R23 — bounded device access** (DEV-01–03, NAV-01): move remaining blocking probes off the main event loop, bound waiting and resource use, use consistent GVFS-aware capacity semantics, and distinguish unavailable from zero. Test stalled probes, stale replies, cooldown recovery, and hot-plug during scans while preserving unmounted-drive actions.
4. **R24 — native watcher lifecycle** (FILE-08): remove unmatched-event fallback routing, attach directory/subscriber identity, handle modifications and watch errors, and preserve existing cleanup. Use real local events in two windows/tabs, including rename, modification, deleted directories, repeated navigation, limits, and close. Diagnose unavailable native delivery separately; simulated IPC is insufficient to close this task.

Dependencies: R24 uses R09/R10 operation cleanup and R13 model updates; R23 uses R17/R19 request scoping. Persistence and credential checks can be separate small changes once their own callers are traced.

## Phase 6 — Compatibility and test maintenance

1. **R28 — autocomplete:** move the excluded test into Electron E2E with temporary fixtures/profiles and guaranteed cleanup. Remove focused execution, invalid assertions, and personal paths; enable CI `forbidOnly`. This small independent task may be brought forward when touching navigation tests.
2. **R26 — media:** establish expected JPEG/WebP/GIF/XCF/video behavior before changing it; add representative fixtures, shutdown/pending-work checks, and a bounded cache policy that protects active files. Verify packaged decoder launch as part of R27.
3. **R27 — platform startup:** tolerate absent optional Linux desktop services, document actual runtime tools, and verify supplementary-group/ACL behavior. Build actual Linux and Windows artifacts; test core file flows, icons/helper inclusion, decoder, dialogs, and shutdown on the target platform. Staged dependency tests and simulated Windows providers remain useful but do not close native checks. Preserve the requested development `--no-sandbox` launch setting; document the actual sandbox mode tested.
4. **R29 — demonstrated duplication only:** after behavior regressions exist, trace reachability and decide explicitly whether backup code should be archived or deleted. Consolidate proven metadata/MIME/permission duplication in small changes; do not delete apparently unused assets without checking dynamic references and packaging.
5. **Product filter label:** decide how quick filtering differs from recursive Find, then update the current-directory placeholder. Test directory changes, focus, clearing, and accessible naming. Keep this separate from correctness fixes.

## Phase 7 — Release verification and remaining safety limits

Use **R30** as the release checklist, not a claim that all coverage gaps are implementation defects.

- Reconcile every remaining TODO with current feature evidence. Carry forward unsupported hard-link publication, orphan locks before journaling, external-writer races, and power-loss durability as explicit limits unless separately resolved. Verify safe failure and recovery behavior without introducing an unsafe fallback.
- On controlled disposable targets, check real cross-device transfers, supported network filesystems, USB lifecycle, conflict/cancel flows, and native Recent discovery. Include destination filesystems without hard-link support and interrupted transactions. Never use live user mounts for destructive scenarios.
- Run actual packaged Linux/Windows smoke checks, keyboard-only and accessibility checks for special views, and representative remote/photo performance measurements. Record environment, dataset, result, and remaining gaps.
- When explicitly requested for release, run `npm run test:regression` (under Xvfb on headless Linux) and the production dependency audit. Resolve failures or state the release-blocking limitation; distinguish skipped platform checks from passing ones.

## Current handoff

P2 implementation update (2026-10-31): credential checks, R22/R24/R25/R28/R29/R31/R32 are implemented with named evidence and limits in the [feature inventory](features.md#p2-implementation-and-verification-2026-10-31). R23 still needs the remaining main-thread filesystem operations and real stalled-remote verification. R26 needs XCF/target-platform compatibility and stale decoder-temporary cleanup; R27/R30 retain target-platform and real-service release gates. See the narrowed open items in [TODO.md](../TODO.md) and [release checks](release-checks.md). Do not treat simulated providers, skipped tests or the Linux unpacked smoke as Windows/native-service certification.
