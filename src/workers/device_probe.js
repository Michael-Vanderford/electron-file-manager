const { label_devices } = require('../common/device_labels');
const fs = require('fs');
const libfs = require('../common/libfs');
const { mount_info } = require('../common/mount_info');

process.once('message', ({ operation, location }) => {
    const reply = (error, result) => {
        process.send({ error: error ? String(error.message || error) : null, result });
    };
    try {
        switch (operation) {
            case 'directory_names': reply(null, fs.readdirSync(location)); break;
            case 'exists':
                try { fs.lstatSync(location); reply(null, true); }
                catch (error) {
                    if (['ENOENT', 'ENOTDIR'].includes(error.code)) reply(null, false);
                    else throw error;
                }
                break;
            case 'external_drop': {
                const files = [];
                const path = require('path');
                for (const source of location.paths) {
                    if (typeof source !== 'string' || !path.isAbsolute(source)) continue;
                    let stat;
                    try { stat = fs.lstatSync(source); }
                    catch (error) {
                        if (['ENOENT', 'ENOTDIR'].includes(error.code)) continue;
                        throw error;
                    }
                    const relative = path.relative(source, location.location);
                    if (stat.isDirectory() && (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)))) continue;
                    const name = path.basename(source);
                    files.push({ id: source, href: source, name, display_name: name, location: path.dirname(source),
                        size: stat.size, mtime: stat.mtimeMs, ctime: stat.ctimeMs, atime: stat.atimeMs,
                        is_dir: stat.isDirectory(), is_symlink: stat.isSymbolicLink(), is_hidden: name.startsWith('.') });
                }
                reply(null, files);
                break;
            }
            case 'prepare_transfer': reply(null, require('../common/prepare_transfer').prepare_transfer(location)); break;
            case 'files': reply(null, location.map(href => libfs.get_file(href))); break;
            case 'menu_writable':
                try { fs.accessSync(location, fs.constants.W_OK); reply(null, true); }
                catch (_) { reply(null, !!libfs.get_file(location)?.is_writable); }
                break;
            case 'mounts': libfs.get_mounts((error, devices) => reply(error, error ? undefined : label_devices(devices)), { include_stats: false }); break;
            case 'devices': libfs.get_drives((error, devices) => reply(error, error ? undefined : label_devices(devices))); break;
            case 'mount_info': reply(null, mount_info(location)); break;
            case 'writable':
                reply(null, fs.statSync(location).isDirectory() && (fs.accessSync(location, fs.constants.W_OK | fs.constants.X_OK), true));
                break;
            case 'validate':
                if (/^[a-z][a-z0-9+.-]*:\/\//i.test(location)) {
                    require('child_process').execFileSync('gio', ['info', '--attributes=standard::type', location], { timeout: 2500 });
                } else {
                    const directory = fs.opendirSync(location);
                    directory.closeSync();
                }
                reply(null, true);
                break;
            case 'file': reply(null, libfs.get_file(location)); break;
            case 'stats': reply(null, mount_info(location)); break;
            case 'dashboard': reply(null, { ...libfs.get_file(location), ...mount_info(location) }); break;
            default: reply(new Error('Unknown device query.'));
        }
    } catch (error) {
        reply(error);
    }
});
