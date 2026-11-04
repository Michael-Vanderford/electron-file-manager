// @ts-nocheck

const { path_id } = require('./path_id');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const { execFileSync, execFile } = require('child_process');

let gioNative = null;
try {
    gioNative = require('libgio-node');
} catch (e) {
    gioNative = null;
}

const { get_content_type, perms_from_stats } = require('./file_metadata');

class LibFS {
    constructor() {
        this.watchers = new Map();
        this.gioNative = gioNative;
    }

    get_content_type(name, is_dir) { return get_content_type(name, is_dir); }

    is_accessible(href, mode) {
        try {
            fs.accessSync(href, mode);
            return true;
        } catch (err) {
            return false;
        }
    }

    // derives read/write perms from stat mode bits, avoiding extra access() round trips on remote mounts
    perms_from_stats(stats) { return perms_from_stats(stats); }

    build_file_from_stats(href, lstats, stats, broken_symlink) {
        const name = path.basename(href) || href;
        const dir = path.dirname(href);
        const is_symlink = lstats.isSymbolicLink();
        const is_dir = !broken_symlink && stats.isDirectory();
        const { is_readable, is_writable } = this.perms_from_stats(stats);

        return {
            name,
            display_name: name,
            href,
            location: dir,
            is_dir,
            is_hidden: name.startsWith('.'),
            is_readable,
            is_writable,
            is_symlink,
            content_type: this.get_content_type(name, is_dir),
            size: stats.size,
            mtime: Math.floor(stats.mtimeMs / 1000),
            atime: Math.floor(stats.atimeMs / 1000),
            ctime: Math.floor(stats.ctimeMs / 1000),
            id: Buffer.from(href).toString('base64'),
            filesystem: 'ext4'
        };
    }

    get_file(href) {
        const name = path.basename(href) || href;
        const dir = path.dirname(href);

        let lstats;
        try {
            lstats = fs.lstatSync(href);
        } catch (err) {
            return {
                name,
                display_name: name,
                href,
                location: dir,
                is_dir: false,
                is_hidden: name.startsWith('.'),
                is_readable: false,
                is_writable: false,
                is_symlink: false,
                content_type: 'application/octet-stream',
                size: 0,
                mtime: 0,
                atime: 0,
                ctime: 0,
                id: Buffer.from(href).toString('base64'),
                filesystem: 'ext4'
            };
        }

        let stats = lstats;
        let broken_symlink = false;

        if (lstats.isSymbolicLink()) {
            try {
                stats = fs.statSync(href);
            } catch (err) {
                stats = lstats;
                broken_symlink = true;
            }
        }

        return this.build_file_from_stats(href, lstats, stats, broken_symlink);
    }

    async get_file_async(href) {
        const name = path.basename(href) || href;
        const dir = path.dirname(href);

        let lstats;
        try {
            lstats = await fsPromises.lstat(href);
        } catch (err) {
            return this.get_file(href);
        }

        let stats = lstats;
        let broken_symlink = false;

        if (lstats.isSymbolicLink()) {
            try {
                stats = await fsPromises.stat(href);
            } catch (err) {
                stats = lstats;
                broken_symlink = true;
            }
        }

        return this.build_file_from_stats(href, lstats, stats, broken_symlink);
    }

    ls(location, callback) {
        this.ls_async(location).then(
            (dirents) => callback(null, dirents),
            (err) => callback(err)
        );
    }

    async ls_async(location) {
        const names = await fsPromises.readdir(location);
        const dirents = new Array(names.length);
        const CONCURRENCY = 32;
        let next_index = 0;

        // stat entries concurrently instead of serially, since each stat is a round trip on remote/GVFS mounts
        const worker = async () => {
            while (next_index < names.length) {
                const index = next_index++;
                try {
                    dirents[index] = await this.get_file_async(path.join(location, names[index]));
                } catch (e) {
                    // skip errors
                }
            }
        };

        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, names.length) }, worker));
        return dirents.filter(Boolean);
    }

    exists(href) {
        return fs.existsSync(href);
    }

    disk_stats(location, { strict = false } = {}) {
        try {
            if (typeof fs.statfsSync === 'function') {
                const stats = fs.statfsSync(location);
                const total = stats.blocks * stats.bsize;
                const free = stats.bfree * stats.bsize;
                const available = stats.bavail * stats.bsize;
                const used = total - free;
                return { total, free: available, used };
            }
        } catch (e) {
            // fallback
        }

        try {
            const output = execFileSync('df', ['-B1', '--', location], { encoding: 'utf8', timeout: 2500 });
            const lines = output.trim().split('\n');
            if (lines.length >= 2) {
                const parts = lines[1].split(/\s+/);
                const total = parseInt(parts[1], 10) || 0;
                const used = parseInt(parts[2], 10) || 0;
                const free = parseInt(parts[3], 10) || 0;
                return { total, used, free };
            }
        } catch (e) {
            // ignore
        }

        if (strict) throw new Error('Filesystem capacity is unavailable.');
        return { total: 0, used: 0, free: 0 };
    }

    mv(source, destination, callback, options = {}) {
        fs.rename(source, destination, error => {
            if (!error) return callback(null, true);
            if (error.code !== 'EXDEV') return callback(error);
            // Verify a staged copy before any source cleanup. Preserve cancellation,
            // links and partial-failure safety at the actual EXDEV boundary.
            require('./safe_replace').transfer(source, destination, {
                ...options, move: true,
                journal_dir: options.journal_dir || path.join(os.tmpdir(), 'efm-replacement-journals')
            }).then(() => callback(null, true), callback);
        });
    }

    set_execute(href) {
        try {
            const stats = fs.statSync(href);
            const mode = stats.mode | 0o111;
            fs.chmodSync(href, mode);
            return true;
        } catch (err) {
            return false;
        }
    }

    clear_execute(href) {
        try {
            const stats = fs.statSync(href);
            const mode = stats.mode & ~0o111;
            fs.chmodSync(href, mode);
            return true;
        } catch (err) {
            return false;
        }
    }

    // supports multiple subscribers per dir (keyed by token) so one window unwatching doesn't
    // close the native watcher while other windows still need it
    watch(dir, token, callback) {
        let entry = this.watchers.get(dir);

        if (!entry) {
            try {
                const fs_watcher = fs.watch(dir, { recursive: false }, (eventType, filename) => {
                    const current_entry = this.watchers.get(dir);
                    if (!current_entry) {
                        return;
                    }

                    if (!filename) return;
                    const fullPath = path.join(dir, String(filename));
                    const notify = (event, error) => {
                        if (current_entry !== this.watchers.get(dir)) return;
                        current_entry.callbacks.forEach(cb => cb({ event, filename: fullPath, error }));
                    };
                    fsPromises.lstat(fullPath).then(() => notify(eventType === 'rename' ? 'created' : 'modified'), error => {
                        if (error.code !== 'ENOENT') { notify('error', error); return; }
                        fsPromises.stat(dir).then(() => notify('deleted'), directory_error => {
                            notify('error', directory_error);
                            current_entry.watcher.close();
                            if (this.watchers.get(dir) === current_entry) this.watchers.delete(dir);
                        });
                    });
                });
                // dir deleted/unmounted: drop the entry so no stale callbacks or handle remain
                fs_watcher.on('error', error => {
                    entry.callbacks.forEach(cb => cb({ event: 'error', filename: dir, error }));
                    try { fs_watcher.close(); } catch (err) { }
                    if (this.watchers.get(dir)?.watcher === fs_watcher) {
                        this.watchers.delete(dir);
                    }
                });
                entry = { watcher: fs_watcher, callbacks: new Map() };
                this.watchers.set(dir, entry);
            } catch (err) {
                // Surface watch limits and invalid directories to the owning window.
                throw err;
            }
        }

        entry.callbacks.set(token, callback);
    }

    stop_watch(dir, token) {
        const entry = this.watchers.get(dir);
        if (!entry) {
            return;
        }

        if (token !== undefined) {
            entry.callbacks.delete(token);
            if (entry.callbacks.size > 0) {
                // other subscribers still watching this dir; keep the native watcher alive
                return;
            }
        }

        entry.watcher.close();
        this.watchers.delete(dir);
    }

    stop_all_watches() {
        this.watchers.forEach((entry) => {
            try { entry.watcher.close(); } catch (err) { }
        });
        this.watchers.clear();
    }

    count(dir) {
        let folders = 0;
        let files = 0;
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    folders++;
                } else {
                    files++;
                }
            }
        } catch (e) {
            // skip
        }
        return { folders, files, total: folders + files };
    }

    get_mounts(callback, { include_stats = true } = {}) {
        if (this.gioNative && typeof this.gioNative.get_mounts === 'function') {
            return this.gioNative.get_mounts(callback);
        }

        if (process.platform !== 'linux') {
            return callback(null, []);
        }

        try {
            const mountsContent = fs.readFileSync('/proc/mounts', 'utf8');
            const lines = mountsContent.split('\n');
            const mounts = [];

            for (const line of lines) {
                if (!line.trim()) continue;
                const parts = line.split(/\s+/);
                const device = parts[0];
                const mountPath = parts[1];
                const fsType = parts[2];

                if (mountPath && (mountPath === '/' || mountPath.startsWith('/media') || mountPath.startsWith('/mnt') || mountPath.startsWith('/run/media'))) {
                    const stats = include_stats ? this.disk_stats(mountPath) : {};
                    mounts.push({
                        name: path.basename(mountPath) || mountPath,
                        path: mountPath,
                        device,
                        filesystem: fsType,
                        total: stats.total,
                        used: stats.used,
                        free: stats.free
                    });
                }
            }
            return callback(null, mounts);
        } catch (err) {
            return callback(err, []);
        }
    }

    mount(device, callback) {
        if (this.gioNative && typeof this.gioNative.mount === 'function') {
            return this.gioNative.mount(device, callback);
        }

        if (process.platform !== 'linux') {
            return callback(new Error('Mounting is only supported on Linux'));
        }

        execFile('udisksctl', ['mount', '-b', String(device.device || device)], (err, stdout, stderr) => {
            if (err) {
                return callback(err);
            }
            callback(null, true);
        });
    }

    umount(device, callback) {
        if (this.gioNative && typeof this.gioNative.umount === 'function') {
            return this.gioNative.umount(device, callback);
        }

        if (process.platform !== 'linux') {
            return callback(new Error('Unmounting is only supported on Linux'));
        }

        execFile('udisksctl', ['unmount', '-b', String(device.device || device)], error => {
            if (!error) return callback(null, true);
            execFile('udisksctl', ['unmount', '-p', String(device.path || device)], fallback_error => callback(fallback_error, !fallback_error));
        });
    }

    connect_network_drive(...args) {
        if (this.gioNative && typeof this.gioNative.connect_network_drive === 'function') {
            return this.gioNative.connect_network_drive(...args);
        }
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
            callback(new Error(process.platform === 'linux' ? 'GVFS network drives require libgio-node' : 'Network drive connection is not supported on this platform'));
        }
    }

    get_file_icon_data_url(href) {
        if (this.gioNative && typeof this.gioNative.get_file_icon_data_url === 'function') {
            return this.gioNative.get_file_icon_data_url(href);
        }
        return null;
    }

    open_with(href) {
        if (this.gioNative && typeof this.gioNative.open_with === 'function') {
            return this.gioNative.open_with(href);
        }
        return [];
    }

    monitor(callback) {
        if (this.gioNative && typeof this.gioNative.monitor === 'function') {
            return this.gioNative.monitor(callback);
        }
    }

    async *find(query, location, options = {}) {
        const searchLocation = location || os.homedir();
        const searchQuery = (query || '').toLowerCase();

        const self = this;
        async function* walk(dir, depth = 0) {
            if (options.maxDepth !== undefined && depth > options.maxDepth) return;

            let items;
            try {
                items = await fsPromises.readdir(dir, { withFileTypes: true });
            } catch (e) {
                return;
            }

            for (const item of items) {
                const fullPath = path.join(dir, item.name);

                if (item.name.toLowerCase().includes(searchQuery)) {
                    const file = self.get_file(fullPath);

                    let matches = true;

                    if (options.minSize !== undefined && file.size < options.minSize) matches = false;
                    if (options.maxSize !== undefined && file.size > options.maxSize) matches = false;

                    if (matches && options.dateFrom) {
                        const fromDate = new Date(options.dateFrom).getTime();
                        if (file.mtime * 1000 < fromDate) matches = false;
                    }

                    if (matches && options.dateTo) {
                        const toDate = new Date(options.dateTo).getTime();
                        if (file.mtime * 1000 > toDate) matches = false;
                    }

                    if (matches) {
                        yield file;
                    }
                }
                if (item.isDirectory() && !item.isSymbolicLink()) {
                    yield* walk(fullPath, depth + 1);
                }
            }
        }

        try {
            yield* walk(searchLocation, 0);
        } catch (err) {
            throw err;
        }
    }

    rm(targetPath, callback) {
        if (typeof callback === 'function') {
            fs.lstat(targetPath, (error, stat) => {
                if (error) { callback(error.code === 'ENOENT' ? null : error, error.code === 'ENOENT'); return; }
                const done = error => callback(error, !error);
                if (stat.isSymbolicLink()) fs.unlink(targetPath, done);
                else fs.rm(targetPath, { recursive: true, force: true }, done);
            });
            return;
        }
        try {
            // A dangling link is an existing entry even when its target is absent.
            if (fs.lstatSync(targetPath).isSymbolicLink()) fs.unlinkSync(targetPath);
            else fs.rmSync(targetPath, { recursive: true, force: true });
            return true;
        } catch (err) {
            return err.code === 'ENOENT';
        }
    }

    mkdir(targetPath, callback) {
        if (typeof callback === 'function') {
            fs.mkdir(targetPath, { recursive: true }, (err) => {
                callback(err, !err);
            });
            return;
        }
        try {
            fs.mkdirSync(targetPath, { recursive: true });
            return true;
        } catch (err) {
            return false;
        }
    }

    cp_async(source, destination, callback) {
        fs.cp(source, destination, { recursive: true, force: false, errorOnExist: true, dereference: false, verbatimSymlinks: true }, (err) => {
            if (typeof callback === 'function') {
                callback(err, err ? null : { completed: true });
            }
        });
    }

    get_drives(callback) {
        if (this.gioNative && typeof this.gioNative.get_drives === 'function') {
            return this.gioNative.get_drives(callback);
        }
        if (typeof callback === 'function') {
            callback(null, []);
        }
    }

}

const instance = new LibFS();
module.exports = instance;
module.exports.LibFS = LibFS;
