const fs = require('fs');
const path = require('path');
const vm = require('vm');
const preload = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const btoa = value => Buffer.from(value).toString('base64');

function insertion(virtual) {
    const tab = { querySelector: jest.fn(() => ({ classList: { add: jest.fn() } })) };
    const context = {
        tabManager: { get_active_tab_content: () => tab, set_tab_data_arr: jest.fn() }, btoa, path_id: btoa, path_id: btoa
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
    expect(manager.get_view).toHaveBeenCalledWith(manager.files_arr, true);
    if (virtual) expect(manager.virtual_view.selected_ids.has(btoa('/dest/new'))).toBe(true);
}

test('pasted cards persist in tab data for normal and grouped rendering', () => insertion(false));
test('pasted cards rebuild and select items in virtual rendering', () => insertion(true));

test('transfer completion routes source and destination identities to the initiating sender', () => {
    const start = main.indexOf('    queue_transfer(sender,');
    const end = main.indexOf('    normalize_folder_size_path', start);
    const handlers = {};
    const thread = { on: (event, callback) => { handlers[event] = callback; }, once: jest.fn(), postMessage: jest.fn(), terminate: jest.fn() };
    const sent = [];
    const sender = { isDestroyed: () => false, send: (...args) => sent.push(args), once: jest.fn() };
    const manager = {
        operation_queue: { enqueue: job => job.start({ finish: jest.fn() }) },
        invalidate_folder_size_for_item_path: jest.fn(), invalidate_folder_size_hierarchy: jest.fn()
    };
    const queue = vm.runInNewContext(`({${main.slice(start, end)}}).queue_transfer`, {
        structuredClone: value => value, worker: { Worker: function() { return thread; } },
        path, __dirname, replacement_journals: '/journals', path_id: btoa,
        fs: { existsSync: () => true }, libfs: { get_file: href => ({ href }) }
    });
    queue.call(manager, sender, 'move', [{ source: '/source/file', destination: '/dest/file' }], '/dest');
    handlers.message({ cmd: 'mv_done', files_arr: [{ source: '/source/file', destination: '/dest/file' }] });
    expect(sent).toContainEqual(['remove_items', [{ id: btoa('/source/file'), href: '/source/file' }]]);
    expect(sent).toContainEqual(['add_items', [{ href: '/dest/file' }], '/dest']);
    expect(thread.terminate).toHaveBeenCalledTimes(1);
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
        tabManager: { get_active_tab_content: () => tab, set_tab_data_arr: next => { files = next; } }, btoa, path_id: btoa
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
        add_items: jest.fn(), merge_inactive_items: jest.fn(), check_for_empty_folder: jest.fn()
    };
    const context = {
        ipcRenderer: { on: (channel, callback) => { handler = callback; } },
        dnd: require('../../common/dnd'),
        utilities: { get_location: () => active }, document: { querySelector: () => ({ dataset: { href: active } }) },
        tabManager: { get_active_tab_content: () => null }, manager
    };
    vm.runInNewContext(`(function() {${preload.slice(start, end)}}).call(manager)`, context);

    handler({}, [{ href: '/destination/file' }], destination);

    expect(manager.add_items).toHaveBeenCalledTimes(expected ? 1 : 0);
});

test('worker failure releases only its job and late exit cannot finish the next transfer', () => {
    const { EventEmitter } = require('events');
    const { OperationQueue } = require('../lib/OperationQueue');
    const threads = [];
    function Worker() {
        const thread = new EventEmitter();
        thread.postMessage = jest.fn(); thread.terminate = jest.fn();
        threads.push(thread); return thread;
    }
    const sender = new EventEmitter(); sender.isDestroyed = () => false; sender.send = jest.fn();
    const manager = { operation_queue: new OperationQueue(), invalidate_folder_size_for_item_path: jest.fn(), invalidate_folder_size_hierarchy: jest.fn() };
    const start = main.indexOf('    queue_transfer(sender,');
    const end = main.indexOf('    normalize_folder_size_path', start);
    const queue = vm.runInNewContext(`({${main.slice(start, end)}}).queue_transfer`, {
        structuredClone: value => value, worker: { Worker }, path, __dirname,
        replacement_journals: '/journals', path_id: btoa, fs: { existsSync: () => true }, libfs: { get_file: href => ({ href }) }
    });
    queue.call(manager, sender, 'copy', [{ source: '/first', destination: '/dest/first' }], '/dest');
    queue.call(manager, sender, 'copy', [{ source: '/second', destination: '/dest/second' }], '/dest');
    expect(threads).toHaveLength(1);
    threads[0].emit('error', new Error('worker crashed'));
    expect(threads).toHaveLength(2);
    const next = manager.operation_queue.active;
    threads[0].emit('exit', 1);
    expect(manager.operation_queue.active).toBe(next);
    threads[1].emit('message', { cmd: 'cp_done', completed: [], failures: [] });
    expect(manager.operation_queue.active).toBe(null);
    expect(sender.send).toHaveBeenCalledWith('set_msg', 'copy incomplete: worker crashed');
});
