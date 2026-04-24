// @ts-nocheck
const { parentPort, isMainThread } = require('worker_threads');
const gio = require('../gio/build/Release/gio.node');
const path = require('path');

class DeleteWorker {

    constructor(options = {}) {
        this.parent_port = options.parentPort || parentPort;
        this.gio = options.gio || gio;
        this.deleted_files = 0;
        this.total_files = 0;
        this.cancel_requested = false;
        this.scan_recursive = 0;
        this.files_arr = [];
    }

    post_message(payload) {
        if (this.parent_port && typeof this.parent_port.postMessage === 'function') {
            this.parent_port.postMessage(payload);
        }
    }

    send_progress(status, value, max_override) {
        const max_value = typeof max_override === 'number' ? max_override : this.total_files;
        this.post_message({
            cmd: 'set_progress',
            operation: 'delete',
            can_cancel: true,
            status,
            max: max_value,
            value: Math.min(value, max_value)
        });
    }

    cancel() {
        this.cancel_requested = true;
    }

    throw_if_cancelled() {
        if (this.cancel_requested) {
            const err = new Error('Delete cancelled');
            err.code = 'DELETE_CANCELLED';
            throw err;
        }
    }

    get_files_arr(source, callback) {
        if (this.cancel_requested) {
            return callback(null, []);
        }

        this.scan_recursive += 1;

        let file;
        try {
            file = this.gio.get_file(source);
        } catch (err) {
            return callback(new Error(`Error getting file: ${err.message}`));
        }

        this.files_arr.push(file);

        this.gio.ls(source, (err, dirents) => {
            if (err) {
                return callback(new Error(`Error listing directory: ${err.message || err}`));
            }

            for (const f of dirents) {
                if (this.cancel_requested) {
                    break;
                }

                const is_dir = !!f.is_dir;
                const is_symlink = !!f.is_symlink;
                if (is_dir && !is_symlink) {
                    this.get_files_arr(f.href, callback);
                } else {
                    this.files_arr.push(f);
                }
            }

            if (--this.scan_recursive === 0 || this.cancel_requested) {
                const list = this.files_arr;
                this.files_arr = [];
                return callback(null, list);
            }
        });
    }

    async get_files_arr_async(source) {
        this.scan_recursive = 0;
        this.files_arr = [];

        return new Promise((resolve, reject) => {
            this.get_files_arr(source, (err, entries) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(entries || []);
            });
        });
    }

    async count_files(target_path, is_dir) {
        if (!is_dir) {
            return 1;
        }

        try {
            const entries = await this.get_files_arr_async(target_path);
            return entries.reduce((total, entry) => {
                const is_dir_entry = !!entry.is_dir;
                const is_symlink_entry = !!entry.is_symlink;
                return total + (is_dir_entry && !is_symlink_entry ? 0 : 1);
            }, 0);
        } catch (err) {
            return 0;
        }
    }

    async delete_path(target_path, is_dir, item_name = '') {
        this.throw_if_cancelled();

        try {
            this.gio.rm(target_path);
        } catch (err) {
            throw new Error(err && err.message ? err.message : String(err));
        }

        if (!is_dir) {
            this.deleted_files += 1;
            const delete_name = item_name || path.basename(target_path) || target_path;
            this.send_progress(`Deleting ${delete_name}`, this.deleted_files);
        }
    }

    async get_delete_plan(item) {
        if (!item.is_dir) {
            return [item];
        }

        const entries = await this.get_files_arr_async(item.href);
        entries.sort((a, b) => (b.href || '').length - (a.href || '').length);
        return entries;
    }

    async run(delete_arr) {
        const deleted_items = [];
        let failed_items = 0;
        let cancelled = false;
        const scan_start = Date.now();
        const scan_timings = [];
        const scanned_delete_plans = [];

        this.cancel_requested = false;
        this.deleted_files = 0;
        this.total_files = 0;

        // Show visible progress while counting files on slow filesystems (for example SMB shares).
        this.send_progress(`Scanning ${delete_arr.length} items`, 0, 1);

        for (const item of delete_arr) {
            if (this.cancel_requested) {
                cancelled = true;
                break;
            }

            const item_scan_start = Date.now();
            const delete_plan = await this.get_delete_plan(item);
            const counted_files = delete_plan.reduce((total, entry) => {
                const is_dir_entry = !!entry.is_dir;
                const is_symlink_entry = !!entry.is_symlink;
                return total + (is_dir_entry && !is_symlink_entry ? 0 : 1);
            }, 0);
            const item_scan_ms = Date.now() - item_scan_start;

            this.total_files += counted_files;
            scanned_delete_plans.push({ item, delete_plan });
            scan_timings.push({
                href: item.href,
                files: counted_files,
                ms: item_scan_ms
            });

            if (item_scan_ms > 500) {
                this.post_message({
                    cmd: 'set_msg',
                    msg: `Scanning slow path: ${item.href} (${item_scan_ms}ms)`
                });
            }
        }

        const scan_elapsed_ms = Date.now() - scan_start;
        const slowest_scan = scan_timings.reduce((slowest, entry) => {
            if (!slowest || entry.ms > slowest.ms) {
                return entry;
            }
            return slowest;
        }, null);

        const slowest_msg = slowest_scan
            ? ` Slowest: ${slowest_scan.href} (${slowest_scan.ms}ms, ${slowest_scan.files} files).`
            : '';

        console.log(`[delete_worker] scan completed in ${scan_elapsed_ms}ms for ${delete_arr.length} items (${this.total_files} files).${slowest_msg}`);
        this.post_message({
            cmd: 'set_msg',
            msg: `Scan complete in ${scan_elapsed_ms}ms (${this.total_files} files). Starting delete...`
        });

        if (this.total_files === 0) {
            // Fallback: progress by selected items when file counting is unavailable.
            this.total_files = delete_arr.length;
        }

        if (cancelled) {
            this.post_message({
                cmd: 'set_msg',
                msg: 'Delete cancelled during scan.'
            });
            this.post_message({
                cmd: 'delete_done',
                deleted_items,
                failed_items,
                cancelled,
                deleted_files: this.deleted_files
            });
            return;
        }

        this.send_progress(`Deleting ${delete_arr.length} items`, 0);

        for (const { item, delete_plan } of scanned_delete_plans) {
            if (this.cancel_requested) {
                cancelled = true;
                break;
            }

            try {
                for (const entry of delete_plan) {
                    this.throw_if_cancelled();
                    await this.delete_path(entry.href, entry.is_dir, entry.name);
                }
                deleted_items.push(item);
            } catch (err) {
                if (err && err.code === 'DELETE_CANCELLED') {
                    cancelled = true;
                    break;
                }

                failed_items += 1;
                this.post_message({
                    cmd: 'set_msg',
                    msg: `Error deleting ${item.href}: ${err.message}`
                });
            }
        }

        this.post_message({
            cmd: 'delete_done',
            deleted_items,
            failed_items,
            cancelled,
            deleted_files: this.deleted_files
        });
    }
}

module.exports = {
    DeleteWorker
};

const delete_worker = new DeleteWorker();

if (!isMainThread) {
    parentPort.on('message', (data) => {
        if (data.cmd === 'delete') {
            delete_worker.run(data.delete_arr).catch((err) => {
                parentPort.postMessage({
                    cmd: 'set_msg',
                    msg: `Error deleting files: ${err.message}`
                });

                parentPort.postMessage({
                    cmd: 'delete_done',
                    deleted_items: [],
                    failed_items: data.delete_arr ? data.delete_arr.length : 0,
                    deleted_files: delete_worker.deleted_files
                });
            });
        } else if (data.cmd === 'cancel') {
            delete_worker.cancel();
        }
    });
}