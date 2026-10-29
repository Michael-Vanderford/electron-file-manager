const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('worker_threads', () => ({ isMainThread: true, parentPort: { postMessage: jest.fn() } }));
const { parentPort } = require('worker_threads');
const libfs = require('../../common/libfs');
const { Utilities } = require('../move_worker');

let root;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'move-worker-'));
    jest.clearAllMocks();
});
afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
});

function setup() {
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'ok.txt'), 'ok');
    fs.writeFileSync(path.join(source, 'failed.txt'), 'keep me');
    return { source, destination, is_dir: true, name: 'source' };
}

function result() {
    return parentPort.postMessage.mock.calls.map(([message]) => message).find(message => message.cmd === 'mv_done');
}

test('moves a directory and reports only successful source/destination pairs', async () => {
    const file = setup();
    await new Utilities().move([file]);
    expect(fs.existsSync(file.source)).toBe(false);
    expect(fs.readFileSync(path.join(file.destination, 'failed.txt'), 'utf8')).toBe('keep me');
    expect(result().files_arr).toHaveLength(3);
});

test('a failed child move preserves the source directory and excludes failed items', async () => {
    const file = setup();
    const move = libfs.mv.bind(libfs);
    jest.spyOn(libfs, 'mv').mockImplementation((source, destination, callback) => {
        if (source.endsWith('failed.txt')) return callback(new Error('permission denied'));
        move(source, destination, callback);
    });
    await new Utilities().move([file]);
    expect(fs.readFileSync(path.join(file.source, 'failed.txt'), 'utf8')).toBe('keep me');
    expect(fs.readFileSync(path.join(file.destination, 'ok.txt'), 'utf8')).toBe('ok');
    expect(result().files_arr.map(file => file.source)).toEqual([path.join(file.source, 'ok.txt')]);
});

test('nested directories are removed only after their children move', async () => {
    const file = setup();
    const nested = path.join(file.source, 'nested', 'deep');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'child.txt'), 'nested contents');

    await new Utilities().move([file]);

    expect(fs.existsSync(file.source)).toBe(false);
    expect(fs.readFileSync(path.join(file.destination, 'nested', 'deep', 'child.txt'), 'utf8')).toBe('nested contents');
    expect(result().files_arr.filter(item => item.is_dir).map(item => item.source)).toEqual([
        nested, path.dirname(nested), file.source
    ]);
});

test('cancellation after one file preserves remaining files and source directories', async () => {
    const file = setup();
    const worker = new Utilities();
    const move = libfs.mv.bind(libfs);
    let completed;
    jest.spyOn(libfs, 'mv').mockImplementation((source, destination, callback) => {
        move(source, destination, (error, value) => {
            completed = source;
            worker.cancel();
            callback(error, value);
        });
    });

    await worker.move([file]);

    expect(result().cancelled).toBe(true);
    expect(result().files_arr.map(item => item.source)).toEqual([completed]);
    const remaining = fs.readdirSync(file.source);
    expect(remaining).toHaveLength(1);
    expect(fs.readFileSync(path.join(file.source, remaining[0]), 'utf8')).toBeTruthy();
    expect(libfs.mv).toHaveBeenCalledTimes(1);
});

test('directory listing failure leaves source contents intact', async () => {
    const file = setup();
    jest.spyOn(libfs, 'ls').mockImplementation((source, callback) => callback(new Error('listing denied')));
    const move = jest.spyOn(libfs, 'mv');

    await new Utilities().move([file]);

    expect(result().files_arr).toEqual([]);
    expect(move).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(file.source, 'failed.txt'), 'utf8')).toBe('keep me');
    expect(fs.existsSync(file.destination)).toBe(false);
});

test('cleanup failure preserves a newly created source file', async () => {
    const file = setup();
    const rmdir = fs.rmdirSync.bind(fs);
    jest.spyOn(fs, 'rmdirSync').mockImplementation(source => {
        fs.writeFileSync(path.join(source, 'new.txt'), 'arrived during move');
        return rmdir(source);
    });

    await new Utilities().move([file]);

    expect(fs.readFileSync(path.join(file.source, 'new.txt'), 'utf8')).toBe('arrived during move');
    expect(result().files_arr.some(item => item.source === file.source)).toBe(false);
    expect(parentPort.postMessage).toHaveBeenCalledWith({
        cmd: 'set_msg', msg: 'Move incomplete. Some items could not be moved.'
    });
});

test('an empty directory is moved and reported', async () => {
    const source = path.join(root, 'empty');
    const destination = path.join(root, 'moved-empty');
    fs.mkdirSync(source);

    await new Utilities().move([{ source, destination, is_dir: true }]);

    expect(fs.existsSync(source)).toBe(false);
    expect(fs.statSync(destination).isDirectory()).toBe(true);
    expect(result().files_arr.map(item => item.source)).toEqual([source]);
});
