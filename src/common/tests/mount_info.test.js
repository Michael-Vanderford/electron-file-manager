jest.mock('fs', () => ({ opendirSync: jest.fn() }));
jest.mock('child_process', () => ({ execFileSync: jest.fn() }));
jest.mock('../libfs', () => ({ disk_stats: jest.fn() }));
const fs = require('fs');
const { execFileSync } = require('child_process');
const libfs = require('../libfs');
const { mount_info } = require('../mount_info');
beforeEach(() => {
    jest.resetAllMocks();
    fs.opendirSync.mockReturnValue({ readSync: jest.fn(), closeSync: jest.fn() });
});
test('inaccessible paths fail before disk stats can hide the error', () => {
    fs.opendirSync.mockImplementation(() => { throw new Error('ENOTCONN'); });
    expect(() => mount_info('/mnt/defunct')).toThrow('ENOTCONN');
    expect(libfs.disk_stats).not.toHaveBeenCalled();
});
test.each(['/run/user/1000/gvfs/smb-share:server=host,share=files', 'smb://host/files'])('returns GIO filesystem capacity for %s', location => {
    execFileSync.mockReturnValue('filesystem::size: 1000\nfilesystem::free: 600\n');
    expect(mount_info(location)).toEqual({ total: 1000, free: 600, used: 400 });
    expect(execFileSync).toHaveBeenCalledWith('gio', expect.arrayContaining(['--filesystem', location]), expect.objectContaining({ timeout: 2500 }));
});
test('regular mounted directories keep ordinary disk stats', () => {
    libfs.disk_stats.mockReturnValue({ total: 10, used: 4, free: 6 });
    expect(mount_info('/media/usb')).toEqual({ total: 10, used: 4, free: 6 });
});

test('a stale mount that opens but cannot read is omitted and its handle closes', () => {
    const directory = { readSync: jest.fn(() => { throw new Error('EIO'); }), closeSync: jest.fn() };
    fs.opendirSync.mockReturnValue(directory);
    expect(() => mount_info('/mnt/stale')).toThrow('EIO');
    expect(directory.closeSync).toHaveBeenCalled();
    expect(libfs.disk_stats).not.toHaveBeenCalled();
});
