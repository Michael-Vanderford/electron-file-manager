jest.mock('../../common/libfs', () => ({ get_file: jest.fn(), disk_stats: jest.fn() }));
jest.mock('../../common/mount_info', () => ({ mount_info: jest.fn() }));

const libfs = require('../../common/libfs');
const { mount_info } = require('../../common/mount_info');

test('dashboard queries use verified mount capacity and report inaccessible mounts', () => {
    const once = jest.spyOn(process, 'once').mockImplementation(() => process);
    const send = jest.spyOn(process, 'send').mockImplementation(() => {});
    try {
        require('../device_probe');
        const handle = once.mock.calls.find(([event]) => event === 'message')[1];
        const location = '/run/user/1000/gvfs/smb-share:server=test,share=files';
        libfs.get_file.mockReturnValue({ href: location, display_name: 'files' });
        mount_info.mockReturnValue({ total: 1000, used: 400, free: 600 });
        handle({ operation: 'dashboard', location });
        expect(mount_info).toHaveBeenCalledWith(location);
        expect(libfs.disk_stats).not.toHaveBeenCalled();
        expect(send).toHaveBeenLastCalledWith({ error: null, result: {
            href: location, display_name: 'files', total: 1000, used: 400, free: 600
        } });
        mount_info.mockImplementation(() => { throw new Error('ENOTCONN'); });
        handle({ operation: 'dashboard', location });
        expect(send).toHaveBeenLastCalledWith({ error: 'ENOTCONN', result: undefined });
    } finally {
        once.mockRestore();
        send.mockRestore();
    }
});
