const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('worker_threads', () => ({ isMainThread: true, parentPort: { postMessage: jest.fn() }, workerData: {} }));
const { parentPort } = require('worker_threads');
const libfs = require('../../common/libfs');
const { Utilities } = require('../paste_worker');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-copy-results-')); jest.clearAllMocks(); });
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
const result = () => parentPort.postMessage.mock.calls.map(([message]) => message).find(message => message.cmd === 'cp_done');

test.each(['false', 'throw'])('directory creation %s reports failure and does not copy descendants', async outcome => {
    const source = path.join(root, 'source'), destination = path.join(root, 'destination');
    fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'child'), 'preserve');
    jest.spyOn(libfs, 'mkdir').mockImplementation(() => {
        if (outcome === 'throw') throw new Error('EACCES');
        return false;
    });
    const copy = jest.spyOn(libfs, 'cp_async');
    await new Utilities().poste([{ source, destination }]);
    expect(result().completed).toEqual([]);
    expect(result().failures.map(file => file.source).sort()).toEqual([source, path.join(source, 'child')].sort());
    expect(copy).not.toHaveBeenCalled(); expect(fs.existsSync(destination)).toBe(false);
    expect(fs.readFileSync(path.join(source, 'child'), 'utf8')).toBe('preserve');
});

test('callback copy failure and missing sources do not inflate the success count', async () => {
    const source = path.join(root, 'source'); fs.writeFileSync(source, 'preserve');
    jest.spyOn(libfs, 'cp_async').mockImplementation((_source, _destination, callback) => callback(Object.assign(new Error('disk full'), { code: 'ENOSPC' })));
    await new Utilities().poste([{ source, destination: path.join(root, 'failed') }, { source: path.join(root, 'missing'), destination: path.join(root, 'absent') }]);
    expect(result().completed).toEqual([]); expect(result().failures).toHaveLength(2);
    expect(fs.readFileSync(source, 'utf8')).toBe('preserve');
});

test('cancellation identifies completed and unattempted entries separately', async () => {
    const one = path.join(root, 'one'), two = path.join(root, 'two');
    fs.writeFileSync(one, 'one'); fs.writeFileSync(two, 'two');
    const utility = new Utilities();
    const copy = libfs.cp_async.bind(libfs);
    jest.spyOn(libfs, 'cp_async').mockImplementation((source, destination, callback) => copy(source, destination, (error, value) => {
        utility.cancel(); callback(error, value);
    }));
    await utility.poste([{ source: one, destination: path.join(root, 'copied-one') }, { source: two, destination: path.join(root, 'copied-two') }]);
    expect(result().cancelled).toBe(true);
    expect(result().completed.map(file => file.source)).toEqual([one]);
    expect(result().cancelled_entries.map(file => file.source)).toEqual([two]);
    expect(fs.existsSync(path.join(root, 'copied-two'))).toBe(false);
});
