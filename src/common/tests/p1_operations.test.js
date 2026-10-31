const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { path_id } = require('../path_id');
const { recent_files } = require('../recent_files');
const libfs = require('../libfs');
const { create_archive } = require('../create_archive');
const { extract_archive } = require('../extract_archive');
const { OperationQueue } = require('../../main/lib/OperationQueue');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-p1-')); });
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

test('UTF-8 path identities match Node base64 without changing ASCII identities', () => {
    for (const value of ['/ascii/file', '/😀/中文/café.txt']) expect(path_id(value)).toBe(Buffer.from(value).toString('base64'));
});

test('Recent normalizes zero/one/many, filters stale and invalid URIs, and rejects malformed XML', () => {
    const file = path.join(root, '😀.txt'); fs.writeFileSync(file, 'bytes');
    const uri = require('url').pathToFileURL(file).href;
    const get = href => ({ href });
    expect(recent_files('<xbel/>', get)).toEqual([]);
    expect(recent_files(`<xbel><bookmark href="${uri}"/></xbel>`, get)).toEqual([{ href: file, id: path_id(file) }]);
    expect(recent_files(`<xbel><bookmark href="file:///missing"/><bookmark href="${uri}"/><bookmark href="https://invalid"/></xbel>`, get)).toHaveLength(1);
    expect(() => recent_files('<xbel><bookmark>', get)).toThrow('Invalid');
});

test('queued operations retain sender ownership and cancellation cannot affect another renderer', () => {
    const one = { isDestroyed: () => false }, two = { isDestroyed: () => false };
    const queue = new OperationQueue(); const cancel = jest.fn(); const order = [];
    queue.enqueue({ sender: one, operation: 'copy', start: job => { order.push(1); job.cancel = cancel; } });
    queue.enqueue({ sender: two, operation: 'copy', start: () => order.push(2) });
    queue.cancel(two, 'copy'); expect(cancel).not.toHaveBeenCalled();
    queue.enqueue({ sender: two, operation: 'move', start: () => order.push(3) });
    queue.cancel(one, 'copy'); expect(cancel).toHaveBeenCalledTimes(1);
    queue.active.finish(); expect(order).toEqual([1, 3]);
});

function crossDevice(source, destination) {
    jest.spyOn(fs, 'rename').mockImplementation((from, to, callback) => callback(Object.assign(new Error('cross device'), { code: 'EXDEV' })));
    return new Promise((resolve, reject) => libfs.mv(source, destination, (error, result) => error ? reject(error) : resolve(result), { journal_dir: path.join(root, 'journals') }));
}

test('real EXDEV fallback verifies nested bytes and symlink text before source cleanup', async () => {
    const source = path.join(root, 'source'), destination = path.join(root, 'destination');
    fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'file'), 'verified bytes'); fs.symlinkSync('file', path.join(source, 'link'));
    await crossDevice(source, destination);
    expect(fs.existsSync(source)).toBe(false);
    expect(fs.readFileSync(path.join(destination, 'file'), 'utf8')).toBe('verified bytes');
    expect(fs.readlinkSync(path.join(destination, 'link'))).toBe('file');
});

test('EXDEV copy failure retains the complete source', async () => {
    const source = path.join(root, 'source'), destination = path.join(root, 'destination');
    fs.writeFileSync(source, 'original');
    jest.spyOn(fs.promises, 'cp').mockRejectedValue(Object.assign(new Error('disk full'), { code: 'ENOSPC' }));
    await expect(crossDevice(source, destination)).rejects.toMatchObject({ code: 'ENOSPC' });
    expect(fs.readFileSync(source, 'utf8')).toBe('original'); expect(fs.existsSync(destination)).toBe(false);
});

test.each(['zip', 'tar.gz', 'tar.xz'])('archive %s has correct bytes and extracts nested literal names', async type => {
    const source = path.join(root, 'folder'); fs.mkdirSync(source); fs.writeFileSync(path.join(source, '😀\n.txt'), 'round trip');
    const destination = path.join(root, `archive.${type}`);
    await create_archive({ files_arr: [{ href: source, is_dir: true }], location: root, type, destination }, { journal_dir: path.join(root, 'journals') });
    if (type === 'tar.xz') expect(fs.readFileSync(destination).subarray(0, 6).toString('hex')).toBe('fd377a585a00');
    const extracted = await extract_archive(destination, root);
    expect(fs.readFileSync(path.join(extracted, 'folder', '😀\n.txt'), 'utf8')).toBe('round trip');
});

test.each(['traversal', 'symlink', 'hardlink'])('extraction rejects %s without changing an outside sentinel', async kind => {
    const source = path.join(root, `${kind}.tar`); const outside = path.join(root, 'sentinel'); fs.writeFileSync(outside, 'original');
    execFileSync('python3', ['-c', `import tarfile,io,sys\np=sys.argv[1];kind=sys.argv[2]\nwith tarfile.open(p,'w') as a:\n t=tarfile.TarInfo('../sentinel' if kind=='traversal' else 'link')\n if kind=='traversal':\n  t.size=7;a.addfile(t,io.BytesIO(b'changed'))\n else:\n  t.type=tarfile.SYMTYPE if kind=='symlink' else tarfile.LNKTYPE;t.linkname='../sentinel';a.addfile(t)`, source, kind]);
    await expect(extract_archive(source, root)).rejects.toThrow();
    expect(fs.readFileSync(outside, 'utf8')).toBe('original');
    expect(fs.existsSync(path.join(root, kind))).toBe(false);
});

test.each(['tar', 'tar.bz2', '7z'])('compatible %s archives extract through the checked reader', async type => {
    const nested = path.join(root, 'nested'); fs.mkdirSync(nested); fs.writeFileSync(path.join(nested, 'data.txt'), 'compatible');
    const source = path.join(root, `misleading.zip.${type}`);
    if (type === '7z') execFileSync('7z', ['a', '-t7z', source, 'nested'], { cwd: root, stdio: 'pipe' });
    else execFileSync('tar', [type === 'tar' ? '-cf' : '-cjf', source, '-C', root, 'nested']);
    const destination = await extract_archive(source, root);
    expect(fs.readFileSync(path.join(destination, 'nested', 'data.txt'), 'utf8')).toBe('compatible');
});

test('cancelled extraction kills the helper and removes partial output', async () => {
    const source = path.join(root, 'archive.tar'); fs.writeFileSync(path.join(root, 'payload'), Buffer.alloc(1024 * 1024, 65));
    execFileSync('tar', ['-cf', source, '-C', root, 'payload']);
    const { AbortController } = require('vm').runInThisContext('globalThis');
    const controller = new AbortController();
    await expect(extract_archive(source, root, () => {}, { signal: controller.signal, on_child: () => controller.abort() })).rejects.toThrow();
    expect(fs.existsSync(path.join(root, 'archive'))).toBe(false);
    expect(fs.statSync(source).size).toBeGreaterThan(0);
});

test('EXDEV source cleanup failure preserves the source and verified destination', async () => {
    const source = path.join(root, 'source'), destination = path.join(root, 'destination'); fs.writeFileSync(source, 'original');
    const unlink = fs.promises.unlink.bind(fs.promises);
    jest.spyOn(fs.promises, 'unlink').mockImplementation(file => file === source ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : unlink(file));
    await expect(crossDevice(source, destination)).rejects.toMatchObject({ code: 'EACCES' });
    expect(fs.readFileSync(source, 'utf8')).toBe('original'); expect(fs.readFileSync(destination, 'utf8')).toBe('original');
});

test('EXDEV cancellation during verification preserves the source', async () => {
    const source = path.join(root, 'source'), destination = path.join(root, 'destination'); fs.writeFileSync(source, 'original');
    jest.spyOn(fs, 'rename').mockImplementation((_from, _to, callback) => callback(Object.assign(new Error('cross device'), { code: 'EXDEV' })));
    let cancelled = false; const copy = fs.promises.cp.bind(fs.promises);
    jest.spyOn(fs.promises, 'cp').mockImplementation(async (...args) => { await copy(...args); cancelled = true; });
    await expect(new Promise((resolve, reject) => libfs.mv(source, destination, (error, result) => error ? reject(error) : resolve(result), {
        journal_dir: path.join(root, 'journals'), cancelled: () => cancelled
    }))).rejects.toMatchObject({ code: 'ECANCELED' });
    expect(fs.readFileSync(source, 'utf8')).toBe('original'); expect(fs.existsSync(destination)).toBe(false);
});
