const fs = require('fs');
const path = require('path');
const { execSync, execFileSync, spawn } = require('child_process');
const iconManager = require('../lib/IconManager.js');

jest.mock('fs');
jest.mock('child_process', () => ({
    execSync: jest.fn(() => Buffer.from("'Fluent-dark'")),
    execFileSync: jest.fn(),
    spawn: jest.fn()
}));
jest.mock('os', () => ({
    homedir: jest.fn(() => '/home/michael')
}));

describe('IconManager', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        iconManager.platform = 'linux';
    });

    describe('get_symlink_icon', () => {

        it('should return the correct symlink icon path when found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('emblem-symbolic-link.svg');
            });

            const result = iconManager.get_symlink_icon();
            expect(result).toContain('emblem-symbolic-link.svg');
        });

        it('should return the fallback symlink icon path when not found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            fs.existsSync.mockReturnValue(false);

            const result = iconManager.get_symlink_icon();
            expect(result).toBe(path.join(__dirname, '..', '..', 'assets', 'icons', 'emblem-symbolic-link.svg'));
        });
    });

    describe('get_readonly_icon', () => {
        it('should return the correct readonly icon path when found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('emblem-readonly.svg');
            });

            const result = iconManager.get_readonly_icon();
            expect(result).toContain('emblem-readonly.svg');
        });

        it('should return the fallback readonly icon path when not found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            fs.existsSync.mockReturnValue(false);

            const result = iconManager.get_readonly_icon();
            expect(result).toBe(path.join(__dirname, '..', '..', 'assets', 'icons', 'emblem-readonly.svg'));
        });
    });

    describe('get_theme_path', () => {
        it('should return the correct theme path when found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            iconManager.theme_root = '/usr/share/icons/Fluent-dark';
            fs.existsSync.mockImplementation((filePath) => {
                return filePath === '/usr/share/icons/Fluent-dark' ||
                    filePath.includes('/usr/share/icons/Fluent-dark/scalable/places/');
            });

            const result = iconManager.get_theme_path();
            expect(result).toContain('Fluent-dark');
        });

        it('should return the fallback theme path when not found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            fs.existsSync.mockReturnValue(false);

            const result = iconManager.get_theme_path();
            expect(result).toBe(path.join(__dirname, '..', 'lib', 'assets', 'icons') + path.sep);
        });
    });

    describe('non-Linux platforms', () => {
        it('does not query GNOME settings or GIO', () => {
            iconManager.platform = 'win32';

            expect(iconManager.get_icon_theme()).toBe('');
            expect(iconManager.get_file_icon('C:\\Users\\testuser\\file.txt')).toBeNull();
            expect(execSync).not.toHaveBeenCalled();
            expect(execFileSync).not.toHaveBeenCalled();
        });

        it('returns a native folder icon data URL', async () => {
            iconManager.platform = 'darwin';
            const electronApp = {
                getFileIcon: jest.fn().mockResolvedValue({
                    toDataURL: jest.fn(() => 'data:image/png;base64,native-folder-icon')
                })
            };

            const result = await iconManager.get_folder_icon_for_platform('/Users/testuser/Documents', electronApp);

            expect(electronApp.getFileIcon).toHaveBeenCalledWith('/Users/testuser/Documents', { size: 32 });
            expect(result).toBe('data:image/png;base64,native-folder-icon');
        });

        it('falls back to the bundled folder icon when native lookup fails', async () => {
            iconManager.platform = 'win32';
            const electronApp = {
                getFileIcon: jest.fn().mockRejectedValue(new Error('native icon unavailable'))
            };

            const result = await iconManager.get_folder_icon_for_platform('C:\\Users\\testuser\\Documents', electronApp);

            expect(result).toBe(path.join(__dirname, '..', '..', 'assets', 'icons', 'folder.svg'));
        });

        it('does not start a GNOME theme watcher', () => {
            iconManager.platform = 'win32';

            iconManager.start_theme_watcher(jest.fn());

            expect(spawn).not.toHaveBeenCalled();
        });
    });

    describe('get_folder_icon', () => {
        it('should return the correct special folder icon path when found', () => {
            const href = '/home/testuser/Documents';
            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('folder-documents.svg');
            });

            const result = iconManager.get_folder_icon(null, href);
            expect(result).toContain('folder-documents.svg');
        });

        it('should return the generic folder icon path when no special folder icon is found', () => {
            const href = '/home/testuser/UnknownFolder';
            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('folder.svg');
            });

            const result = iconManager.get_folder_icon(null, href);
            expect(result).toContain('folder.svg');
        });

        it('should return the fallback folder icon path when no icon is found', () => {
            const href = '/home/testuser/UnknownFolder';
            fs.existsSync.mockReturnValue(false);

            const result = iconManager.get_folder_icon(null, href);
            expect(result).toBe(path.join(__dirname, '..', '..', 'assets', 'icons', 'folder.svg'));
        });
    });

});