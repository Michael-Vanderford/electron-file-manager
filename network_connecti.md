# Network Connection Logic Review

This document provides a review of the network connection logic implementation in the Electron File Manager.

## Overview

The network connection mechanism relies heavily on GNOME's Virtual File System (GVFS) via the `libgio-node` dependency. The primary handling of network connections is located within the `NetworkManager` class in the main process (`src/main/main.js`), with the user interface logic located in `src/renderer/dialogs/scripts/connect.js`.

## Supported Protocols

The application currently supports the following network protocols:
- **SMB** (Server Message Block)
- **SSH / SSHFS** (Secure Shell File System)

## Connection Flow (`NetworkManager.connect`)

When a user attempts to connect to a network drive, an IPC call (`ipcMain.handle('connect')`) triggers the `NetworkManager.connect` method.

1. **Input Normalization**:
   - The server string is stripped of protocol prefixes (e.g., `smb://`, `ssh://`, `sftp://`) and trailing slashes via `normalize_server()`.

2. **Validation**:
   - The protocol type must be one of the supported types (`ssh`, `sshfs`, `smb`).
   - A server address is strictly required.
   - For SMB connections, both a username and password are required.
   - For SSH/SSHFS connections, the implementation currently mandates public key authentication (`use_ssh_key` must be true). Password-based SSH authentication is explicitly rejected.

3. **Execution**:
   - A 20-second timeout (`setTimeout`) is initialized to prevent hanging connections.
   - The connection is delegated to `gio.connect_network_drive` passing the server, username, password, SSH key flag, and protocol type.

4. **Post-Connection Handling**:
   - Upon a successful connection callback from `gio`, the 20-second timeout is cleared.
   - If the user opted to save the connection, it is serialized and written to `network.json` in the Electron `userData` directory via `setNetworkSettings()`.
   - The `device_worker` is instructed to execute `get_mounts` to refresh the list of mounted drives and make the new network drive visible in the UI.
   - Success/error messages are passed back to the renderer process over the `msg_connect` channel.

## Device and Mount Management

- Network mounts are tracked natively by GVFS. The `gio.monitor` function is running globally in `main.js` to watch for device changes and new mounts, triggering mount refreshes automatically when GVFS detects changes.
- Disconnecting a network drive relies on `gio.umount(device_name)`, which is exposed via the `umount` IPC channel.

## Storage of Connection Settings

Saved network connections are persisted as a JSON array in `network.json`.
- `getNetworkSettings()` retrieves the list from disk.
- `setNetworkSettings()` replaces an existing entry with the same normalized connection identity instead of appending duplicates.
- Invalid entries are ignored and duplicate entries are removed when the file is loaded.
- Passwords are encrypted with Electron `safeStorage`; plaintext passwords are removed when legacy entries are migrated. If secure storage is unavailable, automatic reconnect is disabled for that entry.
- `removeNetworkSettings()` removes one exact connection identity; it does not use substring matching on mount paths.

## Reconnect After Startup

The Connect dialog has a separate opt-in for automatic reconnect. After the main window is ready, the main process reconnects all opted-in entries in the background, with up to three connection attempts running concurrently. One failed or unavailable connection does not prevent the remaining entries from being attempted. Reconnect does not open a dialog or block startup, and each result remains associated with its saved connection identity. Startup reconnect does not log or display credentials.

Existing files using the old plaintext `password` field are migrated when secure storage is available. Entries that cannot be migrated remain as non-secret metadata but are not automatically reconnected.

## Potential Areas of Improvement

- **SSH Password Authentication**: The current limitation enforces SSH key usage. Supporting password-based SSH could be beneficial if `libgio` allows for interactive prompts or standard password passing.
- **Connection Error Specificity**: GVFS errors can sometimes be opaque. Better parsing of the `err` object returned by `gio.connect_network_drive` could provide more actionable UI feedback.
- **Timeout Management**: The 20-second timeout is hardcoded. It might be worthwhile to allow this to be configurable depending on the user's network latency.
