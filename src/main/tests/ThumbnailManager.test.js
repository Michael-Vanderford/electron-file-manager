const { EventEmitter } = require('events');
jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');
const { ThumbnailManager } = require('../lib/ThumbnailManager');
let child;
let manager;
beforeEach(() => {
    jest.useFakeTimers();
    child = new EventEmitter();
    child.send = jest.fn();
    child.kill = jest.fn();
    spawn.mockReturnValue(child);
    manager = new ThumbnailManager('/cache');
});
afterEach(() => { manager.close(); jest.useRealTimers(); jest.clearAllMocks(); });

test('deduplicates requests and serializes background decoding', async () => {
    const first = manager.get('/a.png');
    expect(manager.get('/a.png')).toBe(first);
    const second = manager.get('/b.png');
    expect(child.send).toHaveBeenCalledTimes(1);
    child.emit('message', { href: '/a.png', url: 'file:///cache/a.png' });
    await expect(first).resolves.toBe('file:///cache/a.png');
    expect(child.send).toHaveBeenLastCalledWith({ href: '/b.png', cache: '/cache', retain: ['file:///cache/a.png'] });
    child.emit('message', { href: '/b.png', url: 'file:///cache/b.png' });
    await expect(second).resolves.toBe('file:///cache/b.png');
});

test('corrupt-image reply does not block the next request', async () => {
    const broken = manager.get('/broken.png');
    const healthy = manager.get('/healthy.png');
    child.emit('message', { href: '/broken.png', url: null });
    await expect(broken).resolves.toBeNull();
    child.emit('message', { href: '/healthy.png', url: 'file:///cache/healthy.png' });
    await expect(healthy).resolves.toBe('file:///cache/healthy.png');
});

test('timeout resolves waiting callers and does not spawn replacements until exit', async () => {
    const first = manager.get('/offline.png');
    const second = manager.get('/waiting.png');
    jest.advanceTimersByTime(5000);
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBeNull();
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(spawn).toHaveBeenCalledTimes(1);
    child.emit('exit', null);
    child.emit('close', null);
});

test('rejects relative paths without starting a decoder', async () => {
    await expect(manager.get('../image.png')).resolves.toBeNull();
    expect(spawn).not.toHaveBeenCalled();
});

test('shutdown settles active and queued callers even if the child never exits', async () => {
    const first = manager.get('/one.png');
    const second = manager.get('/two.png');
    manager.close();
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBeNull();
    await expect(manager.get('/after.png')).resolves.toBeNull();
    expect(manager.pending.size).toBe(0);
});

test('decoder IPC errors settle callers and block reuse until the child exits', async () => {
    child.send.mockImplementation(() => { throw new Error('IPC channel closed'); });
    await expect(manager.get('/error.png')).resolves.toBeNull();
    await expect(manager.get('/after-error.png')).resolves.toBeNull();
    expect(spawn).toHaveBeenCalledTimes(1);
    child.emit('exit', 1);
    child.emit('close', 1);
});

test('spawn failure closes without an exit event and permits a later decoder', async () => {
    const first = manager.get('/first.png');
    child.emit('error', new Error('spawn unavailable'));
    await expect(first).resolves.toBeNull();
    child.emit('close', -2);
    child.send.mockImplementation(() => {});
    const next = manager.get('/retry.png');
    child.emit('message', { href: '/retry.png', url: 'file:///cache/retry.png' });
    await expect(next).resolves.toBe('file:///cache/retry.png');
    expect(spawn).toHaveBeenCalledTimes(2);
});
