// @ts-nocheck
const { parentPort, workerData, isMainThread } = require('worker_threads');
const gio = require('../gio/build/Release/gio.node');
const fs = require('fs');
const path = require('path');


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
            file = gio.get_file(source);
        } catch (err) {
            return callback(`Error getting file: ${err.message}`);
        }

        file.source = source;
        file.destination = destination;
        this.files_arr.push(file);

        gio.ls(source, (err, dirents) => {

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
                if (f.is_dir) {
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

        // calculate max bytes to copy
        let max = 0;
        let size = 0;
        for (const f of copy_arr) {

            if (this.cancel_requested) {
                break;
            }

            // cal size
            size = parseInt(f.size);
            if (size && !f.is_dir) {
                max += parseInt(f.size);
            }
            // handle directories
            if (f.is_dir) {
                // Expand directory entries before starting copy so progress can track actual work.
                const dirents = await new Promise((resolve, reject) => {
                    this.get_files_arr(f.source, f.destination, (err, entries) => {
                        if (err) {
                            reject(new Error(err));
                            return;
                        }
                        resolve(entries || []);
                    });
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

        let bytes_copied = 0;
        let cancelled = false;
        for (const f of files_arr) {

            if (this.cancel_requested) {
                cancelled = true;
                break;
            }

            source = f.source;
            destination = f.destination;
            if (f.is_dir) {
                // fs.mkdirSync(destination, { recursive: true });
                gio.mkdir(destination);

                // // get size of destination directory
                // let size = fs.statSync(destination).size;
                // if (size) {
                //     bytes_copied += parseInt(size);
                // }

            } else {
                // fs.copyFileSync(source, destination);
                const res = await new Promise((resolve, reject) => {
                    gio.cp_async(source, destination, (err, result) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(result || {});
                    });
                }).catch((err) => {
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

                if (res.bytes_copied > 0) {
                    bytes_copied += parseInt(res.bytes_copied);
                } else {
                    // Fall back to file metadata size when backend doesn't report copied bytes.
                    const fallbackSize = parseInt(f.size);
                    if (fallbackSize) {
                        bytes_copied += fallbackSize;
                    }
                }

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
                    msg: `<img src="../renderer/icons/spinner.gif" style="width: 12px; height: 12px" alt="loading" />`
                }
                parentPort.postMessage(msg);

            }

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
            cancelled,
            destination: destination
        }

        parentPort.postMessage(cp_done);

        parentPort.postMessage(set_progress);

        let msg = {
            cmd: 'set_msg',
            msg: cancelled ? 'Copy cancelled.' : `Done copying (${files_arr.length}) files`
        }
        parentPort.postMessage(msg);

        files_arr = [];
        copy_arr = [];

    }

}

const utilities = new Utilities();

if (!isMainThread) {

    parentPort.on('message', (data) => {
        const cmd = data.cmd;
        switch (cmd) {
            case 'paste':
                utilities.poste(data.copy_arr).catch((err) => {
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: err && err.message ? err.message : String(err)
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