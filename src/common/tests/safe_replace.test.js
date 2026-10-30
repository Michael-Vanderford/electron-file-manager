const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const safe = require('../safe_replace');
let root, source, destination, journal_dir;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-safe-replace-'));
    source = path.join(root, 'source'); destination = path.join(root, 'destination');
    journal_dir = path.join(root, 'journals');
    fs.writeFileSync(source, 'new contents'); fs.writeFileSync(destination, 'original');
});
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
const options = () => ({ journal_dir, overwrite: true });

test('verified file and directory replacements preserve copy sources and replace entire destinations', async () => {
    await safe.transfer(source, destination, options());
    expect(fs.readFileSync(source, 'utf8')).toBe('new contents');
    expect(fs.readFileSync(destination, 'utf8')).toBe('new contents');
    fs.unlinkSync(source); fs.unlinkSync(destination);
    fs.mkdirSync(source); fs.mkdirSync(destination);
    fs.writeFileSync(path.join(source, 'new.txt'), 'new');
    fs.writeFileSync(path.join(destination, 'old.txt'), 'old');
    await safe.transfer(source, destination, { ...options(), move: true });
    expect(fs.existsSync(source)).toBe(false);
    expect(fs.readdirSync(destination)).toEqual(['new.txt']);
    expect(fs.readdirSync(journal_dir)).toEqual([]);
});

test.each(['ENOSPC', 'EACCES'])('staging %s preserves both source and original', async code => {
    jest.spyOn(fsp, 'cp').mockRejectedValue(Object.assign(new Error(code), { code }));
    await expect(safe.transfer(source, destination, { ...options(), move: true })).rejects.toThrow(code);
    expect(fs.readFileSync(source, 'utf8')).toBe('new contents');
    expect(fs.readFileSync(destination, 'utf8')).toBe('original');
    expect(fs.readdirSync(journal_dir)).toEqual([]);
});

test('cancellation after staging and after backup restores the original', async () => {
    let cancelled = false;
    await expect(safe.replace(destination, async staged => {
        await fsp.writeFile(staged, 'staged'); cancelled = true;
    }, { ...options(), cancelled: () => cancelled })).rejects.toMatchObject({ code: 'ECANCELED' });
    expect(fs.readFileSync(destination, 'utf8')).toBe('original');
    cancelled = false;
    const rename = fsp.rename.bind(fsp);
    jest.spyOn(fsp, 'rename').mockImplementation(async (from, to) => {
        await rename(from, to);
        if (to.endsWith('/original')) cancelled = true;
    });
    await expect(safe.replace(destination, staged => fsp.writeFile(staged, 'staged'),
        { ...options(), cancelled: () => cancelled })).rejects.toMatchObject({ code: 'ECANCELED' });
    expect(fs.readFileSync(destination, 'utf8')).toBe('original');
});

test('publish failure restores original and keeps move source', async () => {
    jest.spyOn(fsp, 'link').mockRejectedValue(new Error('publish denied'));
    await expect(safe.transfer(source, destination, { ...options(), move: true })).rejects.toThrow('publish denied');
    expect(fs.readFileSync(source, 'utf8')).toBe('new contents');
    expect(fs.readFileSync(destination, 'utf8')).toBe('original');
});

test('a concurrent creator is preserved and original backup remains recoverable', async () => {
    const rename = fsp.rename.bind(fsp);
    jest.spyOn(fsp, 'rename').mockImplementation(async (from, to) => {
        await rename(from, to);
        if (to.endsWith('/original')) fs.writeFileSync(destination, 'concurrent creator');
    });
    await expect(safe.transfer(source, destination, options())).rejects.toThrow('Original retained');
    expect(fs.readFileSync(destination, 'utf8')).toBe('concurrent creator');
    const record = JSON.parse(fs.readFileSync(path.join(journal_dir, fs.readdirSync(journal_dir)[0])));
    expect(fs.readFileSync(path.join(record.work, 'original'), 'utf8')).toBe('original');
    expect(await safe.recover(journal_dir)).toHaveLength(1);
});

test('restart recovers original after the process dies immediately after backup rename', async () => {
    const script = `
        const fs = require('fs/promises');
        const rename = fs.rename.bind(fs);
        fs.rename = async (from, to) => { await rename(from, to); if (to.endsWith('/original')) process.exit(23); };
        require(${JSON.stringify(require.resolve('../safe_replace'))}).transfer(
            ${JSON.stringify(source)}, ${JSON.stringify(destination)}, ${JSON.stringify(options())}
        ).catch(() => process.exit(1));
    `;
    const child = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
    expect(child.status).toBe(23);
    expect(fs.existsSync(destination)).toBe(false);
    expect(await safe.recover(journal_dir)).toEqual([]);
    expect(fs.readFileSync(destination, 'utf8')).toBe('original');
    expect(fs.readFileSync(source, 'utf8')).toBe('new contents');
});

test('verification rejects a changed source and leaves original untouched', async () => {
    const cp = fsp.cp.bind(fsp);
    jest.spyOn(fsp, 'cp').mockImplementation(async (...args) => {
        await cp(...args); fs.writeFileSync(source, 'changed during copy');
    });
    await expect(safe.transfer(source, destination, options())).rejects.toThrow('verification failed');
    expect(fs.readFileSync(destination, 'utf8')).toBe('original');
    expect(fs.readFileSync(source, 'utf8')).toBe('changed during copy');
});

test('directory aliases and ancestor replacements are rejected', async () => {
    fs.unlinkSync(source); fs.mkdirSync(source);
    fs.symlinkSync(source, path.join(root, 'alias'), 'dir');
    await expect(safe.assert_destination(source, path.join(root, 'alias', 'child'))).rejects.toThrow('itself');
    await expect(safe.assert_destination(path.join(root, 'source'), root)).rejects.toThrow('containing');
});

test('exclusive archive publication never replaces an existing or concurrently created file', async () => {
    await expect(safe.replace(destination, () => {}, { journal_dir })).rejects.toMatchObject({ code: 'EEXIST' });
    fs.unlinkSync(destination);
    await expect(safe.replace(destination, async staged => {
        fs.writeFileSync(staged, 'archive'); fs.writeFileSync(destination, 'raced');
    }, { journal_dir })).rejects.toMatchObject({ code: 'EEXIST' });
    expect(fs.readFileSync(destination, 'utf8')).toBe('raced');
});

test('source cleanup preserves a file arriving after replacement commits', async () => {
    fs.unlinkSync(source); fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'initial.txt'), 'initial');
    // Directory publication uses rename; introduce a new source file once publication succeeds.
    const rename = fsp.rename.bind(fsp);
    jest.spyOn(fsp, 'rename').mockImplementation(async (from, to) => {
        await rename(from, to);
        if (to === destination && path.basename(from) === 'replacement') fs.writeFileSync(path.join(source, 'arrived.txt'), 'new file');
    });
    await expect(safe.transfer(source, destination, { ...options(), move: true })).rejects.toThrow('source changed');
    expect(fs.readFileSync(path.join(source, 'arrived.txt'), 'utf8')).toBe('new file');
    expect(fs.readFileSync(path.join(destination, 'initial.txt'), 'utf8')).toBe('initial');
});

test('replacement locking rejects overlapping jobs without changing the original', async () => {
    let release, entered;
    const waiting = new Promise(resolve => { entered = resolve; });
    const first = safe.replace(destination, async staged => {
        entered(); await new Promise(resolve => { release = resolve; }); await fsp.writeFile(staged, 'first');
    }, options());
    await waiting;
    await expect(safe.replace(destination, staged => fsp.writeFile(staged, 'second'), options()))
        .rejects.toMatchObject({ code: 'EBUSY' });
    expect(fs.readFileSync(destination, 'utf8')).toBe('original');
    release(); await first;
    expect(fs.readFileSync(destination, 'utf8')).toBe('first');
});
