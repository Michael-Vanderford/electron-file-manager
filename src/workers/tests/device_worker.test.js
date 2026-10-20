// @ts-nocheck

const { Worker } = require('worker_threads');
const path = require('path');
const libfs = require('../../common/libfs');

jest.mock('../../common/libfs');

describe('DeviceWorker', () => {
    let worker;
    const workerPath = path.resolve(__dirname, '../device_worker.js');

    beforeEach(() => {
        worker = new Worker(workerPath);
    });

    afterEach(() => {
        worker.terminate();
        jest.clearAllMocks();
    });

    test('get_devices should return a list of devices', (done) => {
        const mockDevices = [
            { name: 'Disk 1', path: '/dev/sda1', device: '/dev/sda1' },
            { name: 'Disk 2', path: '/dev/sdb1', device: '/dev/sdb1' }
        ];

        libfs.get_drives.mockImplementation((cb) => cb(null, mockDevices));
        libfs.disk_stats.mockReturnValue({ total: 100, used: 40, free: 60 });

        worker.on('message', (msg) => {
            if (msg.cmd === 'devices') {
                expect(msg.devices).toEqual(expect.arrayContaining([
                    expect.objectContaining({ name: 'Disk 1', total: 100 }),
                    expect.objectContaining({ name: 'Disk 2', total: 100 })
                ]));
                done();
            }
        });

        worker.postMessage({ cmd: 'get_devices' });
    }, 10000);

    test('get_mounts should return a list of mounts', (done) => {
        const mockMounts = [
            { name: 'Root', path: '/', device: '/dev/sda1', filesystem: 'ext4' }
        ];

        libfs.get_mounts.mockImplementation((cb) => cb(null, mockMounts));
        libfs.disk_stats.mockReturnValue({ total: 200, used: 100, free: 100 });

        worker.on('message', (msg) => {
            if (msg.cmd === 'mounts') {
                expect(msg.mounts).toEqual(expect.arrayContaining([
                    expect.objectContaining({ name: 'Root', total: 200 })
                ]));
                done();
            }
        });

        worker.postMessage({ cmd: 'get_mounts' });
    }, 10000);

    test('mount should notify when successful', (done) => {
        const device = { name: 'USB', path: '/dev/sdb1' };
        libfs.mount.mockImplementation((dev, cb) => cb(null, true));

        worker.on('message', (msg) => {
            if (msg.cmd === 'mount_done') {
                expect(msg.msg).toContain('successfully');
                done();
            }
        });

        worker.postMessage({ cmd: 'mount', device_path: device });
    }, 10000);

    test('mount should report error on failure', (done) => {
        const device = { name: 'USB', path: '/dev/sdb1' };
        libfs.mount.mockImplementation((dev, cb) => cb(new Error('Mount failed')));

        worker.on('message', (msg) => {
            if (msg.cmd === 'set_msg') {
                expect(msg.msg).toContain('Error: mount Mount failed');
                done();
            }
        });

        worker.postMessage({ cmd: 'mount', device_path: device });
    }, 10000);

    test('umount should call libfs.umount', (done) => {
        const device = { name: 'USB', path: '/dev/sdb1' };
        libfs.umount.mockImplementation((dev, cb) => {
            cb(null, true);
            done();
        });

        worker.postMessage({ cmd: 'umount', device_path: device });
    }, 10000);

    test('get_devices should handle errors', (done) => {
        libfs.get_drives.mockImplementation((cb) => cb(new Error('Drive error')));

        worker.on('message', (msg) => {
            if (msg.cmd === 'set_msg') {
                expect(msg.msg).toContain('Error: get_devices getting drives Drive error');
                done();
            }
        });

        worker.postMessage({ cmd: 'get_devices' });
    }, 10000);
});

