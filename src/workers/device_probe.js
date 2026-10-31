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
