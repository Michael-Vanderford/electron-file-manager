const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const iconManager = require('../lib/IconManager.js');

jest.mock('fs');
jest.mock('child_process', () => ({
    execSync: jest.fn(() => Buffer.from("'Fluent-dark'")), // or whatever theme you want to simulate
}));
jest.mock('os', () => ({
    homedir: jest.fn(() => '/home/michael')
}));

describe('IconManager', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
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
            expect(result).toBe(path.join(__dirname, '../assets/icons/emblem-symbolic-link.svg'));
        });
    });

    describe('get_readonly_icon', () => {
        it('should return the correct readonly icon path when found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('emblem-symbolic-readonly.svg');
            });

            const result = iconManager.get_readonly_icon();
            expect(result).toContain('emblem-symbolic-readonly.svg');
        });

        it('should return the fallback readonly icon path when not found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            fs.existsSync.mockReturnValue(false);

            const result = iconManager.get_readonly_icon();
            expect(result).toBe(path.join(__dirname, '../assets/icons/emblem-symbolic-readonly.svg'));
        });
    });

    describe('get_theme_path', () => {
        it('should return the correct theme path when found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('Fluent-dark');
            });

            const result = iconManager.get_theme_path();
            expect(result).toContain('Fluent-dark');
        });

        it('should return the fallback theme path when not found', () => {
            execSync.mockReturnValue(Buffer.from('Fluent-dark'));
            fs.existsSync.mockReturnValue(false);

            const result = iconManager.get_theme_path();
            expect(result).toBe(path.join(__dirname, 'assets/icons/'));
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
            expect(result).toBe(path.join(__dirname, '../assets/icons/folder.svg'));
        });
    });

});