const { parentPort, isMainThread } = require('worker_threads');
const gio = require('../gio/build/Release/gio.node');
const fs = require('fs');
const path = require('path');

class Utilities {
    constructor() {
        this.move_arr = [];
        this.cp_recursive = 0;
        this.cancel_get_files = false;
        this.cancel_requested = false;
    }

    cancel() {
        this.cancel_requested = true;
        this.cancel_get_files = true;
    }

    get_files_arr(source, destination, callback) {
        if (this.cancel_requested) {
            return callback(null, []);
        }

        this.cp_recursive++;

        let file;
        try {
            file = gio.get_file(source);
        } catch (err) {
            return callback(new Error(`Error getting file: ${err.message}`));
        }

        file.source = source;
        file.destination = destination;
        this.move_arr.push(file);

        gio.ls(source, (err, dirents) => {
            if (err) {
                return callback(new Error(`Error listing directory: ${err.message}`));
            }

            for (const f of dirents) {
                if (this.cancel_requested) {
                    break;
                }

                if (f.filesystem.toLowerCase() === 'ntfs') {
                    f.name = f.name.replace(/[^a-z0-9]/gi, '_');
                }
                f.source = f.href;
                f.destination = path.join(destination, f.name);

                if (f.is_dir) {
                    this.get_files_arr(f.source, f.destination, callback);
                } else {
                    this.move_arr.push(f);
                }
            }

            if (--this.cp_recursive === 0 || this.cancel_get_files) {
                const move_arr_copy = [...this.move_arr];
                this.move_arr = [];
                callback(null, move_arr_copy);
            }
        });
    }

    async move(move_arr) {
        this.cancel_requested = false;
        this.cancel_get_files = false;
        this.cp_recursive = 0;

        let files_arr = [];
        let total_size = 0;
        let cancelled = false;

        for (const f of move_arr) {
            if (this.cancel_requested) {
                cancelled = true;
                break;
            }

            if (f.size) {
                total_size += parseInt(f.size, 10);
            }

            if (f.is_dir) {
                const dirents = await new Promise((resolve, reject) => {
                    this.get_files_arr(f.source, f.destination, (err, entries) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(entries || []);
                    });
                }).catch((err) => {
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: err.message || String(err)
                    });
                    return [];
                });

                files_arr.push(...dirents);
                for (const ff of dirents) {
                    if (ff.size && !ff.is_dir) {
                        total_size += parseInt(ff.size, 10);
                    }
                }
            } else {
                files_arr.push(f);
            }
        }

        files_arr.sort((a, b) => a.source.length - b.source.length);

        let bytes_copied = 0;

        for (const f of files_arr) {
            if (this.cancel_requested) {
                cancelled = true;
                break;
            }

            if (f.is_dir) {
                try {
                    fs.mkdirSync(f.destination, { recursive: true });
                } catch (err) {
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: `Error creating directory ${f.destination}: ${err.message}`
                    });
                }
                continue;
            }

            const res = await new Promise((resolve, reject) => {
                gio.mv(f.source, f.destination, (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(result || {});
                });
            }).catch((err) => {
                parentPort.postMessage({
                    cmd: 'set_msg',
                    msg: `Error moving file from ${f.source} to ${f.destination}: ${err.message}`
                });
                return null;
            });

            if (!res) {
                continue;
            }

            if (res.bytes_copied) {
                bytes_copied += parseInt(res.bytes_copied, 10) || 0;
            } else if (f.size) {
                bytes_copied += parseInt(f.size, 10) || 0;
            }

            parentPort.postMessage({
                cmd: 'set_progress',
                operation: 'move',
                can_cancel: true,
                status: `Moving ${f.name}`,
                max: total_size,
                value: Math.min(bytes_copied, total_size)
            });
        }

        if (!cancelled) {
            const dirs = files_arr.filter((f) => f.is_dir);
            for (const dir of dirs) {
                try {
                    fs.rmSync(dir.source, { recursive: true, force: true });
                } catch (err) {
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: `Error removing directory ${dir.source}: ${err.message}`
                    });
                }
            }
        }

        parentPort.postMessage({
            cmd: 'set_progress',
            operation: 'move',
            can_cancel: false,
            max: 0,
            value: 0,
            status: ''
        });

        parentPort.postMessage({
            cmd: 'set_msg',
            msg: cancelled ? 'Move cancelled.' : `Done moving ${files_arr.length} files.`
        });

        parentPort.postMessage({
            cmd: 'mv_done',
            cancelled,
            files_arr: files_arr
        });
    }
}

const utilities = new Utilities();

if (!isMainThread) {
    parentPort.on('message', (data) => {
        if (data.cmd === 'move') {
            utilities.move(data.move_arr).catch((err) => {
                parentPort.postMessage({
                    cmd: 'set_msg',
                    msg: err && err.message ? err.message : String(err)
                });
                parentPort.postMessage({
                    cmd: 'set_progress',
                    operation: 'move',
                    can_cancel: false,
                    max: 0,
                    value: 0,
                    status: ''
                });
                parentPort.postMessage({
                    cmd: 'mv_done',
                    cancelled: true,
                    files_arr: []
                });
            });
        } else if (data.cmd === 'cancel') {
            utilities.cancel();
        } else {
            parentPort.postMessage({
                cmd: 'set_msg',
                msg: `Unknown command: ${data.cmd}`
            });
        }
    });
}
