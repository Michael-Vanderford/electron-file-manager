const { parentPort, workerData, isMainThread } = require('worker_threads');
const path          = require('path');
const gio_utils     = require('./utils/gio');
const gio           = require('./gio/build/Release/obj.target/gio')

let file_arr = [];
let cp_recursive = 0;
function get_files_arr (source, destination, callback) {
    cp_recursive++
    file_arr.push({type: 'directory', source: source, destination: destination})
    gio_utils.get_dir(source, dirents => {
        for (let i = 0; i < dirents.length; i++) {
            let file = dirents[i]
            parentPort.postMessage({cmd: 'msg', msg: `Getting Folders and Files.`})
            if (file.type == 'directory') {
                get_files_arr(file.href, path.format({dir: destination, base: file.name}), callback)
            } else {
                file_arr.push({type: 'file', source: file.href, destination: path.format({dir: destination, base: file.name})})
            }
        }
        if (--cp_recursive == 0) {
            parentPort.postMessage({cmd: 'msg', msg: ``})

            let file_arr1 = file_arr;
            file_arr = []
            return callback(file_arr1);
        }
    })
}

// Handle Worker Messages
parentPort.on('message', data => {

    // todo: properly handle the rename error in preoad edit.

    // Rename
    if (data.cmd === 'rename') {
        try {
            gio.mv(data.source, data.destination);
            parentPort.postMessage({cmd: 'rename_done', source: data.source, destination: data.destination});
            parentPort.postMessage({cmd: 'msg', msg: `Renamed "${path.basename(data.source)}" to "${path.basename(data.destination)}"`});
        } catch (err) {
            parentPort.postMessage({cmd: 'msg', msg: err});
        }
    }

    // New Folder
    if (data.cmd === 'mkdir') {
        gio.mkdir(data.destination)
        parentPort.postMessage({cmd: 'copy_done', destination: data.destination})
    }

    // Delete Confirmed
    if (data.cmd === 'delete_confirmed') {
        // console.log('worker', data.files_arr)
        let idx = 0;
        let del_arr = data.files_arr
        function delete_next() {

            if (idx === del_arr.length) {
                // Callback goes here
                return;
            }

            let del_item = del_arr[idx];
            idx++

            gio_utils.get_file(del_item, file => {

                if (file.type === 'directory') {

                    get_files_arr(del_item, del_item, dirents => {

                        let cpc = 0;

                        // Delete files
                        for (let i = 0; i < dirents.length; i++) {
                            let f = dirents[i]
                            if (f.type == 'file') {
                                cpc++
                                gio.rm(f.source)
                                data = {
                                    cmd: 'progress',
                                    msg: `Deleted File ${path.basename(f.source)}`,
                                    max: dirents.length,
                                    value: cpc
                                }
                                parentPort.postMessage(data)
                            }
                        }

                        // Sort directories
                        dirents.sort((a,b) => {
                            return b.source.length - a.source.length;
                        })

                        // Delete directories
                        for (let i = 0; i < dirents.length; i++) {
                            let f = dirents[i]
                            if (f.type == 'directory') {
                                cpc++
                                gio.rm(f.source)
                                data = {
                                    cmd: 'progress',
                                    msg: `Deleted Folder ${path.basename(f.source)}`,
                                    max: dirents.length,
                                    value: cpc
                                }
                                parentPort.postMessage(data)
                            }
                        }

                        if (cpc === dirents.length) {
                            console.log('done deliting files');
                            data = {
                                cmd: 'delete_done',
                                source: del_item
                            }
                            parentPort.postMessage(data)
                            delete_next();
                        }

                    })

                } else {

                    gio.rm(del_item);
                    data = {
                        cmd: 'delete_done',
                        source: del_item
                    }
                    parentPort.postMessage(data)
                    delete_next();

                }
            })

        }
        delete_next();
    }

    // Past Files
    // todo: this needs file conflict handling added
    if (data.cmd == 'paste') {

        let idx = 0;
        let copy_arr = data.copy_arr
        function copy_next() {

            if (idx === copy_arr.length) {
                // Callback goes here
                return;
            }

            let copy_item = copy_arr[idx];
            idx++

            let file = gio_utils.get_file(copy_item.source, file => {

                if (file.type === 'directory') {

                    if (copy_item.source === copy_item.destination) {
                        parentPort.postMessage({cmd: 'msg', msg: 'Error: Source and Destination are the Same'})
                        return;
                    }

                    get_files_arr(copy_item.source, copy_item.destination, dirents => {

                        let cpc = 0;

                        for (let i = 0; i < dirents.length; i++) {
                            let f = dirents[i]
                            if (f.type == 'directory') {
                                cpc++
                                gio.mkdir(f.destination)
                                data = {
                                    cmd: 'progress',
                                    msg: `Copied Folder ${path.basename(f.source)}`,
                                    max: dirents.length,
                                    value: cpc
                                }
                                parentPort.postMessage(data)
                            }
                        }

                        for (let i = 0; i < dirents.length; i++) {
                            let f = dirents[i]
                            if (f.type == 'file') {
                                cpc++
                                gio.cp(f.source, f.destination)
                                data = {
                                    cmd: 'progress',
                                    msg: `Copied File ${path.basename(f.source)}`,
                                    max: dirents.length,
                                    value: cpc

                                }
                                parentPort.postMessage(data)
                            }
                        }

                        if (cpc === dirents.length) {
                            console.log('done copying files');
                            data = {
                                cmd: 'copy_done',
                                destination: copy_item.destination
                            }
                            parentPort.postMessage(data)
                            copy_next();
                        }

                    })

                // File
                } else {

                    gio.cp(copy_item.source, copy_item.destination)
                    data = {
                        cmd: 'copy_done',
                        destination: copy_item.destination
                    }
                    parentPort.postMessage(data)
                    copy_next();

                }

            })

        }
        copy_next();
    }

})
