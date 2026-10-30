jest.mock('child_process', () => ({ execFile: jest.fn(), execFileSync: jest.fn() }));
jest.mock('libgio-node', () => ({}));
const fs = require('fs');
const { execFile, execFileSync } = require('child_process');
const { LibFS } = require('../libfs');
const literal = '/tmp/-device\' "$(literal)`literal`\n';
const linuxTest = process.platform === 'linux' ? test : test.skip;
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

linuxTest('mount fallback passes the device as one literal argument without a shell', () => {
    const libfs = new LibFS(); libfs.gioNative = null; const callback = jest.fn();
    execFile.mockImplementation((_command, _args, reply) => reply(null, 'mounted'));
    libfs.mount({ device: literal }, callback);
    expect(execFile).toHaveBeenCalledWith('udisksctl', ['mount', '-b', literal], expect.any(Function));
    expect(callback).toHaveBeenCalledWith(null, true);
});

linuxTest('unmount fallback preserves block and object paths and only retries on failure', () => {
    const libfs = new LibFS(); libfs.gioNative = null; const callback = jest.fn();
    execFile.mockImplementationOnce((_command, _args, reply) => reply(new Error('not a block device')))
        .mockImplementationOnce((_command, _args, reply) => reply(null));
    libfs.umount({ device: literal, path: `${literal}-object` }, callback);
    expect(execFile).toHaveBeenNthCalledWith(1, 'udisksctl', ['unmount', '-b', literal], expect.any(Function));
    expect(execFile).toHaveBeenNthCalledWith(2, 'udisksctl', ['unmount', '-p', `${literal}-object`], expect.any(Function));
    expect(callback).toHaveBeenCalledWith(null, true);
});

linuxTest('disk fallback uses a terminated literal argument and bounded df process', () => {
    jest.spyOn(fs, 'statfsSync').mockImplementation(() => { throw new Error('statfs unavailable'); });
    execFileSync.mockReturnValue('Filesystem 1B-blocks Used Available Use% Mounted on\n/dev/test 1000 250 750 25% /tmp\n');
    expect(new LibFS().disk_stats(literal)).toEqual({ total: 1000, used: 250, free: 750 });
    expect(execFileSync).toHaveBeenCalledWith('df', ['-B1', '--', literal], { encoding: 'utf8', timeout: 2500 });
});
