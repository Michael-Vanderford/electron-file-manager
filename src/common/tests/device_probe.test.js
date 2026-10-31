const { EventEmitter } = require('events');
jest.mock('child_process', () => ({ fork: jest.fn() }));
const { fork } = require('child_process');
let probe;
let children;
let now;
beforeEach(() => {
    jest.useFakeTimers();
    now = 1000000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.resetModules();
    children = [];
    const childProcess = require('child_process');
    childProcess.fork.mockImplementation(() => {
        const child = new EventEmitter();
        child.send = jest.fn();
        child.kill = jest.fn();
        children.push(child);
        return child;
    });
    probe = require('../device_probe').probe;
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('coalesces requests and accepts a successful reply', async () => {
    const request = probe('stats', '/local');
    expect(probe('stats', '/local')).toBe(request);
    children[0].emit('message', { result: { total: 42 } });
    await expect(request).resolves.toEqual({ total: 42 });
    expect(children[0].kill).toHaveBeenCalledWith('SIGKILL');
    children[0].emit('exit', 0);
});

test('times out without waiting for exit, ignores late replies, and retries after cooldown', async () => {
    const request = probe('stats', '/offline');
    const rejected = expect(request).rejects.toThrow('timed out');
    jest.advanceTimersByTime(3000);
    await rejected;
    children[0].emit('message', { result: { total: 99 } });
    await expect(probe('stats', '/offline')).rejects.toThrow('retry shortly');
    expect(children).toHaveLength(1);
    children[0].emit('exit', null);
    now += 30000;
    jest.advanceTimersByTime(30000);
    const retry = probe('stats', '/offline');
    children[1].emit('message', { result: { total: 10 } });
    await expect(retry).resolves.toEqual({ total: 10 });
    children[1].emit('exit', 0);
});

test('stuck children remain counted against the concurrency limit until exit', async () => {
    const requests = Array.from({ length: 4 }, (_, i) => probe('stats', `/offline-${i}`).catch(error => error));
    jest.advanceTimersByTime(3000);
    await Promise.all(requests);
    await expect(probe('stats', '/healthy')).rejects.toThrow('retry shortly');
    expect(children).toHaveLength(4);
    children[0].emit('exit', null);
    const healthy = probe('stats', '/healthy');
    children[4].emit('message', { result: { total: 20 } });
    await expect(healthy).resolves.toEqual({ total: 20 });
    children[4].emit('exit', 0);
});

test('child errors reject the request promptly', async () => {
    const request = probe('mounts');
    children[0].emit('error', new Error('launch failed'));
    await expect(request).rejects.toThrow('launch failed');
    children[0].emit('exit', 1);
});

test('an early child exit rejects instead of waiting for the timeout', async () => {
    const request = probe('devices');
    children[0].emit('exit', 1);
    children[0].emit('close', 1);
    await expect(request).rejects.toThrow('exited before responding');
});

test('an error reply releases the request and reports the probe failure', async () => {
    const request = probe('stats', '/denied');
    children[0].emit('message', { error: 'permission denied' });
    await expect(request).rejects.toThrow('permission denied');
    children[0].emit('exit', 1);
});

test('a reply buffered at process exit is accepted before close', async () => {
    const request = probe('validate', '/local');
    children[0].emit('exit', 0);
    children[0].emit('message', { result: true });
    children[0].emit('close', 0);
    await expect(request).resolves.toBe(true);
});

test('interactive metadata has bounded reserved capacity when four disk probes are stuck', async () => {
    const requests = Array.from({ length: 4 }, (_, i) => probe('stats', `/disk-${i}`).catch(error => error));
    const interactive = Array.from({ length: 4 }, (_, i) => probe('validate', `/path-${i}`).catch(error => error));
    expect(children).toHaveLength(8);
    await expect(probe('validate', '/overflow')).rejects.toThrow('retry shortly');
    jest.advanceTimersByTime(3000);
    await Promise.all([...requests, ...interactive]);
});
