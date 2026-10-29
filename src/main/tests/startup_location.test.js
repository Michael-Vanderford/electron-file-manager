const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
const start = source.indexOf('        const saved_location = this.location;');
const end = source.indexOf("        this.filter = document.querySelector('.filter');", start);

test.each([
    [[], ['/last']],
    [[{ tab: { location: '/last' } }, { tab: { location: '/other' } }], ['/other', '/last']]
])('restores saved location after listeners initialize, with tabs %j', (tabs, expected) => {
    let startRestore;
    const manager = { location: '/last', get_files: jest.fn() };
    vm.runInNewContext(`(function() {${source.slice(start, end)}}).call(manager)`, {
        manager,
        tabManager: { get_tabs: () => tabs },
        queueMicrotask: callback => { startRestore = callback; },
        ipcRenderer: { send: jest.fn() }
    });
    expect(manager.get_files).not.toHaveBeenCalled();
    startRestore();
    expect(manager.get_files.mock.calls.map(([location]) => location)).toEqual(expected);
});
