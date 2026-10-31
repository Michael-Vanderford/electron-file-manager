const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
let manager, libfs, targets, probe, fallback;
beforeEach(() => {
    targets = new Map([[1, { isDestroyed: () => false, webContents: { send: jest.fn() } }], [2, { isDestroyed: () => false, webContents: { send: jest.fn() } }]]);
    libfs = { watch: jest.fn(), stop_watch: jest.fn() }; probe = jest.fn(); fallback = { isDestroyed: () => false, webContents: { send: jest.fn() } };
    manager = vm.runInNewContext(`${source.slice(source.indexOf('class Watcher {'), source.indexOf('class SettingsManager {'))}; new Watcher()`, {
        BrowserWindow: { fromId: id => targets.get(id) }, win: fallback, libfs, device_probe: probe,
        utilities: { run_watcher: true }, path, path_id: href => href, console
    });
});
test('unmatched subscribers never fall back to the globally focused window', () => {
    manager.window_dirs.set(1, '/other');
    manager.send_to_watchers_of('/old', 'remove_item', '/old/file');
    expect(targets.get(1).webContents.send).not.toHaveBeenCalled();
    expect(fallback.webContents.send).not.toHaveBeenCalled();
});
test('watch limit failure is visible only to its subscriber', () => {
    libfs.watch.mockImplementation(() => { throw new Error('ENOSPC watch limit'); });
    manager.watch('/fixture', 1);
    expect(targets.get(1).webContents.send).toHaveBeenCalledWith('set_msg', expect.stringContaining('watch limit'), '/fixture');
    expect(targets.get(2).webContents.send).not.toHaveBeenCalled();
});
test('navigation during pending metadata suppresses old events and close releases subscriptions', async () => {
    let resolve;
    probe.mockReturnValue(new Promise(done => { resolve = done; }));
    manager.watch('/old', 1);
    const callback = libfs.watch.mock.calls[0][2];
    const pending = callback({ event: 'created', filename: '/old/file' });
    manager.watch('/new', 1);
    resolve({ href: '/old/file' }); await pending;
    expect(targets.get(1).webContents.send).not.toHaveBeenCalled();
    manager.release_window(1);
    expect(libfs.stop_watch).toHaveBeenCalledWith('/new', 1);
    expect(manager.window_dirs.size).toBe(0);
});
