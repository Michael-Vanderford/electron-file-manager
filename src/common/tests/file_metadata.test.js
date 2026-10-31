const { perms_from_stats, get_content_type } = require('../file_metadata');
(process.getgroups ? test : test.skip)('listing and watcher metadata recognize supplementary group mode bits', () => {
    const uid = jest.spyOn(process, 'getuid').mockReturnValue(1000);
    const gid = jest.spyOn(process, 'getgid').mockReturnValue(1000);
    const groups = jest.spyOn(process, 'getgroups').mockReturnValue([1000, 2000]);
    try {
        expect(perms_from_stats({ uid: 3000, gid: 2000, mode: 0o660 })).toEqual({ is_readable: true, is_writable: true });
        expect(perms_from_stats({ uid: 3000, gid: 4000, mode: 0o660 })).toEqual({ is_readable: false, is_writable: false });
        expect(get_content_type('photo.WEBP', false)).toBe('image/webp');
        expect(get_content_type('folder.txt', true)).toBe('inode/directory');
    } finally { uid.mockRestore(); gid.mockRestore(); groups.mockRestore(); }
});
