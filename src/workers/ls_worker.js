// @ts-nocheck
const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const FILE_METADATA_CONCURRENCY = 32;

// minimal extension -> mime map; unknown extensions fall back to a generic type
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

class FileManager {

    constructor() {

        this.latest_request_tokens = new Map();

        this.tag = {
            ts: '',
            name: '',
            pv: ''
        }

        // file object
        this.file_obj = {
            name: '',
            display_name: '',
            href: '',
            content_type: '',
            size: '',
            mtime: '',
            ctime: '',
            atime: '',
            is_dir: false,
        }

    }

    get_content_type(name, is_dir) {
        if (is_dir) {
            return 'inode/directory';
        }
        return CONTENT_TYPE_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';
    }

    // derives read/write perms from stat mode bits, avoiding extra access() round trips on remote/gvfs mounts
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

    // builds a FileInfo-shaped object mirroring the previous gio.ls() output
    async build_file_obj(dir, name) {
        const href = path.join(dir, name);
        const lstats = await fs.promises.lstat(href);
        const is_symlink = lstats.isSymbolicLink();

        let stats = lstats;
        let broken_symlink = false;
        if (is_symlink) {
            try {
                stats = await fs.promises.stat(href);
            } catch (err) {
                stats = lstats;
                broken_symlink = true;
            }
        }

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
            id: btoa(href),
        };
    }

    async get_files(location, add_tab, window_id = null, request_token = null) {
        const request_key = Number.isInteger(window_id) ? window_id : 'default';
        this.latest_request_tokens.set(request_key, request_token);
        const MAX_TOKENS = 10;
        if (this.latest_request_tokens.size > MAX_TOKENS) {
            const oldestKeys = Array.from(this.latest_request_tokens.keys()).slice(0, this.latest_request_tokens.size - MAX_TOKENS);
            oldestKeys.forEach(key => this.latest_request_tokens.delete(key));
        }
        const is_current_request = () => {
            return this.latest_request_tokens.get(request_key) === request_token;
        };

        let names;
        try {
            names = await fs.promises.readdir(location);
        } catch (err) {
            if (!is_current_request()) {
                return;
            }
            parentPort.postMessage({
                cmd: 'set_msg',
                msg: (err && err.message) ? err.message : String(err),
                window_id: window_id,
                request_token: request_token
            });
            return;
        }

        const files_arr = new Array(names.length);
        let next_index = 0;
        const worker_count = Math.min(FILE_METADATA_CONCURRENCY, names.length);

        const build_next_file = async () => {
            while (next_index < names.length) {
                if (!is_current_request()) {
                    return;
                }
                const index = next_index++;
                try {
                    files_arr[index] = await this.build_file_obj(location, names[index]);
                } catch (err) {
                    if (!is_current_request()) {
                        return;
                    }
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: (err && err.message) ? err.message : String(err),
                        window_id: window_id,
                        request_token: request_token
                    });
                }
            }
        };

        await Promise.all(Array.from({ length: worker_count }, build_next_file));

        if (!is_current_request()) {
            return;
        }

        parentPort.postMessage({
            cmd: 'ls_done',
            files_arr: files_arr.filter(Boolean),
            add_tab: add_tab,
            window_id: window_id,
            request_token: request_token
        });
    }

    // recursively sums file sizes under source; skips symlinks to avoid loops/double-counting
    async get_folder_size(source) {
        let names;
        try {
            names = await fs.promises.readdir(source);
        } catch (err) {
            return 0;
        }

        let total = 0;
        for (const name of names) {
            const href = path.join(source, name);
            let lstats;
            try {
                lstats = await fs.promises.lstat(href);
            } catch (err) {
                continue;
            }

            if (lstats.isSymbolicLink()) {
                continue;
            }

            if (lstats.isDirectory()) {
                total += await this.get_folder_size(href);
            } else {
                total += lstats.size;
            }
        }

        return total;
    }

}

const fileManager = new FileManager();

if (!isMainThread) {

    parentPort.on('message', (data) => {
        const cmd = data.cmd;
        switch (cmd) {

            // List files in directory
            case 'ls':
                fileManager.get_files(data.location, data.add_tab, data.window_id, data.request_token);
                break;

            // Get folder size for properties view.
            case 'get_folder_size': {

                const source = data && typeof data.source === 'string' ? data.source : '';

                console.log('Getting folder size for source:', source);

                if (!source) {
                    parentPort.postMessage({
                        cmd: 'folder_size_error',
                        source,
                        msg: 'Error: invalid source path for folder size.'
                    });
                    break;
                }

                fileManager.get_folder_size(source).then((size) => {
                    parentPort.postMessage({
                        cmd: 'folder_size_done',
                        source,
                        size
                    });
                }).catch((err) => {
                    parentPort.postMessage({
                        cmd: 'folder_size_error',
                        source,
                        msg: (err && err.message) ? err.message : String(err)
                    });
                });

                break;
            }

            default:
                break;
        }
    });

}
