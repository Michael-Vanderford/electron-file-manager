# Network view — deferred feature

Recorded: 2026-11-02. Status: planned; deferred at the user's request. No implementation has started. Related features: DEV-02, NAV-01–03, SEC-01.

## Intended experience

Add a Network destination in the sidebar, opening a dedicated view in the current tab, similar to Nautilus and other file managers.

- **Connected:** mounted network shares, with Open and Disconnect actions.
- **Saved connections:** entries from `network.json`, showing connection status and Connect, Edit, and Remove actions.
- **Available on the network:** discovered servers and shares, with Refresh and loading, empty, and error states.
- **Connect to Server:** opens the existing connection dialog.

Preserve existing device/sidebar actions, supported protocols, credential handling, and opt-in startup reconnect. SSHFS remains absent from the connection selector; existing saved-entry compatibility remains intact.

## Implementation sequence

1. Add the Network location using the existing Dashboard/Recent patterns. Integrate tabs, breadcrumbs, back/forward history, refresh, and session restoration.
2. Build connected and saved sections from existing mount discovery and NetworkManager. Keep credentials in the main process; expose only the metadata required by the view.
3. Investigate GVFS/GIO browsing support in libgio-node, then add bounded, cancellable discovery where supported. Saved connections must remain usable when discovery is unavailable. Automatic discovery cannot be assumed to find every SFTP, NFS, or WebDAV server.
4. Wire Open, Connect, Edit, Remove, and Disconnect. Use ordinary folder navigation for mounted shares. Show successful connections in green and errors in red; update affected entries without resetting the view.
5. Ignore stale results after navigation, tab closure, or refresh. Deduplicate saved, mounted, and discovered targets. Preserve startup, empty-state, error, and pending-work behavior.
6. Update the feature inventory and prepare regression coverage for navigation/history, connection states, discovery failures, deduplication, and cancellation. Tests are run manually by the user unless explicitly requested otherwise.

Deliver connected and saved connections first, followed by discovery. Confirm discovery capabilities and platform limitations during implementation; this plan does not certify existing backend support for browsing remote servers.

## Acceptance criteria

- Network opens from the sidebar and participates in normal tab/history/session behavior.
- Connected and saved entries have accurate, distinct states and appropriate actions.
- Refresh and connection changes do not create duplicate entries or discard the current view unnecessarily.
- Slow or unavailable discovery does not block navigation or saved connections.
- Credentials never appear in renderer metadata, labels, status messages, or logs.
- Existing sidebar/device and connection-dialog behavior remains available.
- Implementation, automated coverage, manual verification, and remaining limitations are recorded separately.

No application changes or test execution are authorized by this deferred feature record alone.
