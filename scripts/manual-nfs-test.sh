#!/usr/bin/env bash
# Explicit manual runner: requires running kernel NFS server/mountd/rpcbind services.
set -euo pipefail
cd "$(dirname "$0")/.."
exportfs_bin=$(command -v exportfs || true)
if [[ -z "$exportfs_bin" ]]; then
    echo 'Install the kernel NFS server utilities and start its services first.' >&2
    exit 1
fi
command -v gio >/dev/null
command -v timeout >/dev/null
sudo -v
share=$(mktemp -d /tmp/efm-nfs-test-XXXXXX)
uri="nfs://127.0.0.1${share}"
echo "Temporary NFS fixture: $uri"
cleanup() {
    # This unique export belongs only to this invocation.
    timeout 10s gio mount -u "$uri" >/dev/null 2>&1 || true
    if sudo "$exportfs_bin" -u "127.0.0.1:$share"; then
        rm -rf -- "$share"
    else
        echo "Unexport failed; retained fixture at $share for manual cleanup." >&2
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
chmod 755 "$share"
printf '%s\n' 'electron-file-manager temporary NFS fixture' > "$share/efm-nfs-marker.txt"
chmod 644 "$share/efm-nfs-marker.txt"
# Runtime-only, read-only loopback export; never edits /etc/exports.
sudo "$exportfs_bin" -i -o ro,insecure,no_subtree_check,root_squash "127.0.0.1:$share"
export EFM_TEST_NFS_URI="$uri"
npm run test:e2e -- --grep '^Network real temporary NFS export'
