// @ts-nocheck

// Provide app and Electron version to renderer
const { app, Tray, BrowserWindow, ipcMain, shell, screen, dialog, Menu, MenuItem, nativeImage, nativeTheme, webContents } = require('electron');
const packageJson = require('../../package.json');
const window = require('electron').BrowserWindow;
const worker = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const exec = require('child_process').exec;
const os = require('os');
// const gio = require('../gio/build/Release/gio.node');
const gio = require('libgio-node');
const iconManager = require('./lib/IconManager');
const { XMLParser } = require('fast-xml-parser');

const file_icon_cache = new Map();
const MAX_FILE_ICON_CACHE_ENTRIES = 2000;
const MAX_FOLDER_SIZE_CACHE_ENTRIES = 2000;
const FOLDER_SIZE_CACHE_TTL_MS = 5 * 60 * 1000;

class DirectorySizeCache {
    constructor(max_entries = MAX_FOLDER_SIZE_CACHE_ENTRIES, ttl_ms = FOLDER_SIZE_CACHE_TTL_MS) {
        this.max_entries = max_entries;
        this.ttl_ms = ttl_ms;
        this.cache = new Map();
    }

    normalize_path(raw_path) {
        if (!raw_path || typeof raw_path !== 'string') {
            return '';
        }

        const target_path = raw_path.trim();
        if (!target_path) {
            return '';
        }

        if (target_path.includes('://')) {
            return target_path;
        }

        return path.normalize(target_path);
    }

    get(raw_path) {
        const key = this.normalize_path(raw_path);
        if (!key) {
            return null;
        }

        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }

        if ((Date.now() - entry.updated_at) > this.ttl_ms) {
            this.cache.delete(key);
            return null;
        }

        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.size;
    }

    set(raw_path, size) {
        const key = this.normalize_path(raw_path);
        const numeric_size = Number(size);
        if (!key || !Number.isFinite(numeric_size) || numeric_size < 0) {
            return;
        }

        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        if (this.cache.size >= this.max_entries) {
            const oldest_key = this.cache.keys().next().value;
            if (oldest_key) {
                this.cache.delete(oldest_key);
            }
        }

        this.cache.set(key, {
            size: Math.floor(numeric_size),
            updated_at: Date.now()
        });
    }

    invalidate_hierarchy(raw_path) {
        const invalidated = [];
        let current = this.normalize_path(raw_path);

        while (current) {
            if (this.cache.delete(current)) {
                invalidated.push(current);
            }

            const parent = path.dirname(current);
            if (!parent || parent === current) {
                break;
            }

            current = parent;
        }

        return invalidated;
    }
}

nativeTheme.themeSource = 'system';

// flags
let is_first_run = 0;

function get_cached_file_icon(href) {
    return file_icon_cache.get(href);
}

function set_cached_file_icon(href, icon_data_url) {
    if (!href || typeof href !== 'string' || !icon_data_url || typeof icon_data_url !== 'string') {
        return;
    }

    if (file_icon_cache.has(href)) {
        file_icon_cache.set(href, icon_data_url);
        return;
    }

    if (file_icon_cache.size >= MAX_FILE_ICON_CACHE_ENTRIES) {
        const oldest_key = file_icon_cache.keys().next().value;
        if (oldest_key) {
            file_icon_cache.delete(oldest_key);
        }
    }

    file_icon_cache.set(href, icon_data_url);
}

app.disableHardwareAcceleration();

// // Configure electron-reload
// electronReload(__dirname, {
//     electron: electronPath,
//     forceHardReset: true,
//     hardResetMethod: 'exit'
// });

function normalize_find_results(raw_results = []) {
    if (!Array.isArray(raw_results)) {
        return [];
    }

    return raw_results
        .map((item) => {
            if (!item) {
                return null;
            }

            if (typeof item === 'string') {
                try {
                    const file = gio.get_file(item);
                    if (file && file.href) {
                        return file;
                    }
                } catch (err) {
                }
                return {
                    href: item,
                    name: path.basename(item),
                    display_name: path.basename(item),
                    location: path.dirname(item),
                    is_dir: false,
                    content_type: ''
                };
            }

            if (typeof item === 'object') {
                return item;
            }

            return null;
        })
        .filter(Boolean);
}

function normalize_find_options(raw_options = {}) {
    if (!raw_options || typeof raw_options !== 'object' || Array.isArray(raw_options)) {
        return {};
    }

    const options = {};

    if (raw_options.minSize !== undefined) {
        const min_size = Number(raw_options.minSize);
        if (Number.isFinite(min_size) && min_size >= 0) {
            options.minSize = Math.floor(min_size);
        }
    }

    if (raw_options.maxSize !== undefined) {
        const max_size = Number(raw_options.maxSize);
        if (Number.isFinite(max_size) && max_size >= 0) {
            options.maxSize = Math.floor(max_size);
        }
    }

    if (raw_options.dateFrom !== undefined) {
        const date_from = new Date(raw_options.dateFrom);
        if (!Number.isNaN(date_from.getTime())) {
            options.dateFrom = raw_options.dateFrom;
        }
    }

    if (raw_options.dateTo !== undefined) {
        const date_to = new Date(raw_options.dateTo);
        if (!Number.isNaN(date_to.getTime())) {
            options.dateTo = raw_options.dateTo;
        }
    }

    return options;
}


/**
 * Class to watch for changes in the file system
 */
class Watcher {
    constructor() {
        // this.monitors = new Map();
        this.unsupported_watch_paths = new Set();
    }

    is_unsupported_watch_path(dir) {
        if (!dir || typeof dir !== 'string') {
            return false;
        }

        // GVFS SMB mounts commonly do not support file monitor APIs.
        return dir.includes('/gvfs/smb-share:');
    }

    is_unsupported_watch_error(err) {
        if (!err) {
            return false;
        }

        const msg = String(err.message || err).toLowerCase();
        return msg.includes('operation not supported') || msg.includes('not supported');
    }

    /**
     * Start watching a path for file system changes.
     * @param {string} dir - The path to watch.
     * @param {function} [callback] - Optional callback to handle events.
     */
    watch(dir, callback) {

        // console.log(this.monitors)
        // console.log(utilities.run_watcher);
        // console.log('location', fileManager.location)

        // if (this.monitors.has(path)) {
        //     // Already watching this path
        //     return;
        // }

        if (this.is_unsupported_watch_path(dir)) {
            if (!this.unsupported_watch_paths.has(dir)) {
                this.unsupported_watch_paths.add(dir);
                console.warn(`Watcher disabled for unsupported path: ${dir}`);
            }
            return;
        }

        try {

            gio.watch(dir, (event) => {

                // Forward events to callback if provided
                if (typeof callback === 'function') {
                    callback(event);
                }

                if (!utilities.run_watcher) {
                    return;
                }

                let location = settingsManager.get_settings().location;

                // Example: emit events to renderer or handle internally
                switch (event.event) {

                    case 'created':

                        if (event && event.filename && utilities && typeof utilities.invalidate_folder_size_for_item_path === 'function') {
                            utilities.invalidate_folder_size_for_item_path(event.filename);
                        }

                        // console.log('created', event, location, path.dirname(event.filename));
                        if (location !== path.dirname(event.filename)) {
                            return;
                        }

                        let file = gio.get_file(event.filename);
                        if (file.href === undefined || file.href === null) {
                            win.send('set_msg', 'Error: File not found.');
                            return;
                        }

                        file.id = btoa(file.href);
                        win && win.send && win.send('get_item', file);
                        break;

                    case 'deleted':

                        if (event && event.filename && utilities && typeof utilities.invalidate_folder_size_for_item_path === 'function') {
                            utilities.invalidate_folder_size_for_item_path(event.filename);
                        }

                        // console.log('delete', event, location, path.dirname(event.filename));
                        if (location !== path.dirname(event.filename)) {
                            return;
                        }

                        win && win.send && win.send('remove_item', btoa(event.filename));
                        break;

                    //             case 'modified':

                    //                 console.log('modified', event);
                    //                 file = gio.get_file(event.filename);
                    //                 file.id = btoa(file.href);
                    //                 win && win.send && win.send('update_item', file);
                    //                 break;

                    //             default:
                    //                 break;
                }
            });

            // this.monitors.set(path, path);

        } catch (err) {
            if (this.is_unsupported_watch_error(err)) {
                if (!this.unsupported_watch_paths.has(dir)) {
                    this.unsupported_watch_paths.add(dir);
                    console.warn(`Watcher not supported for path: ${dir}`);
                }
                return;
            }

            console.error(`Watcher error for path ${dir}:`, err);
        }
    }

    /**
     * Stop watching a path.
     * @param {string} path - The path to stop watching.
     */
    unwatch(path) {

        // console.log('unwatch', path);
        try {
            gio.stop_watch(path);
        } catch (err) {
            // console.error(`Error closing watcher for ${path}:`, err);
            // win.send('set_msg', `Error closing watcher for ${path}: ${err}`);
        }


    }

    /**
     * Stop all watchers.
     */
    unwatchAll() {
        // for (const [path, monitor] of this.monitors.entries()) {
        //     if (monitor && typeof monitor.close === 'function') {
        //         try {
        //             monitor.close();
        //         } catch (err) {
        //             console.error(`Error closing watcher for ${path}:`, err);
        //         }
        //     }
        // }
        // this.monitors.clear();
    }
}

class SettingsManager {

    constructor() {

        // init settings
        this.settings_has_changed = 0;
        this.settings_file = path.join(app.getPath('userData'), 'settings.json');
        this.setting = {};

        // handle send sync call from renderer
        ipcMain.on('get_settings', (e) => {
            e.returnValue = this.get_settings();
        })

        ipcMain.on('update_settings', (e, settings) => {
            this.updateSettings(settings);
        });

        ipcMain.handle('update_settings', (e, settings) => {
            this.updateSettings(settings);
        });

        // init list view settings
        this.list_view_file = path.join(app.getPath('userData'), 'list_view.json');
        this.list_view_settings = {};

        // return list view settings
        ipcMain.on('get_list_view_settings', (e) => {
            e.returnValue = this.getListViewSetting();
        });

        // update list view settings
        ipcMain.on('update_list_view_settings', (e, list_view_settings) => {
            this.updateListViewSettingSettings(list_view_settings);
        });

    }

    // Initialize settings with robust defaults (from preload.js logic)
    initialize_settings() {

        const os = require('os');
        const home_dir = os.homedir();
        // Default schema (mirroring preload.js)
        const default_schema = {
            properties: {
                'Default View': {
                    type: 'object',
                    properties: {
                        View: { type: 'string', enum: ['list_view', 'grid_view'], default: 'grid_view' },
                        "Sort By": { type: 'string', enum: ['name', 'location', 'size', 'mtime', 'ctime', 'atime', 'type', 'count'], default: 'mtime' },
                        "Sort Direction": { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
                        'Show Hidden': { type: 'boolean', default: true }
                    }
                },
                'Icons': {
                    type: 'object',
                    properties: {
                        'Grid Icon Size': { type: 'string', enum: ['16', '24', '32', '48', '64', '128'], default: '48' },
                        'List Icon Size': { type: 'string', enum: ['16', '24', '32', '48', '64', '128'], default: '32' },
                        'Ctrl+Wheel Resize Icons': { type: 'boolean', default: true }
                    }
                },
                'List View Columns': {
                    type: 'object',
                    properties: {
                        name: { type: 'boolean', default: true, description: 'Name' },
                        location: { type: 'boolean', default: false, description: 'Location' },
                        size: { type: 'boolean', default: true, description: 'Size' },
                        mtime: { type: 'boolean', default: true, description: 'Modified Time' },
                        ctime: { type: 'boolean', default: false, description: 'Created Time' },
                        atime: { type: 'boolean', default: false, description: 'Accessed Time' },
                        type: { type: 'boolean', default: false, description: 'Type' },
                        count: { type: 'boolean', default: false, description: 'Count' }
                    }
                },
                'Grid View Columns': {
                    type: 'object',
                    properties: {
                        name: { type: 'boolean', default: true, description: 'Name' },
                        location: { type: 'boolean', default: false, description: 'Location' },
                        size: { type: 'boolean', default: true, description: 'Size' },
                        mtime: { type: 'boolean', default: true, description: 'Modified Time' },
                        ctime: { type: 'boolean', default: false, description: 'Created Time' },
                        atime: { type: 'boolean', default: false, description: 'Accessed Time' },
                        type: { type: 'boolean', default: false, description: 'Type' },
                        count: { type: 'boolean', default: false, description: 'Count' }
                    }
                }
            }
        };

        // Main settings defaults
        const defaults = {
            view: 'grid_view',
            schema: default_schema,
            icon_size: 48,
            list_icon_size: 32,
            columns: {
                name: true,
                location: false,
                size: true,
                mtime: true,
                ctime: false,
                atime: false,
                type: false,
                count: false
            },
            sort_by: 'mtime',
            sort_direction: 'desc',
            location: home_dir,
            disk_utility: 'gnome-disks',
            show_hidden: true,
            tabs: [
                {
                    tab: {
                        id: 1,
                        location: home_dir
                    }
                }
            ]
        };

        // List view settings defaults
        const list_view_settings = {
            col_width: {
                name: 200,
                location: 100,
                size: 120,
                mtime: 140,
                ctime: 140,
                atime: 140,
                type: 100,
                count: 50
            }
        };

        // Write settings.json and list_view.json if missing
        if (!fs.existsSync(this.settings_file)) {
            fs.writeFileSync(this.settings_file, JSON.stringify(defaults, null, 4));
        }
        if (!fs.existsSync(this.list_view_file)) {
            fs.writeFileSync(this.list_view_file, JSON.stringify(list_view_settings, null, 4));
        }
    }

    // Get Settings
    get_settings() {

        if (!this.settings) {
            this.settings = JSON.parse(fs.readFileSync(this.settings_file, 'utf-8'));
        }

        // if (fs.existsSync(this.settings_file)) {
        //     console.log('settings', this.settings_file);
        //     this.settings = JSON.parse(fs.readFileSync(this.settings_file, 'utf-8'));
        // } else {
        //     // Default to '' instead of home directory if settings file does not exist
        //     // this will allow the constructor in file manager to run the correct logic
        //     let settings = { location: '' };
        //     this.settings = settings;
        //     fs.writeFileSync(this.settings_file, JSON.stringify(settings, null, 4));

        //     is_first_run = 1;

        // }
        // win.send('settings', this.settings);
        return this.settings;
    }

    // Update settings
    updateSettings(settings) {

        // console.log('update settings', settings);

        this.settings = settings;
        fs.writeFileSync(this.settings_file, JSON.stringify(this.settings, null, 4));

        BrowserWindow.getAllWindows().forEach((wnd) => {
            if (!wnd.isDestroyed()) {
                wnd.webContents.send('settings_updated', this.settings);
            }
        });
    }

    update_window_settings(window_settings) {
        this.settings = {
            ...this.settings,
            ...window_settings
        };
        this.updateSettings(this.settings);
    }

    // Toggle Menubar
    showMenubar() {
        let showMenubar = this.settings['File Menu']['show'];
        if (showMenubar) {
            win.setMenuBarVisibility(true);
        } else {
            win.setMenuBarVisibility(false);
        }
    }

    // list view settings
    getListViewSetting() {
        try {
            this.list_view_settings = JSON.parse(fs.readFileSync(this.list_view_file, 'utf-8'));
        } catch (err) {
            let list_view_settings = {};
            fs.writeFileSync(this.list_view_file, JSON.stringify(list_view_settings, null, 4));
        }
        // console.log('getListViewSetting', this.list_view_settings);
        return this.list_view_settings;
    }

    updateListViewSettingSettings(list_view_settings) {
        this.list_view_settings = list_view_settings;
        fs.writeFileSync(this.list_view_file, JSON.stringify(this.list_view_settings, null, 4));
    }

}

class tabManager {

    constructor() {

        let history = {
            idx: 0,
            location: []
        }

        let tab = {
            id: 1,
            location: "",
            history: history
        }

        this.tab_history_idx = 0;
        this.tabs = [];

    }

    addTab(location, tab_id, sender = null) {

        if (this.tabs.find(t => t.id === tab_id)) {
            return;
        }

        let history = {
            idx: 0,
            location: []
        }

        let tab = {
            id: tab_id,
            location: location,
            history: history
        }

        tab.history.location.push(location);
        this.tabs.push(tab);

        const target = sender && !sender.isDestroyed() ? sender : win;
        if (target && !target.isDestroyed()) {
            target.send('disable_back_button');
            target.send('disable_forward_button');
        }

        this.saveTabs();
    }

    // Save tabs to file
    saveTabs() {
        const tabsFile = path.join(app.getPath('userData'), 'tabs.json');
        fs.writeFileSync(tabsFile, JSON.stringify(this.tabs, null, 4));
    }

    // Load tabs from file
    loadTabs() {
        const tabsFile = path.join(app.getPath('userData'), 'tabs.json');
        if (fs.existsSync(tabsFile)) {
            this.tabs = JSON.parse(fs.readFileSync(tabsFile, 'utf-8'));
            // console.log('loadTabs', this.tabs);
        }
    }

    removeTab(tab_id) {
        this.tabs = this.tabs.filter(t => parseInt(t.id) !== parseInt(tab_id));
        this.saveTabs();
    }

    addHistory(location, tab_id, sender = null) {

        let tab = this.tabs.find(t => t.id === tab_id);
        if (tab) {

            tab.history.location.length = tab.history.idx + 1;
            tab.history.location.push(location);
            tab.history.idx = tab.history.location.length - 1;

            if (tab.history.idx > 0) {
                const target = sender && !sender.isDestroyed() ? sender : win;
                if (target && !target.isDestroyed()) {
                    target.send('enable_back_button');
                }
            }

        }
        this.saveTabs();
    }

    goBack(tab_id, sender = null) {
        const target = sender && !sender.isDestroyed() ? sender : win;
        let tab = this.tabs.find(t => t.id === tab_id);
        // console.log('goBack_tab', tab.history.idx);
        if (tab) {
            if (tab.history.idx > 0) {
                tab.history.idx--;
                if (target && !target.isDestroyed()) {
                    target.send("get_files", tab.history.location[tab.history.idx]);
                }
                this.saveTabs(); // update the index to handle multiple tabs

                // todo: this does not need to run each time goBack is called
                if (target && !target.isDestroyed()) {
                    target.send('enable_forward_button');
                }

            }

            if (tab.history.idx === 0) {
                if (target && !target.isDestroyed()) {
                    target.send('disable_back_button');
                }
            }
        }
    }

    goForward(tab_id, sender = null) {
        const target = sender && !sender.isDestroyed() ? sender : win;
        let tab = this.tabs.find(t => t.id === tab_id);
        // console.log('goForward_tab', tab.history.idx);
        if (tab) {
            if (tab.history.idx < tab.history.location.length - 1) {
                tab.history.idx++;
                if (target && !target.isDestroyed()) {
                    target.send("get_files", tab.history.location[tab.history.idx]);
                }
                this.saveTabs(); // update the index to handle multiple tabs
                // console.log('goForward', tab.history.location[tab.history.idx]);

                if (target && !target.isDestroyed()) {
                    target.send('enable_back_button');
                }
            }

            if (tab.history.idx === tab.history.location.length - 1) {
                if (target && !target.isDestroyed()) {
                    target.send('disable_forward_button');
                }
            }
        }
    }

    switchTab(tab_id, sender = null) {
        const target = sender && !sender.isDestroyed() ? sender : win;
        let tab = this.tabs.find(t => t.id === tab_id);
        if (tab) {

            // win.send("get_files", tab.location[tab.history.idx]);

            // Enable or disable back and forward buttons based on history index
            if (tab.history.idx > 0) {
                if (target && !target.isDestroyed()) {
                    target.send('enable_back_button');
                }
            } else {
                if (target && !target.isDestroyed()) {
                    target.send('disable_back_button');
                }
            }

            if (tab.history.idx < tab.history.location.length - 1) {
                if (target && !target.isDestroyed()) {
                    target.send('enable_forward_button');
                }
            } else {
                if (target && !target.isDestroyed()) {
                    target.send('disable_forward_button');
                }
            }
        }
    }

}

// Init Tab Manager
const tab_manager = new tabManager()
// tab_manager.addTab(os.homedir());
// tab_manager.addHistory(0, os.homedir());
// tab_manager.addHistory(0, path.join(os.homedir(), 'Documents'));

// Add tab
ipcMain.on('add_tab', (e, location, tab_id) => {
    tab_manager.addTab(location, tab_id, e.sender);
});

// Remove tab
ipcMain.on('remove_tab', (e, tab_id) => {
    tab_manager.removeTab(tab_id);
});

// Add history to tab
ipcMain.on('add_tab_history', (e, location, tab_id) => {
    tab_manager.addHistory(location, tab_id, e.sender);
});

ipcMain.on('go_back', (e, tab_id) => {
    tab_manager.goBack(tab_id, e.sender);
});

ipcMain.on('go_forward', (e, tab_id) => {
    tab_manager.goForward(tab_id, e.sender);
});

ipcMain.on('switch_tab', (e, tab_id) => {
    tab_manager.switchTab(tab_id, e.sender);
});

ipcMain.handle('get_dashboard_view', async (e) => {
    try {
        const dashboard_view = await fs.promises.readFile(
            path.join(__dirname, '..', 'renderer', 'views', 'dashboard.html'),
            'utf8'
        );

        return {
            dashboard_view
        };
    } catch (err) {
        return {
            dashboard_view: '',
            error: true,
            message: String(err.message || err)
        };
    }
})

ipcMain.handle('get_dashboard_disk_stats', async (e, location) => {

    // let stats = {};
    try {

        let f = gio.get_file(location);
        if (f == null || f === undefined) {
            return;
        }

        let stats = await gio.disk_stats(location);
        Object.assign(f, stats);

        // let stats = await gio.disk_stats(path);
        // Object.assign(stats, { path: path });
        // return stats

        return f

    } catch (err) {
        return {
            stats: '',
            error: true,
            message: String(err.message || err)
        }
    }

})

ipcMain.handle('find', async (e, query, location, options) => {

    return await new Promise((resolve, reject) => {
        const find_worker = new worker.Worker(path.join(__dirname, '../workers/find_worker.js'));
        find_worker.postMessage({
            cmd: 'find',
            query: query,
            location: location,
            options: options
        });

        find_worker.on('message', (msg) => {
            // Accept both 'find' and 'find_result' for compatibility
            if (msg.cmd === 'find_results') {
                resolve({
                    error: msg.err,
                    results: msg.res
                });
                find_worker.terminate();
            }
        });

        find_worker.on('error', (err) => {
            resolve({
                error: true,
                message: String(err.message || err),
                results: []
            });
            find_worker.terminate();
        });
    });
})

// ipcMain.handle('find', async (e, query, location, options) => {
//     const search_query = typeof query === 'string' ? query.trim() : '';
//     const search_location = typeof location === 'string' && location.trim() !== ''
//         ? location
//         : os.homedir();
//     const search_options = normalize_find_options(options);
//     const has_search_options = Object.keys(search_options).length > 0;

//     if (!search_query) {
//         return {
//             error: false,
//             results: []
//         };
//     }

//     return await new Promise((resolve) => {
//         const find_callback = (err, res) => {
//             // Supports both callback shapes: (results) and (err, results)
//             const callback_error =
//                 err &&
//                 res === undefined &&
//                 typeof err !== 'string' &&
//                 !Array.isArray(err)
//                     ? err
//                     : null;

//             if (callback_error) {
//                 resolve({
//                     error: true,
//                     message: String(callback_error.message || callback_error),
//                     results: []
//                 });
//                 return;
//             }

//             const raw_results = res === undefined ? err : res;
//             resolve({
//                 error: false,
//                 results: normalize_find_results(raw_results)
//             });
//         };

//         try {
//             if (has_search_options) {
//                 try {
//                     gio.find(search_query, search_location, search_options, find_callback);
//                 } catch (err) {
//                     // Fallback for older gio builds that do not support options.
//                     gio.find(search_query, search_location, find_callback);
//                 }
//             } else {
//                 gio.find(search_query, search_location, find_callback);
//             }
//         } catch (err) {
//             resolve({
//                 error: true,
//                 message: String(err.message || err),
//                 results: []
//             });
//         }
//     });
// });

// Overwrite a single conflicting file

ipcMain.on('overwrite_one', (e, f, operation) => {
    try {
        if (fs.existsSync(f.destination)) {
            if (fs.statSync(f.destination).isDirectory()) {
                fs.rmSync(f.destination, { recursive: true, force: true });
            } else {
                fs.unlinkSync(f.destination);
            }
        }
        if (operation === 'move') {
            utilities.move_worker.postMessage({ cmd: 'move', move_arr: [f] });
            utilities.move_in_progress = true;
        } else {
            utilities.paste_worker.postMessage({ cmd: 'paste', copy_arr: [f] });
            utilities.copy_in_progress = true;
        }
    } catch (err) {
        win.send('set_msg', `Error overwriting ${f.name}: ${err.message}`);
    }
});

// Overwrite all remaining conflicting files
ipcMain.on('overwrite_all', (e, files_arr, operation) => {
    files_arr.forEach(f => {
        try {
            if (fs.existsSync(f.destination)) {
                if (fs.statSync(f.destination).isDirectory()) {
                    fs.rmSync(f.destination, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(f.destination);
                }
            }
        } catch (err) {
            win.send('set_msg', `Error removing ${f.destination}: ${err.message}`);
        }
    });
    if (operation === 'move') {
        utilities.move_worker.postMessage({ cmd: 'move', move_arr: files_arr });
        utilities.move_in_progress = true;
    } else {
        utilities.paste_worker.postMessage({ cmd: 'paste', copy_arr: files_arr });
        utilities.copy_in_progress = true;
    }
});

/////////////////////////////////

// // Go forward
// ipcMain.on('go_forward', (e) => {
//     let href = history_manager.historyForward();
//     if (href) {
//         win.send('get_files', href);
//     }
// });

// // Check if can go back
// ipcMain.on('can_go_back', (e) => {
//     e.returnValue = history_manager.canGoBack();
// });

// // Check if can go forward
// ipcMain.on('can_go_forward', (e) => {
//     e.returnValue = history_manager.canGoForward();
// });

// Clear history
ipcMain.on('clear_history', (e) => {

});

// Load history on startup
ipcMain.on('load_history', (e) => {
    // history_manager.clear_history();
    history_manager.loadHistory();
});

// Utilities class
class Utilities {

    constructor() {

        this.is_main = true;
        this.run_watcher = true;
        this.root_destination = '';
        this.delete_sender = null;
        this.delete_in_progress = false;
        this.copy_in_progress = false;
        this.move_in_progress = false;

        this.byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
        this.folder_size_requesters = new Map();
        this.folder_size_in_flight = new Set();
        this.directory_size_cache = new DirectorySizeCache();

        this.ls_worker = new worker.Worker(path.join(__dirname, '../workers/ls_worker.js'));
        this.ls_worker.on('message', (data) => {
            if (data.cmd === 'folder_size_done') {
                this.folder_size_in_flight.delete(data.source);
                this.directory_size_cache.set(data.source, data.size);

                let folder_data = {
                    source: data.source,
                    size: data.size
                }

                const requesters = this.folder_size_requesters.get(data.source);
                let delivered = false;

                if (requesters && requesters.size > 0) {
                    requesters.forEach((web_contents_id) => {
                        const target = webContents.fromId(web_contents_id);
                        if (target && !target.isDestroyed()) {
                            target.send('folder_size', folder_data);
                            delivered = true;
                        }
                    });
                    this.folder_size_requesters.delete(data.source);
                }

                if (!delivered && win && !win.isDestroyed()) {
                    win.send('folder_size', folder_data);
                }
            } else if (data.cmd === 'folder_size_error') {
                if (data.source) {
                    this.folder_size_in_flight.delete(data.source);
                    this.folder_size_requesters.delete(data.source);
                }

                if (win && !win.isDestroyed() && data.msg) {
                    win.send('set_msg', data.msg);
                }
            }
        });

        // set execute
        ipcMain.on('set_execute', (e, href) => {
            gio.set_execute(href);
        })

        ipcMain.on('clear_execute', (e, href) => {
            gio.clear_execute(href);
        })

        // Run external command
        ipcMain.on('command', (e, cmd) => {
            exec(cmd, (error, data, getter) => { });
        })

        // listen for open file event
        ipcMain.on('open', (e, location) => {
            this.open(e, location);
        })

        // listen for paste event
        ipcMain.on('paste', (e, copy_arr, location) => {
            this.root_destination = location;
            this.paste(e, copy_arr, location);
        })

        // listen for move event
        ipcMain.on('move', (e, move_arr, location) => {
            this.root_destination = location;
            this.move(e, move_arr, location);
        })

        // listen for make directory event
        ipcMain.on('mkdir', (e, location) => {
            this.mkdir(e, location);
        })

        // listen for rename event
        ipcMain.on('rename', (e, source, destination, id) => {
            this.rename(e, source, destination, id);
        })

        // listen for delete event
        ipcMain.on('delete', (e, delete_arr) => {
            this.delete(e, delete_arr);
        })

        ipcMain.on('cancel_operation', (e, operation) => {
            if (operation === 'delete' && this.delete_in_progress) {
                this.delete_worker.postMessage({ cmd: 'cancel' });
                const sender = this.delete_sender || e.sender || win;
                sender.send('set_msg', 'Cancelling delete...');
            } else if (operation === 'copy' && this.copy_in_progress) {
                this.paste_worker.postMessage({ cmd: 'cancel' });
                win.send('set_msg', 'Cancelling copy...');
            } else if (operation === 'move' && this.move_in_progress) {
                this.move_worker.postMessage({ cmd: 'cancel' });
                win.send('set_msg', 'Cancelling move...');
            }
        })

        // listen for get_disk_space event
        ipcMain.on('get_disk_space', (e, href) => {

            const sender = e?.sender;

            if (href === '' || href === undefined) {
                if (sender && !sender.isDestroyed()) {
                    sender.send('set_msg', `Error: getting href: ${href}`);
                } else if (win && !win.isDestroyed()) {
                    win.send('set_msg', `Error: getting href: ${href}`);
                }
                return;
            }

            if (!fs.existsSync(href)) {
                // Error getting disk space
                return;
            }

            this.get_disk_space(href, sender);
        })

        // listen for message from worker
        this.init_paste_worker();

        // init move worker
        this.init_move_worker();

        // init delete worker
        this.delete_worker = new worker.Worker(path.join(__dirname, '../workers/delete_worker.js'));
        this.delete_worker.on('message', (data) => {
            const cmd = data.cmd;
            const sender = this.delete_sender || win;

            switch (cmd) {
                case 'set_progress':
                    sender.send('set_progress', data);
                    break;
                case 'set_msg':
                    sender.send('set_msg', data.msg);
                    break;
                case 'delete_done': {
                    const invalidated_paths = new Set();
                    if (Array.isArray(data.deleted_items) && data.deleted_items.length > 0) {
                        data.deleted_items.forEach((item) => {
                            if (item && item.href) {
                                this.invalidate_folder_size_for_item_path(item.href, false).forEach((p) => invalidated_paths.add(p));
                            }
                        });
                    }

                    if (invalidated_paths.size > 0) {
                        this.emit_folder_size_cache_invalidated(Array.from(invalidated_paths));
                    }

                    if (Array.isArray(data.deleted_items) && data.deleted_items.length > 0) {
                        sender.send('remove_items', data.deleted_items);
                    }

                    sender.send('set_progress', {
                        cmd: 'set_progress',
                        operation: 'delete',
                        can_cancel: false,
                        status: '',
                        max: 0,
                        value: 0
                    });

                    if (data.cancelled) {
                        sender.send('set_msg', `Delete cancelled. ${data.deleted_files} files deleted.`);
                    } else if (data.failed_items > 0) {
                        sender.send('set_msg', `${data.deleted_files} files deleted, ${data.failed_items} items failed.`);
                    } else {
                        sender.send('set_msg', `${data.deleted_files} files deleted.`);
                    }

                    this.delete_in_progress = false;
                    this.delete_sender = null;
                    this.run_watcher = true;
                    break;
                }
                default:
                    break;
            }
        });

        this.delete_worker.on('error', (err) => {
            const sender = this.delete_sender || win;
            sender.send('set_progress', {
                cmd: 'set_progress',
                status: '',
                max: 0,
                value: 0
            });
            sender.send('set_msg', `Error deleting files: ${err.message}`);
            this.delete_in_progress = false;
            this.delete_sender = null;
            this.run_watcher = true;
        });

        // init home directory
        this.home_dir = os.homedir();

        // listen for get_home_dir event
        ipcMain.on('get_home_dir', (e) => {
            e.returnValue = os.homedir();
        });

        ipcMain.on('get_user', (e) => {
            e.returnValue = os.userInfo().username;
        })

        // listen for is_main event
        ipcMain.on('is_main', (e, is_main) => {
            // console.log('is_main', is_main); // commented out for non-error logging
            this.is_main = is_main;
        });

        ipcMain.on('extract', (e, files_arr, location) => {

            let progress_id = 0;
            this.run_watcher = false;

            for (let i = 0; i < files_arr.length; i++) {

                if (files_arr[i].is_dir) {
                    continue;
                }

                let compression_worker = new worker.Worker(path.join(__dirname, '../workers/compression_worker.js'));
                compression_worker.on('message', (data) => {

                    if (data.cmd === 'set_msg') {
                        win.send('set_msg', data.msg, data.has_timeout);
                    }

                    if (data.cmd === 'progress') {
                        win.send('set_progress', data)
                    }

                    if (data.cmd === 'extract_done') {
                        if (data.destination) {
                            this.invalidate_folder_size_for_item_path(data.destination);
                        }

                        let close_progress = {
                            id: data.id,
                            value: 0,
                            max: 0,
                            msg: ''
                        }
                        win.send('set_progress', close_progress);

                        win.send('remove_item', data.destination);
                        win.send('get_item', gio.get_file(data.destination));
                        e.sender.send('set_msg', 'Done extracting files.', 1);

                        this.run_watcher = true;

                    }
                })

                let data = {
                    id: progress_id += 1,
                    cmd: 'extract',
                    location: location,
                    source: files_arr[i].href,
                }
                compression_worker.postMessage(data);

            }
            files_arr = [];
        })

        // Compress
        ipcMain.on('compress', (e, files_arr, location, type, size) => {

            let progress_id = 0;
            this.run_watcher = false;

            let compression_worker = new worker.Worker(path.join(__dirname, '../workers/compression_worker.js'));
            compression_worker.on('message', (data) => {
                if (data.cmd === 'set_msg') {
                    win.send('set_msg', data.msg, data.has_timeout);
                }
                if (data.cmd === 'progress') {
                    win.send('set_progress', data)
                }
                if (data.cmd === 'compress_done') {
                    if (location) {
                        this.invalidate_folder_size_hierarchy(location);
                    }

                    // win.send('remove_item', data.file_path);
                    let f = gio.get_file(data.file_path);
                    if (f) {
                        f.id = btoa(data.file_path);
                        win.send('get_item', f);
                    }
                    let close_progress = {
                        id: data.id,
                        value: 0,
                        max: 0,
                        status: ''
                    }
                    win.send('set_progress', close_progress);
                    win.send('set_msg', 'Done compressing files.');

                    this.run_watcher = false;

                }
            })

            let compress_data = {
                id: progress_id += 1,
                cmd: 'compress',
                location: location,
                type: type,
                size: size,
                files_arr: files_arr
            }
            compression_worker.postMessage(compress_data);

        })

        // On Get Folder Size
        ipcMain.on('get_folder_size', (e, href) => {
            this.get_folder_size(e, href);
        })

    }

    init_paste_worker() {
        this.paste_worker = new worker.Worker(path.join(__dirname, '../workers/paste_worker.js'));
        this.paste_worker.on('message', (data) => {
            const cmd = data.cmd;
            switch (cmd) {
                case 'set_progress':
                    win.send('set_progress', data);
                    break;
                case 'remove_item': {
                    // win.send('remove_item', data.id);
                    break;
                }
                case 'set_msg': {
                    win.send('set_msg', data.msg);
                    break;
                }
                case 'cp_done': {

                    // console.log('cp_done_data', data); // commented out for non-error logging
                    this.run_watcher = false;
                    this.copy_in_progress = false;

                    if (data.cancelled) {
                        win.send('set_msg', 'Copy cancelled.');
                    }

                    if (this.is_main && !data.cancelled) {

                        // get the base name of the file
                        let file = gio.get_file(data.destination);

                        if (file.href === undefined || file.href === null) {
                            win.send('set_msg', 'Error: File not found.');
                            break;
                        }

                        file.id = btoa(file.href);
                        win.send('update_item', file);

                    } else if (!this.is_main && !data.cancelled) {

                        // get the base name of the file
                        let file = gio.get_file(this.root_destination);
                        file.id = btoa(file.href);

                        if (file.href === undefined || file.href === null) {
                            win.send('set_msg', 'Error: File not found.');
                            break;
                        } else {
                            win.send('update_item', file);
                        }

                    }

                    if (this.root_destination) {
                        this.invalidate_folder_size_hierarchy(this.root_destination);
                    }

                    this.get_disk_space(this.root_destination);
                    this.run_watcher = true;

                    break;
                }
                default:
                    break;
            }

        });
    }

    init_move_worker() {
        this.move_worker = new worker.Worker(path.join(__dirname, '../workers/move_worker.js'));
        this.move_worker.on('message', (data) => {
            const cmd = data.cmd;
            switch (cmd) {
                case 'set_progress':
                    win.send('set_progress', data);
                    break;
                case 'set_msg': {
                    win.send('set_msg', data.msg);
                    break;
                }
                case 'mv_done': {

                    this.move_in_progress = false;
                    const invalidated_paths = new Set();

                    if (Array.isArray(data.files_arr) && data.files_arr.length > 0) {
                        data.files_arr.forEach((file_item) => {
                            if (file_item && file_item.source) {
                                this.invalidate_folder_size_for_item_path(file_item.source, false).forEach((p) => invalidated_paths.add(p));
                            }
                            if (file_item && file_item.destination) {
                                this.invalidate_folder_size_for_item_path(file_item.destination, false).forEach((p) => invalidated_paths.add(p));
                            }
                        });
                    }

                    if (this.root_destination) {
                        this.invalidate_folder_size_hierarchy(this.root_destination, false).forEach((p) => invalidated_paths.add(p));
                    }

                    if (invalidated_paths.size > 0) {
                        this.emit_folder_size_cache_invalidated(Array.from(invalidated_paths));
                    }

                    if (this.is_main && !data.cancelled) {

                        // remove old items
                        win.send('remove_items', data.files_arr);

                        // get moved from location
                        let root_source = path.dirname(data.files_arr[0].source);
                        let file = gio.get_file(root_source);
                        file.id = btoa(file.href);

                        // check file object
                        if (file.href === undefined || file.href === null) {
                            win.send('set_msg', 'Error: File not found.');
                            break;
                        } else {
                            // update moved from item
                            win.send('update_item', file);
                        }

                    } else if (!this.is_main && !data.cancelled) {

                        let file = gio.get_file(this.root_destination);
                        file.id = btoa(file.href);

                        if (file.href === undefined || file.href === null) {
                            win.send('set_msg', 'Error: File not found.');
                            break;
                        } else {
                            win.send('update_item', file);
                        }

                    }

                    if (data.cancelled) {
                        win.send('set_msg', 'Move cancelled.');
                    }

                    setTimeout(() => {
                        this.run_watcher = true;
                    }, 100);

                    break;
                }
                default:
                    break;
            }

        });
    }

    normalize_folder_size_path(raw_path) {
        return this.directory_size_cache.normalize_path(raw_path);
    }

    emit_folder_size_cache_invalidated(paths = []) {
        const unique_paths = Array.from(new Set((paths || [])
            .map((p) => this.normalize_folder_size_path(p))
            .filter(Boolean)));

        if (unique_paths.length === 0) {
            return;
        }

        BrowserWindow.getAllWindows().forEach((browser_window) => {
            if (!browser_window || browser_window.isDestroyed()) {
                return;
            }

            const contents = browser_window.webContents;
            if (contents && !contents.isDestroyed()) {
                contents.send('folder_size_invalidated', { paths: unique_paths });
            }
        });
    }

    invalidate_folder_size_hierarchy(target_path, notify = true) {
        const invalidated = this.directory_size_cache.invalidate_hierarchy(target_path);
        if (notify && invalidated.length > 0) {
            this.emit_folder_size_cache_invalidated(invalidated);
        }
        return invalidated;
    }

    invalidate_folder_size_for_item_path(item_path, notify = true) {
        const normalized_item_path = this.normalize_folder_size_path(item_path);
        if (!normalized_item_path) {
            return [];
        }

        return this.invalidate_folder_size_hierarchy(path.dirname(normalized_item_path), notify);
    }

    // get folder size
    get_folder_size(e, href) {
        const normalized_href = this.normalize_folder_size_path(href);
        if (!normalized_href) {
            return;
        }

        const cached_size = this.directory_size_cache.get(normalized_href);
        if (cached_size !== null) {
            const target = e?.sender;
            const folder_data = {
                source: normalized_href,
                size: cached_size
            };

            if (target && !target.isDestroyed()) {
                target.send('folder_size', folder_data);
            } else if (win && !win.isDestroyed()) {
                win.send('folder_size', folder_data);
            }
            return;
        }

        const sender_id = e?.sender?.id;
        if (sender_id) {
            let requesters = this.folder_size_requesters.get(normalized_href);
            if (!requesters) {
                requesters = new Set();
                this.folder_size_requesters.set(normalized_href, requesters);
            }
            requesters.add(sender_id);
        }

        if (this.folder_size_in_flight.has(normalized_href)) {
            return;
        }

        this.folder_size_in_flight.add(normalized_href);
        this.ls_worker.postMessage({ cmd: 'get_folder_size', source: normalized_href });
    }


    // set is main flag
    set_is_main(is_main) {
        this.is_main = is_main;
    }

    // sanitize file name
    sanitize_file_name(href) {
        return href.replace(/\n/g, ' ');
    }

    // open
    open(e, href) {
        shell.openPath(href)
            .then((error) => {

                // clear high lighted item
                e.sender.send('clear_highlight');


                if (error) {
                    e.sender.send('set_msg', error);
                }
            })
    }

    // poste
    paste(e, copy_arr, location) {

        // check if copy_arr is empty
        if (copy_arr.length === 0) {
            win.send('set_msg', 'Error: Copy array is empty.');
            return;
        }

        // check if location is empty
        if (location == '' || location == undefined) {
            win.send('set_msg', 'No location to paste files.');
            return;
        }

        this.run_watcher = false;

        let paste_arr = [];
        let overwrite_arr = [];

        win.send('set_msg', '<img src="../renderer/icons/spinner.gif" style="width: 12px; height: 12px" alt="loading" /> Gathering files...');

        copy_arr.forEach(f => {

            if (f.location === '' || f.location === undefined) {
                win.send('set_msg', 'Error: No location to paste files.');
                return;
            }

            if (f.is_dir === null || f.is_dir === undefined) {
                win.send('set_msg', 'Error: No file type to paste files.');
                return;
            }

            if (f.name === '' || f.name === undefined) {
                win.send('set_msg', 'Error: No file name to paste files.');
                return;
            }

            if (f.href === '' || f.href === undefined) {
                win.send('set_msg', 'Error: No file href to paste files.');
                return;
            }

            if (f.display_name === '' || f.display_name === undefined) {
                win.send('set_msg', 'Error: No file display name to paste files.');
                return;
            }

            if (f.is_hidden === null || f.is_hidden === undefined) {
                win.send('set_msg', 'Error: No file hidden status to paste files.');
                return;
            }

            f.destination = path.join(location, this.sanitize_file_name(f.name));
            f.source = f.href;
            f.name = path.basename(f.destination);
            f.display_name = f.name;
            f.is_hidden = f.is_hidden;
            f.href = f.destination;

            // console.log('paste', f.location, f.destination);

            // handle duplicate file names
            if (f.location == location && fs.existsSync(f.destination)) {

                let dup_idx = 1;
                while (fs.existsSync(f.destination)) {
                    let ext = path.extname(f.destination);
                    let base = path.basename(f.destination, ext);
                    let dir = path.dirname(f.destination);
                    let new_base = `${base} (Copy ${dup_idx})`;
                    f.destination = path.join(dir, new_base + ext);
                    dup_idx++;
                }
                // update additional attributes so the new files have the correct data
                f.name = path.basename(f.destination);
                f.display_name = f.name;
                f.href = f.destination;

                paste_arr.push(f);

            } else if (fs.existsSync(f.destination)) {
                overwrite_arr.push(f);
            } else {
                paste_arr.push(f);
            }

        });

        // send copy_arr to renderer
        if (paste_arr.length > 0) {

            if (this.is_main) {
                e.sender.send('add_items', paste_arr, location);
            } else {
                // handle updated to location
                // refresh directory stats
            }

            // send copy_arr to worker
            let paste_cmd = {
                cmd: 'paste',
                copy_arr: paste_arr,
                location: location
            }
            this.paste_worker.postMessage(paste_cmd);
            this.copy_in_progress = true;
        }

        if (overwrite_arr.length > 0) {
            // send overwrite_arr to renderer
            e.sender.send('overwrite_copy', overwrite_arr);
        }

        // clean up
        paste_arr = [];
        overwrite_arr = [];
        copy_arr = [];

        // this.is_main = true;
    }

    // move
    move(e, files_arr, location) {

        if (files_arr.length === 0) {
            win.send('set_msg', 'Error: moving files_arr is empty');
            return;
        }

        if (location === '' || location === undefined) {
            win.send('set_msg', `Error: Move location is not valid: ${location}`);
        }

        let move_arr = [];
        let overwrite_arr = [];
        this.run_watcher = false;

        files_arr.forEach(f => {

            f.destination = path.join(location, f.name); // set destination
            f.source = f.href; // set source to current href
            f.href = f.destination; // set href to destination
            f.location = f.destination;

            // handle duplicate file names
            if (f.location == location && fs.existsSync(f.destination)) {

                let dup_idx = 1;
                while (fs.existsSync(f.destination)) {
                    let ext = path.extname(f.destination);
                    let base = path.basename(f.destination, ext);
                    let dir = path.dirname(f.destination);
                    let new_base = `${base} (Copy ${dup_idx})`;
                    f.destination = path.join(dir, new_base + ext);
                    dup_idx++;
                }
                // update additional attributes so the new files have the correct data
                f.name = path.basename(f.destination);
                f.href = f.destination;

                move_arr.push(f);

            } else if (fs.existsSync(f.destination)) {
                overwrite_arr.push(f);
            } else {
                move_arr.push(f);
            }

        });

        // send copy_arr to renderer
        if (move_arr.length > 0) {

            if (this.is_main) {
                e.sender.send('add_items', move_arr, location);
            } else {
                // handle updated to location
                // refresh directory stats
                e.sender.send('remove_items', move_arr)
            }

            // send copy_arr to worker
            let move_cmd = {
                cmd: 'move',
                move_arr: move_arr,
                location: location
            }

            this.move_worker.postMessage(move_cmd);
            this.move_in_progress = true;

        }

        if (overwrite_arr.length > 0) {
            win.send('overwrite_move', overwrite_arr);
        }

        move_arr = [];
        overwrite_arr = [];
        files_arr = [];

    }

    // make directory
    mkdir(e, location) {

        if (location === '' || location === undefined) {
            win.send('set_msg', `Error: getting mkdir location ${location}`);
            return;
        }

        this.run_watcher = false;

        let dir = path.join(location, 'New Folder');
        let idx = 1;
        while (fs.existsSync(dir)) {
            dir = path.join(location, `New Folder (${idx})`);
            idx++;
        }
        fs.mkdirSync(dir);
        let f = gio.get_file(dir);
        f.id = btoa(dir);
        e.sender.send('get_item', f);
        e.sender.send('edit_item', f);
        this.invalidate_folder_size_hierarchy(location);

        setTimeout(() => {
            this.run_watcher = true;
        }, 100);

    }

    // rename
    async rename(e, source, destination, id) {

        if (source === '' || source === undefined) {
            win.send('set_msg', `Error: getting source for rename: ${source}`);
            return;
        }

        if (destination === '' || destination === undefined) {
            win.send('set_msg', `Error: getting destination for rename: ${destination}`);
            return;
        }

        if (id === '' || id === undefined) {
            win.send('set_msg', `Error: getting id for rename: ${id}`);
            return;
        }

        this.run_watcher = false;

        // console.log('rename', source, destination); // commented out for non-error logging

        if (fs.existsSync(destination)) {

            if (!destination.includes('New Folder')) {
                win.send('set_msg', `Error: File name '${destination}' already exists.`);
                return;
            }
            win.send('cancel_edit');
            return;
        }

        const res = await new Promise((resolve, reject) => {
            gio.mv(source, destination, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }

                let f = gio.get_file(destination);
                if (!f) {
                    win.send('set_msg', `Error: getting file object for rename: ${f}`);
                }
                f.id = id;
                e.sender.send('update_item', f);

                resolve(result || {});
            });
        }).catch((err) => {
            win.send('set_msg', `Error: rename: ${err}`);
            return null;
        });

        if (res) {
            this.invalidate_folder_size_hierarchy(path.dirname(source), false);
            this.invalidate_folder_size_hierarchy(path.dirname(destination), false);
            this.emit_folder_size_cache_invalidated([path.dirname(source), path.dirname(destination)]);
        }

        // fs.rename(source, destination, (err) => {

        //     if (err) {
        //         win.send('set_msg', `Error: rename: ${err}`);
        //         return;
        //     }

        //     let f = gio.get_file(destination);
        //     if (!f) {
        //         win.send('set_msg', `Error: getting file object for rename: ${f}`);
        //     }
        //     f.id = id;
        //     e.sender.send('update_item', f);

        // });

        setTimeout(() => {
            this.run_watcher = true;
        }, 100);

    }

    // delete
    delete(e, delete_arr) {

        if (delete_arr.length > 0) {

            if (this.delete_in_progress) {
                e.sender.send('set_msg', 'Delete already in progress.');
                return;
            }

            this.run_watcher = false;

            // Create alert dialog
            const options = {
                type: 'question',
                buttons: ['Cancel', 'Delete'],
                defaultId: 1,
                title: 'Delete',
                message: `Are you sure you want to delete the ${delete_arr.length} items?`,
                detail: 'If you delete and item, it will be permanetly lost.'
            }

            // Show alert dialog
            dialog.showMessageBox(null, options).then((response) => {
                if (response.response === 1) {
                    this.delete_sender = e.sender;
                    this.delete_in_progress = true;
                    this.delete_worker.postMessage({
                        cmd: 'delete',
                        delete_arr
                    });

                } else {
                    win.send('set_msg', 'Operation cancelled.');
                    this.run_watcher = true;
                }

            });

        }
    }

    // get file size
    get_file_size(bytes) {

        if (bytes === 0) return 0;

        let i = -1;
        do {
            bytes = bytes / 1024;
            i++;
        } while (bytes > 1024);
        return Math.max(bytes, 0.1).toFixed(1) + this.byteUnits[i];
    };

    // get disk space
    get_disk_space(href, sender = null) {

        const target = sender && !sender.isDestroyed() ? sender : win;

        if (href === '' || href === undefined) {
            if (target && !target.isDestroyed()) {
                target.send('set_msg', `Error: get_disk_space href is not valid ${href}`);
            }
            return;
        }

        try {
            let options = {
                disksize: this.get_file_size(parseInt(gio.disk_stats(href).total)),
                usedspace: this.get_file_size(parseInt(gio.disk_stats(href).used)),
                availablespace: this.get_file_size(parseInt(gio.disk_stats(href).free))
            }
            let df = [];
            df.push(options);
            if (target && !target.isDestroyed()) {
                target.send('disk_space', df);
            }

        } catch (err) {
            // console.log(err); // commented out for non-error logging
        }

    }


}

class WorkspaceManager {

    constructor() {

        // Add Workspace
        ipcMain.on('add_workspace', (e, selected_files_arr) => {

            let workspace_file = path.join(app.getPath('userData'), 'workspace.json');
            let workspace_data = JSON.parse(fs.readFileSync(workspace_file, 'utf8'))

            selected_files_arr.forEach(f => {
                let file = gio.get_file(f.href);
                // add to top of array
                workspace_data.unshift(file);
            })
            fs.writeFileSync(workspace_file, JSON.stringify(workspace_data, null, 4));
            win.send('get_workspace');
            selected_files_arr = [];
        })

        // Remove Workspace
        ipcMain.on('remove_workspace', (e, href) => {

            let workspace_file = path.join(app.getPath('userData'), 'workspace.json');
            let workspace_data = JSON.parse(fs.readFileSync(workspace_file, 'utf8'));

            let workspace = workspace_data.filter(data => data.href !== href);
            fs.writeFileSync(workspace_file, JSON.stringify(workspace, null, 4));

            win.send('get_workspace');
            // selected_files_arr = [];
        })

        // Get Workspace
        ipcMain.handle('get_workspace', async (e) => {

            let workspace_file = path.join(app.getPath('userData'), 'workspace.json');
            if (!gio.exists(workspace_file)) {
                let workspace_data = [];
                fs.writeFileSync(workspace_file, JSON.stringify(workspace_data, null, 4));
            }
            return this.get_workspace_arr();
            // let workspace_items = JSON.parse(fs.readFileSync(workspace_file, 'utf-8'));
            // return workspace_items;

        })

        // Update workspace
        ipcMain.on('rename_workspace', (e, href, workspace_name) => {

            let workspace_file = path.join(app.getPath('userData'), 'workspace.json');
            let workspace_data = JSON.parse(fs.readFileSync(workspace_file, 'utf8'));

            let index = workspace_data.findIndex(data => data.href === href);
            if (index !== -1) {
                workspace_data[index].name = workspace_name;
                fs.writeFileSync(workspace_file, JSON.stringify(workspace_data, null, 4));
                win.send('get_workspace');
            } else {
                console.error("Workspace entry not found with href:", href);
            }

        })

        ipcMain.on('reorder_workspace', (e, files_arr) => {

            let workspace_file = path.join(app.getPath('userData'), 'workspace.json');

            try {
                // Read and parse the current workspace file
                const workspace_data = JSON.parse(fs.readFileSync(workspace_file, 'utf8'));

                // Create a new array based on the order in files_arr
                const reordered_data = files_arr.map((f, i) => {
                    const entry = workspace_data.find(data => data.href === f);

                    if (entry) {
                        // Update the order if required
                        return { ...entry, order: i };
                    } else {
                        console.error("Workspace entry not found with href:", f);
                        return null; // Handle missing entries gracefully
                    }
                }).filter(entry => entry !== null); // Remove null entries (if any)

                // Write the reordered array back to the file
                fs.writeFileSync(workspace_file, JSON.stringify(reordered_data, null, 4));
                // console.log('Workspace reordered successfully.'); // commented out for non-error logging

                // Notify the renderer to refresh the workspace
                win.send('get_workspace');
            } catch (error) {
                console.error("Failed to reorder workspace:", error.message);
            }

        });

        ipcMain.on('get_workspace_folder_icon', (e, href) => {
            let icon = iconManager.get_folder_icon(e, href);
            e.sender.send('set_workspace_folder_icon', href, icon);
        });

    }

    get_workspace_arr() {

        let workspace_file = path.join(app.getPath('userData'), 'workspace.json');
        if (!gio.exists(workspace_file)) {
            let workspace_data = [];
            fs.writeFileSync(workspace_file, JSON.stringify(workspace_data, null, 4));
        }
        let workspace_items = JSON.parse(fs.readFileSync(workspace_file, 'utf-8'));
        return workspace_items;

    }

}

// Icon IPC //////

// Get File Icon
ipcMain.handle('get_icon', async (e, href) => {

    const cached_icon = get_cached_file_icon(href);
    if (cached_icon) {
        return cached_icon;
    }

    if (process.platform === 'linux' && typeof gio.get_file_icon_data_url === 'function') {
        try {
            const result = gio.get_file_icon_data_url(href);
            if (typeof result === 'string' && result.startsWith('data:image/')) {
                set_cached_file_icon(href, result);
                return result;
            }
            if (result && result.icon_data_url) {
                set_cached_file_icon(href, result.icon_data_url);
                return result.icon_data_url;
            }
            if (result && result.symbolic_icon_data_url) {
                set_cached_file_icon(href, result.symbolic_icon_data_url);
                return result.symbolic_icon_data_url;
            }
        } catch (err) {
        }
    }

    if (process.platform === 'linux' && typeof iconManager.get_file_icon === 'function') {
        try {
            const icon_path = iconManager.get_file_icon(href);
            if (typeof icon_path === 'string' && icon_path.length > 0) {
                set_cached_file_icon(href, icon_path);
                return icon_path;
            }
        } catch (err) {
        }
    }

    return await app.getFileIcon(href, { size: 32 }).then(icon => {
        const icon_data_url = icon.toDataURL();
        set_cached_file_icon(href, icon_data_url);
        return icon_data_url;
    }).catch((err) => {
        const fallback_icon = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADHklEQVRYhe2WX0/yVhzHP8VBW04r0pKIgjDjlRfPC3BX7vXM1+OdMXsPXi9eqEu27DUgf1ICgQrlFGkxnF0sdgrq00dxyZZ9kyb0d2i/n/b8vj0H/teS6vX69xcXF7/4vh9JKdV7j7Ozs+s0fpnlwunp6c/Hx8c/5nK53EcepFar/ZAGYgXg6Ojo6CPG3wqxApDL5bLrMM9kMgnE+fn5qxArAOuSECL5Xa1WX4X4NIB6vY5pmmia9iaEtlyQUqp1Qcznc+I4Rqm/b1kul595frcus5eUzWbJZt9uqVRToJRiMBgk58PhEM/zUEqhlMLzPIbDIfDXU3c6HcIwTAWZCqDdbtPtdgGQUhIEAYZh4HkenudhmiaTyQQpJY1GA9d1abVaz179hwBqtRq6rgMwmUxwHAfHcZBSIqWkWCziOA5BEKCUwjRNhBDMZrP1AHymvhnAtm1GoxHj8RghBEIIxuMxvu+zubmJpmnEcUwYhhiG8dX7pU5BqVQCwLIsoigiDEMqlQoA3W4X27axLIv9/X16vR57e3vJN+AtpXoDYRgynU6Zz+cAFAoF8vn8mwZpzFMBKKVotVq4rkuj0WCxWNBsNun3+wCfn4LZbEY+n8c0TZRSZDIZDg4OkvH/fgoMw+D+/p44jl+c14+mINViJKVkNBqxvb2dfNt938dxHJRSdLtddF3HdV3m8zm9Xo+trS0sy1oxtCzr44vRYDBIVjlN0ygUCskG5LHx1paCxWJBu91OUvDY7bqu43keYRjS6XQIggCA29tbSqUSzWZzPSmIogghRJKCx7XAdV2klAghKJfLyf+VUhiG8e9JwVd7QNd1ptMpURShaRq2bXN3d8discC27RevieOY6XT6vhT4vh8v74yXU/DYhDs7O2iaRhRFPDw8IIQgjmP6/T7FYvHZxhQgiqLYdV39aW1lCm5ubn5frlmWRbVaTSJYKpXY3d1NOl3X9cQsl8tRrVZXzAGur69/W65tLBeurq7+ODw8/FKpVHY2NjZWxt+jOI7nl5eXv56cnPwUBEHv6dhrYRWAuQ7zJ7oH0m0U/0n9CS0Pytp5nRYfAAAAAElFTkSuQmCC`;
        set_cached_file_icon(href, fallback_icon);
        return fallback_icon;
    })

})

// Get Folder Icon
ipcMain.on('get_folder_icon', async (e, href) => {
    let folder_icon = iconManager.get_folder_icon(e, href);
    e.sender.send('set_folder_icon', href, folder_icon);
})

ipcMain.handle('get_symlink_icon', (e) => {
    let symlink_icon = iconManager.get_symlink_icon();
    return symlink_icon;
})

ipcMain.handle('get_readonly_icon', (e) => {
    let readonly_icon = iconManager.get_readonly_icon();
    return readonly_icon;
})



class DeviceManager {

    constructor() {

        this.device_worker = new worker.Worker(path.join(__dirname, '../workers/device_worker.js'));

        // Get Mounts
        ipcMain.on('get_mounts', (e) => {
            this.device_worker.postMessage({ cmd: 'get_mounts' });
        });

        // Get Devices
        ipcMain.on('get_devices', (e) => {
            this.device_worker.postMessage({ cmd: 'get_devices' });
        });

        // Mount ipc
        ipcMain.on('mount', (e, device_name) => {
            this.mount(device_name);
        });

        // Umount ipc
        ipcMain.on('umount', (e, device_name) => {
            this.umount(device_name);
            win.send('umount_done', `${device_name}`);
        });

        // Open connect dialog from renderer
        ipcMain.on('open_connect_dialog', (e) => {
            if (menuManager && typeof menuManager.connect_dialog === 'function') {
                menuManager.connect_dialog();
            }
        });

        // Open connect dialog
        ipcMain.on('connect', (e) => {
            if (menuManager && typeof menuManager.connect_dialog === 'function') {
                menuManager.connect_dialog();
            }
        });

        this.device_worker.on('message', (data) => {
            const cmd = data.cmd;
            switch (cmd) {
                case 'devices':
                    // console.log('devices data', data);
                    win.send('devices', data.devices);
                    break;
                case 'mounts':
                    // console.log('mounts data', data);
                    win.send('mounts', data.mounts);
                    break;
                default:
                    break;
            }
        })

        // Monitor USB Devices
        gio.monitor(data => {
            if (data) {
                console.log('monitor data', data);
                if (data != 'mtp') {
                    this.device_worker.postMessage({ cmd: 'get_mounts' });
                    // this.device_worker.postMessage({ cmd: 'get_devices' });
                }
            }
        });

    }

    // Mount device
    mount(device_name) {

        // this.device_worker.postMessage({ cmd: 'mount', device_path });

        // Note Call this in main process.
        // It will crash if called in a worker thread
        // Mount device
        gio.mount(device_name, (err, res) => {

            if (err) {
                win.send('set_msg', `Error: mounting ${device_name}: ${err}`);
                return;
            }

            // Get mounts after mounting
            gio.get_mounts((err, mounts) => {

                if (err) {
                    win.send('set_msg', `Error: getting mounts after mounting ${device_name}: ${err}`);
                    return;
                }

                // find device path
                let device_path = mounts.filter(mount => mount.name === device_name).map(mount => mount.path)[0];

                // send device path to renderer in mount_done event
                win.send('mount_done', device_path);


            });




        });

    }

    // Umount device
    umount(device_name) {

        // console.log('umount device_path', device_path);/
        // this.device_worker.postMessage({ cmd: 'umount', device_path });

        // Note Call this in main process.
        // It will crash if called in a worker thread
        // Umount device
        gio.umount(device_name, (err) => {
            if (err) {
                win.send('set_msg', `Error: unmounting ${device_name}: ${err}`);
                return;
            }
            win.send('umount_done', `Successfully unmounted ${device_name}`);
            this.device_worker.postMessage({ cmd: 'get_mounts' });
        });

    }

}

class NetworkManager {

    constructor() {

        this.network_settings_arr = []

        ipcMain.handle('connect', async (e, network_settings) => {
            return await this.connect(e, network_settings);
        });

    }

    normalize_server(server) {
        if (!server || typeof server !== 'string') {
            return '';
        }

        return server
            .trim()
            .replace(/^smb:\/\//i, '')
            .replace(/^ssh:\/\//i, '')
            .replace(/^sftp:\/\//i, '')
            .replace(/\/+$/, '');
    }

    connect(e, network_settings = {}) {

        return new Promise((resolve) => {
            const sender = e && e.sender ? e.sender : win;
            const type = (network_settings.type || '').toLowerCase();
            const server = this.normalize_server(network_settings.server);
            const username = (network_settings.username || '').trim();
            const password = network_settings.password || '';
            const use_ssh_key = !!network_settings.use_ssh_key;

            if (!['ssh', 'sshfs', 'smb'].includes(type)) {
                const result = { error: true, msg: 'Unsupported connection type.' };
                sender && sender.send && sender.send('msg_connect', result);
                resolve(result);
                return;
            }

            if (!server) {
                const result = { error: true, msg: 'Server is required.' };
                sender && sender.send && sender.send('msg_connect', result);
                resolve(result);
                return;
            }

            if (!use_ssh_key && !username) {
                const result = { error: true, msg: 'Username is required.' };
                sender && sender.send && sender.send('msg_connect', result);
                resolve(result);
                return;
            }

            if (type === 'smb' && !password) {
                const result = { error: true, msg: 'Password is required for SMB.' };
                sender && sender.send && sender.send('msg_connect', result);
                resolve(result);
                return;
            }

            if ((type === 'ssh' || type === 'sshfs') && !use_ssh_key) {
                const result = { error: true, msg: 'This build currently supports SSH/SSHFS with public key authentication.' };
                sender && sender.send && sender.send('msg_connect', result);
                resolve(result);
                return;
            }

            if (!gio || typeof gio.connect_network_drive !== 'function') {
                const result = { error: true, msg: 'Network drive support is not available in this build.' };
                sender && sender.send && sender.send('msg_connect', result);
                resolve(result);
                return;
            }

            const timeout = setTimeout(() => {
                const result = { error: true, msg: `Connection timed out for ${server}.` };
                sender && sender.send && sender.send('msg_connect', result);
                resolve(result);
            }, 20000);

            try {
                gio.connect_network_drive(
                    server,
                    username,
                    password,
                    use_ssh_key ? 1 : 0,
                    type,
                    (err, data) => {
                        clearTimeout(timeout);

                        if (err) {
                            const result = { error: true, msg: String(err) };
                            sender && sender.send && sender.send('msg_connect', result);
                            resolve(result);
                            return;
                        }

                        if (network_settings.save_connection) {
                            this.setNetworkSettings({
                                ...network_settings,
                                server,
                                type
                            });
                        }

                        deviceManager.device_worker.postMessage({ cmd: 'get_mounts' });
                        const result = { error: false, msg: `Connected to ${server}.` };
                        sender && sender.send && sender.send('msg_connect', result);
                        resolve(result);
                    }
                );
            } catch (err) {
                clearTimeout(timeout);
                const result = { error: true, msg: `Error connecting to ${server}: ${err.message}` };
                sender && sender.send && sender.send('msg_connect', result);
                resolve(result);
            }
        });
    }

    // Save network settings to network.json
    setNetworkSettings(network_settings) {

        if (network_settings.save_connection) {
            try {
                this.network_settings_arr.push(network_settings);
                let network_file = path.join(app.getPath('userData'), 'network.json');
                fs.writeFileSync(network_file, JSON.stringify(this.network_settings_arr, null, 4));
            } catch (err) {
                console.log(err);
            }
        }

    }

    // Get network settings from network.json
    getNetworkSettings() {
        let network_file = path.join(app.getPath('userData'), 'network.json');
        let network_settings = {};
        try {
            network_settings = JSON.parse(fs.readFileSync(network_file, 'utf-8'));
        } catch (err) {
            // fs.copyFileSync(path.join(__dirname, 'assets/config/network.json'), network_file);
            fs.writeFileSync(network_file, JSON.stringify(this.network_settings_arr, null, 4));
            network_settings = JSON.parse(fs.readFileSync(network_file, 'utf-8'));
        }
        return network_settings;
    }

    removeNetworkSettings(href) {

        try {
            let network_file = path.join(app.getPath('userData'), 'network.json');
            let network_settings = JSON.parse(fs.readFileSync(network_file, 'utf-8'));
            let new_network_settings = network_settings.filter(network_setting => network_setting.mount_point.includes(href) === false);
            fs.writeFileSync(network_file, JSON.stringify(new_network_settings, null, 4));
        } catch (err) {
            console.log(err);
        }

    }

    connectNetwork() {
        let cmd = {
            cmd: 'connect_network',
            network_settings: this.getNetworkSettings()
        }
        worker.postMessage(cmd);
    }

}

// file manager listeners ////

// listen for ls event
ipcMain.on('ls', (e, location, add_tab = false) => {

    const sender_window = BrowserWindow.fromWebContents(e.sender);
    const sender_window_id = sender_window ? sender_window.id : null;

    if (location === '' || location === undefined) {
        if (sender_window && !sender_window.isDestroyed()) {
            sender_window.webContents.send('set_msg', 'Location is null or undefined');
        } else {
            win.send('set_msg', 'Location is null or undefined');
        }
        return;
    }

    if (add_tab !== true && add_tab !== false) {
        if (sender_window && !sender_window.isDestroyed()) {
            sender_window.webContents.send('set_msg', 'the add_tab parameter needs to be true or false');
        } else {
            win.send('set_msg', 'the add_tab parameter needs to be true or false');
        }
        return;
    }

    fileManager.get_ls(location, add_tab, sender_window_id, e.sender);

})

// listen for get_recent_files event
ipcMain.on('get_recent_files', (e) => {
    fileManager.get_recent_files(e);
});

ipcMain.handle('autocomplete', async (e, directory) => {

    let autocomplete_arr = [];
    let dir = path.dirname(directory);
    let search = path.basename(directory);

    try {
        await gio.ls(dir, (err, dirents) => {
            if (err) {
                return;
            }
            dirents.forEach(item => {
                if (item.is_dir && item.name.startsWith(search)) {
                    autocomplete_arr.push(item.href + '/');
                }
            })
        })

    } catch (err) {

    }
    return autocomplete_arr;
})

// Validate location input
ipcMain.handle('validate_location', async (e, location) => {
    return fileManager.validate_location(location);
})

/////////////////////////////////////////

class FileManager {

    constructor() {

        this.location = '';
        this.location0 = '';
        this.watcher_failed = 0;
        this.watcher_enabled = true;
        this.startup = true;

        // On first initialization, check settings and load home dir if needed
        const settings = settingsManager.get_settings();
        if (!settings.location || settings.location === '') {
            this.location = utilities.home_dir;
            // Do NOT call get_ls here; delay until win is defined
        }

        // send location to worker
        this.ls_worker = new worker.Worker(path.join(__dirname, '../workers/ls_worker.js'));

        // listen for message from worker
        this.ls_worker.on('message', (data) => {

            const target_window = Number.isInteger(data.window_id) ? BrowserWindow.fromId(data.window_id) : null;
            const target_sender = target_window && !target_window.isDestroyed() ? target_window.webContents : null;

            const cmd = data.cmd;
            switch (cmd) {
                case 'ls_done':

                    // console.log('ls_done')

                    // send ls data to renderer
                    if (target_sender) {
                        target_sender.send('ls_done', data.files_arr, data.add_tab);
                    } else {
                        win.send('ls_done', data.files_arr, data.add_tab);
                    }

                    // watcherManager.watch(this.location);
                    break;
                case 'set_msg':
                    if (target_sender) {
                        target_sender.send('set_msg', data.msg);
                    } else {
                        win.send('set_msg', data.msg);
                    }
                    break;
                default:
                    break;
            }

        });

    }

    validate_location(location) {

        if (location === '' || location === undefined) {
            return -1;
        }

        // check if location is valid
        if (fs.existsSync(location) === false && !location.startsWith('mtp://')) {
            return -2;
        }

        return 0;
    }

    // return file from get_files
    get_ls(location, add_tab, window_id = null, sender = null) {

        const target = sender && !sender.isDestroyed() ? sender : win;

        // console.log('get_ls location', location);

        if (location === '' || location === undefined) {
            if (target && !target.isDestroyed()) {
                target.send('set_msg', 'Location is null or undefined');
            }
            return;
        }

        if (add_tab !== true && add_tab !== false) {
            if (target && !target.isDestroyed()) {
                target.send('set_msg', 'the add_tab parameter needs to be true or false');
            }
            return;
        }

        // Check if special location
        if (location === 'Dashboard') {
            if (target && !target.isDestroyed()) {
                target.send('get_dashboard_view');
            }
            return;
        }

        // check if location is valid
        if (fs.existsSync(location) === false && !location.startsWith('mtp://')) {

            // if the program is starting up, set a valid location (home directory)
            if (this.startup) {
                this.location = utilities.home_dir;
                location = this.location;
            } else {
                this.location = this.location0;
                if (target && !target.isDestroyed()) {
                    target.send('set_msg', `Error: Could not find ${location}`);
                }
                return;
            }
        }

        this.location0 = this.location;
        this.location = location;
        let ls_data = {
            cmd: 'ls',
            location: this.location,
            add_tab: add_tab,
            window_id: window_id
        }

        this.ls_worker.postMessage(ls_data);
        this.startup = false;

        try {
            watcher.watch(this.location);
            if (this.location0 !== '' && this.location0 != this.location) {
                // console.log('location0', this.location0)
                watcher.unwatch(this.location0);
            }
        } catch (err) {

        }

    }

    // get files
    get_files(location, window_id = null) {
        this.location = location
        this.ls_worker.postMessage({
            cmd: 'ls',
            location: location,
            window_id: window_id
        });
    }

    // get recent files by reading xbel file
    get_recent_files(e) {

        let files_arr = get_recent_files_arr();
        e.sender.send('recent_files', files_arr);
        files_arr = [];

        // let files_arr = [];
        // // get config data directory
        // let xbel_file = path.join(utilities.home_dir, '.local/share/', 'recently-used.xbel');
        // if (fs.existsSync(xbel_file)) {
        //     let data = fs.readFileSync(xbel_file, 'utf-8');
        //     const parser = new XMLParser({
        //         ignoreAttributes: false,
        //         attributeNamePrefix: "@_"
        //     });
        //     let res = parser.parse(data);
        //     // console.log('res', res);
        //     res.xbel.bookmark.forEach(b => {
        //         try {
        //             let href = path.normalize(b['@_href'] = b['@_href'].replace('file://', ''));
        //             href = decodeURIComponent(href);
        //             let f = gio.get_file(href);
        //             f.id = btoa(href);
        //             files_arr.push(f);
        //         } catch (err) {
        //             // console.error(err);
        //         }
        //     })
        //     // sort files by mtime
        //     files_arr.sort((a, b) => {
        //         return b.mtime - a.mtime;
        //     });
        //     // send files_arr to renderer
        //     if (files_arr.length > 0) {
        //         e.sender.send('recent_files', files_arr);
        //     }
        //     files_arr = [];
        // }
    }

}

// get recent files by reading xbel file
function get_recent_files_arr() {

    let files_arr = [];
    // get config data directory
    let xbel_file = path.join(utilities.home_dir, '.local/share/', 'recently-used.xbel');
    if (fs.existsSync(xbel_file)) {
        let data = fs.readFileSync(xbel_file, 'utf-8');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        let res = parser.parse(data);

        // sort by recency
        if (res.xbel && res.xbel.bookmark) {

            try {
                res.xbel.bookmark.sort((a, b) => {
                    let a_time = new Date(a['@_modified'] || a['@_added'] || 0).getTime();
                    let b_time = new Date(b['@_modified'] || b['@_added'] || 0).getTime();
                    return b_time - a_time;
                });
            } catch (err) {
                console.log('Error sorting recent files:', err);
            }

        }


        // console.log('res', res);
        if (res.xbel && res.xbel.bookmark && res.xbel.bookmark.length > 0) {
            res.xbel.bookmark.forEach(b => {
                try {
                    let href = path.normalize(b['@_href'] = b['@_href'].replace('file://', ''));
                    href = decodeURIComponent(href);
                    let f = gio.get_file(href);
                    f.id = btoa(href);
                    files_arr.push(f);
                } catch (err) {
                    // console.error(err);
                }
            })
        }
        // // sort files by mtime
        // files_arr.sort((a, b) => {
        //     return b.mtime - a.mtime;
        // });
    }

    return files_arr;
}

ipcMain.handle('get_recent_files_arr', async (e) => {
    return get_recent_files_arr();
})

class PropertiesManager {

    constructor() {

        this.properties_sender = null;

        // setup properties worker
        this.properties_worker = new worker.Worker(path.join(__dirname, '../workers/properties_worker.js'));

        // listen for message from properties worker
        this.properties_worker.on('message', (data) => {
            const target = this.properties_sender && !this.properties_sender.isDestroyed() ? this.properties_sender : win;
            switch (data.cmd) {
                case 'properties':
                    // call send_properties method
                    this.send_properties(data.properties_arr, target);
                    break;
                case 'set_msg':
                    if (target && !target.isDestroyed()) {
                        target.send('set_msg', data.msg);
                    }
                    break;
                default:
                    break;
            }

            this.properties_sender = null;
        });

        // listen for get properties from preload.js
        ipcMain.on('get_properties', (e, selected_files_arr) => {
            this.properties_sender = e.sender;
            this.get_properties(selected_files_arr);
        })

    }

    // get properties
    get_properties(selected_files_arr) {

        let cmd = {
            cmd: 'get_properties',
            selected_files_arr: selected_files_arr
        }
        this.properties_worker.postMessage(cmd);

    }

    // send properties array to renderer
    send_properties(properties_arr, target = null) {
        const destination = target && !target.isDestroyed() ? target : win;
        if (destination && !destination.isDestroyed()) {
            destination.send('properties', properties_arr);
        }
    }

}

class WindowManager {

    constructor() {

        this.windows = [];
        this.window_settings = {};

        // init window settings
        this.window_file = path.join(app.getPath('userData'), 'window.json');
        this.get_window_setting();

        ipcMain.on('get_window_settings', (e) => {
            e.returnValue = this.window_settings;
        });

        ipcMain.on('update_window_settings', (e, window_settings) => {
            this.update_window_settings(window_settings);
        });

    }

    // window settings
    get_window_setting() {
        if (fs.existsSync(this.window_file)) {
            this.window_settings = JSON.parse(fs.readFileSync(this.window_file, 'utf-8'));
        } else {
            this.window_settings = {
                window: {
                    width: 1124,
                    height: 600,
                    x: 0,
                    y: 0
                }
            };
            fs.writeFileSync(this.window_file, JSON.stringify(this.window_settings, null, 4));
        }
    }

    // update window settings
    update_window_settings(window_settings) {
        this.window_settings = window_settings;
        fs.writeFileSync(this.window_file, JSON.stringify(this.window_settings, null, 4));
    }

    // Debounce utility
    debounce = (func, delay) => {

        let timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(func, delay);
        };

    };

    updateBounds = this.debounce(() => {

        const bounds = window.getNormalBounds();
        console.log('bounds updated', bounds.x, bounds.y, bounds.width, bounds.height);

        this.window_settings.window.x = bounds.x;
        this.window_settings.window.y = bounds.y;
        this.window_settings.window.width = bounds.width;
        this.window_settings.window.height = bounds.height;
        this.update_window_settings(this.window_settings);

    }, 250);

    prune_closed_windows() {
        this.windows = this.windows.filter((wnd) => wnd && !wnd.isDestroyed());
    }

    // Create main window
    create_main_window(source_window = null) {

        this.prune_closed_windows();

        let displayToUse = 0;
        let lastActive = BrowserWindow.getFocusedWindow();
        if (!lastActive || lastActive.isDestroyed()) {
            lastActive = source_window && !source_window.isDestroyed() ? source_window : 0;
        }
        let displays = screen.getAllDisplays();

        // Single Display
        if (displays.length === 1) {
            displayToUse = displays[0];
            // Multi Display
        } else {
            // if we have a last active window, use that display for the new window
            if (!displayToUse && lastActive) {
                displayToUse = screen.getDisplayMatching(lastActive.getBounds());
            }

            // fallback to primary display or first display
            if (!displayToUse) {
                displayToUse = screen.getPrimaryDisplay() || displays[3];
            }
        }

        const cascade_offset = 30;
        let next_x = this.window_settings.window.x;
        let next_y = this.window_settings.window.y;

        if (lastActive && !lastActive.isDestroyed()) {
            const source_bounds = lastActive.getBounds();
            next_x = source_bounds.x + cascade_offset;
            next_y = source_bounds.y + cascade_offset;
        } else {
            if (next_x === 0) {
                next_x = displayToUse.bounds.x + 50;
            }

            if (next_y === 0) {
                next_y = displayToUse.bounds.y + 50;
            }
        }

        // Keep new window inside the chosen display when cascading near edges.
        const max_x = displayToUse.bounds.x + Math.max(0, displayToUse.workArea.width - this.window_settings.window.width);
        const max_y = displayToUse.bounds.y + Math.max(0, displayToUse.workArea.height - this.window_settings.window.height);
        next_x = Math.min(Math.max(next_x, displayToUse.bounds.x), max_x);
        next_y = Math.min(Math.max(next_y, displayToUse.bounds.y), max_y);

        let app_icon = path.join(__dirname, '..', 'assets', 'icons', 'icon.png')

        // console.log('app_icon', app_icon);

        let window = new BrowserWindow({
            minWidth: 400,
            minHeight: 400,
            width: this.window_settings.window.width,
            height: this.window_settings.window.height,
            backgroundColor: '#2e2c29',
            x: next_x,
            y: next_y,
            frame: false, // Hide native title bar
            titleBarStyle: 'hidden',
            webPreferences: {
                sandbox: false,
                nodeIntegration: true, // Needed for titlebar.js
                contextIsolation: false, // Needed for titlebar.js
                enableRemoteModule: false,
                nodeIntegrationInWorker: true,
                nativeWindowOpen: true,
                preload: path.join(__dirname, 'preload.js'),
            },
            icon: app_icon
        });

        // hide menu
        window.setMenuBarVisibility(false);

        // window.on('move', this.updateBounds);   // macOS drags
        // window.on('resize', this.updateBounds); // All platforms (fires during Windows drags)

        // listen for window move
        window.on('move', () => {
            const bounds = window.getNormalBounds();
            setTimeout(() => {
                // console.log('window moved', bounds.x, bounds.y);
                this.window_settings.window.x = bounds.x;
                this.window_settings.window.y = bounds.y;
                this.update_window_settings(this.window_settings);
            }, 100);
        })

        // Track resizing
        window.on('resize', () => {
            setTimeout(() => {
                // console.log('window moved', bounds.x, bounds.y);
                // update window settings
                this.window_settings.window.width = window.getBounds().width;
                this.window_settings.window.height = window.getBounds().height;
                this.update_window_settings(this.window_settings);
            }, 100);
        });

        // Debug: Log the resolved path for index.html
        const indexPath = path.resolve('src/renderer/index.html');
        // console.log('Loading index.html from:', indexPath);

        window.loadFile('src/renderer/index.html');
        // window.webContents.openDevTools({ mode: 'detach' });
        this.windows.push(window);

        window.on('closed', () => {
            this.prune_closed_windows();
        });

        return window;
    }

    open_new_window(location = '', source_window = null) {

        const newWindow = this.create_main_window(source_window);

        const requested_location = typeof location === 'string' ? location.trim() : '';
        if (!requested_location) {
            return newWindow;
        }

        newWindow.webContents.once('did-finish-load', () => {
            if (!newWindow.isDestroyed()) {
                newWindow.webContents.send('get_files', requested_location);
            }
        });

        return newWindow;
    }

}

class DialogManager {

    constructor() {



    }

    dialog(data) {

        let bounds = win.getBounds()

        let x = bounds.x + parseInt((bounds.width - 400) / 2);
        let y = bounds.y + parseInt((bounds.height - 350) / 2);

        let dialog = new BrowserWindow({
            width: data.width,
            height: data.height,
            backgroundColor: data.backgroundColor,
            x: x,
            y: y,
            frame: true,
            webPreferences: {
                preload: path.join(__dirname, '..', 'renderer', 'dialogs', 'scripts', data.preload),
            },
        })

        dialog.loadFile(path.join(__dirname, '..', 'renderer', 'dialogs', data.load_file));
        // dialog.webContents.openDevTools()
        return dialog;
    }

}

class MenuManager {

    constructor() {

        this.settings = settingsManager.get_settings();
        if (!this.settings) {
            this.settings = {
                sort_by: 'mtime',
                sort_direction: 'desc'
            }
        }

        // // init sort
        // if (this.settings.sort_by === undefined || this.settings.sort_by === '') {
        //     this.settings.sort_by = 'mtime';
        // }
        // if (this.settings.sort_direction === undefined || this.settings.sort_direction === '') {
        //     this.settings.sort_direction = 'desc';
        // }

        // for template creation
        this.paste_worker = new worker.Worker(path.join(__dirname, '../workers/paste_worker.js'));
        this.paste_worker.on('message', (data) => {
            switch (data.cmd) {
                case 'cp_template_done':
                    let f = gio.get_file(data.destination);
                    f.id = btoa(data.destination);
                    win.send('get_item', f);
                    win.send('edit_item', f);
                    break;
            }
        });

        this.copy_arr = [];
        // populate copy_arr from renderer for menu
        ipcMain.on('set_copy_arr', (e, copy_arr) => {
            this.copy_arr = copy_arr;
        })

        // get template folder
        ipcMain.handle('get_templates_folder', (e) => {
            return path.join(utilities.home_dir, 'Templates');
        })

        // sidebar menu
        ipcMain.on('home_menu', (e, location) => {
            this.home_menu(e, location);
        })

        // Main Menu
        this.main_menu = null;
        ipcMain.on('main_menu', (e, destination) => {

            // Always refresh settings snapshot before building menu state.
            this.settings = settingsManager.get_settings() || {};
            const current_view = this.get_current_view();

            utilities.set_is_main(true);

            const template = [
                // {
                //     label: 'New Window',
                //     click: () => {
                //         windowManager.createWindow();
                //     }
                // },
                // {
                //     type: 'separator'
                // },
                {
                    id: 'new_folder',
                    label: 'New Folder',
                    click: () => {
                        // utilities.mkdir(e, destination);
                        win.send('context-menu-command', 'mkdir');
                    }
                },
                {
                    label: 'New Tab',
                    click: () => {
                        fileManager.get_ls(destination, true);
                    }
                },
                {
                    id: 'templates',
                    label: 'New Document',
                    submenu: [
                        {
                            label: 'Open Templates Folder',
                            click: () => {
                                e.sender.send('context-menu-command', 'open_templates'),
                                // fileManager.get_files(path.join(utilities.home_dir, 'Templates'));
                                {
                                    type: 'separator'
                                }
                            }
                        }],
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Sort',
                    id: 'sort_menu',
                    submenu: this.sort_menu()
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Add to workspace',
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.AddWorkspace : settings.keyboard_shortcuts.AddWorkspace,
                    click: () => {
                        e.sender.send('context-menu-command', 'add_workspace');
                    },
                },
                {
                    type: 'separator'
                },
                {
                    label: 'View',
                    submenu: [
                        {
                            type: 'radio',
                            label: 'Grid',
                            checked: current_view === 'grid_view',
                            click: (e) => {
                                this.set_current_view('grid_view');
                                win.send('switch_view', 'grid_view')
                            }
                        },
                        {
                            type: 'radio',
                            label: 'List',
                            checked: current_view === 'list_view',
                            click: () => {
                                this.set_current_view('list_view');
                                win.send('switch_view', 'list_view')
                            }
                        },
                    ]
                },
                {
                    type: 'separator'
                },
                {
                    id: 'paste',
                    label: 'Paste',
                    click: () => {
                        e.sender.send('context-menu-command', 'paste')
                    }
                },
                {
                    label: 'Select all',
                    click: () => {
                        // e.sender.send('select_all');
                        e.sender.send('context-menu-command', 'select_all')
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Terminal',
                    click: () => {
                        exec(`gnome-terminal --working-directory="${destination}"`);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    type: 'separator'
                },
                // {
                //     label: 'Show Hidden',
                //     // icon: path.join(__dirname, 'assets/icons/menu/eye.png'),
                //     checked: false,
                //     click: (e) => {
                //         // e.sender.send('context-menu-command', 'show_hidden')
                //         win.send('toggle_hidden');
                //     }
                // },
                // {
                //     type: 'separator'
                // },
                {
                    label: 'Disk Usage Analyzer',
                    // icon: path.join(__dirname, 'assets/icons/menu/diskusage.png'),
                    click: () => {
                        exec(`baobab '${destination}'`);
                        win.send('clear_highlight');
                    }

                },
                {
                    type: 'separator'
                },
                {
                    label: 'Properties',
                    // icon: path.join(__dirname, 'assets/icons/menu/properties.png'),
                    // accelerator: process.platform == 'darwin' ? settings.keyboard_shortcuts.Properties : settings.keyboard_shortcuts.Properties,
                    click: () => {
                        e.sender.send('context-menu-command', 'properties')
                    }
                },
            ]

            // Create menu
            this.main_menu = Menu.buildFromTemplate(template)

            // disable paste menu if no items in the copy_arr
            this.enable_paste_menu(this.main_menu);

            let sort_menu_item = this.main_menu.getMenuItemById('sort_menu');
            let sort_submenu_items = sort_menu_item.submenu.items
            for (const item of sort_submenu_items) {
                if (item.id == this.sort) {
                    item.checked = true;
                }
            }

            if (!this.can_write_to_location(destination)) {
                // disable new folder
                this.main_menu.getMenuItemById('new_folder').enabled = false;
                this.main_menu.getMenuItemById('templates').enabled = false;
            }

            // Add templates
            this.add_templates_menu(this.main_menu, destination)

            // Show menu
            this.main_menu.popup(BrowserWindow.fromWebContents(e.sender))

        })

        // Folders Menu
        ipcMain.on('folder_menu', (e, f) => {

            const template = [
                {
                    label: 'Open with Code',
                    click: () => {
                        exec(`cd "${f.href}"; code .`, (err) => {
                            win.send('clear_highlight');
                            if (err) {
                                return;
                            }
                        })
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'New Window',
                    click: () => {
                        windowManager.open_new_window(f.href);
                    }
                },
                {
                    label: 'New Tab',
                    click: () => {

                        fileManager.get_ls(f.href, true);
                        // fileManager.get_files(f.href);
                        // ls_worker.postMessage({ cmd: 'ls', source: f.href, tab: 1 });
                    }
                },
                {
                    id: 'launchers',
                    label: 'Open with',
                    submenu: []
                },
                {
                    type: 'separator'
                },
                {
                    type: 'separator'
                },
                {
                    id: 'sort_menu',
                    label: 'Sort',
                    submenu: this.sort_menu()
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Add to workspace',
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.AddWorkspace : settings.keyboard_shortcuts.AddWorkspace,
                    click: () => {
                        e.sender.send('context-menu-command', 'add_workspace');
                    },
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Cut',
                    // icon: path.join(__dirname, 'assets/icons/menu/cut.png'),
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Cut : settings.keyboard_shortcuts.Cut,
                    click: () => {
                        e.sender.send('context-menu-command', 'cut')
                    }
                },
                {
                    label: 'Copy',
                    // icon: path.join(__dirname, 'assets/icons/menu/copy.png'),
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Copy : settings.keyboard_shortcuts.Copy,
                    click: () => {
                        e.sender.send('context-menu-command', 'copy')
                    }
                },
                {
                    label: '&Rename',
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Rename : settings.keyboard_shortcuts.Rename,
                    click: () => {
                        e.sender.send('context-menu-command', 'rename')
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Compress',
                    // icon: path.join(__dirname, 'assets/icons/menu/extract.png'),
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Compress : settings.keyboard_shortcuts.Compress,
                    submenu: [
                        {
                            label: 'tar.gz',
                            click: () => {
                                e.sender.send('context-menu-command', 'compress_gz')
                            }
                        },
                        {
                            label: 'tar.xz',
                            click: () => {
                                e.sender.send('context-menu-command', 'compress_xz')
                            }
                        },
                        {
                            label: 'zip',
                            click: () => {
                                e.sender.send('context-menu-command', 'compress_zip')
                            }
                        },
                    ]
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Delete Permanently',
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Delete : settings.keyboard_shortcuts.Delete,
                    click: () => {
                        // e.sender.send('context-menu-command', 'delete_folder')
                        e.sender.send('context-menu-command', 'delete')
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Open in terminal',
                    click: () => {
                        e.sender.send('context-menu-command', 'terminal');
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Disk Usage Analyzer',
                    // icon: path.join(__dirname, 'assets/icons/menu/diskusage.png'),
                    click: () => {
                        exec(`baobab '${f.href}'`);
                        win.send('clear_highlight');
                    }

                },
                {
                    type: 'separator'
                },
                {
                    label: 'Properties',
                    // icon: path.join(__dirname, 'assets/icons/menu/properties.png'),
                    // accelerator: process.platform == 'darwin' ? settings.keyboard_shortcuts.Properties : settings.keyboard_shortcuts.Properties,
                    click: () => {
                        e.sender.send('context-menu-command', 'properties')
                    }
                },

            ]

            const menu = Menu.buildFromTemplate(template);

            // Handle Sort Menu
            let sort_menu_item = menu.getMenuItemById('sort_menu');
            let sort_submenu_items = sort_menu_item.submenu.items
            for (const item of sort_submenu_items) {
                if (item.id == this.sort) {
                    item.checked = true;
                }
            }

            // ADD LAUNCHER MENU
            this.add_launcher_menu(menu, e, f)

            // ADD LAUNCHER MENU
            //   add_launcher_menu(menu1, e, args);
            menu.popup(BrowserWindow.fromWebContents(e.sender));

            // menu.on('menu-will-close', () => {
            //     e.sender.send('clear_selection');
            // });

        })

        // Files Menu
        ipcMain.on('file_menu', (e, f) => {

            // const template = [
            let files_menu_template = [
                {
                    id: 'launchers',
                    label: 'Open with',
                    submenu: []
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Add to workspace',
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.AddWorkspace : settings.keyboard_shortcuts.AddWorkspace,
                    click: () => {
                        e.sender.send('context-menu-command', 'add_workspace')
                    }
                },
                {
                    type: 'separator'
                },
                {
                    id: 'sort_menu',
                    label: 'Sort',
                    submenu: this.sort_menu()
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Cut',
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Cut : settings.keyboard_shortcuts.Cut,
                    click: () => {
                        e.sender.send('context-menu-command', 'cut')
                    }
                },
                {
                    label: 'Copy',
                    // icon: path.join(__dirname, 'assets/icons/menu/copy.png'),
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Copy : settings.keyboard_shortcuts.Copy,
                    click: () => {
                        e.sender.send('context-menu-command', 'copy')
                    }
                },
                {
                    label: '&Rename',
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Rename : settings.keyboard_shortcuts.Rename,
                    click: () => { e.sender.send('context-menu-command', 'rename') }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Compress',
                    // icon: path.join(__dirname, 'assets/icons/menu/extract.png'),
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Compress : settings.keyboard_shortcuts.Compress,
                    submenu: [
                        {
                            label: 'tar.gz',
                            click: () => {
                                e.sender.send('context-menu-command', 'compress_gz')
                            }
                        },
                        {
                            label: 'tar.xz',
                            click: () => {
                                e.sender.send('context-menu-command', 'compress_xz')
                            }
                        },
                        {
                            label: 'zip',
                            click: () => {
                                e.sender.send('context-menu-command', 'compress_zip')
                            }
                        },
                    ]
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Delete Permanently',
                    // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Delete : settings.keyboard_shortcuts.Delete,
                    click: () => {
                        e.sender.send('context-menu-command', 'delete')
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Properties',
                    // icon: path.join(__dirname, 'assets/icons/menu/properties.png'),
                    // accelerator: process.platform == 'darwin' ? settings.keyboard_shortcuts.Properties : settings.keyboard_shortcuts.Properties,
                    click: () => {
                        e.sender.send('context-menu-command', 'properties')
                    }
                },
            ]

            let menu = Menu.buildFromTemplate(files_menu_template)

            // Handle Sort Menu
            let sort_menu_item = menu.getMenuItemById('sort_menu');
            let sort_submenu_items = sort_menu_item.submenu.items
            for (const item of sort_submenu_items) {
                if (item.id == this.sort) {
                    item.checked = true;
                }
            }

            // ADD LAUNCHER MENU
            this.add_launcher_menu(menu, e, f)

            // Run as program
            // if (args.access) {
            // add_execute_menu(menu, e, args)
            // }

            // Handle Audio conversion
            let ext = path.extname(f.href);
            if (ext == '.mp4' || ext == '.mp3') {
                this.convert_audio_menu(menu, f.href);
            }

            if (
                ext == '.xz'
                || ext == '.gz'
                || ext == '.zip'
                || ext == '.img'
                || ext == '.tar'
                || ext == '.7z'
            ) {
                this.extract_menu(menu, e);
            }

            menu.popup(BrowserWindow.fromWebContents(e.sender))

            // menu.on('menu-will-close', (e) => {
            //     e.sender.send('clear_selection');
            // });

        })

        // Devices Menu
        ipcMain.on('device_menu', (e, href, uuid) => {

            let settings = settingsManager.get_settings();

            let device_menu_template = [
                {
                    label: 'Connect',
                    click: () => {
                        this.connect_dialog()
                    }
                },
                {
                    label: 'Unmount',
                    click: () => {

                        deviceManager.umount(href);

                        // execSync(`gio mount -u ${href}`);
                        // win.send('msg', `Device Unmounted`);
                        // win.send('umount_device');
                    }
                },
                {
                    type: 'separator',
                },
                {
                    label: 'Disks',
                    click: () => {
                        let cmd = settings['disk_utility']
                        exec(cmd, (err) => {
                            if (err) {
                                win.send('msg', 'Error: ' + err.message);
                            }

                            win.send('clear_highlight');

                        });
                    }
                }
                // {
                //     label: 'Properties',
                //     accelerator: process.platform == 'darwin' ? settings.keyboard_shortcuts.Properties : settings.keyboard_shortcuts.Properties,
                //     click: () => {
                //         e.sender.send('context-menu-command', 'properties')
                //     }
                // },
            ]

            let menu = Menu.buildFromTemplate(device_menu_template)
            menu.popup(BrowserWindow.fromWebContents(e.sender))

        })

        // Workspace Menu
        ipcMain.on('workspace_menu', (e, file) => {

            let workspace_menu_template = [
                {
                    label: 'Rename',
                    click: () => {
                        win.send('edit_workspace', file.href);
                    }
                },
                {
                    type: 'separator',
                },
                {
                    label: 'Remove From Workspace',
                    click: () => {
                        win.send('remove_workspace', file.href);
                    }
                },
                {
                    label: 'Open Location',
                    click: () => {
                        win.send('get_files', path.dirname(file.href))
                    }
                }
            ]

            let menu = Menu.buildFromTemplate(workspace_menu_template)

            // ADD TEMPLATES
            // add_templates_menu(menu, e, args)

            // ADD LAUNCHER MENU
            // add_launcher_menu(menu, e, args.apps)
            menu.popup(BrowserWindow.fromWebContents(e.sender))

            menu.on('menu-will-close', () => {
                win.send('clear_items');
            });

        })

        // ipcMain.on('sort', (e, sort_by) => {
        //     this.sort = sort_by
        // })

        ipcMain.on('columns_menu', (e) => {
            const menu_template = [
                {
                    label: 'Columns',
                    click: () => {
                        this.columns_dialog();
                    }
                }
            ]
            const menu = Menu.buildFromTemplate(menu_template)
            menu.popup(BrowserWindow.fromWebContents(e.sender))
        })

    }

    get_current_view() {
        const settings = this.settings || {};
        const schema_view = settings?.schema?.properties?.['Default View']?.properties?.View?.default;
        if (schema_view === 'grid_view' || schema_view === 'list_view') {
            return schema_view;
        }
        if (settings.view === 'grid_view' || settings.view === 'list_view') {
            return settings.view;
        }
        return 'list_view';
    }

    set_current_view(view) {
        if (view !== 'grid_view' && view !== 'list_view') {
            return;
        }

        this.settings = settingsManager.get_settings() || {};
        this.settings.view = view;

        if (this.settings?.schema?.properties?.['Default View']?.properties?.View) {
            this.settings.schema.properties['Default View'].properties.View.default = view;
        }

        settingsManager.updateSettings(this.settings);
    }

    can_write_to_location(location) {
        if (!location) {
            return false;
        }

        try {
            fs.accessSync(location, fs.constants.W_OK);
            return true;
        } catch (err) {
        }

        try {
            const f = gio.get_file(location);
            return !!(f && f.is_writable);
        } catch (err) {
            return false;
        }
    }

    // Sidebar Menu
    home_menu(e, location) {

        let template = [
            {
                label: 'Open in New Tab',
                click: () => {
                    win.send('get_files', location);
                }
            },
            {
                label: 'Open in New Window',
                click: () => {
                    windowManager.open_new_window(location);
                }
            }
        ]

        let menu = Menu.buildFromTemplate(template)
        menu.popup(BrowserWindow.fromWebContents(e.sender))

    }


    connect_dialog() {

        let bounds = win.getBounds()

        let x = bounds.x + parseInt((bounds.width - 400) / 2);
        let y = bounds.y + parseInt((bounds.height - 350) / 2);

        let dialog_properties = {
            width: 400,
            height: 475,
            backgroundColor: '#2e2c29',
            preload: 'connect.js',
            load_file: 'connect.html'
        }

        const connect_win = dialogManager.dialog(dialog_properties);

        // show dialog
        connect_win.once('ready-to-show', () => {
            let title = 'Connect to Server'
            connect_win.title = title
            connect_win.removeMenu()
            connect_win.send('connect')
        })

    }

    columns_dialog() {

        const dialog_properties = {
            width: 400,
            height: 350,
            backgroundColor: '#2e2c29',
            preload: 'columns.js',
            load_file: 'columns.html'
        }
        const dialog = dialogManager.dialog(dialog_properties);

        // let bounds = win.getBounds()
        // let x = bounds.x + parseInt((bounds.width - 400) / 2);
        // let y = bounds.y + parseInt((bounds.height - 350) / 2);

        // let dialog = new BrowserWindow({
        //     // parent: window.getFocusedWindow(),
        //     width: 400,
        //     height: 350,
        //     backgroundColor: '#2e2c29',
        //     x: x,
        //     y: y,
        //     frame: true,
        //     webPreferences: {
        //         // nodeIntegration: false, // is default value after Electron v5
        //         // contextIsolation: true, // protect against prototype pollution
        //         // enableRemoteModule: false, // turn off remote
        //         // nodeIntegrationInWorker: true,
        //         // nativeWindowOpen: true,
        //         // sandbox: true,
        //         preload: path.join(__dirname, 'preload.js'),
        //     },
        // })

        // dialog.loadFile(path.join(__dirname, '..', 'renderer', 'dialogs', 'columns.html'))
        // dialog.webContents.openDevTools()

        // SHOW DIALG
        dialog.once('ready-to-show', () => {
            dialog.removeMenu()
            dialog.send('columns');
        })

    }

    // Add Launcher Menu
    add_launcher_menu(menu, e, f) {

        // Populate Open With Menu
        let launchers = gio.open_with(f.href);
        launchers.sort((a, b) => {
            return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase());
        })

        let launcher_menu = menu.getMenuItemById('launchers')
        try {
            for (let i = 0; i < launchers.length; i++) {
                launcher_menu.submenu.append(new MenuItem({
                    label: launchers[i].name,
                    click: () => {

                        // Set Default Application
                        let set_default_launcher_cmd = `xdg-mime default ${path.basename(launchers[i].appid)} ${launchers[i].mimetype}`;

                        execSync(set_default_launcher_cmd);

                        let cmd = launchers[i].cmd.toLocaleLowerCase().replace(/%u|%f/g, `'${f.href}'`);
                        exec(cmd);

                        // shell.openPath(file.href);
                        win.send('clear_highlight');

                    }
                }))
            }
            launcher_menu.submenu.append(new MenuItem({
                type: 'separator'
            }))

        } catch (err) {
            console.log(err)
        }
    }

    // Add Extract Menu
    extract_menu(menu, e) {

        let menu_item = new MenuItem(
            {
                label: '&Extract',
                // accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Extract : settings.keyboard_shortcuts.Extract,
                click: () => {
                    e.sender.send('context-menu-command', 'extract')
                }
            }
        )
        menu.insert(15, menu_item)
    }

    // Add Convert Audio Menu
    convert_audio_menu(menu, href) {

        menu.append(new MenuItem({
            label: 'Audio / Video',
            submenu: [
                {
                    label: 'Convert to Mp3',
                    click: () => {
                        let filename = href.substring(0, href.length - path.extname(href).length) + '.mp3'
                        let cmd = 'ffmpeg -i ' + href + ' ' + filename;
                        exec(cmd, (err, stdout, stderr) => {
                            if (err) {
                                win.send('notification', err);
                            } else {
                                let options = {
                                    id: 0,
                                    href: filename,
                                    linktext: path.basename(filename),
                                    is_folder: false,
                                    grid: ''
                                }
                                win.send('add_card', options)
                            }
                        })

                        cmd = 'ffprobe -i ' + href + ' -show_entries format=size -v quiet -of csv="p=0"'
                        exec(cmd, (err, stdout, stderr) => {
                            if (err) {
                                win.send('notification', err)
                            } else {
                                win.send('progress', parseInt(stdout))
                            }
                        })

                    },
                },
                {
                    label: 'Convert to Ogg Vorbis',
                    click: () => {
                        let filename = href.substring(0, href.length - path.extname(href).length) + '.ogg'
                        let cmd = 'ffmpeg -i ' + href + ' -c:a libvorbis -q:a 4 ' + filename;

                        exec(cmd, (err, stdout, stderr) => {
                            if (err) {
                                win.send('notification', err);
                            } else {
                                let options = {
                                    id: 0,
                                    href: filename,
                                    linktext: path.basename(filename),
                                    is_folder: false,
                                    grid: ''
                                }
                                win.send('add_card', options)
                            }
                        })

                        cmd = 'ffprobe -i ' + href + ' -show_entries format=size -v quiet -of csv="p=0"'
                        exec(cmd, (err, stdout, stderr) => {
                            if (err) {
                                win.send('notification', err)
                            } else {
                                win.send('progress', parseInt(stdout))
                            }
                        })
                    }
                },
            ]

        }))

    }

    enable_paste_menu(menu) {
        if (this.copy_arr.length > 0) {
            menu.getMenuItemById('paste').enabled = true;
        } else {
            menu.getMenuItemById('paste').enabled = false;
        }
    }

    // Templated Menu
    add_templates_menu(menu, location) {
        let template_menu = menu.getMenuItemById('templates');
        let templates = fs.readdirSync(path.join(utilities.home_dir, 'Templates'));
        templates.forEach((file, idx) => {
            let source = path.join(utilities.home_dir, 'Templates', file);
            let destination = path.format({ dir: location, base: file });
            template_menu.submenu.append(new MenuItem({
                label: file.replace(path.extname(file), ''),
                click: () => {
                    this.create_file_from_template(source, destination);
                }
            }));
        })
    }

    create_file_from_template(source, destination) {
        this.paste_worker.postMessage({ cmd: 'cp_template', source: source, destination: destination });
        win.send('set_msg', `Creating file from template ${source} to ${destination}`);
    }

    sort_menu() {

        let submenu = [
            {
                label: 'Last Modified',
                type: 'radio',
                id: 'mtime_desc',
                click: () => {
                    this.settings.sort_by = 'mtime';
                    this.settings.sort_direction = 'desc';
                    win.send('sort_by', this.settings.sort_by, this.settings.sort_direction);
                    settingsManager.updateSettings(this.settings);
                }
            },
            {
                label: 'First Modified',
                type: 'radio',
                id: 'mtime_asc',
                click: () => {
                    this.settings.sort_by = 'mtime';
                    this.settings.sort_direction = 'asc';
                    win.send('sort_by', this.settings.sort_by, this.settings.sort_direction);
                    settingsManager.updateSettings(this.settings);
                }
            },
            {
                label: 'A-Z',
                type: 'radio',
                id: 'name_asc',
                click: () => {
                    this.settings.sort_by = 'name';
                    this.settings.sort_direction = 'asc';
                    win.send('sort_by', this.settings.sort_by, this.settings.sort_direction);
                    settingsManager.updateSettings(this.settings);
                }
            },
            {
                label: 'Z-A',
                type: 'radio',
                id: 'name_desc',
                click: () => {
                    this.settings.sort_by = 'name';
                    this.settings.sort_direction = 'desc';
                    win.send('sort_by', this.settings.sort_by, this.settings.sort_direction);
                    settingsManager.updateSettings(this.settings);
                }
            },
            {
                label: 'Size',
                type: 'radio',
                id: 'size',
                click: () => {
                    this.settings.sort_by = 'size';
                    this.settings.sort_direction = 'desc' ? 'asc' : 'desc';
                    win.send('sort_by', this.settings.sort_by, this.settings.sort_direction);
                    settingsManager.updateSettings(this.settings);
                }
            },
            {
                label: 'Type',
                type: 'radio',
                id: 'type',
                click: () => {
                    this.settings.sort_by = 'type';
                    this.settings.sort_direction = 'desc' ? 'asc' : 'desc';
                    win.send('sort_by', this.settings.sort_by, this.settings.sort_direction);
                    settingsManager.updateSettings(this.settings);
                }
            }
        ]

        // select radio button by sort and sort_direction
        for (const item of submenu) {

            if (item.id === this.settings.sort_by && item.id === 'size') {
                item.checked = true;
            }

            if (item.id === this.settings.sort_by && item.id === 'type') {
                item.checked = true;
            }

            if (item.id == `${this.settings.sort_by}_${this.settings.sort_direction}`) {
                item.checked = true;
                break;
            }

        }

        return submenu;

    }

}

const settingsManager = new SettingsManager();
// Only initialize settings if settings.json does not exist
if (!fs.existsSync(settingsManager.settings_file)) {
    settingsManager.initialize_settings();
    is_first_run = 1;
}

const watcherManager = new Watcher();
const windowManager = new WindowManager();
const utilities = new Utilities();
const fileManager = new FileManager();
const propertiesManager = new PropertiesManager();
const workspaceManager = new WorkspaceManager();
const deviceManager = new DeviceManager();
const networkManager = new NetworkManager();
const dialogManager = new DialogManager();
const menuManager = new MenuManager();
const watcher = new Watcher();

// Create main window
let win;
app.on('ready', () => {
    const get_sender_window = (event) => {
        const sender_window = BrowserWindow.fromWebContents(event.sender);
        if (!sender_window || sender_window.isDestroyed()) {
            return null;
        }
        return sender_window;
    };

    ipcMain.on('window-minimize', (event) => {
        const sender_window = get_sender_window(event);
        if (sender_window) {
            sender_window.minimize();
        }
    });

    ipcMain.on('window-maximize', (event) => {
        const sender_window = get_sender_window(event);
        if (!sender_window) {
            return;
        }

        if (sender_window.isMaximized()) {
            sender_window.unmaximize();
        } else {
            sender_window.maximize();
        }
    });

    ipcMain.on('window-close', (event) => {
        const sender_window = get_sender_window(event);
        if (sender_window) {
            sender_window.close();
        }
    });

    ipcMain.on('toggle-devtools', (event) => {
        const sender_window = get_sender_window(event);
        if (!sender_window) {
            return;
        }

        if (sender_window.webContents.isDevToolsOpened()) {
            sender_window.webContents.closeDevTools();
        } else {
            sender_window.webContents.openDevTools({ mode: 'detach' });
        }
    });

    ipcMain.on('toggle-fullscreen', (event) => {
        const sender_window = get_sender_window(event);
        if (sender_window) {
            sender_window.setFullScreen(!sender_window.isFullScreen());
        }
    });

    // Register get_app_versions handler
    ipcMain.handle('get_app_versions', () => {
        return {
            appVersion: packageJson.version,
            electronVersion: process.versions.electron,
            appName: packageJson.name,
            appDescription: packageJson.description
        };
    });

    // create main window
    win = windowManager.create_main_window();

    // After win is defined, trigger initial file load if needed
    const settings = settingsManager.get_settings();
    if (is_first_run == 1 || !settings.location || settings.location === '') {

        // fileManager.location = utilities.home_dir;
        fileManager.get_ls(fileManager.location || utilities.home_dir, true);
        is_first_run = 0;

        console.log('running get_ls', fileManager.location);

    }

    process.on('uncaughtException', (err) => {
        win.send('set_msg', err.message);
    });

    // listen for window close
    ipcMain.on('close-window', (event, data) => {
        windowManager.windows.forEach(window => {
            window.close();
        });
    });

    // listen for window reload
    ipcMain.on('reload', (event) => {
        const sender_window = BrowserWindow.fromWebContents(event.sender);
        if (sender_window && !sender_window.isDestroyed()) {
            sender_window.reload();
            return;
        }

        if (win && !win.isDestroyed()) {
            win.reload();
        }
    });

    ipcMain.on('new-window', (event, location) => {
        const sender_window = BrowserWindow.fromWebContents(event.sender);
        windowManager.open_new_window(location, sender_window);
    });

    // Start native file drag so files can be dropped into external applications.
    ipcMain.on('start_drag_external', (event, filePath) => {
        if (process.platform === 'linux') {
            return;
        }

        if (!filePath || typeof filePath !== 'string') {
            return;
        }

        if (!fs.existsSync(filePath)) {
            return;
        }

        const iconCandidates = [
            path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
            path.join(__dirname, '..', 'renderer', 'icons', 'file.png')
        ];

        let dragIcon = null;
        for (const iconPath of iconCandidates) {
            if (!fs.existsSync(iconPath)) {
                continue;
            }

            const img = nativeImage.createFromPath(iconPath);
            if (!img.isEmpty()) {
                dragIcon = img;
                break;
            }
        }

        if (!dragIcon) {
            return;
        }

        try {
            event.sender.startDrag({
                file: filePath,
                icon: dragIcon
            });
        } catch (err) {
            console.error('start_drag_external failed:', err);
        }
    });

    // win.on('resize', () => {
    //     let bounds = win.getBounds();
    //     console.log('window resized', bounds);
    // });

    iconManager.start_theme_watcher(() => {
        file_icon_cache.clear();
        BrowserWindow.getAllWindows().forEach((window) => {
            if (!window.isDestroyed()) {
                window.webContents.send('icon_theme_changed');
            }
        });
    });

});

app.on('before-quit', () => {
    iconManager.stop_theme_watcher();
});

app.whenReady().then(() => {
    // const tray = new Tray(path.join(__dirname, "../assets/icons/icon.png"));
    // tray.setToolTip("File Manager");



})

// init
function init() {

    // check if .config directory exists


    // const settingsManager = new SettingsManager();
    // const windowManager = new WindowManager();
    // const utilities = new Utilities();
    // const fileManager = new FileManager();
    // const workspaceManager = new WorkspaceManager();
    // const deviceManager = new DeviceManager();
    // const dialogManager = new DialogManager();
    // const menuManager = new MenuManager();
}




// let mainWindow;
// app.on('ready', () => {
//     mainWindow = new BrowserWindow({
//         width: 800,
//         height: 600,
//         webPreferences: {
//         nodeIntegration: true,
//         },
//     });

//     mainWindow.loadFile('src/renderer/index.html');
// });
