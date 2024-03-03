const { parentPort, workerData, isMainThread } = require('worker_threads');
const { execSync, exec } = require('child_process')
const path = require('path');
const gio_utils = require('../utils/gio');
const gio = require('../gio/build/Release/obj.target/gio')

class FileOperation {

    constructor() {
        this.progress_id = 0;
    }

    // paste (copy_arr) {

    //     let idx = 0;
    //     this.progress_id += 1;

    //     function copy_next() {

    //         if (idx === copy_arr.length) {
    //             // Callback goes here
    //             return;
    //         }

    //         let copy_item = copy_arr[idx];
    //         let source = copy_item.source;
    //         let destination = copy_item.destination;
    //         idx++

    //         let is_writable = 0;
    //         if (gio.is_writable(path.dirname(destination))) {
    //             is_writable = 1;
    //         } else {
    //             is_writable = 0;
    //         }

    //         if (is_writable) {

    //             // gio_utils.get_file(copy_item.source, file => {
    //                 let file = gio.get_file(copy_item.source);

    //                 if (file.is_dir || file.type === 'directory') {

    //                     let c = 0;
    //                     while(gio.exists(destination)) {
    //                         ++c;
    //                         var pattern = /\((\d+)\)$/;
    //                         var match = pattern.exec(destination);

    //                         if (match) {
    //                             let last_c = parseInt(match[1]);
    //                             let next_c = last_c + 1;
    //                             destination = destination.replace(pattern, `(${next_c})`);
    //                         } else {
    //                             destination = `${destination} (1)`
    //                         }

    //                         if (c > 10) {
    //                             // Bail
    //                             return;
    //                         }
    //                     }

    //                     get_files_arr(copy_item.source, destination, dirents => {

    //                         let data = {};

    //                         let size = gio.du(path.dirname("/"))
    //                         console.log(size);

    //                         let cpc = 0;
    //                         for (let i = 0; i < dirents.length; i++) {
    //                             let f = dirents[i]
    //                             if (f.type == 'directory') {
    //                                 cpc++
    //                                 if (!gio.exists(f.destination)) {
    //                                     gio.cp(f.source, f.destination);
    //                                     // gio.mkdir(f.destination)
    //                                     data = {
    //                                         id: this.progress_id,
    //                                         cmd: 'progress',
    //                                         msg: `Created Folder ${i} of ${dirents.length}`, //${path.basename(f.source)}`,
    //                                         max: dirents.length,
    //                                         value: cpc
    //                                     }
    //                                     parentPort.postMessage(data);
    //                                 }
    //                             }
    //                         }

    //                         for (let i = 0; i < dirents.length; i++) {
    //                             let f = dirents[i]
    //                             if (f.type == 'file') {
    //                                 cpc++
    //                                 if (gio.exists(f.destination)) {
    //                                     // gio.cp(f.source, f.destination, copy_item.overwrite_flag)
    //                                 } else {
    //                                     try {
    //                                         gio.cp(f.source, f.destination, 0)
    //                                     } catch (err) {
    //                                         console.log(err);
    //                                     }
    //                                 }
    //                                 data = {
    //                                     id: this.progress_id,
    //                                     cmd: 'progress',
    //                                     msg: `Copying ${path.basename(destination)} ${i} of ${dirents.length}`,  // ${path.basename(f.source)}`,
    //                                     max: dirents.length,
    //                                     value: cpc

    //                                 }
    //                                 parentPort.postMessage(data);
    //                             }
    //                         }

    //                         if (cpc === dirents.length) {
    //                             // console.log('done copying files');
    //                             let data = {
    //                                 cmd: 'copy_done',
    //                                 destination: destination
    //                             }
    //                             parentPort.postMessage(data);
    //                             copy_next();
    //                         }

    //                     })

    //                 // File
    //                 } else {

    //                     try {
    //                         gio.cp(copy_item.source, copy_item.destination, copy_item.overwrite_flag)
    //                         let data = {
    //                             cmd: 'copy_done',
    //                             destination: copy_item.destination
    //                         }
    //                         parentPort.postMessage(data);
    //                         parentPort.postMessage({cmd: 'msg', msg: `Copy Complete`});

    //                     } catch (err) {
    //                         console.log(err.message);
    //                         parentPort.postMessage({cmd: 'msg', msg: err.message});
    //                     }
    //                     copy_next();

    //                 }

    //             // })

    //         } else {
    //             parentPort.postMessage({cmd: 'msg', msg: 'Error: Permission Denied'});
    //         }

    //     }
    //     copy_next();
    // }

    // Delete
    delete (del_arr) {

        this.progress_id += 1;

        let idx = 0;
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

                        let data = {};
                        let cpc = 0;

                        // Delete files
                        for (let i = 0; i < dirents.length; i++) {
                            let f = dirents[i]
                            if (f.type == 'file') {
                                cpc++
                                try {
                                    gio.rm(f.source)
                                } catch (err) {
                                    console.log(err)
                                }

                                data = {
                                    id: this.progress_id,
                                    cmd: 'progress',
                                    msg: `Deleted File  ${i} of ${dirents.length}`,
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

                                try {
                                    gio.rm(f.source)
                                } catch (err) {
                                    console.log(err)
                                }

                                data = {
                                    id: this.progress_id,
                                    cmd: 'progress',
                                    msg: `Deleted Folder ${i} of ${dirents.length}`,
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

                    try {
                        gio.rm(del_item);
                    } catch (err) {
                        console.log(err)
                    }

                    // data = {
                    //     cmd: 'delete_done',
                    //     source: del_item
                    // }
                    // parentPort.postMessage(data)
                    delete_next();

                }
            })

        }
        delete_next();

    }

}

const fileoperation = new FileOperation();

let file_arr = [];
let cp_recursive = 0;
let progress_id = 0;
const cancel_get_files = false;

function get_files_arr (source, destination, callback) {

    cp_recursive++
    file_arr.push({type: 'directory', source: source, destination: destination})
    gio.ls(source, (err, dirents) => {

        if (err) {
            return callback(err);
        }

        for (let i = 0; i < dirents.length; i++) {

            // parentPort.postMessage({cmd: 'msg', msg: 'Calculating Files..', has_timeout: 0});
            let file = dirents[i]
            // parentPort.postMessage({cmd: 'msg', msg: `Getting Folders and Files.`, has_timeout: 0});
            if (file.is_dir) {
                get_files_arr(file.href, path.format({dir: destination, base: file.name}), callback)
            } else {
                let file_obj = {
                    type: 'file',
                    source: file.href,
                    destination: path.format({dir: destination, base: file.name}),
                    size: file.size
                }
                file_arr.push(file_obj)
            }

        }

        if (--cp_recursive == 0 || cancel_get_files) {
            // parentPort.postMessage({cmd: 'msg', msg: ``})

            let file_arr1 = file_arr;
            file_arr = []
            return callback(null, file_arr1);
        }
    })
}

function execPromise(cmd) {
    return new Promise((resolve, reject) => {
        gio.exec(cmd, (err, res) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(res);
        });
    });
}

// Handle Worker Messages
parentPort.on('message', data => {

    // console.log('worker', data);

    if (data.cmd === 'merge_files') {

        let idx = 0;
        let merge_arr = [];

        data.copy_arr.forEach((item, idx) => {

            if (gio.exists(item.destination)) {

                let src_file = gio.get_file(item.source);
                let dest_file = gio.get_file(item.destination);

                // Permission Denied
                if (!dest_file.is_writable) {
                    parentPort.postMessage({cmd: 'msg', msg: `Error: Permission Denied`});
                    return;
                }

                let msg = {
                    cmd: 'msg',
                    msg: `Getting files for merge operation`,
                    has_timeout: 0
                }
                parentPort.postMessage(msg);
                parentPort.postMessage({cmd: 'show_loader'});

                // Directory
                if (src_file.is_dir) {

                    get_files_arr(item.source, item.destination, (err, dirents) => {

                        if (err) {
                            console.log(err);
                            parentPort.postMessage({cmd: 'msg', msg: `Merge err: ${err}`});
                            // return;
                        }

                        let files = dirents.filter(x => x.type === 'file');
                        for (let i = 0; i < files.length; i++) {

                            let f = files[i]
                            let src = gio.get_file(f.source);
                            let dest = ''; // gio.get_file(f.destination);

                            let merge_obj = {
                                source: '',
                                destination: '',
                                source_date: '',
                                destination_date: '',
                                action: 0,
                                id_dir: 0,
                                content_type: '',
                                is_writable: 0
                            }

                            merge_obj.source = src.href;
                            merge_obj.source_date = src.mtime;
                            merge_obj.is_dir = 1;
                            merge_obj.content_type = src.content_type;


                            if (gio.exists(f.destination)) {

                                dest = gio.get_file(f.destination);

                                merge_obj.destination = dest.href;
                                merge_obj.destination_date = dest.mtime

                                merge_obj.is_writable = dest.is_writable;
                                if (!dest.is_writable) {
                                    // console.log(dest.href, 'not writable');
                                }

                                if (src.mtime > dest.mtime) {
                                    merge_obj.action = 1;
                                    merge_arr.push(merge_obj);
                                } else if (src.mtime < dest.mtime) {
                                    merge_obj.action = 0;
                                    merge_arr.push(merge_obj);
                                } else if (!dest_file.file_exists) {
                                    merge_obj.action = 0;
                                    merge_arr.push(merge_obj);
                                } else if (src.mtime === dest.mtime) {

                                }



                            } else {
                                // New File
                                merge_obj.is_writable = 1;
                                merge_obj.destination = f.destination;
                                merge_obj.action = 2;
                                merge_arr.push(merge_obj);
                            }

                        }


                    })

                // Files
                } else {

                    let merge_obj = {
                        source: '',
                        destination: '',
                        source_date: '',
                        destination_date: '',
                        action: 0,
                        id_dir: 0,
                        content_type: '',
                        is_writable: 0
                    }

                    merge_obj.is_writable = dest_file.is_writable;

                    if (src_file.mtime > dest_file.mtime) {
                        merge_obj.action = 1;
                    } else if (src_file.mtime < dest_file.mtime) {
                        merge_obj.action = 0;
                    } else if (!dest_file.file_exists) {
                        merge_obj.action = 0;
                    } else if (src_file.mtime === dest_file.mtime) {

                    }

                    merge_obj.source = item.source
                    merge_obj.destination = item.destination;
                    merge_obj.source_date = src_file.mtime
                    merge_obj.destination_date = dest_file.mtime
                    merge_obj.is_dir = 0;
                    merge_obj.content_type = src_file.content_type;

                    merge_arr.push(merge_obj);

                }
            }

        })

        merge_arr.sort((a, b) => {
            return b.source_date - a.source_date;
        })

        parentPort.postMessage({'cmd':'merge_files', merge_arr: merge_arr});
        parentPort.postMessage({cmd: 'msg', msg: ''});
        merge_arr = [];
        parentPort.postMessage({cmd: 'hide_loader'});
    }

    // Folder Size
    if (data.cmd === 'folder_size') {

        // try {
        //     let cmd = `cd '${data.source.replace("'", "''")}'; du -Hs`;
        //     gio.exec(cmd, (err, res) => {
        //         if (err) {
        //             console.error(err);
        //             return;
        //         }
        //         let size = parseFloat(res.toString().replace(/[^0-9.]/g, ''));
        //         size = size * 1024;
        //         console.log('size', size);
        //         let worker_data = {
        //             cmd: 'folder_size',
        //             source: data.source,
        //             size: size
        //         }
        //         parentPort.postMessage(worker_data);
        //     });
        // } catch (err) {
        //     return 0;
        // }

        try {
            let cmd = 'cd "' + data.source + '"; du -s';
            exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    // console.error(stderr, cmd);
                    // return 0;
                }
                let size = parseFloat(stdout.replace(/[^0-9.]/g, ''));
                size = (size * 1024);
                let worker_data = {
                    cmd: 'folder_size',
                    source: data.source,
                    size: size
                }
                parentPort.postMessage(worker_data);
                // console.log(`Folder Size: ${data.source} ${size} bytes ${Date.now() - ts}ms`);
            })
        } catch (error) {
            console.error('folder_size', error);
            return 0;
        }

    }

    if (data.cmd === 'cancel_get_files') {
        cancel_get_files = true;
    }

    // Folder Count
    if (data.cmd === 'folder_count') {

        try {
            let cmd = 'cd "' + data.source + '"; find . | wc -l';
            const du = exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    return 0;
                }
                let folder_count = stdout;
                let worker_data = {
                    cmd: 'folder_count',
                    source: data.source,
                    folder_count: parseInt(folder_count).toLocaleString()
                }
                parentPort.postMessage(worker_data);
            })

        } catch (error) {
            console.error('folder_size', error);
            return 0;
        }

    }

    // Get Folder Size for properties view
    if (data.cmd === 'get_folder_size') {

        let cmd = `du -s "${data.source}"`;
        gio.exec(cmd, (err, res) => {

            if (err) {
                console.error(err);
                let msg = {
                    cmd: 'msg',
                    msg: err.message
                }
                parentPort.postMessage(msg);
                return;
            }

            let size = parseFloat(res.toString().replace(/[^0-9.]/g, ''));
            size = size * 1024;
            // console.log('size', size);

            let worker_data = {
                cmd: 'folder_size_done',
                source: data.source,
                folder_size: size
            }
            parentPort.postMessage(worker_data);

        });

    }

    if (data.cmd === 'count') {
        try {
            let item_count = gio.count(data.source)
            if (item_count === undefined) {
                item_count = ''
            }
            parentPort.postMessage({cmd: 'count', source: data.source, count: item_count});
        } catch (err) {
            parentPort.postMessage({cmd: 'msg', 'msg': err})
        }
    }

    if (data.cmd === 'exists') {
        let exists = gio.exists(data.source);
        parentPort.postMessage({cmd: 'exists', exists: exists});
    }

    if (data.cmd === 'mv') {
        let merge_arr = [];
        let selected_files_arr = data.selected_items;
        for (let i = 0; i < selected_files_arr.length; i++) {
            try {
                let f = selected_files_arr[i];

                let src = gio.get_file(f.source);
                let dest = ''; // gio.get_file(f.destination);

                let merge_obj = {
                    source: '',
                    destination: '',
                    source_date: '',
                    destination_date: '',
                    action: '',
                    id_dir: 1,
                    content_type: ''
                }

                merge_obj.source = src.href;
                merge_obj.source_date = src.mtime;
                merge_obj.content_type = src.content_type;

                if (gio.exists(f.destination)) {

                    dest = gio.get_file(f.destination);

                    merge_obj.destination = dest.href;
                    merge_obj.destination_date = dest.mtime

                    if (src.mtime > dest.mtime) {
                        merge_obj.action = 1;
                        merge_arr.push(merge_obj);
                    } else if (src.mtime < dest.mtime) {
                        merge_obj.action = 0;
                        merge_arr.push(merge_obj);
                    } else if (src.mtime === dest.mtime) {
                        merge_obj.action = 0;
                        merge_arr.push(merge_obj);
                    }

                } else {
                    gio.mv(f.source, f.destination);
                    parentPort.postMessage({cmd: 'move_done', source: f.source, destination: f.destination });
                    if (i === selected_files_arr.length - 1) {{
                        parentPort.postMessage({cmd: 'msg', msg: `Done Moving Files`});
                    }}
                }

            } catch (err) {
                parentPort.postMessage({cmd: 'msg', msg: err.message});
            }

        }

        if (merge_arr.length > 0) {
            parentPort.postMessage({cmd:'merge_files_move', merge_arr: merge_arr});
            merge_arr = []
        }

    }

    // Rename
    if (data.cmd === 'rename') {
        try {

            if (data.destination.indexOf('mtp:') > -1) {
                let copy_arr = [{source: data.source, destination: data.destination}];
                fileoperation.paste(copy_arr);

                let delete_arr = [data.source];
                fileoperation.delete(delete_arr);
            } else {
                gio.mv(data.source, data.destination);
            }

            parentPort.postMessage({cmd: 'rename_done', source: data.source, destination: data.destination});
            parentPort.postMessage({cmd: 'msg', msg: `Renamed "${path.basename(data.source)}" to "${path.basename(data.destination)}"`});

        } catch (err) {
            parentPort.postMessage({cmd: 'clear'});
            parentPort.postMessage({cmd: 'msg', msg: err.message});
        }
    }

    // New Folder
    if (data.cmd === 'mkdir') {
        try {
            gio.mkdir(data.destination);
            parentPort.postMessage({cmd: 'mkdir_done', destination: data.destination});
        } catch (err) {
            console.log(err);
        }
    }

    // Copy File for Overwrite
    if (data.cmd === 'cp') {
        if (gio.exists(data.destination)) {
            try {
                gio.cp(data.source, data.destination, data.overwrite_flag);
                parentPort.postMessage({cmd: 'copy_done', destination: data.destination});
            } catch (err) {
                parentPort.postMessage({cmd: 'msg', msg: err.message});
            }
        } else {
            try {
                gio.cp(data.source, data.destination, 0);
                parentPort.postMessage({cmd: 'copy_done', destination: data.destination});
            } catch (err) {
                parentPort.postMessage({cmd: 'msg', msg: err.message});
            }
        }
    }

    if (data.cmd === 'cp_template') {
        if (gio.exists(data.destination)) {
            //  todo: implement file cp with copy appended
            // try {
            //     gio.cp(data.source, data.destination, data.overwrite_flag);
            //     parentPort.postMessage({cmd: 'copy_template_done', destination: data.destination});
            // } catch (err) {
            //     parentPort.postMessage({cmd: 'msg', msg: err.message});
            // }
        } else {
            try {
                gio.cp(data.source, data.destination, 0);
                parentPort.postMessage({cmd: 'cp_template_done', destination: data.destination});
            } catch (err) {
                parentPort.postMessage({cmd: 'msg', msg: err.message});
            }
        }
    }

    // Delete Confirmed
    if (data.cmd === 'delete_confirmed') {

        let idx = 0;
        let del_arr = data.files_arr

        // progress_id += 1;

        function delete_next() {

            let msg = {
                cmd: 'msg',
                msg: `<img src="assets/icons/spinner.gif" style="width: 12px; height: 12px" alt="loading" /> Gathering files...`
            }
            parentPort.postMessage(msg);

            if (idx === del_arr.length) {

                let close_progress = {
                    id: data.id,
                    cmd: 'progress',
                    msg: ``,
                    max: 0,
                    value: 0
                }
                parentPort.postMessage(close_progress);
                return;
            }

            let del_item = del_arr[idx];
            idx++

            let is_dir = gio.is_dir(del_item);
            if (is_dir) {
                get_files_arr(del_item, del_item, (err, dirents) => {

                    if (err) {

                        parentPort.postMessage({cmd: 'msg', msg: err});

                        let progress = {
                            id: data.id,
                            cmd: 'progress',
                            msg: ``,
                            max: 0,
                            value: 0
                        }
                        parentPort.postMessage(progress);
                        return;
                    }

                    let cpc = 0;

                    let msg = {
                        cmd: 'msg',
                        msg: '',
                    }
                    parentPort.postMessage(msg);

                    // Delete files
                    for (let i = 0; i < dirents.length; i++) {
                        let f = dirents[i]
                        if (f.type == 'file') {
                            cpc++
                            try {
                                gio.rm(f.source)
                            } catch (err) {
                                let msg = {
                                    cmd: 'msg',
                                    msg: err.message,
                                    has_timeout: 0
                                }
                                parentPort.postMessage(msg);
                                return true;
                            }

                            data = {
                                id: data.id,
                                cmd: 'progress',
                                msg: `Deleted File ${i} of ${dirents.length}`,
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

                            try {
                                gio.rm(f.source)
                            } catch (err) {
                                console.log(err)
                            }

                            data = {
                                id: data.id,
                                cmd: 'progress',
                                msg: `Deleted Folder ${i} of ${dirents.length}`,
                                max: dirents.length,
                                value: cpc
                            }
                            parentPort.postMessage(data)
                        }
                    }

                    if (cpc === dirents.length) {
                        // console.log('done deleting files');
                        data = {
                            id: data.id,
                            cmd: 'delete_done',
                            source: del_item
                        }
                        parentPort.postMessage(data)
                        delete_next();
                    }

                })

            } else {

                try {
                    gio.rm(del_item);
                } catch (err) {
                    let msg = {
                        cmd: 'msg',
                        msg: err.message,
                        has_timeout: 0
                    }
                    parentPort.postMessage(msg);
                    return;
                }

                data = {
                    id: data.id,
                    cmd: 'delete_done',
                    source: del_item
                }
                parentPort.postMessage(data)
                delete_next();

            }
            // })

        }
        delete_next();

    }

    // Past Files
    if (data.cmd === 'paste') {

        // console.log('running paste')

        let idx = 0;
        let copy_arr = data.copy_arr
        function copy_next() {

            let msg = {
                cmd: 'msg',
                msg: `<img src="assets/icons/spinner.gif" style="width: 12px; height: 12px" alt="loading" /> Gathering files...`,
            }
            parentPort.postMessage(msg);

            // Check if copy_arr is done processing
            if (idx === copy_arr.length) {

                let close_progress = {
                    id: data.id,
                    cmd: 'progress',
                    msg: ``,
                    max: 0,
                    value: 0
                }
                // console.log(data)
                parentPort.postMessage(close_progress);
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

            if (is_writable) {

                // gio_utils.get_file(copy_item.source, file => {
                    let file = gio.get_file(copy_item.source);

                    if (file.is_dir || file.type === 'directory') {

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

                        let max = 0;
                        get_files_arr(copy_item.source, destination, (err, dirents) => {

                            if (err) {
                                console.log(err);
                                parentPort.postMessage({cmd: 'msg', msg: err});
                                return;
                            }

                            let msg = {
                                cmd: 'msg',
                                msg: '',
                            }
                            parentPort.postMessage(msg);

                            for (let i = 0; i < dirents.length; i++) {
                                if (dirents[i].type === 'file') {
                                    max += parseInt(dirents[i].size);
                                }
                            }

                            let cpc = 0;
                            for (let i = 0; i < dirents.length; i++) {
                                let f = dirents[i]
                                if (f.type == 'directory') {
                                    cpc++
                                    if (!gio.exists(f.destination)) {
                                        try {
                                            gio.cp(f.source, f.destination);
                                            // gio.mkdir(f.destination)
                                            data = {
                                                id: data.id,
                                                cmd: 'progress',
                                                msg: `Creating Directory ${path.basename(destination)} ${i} of ${dirents.length}`, //${path.basename(f.source)}`,
                                                max: dirents.length,
                                                value: cpc
                                            }
                                            // console.log(data)
                                            parentPort.postMessage(data);

                                        } catch (err) {
                                            let msg = {
                                                cmd: 'msg',
                                                msg: err.message,
                                                has_timeout: 0
                                            }
                                            parentPort.postMessage(msg);
                                        }
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
                                        try {
                                            gio.cp(f.source, f.destination, 0)
                                        } catch (err) {
                                            let msg = {
                                                cmd: 'msg',
                                                msg: err.message,
                                                has_timeout: 0
                                            }
                                            parentPort.postMessage(msg);
                                        }
                                    }
                                    data = {
                                        id: data.id,
                                        cmd: 'progress',
                                        // msg: `Copied File ${i} of ${dirents.length}`,  // ${path.basename(f.source)}`,
                                        msg: `Copying "${path.basename(destination)}" ${i} of ${dirents.length}`,  // ${path.basename(f.source)}`,
                                        max: dirents.length,
                                        value: cpc
                                    }
                                    // console.log(data)
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

                        try {

                            gio.cp(copy_item.source, copy_item.destination, copy_item.overwrite_flag)
                            let data = {
                                cmd: 'copy_done',
                                destination: copy_item.destination
                            }
                            parentPort.postMessage(data);
                            parentPort.postMessage({cmd: 'msg', msg: `Copy Complete`});

                        } catch (err) {
                            console.log(err.message);
                            let msg = {
                                cmd: 'msg',
                                msg: err.message,
                                has_timeout: 0
                            }
                            parentPort.postMessage(msg);
                            return;
                        }
                        copy_next();

                    }

                // })

            } else {
                let data = {
                    cmd: 'msg',
                    msg: 'Error: Permission Denied',
                    has_timeout: 0
                }
                parentPort.postMessage(data);
                return;
            }

        }
        copy_next();
    }

    if (data.cmd === 'monitor') {

        // gio.monitor(function(device) {
        //     // console.log('connected');
        // })

    }

    // Compress Files
    if (data.cmd === 'compress') {

        let location = data.location;
        let type = data.type;
        let size = data.size;
        let selected_files_arr = data.files_arr;
        let progress_id = data.id;

        let c = 0;
        let cmd = '';
        let file_list = [];
        selected_files_arr.forEach((item, idx) => {
            file_list += `'${path.basename(item)}' `;
        })

        // Create command for compressed file
        let destination = path.basename(selected_files_arr[0]);
        selected_files_arr = [];

        if (type === 'zip') {
            destination = destination.substring(0, destination.length - path.extname(destination).length) + '.zip';
            cmd = `cd '${location}'; zip -r '${destination}' ${file_list}`;
            // cmd = `cd '${location}' && tar -czf '${destination}' ${file_list}`;
        } else {
            destination = destination.substring(0, destination.length - path.extname(destination).length) + '.tar.gz';
            cmd = `cd '${location}'; tar czf '${destination}' ${file_list}`;
        }

        let file_path = path.format({dir: location, base: destination});

        const compressionRatio = 0.5;
        let setinterval_id = setInterval(() => {
            let file = gio.get_file(file_path);
            if (file) {
                let progress_opts = {
                    id: progress_id,
                    cmd: 'progress',
                    value: file.size,
                    max: Math.round(parseInt(size) * compressionRatio),
                    msg: `Compressing "${path.basename(file_path)}"`
                }
                parentPort.postMessage(progress_opts);
            } else {
                // let msg = {
                //     cmd: 'msg',
                //     msg: `Error: File ${file_path} not found`
                // }
                // parentPort.postMessage(msg);
            }
        }, 1000);

        let msg = {
            cmd: 'msg',
            msg: `Compressing "${path.basename(file_path)}"`,
            has_timeout: 0
        }
        parentPort.postMessage(msg);

        exec(cmd, (err, stdout) => {
            if (err) {
                let msg = {
                    cmd: 'msg',
                    msg: err.message
                }
                parentPort.postMessage(msg);
                console.log(err);
            }

            clearInterval(setinterval_id);
            let compress_done = {
                cmd: 'compress_done',
                id: progress_id,
                file_path: file_path,
            }
            parentPort.postMessage(compress_done);
            size = 0;
            c = 0;

        })
        selected_files_arr = [];
    }

    // Extract
    if (data.cmd === 'extract') {

        // console.log('running extract')

        let location = data.location;
        // let selected_files_arr = data.files_arr;
        let progress_id = data.id;
        let source = data.source; //selected_files_arr[i];
        let ext = '' //path.extname(source).toLowerCase();

        let cmd = '';
        let filename = '';
        let make_dir = 1;

        let c = 0;

        switch(true) {
            case source.indexOf('.zip') > -1:
                filename = source.replace('.zip', '')
                c = 0
                while (gio.exists(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                cmd = "unzip '" + source + "' -d '" + filename + "'"
                break;
            case source.indexOf('.tar.gz') > -1:
                filename = source.replace('.tar.gz', '')
                c = 0
                while (gio.exists(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                cmd = `cd "${location}"; /usr/bin/tar -xzf "${source}" -C "${filename}"`;
                break;
            case source.indexOf('.tar') > -1:
                filename = source.replace('.tar', '')
                c = 0
                while (gio.exists(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                cmd = 'cd "' + location + '"; /usr/bin/tar --strip-components=1 -xzf "' + source + '"'
                break;
            case source.indexOf('.gz') > -1:
                filename = source.replace('.gz', '')
                c = 0
                while (gio.exists(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                cmd = `cd "${location}"; /usr/bin/gunzip -d -k "${source}"` // | tar -x -C ${filename}"`;
                make_dir = 0;
                break;
            case source.indexOf('.xz') > -1:
                filename = source.replace('tar.xz', '')
                filename = filename.replace('.img.xz', '')
                c = 0
                while (gio.exists(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                if (source.indexOf('img.xz') > -1) {
                    make_dir = 0;
                    cmd = 'cd "' + location + '"; /usr/bin/unxz -k "' + source + '"';
                } else {
                    cmd = 'cd "' + location + '"; /usr/bin/tar -xf "' + source + '" -C "' + filename + '"';
                }
                break;
            case source.indexOf('.bz2') > -1:
                ext = '.bz2';
                filename = source.replace('.bz2', '')
                c = 0
                while (gio.exists(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                cmd = 'cd "' + location + '"; /usr/bin/bzip2 -dk "' + source + '"'
                break;
        }

        if (make_dir) {
            gio.mkdir(filename)
            // fs.mkdirSync(filename);
        }

        // GET UNCOMPRESSED SIZE
        // win.send('msg', `Calculating uncompressed size of ${path.basename(source)}`, 0);
        // let setinterval_id = 0;
        let file = gio.get_file(source)
        let ratio = 0.5;
        let max = (parseInt(file.size / 1024) / ratio);
        let current_size = 0;

        let setinterval_id = setInterval(() => {

            current_size = parseInt(execSync(`du -s '${filename}' | awk '{print $1}'`).toString().replaceAll(',', ''))
            // console.log(current_size, filename)
            let progress_opts = {
                id: progress_id,
                cmd: 'progress',
                value: (current_size),
                max: max,
                msg: `Extracting "${path.basename(filename)}"`
            }
            parentPort.postMessage(progress_opts);

        }, 1000);

        // THIS NEEDS WORK. CHECK IF DIRECTORY EXIST. NEED OPTION TO OVERWRITE
        exec(cmd, { maxBuffer: Number.MAX_SAFE_INTEGER }, (err, stdout, stderr) => {
        // execSync(cmd, { maxBuffer: Number.MAX_SAFE_INTEGER })

            if (err) {

                let msg = {
                    cmd: 'msg',
                    msg: err.message
                }
                parentPort.postMessage(msg);
                gio.rm(filename);
                clearInterval(setinterval_id);
                return;
            }

            console.log('done extracting files');

            clearInterval(setinterval_id);
            let extract_done = {
                id: progress_id,
                cmd: 'extract_done',
                source: source,
                destination: filename
            }
            parentPort.postMessage(extract_done);
            // clearInterval(setinterval_id);

        })

    }

    // Properties
    if (data.cmd === 'properties') {
        let properties_arr = [];
        if (data.selected_files_arr.length > 0) {
            data.selected_files_arr.forEach(item => {
                let properties = gio.get_file(item);
                // console.log(properties);
                properties_arr.push(properties);
            })
        } else {
            let properties = gio.get_file(location);
            properties_arr.push(properties);
        }
        let cmd = {
            cmd: 'properties',
            properties_arr: properties_arr
        }
        parentPort.postMessage(cmd);

    }

})
