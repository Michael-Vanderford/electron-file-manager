const path = require('path');
const { pathToFileURL } = require('url');

const text = value => typeof value === 'string' && value.length <= 65536 && !value.includes('\0');
const object = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
const optional = validate => value => value === undefined || validate(value);
const oneOf = values => value => values.includes(value);
const bool = value => typeof value === 'boolean';
const id = value => (Number.isSafeInteger(value) && value >= 0) || (text(value) && /^\d+$/.test(value));
const localPath = value => text(value) && path.isAbsolute(value);
const resource = value => localPath(value) || (text(value) && /^(smb|sftp|ssh|sshfs|nfs|dav|davs|ftp|afp|mtp|file):\/\//i.test(value));
const location = value => resource(value) || ['Dashboard', 'Recent', 'File Conflicts'].includes(value);
const list = validate => value => Array.isArray(value) && value.length <= 100000 && value.every(validate);
const tuple = (...validators) => args => args.length <= validators.length && validators.every((validate, index) => validate(args[index]));
const file = value => object(value) && resource(value.href) &&
    optional(name => text(name) && !name.includes('/') && (process.platform !== 'win32' || !name.includes('\\')))(value.name) &&
    optional(bool)(value.is_dir) && optional(bool)(value.is_hidden);
const files = list(file);
const conflict = value => file(value) && localPath(value.source) && localPath(value.destination) && optional(files)(value.files_arr);
const plainData = value => {
    try {
        const json = JSON.stringify(value, (key, item) => {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe settings key.');
            return item;
        });
        return object(value) && json.length <= 1024 * 1024;
    } catch (_) { return false; }
};
const network = value => object(value) && ['ssh', 'sshfs', 'sftp', 'smb', 'nfs', 'dav', 'davs', 'ftp', 'afp'].includes(value.type) &&
    text(value.server) && optional(port => Number.isInteger(port) && port >= 0 && port <= 65535)(value.port) && text(value.remote_path || '') && text(value.mount_point || '') && text(value.username || '') && text(value.password || '') &&
    ['use_ssh_key', 'save_connection', 'auto_reconnect'].every(key => optional(bool)(value[key]));

const schemas = {};
for (const channel of ['get_settings','get_list_view_settings','get_home_dir','get_user','get_window_settings','get_app_versions',
    'get_dashboard_view','get_workspace','get_recent_files_arr','get_templates_folder','get_mounts','get_devices',
    'open_connect_dialog','cancel_connect','clear_history','load_history','columns_menu','group_by_menu','sort_menu',
    'window-minimize','window-maximize','window-close','toggle-devtools','toggle-fullscreen','reload']) schemas[channel] = tuple();
for (const channel of ['update_settings','update_list_view_settings','update_window_settings']) schemas[channel] = tuple(plainData);
for (const channel of ['set_execute','clear_execute','get_thumbnail','mkdir','remove_workspace','start_drag_external']) schemas[channel] = tuple(localPath);
for (const channel of ['open','get_folder_size','get_disk_space','get_icon','get_folder_icon','get_workspace_folder_icon','get_dashboard_disk_stats']) schemas[channel] = tuple(resource);
for (const channel of ['get_readonly_icon','get_symlink_icon']) schemas[channel] = tuple(optional(resource));
for (const channel of ['remove_tab','go_back','go_forward']) schemas[channel] = tuple(id);
schemas.switch_tab = tuple(id, optional(location));
for (const channel of ['add_tab','add_tab_history']) schemas[channel] = tuple(location, id);
for (const channel of ['add_workspace','reorder_workspace','delete','get_properties']) schemas[channel] = tuple(files);
for (const channel of ['paste','move','extract']) schemas[channel] = tuple(files, localPath);
for (const channel of ['folder_menu','file_menu','workspace_menu']) schemas[channel] = tuple(file);
for (const channel of ['mount','umount']) schemas[channel] = tuple(value => text(value) || (object(value) && text(value.name)));
schemas.connect = args => !args.length || tuple(network)(args);
schemas.ls = tuple(location, optional(bool));
schemas.is_writable_directory = tuple(localPath);
schemas.set_copy_arr = tuple(files, optional(location));
schemas.get_recent_files = tuple(optional(bool), optional(id));
schemas.autocomplete = tuple(text);
schemas.validate_location = tuple(location);
schemas.new_window = tuple(optional(location));
schemas['new-window'] = schemas.new_window;
schemas.home_menu = tuple(text);
schemas.main_menu = tuple(location);
schemas.device_menu = tuple(text, optional(text));
schemas.rename_workspace = tuple(resource, text);
schemas.rename = tuple(localPath, localPath, text);
schemas.drop_external = tuple(list(localPath), localPath);
schemas.open_terminal = tuple(value => files(value) || file(value));
schemas.is_main = tuple(oneOf([0, 1, false, true]));
schemas.cancel_operation = tuple(oneOf(['copy','move','delete','compress','extract']));
schemas.compress = tuple(files, localPath, oneOf(['zip','tar.gz','tar.xz']), value => Number.isFinite(value) && value >= 0);
const archiveConflict = value => object(value) && files(value.files_arr) && value.files_arr.length > 0 &&
    localPath(value.location) && localPath(value.source) && localPath(value.destination) &&
    ['zip','tar.gz','tar.xz'].includes(value.type) && Number.isFinite(value.size) && value.size >= 0;
schemas.overwrite_one = args => args.length === 2 && (args[1] === 'compress'
    ? archiveConflict(args[0]) : ['copy','move'].includes(args[1]) && conflict(args[0]));
schemas.overwrite_all = args => args.length === 2 && (args[1] === 'compress'
    ? list(archiveConflict)(args[0]) : ['copy','move'].includes(args[1]) && list(conflict)(args[0]));
schemas.find = tuple(text, resource, plainData, text);
schemas.find_ack = schemas.cancel_find = tuple(text);
schemas.path_operation = tuple(oneOf(['isAbsolute','resolve','relative','basename','dirname']), value => Array.isArray(value) && value.length <= 2 && value.every(text));
schemas.open_external = tuple(value => {
    try { return text(value) && ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol); }
    catch (_) { return false; }
});
schemas['close-window'] = tuple(optional(plainData));

const dialogChannels = {
    'connect.html': new Set(['connect','cancel_connect','autocomplete','get_settings','get_home_dir','window-close','close-window']),
    'columns.html': new Set(['get_settings','get_home_dir','update_settings','ls','window-close','close-window'])
};

function trustedPage(event, rendererRoot) {
    try {
        const frame = event.senderFrame;
        if (!frame || frame.parent || !event.sender || event.sender.isDestroyed()) return null;
        const pages = ['index.html', 'dialogs/connect.html', 'dialogs/columns.html'];
        for (const page of pages) {
            const expected = pathToFileURL(path.join(rendererRoot, page)).href;
            if (frame.url === expected && event.sender.getURL() === expected) return path.basename(page);
        }
        return null;
    } catch (_) { return null; }
}

function secureIpc(nativeIpc, rendererRoot) {
    function allowed(channel, event, args) {
        const page = trustedPage(event, rendererRoot);
        if (!page || (page !== 'index.html' && !dialogChannels[page]?.has(channel))) return false;
        return !!schemas[channel]?.(args);
    }
    return {
        on(channel, handler) {
            if (!schemas[channel]) throw new Error(`Missing IPC schema: ${channel}`);
            nativeIpc.on(channel, (event, ...args) => {
                if (!allowed(channel, event, args)) {
                    // Always answer denied sync messages so an untrusted frame cannot hang a renderer.
                    event.returnValue = null;
                    return;
                }
                const report = error => {
                    event.returnValue = null;
                    if (!event.sender.isDestroyed()) event.sender.send('set_msg', `Error: ${error.message || error}`);
                };
                try {
                    const result = handler(event, ...args);
                    if (result?.catch) result.catch(report);
                } catch (error) { report(error); }
            });
        },
        handle(channel, handler) {
            if (!schemas[channel]) throw new Error(`Missing IPC schema: ${channel}`);
            nativeIpc.handle(channel, (event, ...args) => {
                if (!allowed(channel, event, args)) throw new Error('IPC request denied.');
                return handler(event, ...args);
            });
        }
    };
}

module.exports = { secureIpc, schemas, trustedPage };
