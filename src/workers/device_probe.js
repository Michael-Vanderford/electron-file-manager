const libfs = require('../common/libfs');
const { mount_info } = require('../common/mount_info');

process.once('message', ({ operation, location }) => {
    const reply = (error, result) => {
        process.send({ error: error ? String(error.message || error) : null, result });
    };
    try {
        switch (operation) {
            case 'mounts': libfs.get_mounts(reply, { include_stats: false }); break;
            case 'devices': libfs.get_drives(reply); break;
            case 'mount_info': reply(null, mount_info(location)); break;
            case 'stats': reply(null, libfs.disk_stats(location)); break;
            case 'dashboard': reply(null, { ...libfs.get_file(location), ...libfs.disk_stats(location) }); break;
            default: reply(new Error('Unknown device query.'));
        }
    } catch (error) {
        reply(error);
    }
});
