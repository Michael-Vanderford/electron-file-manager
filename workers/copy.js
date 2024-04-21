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

    get_files_arr (source, base_destination, callback) {

        this.cp_recursive++

        let file = gio.get_file(source);

        let destination = path.join(base_destination, path.basename(source));

        // Check if destination exists
        while (fs.existsSync(destination)) {
            destination = `${destination} (Copy)`;
        }

        file.destination = destination;

        this.file_arr.push(file);

        gio.ls(source, (err, dirents) => {

            if (err) {
                return callback(err);
            }

            for (let i = 0; i < dirents.length; i++) {

                let file = dirents[i];

                if (file.is_dir && !file.is_symlink) {

                    // add top level directory
                    // this.file_arr.push({type: 'directory', source: source, destination: destination});

                    // get files in directory
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

    copy(sourcePath, destinationPath) { // 64KB chunks by default

        // let bytesCopied = 0;
        // const totalSize = fs.statSync(sourcePath).size;


        const readStream = fs.createReadStream(sourcePath, {highWaterMark: 1024 }); // Double the chunk size for buffer
        const writeStream = fs.createWriteStream(destinationPath, {highWaterMark: 1024  });

        readStream.on('error', (error) => {
            console.error('Error reading source file:', error);
            // Handle errors gracefully, e.g., log, notify user, retry with backoff
            parentPort.postMessage({ cmd: 'msg', err: error }); // Send error message to parent
        });

        writeStream.on('error', (error) => {
            // Handle errors gracefully, e.g., log, notify user, retry with backoff
            // parentPort.postMessage({ cmd: 'msg', err: error }); // Send error message to parent
            let file = gio.get_file(sourcePath);
            console.error('Error writing to destination file:', error);
            // return;
        });

        readStream.on('data', (chunk) => {

            readStream.pause();

            // // setTimeout(() => {
            if (!writeStream.write(chunk)) {
                readStream.resume();
            }
            // // }, 1000);

            // Progress
            chunk_size += chunk.length;
            let data = {
                id: progress_id,
                cmd: 'progress',
                msg: `Copying `,  // ${path.basename(f.source)}`,
                max: max,
                value: chunk_size
            }
            parentPort.postMessage(data);

        });

        writeStream.on('drain', () => {
            readStream.resume();
        });

        writeStream.on('finish', () => {
            console.log(`File copied successfully: ${path.basename(sourcePath)}`);
            parentPort.postMessage({ cmd: 'copy_done', destination: destinationPath }); // Send copy_done message
        });

        readStream.on('end', () => {
            writeStream.end();
        });

    }

}

const utilities = new Utilities();

// Handle Worker Messages
parentPort.on('message', async data => {
    // Copy Files
    if (data.cmd === 'copy') {

        let files_arr = [];
        let selected_files_arr = data.selected_files_arr;
        let root_destination = data.destination

        // get all files and directories to copy
        for (let i = 0; i < selected_files_arr.length; i++) {

            let source = selected_files_arr[i];
            let file = gio.get_file(source);

            if (file.is_dir) {
                const dir_files = await utilities.get_files_promise(source, root_destination)
                files_arr.push(...dir_files)
            } else {
                file.source = file.href;
                file.destination = root_destination;
                files_arr.push(file);
            }
        }

        for (let i = 0; i < files_arr.length; i++) {
            if (!files_arr[i].is_dir) {
                max += files_arr[i].size;
            }
        }

        // sort files by folder length
        files_arr.sort((a, b) => {
            return b.source - a.source;
        })

        progress_id = data.id;
        let total_bytes0 = 0;
        let total_bytes = 0;
        let bytes_copied = 0;

        files_arr.forEach((file, idx) => {
            if (file.is_dir) {

                if (!fs.existsSync(file.destination)) {
                    fs.mkdirSync(file.destination);
                }

            } else {

                const destination = path.join(file.destination, path.basename(file.source));
                gio.cp_async(file.source, destination, (res) => {

                    total_bytes0 = total_bytes;
                    total_bytes = res.total_bytes;
                    bytes_copied += parseInt(res.bytes_copied);

                    let data = {
                        id: progress_id,
                        cmd: 'progress',
                        msg: `Copying `,  // ${path.basename(f.source)}`,
                        max: max,
                        value: bytes_copied
                    }
                    parentPort.postMessage(data);

                    if (bytes_copied >= max) {
                        let close_progress = {
                            id: progress_id,
                            cmd: 'progress',
                            msg: ``,
                            max: 0,
                            value: 0
                        }
                        parentPort.postMessage(close_progress);
                        bytes_copied = 0;
                        max = 0;

                        // update cards
                        selected_files_arr.forEach((f, i) => {
                            let source = f;
                            let destination = path.join(root_destination, path.basename(source));
                            let update_card = {
                                cmd: 'get_card',
                                destination: destination
                            }
                            parentPort.postMessage(update_card);
                        })

                    }



                });

            }

        });

    }

})

