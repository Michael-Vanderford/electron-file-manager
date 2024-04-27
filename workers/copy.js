const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const { pipeline } = require('stream');
const path = require('path');
const gio = require('../gio/build/Release/obj.target/gio')

let progress_id = 0;
let chunk_size = 0;
let max = 0;

class Utilities {

    constructor() {
        this.cp_recursive = 0;
        this.file_arr = [];
        this.cancel_get_files = false;
    }

    getDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ms = String(now.getMilliseconds()).padStart(3, '0');

        return `${year}-${day}-${month} ${hours}:${minutes}:${seconds}.${ms}`;
    }

    get_files_arr (source, base_destination, callback) {

        this.cp_recursive++

        // Check if source exists
        let file = gio.get_file(source);
        if (!file) {
            return callback('File not found');
        }

        let destination = base_destination; //path.join(base_destination, path.basename(source));
        file.destination = destination;

        this.file_arr.push(file);
        gio.ls(source, (err, dirents) => {

            if (err) {
                return callback(err);
            }

            for (let i = 0; i < dirents.length; i++) {

                let file = dirents[i];

                if (file.is_dir && !file.is_symlink) {
                    this.get_files_arr(file.href, destination, callback)
                } else {

                    let file_obj = {
                        type: 'file',
                        source: file.href,
                        destination: destination, //path.join(destination, path.basename(file.href)),
                        size: file.size,
                        is_symlink: file.is_symlink,
                        file: file
                    }

                    // handle symlinks
                    if (file.is_symlink) {
                        console.log('symlink:', file.href)
                        // return;
                    } else {
                        this.file_arr.push(file_obj)
                    }
                }

            }

            if (--this.cp_recursive == 0) {
                // parentPort.postMessage({cmd: 'msg', msg: ``})

                let file_arr1 = this.file_arr;
                this.file_arr = []
                return callback(null, file_arr1);
            }
        })
    }

    get_files_promise(source, destination) {
        let files_arr = [];
        return new Promise((resolve, reject) => {
            utilities.get_files_arr(source, destination, (err, file_arr) => {
                if (err) {
                    parentPort.postMessage({cmd: 'msg', err: err});
                }
                for (let i = 0; i < file_arr.length; i++) {
                    files_arr.push(file_arr[i])
                }
                resolve(files_arr);
            })
        });
    }

}

const utilities = new Utilities();

// Handle Worker Messages
parentPort.on('message', async data => {
    // Copy Files
    if (data.cmd === 'copy') {

        let c = 0;
        let files_arr = [];
        let selected_files_arr = data.selected_files_arr;
        let root_destination = data.destination

        // let progress_id = data.id;
        progress_id = Math.floor(Math.random() * 100);

        let total_bytes0 = 0;
        let total_bytes = 0;
        let bytes_copied = 0;

        let current_num_bytes = 0;
        let current_num_bytes0 = 0;

        // get all files and directories to copy
        for (let i = 0; i < selected_files_arr.length; i++) {

            let source = selected_files_arr[i];
            let file = gio.get_file(source);

            let destination = path.join(root_destination, path.basename(source));

            // Check if destination exists
            if (source === destination) {
                if (file.is_dir) {
                    while (fs.existsSync(destination)) {
                        destination = `${destination} (copy)`;
                    }
                    fs.mkdirSync(file.destination);

                }
            }

            // check directory
            if (file.is_dir) {
                const dir_files = await utilities.get_files_promise(source, destination);
                files_arr.push(...dir_files);

            // files
            } else {
                file.source = file.href;
                // remove file name since its getting added back on further down
                file.destination = path.dirname(destination);
                files_arr.push(file);
            }
        }

        max = 0;
        for (let i = 0; i < files_arr.length; i++) {
            if (!files_arr[i].is_dir) {
                max += files_arr[i].size;
            }
        }

        // sort files by folder length
        // files_arr.sort((a, b) => {
        //     return b.source - a.source;
        // })

        files_arr.forEach((file, idx) => {

            // directory
            if (file.is_dir) {

                if (!fs.existsSync(file.destination)) {
                    fs.mkdirSync(file.destination);
                }

            // file
            } else {

                const destination = path.join(file.destination, path.basename(file.source));
                gio.cp_async(file.source, destination, (res) => {

                    total_bytes0 = total_bytes;
                    total_bytes = res.total_bytes;

                    if (res.bytes_copied > 0) {
                        bytes_copied += parseInt(res.bytes_copied);
                    }

                    // if (bytes_copied < 0) {
                    //    console.log('Error:', res);
                    // }

                    // bytes_copied = current_num_bytes - bytes_copied0;
                    // bytes_copied0 = current_num_bytes;

                    current_num_bytes = parseInt(res.current_num_bytes) - current_num_bytes0;
                    current_num_bytes0 = parseInt(res.current_num_bytes);

                    // console.log(current_num_bytes, total_bytes, bytes_copied, max)

                    let progress_data = {
                        id: progress_id,
                        cmd: 'progress',
                        msg: `Copying `,  // ${path.basename(f.source)}`,
                        max: max,
                        value: bytes_copied
                    }
                    parentPort.postMessage(progress_data);

                    if (bytes_copied >= max && bytes_copied > 0 && max > 0) {

                        // let close_progress = {
                        //    id: progress_id,
                        //    cmd: 'progress',
                        //    msg: ``,
                        //    max: 0,
                        //    value: 0
                        // }
                        // parentPort.postMessage(close_progress);

                        // update cards
                        //selected_files_arr.forEach((f, i) => {
                        //    let source = f;
                        //    let destination = path.join(root_destination, path.basename(source));
                        //    let update_card = {
                        //        cmd: 'get_card',
                        //        destination: destination
                        //    }
                        //    parentPort.postMessage(update_card);
                        //})

                        // clear selected files array
                        // selected_files_arr = [];

                        // let copy_done = {
                        //     id: data.id,
                        //     cmd: 'copy_done',
                        //     bytes_copied: bytes_copied,
                        //     total_bytes: total_bytes,
                        //     max: max
                        // }
                        // parentPort.postMessage(copy_done);

                        // cleanup
                        // current_num_bytes = 0;
                        // total_bytes = 0;

                        console.log(max, bytes_copied, progress_id)

                        bytes_copied = 0;
                        max = 0;

                    }

                });

            }

        });

    }

})

