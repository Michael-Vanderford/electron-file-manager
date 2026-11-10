const fs = require('fs');
const os = require('os');
const path = require('path');
const { can_rename } = require('../rename_during_copy');
const { OperationQueue } = require('../../main/lib/OperationQueue');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-concurrent-rename-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
test('unrelated rename runs while copy remains active and holds subsequent work', async () => {
    const queue = new OperationQueue();
    const sender = { isDestroyed: () => false };
    const source = path.join(root, 'rename-me'); fs.mkdirSync(source);
    const destination = path.join(root, 'renamed');
    queue.enqueue({ sender, operation: 'copy', paths: [path.join(root, 'copy-source'), path.join(root, 'copy-target')], start: () => {} });
    expect(await can_rename(queue, source, destination)).toBe(true);
    const copy = queue.active;
    let renamed;
    const complete = new Promise(resolve => { renamed = resolve; });
    queue.run_parallel({ sender, operation: 'rename', start: async job => {
        await fs.promises.rename(source, destination);
        renamed();
        // Remain active until explicitly finished, to exercise queue ordering.
    } });
    await complete;
    expect(fs.existsSync(destination)).toBe(true);
    expect(queue.active).toBe(copy);
    const next = jest.fn(); queue.enqueue({ sender, operation: 'copy', start: next });
    copy.finish(); expect(next).not.toHaveBeenCalled();
    queue.parallel.finish(); expect(next).toHaveBeenCalledTimes(1);
});
test('related paths, parent aliases and pending operations retain serialization', async () => {
    const source = path.join(root, 'source'); fs.mkdirSync(source);
    const alias = path.join(root, 'alias'); fs.symlinkSync(source, alias);
    const queue = new OperationQueue();
    queue.enqueue({ sender: { isDestroyed: () => false }, operation: 'copy', paths: [source, path.join(root, 'target')], start: () => {} });
    for (const directory of [source, alias, root, path.join(source, 'child')]) {
        expect(await can_rename(queue, directory, path.join(root, 'new-name'))).toBe(false);
    }
    queue.pending.push({ paths: [path.join(root, 'other')] });
    expect(await can_rename(queue, path.join(root, 'other'), path.join(root, 'new-name'))).toBe(false);
});
