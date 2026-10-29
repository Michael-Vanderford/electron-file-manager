# Repository change rules

## Feature preservation

- Read `docs/features.md` before application changes. Identify affected feature IDs and adjacent behavior before editing.
- Preserve existing behavior unless the user requests a change. Make intended removals or compatibility changes explicit; do not silently replace supported behavior with a fallback.
- Review every caller of a shared function before changing it. Check normal, grouped, and virtual views where applicable, plus startup, empty results, errors, and navigation away during pending work.
- For bug fixes or behavior changes, add a regression check that exercises the reported behavior. Prefer an Electron Playwright test for visible user flows; unit tests alone do not establish UI compatibility.
- Update the feature inventory when behavior or coverage changes. Distinguish implementation evidence, automated verification, manual verification, and untested expectations.
- Run affected checks during development and `npm run test:regression` before reporting a change complete. On Linux without a usable display, use `xvfb-run -a npm run test:regression`.
- Report the checks run, failures or skipped checks, and remaining limitations. Never describe a partial or mocked check as proof of the entire feature.
- Keep test fixtures and profiles isolated. Never run destructive file-operation tests against the user's files, normal app profile, or real network mounts.
- Existing audit findings are not authorization to change unrelated application behavior. Document discoveries and keep fixes within the user's scope.

## Personal web navigation preference

For web projects, prefer JavaScript-driven same-page scrolling without URL hashes. Preserve keyboard accessibility, focus handling, reduced-motion preferences, and fixed-header offsets. Keep normal navigation and external/email links working normally unless requirements explicitly call for hash navigation.
