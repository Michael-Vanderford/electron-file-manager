jest.mock('child_process', () => ({ execFileSync: jest.fn() }));
const { execFileSync } = require('child_process');
const { label_devices } = require('../device_labels');

beforeEach(() => jest.resetAllMocks());

test('associates friendly shadow-mount names with each MTP URI and GVFS path', () => {
    execFileSync.mockReturnValue('Volume(0): SAMSUNG Android\n  Mount(0): SAMSUNG Android -> mtp://samsung/\nVolume(1): Pixel\n  Mount(0): Pixel -> mtp://pixel/\nMount(0): mtp -> mtp://samsung/\n');
    const disk = { name: 'Disk', path: '/mnt/disk' };
    expect(label_devices([
        { name: 'mtp', path: '/run/user/1000/gvfs/mtp:host=pixel' },
        { name: 'mtp', path: 'mtp://samsung/' }, disk
    ])).toEqual([
        { name: 'Pixel', path: '/run/user/1000/gvfs/mtp:host=pixel', type: 'phone' },
        { name: 'SAMSUNG Android', path: 'mtp://samsung/', type: 'phone' }, disk
    ]);
});

test('keeps a reachable phone and descriptive names if GIO metadata is unavailable', () => {
    execFileSync.mockImplementation(() => { throw new Error('timeout'); });
    expect(label_devices([{ name: 'mtp', path: 'mtp://one/' }, { name: 'My phone', path: 'mtp://two/' }])
        .map(device => device.name)).toEqual(['Android device', 'My phone']);
});

test('ordinary drives do not require a metadata subprocess', () => {
    const devices = [{ name: 'USB', path: '' }];
    expect(label_devices(devices)).toBe(devices);
    expect(execFileSync).not.toHaveBeenCalled();
});
