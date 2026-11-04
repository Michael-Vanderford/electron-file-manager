jest.mock('worker_threads', () => ({ isMainThread: true, parentPort: { postMessage: jest.fn() } }));
jest.mock('../../common/device_probe', () => ({ probe: jest.fn() }));
const { parentPort } = require('worker_threads');
const { probe } = require('../../common/device_probe');
const { DeviceManager } = require('../device_worker');
beforeEach(() => jest.resetAllMocks());

test('omits inaccessible mounts from every published list and preserves GVFS capacity', async () => {
    probe.mockImplementation((operation, location) => {
        if (operation === 'mounts') return Promise.resolve([
            { name: 'defunct', path: '/mnt/offline' },
            { name: 'GVFS', path: '/run/user/1000/gvfs/smb-share:server=host,share=files' }
        ]);
        return location === '/mnt/offline' ? Promise.reject(new Error('timeout')) : Promise.resolve({ total: 200, used: 80, free: 120 });
    });
    await new DeviceManager().get_mounts();
    for (const [message] of parentPort.postMessage.mock.calls) {
        if (message.cmd === 'mounts') expect(message.mounts.some(item => item.name === 'defunct')).toBe(false);
    }
    expect(parentPort.postMessage).toHaveBeenLastCalledWith({ cmd: 'mounts', mounts: [
        expect.objectContaining({ name: 'GVFS', total: 200, used: 80, free: 120 })
    ] });
});

test('keeps unmounted drives available without probing an empty path', async () => {
    probe.mockResolvedValue([{ name: 'USB', path: '' }]);
    await new DeviceManager().get_devices();
    expect(probe).toHaveBeenCalledTimes(1);
    expect(parentPort.postMessage).toHaveBeenLastCalledWith({ cmd: 'devices', devices: [{ name: 'USB', path: '' }] });
});

test('keeps an unmounted phone available for the Mount action', async () => {
    const phone = { name: 'SAMSUNG Android', path: '', type: 'phone' };
    probe.mockResolvedValue([phone]);
    await new DeviceManager().get_devices();
    expect(probe).toHaveBeenCalledTimes(1);
    expect(parentPort.postMessage).toHaveBeenLastCalledWith({ cmd: 'devices', devices: [phone] });
});

test('does not redisplay cached mounts when discovery fails', async () => {
    const manager = new DeviceManager();
    probe.mockResolvedValueOnce([{ name: 'disk', path: '/' }]).mockResolvedValueOnce({ total: 100 });
    await manager.get_mounts();
    parentPort.postMessage.mockClear();
    probe.mockRejectedValue(new Error('timeout'));
    await manager.get_mounts();
    expect(parentPort.postMessage).toHaveBeenCalledWith({ cmd: 'mounts', mounts: [] });
});

test('hot-plug during discovery queues a follow-up scan', async () => {
    let resolve;
    probe.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue([]);
    const manager = new DeviceManager();
    const request = manager.get_mounts();
    await manager.get_mounts();
    expect(probe).toHaveBeenCalledTimes(1);
    resolve([]);
    await request;
    expect(probe).toHaveBeenCalledTimes(2);
});

test('retains reachable Android MTP mounts and drives', async () => {
    const phone = { name: 'mtp', path: 'mtp://[usb:001,009]/', type: 'phone' };
    probe.mockImplementation(operation => Promise.resolve(
        operation === 'mount_info' ? { total: 100, free: 60, used: 40 } : [phone]
    ));
    const manager = new DeviceManager();
    await manager.get_mounts();
    await manager.get_devices();
    for (const operation of ['mounts', 'devices']) {
        expect(parentPort.postMessage).toHaveBeenCalledWith({
            cmd: operation, [operation]: [expect.objectContaining(phone)]
        });
    }
});
