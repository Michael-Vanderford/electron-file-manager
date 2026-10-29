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
    expect(child.send).toHaveBeenLastCalledWith({ href: '/b.png', cache: '/cache' });
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
});

test('rejects relative paths without starting a decoder', async () => {
    await expect(manager.get('../image.png')).resolves.toBeNull();
    expect(spawn).not.toHaveBeenCalled();
});
