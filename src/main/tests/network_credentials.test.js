const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
let manager, safeStorage;
beforeEach(() => {
    safeStorage = {
        isEncryptionAvailable: jest.fn(() => true), getSelectedStorageBackend: jest.fn(() => 'gnome_libsecret'),
        encryptString: jest.fn(value => Buffer.from(`encrypted:${value}`)),
        decryptString: jest.fn(value => value.toString().replace(/^encrypted:/, ''))
    };
    const start = source.indexOf('    normalize_server(');
    const end = source.indexOf('    writeNetworkSettings()', start);
    manager = vm.runInNewContext(`new (class { ${source.slice(start, end)} })()`, { safeStorage, Buffer, process });
});
test('encrypted round-trip and plaintext migration never serialize plaintext', () => {
    const input = { type: 'smb', server: 'host', username: 'test', password: 'fixture-secret', save_connection: true, auto_reconnect: true };
    const stored = manager.serializeNetworkSettings(input);
    expect(stored.password).toBeUndefined();
    expect(stored.encrypted_password).toBeTruthy();
    expect(manager.deserializeNetworkSettings(stored).password).toBe(input.password);
    expect(manager.deserializeNetworkSettings(input).encrypted_password).toBeTruthy();
});
test('decryption failure retains encrypted bytes and disables reconnect', () => {
    safeStorage.decryptString.mockImplementation(() => { throw new Error('locked'); });
    const stored = { encrypted_password: Buffer.from('encrypted:fixture').toString('base64'), auto_reconnect: true };
    const result = manager.serializeNetworkSettings(stored);
    expect(result.encrypted_password).toBe(stored.encrypted_password);
    expect(result.auto_reconnect).toBe(false);
    expect(result.password).toBeUndefined();
});
test('unavailable encryption and Linux basic_text cannot save new passwords', () => {
    safeStorage.isEncryptionAvailable.mockReturnValue(false);
    expect(() => manager.serializeNetworkSettings({ password: 'fixture' })).toThrow('unavailable');
    safeStorage.isEncryptionAvailable.mockReturnValue(true);
    safeStorage.getSelectedStorageBackend.mockReturnValue('basic_text');
    if (process.platform === 'linux') expect(manager.encryption_available()).toBe(false);
});

test('legacy migration uses private files and retains source data when encryption is unavailable', () => {
    const os = require('os');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-credentials-'));
    const file = path.join(directory, 'network.json');
    const { JsonStore } = require('../lib/JsonStore');
    const start = source.indexOf('    normalize_server(');
    const end = source.indexOf('    removeNetworkSettings(', start);
    const storage = vm.runInNewContext(`new (class { ${source.slice(start, end)} })()`, {
        safeStorage, Buffer, process, fs, path, JsonStore, app: { getPath: () => directory }, console
    });
    try {
        const legacy = [{ type: 'smb', server: 'fixture', username: 'user', password: 'fixture-secret', auto_reconnect: true, save_connection: true }];
        fs.writeFileSync(file, JSON.stringify(legacy));
        safeStorage.isEncryptionAvailable.mockReturnValue(false);
        expect(storage.getNetworkSettings()[0].auto_reconnect).toBe(false);
        expect(JSON.parse(fs.readFileSync(file))).toEqual(legacy);
        if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600);
        safeStorage.isEncryptionAvailable.mockReturnValue(true);
        expect(storage.getNetworkSettings()[0].password).toBe('fixture-secret');
        for (const location of [file, `${file}.bak`]) {
            expect(fs.readFileSync(location, 'utf8')).not.toContain('fixture-secret');
            if (process.platform !== 'win32') expect(fs.statSync(location).mode & 0o777).toBe(0o600);
        }
        fs.unlinkSync(`${file}.bak`);
        fs.writeFileSync(file, '{'); fs.chmodSync(file, 0o644);
        storage.getNetworkSettings();
        const retained = fs.readdirSync(directory).find(name => name.endsWith('.corrupt'));
        if (process.platform !== 'win32') expect(fs.statSync(path.join(directory, retained)).mode & 0o777).toBe(0o600);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('a successful connection reports a failed credential save without logging passwords', async () => {
    const start = source.indexOf('    normalize_server(');
    const end = source.indexOf('    writeNetworkSettings()', start);
    const connected = vm.runInNewContext(`new (class { ${source.slice(start, end)} })()`, {
        safeStorage, Buffer, process, setTimeout, clearTimeout, deviceManager: null,
        libfs: { connect_network_drive: (...args) => args.at(-1)(null) }
    });
    connected.setNetworkSettings = () => 'Secure password storage is unavailable.';
    const send = jest.fn();
    const result = await connected.connect({ sender: { send } }, {
        type: 'smb', server: 'fixture', username: 'user', password: 'fixture-secret', save_connection: true
    });
    expect(result.error).toBe(false);
    expect(result.msg).toContain('Connection was not saved');
    expect(result.msg).not.toContain('fixture-secret');
});
