// @ts-nocheck
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');

let gioNative = null;
try {
    gioNative = require('libgio-node');
} catch (e) {
    gioNative = null;
}

const CONTENT_TYPE_BY_EXT = {
    '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json',
    '.js': 'text/javascript', '.mjs': 'text/javascript', '.cjs': 'text/javascript',
    '.ts': 'text/x-typescript', '.html': 'text/html', '.htm': 'text/html',
    '.css': 'text/css', '.xml': 'application/xml', '.csv': 'text/csv',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.ico': 'image/vnd.microsoft.icon',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
    '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip', '.tar': 'application/x-tar', '.gz': 'application/gzip',
    '.7z': 'application/x-7z-compressed', '.rar': 'application/vnd.rar',
    '.exe': 'application/x-msdownload', '.sh': 'application/x-sh',
};

class LibFS {
    constructor() {
        this.watchers = new Map();
        this.gioNative = gioNative;
    }

    get_content_type(name, is_dir) {
        if (is_dir) {
            return 'inode/directory';
        }
        return CONTENT_TYPE_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';
    }

    is_accessible(href, mode) {
        try {
            fs.accessSync(href, mode);
            return true;
        } catch (err) {
            return false;
        }
    }

    // derives read/write perms from stat mode bits, avoiding extra access() round trips on remote mounts
    perms_from_stats(stats) {
        const mode = stats.mode;
        const uid = process.getuid ? process.getuid() : -1;
        const gid = process.getgid ? process.getgid() : -1;
        let bits;
        if (stats.uid === uid) {
            bits = (mode >> 6) & 0o7;
        } else if (stats.gid === gid) {
            bits = (mode >> 3) & 0o7;
        } else {
            bits = mode & 0o7;
        }
        return { is_readable: !!(bits & 0o4), is_writable: !!(bits & 0o2) };
    }

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

    disk_stats(location) {
        if (process.platform !== 'linux') {
            return { total: 0, used: 0, free: 0 };
        }

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
            const output = execSync(`df -B1 "${location}"`, { encoding: 'utf8' });
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

        return { total: 0, used: 0, free: 0 };
    }

    mv(source, destination, callback) {
        fs.rename(source, destination, (err) => {
            if (err) {
                if (err.code === 'EXDEV') {
                    // Cross-device link error, copy and unlink
                    fs.cp(source, destination, { recursive: true }, (cpErr) => {
                        if (cpErr) return callback(cpErr);
                        fs.rm(source, { recursive: true, force: true }, (rmErr) => {
                            callback(rmErr, true);
                        });
                    });
                    return;
                }
                return callback(err);
            }
            callback(null, true);
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

                    let event;
                    if (filename) {
                        const fullPath = path.join(dir, filename);
                        event = {
                            eventType,
                            filename: fullPath,
                            file: this.exists(fullPath) ? this.get_file(fullPath) : { href: fullPath, name: filename }
                        };
                    } else {
                        event = { eventType, filename: dir };
                    }

                    current_entry.callbacks.forEach((cb) => cb(event));
                });
                entry = { watcher: fs_watcher, callbacks: new Map() };
                this.watchers.set(dir, entry);
            } catch (err) {
                // handle invalid directory or watch limits
                return;
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

    get_mounts(callback) {
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
                    const stats = this.disk_stats(mountPath);
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

        exec(`udisksctl mount -b "${device.device || device}"`, (err, stdout, stderr) => {
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

        exec(`udisksctl unmount -b "${device.device || device}" || udisksctl unmount -p "${device.path || device}"`, (err) => {
            if (err) {
                return callback(err);
            }
            callback(null, true);
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
            fs.rm(targetPath, { recursive: true, force: true }, (err) => {
                callback(err, !err);
            });
            return;
        }
        try {
            fs.rmSync(targetPath, { recursive: true, force: true });
            return true;
        } catch (err) {
            return false;
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
        fs.cp(source, destination, { recursive: true, force: true }, (err) => {
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
