// @ts-nocheck
const { parentPort, workerData, isMainThread } = require('worker_threads');
// const gio = require('../gio/build/Release/gio.node');
const libfs = require('../common/libfs');
const fs = require('fs');
const path = require('path');
const safe = require('../common/safe_replace');


class Utilities {

    constructor() {
        this.files_arr = [];
        this.cp_recursive = 0;
        this.cancel_get_files = false;
        this.cancel_requested = false;
    }

    cancel() {
        this.cancel_requested = true;
        this.cancel_get_files = true;
    }

    // sanitize file name
    sanitize_file_name(href) {
        return href.replace(/\n/g, ' ').replace(/[^a-z0-9]/gi, '_');
    }

    get_files_arr(source, destination, callback) {

        if (this.cancel_requested) {
            return callback(null, []);
        }

        this.cp_recursive++;

        let file;
        try {
            file = libfs.get_file(source);
        } catch (err) {
            return callback(`Error getting file: ${err.message}`);
        }

        file.source = source;
        file.destination = destination;
        this.files_arr.push(file);
        if (file.is_symlink) {
            if (--this.cp_recursive === 0) {
                const entries = this.files_arr;
                this.files_arr = [];
                return callback(null, entries);
            }
            return;
        }

        libfs.ls(source, (err, dirents) => {

            if (err) {
                return callback(`Error listing directory: ${err.message}`);
            }
            for (let i = 0; i < dirents.length; i++) {
                if (this.cancel_requested) {
                    break;
                }
                let f = dirents[i];

                if (f.filesystem.toLocaleLowerCase() === 'ntfs') {
                    // sanitize file name
                    f.name = f.name.replace(/[^a-z0-9]/gi, '_');
                }
                if (f.is_dir && !f.is_symlink) {
                    this.get_files_arr(f.href, path.format({ dir: destination, base: f.name }), callback);
                } else {
                    f.source = f.href;
                    f.destination = path.format({ dir: destination, base: f.name });
                    this.files_arr.push(f);
                }
            }
            if (--this.cp_recursive == 0 || this.cancel_get_files) {
                let file_arr1 = this.files_arr;
                this.files_arr = [];
                return callback(null, file_arr1);
            }
        });
    }

    // paste
    async poste(copy_arr) {

        this.cancel_requested = false;
        this.cancel_get_files = false;

        let source = '';
        let destination = '';

        let files_arr = [];
        const completed = [];
        const failures = [];

        // calculate max bytes to copy
        let max = 0;
        let size = 0;
        for (const entry of copy_arr) {
            let f;
            try {
                if (!fs.existsSync(entry.source) && !libfs.get_file(entry.source).is_symlink) throw new Error(`File not found: ${entry.source}`);
                f = { ...entry, ...libfs.get_file(entry.source), source: entry.source, destination: entry.destination };
            } catch (error) { failures.push({ ...entry, error: error.message }); continue; }

            if (this.cancel_requested) {
                break;
            }

            try {
                await safe.assert_destination(f.source, f.destination);
                if (f.overwrite) {
                    await safe.transfer(f.source, f.destination, {
                        overwrite: true, journal_dir: workerData?.journal_dir, cancelled: () => this.cancel_requested
                    });
                    completed.push(f);
                    destination = f.destination;
                    continue;
                }
            } catch (error) {
                failures.push({ ...f, error: error.message });
                parentPort.postMessage({ cmd: 'set_msg', msg: error.message });
                continue;
            }

            // cal size
            size = parseInt(f.size);
            if (size && !f.is_dir) {
                max += parseInt(f.size);
            }
            // handle directories
            if (f.is_dir && !f.is_symlink) {
                // Expand directory entries before starting copy so progress can track actual work.
                const dirents = await new Promise((resolve, reject) => {
                    this.get_files_arr(f.source, f.destination, (err, entries) => {
                        if (err) {
                            reject(new Error(err));
                            return;
                        }
                        resolve(entries || []);
                    });
                }).catch(error => {
                    failures.push({ ...f, error: error.message });
                    this.files_arr = [];
                    this.cp_recursive = 0;
                    return [];
                });
                dirents.forEach((ff) => {
                    files_arr.push(ff);
                    const ffSize = parseInt(ff.size);
                    if (ffSize) {
                        max += ffSize;
                    }
                });
            } else {
                files_arr.push(f);
            }
        }

        // sort so we create all the directories first
        files_arr.sort((a, b) => {
            return a.source.length - b.source.length;
        });

        const failed_directories = [];
        let bytes_copied = 0;
        let cancelled = false;
        for (const f of files_arr) {

            if (this.cancel_requested) {
                cancelled = true;
                break;
            }

            if (failed_directories.some(directory => f.source.startsWith(directory + path.sep))) {
                failures.push({ ...f, error: 'Parent directory could not be created.' });
                continue;
            }
            const root = copy_arr.find(entry => f.source === entry.source || f.source.startsWith(entry.source + path.sep));
            if (root) {
                try {
                    await safe.assert_parents(f.source, root.source);
                    await safe.assert_parents(f.destination, root.destination);
                } catch (error) {
                    failures.push({ ...f, error: error.message });
                    parentPort.postMessage({ cmd: 'set_msg', msg: error.message });
                    continue;
                }
            }

            source = f.source;
            destination = f.destination;
            if (f.is_dir && !f.is_symlink) {
                // fs.mkdirSync(destination, { recursive: true });
                try {
                    if (!libfs.mkdir(destination)) throw new Error(`Could not create directory: ${destination}`);
                } catch (error) { failed_directories.push(f.source); failures.push({ ...f, error: error.message }); continue; }

                // // get size of destination directory
                // let size = fs.statSync(destination).size;
                // if (size) {
                //     bytes_copied += parseInt(size);
                // }

            } else {
                let file_bytes_copied = 0;
                const res = await new Promise((resolve, reject) => {
                    libfs.cp_async(source, destination, (err, result) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        if (result.completed) {
                            resolve(result || {});
                        } else {
                            file_bytes_copied = result.current_num_bytes || 0;
                            const total_progress = bytes_copied + file_bytes_copied;
                            let set_progress_data = {
                                cmd: 'set_progress',
                                operation: 'copy',
                                can_cancel: true,
                                status: `Copying ${f.name}`,
                                max: max,
                                value: Math.min(total_progress, max)
                            };
                            parentPort.postMessage(set_progress_data);
                        }
                    });
                }).catch((err) => {
                    failures.push({ ...f, error: err.message || String(err) });
                    let remove_card = {
                        cmd: 'remove_item',
                        id: f.id
                    }
                    parentPort.postMessage(remove_card);

                    let msg = {
                        cmd: 'set_msg',
                        msg: err
                    }
                    parentPort.postMessage(msg);

                    return null;
                });

                if (!res) {
                    continue;
                }

                bytes_copied += file_bytes_copied || parseInt(f.size) || 0;

                let set_progress = {
                    cmd: 'set_progress',
                    operation: 'copy',
                    can_cancel: true,
                    status: `Copying ${f.name}`,
                    max: max,
                    value: Math.min(bytes_copied, max)
                }
                parentPort.postMessage(set_progress);

                let msg = {
                    cmd: 'set_msg',
                    msg: { text: '', loading: true }
                }
                parentPort.postMessage(msg);

            }
            completed.push(f);

        }

        let set_progress = {
            cmd: 'set_progress',
            operation: 'copy',
            can_cancel: false,
            max: 0,
            value: 0
        }
        const cp_done = {
            cmd: 'cp_done',
            cancelled: cancelled || this.cancel_requested,
            completed, failures,
            cancelled_entries: (cancelled || this.cancel_requested) ? files_arr.filter(file => !completed.includes(file) && !failures.some(failure => failure.source === file.source)) : [],
            destination: destination
        }



        parentPort.postMessage(set_progress);

        let msg = {
            cmd: 'set_msg',
            msg: (cancelled || this.cancel_requested) ? 'Copy cancelled.' : failures.length ? `Copy incomplete: ${failures.length} items failed.` : `Done copying (${completed.length}) files`
        }
        parentPort.postMessage(msg);
        parentPort.postMessage(cp_done);

        files_arr = [];
        copy_arr = [];

    }

}

const utilities = new Utilities();
let jobs = Promise.resolve();

if (!isMainThread) {

    parentPort.on('message', (data) => {
        const cmd = data.cmd;
        switch (cmd) {
            case 'paste':
                jobs = jobs.then(() => utilities.poste(data.copy_arr)).catch((err) => {
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: err && err.message ? err.message : String(err)
                    });
                    parentPort.postMessage({
                        cmd: 'cp_done', completed: [], failures: data.copy_arr.map(entry => ({ ...entry, error: err.message })), cancelled: utilities.cancel_requested
                    });
                    parentPort.postMessage({
                        cmd: 'set_progress',
                        operation: 'copy',
                        can_cancel: false,
                        max: 0,
                        value: 0,
                        status: ''
                    });
                });
                break;
            case 'cancel':
                utilities.cancel();
                break;
            case 'cp_template': {

                let dup_idx = 1;
                let f = data;
                while (fs.existsSync(f.destination)) {
                    let ext = path.extname(f.destination);
                    let base = path.basename(f.destination, ext);
                    let dir = path.dirname(f.destination);
                    let new_base = `${base} (Copy ${dup_idx})`;
                    f.destination = path.join(dir, new_base + ext);
                    dup_idx++;
                }
                try {
                    fs.copyFileSync(f.source, f.destination);
                    parentPort.postMessage({ cmd: 'cp_template_done', destination: f.destination });
                } catch (err) {
                    parentPort.postMessage({ cmd: 'msg', msg: err.message });
                }

                break;
            }
            default:
                break;
        }
    });

}
module.exports = { Utilities };
