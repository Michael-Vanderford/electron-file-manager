function location_key(location = '') {
    if (location.startsWith('file://')) {
        try { const uri = new URL(location); location = decodeURIComponent(uri.pathname);
            if (uri.hostname && uri.hostname !== 'localhost') location = '//' + uri.hostname + location; } catch (_) { /* Keep malformed URIs distinct. */ }
    }
    return location.length > 1 ? location.replace(/\/$/, '') : location;
}

// A GVFS mount may open at a default subfolder (for example an SFTP home).
// Sidebar identity is the mount root; navigation retains the original path.
function mount_key(device) {
    const location = location_key(device.canonical_path || device.path);
    const gvfs = location.match(/^(.*\/gvfs\/[^/]+)(?:\/|$)/);
    return gvfs ? gvfs[1] : location;
}

function device_key(device) {
    return device.device || device.activation_root || mount_key(device) || device.uuid || device.name;
}

function merge_devices(mounts, drives) {
    const result = [];
    for (const drive of [...mounts, ...drives]) {
        const existing = result.findIndex(mount =>
            (drive.path && mount.path && mount_key(drive) === mount_key(mount)) ||
            (drive.device && mount.device === drive.device) ||
            (drive.activation_root && mount.activation_root === drive.activation_root));
        if (existing < 0) result.push(drive);
        else {
            const previous = result[existing];
            // Prefer a mounted entry even if an unmounted snapshot arrived first.
            result[existing] = previous.path ? { ...drive, ...previous } : { ...previous, ...drive };
        }
    }
    return result;
}

// Parse GIO's C-locale detailed listing by hierarchy, never by volume label.
function parse_volumes(output) {
    const volumes = [];
    let volume, indent;
    for (const line of output.split('\n')) {
        const header = line.match(/^(\s*)(Drive|Volume|Mount)\(\d+\): (.*)$/);
        if (header) {
            const depth = header[1].length;
            if (header[2] === 'Volume') {
                volume = { name: header[3], path: '', type: 'device' };
                indent = depth;
                volumes.push(volume);
            } else if (volume && header[2] === 'Mount' && depth > indent) {
                volume.path = header[3].slice(header[3].lastIndexOf(' -> ') + 4);
            } else { volume = null; }
            continue;
        }
        if (!volume) continue;
        const device = line.match(/^\s+unix-device: '(.*)'$/);
        const activation = line.match(/^\s+activation_root=(.*)$/);
        const uuid = line.match(/^\s+uuid=(.*)$/);
        if (device) volume.device = device[1];
        if (uuid) volume.uuid = uuid[1];
        if (activation) {
            volume.activation_root = activation[1];
            if (activation[1].startsWith('mtp://')) volume.type = 'phone';
        }
        if (/^\s+can_mount=1$/.test(line)) volume.can_mount = true;
    }
    return volumes;
}

module.exports = { device_key, merge_devices, parse_volumes, location_key };
