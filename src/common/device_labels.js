const { execFileSync } = require('child_process');

// GIO exposes the friendly volume name on a shadow mount, while the usable
// GVFS mount may be named only "mtp". Match their URI, never their list order.
function label_devices(devices) {
    const mtp = device => /^mtp:\/\//i.test(device.path || '') || /\/gvfs\/mtp:host=/i.test(device.path || '');
    if (!devices.some(mtp)) return devices;
    const names = new Map();
    try {
        const output = execFileSync('gio', ['mount', '-l'], {
            encoding: 'utf8', timeout: 1500, env: { ...process.env, LC_ALL: 'C' }
        });
        for (const line of output.split('\n')) {
            const match = line.match(/^\s+Mount\(\d+\): (.+) -> (mtp:\/\/\S+)\s*$/);
            if (match) names.set(match[2].replace(/\/$/, ''), match[1]);
        }
    } catch (error) {
        // A missing desktop service must not hide an otherwise reachable phone.
    }
    return devices.map(device => {
        if (!mtp(device)) return device;
        const uri = device.path.startsWith('mtp://') ? device.path :
            `mtp://${device.path.split('/gvfs/mtp:host=')[1]}`;
        return {
            ...device,
            name: names.get(uri.replace(/\/$/, '')) ||
                (device.name && device.name.toLowerCase() !== 'mtp' ? device.name : 'Android device'),
            type: 'phone'
        };
    });
}

module.exports = { label_devices };
