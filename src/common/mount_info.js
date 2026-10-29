const fs = require('fs');
const { execFileSync } = require('child_process');
const libfs = require('./libfs');

function gio_info(location, filesystem) {
    return execFileSync('gio', ['info', ...(filesystem ? ['--filesystem'] : ['--attributes=standard::type']), location], {
        encoding: 'utf8', timeout: 2500, env: { ...process.env, LC_ALL: 'C' }
    });
}

function mount_info(location) {
    if (!location) throw new Error('Mount has no location');
    const uri = /^[a-z][a-z0-9+.-]*:\/\//i.test(location);
    // Check accessibility separately: disk_stats deliberately falls back to zeros on errors.
    if (uri) {
        gio_info(location, false);
    } else {
        const directory = fs.opendirSync(location);
        try {
            directory.readSync();
        } finally {
            directory.closeSync();
        }
    }
    if (uri || /\/gvfs\//i.test(location)) {
        try {
            const output = gio_info(location, true);
            const read = name => {
                const match = output.match(new RegExp(`filesystem::${name}:\\s*(\\d+)`));
                return match ? Number(match[1]) : null;
            };
            const total = read('size');
            const free = read('free');
            if (total !== null && free !== null) return { total, free, used: read('used') ?? Math.max(0, total - free) };
        } catch (error) {
            if (uri) throw error;
        }
    }
    return libfs.disk_stats(location);
}

module.exports = { mount_info };
