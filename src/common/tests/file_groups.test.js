const { group_files, get_type_group, get_size_group } = require('../file_groups');

describe('file groups', () => {
    it('returns no groups for None and keeps the incoming order within type groups', () => {
        const files = [
            { name: 'image 1', content_type: 'image/png' },
            { name: 'folder', is_dir: true },
            { name: 'image 2', content_type: 'image/jpeg' },
        ];

        expect(group_files(files, 'None')).toBeNull();
        expect(group_files(files, 'Type')).toEqual([
            { label: 'Folders', files: [files[1]] },
            { label: 'Images', files: [files[0], files[2]] },
        ]);
    });

    it('classifies known MIME types and sends unknown types to Other', () => {
        expect(get_type_group({ content_type: 'audio/flac' })).toBe('Audio');
        expect(get_type_group({ content_type: 'video/mp4' })).toBe('Video');
        expect(get_type_group({ content_type: 'text/plain' })).toBe('Documents');
        expect(get_type_group({ content_type: 'application/pdf' })).toBe('Documents');
        expect(get_type_group({ content_type: 'application/vnd.ms-excel' })).toBe('Documents');
        expect(get_type_group({ content_type: 'application/json' })).toBe('Documents');
        expect(get_type_group({ content_type: 'application/zip' })).toBe('Archives');
        expect(get_type_group({ content_type: 'application/vnd.rar' })).toBe('Archives');
        expect(get_type_group({ content_type: 'application/x-msdownload' })).toBe('Applications');
        expect(get_type_group({ content_type: 'application/octet-stream' })).toBe('Other');
        expect(get_type_group({ content_type: 'inode/directory' })).toBe('Folders');
        expect(get_type_group({})).toBe('Other');
    });

    it('groups sizes into ordered binary MiB bands and handles invalid sizes', () => {
        const files = [
            { name: 'large', size: 128 * 1024 * 1024 },
            { name: 'tiny', size: 1 },
            { name: 'small', size: 1024 * 1024 },
            { name: 'medium', size: 16 * 1024 * 1024 },
            { name: 'unknown', size: undefined },
            { name: 'empty', size: '' },
            { name: 'folder', is_dir: true },
        ];

        expect(group_files(files, 'Size')).toEqual([
            { label: 'Folders', files: [files[6]] },
            { label: 'Tiny', files: [files[1]] },
            { label: 'Small', files: [files[2]] },
            { label: 'Medium', files: [files[3]] },
            { label: 'Large', files: [files[0]] },
            { label: 'Unknown Size', files: [files[4], files[5]] },
        ]);
        expect(get_size_group({ size: -1 })).toBe('Unknown Size');
    });

    it('uses existing date group labels for Date Modified', () => {
        const now = new Date(2026, 8, 30, 15, 0, 0);
        const file = { name: 'today', mtime: new Date(2026, 8, 30, 9).getTime() / 1000 };

        expect(group_files([file], 'Date Modified', now)).toEqual([
            { label: 'Today', files: [file] },
        ]);
    });
});