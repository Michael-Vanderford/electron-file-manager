const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('worker_threads', () => ({ isMainThread: true, parentPort: { postMessage: jest.fn() }, workerData: {} }));
const { parentPort, workerData } = require('worker_threads');
const libfs = require('../../common/libfs');
const { Utilities: Copy } = require('../paste_worker');
const { Utilities: Move } = require('../move_worker');
const { DeleteWorker } = require('../delete_worker');
let root, target;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-link-safety-'));
    workerData.journal_dir = path.join(root, 'journals');
    target = path.join(root, 'target'); fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'precious.txt'), 'never change');
    jest.clearAllMocks();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

async function operate(operation, source, destination) {
    const file = { ...libfs.get_file(source), source, destination };
    if (operation === 'copy') await new Copy().poste([file]);
    else if (operation === 'move') await new Move().move([file]);
    else await new DeleteWorker({ parentPort }).run([file]);
}

for (const operation of ['copy', 'move', 'delete']) {
    test.each(['directory', 'broken', 'cycle'])(`${operation} selected %s symlink preserves link text and target`, async kind => {
        const source = path.join(root, 'selected');
        const destination = path.join(root, 'result');
        const link = kind === 'directory' ? target : kind === 'broken' ? '/does-not-exist/efm' : 'selected';
        fs.symlinkSync(link, source);
        await operate(operation, source, destination);
        expect(fs.readFileSync(path.join(target, 'precious.txt'), 'utf8')).toBe('never change');
        if (operation === 'delete') expect(parentPort.postMessage).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'delete_done', deleted_files: 1 }));
        if (operation !== 'delete') {
            expect(fs.lstatSync(destination).isSymbolicLink()).toBe(true);
            expect(fs.readlinkSync(destination)).toBe(link);
        }
        expect(fs.existsSync(source) || (() => { try { fs.lstatSync(source); return true; } catch { return false; } })())
            .toBe(operation === 'copy');
    });
    test(`${operation} a folder containing directory and cyclic links never traverses their targets`, async () => {
        const source = path.join(root, 'folder'); const destination = path.join(root, 'result');
        fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'local.txt'), 'local');
        fs.symlinkSync(target, path.join(source, 'outside'));
        fs.symlinkSync('.', path.join(source, 'loop'));
        await operate(operation, source, destination);
        expect(fs.readFileSync(path.join(target, 'precious.txt'), 'utf8')).toBe('never change');
        if (operation !== 'delete') {
            expect(fs.readlinkSync(path.join(destination, 'outside'))).toBe(target);
            expect(fs.readlinkSync(path.join(destination, 'loop'))).toBe('.');
            expect(fs.readFileSync(path.join(destination, 'local.txt'), 'utf8')).toBe('local');
        }
    });
    if (operation !== 'delete') test(`${operation} rejects a destination inside the source through an alias`, async () => {
        const source = path.join(root, 'folder'); fs.mkdirSync(source);
        fs.writeFileSync(path.join(source, 'local.txt'), 'local');
        fs.symlinkSync(source, path.join(root, 'alias'));
        await operate(operation, source, path.join(root, 'alias', 'nested'));
        expect(fs.existsSync(path.join(source, 'nested'))).toBe(false);
        expect(fs.readFileSync(path.join(source, 'local.txt'), 'utf8')).toBe('local');
        expect(parentPort.postMessage).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'set_msg', msg: expect.stringContaining('itself') }));
    });
}

test('copying onto a dangling destination link never writes through to its target', async () => {
    const source = path.join(root, 'source.txt'); const destination = path.join(root, 'result');
    const missing = path.join(target, 'missing.txt');
    fs.writeFileSync(source, 'new bytes'); fs.symlinkSync(missing, destination);
    await operate('copy', source, destination);
    expect(fs.existsSync(missing)).toBe(false);
    expect(fs.readlinkSync(destination)).toBe(missing);
});
