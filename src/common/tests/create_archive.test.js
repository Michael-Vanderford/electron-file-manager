const { AbortController } = require('vm').runInThisContext('globalThis');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { create_archive } = require('../create_archive');
let root, source, destination, journal_dir, job;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-archive-'));
    source = path.join(root, 'report.txt'); destination = path.join(root, 'report.zip');
    journal_dir = path.join(root, 'journals'); fs.writeFileSync(source, 'source bytes');
    job = { files_arr: [{ href: source, is_dir: false }], location: root, type: 'zip', destination };
});
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

test('existing archive stays byte-identical until overwrite is explicitly requested', async () => {
    fs.writeFileSync(destination, 'original archive');
    await expect(create_archive(job, { journal_dir })).rejects.toMatchObject({ code: 'EEXIST' });
    expect(fs.readFileSync(destination, 'utf8')).toBe('original archive');
    await create_archive({ ...job, overwrite: true }, { journal_dir });
    expect(fs.readFileSync(destination).subarray(0, 2).toString()).toBe('PK');
    expect(fs.readFileSync(source, 'utf8')).toBe('source bytes');
});

test('selecting an archive whose generated output equals input is rejected without truncation', async () => {
    fs.writeFileSync(destination, 'selected archive');
    await expect(create_archive({ ...job, files_arr: [{ href: destination }], overwrite: true }, { journal_dir }))
        .rejects.toThrow('same entry');
    expect(fs.readFileSync(destination, 'utf8')).toBe('selected archive');
});

test('failed input stream never replaces a valid existing archive', async () => {
    fs.writeFileSync(destination, 'original archive');
    // Use a source disappearing after validation to exercise archiver warning/error propagation.
    const lstat = fs.promises.lstat.bind(fs.promises);
    let seen = false;
    jest.spyOn(fs.promises, 'lstat').mockImplementation(async location => {
        const stat = await lstat(location);
        if (location === source && !seen) { seen = true; fs.unlinkSync(source); }
        return stat;
    });
    await expect(create_archive({ ...job, overwrite: true }, { journal_dir })).rejects.toBeDefined();
    expect(fs.readFileSync(destination, 'utf8')).toBe('original archive');
});

test('cancellation keeps original archive and source bytes', async () => {
    fs.writeFileSync(destination, 'original archive');
    const abort = new AbortController(); abort.abort();
    await expect(create_archive({ ...job, overwrite: true }, { journal_dir, signal: abort.signal })).rejects.toBeDefined();
    expect(fs.readFileSync(destination, 'utf8')).toBe('original archive');
    expect(fs.readFileSync(source, 'utf8')).toBe('source bytes');
});

test('output through a directory alias cannot be placed inside an input folder', async () => {
    const folder = path.join(root, 'folder'); fs.mkdirSync(folder);
    fs.symlinkSync(folder, path.join(root, 'alias'));
    await expect(create_archive({ ...job, files_arr: [{ href: folder, is_dir: true }],
        destination: path.join(root, 'alias', 'nested.zip') }, { journal_dir })).rejects.toThrow('itself');
    expect(fs.readdirSync(folder)).toEqual([]);
});

test('a destination created during compression is never overwritten', async () => {
    await expect(create_archive(job, { journal_dir, progress: () => fs.writeFileSync(destination, 'concurrent archive') }))
        .rejects.toMatchObject({ code: 'EEXIST' });
    expect(fs.readFileSync(destination, 'utf8')).toBe('concurrent archive');
    expect(fs.readFileSync(source, 'utf8')).toBe('source bytes');
});

test('an existing archive symlink does not expose its target to replacement writes', async () => {
    const target = path.join(root, 'precious.zip'); fs.writeFileSync(target, 'precious archive');
    fs.symlinkSync(target, destination);
    await create_archive({ ...job, overwrite: true }, { journal_dir });
    expect(fs.lstatSync(destination).isFile()).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('precious archive');
});
