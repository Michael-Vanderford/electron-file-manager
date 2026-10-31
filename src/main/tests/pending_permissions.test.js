const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
test('closing the initiating window during a permission probe prevents further work or fallback messages', async () => {
    const start = source.indexOf('    async can_write_to_directory(');
    const end = source.indexOf('    // open', start);
    const fallback = { isDestroyed: () => false, send: jest.fn() };
    const check = vm.runInNewContext(`({${source.slice(start, end)}}).can_write_to_directory`, { win: fallback });
    let resolve;
    const manager = { is_writable_directory: () => new Promise(done => { resolve = done; }) };
    let closed = false;
    const sender = { isDestroyed: () => closed, send: jest.fn() };
    const pending = check.call(manager, { sender }, '/fixture');
    closed = true; resolve(true);
    await expect(pending).resolves.toBe(false);
    expect(sender.send).not.toHaveBeenCalled(); expect(fallback.send).not.toHaveBeenCalled();
});
