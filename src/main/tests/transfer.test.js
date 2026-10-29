const fs = require('fs');
const path = require('path');
const vm = require('vm');
const preload = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const btoa = value => Buffer.from(value).toString('base64');

function insertion(virtual) {
    const tab = { querySelector: jest.fn(() => ({ classList: { add: jest.fn() } })) };
    const context = {
        tabManager: { get_active_tab_content: () => tab, set_tab_data_arr: jest.fn() }, btoa
    };
    const start = preload.indexOf('    add_items(copy_arr) {');
    const end = preload.indexOf('    update_item(f) {', start);
    const add = vm.runInNewContext(`({${preload.slice(start, end)}}).add_items`, context);
    const existing = { id: btoa('/dest/old'), href: '/dest/old' };
    const manager = {
        get_active_files: () => [existing], is_recent_tab_content: () => false,
        get_view: jest.fn(() => {
            if (virtual) manager.virtual_view = { active_tab_content: tab, selected_ids: new Set() };
        }), render_virtual_range: jest.fn()
    };
    add.call(manager, [{ href: '/dest/new' }]);
    expect(context.tabManager.set_tab_data_arr).toHaveBeenCalledWith([
        existing, { href: '/dest/new', id: btoa('/dest/new') }
    ]);
    expect(manager.get_view).toHaveBeenCalledWith(manager.files_arr);
    if (virtual) expect(manager.virtual_view.selected_ids.has(btoa('/dest/new'))).toBe(true);
}

test('pasted cards persist in tab data for normal and grouped rendering', () => insertion(false));
test('pasted cards rebuild and select items in virtual rendering', () => insertion(true));

test('move completion removes source identity and inserts destination identity', () => {
    const start = main.indexOf('                    const moved = data.files_arr || [];');
    const end = main.indexOf('                    if (data.cancelled)', start);
    const sent = [];
    vm.runInNewContext(main.slice(start, end), {
        data: { files_arr: [{ source: '/source/file', destination: '/dest/file', href: '/dest/file' }] },
        win: { send: (...args) => sent.push(args) },
        libfs: { get_file: href => ({ href }) }, path, btoa
    });
    expect(sent).toEqual([
        ['remove_items', [{ id: btoa('/source/file'), href: '/source/file' }]],
        ['add_items', [{ id: btoa('/dest/file'), href: '/dest/file' }], '/dest']
    ]);
});

test('Copy after Cut clears cut mode and the old selection', () => {
    const start = preload.indexOf('    copy() {');
    const end = preload.indexOf('    has_clipboard()', start);
    const copy = vm.runInNewContext(`({${preload.slice(start, end)}}).copy`, {
        document: { querySelectorAll: () => [] }, ipcRenderer: { send: jest.fn() }, fileManager: null
    });
    const state = { is_cut_operation: true, cut_arr: ['/old'], get_selected_files: () => ['/new'], set_msg: jest.fn() };
    copy.call(state);
    expect(state.is_cut_operation).toBe(false);
    expect(state.cut_arr).toEqual([]);
    expect(state.copy_arr).toEqual(['/new']);
});

test('repeated insertion replaces the existing record without duplicate cards', () => {
    const tab = { querySelector: () => null };
    let files = [{ href: '/dest/file', id: btoa('/dest/file'), size: 1 }];
    const start = preload.indexOf('    add_items(copy_arr) {');
    const end = preload.indexOf('    update_item(f) {', start);
    const add = vm.runInNewContext(`({${preload.slice(start, end)}}).add_items`, {
        tabManager: { get_active_tab_content: () => tab, set_tab_data_arr: next => { files = next; } }, btoa
    });
    const manager = {
        get_active_files: () => files, is_recent_tab_content: () => false, get_view: jest.fn()
    };

    add.call(manager, [{ href: '/dest/file', size: 2 }]);
    add.call(manager, [{ href: '/dest/file', size: 3 }]);

    expect(files).toEqual([{ href: '/dest/file', id: btoa('/dest/file'), size: 3 }]);
});

test.each([
    ['/destination', '/destination', true],
    ['/destination', '/other-tab', false]
])('destination %s with active tab %s inserts cards: %s', (destination, active, expected) => {
    let handler;
    const start = preload.indexOf("        ipcRenderer.on('add_items',");
    const end = preload.indexOf('        // get item', start);
    const manager = {
        add_items: jest.fn(), check_for_empty_folder: jest.fn()
    };
    const context = {
        ipcRenderer: { on: (channel, callback) => { handler = callback; } },
        dnd: require('../../common/dnd'),
        utilities: { get_location: () => active },
        tabManager: { get_active_tab_content: () => null }, manager
    };
    vm.runInNewContext(`(function() {${preload.slice(start, end)}}).call(manager)`, context);

    handler({}, [{ href: '/destination/file' }], destination);

    expect(manager.add_items).toHaveBeenCalledTimes(expected ? 1 : 0);
});
