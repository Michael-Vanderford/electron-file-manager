const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { JsonStore } = require('../lib/JsonStore');
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const managerSource = source.slice(source.indexOf('class NetworkManager {'), source.indexOf('// file manager listeners'));
let directory, manager, libfs, app, handlers, safeStorage;
beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-network-'));
    app = new EventEmitter(); app.getPath = () => directory;
    handlers = new Map();
    libfs = { connect_network_drive: jest.fn() };
    safeStorage = { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'gnome_libsecret',
        encryptString: value => Buffer.from(`encrypted:${value}`), decryptString: value => value.toString().replace(/^encrypted:/, '') };
    manager = vm.runInNewContext(`${managerSource}; new NetworkManager()`, {
        app, ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, libfs, URL, Symbol, Map,
        Buffer, process, fs, path, JsonStore, safeStorage, console, deviceManager: null, setTimeout: (...args) => setTimeout(...args), clearTimeout: (...args) => clearTimeout(...args)
    });
});
afterEach(() => { manager.cancelAllConnections(); jest.useRealTimers(); fs.rmSync(directory, { recursive: true, force: true }); });
const settings = { type: 'smb', server: 'server/share', username: 'user', password: 'fixture:@/#%' };

test.each([
    ['nfs', 'nfs://server/export/path', 2049, 'server:2049/export/path'],
    ['nfs', 'nfs://server/', 2049, 'server:2049/'],
    ['davs', 'davs://cloud:8443/path', 8443, 'cloud:8443/path'],
    ['ftp', 'ftp://server:2121/files', 2121, 'server:2121/files'],
    ['dav', 'server/public', 8080, 'server:8080/public'],
    ['ssh', 'sftp://server/home/user', 2222, 'server:2222/home/user'],
    ['sftp', '[::1]/home/user', 22, '[::1]:22/home/user']
])('%s preserves protocol, remote path and port', async (type, server, port, target) => {
    libfs.connect_network_drive.mockImplementation((...args) => args.at(-1)(null));
    expect((await manager.connect(null, { type, server, port, use_ssh_key: ['ssh', 'sftp'].includes(type) })).error).toBe(false);
    expect(libfs.connect_network_drive.mock.calls[0].slice(0, 6)).toEqual([target, port, '', '', ['ssh', 'sftp'].includes(type) ? 1 : 0, type]);
});

test('NFS does not forward credentials, even if supplied', async () => {
    libfs.connect_network_drive.mockImplementation((...args) => args.at(-1)(null));
    await manager.connect(null, { ...settings, type: 'nfs' });
    expect(libfs.connect_network_drive.mock.calls[0].slice(2, 5)).toEqual(['', '', 0]);
});

test.each([
    { type: 'unsupported', server: 'server/path' }, { type: 'smb', server: 'server' },
    { type: 'nfs', server: 'server' }, { type: 'dav', server: 'davs://server/path' },
    { type: 'davs', server: 'user:secret@server/path' }, { type: 'nfs', server: 'server/path', port: 1.5 },
    { type: 'nfs', server: 'server/path', port: 65536 }, { type: 'dav', server: 'server:1.5/path' }
])('invalid connection never reaches the native boundary: %j', async input => {
    expect((await manager.connect(null, input)).error).toBe(true);
    expect(libfs.connect_network_drive).not.toHaveBeenCalled();
});

test('timeout cancels the native request and late completion cannot save', async () => {
    jest.useFakeTimers(); const cancel = jest.fn(); let callback;
    libfs.connect_network_drive.mockImplementation((...args) => { callback = args.at(-1); return { cancel }; });
    const result = manager.connect(null, { ...settings, save_connection: true });
    jest.advanceTimersByTime(20000);
    expect((await result).msg).toContain('timed out'); expect(cancel).toHaveBeenCalledTimes(1);
    callback(null); expect(fs.existsSync(path.join(directory, 'network.json'))).toBe(false);
});

test.each(['destroyed', 'did-start-navigation', 'render-process-gone'])('%s cancels and releases sender listeners', async event => {
    const cancel = jest.fn(); let callback;
    libfs.connect_network_drive.mockImplementation((...args) => { callback = args.at(-1); return { cancel }; });
    const sender = new EventEmitter();
    const result = manager.connect({ sender }, { ...settings, save_connection: true });
    sender.emit(event);
    expect((await result).msg).toBe('Connection cancelled.'); expect(cancel).toHaveBeenCalledTimes(1);
    callback(null); expect(fs.existsSync(path.join(directory, 'network.json'))).toBe(false);
    expect(sender.listenerCount('did-start-navigation')).toBe(0);
});

test('cancel IPC is scoped to its sender; duplicate submit does not start another native mount', async () => {
    let callback; const cancel = jest.fn();
    libfs.connect_network_drive.mockImplementation((...args) => { callback = args.at(-1); return { cancel }; });
    const sender = new EventEmitter(); const other = new EventEmitter();
    const request = manager.connect({ sender }, settings);
    expect((await manager.connect({ sender }, settings)).error).toBe(true);
    handlers.get('cancel_connect')({ sender: other }); expect(cancel).not.toHaveBeenCalled();
    handlers.get('cancel_connect')({ sender }); expect((await request).error).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1); expect(libfs.connect_network_drive).toHaveBeenCalledTimes(1);
    callback(null); callback(new Error('late'));
    libfs.connect_network_drive.mockImplementation((...args) => args.at(-1)(null));
    expect((await manager.connect({ sender }, settings)).error).toBe(false);
});

test('shutdown cancels all requests and prevents new reconnect attempts', async () => {
    const cancel = jest.fn(); libfs.connect_network_drive.mockReturnValue({ cancel });
    const first = manager.connect(null, settings); const second = manager.connect(null, settings);
    app.emit('before-quit');
    expect((await first).error).toBe(true); expect((await second).error).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect((await manager.connect(null, settings)).error).toBe(true);
});

test('WebDAV encryption and distinct ports/paths survive save/reload beside SFTP and NFS', async () => {
    const entries = [
        { type: 'ssh', server: 'ssh://server/home', use_ssh_key: true, mount_point: '/legacy/local', auto_reconnect: true },
        { type: 'nfs', server: 'server/export', auto_reconnect: true },
        { type: 'davs', server: 'server/files', port: 8443, password: 'fixture-secret', username: 'user', auto_reconnect: true },
        { type: 'davs', server: 'server/files', port: 9443, username: 'user' },
        { type: 'davs', server: 'server/other', port: 8443, username: 'user' }
    ];
    for (const entry of entries) expect(manager.setNetworkSettings({ ...entry, save_connection: true })).toBeNull();
    const restored = manager.getNetworkSettings(); expect(restored).toHaveLength(5);
    expect(restored[0].mount_point).toBe('/legacy/local'); expect(restored[2].password).toBe('fixture-secret');
    const disk = fs.readFileSync(path.join(directory, 'network.json'), 'utf8'); expect(disk).not.toContain('fixture-secret');
    libfs.connect_network_drive.mockImplementation((...args) => args.at(-1)(null));
    expect(await manager.reconnectSavedConnections()).toHaveLength(3);
    expect(libfs.connect_network_drive.mock.calls.map(args => args[5])).toEqual(['ssh', 'nfs', 'davs']);
});


test('an NFS root export survives save and reconnect', () => {
    manager.setNetworkSettings({ type: 'nfs', server: 'nfs://server/', save_connection: true });
    const entry = manager.getNetworkSettings()[0];
    expect(manager.connectionTarget(entry).server).toBe('server/');
});

test('FTP credentials, custom port and remote path survive save and reconnect', async () => {
    expect(manager.setNetworkSettings({ type: 'ftp', server: 'ftp://server:2121/files',
        username: 'ftp-user', password: 'fixture-secret', save_connection: true, auto_reconnect: true })).toBeNull();
    expect(fs.readFileSync(path.join(directory, 'network.json'), 'utf8')).not.toContain('fixture-secret');
    libfs.connect_network_drive.mockImplementation((...args) => args.at(-1)(null));
    expect(await manager.reconnectSavedConnections()).toHaveLength(1);
    expect(libfs.connect_network_drive.mock.calls[0].slice(0, 6))
        .toEqual(['server:2121/files', 2121, 'ftp-user', 'fixture-secret', 0, 'ftp']);
});

test('startup reconnect bounds concurrency and keeps failure results with their identities', async () => {
    manager.getNetworkSettings = () => Array.from({ length: 5 }, (_, i) => ({ type: 'nfs', server: `server/export${i}`, auto_reconnect: true }));
    const callbacks = [];
    libfs.connect_network_drive.mockImplementation((...args) => { callbacks.push(args.at(-1)); return { cancel() {} }; });
    const request = manager.reconnectSavedConnections();
    expect(callbacks).toHaveLength(3); expect(await manager.reconnectSavedConnections()).toHaveLength(0);
    callbacks[0](new Error('fixture unavailable')); await Promise.resolve();
    expect(callbacks).toHaveLength(4);
    callbacks[1](null); await Promise.resolve(); expect(callbacks).toHaveLength(5);
    callbacks[2](null); callbacks[3](null); callbacks[4](null);
    const results = await request; expect(results).toHaveLength(5);
    expect(results[0].result.error).toBe(true); expect(results[4].result.error).toBe(false);
    expect(results.map(item => item.identity)).toEqual(manager.getNetworkSettings().map(item => manager.networkIdentity(item)));
});


test('combined addresses override legacy fields, and legacy split addresses still connect', () => {
    expect(manager.connectionTarget({ type: 'davs', server: 'cloud:8443/files', port: 9443, remote_path: '/old' }))
        .toEqual({ type: 'davs', server: 'cloud:8443/files', port: 8443 });
    expect(manager.connectionTarget({ type: 'nfs', server: 'server', port: 2049, remote_path: '/export/shared folder' }))
        .toEqual({ type: 'nfs', server: 'server:2049/export/shared%20folder', port: 2049 });
    expect(manager.connectionTarget({ type: 'sftp', server: '[::1]:2222/home/user' }))
        .toEqual({ type: 'sftp', server: '[::1]:2222/home/user', port: 2222 });
});

test('saved server includes port and path while retaining the existing JSON fields', () => {
    const original = { type: 'davs', server: 'cloud', port: 8443, remote_path: '/files',
        mount_point: '/legacy/local', username: 'user', save_connection: true, auto_reconnect: true };
    expect(manager.setNetworkSettings(original)).toBeNull();
    const saved = JSON.parse(fs.readFileSync(path.join(directory, 'network.json'), 'utf8'))[0];
    expect(saved).toMatchObject({ ...original, server: 'cloud:8443/files' });
    expect(manager.networkIdentity(original)).toBe(manager.networkIdentity(saved));
});
