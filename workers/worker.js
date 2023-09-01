const { parentPort, workerData, isMainThread } = require('worker_threads');
const { execSync, exec } = require('child_process')
const path          = require('path');
const gio_utils     = require('../utils/gio');
const gio           = require('../gio/build/Release/obj.target/gio')

let file_arr = [];
let cp_recursive = 0;
function get_files_arr (source, destination, callback) {
    cp_recursive++
    file_arr.push({type: 'directory', source: source, destination: destination})
    gio.ls(source, (err, dirents) => {
        for (let i = 0; i < dirents.length; i++) {
            let file = dirents[i]
            parentPort.postMessage({cmd: 'msg', msg: `Getting Folders and Files.`, has_timeout: 0});
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

// Handle Worker Messages
parentPort.on('message', data => {

    // New merge code for copies
    if (data.cmd === 'merge_files') {

        let idx = 0;
        let merge_arr = [];

        data.copy_arr.forEach(item => {

            if (gio.exists(item.destination)) {

                let src_file = gio.get_file(item.source);
                let dest_file = gio.get_file(item.destination);

                // Directory
                if (src_file.is_dir) {

                    get_files_arr(item.source, item.destination, dirents => {

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
                                action: '',
                                id_dir: 0,
                                content_type: ''
                            }

                            merge_obj.source = src.href;
                            merge_obj.source_date = src.mtime;
                            merge_obj.is_dir = 1;
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

                                }

                            } else {
                                // New File
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
                        action: '',
                        id_dir: 0,
                        content_type: ''
                    }

                    if (src_file.mtime > dest_file.mtime) {
                        merge_obj.action = 1;
                    } else if (src_file.mtime < dest_file.mtime) {
                        merge_obj.action = 0;
                    } else if (src_file.mtime === dest_file.mtime) {

                    }

                    merge_obj.source = item.source
                    merge_obj.destination = item.destination;
                    merge_obj.source_date = src_file.mtime
                    merge_obj.destination_date = src_file.mtime
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
        merge_arr = [];

    }

    // Merge
    if (data.cmd === 'merge') {

        let idx = 0;
        let copy_arr = data.copy_arr;
        let copy_overwrite_arr = [];
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

            if (is_writable) {


                let file = gio.get_file(copy_item.source);

                if (file.is_dir || file.type === 'directory') {

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
                                    // Send Confirm Overwrite
                                    // gio.cp(f.source, f.destination, copy_item.overwrite_flag)
                                    let src = gio.get_file(f.source);
                                    let dest = gio.get_file(f.destination);

                                    if (src.mtime > dest.mtime) {
                                        copy_overwrite_arr.push({source: f.source, destination: f.destination});
                                    } else if (src.mtime < dest.mtime) {
                                        copy_overwrite_arr.push({source: f.source, destination: f.destination});
                                    }

                                } else {
                                    try {
                                        gio.cp(f.source, f.destination, 0)
                                    } catch (err) {
                                        console.log(err);
                                    }
                                }

                                data = {
                                    cmd: 'progress',
                                    msg: `Skipping File ${path.basename(f.source)}`,
                                    max: dirents.length,
                                    value: cpc
                                }
                                parentPort.postMessage(data);
                            }
                        }

                        if (cpc === dirents.length) {

                            if (copy_overwrite_arr.length > 0) {
                                parentPort.postMessage({'cmd':'confirm_overwrite', copy_overwrite_arr: copy_overwrite_arr});
                            }

                            copy_overwrite_arr = [];

                            // console.log('done copying files');
                            let data = {
                                cmd: 'copy_done',
                                destination: destination
                            }
                            parentPort.postMessage(data);
                            copy_next();
                        }

                    })

                // Skip symlinks
                } else if (file.content_type === 'inode/symlink') {

                // File
                } else {

                    try {
                        gio.cp(copy_item.source, copy_item.destination, 1)
                        let data = {
                            cmd: 'copy_done',
                            destination: copy_item.destination
                        }
                        parentPort.postMessage(data);
                        parentPort.postMessage({cmd: 'msg', msg: `Copy Complete`});

                    } catch (err) {
                        console.log(err.message);
                        parentPort.postMessage({cmd: 'msg', msg: err.message});
                    }
                    copy_next();

                }

            } else {
                parentPort.postMessage({cmd: 'msg', msg: 'Error: Permission Denied'});
            }

        }
        copy_next();
    }

    // Folder Size
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

    // Folder Count
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
            gio.mv(data.source, data.destination);
            parentPort.postMessage({cmd: 'rename_done', source: data.source, destination: data.destination});
            parentPort.postMessage({cmd: 'msg', msg: `Renamed "${path.basename(data.source)}" to "${path.basename(data.destination)}"`});
        } catch (err) {
            console.log('error', err)
            parentPort.postMessage({cmd: 'msg', msg: err});
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

                                try {
                                    gio.rm(f.source)
                                } catch (err) {
                                    console.log(err)
                                }

                                data = {
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

                        get_files_arr(copy_item.source, destination, dirents => {

                            let size = gio.du(path.dirname("/"))
                            console.log(size);

                            let cpc = 0;
                            for (let i = 0; i < dirents.length; i++) {
                                let f = dirents[i]
                                if (f.type == 'directory') {
                                    cpc++
                                    if (!gio.exists(f.destination)) {
                                        gio.cp(f.source, f.destination);
                                        // gio.mkdir(f.destination)
                                        data = {
                                            cmd: 'progress',
                                            msg: `Created Folder ${i} of ${dirents.length}`, //${path.basename(f.source)}`,
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
                                        try {
                                            gio.cp(f.source, f.destination, 0)
                                        } catch (err) {
                                            console.log(err);
                                        }
                                    }
                                    data = {
                                        cmd: 'progress',
                                        msg: `Copied File ${i} of ${dirents.length}`,  // ${path.basename(f.source)}`,
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
                            parentPort.postMessage({cmd: 'msg', msg: err.message});
                        }
                        copy_next();

                    }

                // })

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
