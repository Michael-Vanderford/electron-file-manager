const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const start = source.indexOf('        // Debounce event bursts and retry');
const end = source.indexOf('\n    }', start);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('USB event bursts request both drive lists and retry after volume readiness', () => {
    let monitor;
    const manager = { device_worker: { postMessage: jest.fn() } };
    vm.runInNewContext(`(function() {${source.slice(start, end)}}).call(manager)`, {
        manager, libfs: { monitor: callback => { monitor = callback; } }, setTimeout, clearTimeout
    });
    monitor('added');
    jest.advanceTimersByTime(100);
    monitor('changed');
    jest.advanceTimersByTime(149);
    expect(manager.device_worker.postMessage).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(manager.device_worker.postMessage.mock.calls).toEqual([
        [{ cmd: 'get_mounts' }], [{ cmd: 'get_devices' }]
    ]);
    jest.advanceTimersByTime(850);
    expect(manager.device_worker.postMessage).toHaveBeenCalledTimes(4);
    monitor('mtp');
    jest.advanceTimersByTime(2000);
    expect(manager.device_worker.postMessage).toHaveBeenCalledTimes(4);
});
