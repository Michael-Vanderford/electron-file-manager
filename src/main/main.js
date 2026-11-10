// @ts-nocheck

const { JsonStore } = require('./lib/JsonStore');
const { merge, object } = require('../common/settings_patch');
const { OperationQueue } = require('./lib/OperationQueue');
const { path_id } = require('../common/path_id');

// Provide app and Electron version to renderer
const { app, Tray, BrowserWindow, ipcMain: nativeIpcMain, shell, screen, dialog, Menu, MenuItem, nativeImage, nativeTheme, webContents, safeStorage } = require('electron');
const packageJson = require('../../package.json');
const window = require('electron').BrowserWindow;
const worker = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { run_configured, launch_desktop } = require('../common/process_tools');
const execFile = require('child_process').execFile;
const os = require('os');
const libfs = require('../common/libfs');
const dnd = require('../common/dnd');
const safe_replace = require('../common/safe_replace');
const { archive_destination } = require('../common/create_archive');
const { pathToFileURL } = require('url');
const { secureIpc } = require('./lib/SecureIpc');
const { secureWindow } = require('./lib/WindowSecurity');
const ipcMain = secureIpc(nativeIpcMain, path.join(__dirname, '../renderer'));
const { probe: device_probe } = require('../common/device_probe');
const iconManager = require('./lib/IconManager');
const { XMLParser } = require('fast-xml-parser');
// const gio = require('libgio-node');

const FILE_ICON_CACHE = new Map();
const MAX_FILE_ICON_CACHE_ENTRIES = 2000;
const MAX_FOLDER_SIZE_CACHE_ENTRIES = 1000;
const FOLDER_SIZE_CACHE_TTL_MS = 5 * 60 * 1000;

// Packaged Electron executables always enter this file, including decoder children.
if (process.argv.includes('--thumbnail-worker')) {
    require('../workers/thumbnail_worker');
    return;
}

if (process.argv.includes('--recent-worker')) {
    require('../workers/recent_worker');
    return;
}

if (process.env.TEST_PROFILE_DIR) {
  const profile = path.resolve(process.env.TEST_PROFILE_DIR);

  fs.mkdirSync(profile, { recursive: true });

  app.setPath('userData', profile);
  app.setPath('sessionData', profile);
}

if (!app.isPackaged) require('../../scripts/build-preloads').buildPreloads();

const replacement_journals = path.join(app.getPath('userData'), 'replacement-journals');

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

function normalize_theme_preference(value) {
    const preference = String(value || 'system').toLowerCase();
    return ['dark', 'light', 'system', 'modern-dark', 'modern-light'].includes(preference) ? preference : 'system';
}

function get_theme_preference(settings = settingsManager?.get_settings?.()) {
    return normalize_theme_preference(settings?.schema?.properties?.['Default View']?.properties?.Theme?.default);
}

function should_use_dark_system_theme() {
    if (process.platform !== 'linux') {
        return nativeTheme.shouldUseDarkColors;
    }

    try {
        const color_scheme = execSync(
            'gsettings get org.gnome.desktop.interface color-scheme',
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        ).trim().replace(/^'|'$/g, '');

        if (color_scheme === 'prefer-dark') {
            return true;
        }
        if (color_scheme === 'prefer-light') {
            return false;
        }
    } catch (err) {
    }

    return nativeTheme.shouldUseDarkColors;
}

function send_theme_to_window(browser_window) {
    if (!browser_window || browser_window.isDestroyed()) {
        return;
    }

    const system_theme = should_use_dark_system_theme() ? 'dark' : 'light';
    browser_window.webContents.send('theme-changed', system_theme);
    browser_window.webContents.send('theme-preference-changed', get_theme_preference(), system_theme);
}

nativeTheme.on('updated', () => {
    BrowserWindow.getAllWindows().forEach(send_theme_to_window);
});

let system_theme_watcher = null;
function start_system_theme_watcher() {
    if (process.platform !== 'linux' || system_theme_watcher) return;
    try {
        system_theme_watcher = spawn('gsettings', ['monitor', 'org.gnome.desktop.interface', 'color-scheme'], {
            stdio: ['ignore', 'pipe', 'ignore']
        });
        system_theme_watcher.stdout.on('data', () => BrowserWindow.getAllWindows().forEach(send_theme_to_window));
        system_theme_watcher.on('error', () => { system_theme_watcher = null; });
        system_theme_watcher.on('exit', () => { system_theme_watcher = null; });
    } catch (_) {
        system_theme_watcher = null;
    }
}

function stop_system_theme_watcher() {
    if (system_theme_watcher) system_theme_watcher.kill();
    system_theme_watcher = null;
}

// flags
let is_first_run = 0;

function get_cached_file_icon(href) {
    return FILE_ICON_CACHE.get(href);
}

function set_cached_file_icon(href, icon_data_url) {
    if (!href || typeof href !== 'string' || !icon_data_url || typeof icon_data_url !== 'string') {
        return;
    }

    if (FILE_ICON_CACHE.has(href)) {
        FILE_ICON_CACHE.set(href, icon_data_url);
        return;
    }

    if (FILE_ICON_CACHE.size >= MAX_FILE_ICON_CACHE_ENTRIES) {
        const oldest_key = FILE_ICON_CACHE.keys().next().value;
        if (oldest_key) {
            FILE_ICON_CACHE.delete(oldest_key);
        }
    }

    FILE_ICON_CACHE.set(href, icon_data_url);
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
                    const file = libfs.get_file(item);
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
        this.unsupported_watch_paths = new Set();
        // tracks the directory each window is currently watching, so events can be
        // routed only to windows displaying that directory instead of a global window
        this.window_dirs = new Map();
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

    send_to_watchers_of(dir, channel, payload) {
        this.window_dirs.forEach((watched_dir, window_id) => {
            if (watched_dir !== dir) return;
            const target = BrowserWindow.fromId(window_id);
            if (target && !target.isDestroyed()) target.webContents.send(channel, payload, dir);
        });
    }

    /**
     * Start watching a path for file system changes on behalf of a specific window.
     * @param {string} dir - The path to watch.
     * @param {number|string} window_id - Identifies the subscribing window.
     */
    watch(dir, window_id) {

        if (this.is_unsupported_watch_path(dir)) {
            this.window_dirs.delete(window_id);
            if (!this.unsupported_watch_paths.has(dir)) {
                this.unsupported_watch_paths.add(dir);
                console.warn(`Watcher disabled for unsupported path: ${dir}`);
            }
            return;
        }

        this.window_dirs.set(window_id, dir);

        try {

            const subscription = {};
            this.subscriptions ||= new Map();
            this.subscriptions.set(window_id, subscription);
            const revisions = new Map();
            let next_revision = 0;
            libfs.watch(dir, window_id, async event => {
                const current = () => this.window_dirs.get(window_id) === dir && this.subscriptions.get(window_id) === subscription;
                if (!current() || !utilities.run_watcher) return;
                if (event.event === 'error') {
                    this.send_to_watchers_of(dir, 'set_msg', `Automatic updates unavailable: ${event.error?.message || 'watch failed'}`);
                    return;
                }
                if (path.dirname(event.filename) !== dir) return;
                const revision = ++next_revision;
                revisions.set(event.filename, revision);
                utilities.invalidate_folder_size_for_item_path?.(event.filename);
                if (event.event === 'deleted') {
                    this.send_to_watchers_of(dir, 'remove_item', path_id(event.filename));
                    revisions.delete(event.filename);
                    return;
                }
                try {
                    const file = await device_probe('file', event.filename);
                    if (!current() || revisions.get(event.filename) !== revision) return;
                    this.send_to_watchers_of(dir, 'get_item', file);
                } catch (error) {
                    if (current()) this.send_to_watchers_of(dir, 'set_msg', `Automatic updates delayed: ${error.message}`);
                } finally {
                    if (revisions.get(event.filename) === revision) revisions.delete(event.filename);
                }
            });

        } catch (err) {
            if (this.is_unsupported_watch_error(err)) {
                if (!this.unsupported_watch_paths.has(dir)) {
                    this.unsupported_watch_paths.add(dir);
                    console.warn(`Watcher not supported for path: ${dir}`);
                }
                return;
            }

            this.send_to_watchers_of(dir, 'set_msg', `Automatic updates unavailable: ${err.message}`);
        }
    }

    /**
     * Stop watching a path on behalf of a specific window. The underlying native watcher
     * is only closed once no other window is still watching that directory.
     * @param {string} dir - The path to stop watching.
     * @param {number|string} window_id - Identifies the unsubscribing window.
     */
    unwatch(dir, window_id) {
        if (this.window_dirs.get(window_id) === dir) {
            this.window_dirs.delete(window_id);
            this.subscriptions?.delete(window_id);
        }
        try {
            libfs.stop_watch(dir, window_id);
        } catch (err) {
            // console.error(`Error closing watcher for ${dir}:`, err);
        }

    }

    /**
     * Clean up all watch subscriptions for a window (e.g. on window close).
     * @param {number|string} window_id
     */
    release_window(window_id) {
        const dir = this.window_dirs.get(window_id);
        this.window_dirs.delete(window_id);
        this.subscriptions?.delete(window_id);
        if (dir) {
            this.unwatch(dir, window_id);
        }
    }

    /**
     * Stop all watchers.
     */
    unwatchAll() {
        this.window_dirs.clear();
        this.subscriptions?.clear();
        libfs.stop_all_watches();
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
                        'Group By': { type: 'string', enum: ['None', 'Type', 'Date Modified', 'Size'], default: 'None' },
                        'Theme': { type: 'string', enum: ['dark', 'light', 'system', 'modern-dark', 'modern-light'], default: 'system' },
                        'Show Hidden': { type: 'boolean', default: true },
                        'Show Tab Toolbar': { type: 'boolean', default: true },
                        'Show Remote Folder Sizes': { type: 'boolean', default: false }
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
            show_tab_toolbar: true,
            tabs: [
                {
                    tab: {
                        id: 1,
                        location: home_dir
                    }
                }
            ],
            terminal: 'gnome-terminal',
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

        this.settings_store = new JsonStore(this.settings_file, defaults, value => object(value) &&
            (!value.view || ['grid_view', 'list_view'].includes(value.view)) &&
            (!value.location || typeof value.location === 'string') &&
            (!value.schema || (object(value.schema) && object(value.schema.properties))) &&
            (!value.columns || object(value.columns)) && (!value.tabs || Array.isArray(value.tabs)));
        this.list_store = new JsonStore(this.list_view_file, list_view_settings, value => object(value) &&
            (!value.col_width || (object(value.col_width) && Object.values(value.col_width).every(width => Number.isFinite(Number(width)) && Number(width) > 0))));
        this.settings = this.settings_store.update(value => {
            const settings = merge(defaults, value);
            delete settings.schema.properties['Default View'].properties['Show Remote Disk Sizes'];
            return settings;
        });
        this.list_view_settings = this.list_store.update(value => merge(list_view_settings, value));
    }

    // Get Settings
    get_settings() {

        if (!this.settings) {
            this.settings = this.settings_store.read();
        }

        return this.settings;
    }

    // Update settings
    updateSettings(settings) {

        // console.log('update settings', settings);

        this.settings = this.settings_store.update(current => merge(current, settings));

        BrowserWindow.getAllWindows().forEach((wnd) => {
            if (!wnd.isDestroyed()) {
                wnd.webContents.send('settings_updated', this.settings);
                wnd.webContents.send(
                    'theme-preference-changed',
                    get_theme_preference(this.settings),
                    should_use_dark_system_theme() ? 'dark' : 'light'
                );
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
        return this.list_store.read();
    }

    updateListViewSettingSettings(settings) {
        this.list_view_settings = this.list_store.update(current => merge(current, settings));
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
        try {
            this.tabs_store = new JsonStore(path.join(app.getPath('userData'), 'tabs.json'), [], Array.isArray);
            const stored = this.tabs_store.read();
            this.saved_tabs = Array.isArray(stored) ? stored.filter(tab => Array.isArray(tab.history?.location) && Number.isInteger(tab.history.idx) && tab.history.idx >= 0 && tab.history.idx < tab.history.location.length && tab.history.location.every(item => typeof item === 'string')) : [];
        } catch (_) { this.saved_tabs = []; }

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

        const saved_index = this.saved_tabs.findIndex(saved => saved.history.location[saved.history.idx] === location);
        if (saved_index >= 0) tab.history = this.saved_tabs.splice(saved_index, 1)[0].history;
        else tab.history.location.push(location);
        this.tabs.push(tab);

        const target = sender && !sender.isDestroyed() ? sender : win;
        if (target && !target.isDestroyed()) {
            target.send('disable_back_button');
            target.send('disable_forward_button');
        }

        this.switchTab(tab_id, sender);
        this.saveTabs();
    }

    // Save tabs to file
    saveTabs() {
        const tabsFile = path.join(app.getPath('userData'), 'tabs.json');
        this.tabs_store.update(() => this.tabs);
    }

    // Load tabs from file
    loadTabs() {
        const tabsFile = path.join(app.getPath('userData'), 'tabs.json');
        if (fs.existsSync(tabsFile)) {
            this.tabs = this.tabs_store.read();
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

ipcMain.on('switch_tab', (e, tab_id, location) => {
    tab_manager.switchTab(tab_id, e.sender);
    const owner = BrowserWindow.fromWebContents(e.sender);
    if (owner && location) {
        fileManager.next_list_request(owner.id);
        fileManager.watch_location(location, owner.id);
    }
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

        return await device_probe('dashboard', location);

    } catch (err) {
        return {
            stats: '',
            error: true,
            message: String(err.message || err)
        }
    }

})

ipcMain.on('path_operation', (event, operation, args) => {
    if (!['isAbsolute', 'resolve', 'relative', 'basename', 'dirname'].includes(operation) ||
        !Array.isArray(args) || !args.every(value => typeof value === 'string' && !value.includes('\0'))) {
        event.returnValue = null;
        return;
    }
    event.returnValue = path[operation](...args);
});

ipcMain.on('open_external', (event, url) => {
    try {
        const parsed = new URL(url);
        if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) return;
        shell.openExternal(parsed.href).catch(error => event.sender.send('set_msg', error.message));
    } catch (_) { /* Invalid external URL. */ }
});

const active_find_workers = new Map();

ipcMain.on('find_ack', (e, search_id) => {
    active_find_workers.get(`${e.sender.id}:${search_id}`)?.ack?.();
});

ipcMain.on('cancel_find', (e, search_id) => {
    active_find_workers.get(`${e.sender.id}:${search_id}`)?.();
});

ipcMain.handle('find', async (e, query, location, options, search_id) => {
    const sender = e.sender;
    const find_worker = new worker.Worker(path.join(__dirname, '../workers/find_worker.js'));
    const worker_key = `${sender.id}:${search_id}`;
    let finished = false;

    const cleanup = () => {
        if (finished) return;
        finished = true;
        active_find_workers.delete(worker_key);
        sender.removeListener('destroyed', on_sender_destroyed);
        find_worker.terminate();
    };
    const send = (channel, payload) => {
        if (!sender.isDestroyed()) sender.send(channel, { search_id, ...payload });
    };
    const on_sender_destroyed = () => cleanup();
    cleanup.ack = () => { if (!finished) find_worker.postMessage({ cmd: 'continue' }); };
    active_find_workers.set(worker_key, cleanup);
    sender.once('destroyed', on_sender_destroyed);

    find_worker.postMessage({
        cmd: 'find',
        query: query,
        location: location,
        options: options,
        search_id
    });

    find_worker.on('message', (msg) => {
        if (finished) return;
        switch (msg.cmd) {
            case 'find_batch':
                send('find_batch', { files: msg.files });
                break;
            case 'find_result':
                send('find_result', { file: msg.file });
                break;
            case 'find_done':
                send('find_done', { error: msg.err });
                cleanup();
                break;
            case 'find_error':
                send('find_error', { error: msg.err });
                cleanup();
                break;
            case 'find_results': // Backward compatibility
                send('find_results', { results: msg.res });
                cleanup();
                break;
        }
    });

    find_worker.on('error', (err) => {
        send('find_error', { error: String(err.message || err) });
        cleanup();
    });

    return { streaming: true };
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

function overwrite(e, files, operation) {
    if (operation === 'compress') {
        for (const file of files) utilities.start_compression(e, { ...file, overwrite: true });
        return;
    }
    const entries = files.map(file => ({ ...file, overwrite: true }));
    utilities.queue_transfer(e.sender, operation === 'move' ? 'move' : 'copy', entries,
        path.dirname(entries[0].destination));
}

ipcMain.on('overwrite_one', (e, file, operation) => overwrite(e, [file], operation));
ipcMain.on('overwrite_all', (e, files, operation) => overwrite(e, files, operation));

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
        this.operation_queue = new OperationQueue();
        this.active_archives = new Set();
        Object.defineProperty(this, 'run_watcher', {
            get: () => !this.operation_queue.active && !this.active_archives.size
        });
        this.root_destination = '';
        this.delete_sender = null;
        this.delete_in_progress = false;
        this.copy_in_progress = false;
        this.move_in_progress = false;

        this.byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
        this.disk_generations = new Map();
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
            libfs.set_execute(href);
        })

        ipcMain.on('clear_execute', (e, href) => {
            libfs.clear_execute(href);
        })

        // NOTE: generic arbitrary-command handler removed; it allowed unrestricted RCE from the renderer.

        ipcMain.on('open_terminal', (e, folders) => {

            if (!Array.isArray(folders)) {
                folders = [folders];
            }

            const terminalCmd = this.settings?.terminal || 'gnome-terminal';

            folders.forEach((folder) => {
                if (!folder.href || typeof folder.href !== 'string') {
                    const sender = e?.sender || win;
                    if (sender && !sender.isDestroyed()) {
                        sender.send('set_msg', `Error opening ${folder.href}: Invalid path`);
                    }
                    return;
                }

                execFile(terminalCmd, [`--working-directory=${folder.href}`], (error, data, getter) => {
                    if (error) {
                        console.error(`Error opening ${folder.href}:`, error);
                        const sender = e?.sender || win;
                        if (sender && !sender.isDestroyed()) {
                            sender.send('set_msg', `Error opening ${folder.href}: ${error.message}`);
                        }
                    }
                });

            });

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

        // listen for files dropped in from outside the app
        ipcMain.on('drop_external', async (e, paths, location) => {
            if (!Array.isArray(paths) || typeof location !== 'string' || !path.isAbsolute(location)) return;

            let copy_arr;
            try { copy_arr = await device_probe('external_drop', { paths, location }); }
            catch (error) {
                if (!e.sender.isDestroyed()) e.sender.send('set_msg', `Cannot import files: ${error.message}`);
                return;
            }
            if (e.sender.isDestroyed()) return;

            if (copy_arr.length === 0) return;
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
            this.operation_queue.cancel(e.sender, operation);
            if (operation === 'compress' && this.compression_sender === e.sender) this.compression_worker?.postMessage({ cmd: 'cancel' });
        });

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

            this.get_disk_space(href, sender);
        })

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

        ipcMain.on('extract', (e, files, location) => {
            for (const file of files.filter(file => !file.is_dir)) {
                const sender = e.sender;
                this.operation_queue.enqueue({ sender, operation: 'extract', start: job => {
                    const thread = new worker.Worker(path.join(__dirname, '../workers/compression_worker.js'));
                    const send = (channel, ...args) => { if (!sender.isDestroyed()) sender.send(channel, ...args); };
                    let finished = false;
                    let child_pid;
                    const finish = async (error, destination) => {
                        if (finished) return;
                        finished = true;
                        if (child_pid) { try { process.kill(child_pid); } catch (_) {} }
                        send('set_progress', { operation: 'extract', max: 0, value: 0, can_cancel: false });
                        if (error) send('set_msg', `Error extracting archive: ${error.message}`);
                        else {
                            this.invalidate_folder_size_for_item_path(destination);
                            try {
                                send('add_items', [await device_probe('file', destination)], location);
                                send('set_msg', 'Done extracting files.');
                            }
                            catch (error) { send('set_msg', `Archive extracted, but metadata is unavailable: ${error.message}`); }
                        }

                        thread.terminate();
                        job.finish();
                    };
                    job.cancel = () => thread.postMessage({ cmd: 'cancel' });
                    sender.once('destroyed', job.cancel);
                    thread.on('message', data => {
                        if (data.cmd === 'extract_child') child_pid = data.pid;
                        if (data.cmd === 'set_progress') send('set_progress', data);
                        if (data.cmd === 'extract_error') { child_pid = null; finish(new Error(data.msg)); }
                        if (data.cmd === 'extract_done') { child_pid = null; finish(null, data.destination); }
                    });
                    thread.on('error', finish);
                    thread.on('exit', () => {
                        sender.removeListener('destroyed', job.cancel);
                        if (!finished) finish(new Error('Extractor worker exited before completion.'));
                    });
                    thread.postMessage({ cmd: 'extract', source: file.href, location });
                }});
            }
        });

        // Compress: conflicts are resolved before starting a worker or opening output.
        ipcMain.on('compress', (e, files_arr, location, type, size) => {
            this.start_compression(e, { files_arr, location, type, size });
        });

        // On Get Folder Size
        ipcMain.on('get_folder_size', (e, href) => {
            this.get_folder_size(e, href);
        })

        ipcMain.handle('is_writable_directory', (e, location) => {
            return this.is_writable_directory(location);
        });

    }

    async start_compression(e, request) {
        const sender = e.sender;
        if (this.compression_worker) {
            sender.send('set_msg', 'An archive is already being created.');
            return;
        }
        let job;
        try {
            const destination = request.destination || archive_destination(request.files_arr, request.location, request.type);
            for (const file of request.files_arr) await safe_replace.assert_destination(file.href, destination);
            job = { ...request, destination, name: path.basename(destination), source: request.files_arr[0].href };
            if (!request.overwrite && await safe_replace.lstat(destination)) {
                sender.send('archive_conflict', job);
                return;
            }
        } catch (error) { sender.send('set_msg', `Cannot create archive: ${error.message}`); return; }
        // Recheck after async validation so two requests cannot start together.
        if (this.compression_worker) { sender.send('set_msg', 'An archive is already being created.'); return; }

        const archive_worker = new worker.Worker(path.join(__dirname, '../workers/compression_worker.js'), {
            workerData: { journal_dir: replacement_journals }
        });
        this.compression_worker = archive_worker;
        this.compression_sender = sender;
        this.active_archives.add(archive_worker);
        let finished = false;
        const cancel_on_close = () => archive_worker.postMessage({ cmd: 'cancel' });
        sender.once('destroyed', cancel_on_close);
        const finish = async (error, file_path) => {
            if (finished) return;
            finished = true;
            sender.removeListener('destroyed', cancel_on_close);
            this.compression_worker = null;
            this.compression_sender = null;
            this.active_archives.delete(archive_worker);

            if (!sender.isDestroyed()) {
                sender.send('set_progress', { operation: 'compress', max: 0, value: 0, can_cancel: false });
                if (error?.code === 'EEXIST' && !job.overwrite) sender.send('archive_conflict', job);
                else if (error) sender.send('set_msg', `Archive not completed: ${error.message}`);
                else {
                    this.invalidate_folder_size_hierarchy(job.location);
                    try {
                        const file = await device_probe('file', file_path);
                        if (!sender.isDestroyed()) {
                            sender.send('add_items', [file], job.location);
                            sender.send('set_msg', 'Done compressing files.');
                        }
                    } catch (error) {
                        if (!sender.isDestroyed()) sender.send('set_msg', `Archive created, but metadata is unavailable: ${error.message}`);
                    }
                }
            }
            archive_worker.terminate();
        };
        archive_worker.on('message', data => {
            if (data.cmd === 'set_progress' && !sender.isDestroyed()) sender.send('set_progress', data);
            if (data.cmd === 'compress_done') finish(null, data.file_path);
            if (data.cmd === 'compress_error') finish(Object.assign(new Error(data.msg), { code: data.code }));
        });
        archive_worker.on('error', finish);
        archive_worker.on('exit', () => { if (!finished) finish(new Error('Archive worker exited before completion.')); });
        sender.send('set_progress', { operation: 'compress', max: Math.max(1, job.size || 0), value: 0, can_cancel: true, status: 'Compressing files' });
        archive_worker.postMessage({ ...job, cmd: 'compress' });
    }

    init_delete_worker(sender, job) {
        const thread = this.delete_worker = new worker.Worker(path.join(__dirname, '../workers/delete_worker.js'));
        thread.on('message', (data) => {
            const cmd = data.cmd;
            const target = this.delete_sender;
            const sender = { send: (...args) => { if (target && !target.isDestroyed()) target.send(...args); } };

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

                    thread.terminate();
                    job.finish();
                    break;
                }
                default:
                    break;
            }
        });

        thread.on('error', (err) => {
            const target = this.delete_sender;
            const sender = { send: (...args) => { if (target && !target.isDestroyed()) target.send(...args); } };
            sender.send('set_progress', {
                cmd: 'set_progress',
                status: '',
                max: 0,
                value: 0
            });
            sender.send('set_msg', `Error deleting files: ${err.message}`);
            this.delete_in_progress = false;
            this.delete_sender = null;

            job.finish();
        });

        thread.on('exit', () => {
            if (this.operation_queue.active === job && this.delete_sender === sender) {
                if (!sender.isDestroyed()) {
                    sender.send('set_msg', 'Delete worker exited before completion.');
                    sender.send('set_progress', { operation: 'delete', max: 0, value: 0 });
                }
                this.delete_sender = null;
                this.delete_in_progress = false;

                job.finish();
            }
            sender.removeListener('destroyed', job.cancel);
        });
        job.cancel = () => thread.postMessage({ cmd: 'cancel' });
        sender.once('destroyed', job.cancel);
    }

    queue_transfer(sender, operation, entries, location) {
        const input = structuredClone(entries);
        this.operation_queue.enqueue({ sender, operation, paths: input.flatMap(entry => [entry.source, entry.destination]), start: job => {
            const thread = new worker.Worker(path.join(__dirname, operation === 'copy'
                ? '../workers/paste_worker.js' : '../workers/move_worker.js'),
                { workerData: { journal_dir: replacement_journals } });
            const send = (channel, ...args) => { if (!sender.isDestroyed()) sender.send(channel, ...args); };
            let finished = false;
            const finish = error => {
                if (finished) return;
                finished = true;
                if (error) send('set_msg', `${operation} incomplete: ${error.message}`);
                send('set_progress', { operation, max: 0, value: 0, can_cancel: false });

                thread.terminate();
                job.finish();
            };
            job.cancel = () => thread.postMessage({ cmd: 'cancel' });
            sender.once('destroyed', job.cancel);
            thread.on('message', async data => {
                if (finished) return;
                if (data.cmd === 'set_msg') send('set_msg', data.msg);
                if (data.cmd === 'set_progress') send('set_progress', data);
                if (data.cmd !== 'cp_done' && data.cmd !== 'mv_done') return;
                try {
                    const completed = data.completed || data.files_arr || [];
                    if (operation === 'move') send('remove_items', completed.map(file => ({ id: path_id(file.source), href: file.source })));
                    const by_location = new Map();
                    const metadata = completed.length ? await device_probe('files', completed.map(entry => entry.destination)) : [];
                    for (const [index, entry] of completed.entries()) {
                        const file = metadata[index];
                        const parent = path.dirname(entry.destination);
                        if (!by_location.has(parent)) by_location.set(parent, []);
                        by_location.get(parent).push(file);
                        this.invalidate_folder_size_for_item_path(entry.destination);
                        if (operation === 'move') this.invalidate_folder_size_for_item_path(entry.source);
                    }
                    for (const [parent, files] of by_location) send('add_items', files, parent);
                    if (data.cmd === 'cp_done') send('set_msg', data.cancelled ? 'Copy cancelled.'
                        : data.failures?.length ? `Copy incomplete: ${data.failures.length} items failed.`
                        : `Done copying (${completed.length}) files`);
                    this.invalidate_folder_size_hierarchy(location);
                } catch (error) { finish(error); return; }
                finish();
            });
            thread.on('error', finish);
            thread.on('exit', () => { if (!finished) finish(new Error('Worker exited before completion.')); });
            thread.once('exit', () => sender.removeListener('destroyed', job.cancel));
            send('set_progress', { operation, max: 1, value: 0, can_cancel: true, status: 'Preparing files' });
            thread.postMessage({ cmd: operation === 'copy' ? 'paste' : 'move',
                [operation === 'copy' ? 'copy_arr' : 'move_arr']: input });
        }});
    }

    normalize_folder_size_path(raw_path) {
        return this.directory_size_cache.normalize_path(raw_path);
    }

    // GVFS mounts (network/smb/mtp/etc.) are slow to recurse, so folder size is not computed for them.
    is_gvfs_path(dir) {
        if (!dir || typeof dir !== 'string') {
            return false;
        }

        return /\/\.?gvfs\//.test(dir) || /\/run\/user\/\d+\/gvfs\//.test(dir);
    }

    is_sftp_path(dir) {
        if (!dir || typeof dir !== 'string') {
            return false;
        }

        return /\/\.?sftp\//.test(dir) || /\/run\/user\/\d+\/sftp\//.test(dir);
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

        if (!require('../common/remote_folder_size').show_folder_size(normalized_href, settingsManager.get_settings())) {
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

    async is_writable_directory(location) {
        if (typeof location !== 'string' || !path.isAbsolute(location)) return false;
        try { return await device_probe('writable', location); }
        catch (error) { return false; }
    }

    async can_write_to_directory(e, location) {
        const writable = await this.is_writable_directory(location);
        if (e?.sender?.isDestroyed()) return false;
        if (writable) {
            return true;
        }

        const sender = e?.sender;
        if (sender && !sender.isDestroyed()) {
            sender.send('set_msg', `Cannot drop here: no write access to ${location}`);
        } else if (win && !win.isDestroyed()) {
            win.send('set_msg', `Cannot drop here: no write access to ${location}`);
        }
        return false;
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
    async paste(e, copy_arr, location) {

        // check if copy_arr is empty
        if (copy_arr.length === 0) {
            e.sender.send('set_msg', 'Error: Copy array is empty.');
            return;
        }

        // check if location is empty
        if (location == '' || location == undefined) {
            e.sender.send('set_msg', 'No location to paste files.');
            return;
        }

        if (!await this.can_write_to_directory(e, location)) {
            return;
        }



        let paste_arr = [];
        let overwrite_arr = [];

        e.sender.send('set_msg', { text: 'Gathering files...', loading: true }, true);

        try {
            const prepared = await device_probe('prepare_transfer', { files: copy_arr, location, operation: 'copy' });
            if (e.sender.isDestroyed()) return;
            for (const message of prepared.messages) e.sender.send('set_msg', message);
            paste_arr = prepared.ready;
            overwrite_arr = prepared.overwrite;
        } catch (error) {
            if (!e.sender.isDestroyed()) e.sender.send('set_msg', `Cannot prepare copy: ${error.message}`);
            return;
        }

        // send copy_arr to renderer
        if (paste_arr.length > 0) {

            // send copy_arr to worker
            let paste_cmd = {
                cmd: 'paste',
                copy_arr: paste_arr,
                location: location
            }
            this.queue_transfer(e.sender, 'copy', paste_arr, location);
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
    async move(e, files_arr, location) {

        if (files_arr.length === 0) {
            e.sender.send('set_msg', 'Error: moving files_arr is empty');
            return;
        }

        if (location === '' || location === undefined) {
            e.sender.send('set_msg', `Error: Move location is not valid: ${location}`);
            return;
        }

        if (!await this.can_write_to_directory(e, location)) {
            return;
        }

        let move_arr = [];
        let overwrite_arr = [];


        try {
            const prepared = await device_probe('prepare_transfer', { files: files_arr, location, operation: 'move' });
            if (e.sender.isDestroyed()) return;
            for (const message of prepared.messages) e.sender.send('set_msg', message);
            move_arr = prepared.ready;
            overwrite_arr = prepared.overwrite;
        } catch (error) {
            if (!e.sender.isDestroyed()) e.sender.send('set_msg', `Cannot prepare move: ${error.message}`);
            return;
        }

        // send copy_arr to renderer
        if (move_arr.length > 0) {

            // send copy_arr to worker
            let move_cmd = {
                cmd: 'move',
                move_arr: move_arr,
                location: location
            }

            this.queue_transfer(e.sender, 'move', move_arr, location);
            this.move_in_progress = true;

        }

        if (overwrite_arr.length > 0) {
            e.sender.send('overwrite_move', overwrite_arr);
        }

        move_arr = [];
        overwrite_arr = [];
        files_arr = [];

    }

    // make directory
    async mkdir(e, location) {
        const sender = e.sender;
        if (!location) {
            if (!sender.isDestroyed()) sender.send('set_msg', `Error: getting mkdir location ${location}`);
            return;
        }
        try {
            let dir = path.join(location, 'New Folder');
            let index = 1;
            while (!sender.isDestroyed()) {
                try { await fs.promises.mkdir(dir); break; }
                catch (error) {
                    if (error.code !== 'EEXIST') throw error;
                    dir = path.join(location, `New Folder (${index++})`);
                }
            }
            if (sender.isDestroyed()) return;
            const file = await device_probe('file', dir);
            file.id = path_id(dir);
            if (!sender.isDestroyed()) sender.send('get_item', file, { edit: true });
            this.invalidate_folder_size_hierarchy(location);
        } catch (error) {
            if (!sender.isDestroyed()) sender.send('set_msg', `Error creating folder in ${location}: ${error.message}`);
        }
    }

    // Rename is a scoped filesystem job; replies retain the initiating renderer.
    async rename(e, source, destination, id) {
        if (!source || !destination || !id) { e.sender.send('set_msg', 'Invalid rename request.'); return; }
        const sender = e.sender;
        const rename_job = { sender, operation: 'rename', start: async job => {
            const send = (channel, ...args) => { if (!sender.isDestroyed()) sender.send(channel, ...args); };
            try {
                if (await device_probe('exists', destination)) {
                    if (destination.includes('New Folder')) send('cancel_edit');
                    else send('set_msg', `Error: File name '${destination}' already exists.`);
                    return;
                }
                await new Promise((resolve, reject) => libfs.mv(source, destination,
                    error => error ? reject(error) : resolve(), { journal_dir: replacement_journals }));
                const file = await device_probe('file', destination);
                file.previous_id = id;
                file.id = path_id(destination);
                send('update_item', file);
                this.invalidate_folder_size_hierarchy(path.dirname(source), false);
                this.invalidate_folder_size_hierarchy(path.dirname(destination), false);
                this.emit_folder_size_cache_invalidated([path.dirname(source), path.dirname(destination)]);
            } catch (error) { send('set_msg', `Error: rename: ${error.message}`); }
            finally { job.finish(); }
        }};
        const copy_job = this.operation_queue.active;
        const pending_jobs = [...this.operation_queue.pending];
        const independent = await require('../common/rename_during_copy').can_rename(this.operation_queue, source, destination);
        if (independent && this.operation_queue.active === copy_job && !this.operation_queue.parallel &&
            this.operation_queue.pending.length === pending_jobs.length &&
            this.operation_queue.pending.every((job, index) => job === pending_jobs[index])) {
            this.operation_queue.run_parallel(rename_job);
        } else {
            this.operation_queue.enqueue(rename_job);
        }
    }

    // delete
    delete(e, delete_arr) {

        if (delete_arr.length > 0) {

            if (this.delete_in_progress) {
                e.sender.send('set_msg', 'Delete already in progress.');
                return;
            }



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
                    this.operation_queue.enqueue({ sender: e.sender, operation: 'delete', start: job => {
                        this.init_delete_worker(e.sender, job);
                        this.delete_sender = e.sender;
                        this.delete_in_progress = true;
                        this.delete_worker.postMessage({ cmd: 'delete', delete_arr });
                    }});

                } else {
                    if (!e.sender.isDestroyed()) e.sender.send('set_msg', 'Operation cancelled.');

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
    async get_disk_space(href, sender = null) {

        const target = sender && !sender.isDestroyed() ? sender : win;

        if (href === '' || href === undefined) {
            if (target && !target.isDestroyed()) {
                target.send('set_msg', `Error: get_disk_space href is not valid ${href}`);
            }
            return;
        }

        const generation = (this.disk_generations.get(target?.id) || 0) + 1;
        this.disk_generations.set(target?.id, generation);
        const current = () => this.disk_generations.get(target?.id) === generation;
        try {
            const stats = await device_probe('stats', href);
            if (!current()) return;
            let options = {
                disksize: this.get_file_size(parseInt(stats.total)),
                usedspace: this.get_file_size(parseInt(stats.used)),
                availablespace: this.get_file_size(parseInt(stats.free))
            };
            let df = [];
            df.push(options);
            if (target && !target.isDestroyed()) {
                target.send('disk_space', df, href);
            }

        } catch (err) {
            if (!current()) return;
            if (target && !target.isDestroyed()) {
                target.send('disk_space', [{ disksize: 'Unknown', usedspace: 'Unknown', availablespace: 'Unknown' }], href);
            }
        }

    }


}

class WorkspaceManager {

    constructor() {
        this.store = new JsonStore(path.join(app.getPath('userData'), 'workspace.json'), [],
            value => Array.isArray(value) && value.every(item => object(item) && typeof item.href === 'string' && typeof item.name === 'string'));


        // Add Workspace
        ipcMain.on('add_workspace', async (e, selected_files_arr) => {
            try {
                const files = await device_probe('files', selected_files_arr.map(file => file.href));
                if (e.sender.isDestroyed()) return;
                this.store.update(current => [...files.reverse(), ...current]);
                BrowserWindow.getAllWindows().forEach(window => { if (!window.isDestroyed()) window.webContents.send('get_workspace'); });
            } catch (error) {
                if (!e.sender.isDestroyed()) e.sender.send('set_msg', `Cannot add workspace items: ${error.message}`);
            }
        });

        // Remove Workspace
        ipcMain.on('remove_workspace', (e, href) => {

            let workspace_data = this.store.read();

            let workspace = workspace_data.filter(data => data.href !== href);
            this.store.update(() => workspace);

            BrowserWindow.getAllWindows().forEach(window => { if (!window.isDestroyed()) window.webContents.send('get_workspace'); });
            // selected_files_arr = [];
        })

        // Get Workspace
        ipcMain.handle('get_workspace', async (e) => {

            return this.get_workspace_arr();
            // let workspace_items = this.store.read();
            // return workspace_items;

        })

        // Update workspace
        ipcMain.on('rename_workspace', (e, href, workspace_name) => {

            let workspace_data = this.store.read();

            let index = workspace_data.findIndex(data => data.href === href);
            if (index !== -1) {
                workspace_data[index].name = workspace_name;
                this.store.update(() => workspace_data);
                BrowserWindow.getAllWindows().forEach(window => { if (!window.isDestroyed()) window.webContents.send('get_workspace'); });
            } else {
                console.error("Workspace entry not found with href:", href);
            }

        })

        ipcMain.on('reorder_workspace', (e, files_arr) => {


            try {
                // Read and parse the current workspace file
                const workspace_data = this.store.read();

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
                this.store.update(() => [...reordered_data, ...workspace_data.filter(item => !files_arr.includes(item.href))]);
                // console.log('Workspace reordered successfully.'); // commented out for non-error logging

                // Notify the renderer to refresh the workspace
                BrowserWindow.getAllWindows().forEach(window => { if (!window.isDestroyed()) window.webContents.send('get_workspace'); });
            } catch (error) {
                console.error("Failed to reorder workspace:", error.message);
            }

        });

        ipcMain.on('get_workspace_folder_icon', async (e, href) => {
            let icon = await iconManager.get_folder_icon_for_platform(href, app);
            e.sender.send('set_workspace_folder_icon', href, icon);
        });

    }

    get_workspace_arr() {

        let workspace_items = this.store.read();
        return workspace_items;

    }

}

// Image decoding stays in a separate Electron process.
const { ThumbnailManager } = require('./lib/ThumbnailManager');
let thumbnails;
ipcMain.handle('get_thumbnail', (event, href) => {
    thumbnails ||= new ThumbnailManager(path.join(app.getPath('userData'), 'thumbnails'));
    return thumbnails.get(href);
});
app.on('before-quit', () => thumbnails?.close());

// Icon IPC //////

// Get File Icon
ipcMain.handle('get_icon', async (e, href) => {

    const cached_icon = get_cached_file_icon(href);
    if (cached_icon) {
        return cached_icon;
    }

    if (process.platform === 'linux' && typeof libfs.get_file_icon_data_url === 'function') {
        try {
            const result = libfs.get_file_icon_data_url(href);
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

    return await app.getFileIcon(href, { size: 'normal' }).then(icon => {
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
    let folder_icon = await iconManager.get_folder_icon_for_platform(href, app);
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
                case 'set_msg':
                    win.send('set_msg', data.msg);
                    break;
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

        // Debounce event bursts and retry after the OS finishes exposing the volume.
        libfs.monitor(data => {
            if (!data) return;
            clearTimeout(this.device_refresh_timer);
            clearTimeout(this.device_retry_timer);
            const refresh = () => {
                this.device_worker.postMessage({ cmd: 'get_mounts' });
                this.device_worker.postMessage({ cmd: 'get_devices' });
            };
            this.device_refresh_timer = setTimeout(refresh, 150);
            this.device_retry_timer = setTimeout(refresh, 1000);
        });

    }

    // Mount device
    mount(device_name) {

        // this.device_worker.postMessage({ cmd: 'mount', device_path });

        // Note Call this in main process.
        // It will crash if called in a worker thread
        // Mount device
        libfs.mount(device_name, (err, res) => {

            if (err) {
                win.send('set_msg', `Error: mounting ${device_name.name || device_name}: ${err}`);
                return;
            }

            // Get mounts after mounting
            device_probe('devices').then(mounts => {
                const target = res || device_name;
                const matches = mounts.filter(mount => target.device ? mount.device === target.device
                    : target.activation_root ? mount.activation_root === target.activation_root
                    : mount.name === device_name);
                const device_path = matches.length === 1 ? matches[0].path : null;
                if (device_path) win.send('mount_done', device_path.startsWith('file://')
                    ? require('../common/device_identity').location_key(device_path) : device_path);
                else win.send('set_msg', 'Mounted volume could not be uniquely located. Refresh the device list.');
                this.device_worker.postMessage({ cmd: 'get_mounts' });
                this.device_worker.postMessage({ cmd: 'get_devices' });
            }).catch(error => win.send('set_msg', `Error: getting mounts: ${error.message}`));




        });

    }

    // Umount device
    umount(device_name) {

        // console.log('umount device_path', device_path);/
        // this.device_worker.postMessage({ cmd: 'umount', device_path });

        // Note Call this in main process.
        // It will crash if called in a worker thread
        // Umount device
        libfs.umount(device_name, (err) => {
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
        this.network_settings_arr = [];
        this.reconnect_in_progress = false;

        ipcMain.handle('connect', (e, settings) => this.connect(e, settings));
        ipcMain.handle('cancel_connect', e => {
            this.pending_connections?.get(e.sender)?.cancel();
            return true;
        });
        app.on('before-quit', () => this.cancelAllConnections());
    }

    cancelAllConnections() {
        this.closing = true;
        for (const request of this.pending_connections?.values() || []) request.cancel();
    }

    normalize_server(server) {
        if (typeof server !== 'string') return '';
        const address = server.trim().replace(/^(smb|ssh|sftp|sshfs|nfs|dav|davs|ftp|afp):\/\//i, '');
        // Keep explicit root exports distinct from a missing remote path.
        return address.replace(/\/+$/, '') + (/^[^/]+\/+$/.test(address) ? '/' : '');
    }

    connectionTarget(settings) {
        const type = String(settings.type || '').toLowerCase();
        if (!['ssh', 'sshfs', 'sftp', 'smb', 'nfs', 'dav', 'davs', 'ftp', 'afp'].includes(type)) throw new Error('Unsupported connection type.');
        const raw = String(settings.server || '').trim();
        if (!raw) throw new Error('Server is required.');
        const scheme = ['ssh', 'sshfs'].includes(type) ? 'sftp' : type;
        const address = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `${scheme}://${raw}`);
        const actual = ['ssh:', 'sshfs:'].includes(address.protocol) ? 'sftp:' : address.protocol;
        if (actual !== `${scheme}:`) throw new Error('The server address does not match the selected protocol.');
        if (!address.hostname || address.username || address.password || address.search || address.hash || /[\s\\]/.test(address.hostname))
            throw new Error('Enter a server and remote path; supply credentials in their separate fields.');
        // The combined address is authoritative; separate fields support older saved entries.
        const port = Number(address.port || settings.port || 0);
        if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be an integer between 0 and 65535.');
        let remote = address.pathname || '/';
        if (!address.pathname && settings.remote_path) {
            const supplied = '/' + String(settings.remote_path).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
            remote = supplied;
        }
        const explicitPath = Boolean(address.pathname) || Boolean(settings.remote_path);
        remote = remote.replace(/\/+$/, '');
        if (type === 'nfs' && !explicitPath) throw new Error('An NFS export path is required.');
        if (type === 'nfs' && !remote) remote = '/';
        if (type === 'smb' && !remote) throw new Error('An SMB share is required.');
        return { type, server: address.hostname + (port ? `:${port}` : '') + remote, port };
    }

    encryption_available() {
        try {
            return !!safeStorage && safeStorage.isEncryptionAvailable() &&
                !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text');
        } catch (err) {
            return false;
        }
    }

    connect(e, network_settings = {}) {
        const sender = e?.sender;
        this.pending_connections ||= new Map();
        const owner = sender || Symbol('reconnect');
        if (this.closing) return Promise.resolve({ error: true, msg: 'Connection cancelled.' });
        if (this.pending_connections.has(owner)) return Promise.resolve({ error: true, msg: 'A connection is already in progress.' });
        return new Promise(resolve => {
            let target;
            try { target = this.connectionTarget(network_settings); }
            catch (error) { resolve({ error: true, msg: error.message }); return; }
            const { type, server, port } = target;
            const ssh = ['ssh', 'sshfs', 'sftp'].includes(type);
            const username = type === 'nfs' ? '' : (network_settings.username || '').trim();
            const password = type === 'nfs' || ssh ? '' : (network_settings.password || '');
            if (type === 'smb' && (!username || !password)) {
                resolve({ error: true, msg: 'Username and password are required for SMB.' }); return;
            }
            if (ssh && !network_settings.use_ssh_key) {
                resolve({ error: true, msg: 'SFTP currently requires SSH key authentication.' }); return;
            }
            if (typeof libfs?.connect_network_drive !== 'function') {
                resolve({ error: true, msg: 'Network drive support is not available in this build.' }); return;
            }
            let settled = false, handle, timeout;
            const finish = result => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                sender?.removeListener?.('destroyed', cancel);
                sender?.removeListener?.('did-start-navigation', cancel);
                sender?.removeListener?.('render-process-gone', cancel);
                this.pending_connections.delete(owner);
                resolve(result);
            };
            const cancel = () => {
                if (settled) return;
                finish({ error: true, msg: 'Connection cancelled.' });
                handle?.cancel?.();
            };
            this.pending_connections.set(owner, { cancel });
            sender?.once?.('destroyed', cancel);
            sender?.once?.('did-start-navigation', cancel);
            sender?.once?.('render-process-gone', cancel);
            timeout = setTimeout(() => {
                if (settled) return;
                finish({ error: true, msg: `Connection timed out for ${server}.` });
                handle?.cancel?.();
            }, 20000);
            try {
                handle = libfs.connect_network_drive(server, port, username, password, ssh ? 1 : 0, type, err => {
                    if (settled) return;
                    if (err) { finish({ error: true, msg: String(err) }); return; }
                    const save_error = network_settings.save_connection
                        ? this.setNetworkSettings({ ...network_settings, ...target, remote_path: '', username, password, use_ssh_key: ssh }) : null;
                    deviceManager?.device_worker?.postMessage({ cmd: 'get_mounts' });
                    finish({ error: false, msg: `Connected to ${server}.${save_error ? ` Connection was not saved: ${save_error}` : ''}` });
                });
                // A synchronous callback can settle before the handle is returned.
                if (settled && this.closing) handle?.cancel?.();
            } catch (err) { finish({ error: true, msg: `Error connecting to ${server}: ${err.message}` }); }
        });
    }

    networkIdentity(network_settings = {}) {
        let target;
        try { target = this.connectionTarget(network_settings); } catch (_) {}
        return [
            target?.type || (network_settings.type || '').toLowerCase(),
            target?.server || this.normalize_server(network_settings.server),
            target?.port || network_settings.port || 0,
            (network_settings.mount_point || '').trim(),
            (network_settings.username || '').trim()
        ].join('|');
    }

    deserializeNetworkSettings(network_settings = {}) {
        const entry = {
            type: (network_settings.type || '').toLowerCase(),
            server: this.normalize_server(network_settings.server),
            port: Number(network_settings.port || 0),
            remote_path: network_settings.remote_path || '',
            mount_point: (network_settings.mount_point || '').trim(),
            username: (network_settings.username || '').trim(),
            use_ssh_key: !!network_settings.use_ssh_key,
            save_connection: !!network_settings.save_connection,
            auto_reconnect: !!network_settings.auto_reconnect
        };

        if (network_settings.encrypted_password) {
            entry.encrypted_password = network_settings.encrypted_password;
            if (!this.encryption_available()) {
                entry.auto_reconnect = false;
            } else {
                try {
                    entry.password = safeStorage.decryptString(Buffer.from(network_settings.encrypted_password, 'base64'));
                } catch (err) {
                    entry.auto_reconnect = false;
                }
            }
        } else if (network_settings.password && this.encryption_available()) {
            try {
                entry.encrypted_password = safeStorage.encryptString(network_settings.password).toString('base64');
                entry.password = network_settings.password;
            } catch (error) { entry.auto_reconnect = false; }
        } else if (network_settings.password) {
            entry.auto_reconnect = false;
        }

        return entry;
    }

    serializeNetworkSettings(network_settings = {}) {
        if (network_settings.password && !this.encryption_available()) {
            throw new Error('Secure password storage is unavailable; connection was not saved.');
        }
        const entry = this.deserializeNetworkSettings(network_settings);
        delete entry.password;
        if (network_settings.password && this.encryption_available()) {
            entry.encrypted_password = safeStorage.encryptString(network_settings.password).toString('base64');
        }
        return entry;
    }

    writeNetworkSettings() {
        const network_file = path.join(app.getPath('userData'), 'network.json');
        const persisted = this.network_settings_arr.map(entry => {
            const copy = { ...entry };
            delete copy.password;
            return copy;
        });
        const store = new JsonStore(network_file, [], Array.isArray);
        store.update(() => persisted);
        // Rotate legacy plaintext out of the last-good backup after migration.
        store.update(value => value);

    }

    setNetworkSettings(network_settings) {
        if (!network_settings.save_connection) {
            return;
        }

        try {
            this.getNetworkSettings();
            const stored = new JsonStore(path.join(app.getPath('userData'), 'network.json'), [], Array.isArray).read();
            if (stored.some(entry => entry.password) && stored.some(entry => entry.password && !this.encryption_available())) {
                throw new Error('Unlock secure storage before changing legacy saved connections.');
            }
            const target = this.connectionTarget(network_settings);
            const entry = this.serializeNetworkSettings({ ...network_settings, server: target.server });
            const identity = this.networkIdentity(entry);
            this.network_settings_arr = this.network_settings_arr.filter((saved) => {
                return this.networkIdentity(saved) !== identity;
            });
            this.network_settings_arr.push(entry);
            this.writeNetworkSettings();
            return null;
        } catch (err) {
            console.error('Unable to save network settings:', err.message);
            return err.message;
        }
    }

    getNetworkSettings() {
        const network_file = path.join(app.getPath('userData'), 'network.json');
        let parsed = [];
        try {
            for (const file of [network_file, `${network_file}.bak`]) {
                if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
            }
            parsed = new JsonStore(network_file, [], Array.isArray).read();
        } catch (err) {
            parsed = [];
        }

        const seen = new Set();
        this.network_settings_arr = parsed
            .map((entry) => this.deserializeNetworkSettings(entry))
            .filter((entry) => ['ssh', 'sshfs', 'sftp', 'smb', 'nfs', 'dav', 'davs', 'ftp', 'afp'].includes(entry.type) && entry.server)
            .filter((entry) => {
                const identity = this.networkIdentity(entry);
                if (seen.has(identity)) {
                    return false;
                }
                seen.add(identity);
                return true;
            });

        try {
            if (!parsed.some(entry => entry.password) ||
                parsed.filter(entry => entry.password).every(entry => this.deserializeNetworkSettings(entry).encrypted_password)) this.writeNetworkSettings();
        } catch (err) {
            console.error('Unable to initialize network settings:', err.message);
        }
        return this.network_settings_arr;
    }

    removeNetworkSettings(network_settings) {
        try {
            this.getNetworkSettings();
            const identity = typeof network_settings === 'string'
                ? network_settings
                : this.networkIdentity(network_settings);
            const store = new JsonStore(path.join(app.getPath('userData'), 'network.json'), [], Array.isArray);
            store.update(entries => entries.filter(entry => this.networkIdentity(entry) !== identity));
            this.getNetworkSettings();
        } catch (err) {
            console.error('Unable to remove network settings:', err.message);
        }
    }

    async reconnectSavedConnections() {
        if (this.reconnect_in_progress) {
            return [];
        }

        this.reconnect_in_progress = true;
        try {
            const saved_connections = this.getNetworkSettings().filter((entry) => entry.auto_reconnect);
            const reconnect_results = [];
            const concurrency = Math.min(3, saved_connections.length);
            let next_index = 0;

            const reconnect_worker = async () => {
                while (next_index < saved_connections.length) {
                    const index = next_index++;
                    const network_settings = saved_connections[index];
                    const result = await this.connect(null, {
                        ...network_settings,
                        save_connection: false
                    });
                    reconnect_results[index] = {
                        identity: this.networkIdentity(network_settings),
                        result
                    };
                }
            };

            await Promise.all(Array.from({ length: concurrency }, reconnect_worker));
            return reconnect_results;
        } finally {
            this.reconnect_in_progress = false;
        }
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
ipcMain.on('get_recent_files', (e, add_tab = false, request_id) => {
    fileManager.get_recent_files(e, add_tab === true, request_id);
});

ipcMain.handle('autocomplete', async (e, directory) => {
    if (typeof directory !== 'string' || directory.length === 0) {
        return [];
    }

    const dir = path.dirname(directory);
    const search = path.basename(directory);

    return await new Promise((resolve) => {
        libfs.ls(dir, (err, dirents) => {
            if (err || !Array.isArray(dirents)) {
                resolve([]);
                return;
            }

            resolve(dirents
                .filter((item) => item && item.is_dir && item.name.startsWith(search))
                .map((item) => `${item.href}/`));
        });
    });
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
        this.startup = true;
        this.list_request_generations = new Map();
        // per-window current watched directory (window_id/'default' -> dir)
        this.window_watch_dirs = new Map();

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
                    const request_key = Number.isInteger(data.window_id) ? data.window_id : 'default';
                    if (data.request_token !== this.list_request_generations.get(request_key)) {
                        break;
                    }
                    if (target_sender) {
                        target_sender.send('ls_done', data.files_arr, data.add_tab, data.request_token, { location: data.location, failures: data.failures || [] });
                    }

                    // watcherManager.watch(this.location);
                    break;
                case 'ls_failed':
                    if (data.request_token === this.list_request_generations.get(Number.isInteger(data.window_id) ? data.window_id : 'default') && target_sender) target_sender.send('ls_failed', data);
                    break;
                case 'set_msg':
                    const message_key = Number.isInteger(data.window_id) ? data.window_id : 'default';
                    if (data.request_token !== undefined && data.request_token !== this.list_request_generations.get(message_key)) {
                        break;
                    }
                    if (target_sender) {
                        target_sender.send('set_msg', data.msg);
                    }
                    break;
                default:
                    break;
            }

        });

    }

    async validate_location(location) {
        if (!location) return -1;
        try { await device_probe('validate', location); return 0; }
        catch (error) { return -2; }
    }

    // return file from get_files
    async get_ls(location, add_tab, window_id = null, sender = null) {
        if (window_id === null && !sender) window_id = win?.id ?? null;
        if (path.isAbsolute(location)) location = path.resolve(location);

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

        const request_token = this.next_list_request(window_id);
        const message_key = Number.isInteger(window_id) ? window_id : 'default';
        if (target && !target.isDestroyed()) target.send('ls_started', request_token);
        let validation_error;
        try { await device_probe('validate', location); } catch (error) { validation_error = error; }
        if (this.list_request_generations.get(message_key) !== request_token || target?.isDestroyed()) return;
        if (validation_error) {
            if (this.startup) location = utilities.home_dir;
            else {
                target?.send('ls_failed', { request_token, location, msg: validation_error.message });
                return;
            }
        }
        this.location0 = this.location;
        this.location = location;
        let ls_data = {
            cmd: 'ls',
            location: this.location,
            add_tab: add_tab,
            window_id: window_id,
            request_token: request_token
        }

        this.ls_worker.postMessage(ls_data);
        this.startup = false;

        this.watch_location(location, window_id);
    }

    watch_location(location, window_id) {
        const previous = this.window_watch_dirs.get(window_id);
        if (!path.isAbsolute(location)) {
            watcher.release_window(window_id);
            this.window_watch_dirs.delete(window_id);
            return;
        }
        const directory = path.resolve(location);
        this.window_watch_dirs.set(window_id, directory);
        watcher.watch(directory, window_id);
        if (previous && previous !== directory) watcher.unwatch(previous, window_id);
    }

    next_list_request(window_id) {
        const key = Number.isInteger(window_id) ? window_id : 'default';
        const request_token = (this.list_request_generations.get(key) || 0) + 1;
        this.list_request_generations.set(key, request_token);
        return request_token;
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

    async get_recent_files(e, add_tab = false, request_id) {
        try {
            const files = await get_recent_files_arr();
            if (!e.sender.isDestroyed()) e.sender.send('recent_files', files, add_tab, request_id);
        } catch (error) {
            if (!e.sender.isDestroyed()) e.sender.send('recent_files', [], add_tab, request_id, { error: error.message });
        }
    }

}

const windowsRecent = new (require('./lib/WindowsRecent').WindowsRecent)(app);

function get_recent_files_arr() {
    if (process.platform === 'win32') return windowsRecent.get();
    const file = path.join(utilities.home_dir, '.local/share/', 'recently-used.xbel');
    try { return require('../common/recent_files').recent_files(fs.readFileSync(file, 'utf8'), href => libfs.get_file(href)); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
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
        this.store = new JsonStore(this.window_file, { window: { width: 1124, height: 600, x: 0, y: 0 } },
            value => object(value) && object(value.window) &&
                ['width', 'height', 'x', 'y'].every(key => Number.isFinite(value.window[key])) &&
                value.window.width >= 400 && value.window.height >= 400);
        this.window_settings = this.store.read();
    }

    update_window_settings(settings) {
        this.window_settings = this.store.update(current => merge(current, settings));
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
                sandbox: true,
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true,
                webviewTag: false,
                enableRemoteModule: false,
                nativeWindowOpen: true,
                preload: path.join(__dirname, 'generated', 'preload.js'),
            },
            icon: app_icon
        });

        secureWindow(window, pathToFileURL(path.join(__dirname, '../renderer/index.html')).href);

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

        window.loadFile(path.join(__dirname, '../renderer/index.html'));
        window.webContents.on('did-finish-load', () => {
            send_theme_to_window(window);
        });
        // window.webContents.openDevTools({ mode: 'detach' });
        this.windows.push(window);

        const window_id = window.id;
        window.on('closed', () => {
            this.prune_closed_windows();
            watcher.release_window(window_id);
            fileManager.window_watch_dirs.delete(window_id);
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
                sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true, webviewTag: false,
                preload: path.join(__dirname, 'generated', data.preload),
            },
        })

        secureWindow(dialog, pathToFileURL(path.join(__dirname, '../renderer/dialogs', data.load_file)).href);
        dialog.loadFile(path.join(__dirname, '..', 'renderer', 'dialogs', data.load_file));
        dialog.webContents.once('did-finish-load', () => send_theme_to_window(dialog));
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
        this.paste_worker = new worker.Worker(path.join(__dirname, '../workers/paste_worker.js'), { workerData: { journal_dir: replacement_journals } });
        this.paste_worker.on('message', async (data) => {
            switch (data.cmd) {
                case 'cp_template_done':
                    try {
                        const f = await device_probe('file', data.destination);
                        f.id = path_id(data.destination);
                        if (win && !win.isDestroyed()) win.send('get_item', f, { edit: true });
                    } catch (error) { if (win && !win.isDestroyed()) win.send('set_msg', `Template created, but metadata is unavailable: ${error.message}`); }
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
        ipcMain.on('main_menu', async (e, destination) => {
            const writable = await this.can_write_to_location(destination);
            if (e.sender.isDestroyed()) return;

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
                    label: 'Group By',
                    submenu: this.group_by_menu(e.sender)
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
                        execFile('gnome-terminal', [`--working-directory=${destination}`], error => { if (error) e.sender.send('set_msg', error.message); });
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
                        execFile('baobab', [destination], error => { if (error) e.sender.send('set_msg', error.message); });
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

            if (!writable) {
                // disable new folder
                this.main_menu.getMenuItemById('new_folder').enabled = false;
                this.main_menu.getMenuItemById('templates').enabled = false;
            }

            // Add templates
            const menu = this.main_menu;
            await this.add_templates_menu(menu, destination);
            if (e.sender.isDestroyed()) return;

            // Show menu
            menu.popup(BrowserWindow.fromWebContents(e.sender))

        })

        // Folders Menu
        ipcMain.on('folder_menu', (e, f) => {

            const template = [
                {
                    label: 'Open with Code',
                    click: () => {
                        execFile('code', ['.'], { cwd: f.href }, (err) => {
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
                        execFile('baobab', [f.href], error => { if (error) e.sender.send('set_msg', error.message); });
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
                        run_configured(cmd, (err) => {
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

        // Group By Menu
        ipcMain.on('group_by_menu', (e) => {

            const template = this.group_by_menu(e.sender);
            const menu = Menu.buildFromTemplate(template)
            menu.popup(BrowserWindow.fromWebContents(e.sender))

        });

        // Sort Menu
        ipcMain.on('sort_menu', (e) => {

            const template = this.sort_menu();
            const menu = Menu.buildFromTemplate(template)
            menu.popup(BrowserWindow.fromWebContents(e.sender))

        });

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

    async can_write_to_location(location) {
        if (!location) return false;
        try { return await device_probe('menu_writable', location); }
        catch (_) { return false; }
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
            },
            {
                type: 'separator'
            },
            {
                label: 'Disk Usage Analyzer',
                click: () => {
                    execFile('baobab', [location], error => { if (error) win.send('set_msg', error.message); });
                }
            }
        ];

        let menu = Menu.buildFromTemplate(template)
        menu.popup(BrowserWindow.fromWebContents(e.sender))

    }


    connect_dialog() {

        let bounds = win.getBounds()

        let x = bounds.x + parseInt((bounds.width - 400) / 2);
        let y = bounds.y + parseInt((bounds.height - 350) / 2);

        let dialog_properties = {
            width: 470,
            height: 450,
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
        //         preload: path.join(__dirname, 'generated', 'preload.js'),
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
        let launchers = libfs.open_with(f.href);
        launchers.sort((a, b) => {
            return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase());
        })

        let launcher_menu = menu.getMenuItemById('launchers')
        try {
            for (let i = 0; i < launchers.length; i++) {
                launcher_menu.submenu.append(new MenuItem({
                    label: launchers[i].name,
                    click: () => {

                        launch_desktop(launchers[i], f.href, error => {
                            if (error && !e.sender.isDestroyed()) e.sender.send('set_msg', error.message);
                        });

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
                        execFile('ffmpeg', ['-i', href, filename], (err, stdout, stderr) => {
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

                        execFile('ffprobe', ['-i', href, '-show_entries', 'format=size', '-v', 'quiet', '-of', 'csv=p=0'], (err, stdout, stderr) => {
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
                        execFile('ffmpeg', ['-i', href, '-c:a', 'libvorbis', '-q:a', '4', filename], (err, stdout, stderr) => {
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

                        execFile('ffprobe', ['-i', href, '-show_entries', 'format=size', '-v', 'quiet', '-of', 'csv=p=0'], (err, stdout, stderr) => {
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
    async add_templates_menu(menu, location) {

        try {
            let template_menu = menu.getMenuItemById('templates');
            let templates = await device_probe('directory_names', path.join(utilities.home_dir, 'Templates'));
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
        } catch (err) {
            win.send('set_msg', `Error adding templates menu: ${err}`);
        }

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

    group_by_menu(webContents) {
        this.settings = settingsManager.get_settings() || {};
        const group_by = this.settings?.schema?.properties?.['Default View']?.properties?.['Group By']?.default || 'None';
        return ['None', 'Type', 'Date Modified', 'Size'].map((value) => ({
            label: value,
            type: 'radio',
            checked: value === group_by,
            click: () => webContents.send('set_group_by', value)
        }));

    }

}

const settingsManager = new SettingsManager();
if (!fs.existsSync(settingsManager.settings_file)) is_first_run = 1;
settingsManager.initialize_settings();

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
app.on('ready', async () => {
    const recovery_errors = await safe_replace.recover(replacement_journals);
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
    if (recovery_errors.length) win.webContents.once('did-finish-load', () => {
        win.send('set_msg', recovery_errors.join('\n'));
    });
    networkManager.getNetworkSettings();
    setImmediate(() => {
        networkManager.reconnectSavedConnections().catch((err) => {
            console.error('Saved network reconnect failed:', err.message);
        });
    });

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
        FILE_ICON_CACHE.clear();
        BrowserWindow.getAllWindows().forEach((window) => {
            if (!window.isDestroyed()) {
                window.webContents.send('icon_theme_changed');
            }
        });
    });
    start_system_theme_watcher();

});

app.on('before-quit', () => {
    watcher.unwatchAll();
    iconManager.stop_theme_watcher();
    stop_system_theme_watcher();
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
