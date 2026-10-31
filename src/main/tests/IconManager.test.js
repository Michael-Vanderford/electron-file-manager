const fs = require('fs');
const path = require('path');
const { execSync, execFileSync, execFile, spawn } = require('child_process');
const iconManager = require('../lib/IconManager.js');

jest.mock('fs');
jest.mock('child_process', () => ({
    execSync: jest.fn(() => Buffer.from("'Fluent-dark'")),
    execFileSync: jest.fn(),
    execFile: jest.fn(),
    spawn: jest.fn()
}));
jest.mock('os', () => ({
    homedir: jest.fn(() => '/home/michael')
}));

describe('IconManager', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        iconManager.platform = 'linux';
        delete iconManager.windows_folder_icon;
        execFile.mockReset();
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

            expect(electronApp.getFileIcon).toHaveBeenCalledWith('/Users/testuser/Documents', { size: 'normal' });
            expect(result).toBe('data:image/png;base64,native-folder-icon');
        });

        it('shares one native Windows stock icon request across different folders and concurrent callers', async () => {
            iconManager.platform = 'win32';
            const script = '[StockFolderIcon]::Read()'; fs.readFileSync.mockReturnValue(script);
            let reply; execFile.mockImplementation((_exe, _args, _options, callback) => { reply = callback; });
            const app = { getFileIcon: jest.fn() };
            const first = iconManager.get_folder_icon_for_platform('C:\\Users\\test\\Documents', app);
            const second = iconManager.get_folder_icon_for_platform('\\\\server\\share\\folder', app);
            const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1kAAAAASUVORK5CYII=';
            reply(null, png + '\r\n');
            expect(await first).toBe(`data:image/png;base64,${png}`);
            expect(await second).toBe(await first);
            expect(execFile).toHaveBeenCalledTimes(1);
            const [executable, args, options] = execFile.mock.calls[0];
            expect(executable).toMatch(/WindowsPowerShell\\v1\.0\\powershell\.exe$/);
            expect(args.slice(0, -1)).toEqual(['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand']);
            expect(Buffer.from(args.at(-1), 'base64').toString('utf16le')).toBe(script);
            expect(options).toEqual({ timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true });
            expect(app.getFileIcon).not.toHaveBeenCalled();
        });

        it.each([new Error('PowerShell unavailable'), null])('falls back once when the Windows request fails or returns non-PNG output: %s', async error => {
            iconManager.platform = 'win32'; fs.readFileSync.mockReturnValue('[StockFolderIcon]::Read()');
            execFile.mockImplementation((_exe, _args, _options, callback) => callback(error, 'not an icon'));
            const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                const fallback = path.join(__dirname, '..', '..', 'assets', 'icons', 'folder.svg');
                expect(await iconManager.get_folder_icon_for_platform('C:\\Documents', {})).toBe(fallback);
                expect(await iconManager.get_folder_icon_for_platform('C:\\Other', {})).toBe(fallback);
                expect(execFile).toHaveBeenCalledTimes(1);
                expect(warning).toHaveBeenCalledTimes(1);
            } finally { warning.mockRestore(); }
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
test('missing or unresponsive gsettings keeps startup icon fallback available', () => {
    execFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    expect(iconManager.get_icon_theme()).toBe('');
    expect(iconManager.get_folder_icon(null, '/tmp/folder')).toBeTruthy();
    expect(execFileSync).toHaveBeenCalledWith('gsettings', expect.any(Array), expect.objectContaining({ timeout: 1500 }));
});
