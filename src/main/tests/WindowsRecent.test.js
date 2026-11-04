const { EventEmitter } = require('events');
jest.mock('child_process', () => ({ spawn: jest.fn() }));
const { spawn } = require('child_process');
const { WindowsRecent } = require('../lib/WindowsRecent');

let child, app, reader;
beforeEach(() => {
    jest.useFakeTimers();
    child = new EventEmitter(); child.send = jest.fn(); child.kill = jest.fn();
    spawn.mockReturnValue(child);
    app = new EventEmitter(); app.getPath = jest.fn(() => 'isolated-recent');
    reader = new WindowsRecent(app);
});
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

test('coalesces callers, waits for buffered replies through close, and permits refresh', async () => {
    const pending = reader.get();
    expect(reader.get()).toBe(pending);
    expect(child.send).toHaveBeenCalledWith({ directory: 'isolated-recent' });
    child.emit('exit', 0);
    child.emit('message', { files: [{ href: 'target' }] });
    child.emit('close', 0);
    await expect(pending).resolves.toEqual([{ href: 'target' }]);
    const next = reader.get(); child.emit('message', { files: [] }); child.emit('close', 0);
    await expect(next).resolves.toEqual([]);
    expect(spawn).toHaveBeenCalledTimes(2);
});

test('timeout rejects without spawning additional children until close', async () => {
    const pending = reader.get();
    const rejected = expect(pending).rejects.toThrow('timed out');
    jest.advanceTimersByTime(10000); await rejected;
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(reader.get()).toBe(pending);
    child.emit('close');
});

test('subprocess errors and missing results reject; shutdown kills the reader', async () => {
    const pending = reader.get(); child.emit('close');
    await expect(pending).rejects.toThrow('without a result');
    const failed = reader.get(); child.emit('error', new Error('spawn failed')); child.emit('close');
    await expect(failed).rejects.toThrow('spawn failed');
    const closing = reader.get(); app.emit('before-quit'); child.emit('close');
    await expect(closing).rejects.toThrow();
    await expect(reader.get()).rejects.toThrow('closing');
    expect(child.kill).toHaveBeenCalled();
});
