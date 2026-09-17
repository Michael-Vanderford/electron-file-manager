const fs = require('fs');
const path = require('path');
const os = require('os');
const libfs = require('../libfs.js');

describe('libfs class', () => {
    let tmpDir;

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libfs-test-'));
        fs.writeFileSync(path.join(tmpDir, 'test-file.txt'), 'hello world');
        fs.mkdirSync(path.join(tmpDir, 'test-dir'));
        fs.writeFileSync(path.join(tmpDir, 'test-dir', 'nested.txt'), 'nested content');
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('get_file returns standard file object', () => {
        const file = libfs.get_file(path.join(tmpDir, 'test-file.txt'));
        expect(file).toBeDefined();
        expect(file.name).toBe('test-file.txt');
        expect(file.is_dir).toBe(false);
        expect(file.content_type).toBe('text/plain');
        expect(file.size).toBe(11);
        expect(file.is_readable).toBe(true);
        expect(file.is_writable).toBe(true);
        expect(file.href).toBe(path.join(tmpDir, 'test-file.txt'));
        expect(file.id).toBeDefined();
    });

    it('get_file detects directory correctly', () => {
        const dir = libfs.get_file(path.join(tmpDir, 'test-dir'));
        expect(dir.is_dir).toBe(true);
        expect(dir.content_type).toBe('inode/directory');
    });

    it('exists checks file existence', () => {
        expect(libfs.exists(path.join(tmpDir, 'test-file.txt'))).toBe(true);
        expect(libfs.exists(path.join(tmpDir, 'non-existent.txt'))).toBe(false);
    });

    it('ls lists directory contents asynchronously via callback', (done) => {
        libfs.ls(tmpDir, (err, dirents) => {
            expect(err).toBeNull();
            expect(Array.isArray(dirents)).toBe(true);
            const names = dirents.map(d => d.name);
            expect(names).toContain('test-file.txt');
            expect(names).toContain('test-dir');
            done();
        });
    });

    it('disk_stats returns partition disk information', () => {
        const stats = libfs.disk_stats(tmpDir);
        expect(stats).toBeDefined();
        expect(typeof stats.total).toBe('number');
        expect(typeof stats.free).toBe('number');
        expect(typeof stats.used).toBe('number');
    });

    it('set_execute and clear_execute toggle execute bit', () => {
        const filePath = path.join(tmpDir, 'test-file.txt');
        expect(libfs.set_execute(filePath)).toBe(true);
        expect(libfs.clear_execute(filePath)).toBe(true);
    });

    it('mv renames file successfully', (done) => {
        const src = path.join(tmpDir, 'file-to-move.txt');
        const dst = path.join(tmpDir, 'file-moved.txt');
        fs.writeFileSync(src, 'data');

        libfs.mv(src, dst, (err, result) => {
            expect(err).toBeNull();
            expect(fs.existsSync(dst)).toBe(true);
            expect(fs.existsSync(src)).toBe(false);
            done();
        });
    });

    it('count counts folders and files in directory', () => {
        const result = libfs.count(tmpDir);
        expect(result.folders).toBeGreaterThanOrEqual(1);
        expect(result.files).toBeGreaterThanOrEqual(1);
        expect(result.total).toBe(result.folders + result.files);
    });

    it('mkdir creates directory synchronously and via callback', (done) => {
        const dir1 = path.join(tmpDir, 'mkdir-sync');
        const dir2 = path.join(tmpDir, 'mkdir-async');
        expect(libfs.mkdir(dir1)).toBe(true);
        expect(fs.existsSync(dir1)).toBe(true);

        libfs.mkdir(dir2, (err, res) => {
            expect(err).toBeNull();
            expect(fs.existsSync(dir2)).toBe(true);
            done();
        });
    });

    it('cp_async copies directory/file', (done) => {
        const src = path.join(tmpDir, 'test-file.txt');
        const dst = path.join(tmpDir, 'test-file-copy.txt');
        libfs.cp_async(src, dst, (err, res) => {
            expect(err).toBeNull();
            expect(fs.existsSync(dst)).toBe(true);
            done();
        });
    });

    it('rm removes file/directory synchronously and via callback', (done) => {
        const targetSync = path.join(tmpDir, 'test-file-copy.txt');
        expect(libfs.rm(targetSync)).toBe(true);
        expect(fs.existsSync(targetSync)).toBe(false);

        const targetAsync = path.join(tmpDir, 'mkdir-async');
        libfs.rm(targetAsync, (err, res) => {
            expect(err).toBeNull();
            expect(fs.existsSync(targetAsync)).toBe(false);
            done();
        });
    });

    it('get_drives returns array via callback', (done) => {
        libfs.get_drives((err, drives) => {
            expect(err).toBeNull();
            expect(Array.isArray(drives)).toBe(true);
            done();
        });
    });
});
