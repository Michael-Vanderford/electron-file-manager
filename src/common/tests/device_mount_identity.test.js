jest.mock('child_process', () => ({ execFile: jest.fn() }));
const { execFile } = require('child_process');
const { LibFS } = require('../libfs');
const listing = `Volume(0): SAME
  unix-device: '/dev/fixture-a'
  can_mount=1
Volume(1): SAME
  unix-device: '/dev/fixture-b'
  can_mount=1
`;
beforeEach(() => jest.resetAllMocks());
test('mounts the selected same-label device and rejects ambiguous legacy labels', async () => {
    if (process.platform !== 'linux') return;
    execFile.mockImplementation((_command, args, options, callback) => {
        if (typeof options === 'function') options(null);
        else callback(null, listing);
    });
    const libfs = new LibFS();
    const mount = device => new Promise(resolve => libfs.mount(device, (error, volume) => resolve({ error, volume })));
    expect((await mount({ name: 'SAME', device: '/dev/fixture-b' })).volume.device).toBe('/dev/fixture-b');
    expect(execFile).toHaveBeenLastCalledWith('gio', ['mount', '--device=/dev/fixture-b'], expect.any(Function));
    execFile.mockClear();
    expect((await mount('SAME')).error.message).toContain('ambiguous');
    expect(execFile).toHaveBeenCalledTimes(1);
});
