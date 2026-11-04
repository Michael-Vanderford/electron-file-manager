const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');

test.each(['paste', 'move'])('%s does not queue work or reply after the sender closes during metadata preparation', async method => {
    const start = source.indexOf(`    async ${method}(`);
    const end = source.indexOf(method === 'paste' ? '    // move' : '    // make directory', start);
    let resolve;
    let started;
    const preparationStarted = new Promise(done => { started = done; });
    const probe = jest.fn(() => {
        const result = new Promise(done => { resolve = done; });
        started();
        return result;
    });
    const run = vm.runInNewContext(`({${source.slice(start, end)}}).${method}`, { device_probe: probe });
    const sender = { isDestroyed: jest.fn(() => false), send: jest.fn() };
    const manager = { can_write_to_directory: async () => true, queue_transfer: jest.fn() };
    const pending = run.call(manager, { sender }, [{ href: '/source/file' }], '/destination');
    await preparationStarted;
    expect(probe).toHaveBeenCalledWith('prepare_transfer', expect.objectContaining({ location: '/destination' }));
    sender.send.mockClear();
    sender.isDestroyed.mockReturnValue(true);
    resolve({ ready: [{ destination: '/destination/file' }], overwrite: [], messages: [] });
    await pending;
    expect(sender.send).not.toHaveBeenCalled();
    expect(manager.queue_transfer).not.toHaveBeenCalled();
});
