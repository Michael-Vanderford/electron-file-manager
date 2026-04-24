// @ts-nocheck
const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const gio = require('../gio/build/Release/gio.node');

class FileManager {

    constructor() {

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

    get_files(location) {

        // populate file_obj with file data
        let files_arr = [];

        gio.ls(location, (err, dirents) => {
            if (err) {

                let msg = {
                    cmd: 'set_msg',
                    msg: err
                }
                parentPort.postMessage(msg);
                return;
            }
            dirents.forEach(file => {
                try {
                    let f = file;
                    f.id = btoa(f.href);
                    files_arr.push(f);
                } catch (err) {
                    let msg = {
                        cmd: 'set_msg',
                        msg: err
                    }
                    parentPort.postMessage(msg);
                }

            });
        });



        return files_arr;

    }

}

const fileManager = new FileManager();

if (!isMainThread) {

    parentPort.on('message', (data) => {
        const cmd = data.cmd;
        switch (cmd) {

            // List files in directory
            case 'ls':
                parentPort.postMessage({
                    cmd: 'ls_done',
                    files_arr: fileManager.get_files(data.location),
                    add_tab: data.add_tab
                });
                break;

            // Get folder size for properties view.
            case 'get_folder_size': {
                const source = data && typeof data.source === 'string' ? data.source : '';

                if (!source) {
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: 'Error: invalid source path for folder size.'
                    });
                    break;
                }

                try {
                    const size = Number(gio.du(source)) || 0;

                    parentPort.postMessage({
                        cmd: 'folder_size_done',
                        source,
                        size
                    });
                } catch (err) {
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: (err && err.message) ? err.message : String(err)
                    });
                }

                break;
            }

            default:
                break;
        }
    });

}
