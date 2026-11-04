# Temporary NFS connection check

Run manually from the repository:

```bash
bash scripts/manual-nfs-test.sh
```

Requires Linux, the app's native GIO addon, GVFS NFS support, `gio`, `timeout`, `exportfs`, sudo privileges, and an already running kernel NFS server with its mountd/rpcbind services. The script does not install packages or start services. An unavailable NFS backend/server will fail the check rather than substitute a mock.

The runner creates a unique `/tmp/efm-nfs-test-*` folder containing one marker file and temporarily exports it read-only to `127.0.0.1`. It uses a runtime export without editing `/etc/exports`. It runs only the opt-in Electron scenario, which connects through the real app/native handler, opens the export in the app, checks the marker card, and reads its contents through GIO. The app profile is isolated and Save connection is unchecked.

On exit, the runner attempts to disconnect that unique GVFS mount, removes its export, and deletes the fixture. If unexporting fails, it retains the directory and reports its path for manual cleanup. A forced kill or machine shutdown may also require manual cleanup of the printed temporary path. Normal test runs skip this real NFS scenario; the existing simulated NFS cases continue to check handler behavior without a server.

This check does not exercise writes, remote-server authentication, reconnect, or non-Linux platforms. It has not been run by the assistant.
