const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { secureIpc, schemas } = require('../lib/SecureIpc');
const root = path.resolve(__dirname, '../../renderer');
function setup(page = 'index.html') {
    const calls = {};
    const ipc = secureIpc({ on: (name, fn) => { calls[name] = fn; }, handle: (name, fn) => { calls[name] = fn; } }, root);
    const url = pathToFileURL(path.join(root, page)).href;
    const event = { senderFrame: { url, parent: null }, sender: { getURL: () => url, isDestroyed: () => false, send: jest.fn() } };
    return { ipc, calls, event };
}

test('every live main IPC registration has an explicit schema', () => {
    const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    const channels = [...source.matchAll(/^\s*ipcMain\.(?:on|handle)\('([^']+)'/gm)].map(match => match[1]);
    expect(channels.filter(channel => !schemas[channel])).toEqual([]);
});

test.each(['https://example.test/', 'file:///tmp/untrusted.html', 'about:blank'])('rejects IPC from %s without invoking privileged handlers', url => {
    const { ipc, calls, event } = setup(); const handler = jest.fn();
    ipc.on('delete', handler); event.senderFrame.url = url;
    calls.delete(event, [{ href: '/tmp/file', is_dir: false }]);
    expect(handler).not.toHaveBeenCalled(); expect(event.returnValue).toBeNull();
});

test('same-page subframes cannot issue privileged IPC', () => {
    const { ipc, calls, event } = setup(); const handler = jest.fn();
    ipc.on('delete', handler); event.senderFrame.parent = {};
    calls.delete(event, [{ href: '/tmp/file' }]); expect(handler).not.toHaveBeenCalled();
});

test('connect dialog is limited to its own channels', () => {
    const { ipc, calls, event } = setup('dialogs/connect.html'); const handler = jest.fn();
    ipc.on('delete', handler); calls.delete(event, [{ href: '/tmp/file' }]);
    expect(handler).not.toHaveBeenCalled();
    ipc.handle('connect', handler);
    calls.connect(event, { type: 'smb', server: 'server', mount_point: '', username: 'name', password: 'secret' });
    expect(handler).toHaveBeenCalledTimes(1);
});

test.each([
    ['delete', [[{ href: '/tmp/file', name: '../other' }]]],
    ['delete', [[{ href: '/tmp/evil\0file' }]]],
    ['rename', ['/tmp/source', { path: '/tmp/target' }, 'id']],
    ['overwrite_one', [{ href: '/tmp/file', source: '/tmp/file', destination: '../target' }, 'copy']],
    ['open_external', ['file:///etc/passwd']],
    ['open_external', ['javascript:alert(1)']],
    ['path_operation', ['__proto__', []]],
    ['compress', [[], '/tmp', 'unknown', 0]]
])('rejects malformed %s arguments', (channel, args) => {
    const { ipc, calls, event } = setup(); const handler = jest.fn();
    ipc.on(channel, handler); calls[channel](event, ...args); expect(handler).not.toHaveBeenCalled();
});

test('valid literal paths are accepted and invocations deny unknown frames', async () => {
    const { ipc, calls, event } = setup(); const handler = jest.fn();
    ipc.on('delete', handler); const files = [{ href: '/tmp/a ` $() \' file', name: 'a ` $() \' file', is_dir: false }];
    calls.delete(event, files); expect(handler).toHaveBeenCalledWith(event, files);
    ipc.handle('get_workspace', handler); event.senderFrame = null;
    expect(() => calls.get_workspace(event)).toThrow('denied');
});

test('handler filesystem failures reply instead of crashing the main process', () => {
    const { ipc, calls, event } = setup(); ipc.on('mkdir', () => { throw new Error('permission denied'); });
    calls.mkdir(event, '/tmp/directory');
    expect(event.sender.send).toHaveBeenCalledWith('set_msg', 'Error: permission denied');
});


test.each(['overwrite_one', 'overwrite_all'])('accepts %s archive jobs without requiring transfer-only href metadata', channel => {
    const { ipc, calls, event } = setup(); const handler = jest.fn(); ipc.on(channel, handler);
    const job = { files_arr: [{ href: '/tmp/input.txt', is_dir: false }], source: '/tmp/input.txt',
        destination: '/tmp/input.zip', location: '/tmp', type: 'zip', size: 100 };
    const data = channel === 'overwrite_all' ? [job] : job;
    calls[channel](event, data, 'compress'); expect(handler).toHaveBeenCalledWith(event, data, 'compress');
    handler.mockClear(); job.files_arr = null;
    calls[channel](event, data, 'compress'); expect(handler).not.toHaveBeenCalled();
});


test.each(['nfs', 'dav', 'davs', 'sftp', 'ftp'])('accepts %s connections and resources while checking port types', type => {
    const { ipc, calls, event } = setup(); const handler = jest.fn();
    ipc.handle('connect', handler);
    const settings = { type, server: 'fixture/path', port: 8443, remote_path: '', username: '', password: '' };
    calls.connect(event, settings); expect(handler).toHaveBeenCalledWith(event, settings);
    expect(() => calls.connect(event, { ...settings, port: '8443' })).toThrow('denied');
    expect(() => calls.connect(event, { ...settings, type: 'unsupported' })).toThrow('denied');
    ipc.on('get_disk_space', handler); calls.get_disk_space(event, `${type}://fixture/path`);
    expect(handler).toHaveBeenCalledWith(event, `${type}://fixture/path`);
});
