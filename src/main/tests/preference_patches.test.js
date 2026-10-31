const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
test('resizing one column sends only that field, preserving widths edited by another window', () => {
    const start = source.indexOf('    stop_col_resize(e) {');
    const end = source.indexOf('\n    //', start);
    const send = jest.fn();
    const stop = vm.runInNewContext(`({${source.slice(start, end)}}).stop_col_resize`, {
        ipcRenderer: { send }, document: { body: { style: {} }, removeEventListener: jest.fn() },
        setTimeout: jest.fn(), dragSelect: { set_is_dragging: jest.fn() }
    });
    stop.call({ list_view_settings: { col_width: { name: 200, size: 120 } },
        currentColumn: { dataset: { col_name: 'name' }, offsetWidth: 300, querySelector: () => ({ style: {} }) }
    });
    expect(send).toHaveBeenCalledWith('update_list_view_settings', { col_width: { name: 300 } });
});
