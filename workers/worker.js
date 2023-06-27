const { parentPort, workerData, isMainThread } = require('worker_threads');
const { execSync, exec } = require('child_process')
const path          = require('path');
const gio_utils     = require('./utils/gio');
const gio           = require('./gio/build/Release/obj.target/gio')

// let file_arr = [];
// let cp_recursive = 0;
// function get_files_arr (source, destination, callback) {
//     cp_recursive++
//     file_arr.push({type: 'directory', source: source, destination: destination})
//     gio_utils.get_dir(source, dirents => {
//         for (let i = 0; i < dirents.length; i++) {
//             let file = dirents[i]
//             parentPort.postMessage({cmd: 'msg', msg: `Getting Folders and Files.`})
//             if (file.type == 'directory') {
//                 get_files_arr(file.href, path.format({dir: destination, base: file.name}), callback)
//             } else {
//                 file_arr.push({type: 'file', source: file.href, destination: path.format({dir: destination, base: file.name}), size: file.size})
//             }
//         }
//         if (--cp_recursive == 0) {
//             parentPort.postMessage({cmd: 'msg', msg: ``})

//             let file_arr1 = file_arr;
//             file_arr = []
//             return callback(file_arr1);
//         }
//     })
// }

let file_arr = [];
let cp_recursive = 0;
function get_files_arr (source, destination, callback) {
    cp_recursive++
    file_arr.push({type: 'directory', source: source, destination: destination})
    // let dirents = gio.ls(source)
    gio.ls(source, (err, dirents) => {
        for (let i = 0; i < dirents.length; i++) {
            let file = dirents[i]
            parentPort.postMessage({cmd: 'msg', msg: `Getting Folders and Files.`})
            if (file.is_dir) {
                get_files_arr(file.href, path.format({dir: destination, base: file.name}), callback)
            } else {
                file_arr.push({type: 'file', source: file.href, destination: path.format({dir: destination, base: file.name}), size: file.size})
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

// let preload_arr = [];
// function get_preload_arr (source, destination) {
//     cp_recursive++
//     preload_arr.push({type: 'directory', source: source, destination: destination})
//     let dirents = gio.ls(source)
//     for (let i = 0; i < dirents.length; i++) {
//         let file = dirents[i]
//         // parentPort.postMessage({cmd: 'msg', msg: `Getting Folders and Files.`})
//         if (file.is_dir) {
//             get_preload_arr(file.href, path.format({dir: destination, base: file.name}), callback)
//         } else {
//             preload_arr.push({type: 'file', source: file.href, destination: path.format({dir: destination, base: file.name}), size: file.size})
//         }
//     }
//     // if (--cp_recursive == 0) {
//     //     // parentPort.postMessage({cmd: 'msg', msg: ``})
//     //     // let file_arr1 = file_arr;
//     //     // file_arr = []
//     //     // return callback(file_arr1);
//     // }
// }

// Handle Worker Messages
parentPort.on('message', data => {

    if (data.cmd === 'folder_size') {
        try {
            get_files_arr(data.source, '', dirents => {
                dirents.reduce((c, x) => x.type !== 'directory' ? c + 1 : c, 0); //dirents.filter(x => x.is_dir === true).length;
                let size = 0;
                for (let i = 0; i < dirents.length; i++) {
                    if (dirents[i].type !== 'directory')
                    size += dirents[i].size
                }
                parentPort.postMessage({cmd: 'folder_size', source: data.source, size: size});
            })
        } catch (err) {
        }
    }

    if (data.cmd === 'folder_count') {
        try {
            // Get Folder Count
            get_files_arr(data.source, '', dirents => {
                let folder_count = dirents.length;
                parentPort.postMessage({cmd: 'folder_count',source: data.source, folder_count: folder_count});
            })
        } catch (err) {

        }
    }

    // Note: dont use this for normal operation. maybe use on properties
    if (data.cmd === 'get_folder_size') {
        let folder_size = 0;
        get_files_arr(data.source, '', files_arr => {
            files_arr.forEach(item => {
                if (item.type === 'file') {
                    folder_size += parseInt(item.size);
                }
            });
            parentPort.postMessage({cmd: 'folder_size_done', source: data.source ,folder_size: folder_size});
        })
    }

    if (data.cmd === 'count') {
        let item_count = gio.count(data.source)
        parentPort.postMessage({cmd: 'count', source: data.source, count: item_count});
    }

    if (data.cmd === 'exists') {
        let exists = gio.exists(data.source);
        parentPort.postMessage({cmd: 'exists', exists: exists});
    }

    if (data.cmd === 'mv') {
        let selected_files_arr = data.selected_items;
        for (let i = 0; i < selected_files_arr.length; i++) {
            let f = selected_files_arr[i];
            gio.mv(f.source, f.destination);
            parentPort.postMessage({cmd: 'move_done', source: f.source, destination: f.destination });
            if (i === selected_files_arr.length - 1) {{
                parentPort.postMessage({cmd: 'msg', msg: `Done Moving Files`});
            }}
        }
    }

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

    // Copy File for Overwrite
    if (data.cmd === 'cp') {
        if (gio.exists(data.destination)) {
            gio.cp(data.source, data.destination, data.overwrite_flag)
        } else {
            gio.cp(data.source, data.destination, 0);
        }
        parentPort.postMessage({cmd: 'copy_done', destination: data.destination})
    }

    // Delete Confirmed
    if (data.cmd === 'delete_confirmed') {
        // // console.log('worker', data.files_arr)
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
                                    msg: `Deleted File  ${i} of ${dirents.length} / ${path.basename(f.source)} `,
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
                            // console.log('done deleting files');
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
    if (data.cmd === 'paste') {

        let idx = 0;
        let copy_arr = data.copy_arr
        function copy_next() {

            if (idx === copy_arr.length) {
                // Callback goes here
                return;
            }

            let copy_item = copy_arr[idx];
            let source = copy_item.source;
            let destination = copy_item.destination;
            idx++

            let is_writable = 0;
            if (gio.is_writable(path.dirname(destination))) {
                is_writable = 1;
            } else {
                is_writable = 0;
            }

            // // console.log('is_writeable', is_writable)

            if (is_writable) {

                gio_utils.get_file(copy_item.source, file => {

                    if (file.type === 'directory') {

                        let c = 0;
                        while(gio.exists(destination)) {
                            ++c;
                            var pattern = /\((\d+)\)$/;
                            var match = pattern.exec(destination);

                            if (match) {
                                let last_c = parseInt(match[1]);
                                let next_c = last_c + 1;
                                destination = destination.replace(pattern, `(${next_c})`);
                            } else {
                                destination = `${destination} (1)`
                            }

                            if (c > 10) {
                                // Bail
                                return;
                            }
                        }

                        get_files_arr(copy_item.source, destination, dirents => {

                            let size = gio.du(path.dirname("/"))
                            console.log(size);

                            let cpc = 0;
                            for (let i = 0; i < dirents.length; i++) {
                                let f = dirents[i]
                                if (f.type == 'directory') {

                                    cpc++

                                    if (!gio.exists(f.destination)) {
                                        gio.mkdir(f.destination)
                                        data = {
                                            cmd: 'progress',
                                            msg: `Copied Folder ${path.basename(f.source)}`,
                                            max: dirents.length,
                                            value: cpc
                                        }
                                        parentPort.postMessage(data);
                                    }
                                }
                            }

                            for (let i = 0; i < dirents.length; i++) {
                                let f = dirents[i]
                                if (f.type == 'file') {
                                    cpc++
                                    if (gio.exists(f.destination)) {
                                        // gio.cp(f.source, f.destination, copy_item.overwrite_flag)
                                    } else {
                                        gio.cp(f.source, f.destination, 0)
                                        // gio.cp_async(f.source, f.destination)
                                        // Delay for 1 second
                                        // new Promise((resolve) => setTimeout(resolve, 500));
                                    }
                                    data = {
                                        cmd: 'progress',
                                        msg: `Copied File ${path.basename(f.source)}`,
                                        max: dirents.length,
                                        value: cpc

                                    }
                                    parentPort.postMessage(data);
                                }
                            }

                            if (cpc === dirents.length) {
                                // console.log('done copying files');
                                let data = {
                                    cmd: 'copy_done',
                                    destination: destination
                                }
                                parentPort.postMessage(data);
                                copy_next();
                            }

                        })

                    // File
                    } else {

                        gio.cp(copy_item.source, copy_item.destination, copy_item.overwrite_flag)
                        let data = {
                            cmd: 'copy_done',
                            destination: copy_item.destination
                        }
                        parentPort.postMessage(data);
                        parentPort.postMessage({cmd: 'msg', msg: `Copy Complete`});
                        copy_next();

                    }

                })

            } else {
                parentPort.postMessage({cmd: 'msg', msg: 'Error: Permission Denied'});
            }

        }
        copy_next();
    }

    if (data.cmd === 'monitor') {

        // gio.monitor(function(device) {
        //     // console.log('connected');
        // })

    }

})
