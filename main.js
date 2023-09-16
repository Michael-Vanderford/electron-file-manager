// Import the required modules
const { app, BrowserWindow, ipcMain, nativeImage, shell, screen, Menu, MenuItem, systemPreferences, dialog, clipboard} = require('electron');
const util = require('util')
const nativeTheme = require('electron').nativeTheme
const exec = util.promisify(require('child_process').exec)
const { execSync } = require('child_process')
const window = require('electron').BrowserWindow;
const windows = new Set();
const fs = require('fs')
const path = require('path');
const { Worker } = require('worker_threads');
const gio_utils = require('./utils/gio');
// const gio = require('./gio/build/Release/gio');
const gio = require('node-gio');
const mt = require('mousetrap');

// Workers
const worker = new Worker(path.join(__dirname, 'workers/worker.js'));
const ls = new Worker(path.join(__dirname, 'workers/ls.js'));
const thumb = new Worker(path.join(__dirname, 'workers/thumbnailer.js'));
const find = new Worker(path.join(__dirname, 'workers/find.js'));

const home = app.getPath('home');

// Monitor USB Devices
gio.monitor(data => {
    if (data) {
        // console.log(data)
        win.send('get_devices');
    }
});

let win;
let window_id = 0;
let window_id0 = 0;
let is_main = 1;
let watcher_failed = 0;

let selected_files_arr = []

let settings_file = path.join(app.getPath('userData'), 'settings.json');
let workspace = {};
try {
    checkSettings();
    workspace = JSON.parse(fs.readFileSync(settings_file, 'utf-8'));
} catch (err) {
    fs.copyFileSync(path.join(__dirname, 'assets/config/settings.json'), settings_file);
    workspace = JSON.parse(fs.readFileSync(settings_file, 'utf-8'));
}

function checkSettings() {

    // Read the content of the first JSON file
    const file1 = fs.readFileSync(settings_file, 'utf8');
    const json1 = JSON.parse(file1);

    // Read the content of the second JSON file
    const file2 = fs.readFileSync('./assets/config/settings.json', 'utf8');
    const json2 = JSON.parse(file2);

    let f2 = gio.get_file('./assets/config/settings.json');
    let f1 = gio.get_file(settings_file);

    if (f2.mtime > f1.mtime) {

        // Update json1 with changes from json2
        Object.assign(json1, json2);

        // Write the updated JSON to the first file
        fs.writeFileSync(settings_file, JSON.stringify(json2, null, 4));

    }

}

worker.postMessage({ cmd: 'monitor' });

let recent_files_path = path.join(app.getPath('userData'), 'recent_files.json');

// Set window id
ipcMain.on('active_window', (e) => {
    window_id0 = window_id
    window_id = e.sender.id;
    if (window_id != window_id0) {
        win = window.fromId(window_id);
    }
})

// Worker Threads ///////////////////////////////////////////

thumb.on('message', (data) => {
    if (data.cmd === 'msg') {
        win.send('msg', data.msg, data.has_timeout);
    }
    if (data.cmd === 'thumbnail_chunk_done') {
        win.send('get_thumbnail', data.href, data.thumbnail);
    }
    if (data.cmd === 'thumbnail_done') {
        win.send('msg', 'Done Creating Thumbnails', has_timeout = 1);
    }
})

find.on('message', (data) => {
    if (data.cmd === 'search_done') {
        win.send('search_results', data.results_arr);
    }
})

ls.on('message', (data) => {

    if (data.cmd === 'ls_err') {
        win.send('msg', data.err)
    }

    if (data.cmd === 'ls_done') {
        win.send('ls', data.dirents, data.source, data.tab);
    }
})

let progress_counter = 0;
worker.on('message', (data) => {

    if (data.cmd === 'merge_files_move') {
        const is_move = 1;
        win.send("merge_files", data.merge_arr, is_move);
        data.merge_arr = [];
    }

    if (data.cmd === 'merge_files') {
        win.send("merge_files", data.merge_arr);
        data.merge_arr = [];
    }

    if (data.cmd === 'folder_size') {
        win.send('folder_size', data.source, data.size);
    }

    if (data.cmd === 'folder_count') {
        win.send('folder_count', data.source, data.folder_count)
    }

    if (data.cmd === 'confirm_overwrite') {
        overWriteNext(data.copy_overwrite_arr);
        // confirmOverwrite(data.source, data.destination, data.copy_overwrite_arr);
    }

    if (data.cmd === 'msg') {
        win.send('msg', data.msg, data.has_timeout);
    }

    if (data.cmd === 'move_done') {

        // Handle Cut / Move
        if (is_main && watcher_failed) {
            let file = gio.get_file(data.destination);
            win.send('get_card_gio', file);
        } else {
            win.send('remove_card', data.source);
        }

        win.send('lazyload');
        // win.send('sort_cards');
        win.send('clear');
    }

    if (data.cmd === 'rename_done') {
        console.log('rename_done');
        // gio_utils.get_file(data.destination, file => {
        //     win.send('replace_card', data.source, file);
        // })
    }

    if (data.cmd === 'mkdir_done') {

        if (is_main && watcher_failed) {
            try {
                let file = gio.get_file(data.destination);
                file.is_new_folder = 1;
                win.send('get_card_gio', file);
            } catch (err) {
                console.log(err);
            }

        } else if (!is_main && watcher_failed) {
            try {
                let href = path.dirname(data.destination)
                let file = gio.get_file(href)
                win.send('replace_card', href, file);
            } catch (err) {
                console.log(err);
            }

        }
    }

    if (data.cmd === 'copy_done') {
        if (is_main && watcher_failed) {
            let file = gio.get_file(data.destination);
            win.send('get_card_gio', file);
        } else {
            if (!is_main) {
                win.send('get_folder_count', path.dirname(data.destination));
                win.send('get_folder_size', path.dirname(data.destination));
            }
            // let href = path.dirname(data.destination)
            // let file = gio.get_file(href)
            // win.send('replace_card', href, file);
        }
        win.send('lazyload');
        win.send('clear');
    }

    if (data.cmd === 'delete_done') {
        win.send('remove_card', data.source);
        win.send('msg', `Deleted "${path.basename(data.source)}"`)
    }

    if (data.cmd === 'progress') {
        // progress_counter++
        let msg = data.msg;
        let max = data.max;
        let value = data.value;
        win.send('set_progress', { value: value, max: max, msg: msg })
        if (value == max) {
            progress_counter = 0;
        }
    }

    if (data.cmd === 'count') {
        win.send('count', data.source, data.count)
    }

    if (data.cmd === 'folder_size_done') {
        win.send('folder_size', data.source, data.folder_size);
    }

})

// Functions //////////////////////////////////////////////

// Save Recent File
function saveRecentFile (href) {

    // Check if the file exists
    const fileExists = fs.existsSync(recent_files_path);
    let jsonData = [];

    if (fileExists) {
        // Read the existing JSON file
        const fileData = fs.readFileSync(recent_files_path, 'utf8');
        jsonData = JSON.parse(fileData);
    }

    // Add the new object to the data
    if (!jsonData) {
        jsonData = [];
    }

    let exists = 0;
    for (key in jsonData) {
        if (jsonData[key] === href) {
            exists = 1;
        }
    }

    if (!exists) {
        jsonData.push(href);
    }

    // Convert the data back to JSON format
    const updatedData = JSON.stringify(jsonData, null, 2); // null, 2 adds indentation for readability

    // Write the updated data to the file
    fs.writeFileSync(recent_files_path, updatedData, 'utf8');

}

// Get Recent Files
function getRecentFiles (callback) {
    fs.readFile(recent_files_path, 'utf-8', (err, data) => {
        if (err) {
            console.log(err);
            return;
        }
        let file_arr = []
        let json_data = JSON.parse(data);
        for (let key in json_data) {
            if (gio.exists(json_data[key])) {
                let file = gio.get_file(json_data[key]);
                file_arr.push(file);
            }
        }
        callback(file_arr);
        //     const recent_files = json_data.reduce((a, b) => {
        //         let existing_obj = a.find(obj => obj.href === b.href);
        //         if (!existing_obj) {
        //             a.push(b);
        //         }
        //         return a
        //     }, [])
        //     let recent_arr = recent_files.sort((a, b) => {
        //         return b.atime - a.atime;
        //     })
        //     return callback(recent_arr);
    })
}

function getSettings() {
    let settings_file = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};
    try {
        settings = JSON.parse(fs.readFileSync(settings_file, 'utf-8'));
    } catch (err) {
        fs.copyFileSync(path.join(__dirname, 'assets/config/settings.json'), settings_file);
        settings = JSON.parse(fs.readFileSync(settings_file, 'utf-8'));
    }
    return settings;
}

// Get Folder Size
function getFolderSize(source, callback) {
    // let dirents = gio.ls(source)
    try {
        get_files_arr(source, '', dirents => {

            dirents.reduce((c, x) => x.type !== 'directory' ? c + 1 : c, 0); //dirents.filter(x => x.is_dir === true).length;
            let size = 0;
            for (let i = 0; i < dirents.length; i++) {
                if (dirents[i].type !== 'directory')
                size += dirents[i].size
            }

            // dirents.reduce((c, x) => x.type === 'directory' ? c + 1 : c, 0); //dirents.filter(x => x.is_dir === true).length;
            // let folder_count = dirents.length;
            return callback(size);
        })
    } catch (err) {
        console.log(err);
    }
}

// Get Folder Count
function getFolderCount(source, callback) {
    // let dirents = gio.ls(source)
    try {
        get_files_arr(source, '', dirents => {
            // let folder_count = dirents.reduce((c, x) => x.type === 'directory' ? c + 1 : c, 0); //dirents.filter(x => x.is_dir === true).length;
            let folder_count = dirents.length;
            return callback(folder_count);
        })
    } catch (err) {

    }
}

// Get File Count
function getFileCount(source, callback) {
    try {
        get_files_arr(source, '', dirents => {
            let file_count = dirents.reduce((c, x) => x.is_dir === false ? c + 1 : c, 0); //dirents.filter(x => x.is_dir === true).length;
            return callback(file_count);
        })
    } catch (err) {

    }
}

// Get Disk Space
function get_disk_space(href) {

    // console.log("Disk Space", getFileSize(parseInt(gio.du(source).totalSpace)));
    // console.log("Free Space", getFileSize(parseInt(gio.du(source).freeSpace)));

    let options = {
        disksize: getFileSize(parseInt(gio.du(href).total)),
        usedspace: getFileSize(parseInt(gio.du(href).used)),
        availablespace: getFileSize(parseInt(gio.du(href).free))
    }
    let df = [];
    df.push(options);
    win.send('disk_space', df);

    // df = [];
    // try {

    //     let cmd = 'df "' + href + '"';
    //     let data = execSync(cmd).toString();
    //     let data_arr = data.split('\n');

    //     // CREATE OPTIONS OBJECT
    //     let options = {
    //         disksize: 0,
    //         usedspace: 0,
    //         availablespace: 0,
    //         foldersize: 0,
    //         foldercount: 0,
    //         filecount: 0
    //     }

    //     if (data_arr.length > 0) {

    //         let res1 = data_arr[1].split(' ');

    //         let c = 0;
    //         res1.forEach((size, i) => {

    //             if (size != '') {

    //                 // 0 DISK
    //                 // 6 SIZE OF DISK
    //                 // 7 USED SPACE
    //                 // 8 AVAILABLE SPACE
    //                 // 10 PERCENTAGE USED
    //                 // 11 CURRENT DIR

    //                 switch (c) {
    //                     case 1:
    //                         options.disksize = getFileSize(parseFloat(size) * 1024)
    //                         break;
    //                     case 2:
    //                         options.usedspace = getFileSize(parseFloat(size) * 1024)
    //                         break;
    //                     case 3:
    //                         options.availablespace = getFileSize(parseFloat(size) * 1024)
    //                         break;
    //                 }

    //                 ++c;

    //             }
    //         })

    //         // options.foldercount = href.folder_count
    //         // options.filecount = href.file_count
    //         df.push(options);
    //         // SEND DISK SPACE
    //         win.send('disk_space', df);
    //         cmd = 'cd "' + href.href + '"; du -s';
    //         du = exec(cmd);

    //         du.stdout.on('data', function (res) {
    //             let size = parseInt(res.replace('.', '') * 1024)
    //             size = get_file_size(size)
    //             win.send('du_folder_size', size)
    //         })

    //     }

    // } catch {
    //     win.send('disk_space', df)
    // }

}

function get_apps() {
    let exe_arr = [];
    gio.ls('/usr/share/applications', (err, data) => {

        if (err) {
            console.log('error:' + err)
        }

        data.forEach(item => {
            let content = fs.readFileSync(item.href, 'utf-8');
            let data = content.split('\n');

            let exe_obj = {};

            for (const line of data) {

                if (line.startsWith('Exec=')) {

                    let cmd = line.substring(5).trim();
                    const exe = cmd.split(' ')[0];

                    exe_obj.cmd = cmd;
                    exe_obj.exe = exe;

                }

                if (line.startsWith('Name=')) {
                    let name = line.substring(5).trim();
                    exe_obj.name = name;
                }

                if (line.startsWith('Type=')) {
                    let type = line.substring(5).trim();
                    exe_obj.type = type;
                }

            }

            exe_arr.push(exe_obj);

        })

    })
    const arr = exe_arr.reduce((accumulator, current) => {
        if (!accumulator.find((item) => item.exe === current.exe)) {
            accumulator.push(current);
        }
        return accumulator;
    }, []);
    return arr;
}

function new_folder(destination) {

    try {
        gio.mkdir(destination);
        if (watcher_failed) {
            win.send('get_card_gio', gio.get_file(destination));
        }
    } catch (err) {
        win.send('msg', err);
    }
    // win.send('new_folder', gio.get_file(destination));

}

function watch_for_theme_change() {
    let watch_dir = path.join(path.dirname(app.getPath('userData')), 'dconf')
    if (gio.exists(watch_dir)) {
        let file = gio.get_file(watch_dir)
        let fsTimeout
        fs.watchFile(watch_dir, (e) => {
            let file0 = gio.get_file(watch_dir)
            if (file0.mtime > file.mtime) {
                win.webContents.reloadIgnoringCache();
                fsTimeout = setTimeout(function () {
                    fsTimeout = null
                }, 5000)
            }
        })
    } else {
        // console.log('error getting gnome settings directory')
    }
}

function getFileSize(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);
    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
};

let file_arr = [];
let cp_recursive = 0;
function get_files_arr(source, destination, callback) {
    cp_recursive++
    file_arr.push({ type: 'directory', source: source, destination: destination })
    gio.ls(source, (err, dirents) => {
        for (let i = 0; i < dirents.length; i++) {
            let file = dirents[i]
            if (file.is_dir) {
                get_files_arr(file.href, path.format({ dir: destination, base: file.name }), callback)
            } else {
                let src = file.href;
                let dest = path.format({ dir: destination, base: file.name });

                if (gio.exists(dest)) {

                    let f1 = gio.get_file(src);
                    let f2 = gio.get_file(dest);

                    if (f1.mtime < f2.mtime) {
                        file_arr.push({
                            type: 'file',
                            source: src,
                            destination: dest,
                            size: file.size,
                        })
                    }

                } else {
                    file_arr.push({
                        type: 'file',
                        source: src,
                        destination: dest,
                        size: file.size,
                    })
                }

            }
        }
        if (--cp_recursive == 0) {
            let file_arr1 = file_arr;
            file_arr = []
            return callback(file_arr1);

        }
    })
}

// Get files array
function get_files(source, tab) {

    try {
        watcher_failed = 0;
        gio.watcher(source, (watcher) => {
            if (watcher.event !== 'unknown') {
                if (watcher.event === 'deleted') {
                    win.send('remove_card', watcher.filename);
                }
                if (watcher.event === 'created') {
                    try {
                        let file = gio.get_file(watcher.filename);
                        win.send('get_card_gio', file);
                        if (file.is_dir) {
                            win.send('get_folder_count', watcher.filename);
                            win.send('get_folder_size', watcher.filename);
                        }
                    } catch (err) {
                        console.log(err)
                    }
                }
                get_disk_space(source);
            }
        })
    } catch (err) {
        console.log('watcher err', err.message);
        win.send('msg', err);
        watcher_failed = 1;
    }

    // Call create thumbnails
    let thumb_dir = path.join(app.getPath('userData'), 'thumbnails');
    if (source.indexOf('mtp') > -1 || source.indexOf('thumbnails') > -1) {
        thumb.postMessage({cmd: 'create_thumbnail', source: source, destination: thumb_dir, sort: sort});
    } else {
        thumb.postMessage({cmd: 'create_thumbnail', source: source, destination: thumb_dir, sort: sort});
    }

    // Call ls worker to get file data
    ls.postMessage({ cmd: 'ls', source: source, tab: tab });

    get_disk_space(source);

}

function copyOverwrite(copy_overwrite_arr) {
    copy_overwrite_arr.every(item => {
        gio_utils.get_file(item.source, source_file => {

            gio_utils.get_file(item.destination, destination_file => {
                confirmOverwrite(source_file, destination_file);
            })

        })

    })
}

// IPC ////////////////////////////////////////////////////
/** */

ipcMain.handle('find', async (e, cmd) => {

    let { stdout, stderr } = await exec(cmd);

    if (stderr) {
        win.send('msg', stderr);
        return;
    }

    let files = stdout.split('\n');
    if (files.length > 500) {

        return false;

    } else {

        let search_arr =  [];
        let c = 0;
        for (let i = 0; i < files.length; i++) {

            if (files[i] != '') {
                ++c
                search_arr.push(files[i])
            }

        }

        return search_arr;

    }

})


ipcMain.handle('df', async (e) => {
    const { stdout, stderr } = await exec('df');
    if (stdout) {
        return stdout.toString().split('\n');
    }
    if (stderr) {
        return stderr;
    }
    // const {stdout, stderr} = await exec('df').toString().split('\n');
})

ipcMain.on('set_execute', (e, href) => {
    gio.set_execute(href);
})

ipcMain.on('clear_execute', (e, href) => {
    gio.clear_execute(href);
})

// Get templates path
ipcMain.handle('get_templates_folder', (e) => {
    return path.join(home, 'Templates');
})

// Get Files Array
ipcMain.on('get_files_arr_merge', (e, source, destination, copy_arr) => {
    worker.postMessage({'cmd': 'merge_files', source: source, destination: destination, copy_arr: copy_arr});
})

// Get home directory
ipcMain.handle('home', (e) => {
    return home;
})

// Write find page
ipcMain.on('save_find', (e, data) => {
    fs.writeFileSync(path.join(__dirname, 'src/find.html'), data);
})

//
ipcMain.handle('nav_item', (e, dir) => {
    // Handle special dirs
    switch (dir) {
        case 'Home': {
            dir = home;
            break;
        }
        case '/': {
            dir = '/';
            break;
        }
        default: {
            dir = path.join(home, dir);
        }
    }

    return dir;
})

// DragSelect
// ipcMain.handle('init_drag_select', (e) => {
//     return ds = new DragSelect({
//         // area: main,
//         // selectorClass: 'drag_select',
//         // keyboardDragSpeed: 0,
//     })
//     // return DragSelect;
// })

// New Folder
ipcMain.on('new_folder', (e, destination) => {
    let folder_path = `${path.format({dir: destination, base: 'New Folder'})}`
    try{
        gio.mkdir(folder_path)
    } catch (err) {
        win.send('msg', err.message);
    }
    // win.send('get_card_gio', folder_path);
})

// Extract
ipcMain.on('extract', (e, location) => {

    selected_files_arr.forEach(item => {

        let cmd = '';
        let us_cmd = '';
        let filename = '';
        let source = item;
        let ext = path.extname(source).toLowerCase();
        let makedir = 1;

        // console.log('extension ', source);
        let c = 0;
        switch (ext) {
            case '.zip':
                filename = source.replace('.zip', '')
                c = 0
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
                cmd = "unzip '" + source + "' -d '" + filename + "'"
                break;
            case '.tar':
                filename = source.replace('.tar', '')
                c = 0
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
                cmd = 'cd "' + location + '"; /usr/bin/tar --strip-components=1 -xzf "' + source + '"'
                break;
            case '.gz':
                filename = source.replace('.tar.gz', '')
                c = 0
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
                cmd = 'cd "' + location + '"; /usr/bin/tar -xzf "' + source + '" -C "' + filename + '"';

                break;
            case '.xz':
                filename = source.replace('tar.xz', '')
                filename = filename.replace('.img.xz', '')
                c = 0
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "xz -l -v '" + source + "' | awk 'FNR==11{print $6}'"
                // cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xf "' + source + '" -C "' + filename + '"'
                if (source.indexOf('img.xz') > -1) {
                    makedir = 0;
                    cmd = 'cd "' + location + '"; /usr/bin/unxz -k "' + source + '"';
                    // cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/xz -d -k "' + source + '"';
                } else {
                    cmd = 'cd "' + location + '"; /usr/bin/tar -xf "' + source + '" -C "' + filename + '"';
                }
                break;
            case '.bz2':
                filename = source.replace('.bz2', '')
                c = 0
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
                cmd = 'cd "' + location + '"; /usr/bin/bzip2 -dk "' + source + '"'
                break;

        }

        // console.log('cmd ' + cmd);
        // console.log('uncompressed size cmd ' + us_cmd);

        if (makedir) {
            gio.mkdir(filename)
            // fs.mkdirSync(filename);
        }

        // GET UNCOMPRESSED SIZE
        let uncompressed_size = parseInt(execSync(us_cmd).toString().replaceAll(',', ''))

        win.send('msg', `Extracting ${source}`);

        // THIS NEEDS WORK. CHECK IF DIRECTORY EXIST. NEED OPTION TO OVERWRITE
        exec(cmd, { maxBuffer: Number.MAX_SAFE_INTEGER }, (err, stdout, stderr) => {

            if (err) {
                // console.log('error ' + err)
                win.send('msg', err);
            } else {
                try {
                    // GET REFERENCE TO FOLDER GRID
                    if (watcher_failed) {
                        win.send('get_card_gio', gio.get_file(filename));
                    }
                    win.send('get_folder_count', filename);
                    win.send('get_folder_size', filename);
                } catch (err) {
                    // console.log(err)
                    win.send('msg', err);
                }
                win.send('msg', `Extracted ${source}`);
            }
        })
    })

    selected_files_arr = [];

})

// Compress
ipcMain.on('compress', (e, location, type) => {

    let file_list = [];
    selected_files_arr.forEach((item, idx) => {
        file_list += "'" + path.basename(item) + "' ";
    })

    // Create command for compressed file
    destination = path.basename(selected_files_arr[0]);
    selected_files_arr = [];

    if (type === 'zip') {
        destination = destination.substring(0, destination.length - path.extname(destination).length) + '.zip';
        cmd = `cd '${location}'; zip -r '${destination}' ${file_list}`;
    } else {
        destination = destination.substring(0, destination.length - path.extname(destination).length) + '.tar.gz';
        cmd = `cd '${location}'; tar czf '${destination}' ${file_list}`;
    }

    exec(cmd, (err, stdout) => {
        if (err) {
            console.log(err);
        } else {

            if (watcher_failed) {
                win.send('get_card_gio', gio.get_file(path.format({dir: location, base: destination})))
            }
            // ipcRenderer.send('get_card_gio',path.format({dir: location.value, base: destination}))
        }
    })
    selected_files_arr = [];
})

// Path Utilities //////////////////////////////////
// **

// Join

ipcMain.handle('path:extname', (e, href) => {
    return path.extname(href)
})

ipcMain.handle('path:join', (e, dir) => {
    return path.join(__dirname, dir)
})

// Path Format
ipcMain.handle('path:format', (e, dir, base) => {
    return path.format({dir: dir, base: path.basename(base)});
})

// Dirname
ipcMain.handle('dirname', (e, source) => {
    return path.dirname(source);
})

// Get path
ipcMain.handle('basename', (e, source) => {
    return path.basename(source);
})

////////////////////////////////////////////////////
/** */

ipcMain.on('merge_files_confirmed', (e, filter_merge_arr, is_move) => {

    filter_merge_arr.forEach((item, i) => {
        if (item.action === 1) {
            gio.cp(item.source, item.destination, 1);
            if (is_move) {
                gio.rm(item.source);
            }
        } else if (item.action === 2) {
            let destination_dir = path.dirname(item.destination);
            if (!gio.exists(destination_dir)) {
                gio.mkdir(destination_dir);
            }
            gio.cp(item.source, item.destination, 1);
            if (is_move) {
                gio.rm(item.source);
            }
        }

        win.send('set_progress', { value: i + 1, max: filter_merge_arr.length, msg: `Copying ${i + 1} of ${filter_merge_arr.length}`});
        if (i == filter_merge_arr.length - 1) {
            progress_counter = 0;
        }
    })

    win.send('done_merging_files');
    // win.send('msg', 'Done Merging Files');

})

// ipcMain.on('umount', (e, uuid) => {
//     gio.umount(uuid)
// })

ipcMain.on('umount', (e, href) => {
    exec(`gio mount -u -f ${href}`, (err, stderr, stdout) => {
        if (err) {
            win.send('msg', err);
        }
    });
})

// Search Results
ipcMain.on('search_results', (e , search_arr) => {
    let arr = []
    search_arr.forEach(item => {
        try {
            arr.push(gio.get_file(item));
        } catch (err) {
        }
    })
    win.send('search_results', (e, arr))
})

// Run external command
ipcMain.on('command', (e, cmd) => {
    exec(cmd, (error, data, getter) => { });
})

ipcMain.on('connect_dialog', (e) => {
    connectDialog();
})

// Connect
ipcMain.handle('connect', async (e, cmd) => {

    try {
        const { stdout, stderr } = await exec(cmd);
        return 1;
    } catch (err) {
        return err.message;
    }

})

// Icon Theme
ipcMain.handle('folder_icon', (e) => {
    let icon_theme = execSync('gsettings get org.gnome.desktop.interface icon-theme').toString().replace(/'/g, '').trim();
    let icon_dir = path.join(__dirname, 'assets', 'icons');
    try {
        let search_path = [];
        search_path.push(path.join(home, '.local/share/icons'), path.join(home, '.icons'), '/usr/share/icons');
        search_path.every(icon_path => {
            if (fs.existsSync(path.join(icon_path, icon_theme))) {
                icon_dir = path.join(icon_path, icon_theme);

                return false;
            } else {
                icon_dir = path.join(__dirname, 'assets', 'icons', 'kora');
                return true;
            }
        })
        let folder_icon_path = ''
        let icon_dirs = [path.join(icon_dir, 'places@2x/48/folder.svg'), path.join(icon_dir, '32x32/places/folder.png'), path.join(icon_dir, 'places/scalable/folder.svg'), path.join(icon_dir, 'places/64/folder.svg')];
        icon_dirs.every(icon_dir => {
            if (fs.existsSync(icon_dir)) {
                folder_icon_path = icon_dir
                return false;
            } else {
                folder_icon_path = path.join(__dirname, 'assets/icons/folder.svg')
                return true;
            }
        })
        return folder_icon_path;
    } catch (err) {
        console.log(err);
    }
})

// Get Writable Theme
ipcMain.handle('writable_icon', (e) => {
    let icon_theme = execSync('gsettings get org.gnome.desktop.interface icon-theme').toString().replace(/'/g, '').trim();
    let icon_dir = path.join(__dirname, 'assets', 'icons');
    try {
        let search_path = [];
        search_path.push(path.join(home, '.local/share/icons'), path.join(home, '.icons'), '/usr/share/icons');
        search_path.every(icon_path => {
            if (fs.existsSync(path.join(icon_path, icon_theme))) {
                icon_dir = path.join(icon_path, icon_theme);

                return false;
            } else {
                icon_dir = path.join(__dirname, 'assets', 'icons');
                return true;
            }
        })
        let folder_icon_path = ''
        let icon_dirs = [path.join(icon_dir, 'emblems@2x/16/emblem-readonly.svg'), path.join(icon_dir, '16x16/emblems/emblem-readonly.svg'), path.join(icon_dir, 'emblems/scalable/emblem-readonly.svg'), path.join(icon_dir, 'emblems/16/emblem-readonly.svg')];
        icon_dirs.every(icon_dir => {
            if (fs.existsSync(icon_dir)) {
                folder_icon_path = icon_dir
                return false;
            } else {
                folder_icon_path = path.join(__dirname, 'assets/icons/emblem-readonly.svg')
                return true;
            }
        })
        return folder_icon_path;
    } catch (err) {
        console.log(err);
    }
})

// Get Symlink Theme
ipcMain.handle('symlink_icon', (e) => {
    let icon_theme = execSync('gsettings get org.gnome.desktop.interface icon-theme').toString().replace(/'/g, '').trim();
    let icon_dir = path.join(__dirname, 'assets', 'icons');
    try {
        let search_path = [];
        search_path.push(path.join(home, '.local/share/icons'), path.join(home, '.icons'), '/usr/share/icons');
        search_path.every(icon_path => {
            if (fs.existsSync(path.join(icon_path, icon_theme))) {
                icon_dir = path.join(icon_path, icon_theme);

                return false;
            } else {
                icon_dir = path.join(__dirname, 'assets', 'icons');
                return true;
            }
        })
        let folder_icon_path = ''
        let icon_dirs = [path.join(icon_dir, 'emblems@2x/16/emblem-symbolic-link.svg'), path.join(icon_dir, '16x16/emblems/emblem-symbolic-link.svg'), path.join(icon_dir, 'emblems/scalable/emblem-symbolic-link.svg'), path.join(icon_dir, 'emblems/16/emblem-symbolic-link.svg')];
        icon_dirs.every(icon_dir => {
            if (fs.existsSync(icon_dir)) {
                folder_icon_path = icon_dir
                return false;
            } else {
                folder_icon_path = path.join(__dirname, 'assets/icons/emblem-symbolic-link.svg')
                return true;
            }
        })
        return folder_icon_path;
    } catch (err) {
        console.log(err);
    }
})

// Change theme
ipcMain.on('change_theme', (e, theme) => {
    nativeTheme.themeSource = theme.toLocaleLowerCase();
})

// Get Settings
ipcMain.on('saveRecentFile', (e, href) => {
    saveRecentFile(href);
})

ipcMain.on('update_settings', (e, key, value) => {
    workspace[key] = value;
    fs.writeFileSync(settings_file, JSON.stringify(workspace, null, 4));
    win.send('msg', 'Settings updated')
})

ipcMain.on('create_thumbnail', (e, href) => {

    // Note: Attempting thumbnail creation at the get_files call

    // let thumb_dir  = path.join(app.getPath('userData'), 'thumbnails');
    // let thumbnail = `${path.join(thumb_dir, path.basename(href))}`;
    // gio.thumbnail(href);
    // thumb.postMessage({cmd: 'create_thumbnail', href: href});

    // if (!href.indexOf('sftp:') > -1) {
        let thumb_dir = path.join(app.getPath('userData'), 'thumbnails')
        thumb.postMessage({cmd: 'create_thumbnail', href: href, thumb_dir: thumb_dir});
    // }
})

ipcMain.handle('get_thumbnails_directory', async (e) => {
    let thumbnails_dir  = path.join(app.getPath('userData'), 'thumbnails')
    if (!fs.existsSync(thumbnails_dir)) {
        fs.mkdirSync(thumbnails_dir)
    }
    return thumbnails_dir;
})

ipcMain.handle('get_thumbnail', (e, file) => {
    let thumbnail_dir  = path.join(app.getPath('userData'), 'thumbnails')
    let thumbnail = `${path.join(thumbnail_dir, `${file.mtime}_${path.basename(file.href)}`)}`
    if (!gio.exists(thumbnail)) {
        thumbnail = `./assets/icons/image-generic.svg`
    }
    return thumbnail;
})

// Populate global selected files array
ipcMain.on('get_selected_files', (e, selected_files) => {
    selected_files_arr = selected_files;
    // // console.log('selected files array', selected_files_arr);
})

function isValidUTF8(str) {
    try {
        new TextDecoder("utf-8").decode(new TextEncoder().encode(str));
        return true;
    } catch (error) {
        return false;
    }
}

ipcMain.on('search', (e, search, location, depth) => {
    // if (!isValidUTF8(search) || !isValidUTF8(location)) {
    //     throw new Error("Invalid UTF-8 string");
    // }
    // gio.search(search, location, res => {
    //     console.log(res);
    // })
    find.postMessage({cmd: 'search', search: search, location: location, depth: depth});
})

// Om Get Recent Files
ipcMain.on('get_recent_files', (e, dir) => {
    getRecentFiles(dirents => {
        win.send('recent_files', dirents)
    })
})

// On Get Folder Size
ipcMain.on('get_folder_size', (e, href) => {
    worker.postMessage({cmd: 'folder_size', source: href});
})

// On Get Folder Count
ipcMain.on('get_folder_count', (e, href) => {
    worker.postMessage({cmd: 'folder_count', source: href});
})

// On Get Folder Count
ipcMain.on('get_file_count', (e, href) => {
    try {
        getFileCount(href, file_count => {
            win.send('file_count', href, file_count);
        })
    } catch (err) {
        // console.log(err);
    }
})

// On Properties
ipcMain.on('get_properties', (e, selected_files_arr, location) => {
    let properties_arr = [];
    if (selected_files_arr.length > 0) {
        selected_files_arr.forEach(item => {
            let properties = gio.get_file(item);
            // console.log(properties);
            properties_arr.push(properties);
        })
    } else {
        let properties = gio.get_file(location);
        properties_arr.push(properties);
    }
    // console.log('props', properties_arr);
    win.send('properties', properties_arr);
})

// On get card gio
ipcMain.on('get_card_gio', (e, destination) => {
    win.send('get_card_gio', gio.get_file(destination));
})

ipcMain.handle('get_subfolders', (e, source) => {
    gio.ls(source, (err, dirents) => {
        return dirents;
    })
})

ipcMain.handle('settings', async (e) => {
    let settings = await JSON.parse(fs.readFileSync(settings_file, 'utf-8'));
    return settings;
})

ipcMain.on('count', (e, href) => {
    worker.postMessage({ cmd: 'count', source: href });
})

// New Window
ipcMain.on('new_window', (e) => {
    createWindow();
})

ipcMain.on('clip', (e, href) => {
    clipboard.write()
})

// ipcMain.on('ondragstart', (e, href) => {
//     const icon = path.join(__dirname, 'assets/icons/dd.png');
//     e.sender.startDrag({
//         file: href,
//         icon: icon
//     })
// })

// Get Devices
ipcMain.handle('get_devices', async (e) => {

    return new Promise((resolve, reject) => {
        let device_arr = gio.get_mounts();
        // console.log(device_arr)
        let filter_arr = device_arr.filter(x => x.name != 'mtp')
        resolve(filter_arr);
    });
})

// Add Workspace
ipcMain.on('add_workspace', (e, selected_files_arr) => {

    let workspace_file = path.join(app.getPath('userData'), 'workspace.json');
    let workspace_data = JSON.parse(fs.readFileSync(workspace_file, 'utf8'))

    selected_files_arr.forEach(item => {
        let file = gio.get_file(item);
        workspace_data.push(file)
    })
    fs.writeFileSync(workspace_file, JSON.stringify(workspace_data, null, 4));
    win.send('get_workspace');
    selected_files_arr = [];
})

// Remove Workspace
ipcMain.on('remove_workspace', (e, href) => {

    let workspace_file = path.join(app.getPath('userData'), 'workspace.json');
    let workspace_data = JSON.parse(fs.readFileSync(workspace_file, 'utf8'));

    let workspace = workspace_data.filter(data => data.href !== href);
    fs.writeFileSync(workspace_file, JSON.stringify(workspace, null, 4));

    win.send('get_workspace');

    selected_files_arr = [];
})

// Get Workspae
ipcMain.handle('get_workspace', async (e) => {
    let workspace_file = path.join(app.getPath('userData'), 'workspace.json');
    if (!gio.exists(workspace_file)) {
        let workspace_data = [];
        fs.writeFileSync(workspace_file, JSON.stringify(workspace_data, null, 4));
    }
    let workspace_items = JSON.parse(fs.readFileSync(workspace_file, 'utf-8'));
    return workspace_items;

})

// Set isMain Flag
ipcMain.on('main', (e, flag) => {
    is_main = flag;
})

// New Folder
ipcMain.on('mkdir', (e, href) => {
    worker.postMessage({ cmd: 'mkdir', destination: href })
})

// Open File in Native Application
ipcMain.on('open', (e, href) => {
    shell.openPath(href);
})

// Get File Icon
ipcMain.handle('get_icon', async (e, href) => {
    return await app.getFileIcon(href, { size: 32 }).then(icon => {
        return icon.toDataURL();
    }).catch((err) => {
        return err;
    })
})

ipcMain.on('paste', (e, destination) => {

    // Note: Added a global array called selected_files_arr
    // This facilitates copying files between windows
    // Make sure this array gets cleared
    // Refer to preload.js: getSelectedFiles() sends the call to populate the array and is used in multiple operations in preload.js
    // Refer to main.js: ipcMain.on('selected_files', (e, selected_files)

    let copy_arr = [];
    let copy_overwrite_arr = []
    let overwrite = 0;
    let location = destination; //document.getElementById('location');
    if (selected_files_arr.length > 0) {

        for(let i = 0; i < selected_files_arr.length; i++) {

            let source = selected_files_arr[i];
            let destination = path.format({dir: location, base: path.basename(selected_files_arr[i])});
            let file = gio.get_file(source)

            // Directory
            if (file.type === 'directory') {
                if (source == destination) {
                    // destination = `${destination} (1)`;
                } else {
                    if (gio.exists(destination)) {
                        win.send('msg', 'Overwrite not yet implemented');
                        overwrite = 1;
                    }
                }

            // Files
            } else {
                if (source === destination) {
                    // this is not building the filename correctly when a file extension has .tar.gz
                    destination = path.dirname(destination) + '/' + path.basename(destination, path.extname(destination)) + ' (Copy)' + path.extname(destination);
                } else {
                    if (gio.exists(destination)) {
                        // win.send('msg', 'Overwrite not yet implemented');
                        overwrite = 1;
                    }
                }
            }

            let copy_data = {
                source: source, //selected_files_arr[i],
                destination: destination //path.format({dir: location, base: path.basename(selected_files_arr[i])}),  //path.join(location, path.basename(selected_files_arr[i]))
            }

            if (overwrite == 0) {
                copy_arr.push(copy_data);
            } else {
                copy_overwrite_arr.push(copy_data)
            }

            if (i == selected_files_arr.length - 1) {
                if (copy_arr.length > 0) {
                    worker.postMessage({ cmd: 'paste', copy_arr: copy_arr });
                }
                if (copy_overwrite_arr.length > 0) {
                    overWriteNext(copy_overwrite_arr);
                }

                copy_arr = [];
                copy_overwrite_arr = [];
                selected_files_arr = [];
            }
            // Reset variables
            overwrite = 0;
        }

    } else {
        //msg(`Nothing to Paste`);
    }

})

// Move
ipcMain.on('move', (e, destination) => {
    let copy_arr = [];
    if (selected_files_arr.length > 0) {
        for(let i = 0; i < selected_files_arr.length; i++) {
            let copy_data = {
                source: selected_files_arr[i],
                destination: path.format({dir: destination, base: path.basename(selected_files_arr[i])})
            }
            copy_arr.push(copy_data);
        }
        worker.postMessage({ cmd: 'mv', selected_items: copy_arr });
        selected_files_arr = [];
        copy_arr = [];
    } else {
        win.send('msg', `Nothing to Paste`);
    }
})

// Get Folder Size
ipcMain.handle('get_folder_size', async (e, href) => {
    try {
        let cmd = "cd '" + href.replace("'", "''") + "'; du -Hs";
        const { err, stdout, stderr } = await exec(cmd);
        let size = parseFloat(stdout.replace('.', ''));
        size = size * 1024
        return size;
    } catch (err) {
        return 0
    }
})

// Dont use this - maybe handle in cpp using gio
// ipcMain.on('get_folder_size', (e, href) => {
//     worker.postMessage({cmd: 'get_folder_size', source: href});
// })


ipcMain.on('rename', (e, source, destination) => {
    worker.postMessage({ cmd: 'rename', source: source, destination: destination });
})

//////////////////////////////////////////////////////////////

// Create Main Winsow
function createWindow() {

    let displayToUse = 0;
    let lastActive = 0;
    let displays = screen.getAllDisplays();

    // Single Display
    if (displays.length === 1) {
        displayToUse = displays[0];
        // Multi Display
    } else {
        // if we have a last active window, use that display for the new window
        if (!displayToUse && lastActive) {
            displayToUse = screen.getDisplayMatching(lastActive.getBounds());
        }

        // fallback to primary display or first display
        if (!displayToUse) {
            displayToUse = screen.getPrimaryDisplay() || displays[3];
        }
    }

    if (workspace.window.x == 0) {
        workspace.window.x = displayToUse.bounds.x + 50
    }

    if (workspace.window.y == 0) {
        workspace.window.y = displayToUse.bounds.y + 50
    }

    // WINDOW OPTIONS
    let options = {
        minWidth: 400,
        minHeight: 600,
        width: workspace.window.width,
        height: workspace.window.height,
        backgroundColor: '#2e2c29',
        x: workspace.window.x,
        y: workspace.window.y,
        frame: true,
        autoHideMenuBar: true,
        icon: path.join(__dirname, '/assets/icons/folder.png'),
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: true,
            nativeWindowOpen: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: true,
        },
    }

    win = new BrowserWindow(options);
    win.loadFile('index.html');

    win.once('ready-to-show', () => {
        win.show();
        // watch_for_theme_change();
        // win.webContents.once('dom-ready', () => {
        //     const selectables = win.webContents.executeJavaScript('document.querySelectorAll(".card")');
        //     const selectableContainer = win.webContents.executeJavaScript('document.getElementById("main")');
        //     dragSelect = new DragSelect({
        //         selectables: selectables,
        //         area: selectableContainer,
        //     });
        // });

    });

    win.on('closed', () => {
        windows.delete(win);
    });

    win.on('resize', (e) => {
        let intervalid = setInterval(() => {
            workspace.window.width = win.getBounds().width;
            workspace.window.height = win.getBounds().height;
            // fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings, null, 4));
            fs.writeFileSync(settings_file, JSON.stringify(workspace, null, 4));
        }, 1000);
    })

    win.on('move', (e) => {
        workspace.window.x = win.getBounds().x;
        workspace.window.y = win.getBounds().y;
        // fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings, null, 4));
        fs.writeFileSync(settings_file, JSON.stringify(workspace, null, 4));
    })
    windows.add(win);

};

process.on('uncaughtException', (err) => {
    console.log('Uncaught Exception', err.message)
    // win.send('msg', error.message);
})

// Define the app events
app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on('get_files', (e, source, tab) => {
    get_files(source, tab)
    // worker.postMessage({cmd: 'preload', source: source});

    // let du = gio.du(source);
    // // console.log('disk usage', getFileSize(Math.abs(du)));
})

// Dialogs ////////////////////////////////////////////////////////////

function aboutDialog() {
    const packageInfo = require('./package.json');
    const aboutOptions = {
        title: `About ${packageInfo.name}`,
        message: `${packageInfo.name} ${packageInfo.version}`,
        detail: packageInfo.description,
        icon: path.join(__dirname, 'path/to/your/app-icon.png'),
        buttons: ['OK'],
        defaultId: 0,
    };

    dialog.showMessageBox(null, aboutOptions);
}

function open_with(file) {

    let bounds = win.getBounds()

    let x = bounds.x + parseInt((bounds.width - 400) / 2);
    let y = bounds.y + parseInt((bounds.height - 250) / 2);

    // Dialog Settings
    let confirm = new BrowserWindow({

        parent: window.getFocusedWindow(),
        modal: true,
        width: 400,
        height: 450,
        backgroundColor: '#2e2c29',
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'preload.js'),
        },

    })

    // Load file
    confirm.loadFile('dialogs/openwith.html')

    // Show dialog
    confirm.once('ready-to-show', () => {

        let title = 'Choose Application';
        confirm.title = title;
        confirm.removeMenu();

        // confirm.webContents.openDevTools();
        // get_desktop_apps();

        let exe_arr = get_apps();
        confirm.send('open_with', file, exe_arr);
        exe_arr = [];

    })

}

// Network connect dialog
function connectDialog() {

    let bounds = win.getBounds()

    let x = bounds.x + parseInt((bounds.width - 400) / 2);
    let y = bounds.y + parseInt((bounds.height - 350) / 2);


    let connect = new BrowserWindow({
        parent: window.getFocusedWindow(),
        width: 400,
        height: 350,
        backgroundColor: '#2e2c29',
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    connect.loadFile('dialogs/connect.html')
    // connect.webContents.openDevTools()

    // SHOW DIALG
    connect.once('ready-to-show', () => {
        let title = 'Connect to Server'
        connect.title = title
        connect.removeMenu()
        connect.send('connect')
    })

}

// Confirm Overwrite
function confirmOverwrite(source_file, destination_file, copy_overwrite_arr) {

    let bounds = win.getBounds()

    let x = bounds.x + parseInt((bounds.width - 500) / 2);
    let y = bounds.y + parseInt((bounds.height - 400) / 2);

    const confirm = new BrowserWindow({
        parent: win,
        modal: true,
        width: 550,
        height: 400,
        backgroundColor: '#2e2c29',
        x: x,
        y: y,
        frame: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'dialogs/preload_diag.js'),
        },
    })

    confirm.loadFile('dialogs/confirm.html')
    // confirm.webContents.openDevTools();
    confirm.once('ready-to-show', () => {

        // if (fs.statSync(data.source).isDirectory()) {
        //     confirm.title = 'Copy Folder Conflict'
        // } else {
        //     confirm.title = 'Copy File Conflict'
        // }
        // confirm.removeMenu()
        confirm.show()
        confirm.send('confirming_overwrite', source_file, destination_file, copy_overwrite_arr);

    })
}

// // Confirm Overwrite
// function confirm(source_file, destination_file, copy_overwrite_arr) {

//     let source = source_file.href;
//     let destination = destination_file.href;

//     let source_date = source_file["time::modified"];
//     let destination_date = destination_file["time::modified"];

//     // // console.log(source, destination)

//     let is_newer = 0;
//     if (destination_date > source_date) {
//         is_newer = 1;
//     } else if (destination_date < source_date) {
//         is_newer = 0;
//     } else if (destination_date == source_date) {
//         is_newer = 2;
//         // copy_overwrite_arr.splice(0, 1);
//         // overWriteNext(copy_overwrite_arr);
//         // return;
//     }

//     let is_dir = 0;
//     if (source_file.type == 'directory') {
//         is_dir = 1;
//     } else {
//         is_dir = 0;
//     }

//     let title = ''
//     let msg = ''
//     let buttons = []

//     if (is_dir) {

//         title = `Folder Conflict "${path.basename(source)}"`
//         msg = `Merge Folder "${path.basename(source)}"\n`

//         if (is_newer) {
//             msg = msg + `A newer folder with the same name already exists.\n`
//         } else {
//             msg = msg + `A older folder with the same name already exists.\n`
//         }

//         msg = msg + `Merging will ask for confirmation before replacing any files in te folder that confilict with the files being copied.\n`

//         msg = msg + `\nOriginal Folder\n`
//         buttons = ['Cancel', 'Merge', 'Skip'];

//     } else {

//         title = `File Confict "${path.basename(source)}"`
//         msg = msg +  `Replace File "${path.basename(source)}"\n`

//         if (is_newer == 1) {
//             msg = msg + `A newer file with the same name already exists. `
//         } else if (is_newer == 0) {
//             msg = msg + `An older file with the same name already exists. `
//         } else if (is_newer == 2) {
//             msg = msg + `An file with the same name already exists. `
//         }

//         msg = msg + `Replacing it will overwrite its content\n`

//         msg = msg + `\nOriginal File\n`
//         buttons = ['Cancel', 'Replace', 'Skip'];
//     }

//     msg = msg + `Last Modified: ${gio_utils.getDateTime(destination_date)}\n\n`

//     if (is_dir) {
//         msg = msg + `Merge With\nLast Modified: ${gio_utils.getDateTime(source_date)}`
//     } else {
//         msg = msg + `Replace With\nLast Modified: ${gio_utils.getDateTime(source_date)}`
//     }

//     dialog.showMessageBox(win, {

//         type: 'warning',
//         title: title, //`Merge Folder "${path.basename(source)}"`,
//         message: msg,
//         buttons: buttons, //['Cancel', 'Merge', 'Skip'],
//         checkboxLabel: 'Apply this action to all files and folders',

//     }).then((response) => {
//         let overwrite_all = response.checkboxChecked;
//         switch (response.response) {
//             case 0: {
//                 // Cancel
//                 break;
//             }
//             case 1: {
//                 // Merge / Replace
//                 let copy_arr = copy_overwrite_arr.filter(x => x.source == source);
//                 copy_arr[0].overwrite_flag = 1;

//                 // console.log(`Overwrite Confirmed ${source} with ${destination}`);

//                 if (!is_dir) {
//                     worker.postMessage({cmd: 'paste', copy_arr: copy_arr});
//                 }
//                 copy_overwrite_arr.splice(0, 1);

//                 if (overwrite_all) {
//                     overWriteNext(copy_overwrite_arr, 1);
//                 } else {
//                     overWriteNext(copy_overwrite_arr);
//                 }

//                 break;
//             }
//             case 2: {
//                 // Skip
//                 let copy_arr = copy_overwrite_arr.filter(x => x.source == source);
//                 copy_arr[0].overwrite_flag = 1;

//                 // console.log(`Overwrite Skipped ${source} with ${destination}`);

//                 copy_overwrite_arr.splice(0, 1);
//                 overWriteNext(copy_overwrite_arr);

//                 break;
//             }
//             default:
//                 // Cancel
//                 break;

//           }

//     }).catch((error) => {
//         console.error(error);
//     });

// }

// Confirm Overwrite
function confirm(source_file, destination_file, copy_overwrite_arr) {

    let source = source_file.href;
    let destination = destination_file.href;

    win.send('merge_view', source, destination, copy_overwrite_arr);

    // let source_date = source_file.mtime;
    // let destination_date = destination_file.mtime;

    // // console.log(source, destination)

    // let is_newer = 0;
    // if (destination_date > source_date) {
    //     is_newer = 1;
    // } else if (destination_date < source_date) {
    //     is_newer = 0;
    // } else if (destination_date == source_date) {
    //     is_newer = 2;
    //     // copy_overwrite_arr.splice(0, 1);
    //     // overWriteNext(copy_overwrite_arr);
    //     // return;
    // }

    // let is_dir = 0;
    // if (source_file.is_dir) {
    //     is_dir = 1;
    // } else {
    //     is_dir = 0;
    // }

    // let title = ''
    // let msg = ''
    // let buttons = []

    // if (is_dir) {

    //     title = `Folder Conflict "${path.basename(source)}"`
    //     msg = `Merge Folder "${path.basename(source)}"\n`

    //     if (is_newer) {
    //         msg = msg + `A newer folder with the same name already exists.\n`
    //     } else {
    //         msg = msg + `A older folder with the same name already exists.\n`
    //     }

    //     msg = msg + `Merging will ask for confirmation before replacing any files in te folder that confilict with the files being copied.\n`

    //     msg = msg + `\nOriginal Folder\n`
    //     buttons = ['Cancel', 'Merge', 'Skip'];

    // } else {

    //     title = `File Confict "${path.basename(source)}"`
    //     msg = msg + `Replace File "${path.basename(source)}"\n`

    //     if (is_newer == 1) {
    //         msg = msg + `A newer file with the same name already exists. `
    //     } else if (is_newer == 0) {
    //         msg = msg + `An older file with the same name already exists. `
    //     } else if (is_newer == 2) {
    //         msg = msg + `A file with the same name already exists. `
    //     }

    //     msg = msg + `Replacing it will overwrite its content\n`

    //     msg = msg + `\nOriginal File\n`
    //     buttons = ['Cancel', 'Replace', 'Skip'];
    // }

    // msg = msg + `Last Modified: ${gio_utils.getDateTime(destination_date)}\n\n`

    // if (is_dir) {
    //     msg = msg + `Merge With\nLast Modified: ${gio_utils.getDateTime(source_date)}`
    // } else {
    //     msg = msg + `Replace With\nLast Modified: ${gio_utils.getDateTime(source_date)}`
    // }

    // dialog.showMessageBox(win, {

    //     type: 'warning',
    //     title: title, //`Merge Folder "${path.basename(source)}"`,
    //     message: msg,
    //     buttons: buttons, //['Cancel', 'Merge', 'Skip'],
    //     checkboxLabel: 'Apply this action to all files and folders',

    // }).then((response) => {

    //     let overwrite_all = response.checkboxChecked;
    //     switch (response.response) {
    //         case 0: {

    //             // Cancel
    //             break;
    //         }
    //         case 1: {

    //             // Merge
    //             if (is_dir) {
    //                 // worker.postMessage({'cmd': 'merge', copy_arr: copy_overwrite_arr});

    //                 win.send('merge_view', source, destination);

    //             } else {
    //                 // Replace
    //                 worker.postMessage({'cmd': 'cp', source: source, destination: destination, overwrite_flag: 1});
    //                 copy_overwrite_arr.splice(0, 1);
    //                 overWriteNext(copy_overwrite_arr);
    //             }
    //             break;

    //         }
    //         case 2: {

    //             // Skip
    //             let copy_arr = copy_overwrite_arr.filter(x => x.source == source);
    //             copy_arr[0].overwrite_flag = 1;

    //             // console.log(`Overwrite Skipped ${source} with ${destination}`);

    //             copy_overwrite_arr.splice(0, 1);
    //             overWriteNext(copy_overwrite_arr);

    //             break;
    //         }
    //         default:
    //             // Cancel
    //             break;

    //     }

    // }).catch((error) => {
    //     console.error(error);
    // });

}

// Handle Processing each OverWrite Dialog
function overWriteNext(copy_overwrite_arr, overwrite_all = 0) {

    copy_overwrite_arr.every((item, idx) => {

        let source_file = gio.get_file(item.source);
        let destination_file = gio.get_file(item.destination);

        if (overwrite_all) {
            return false;
        } else {
            confirm(source_file, destination_file, copy_overwrite_arr);
            return false;
        }

        // if (overwrite_all) {
        //     if (item.type === 'directory') {
        //         // confirm(gio.get_file(item.source), gio.get_file(item.destination), copy_overwrite_arr);
        //         if (!gio.exists(item.destination)) {
        //             worker.postMessage({cmd: 'mkdir', destination: item.destination});
        //         }
        //         return true;
        //     } else {
        //         if (gio.exists(item.destination)) {
        //             worker.postMessage({cmd: 'cp', source: item.source, destination: item.destination});
        //         } else {
        //             worker.postMessage({cmd: 'cp', source: item.source, destination: item.destination});
        //         }
        //         // console.log(copy_overwrite_arr.length);
        //         return true
        //     }
        // } else {
        //     if (item.type === 'directory') {

        //         let source_file = gio.get_file(item.source);
        //         let destination_file = gio.get_file(item.destination);

        //         if (gio.exists(item.destination)) {
        //             confirm(source_file, destination_file, copy_overwrite_arr);
        //         } else {
        //             worker.postMessage({cmd: 'mkdir', destination: item.destination});
        //         }
        //         return false;
        //     } else {
        //         if (gio.exists(item.destination)) {

        //             let source_file = gio.get_file(item.source);
        //             let destination_file = gio.get_file(item.destination);

        //             // console.log('source', item.source, 'destination', item.destination)

        //             if (source_file && destination_file) {
        //                 confirm(source_file, destination_file, copy_overwrite_arr);
        //             }
        //             return false;
        //         } else {
        //             gio.cp(item.sourcem, item,destination);
        //             // worker.postMessage({cmd: 'cp', source: item.source, destination: item.destination});
        //         }
        //         copy_overwrite_arr.splice(0, idx);
        //         // console.log(copy_overwrite_arr.length);
        //         return true
        //     }
        // }

    })

    // copy_overwrite_arr.every((item) => {
    //     gio_utils.get_file(item.source, source_file => {
    //         if (!gio.exists(item.destination)) {

    //             // console.log('destination does not exist');
    //             worker.postMessage({cmd: 'paste', copy_arr: copy_overwrite_arr, overwrite_flag: 0});
    //             return false

    //         } else {
    //             gio_utils.get_file(item.destination, destination_file => {

    //                 if (overwrite_all) {

    //                     copy_overwrite_arr.every((item, idx) => {

    //                         if (item.type === 'directory') {

    //                             confirm(source_file, destination_file, copy_overwrite_arr);
    //                             return false;
    //                             // gio_utils.get_file(item.source, source_file1 => {
    //                             //     gio_utils.get_file(item.destination, destination_file1 => {
    //                             //         confirm(source_file1, destination_file1, copy_overwrite_arr);
    //                             //         // copy_overwrite_arr.splice(0, idx);
    //                             //         return false;
    //                             //     })
    //                             // })
    //                         } else {
    //                             if (gio.exists(destination_file.href)) {
    //                                 worker.postMessage({cmd: 'cp', source: item.source, destination: item.destination, overwrite_flag: 1});
    //                             } else {
    //                                 worker.postMessage({cmd: 'cp', source: item.source, destination: item.destination, overwrite_flag: 0});
    //                             }
    //                             copy_overwrite_arr.splice(0, idx);
    //                             return true;
    //                         }
    //                     })
    //                 } else {
    //                     // Show Overwrite Dialog
    //                     confirm(source_file, destination_file, copy_overwrite_arr);
    //                     return false;
    //                 }

    //             })
    //         }
    //     })

    // })
}

// Call Confirm Overwrite function
ipcMain.on('confirm_overwrite', (e, copy_overwrite_arr) => {
    copy_overwrite_arr.forEach(item => {
        get_files_arr(item.source, item.destination, files_arr => {
            overWriteNext(files_arr);
            // for (let i = 0; i < files_arr.length; i++) {
            //     if (file.type === 'file') {
            //         overWriteNext()
            //         // gio_utils.get_file(files_arr[i].source, source => {
            //         //     gio_utils.get_file(files_arr[i].destination, destination => {
            //         //     })
            //         // })
            //     }
            // }
        })
    })
    // overWriteNext(copy_overwrite_arr);
})

// Overwrite Confirmed
ipcMain.on('overwrite_confirmed', (e, source, destination, copy_overwrite_arr) => {

    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide()

    let copy_arr = copy_overwrite_arr.filter(x => x.source == source);
    copy_arr[0].overwrite_flag = 1;

    // console.log(`Overwrite Confirmed ${source} with ${destination}`);
    worker.postMessage({ cmd: 'paste', copy_arr: copy_arr });

    copy_overwrite_arr.splice(0, 1);
    overWriteNext(copy_overwrite_arr);

})

// Overwrite Cancelled
ipcMain.on('overwrite_canceled_all', (e) => {

    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide()

})

// Overwrite Cancelled
ipcMain.on('overwrite_canceled', (e) => {

    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide()

})

// Create Delete Dialog
ipcMain.on('delete', (e, selecte_files_arr) => {
    let bounds = win.getBounds()

    let x = bounds.x + parseInt((bounds.width - 400) / 2);
    let y = bounds.y + parseInt((bounds.height - 250) / 2);

    // Dialog Settings
    let confirm = new BrowserWindow({

        parent: window.getFocusedWindow(),
        modal: true,
        width: 500,
        height: 300,
        backgroundColor: '#2e2c29',
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'preload.js'),
        },

    })

    // Load file
    confirm.loadFile('dialogs/confirmdelete.html')

    // Show dialog
    confirm.once('ready-to-show', () => {

        let title = 'Confirm Delete';
        confirm.title = title;
        confirm.id = confirm;
        confirm.removeMenu();
        // confirm.webContents.openDevTools();

        confirm.send('confirm_delete', selecte_files_arr);
        selecte_files_arr = [];

    })

})

// Delete Confirmed
ipcMain.on('delete_confirmed', (e, selecte_files_arr) => {

    // Send array to worker
    worker.postMessage({ cmd: 'delete_confirmed', files_arr: selecte_files_arr });

    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();

})

// Delete Canceled
ipcMain.on('delete_canceled', (e) => {
    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide()
})

// Menus////////////////////////////////////////////////////////////////

// Set Defaul Launcher
function set_default_launcher(desktop_file, mimetype) {
    let cmd = 'xdg-mime default ' + desktop_file + ' ' + mimetype
    try {
        execSync(cmd)
    } catch (err) {
        notification(err)
    }

}

// Lanucher Menu
let launcher_menu
function add_launcher_menu(menu, e, file) {

    // Populate Open With Menu
    let launchers = gio.open_with(file.href);
    launchers.sort((a, b) => {
        return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase());
    })

    launcher_menu = menu.getMenuItemById('launchers')
    try {
        for (let i = 0; i < launchers.length; i++) {
            launcher_menu.submenu.append(new MenuItem({
                label: launchers[i].name,
                click: () => {

                    // Set Default Application
                    execSync(`xdg-mime default ${path.basename(launchers[i].exec)}.desktop ${launchers[i].mimetype}`);

                    let cmd = launchers[i].cmd.toLocaleLowerCase().replace(/%u|%f/g, `'${file.href}'`);
                    exec(cmd);

                    // shell.openPath(file.href);
                    win.send('clear');

                }
            }))
        }
        launcher_menu.submenu.append(new MenuItem({
            type: 'separator'
        }))

    } catch (err) {
        // console.log(err)
    }
}

function createFileFromTemplate(source, destination) {
    worker.postMessage({ cmd: 'cp', source: source, destination: destination });
}

// Templated Menu
function add_templates_menu(menu, location) {
    let template_menu = menu.getMenuItemById('templates')
    let templates = fs.readdirSync(path.join(home, 'Templates'))
    templates.forEach((file, idx) => {
        let source = path.join(home, 'Templates', file);
        let destination = path.format({ dir: location, base: file });
        template_menu.submenu.append(new MenuItem({
            label: file.replace(path.extname(file), ''),
            click: () => {
                createFileFromTemplate(source, destination);
            }
        }));
    })
}

// Extract Menu
function extract_menu(menu, e) {

    let menu_item = new MenuItem(
        {
            label: '&Extract',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Extract : workspace.keyboard_shortcuts.Extract,
            click: () => {
                e.sender.send('context-menu-command', 'extract')
            }
        }
    )
    menu.insert(15, menu_item)
}

// Convert audio Menu
function add_convert_audio_menu(menu, href) {

    menu.append(new MenuItem({
        label: 'Audio / Video',
        submenu: [
            {
                label: 'Convert to Mp3',
                click: () => {
                    let filename = href.substring(0, href.length - path.extname(href).length) + '.mp3'
                    let cmd = 'ffmpeg -i ' + href + ' ' + filename;
                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            win.send('notification', err);
                        } else {
                            let options = {
                                id: 0,
                                href: filename,
                                linktext: path.basename(filename),
                                is_folder: false,
                                grid: ''
                            }
                            win.send('add_card', options)
                        }
                    })

                    cmd = 'ffprobe -i ' + href + ' -show_entries format=size -v quiet -of csv="p=0"'
                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            win.send('notification', err)
                        } else {
                            win.send('progress', parseInt(stdout))
                        }
                    })

                },
            },
            {
                label: 'Convert to Ogg Vorbis',
                click: () => {
                    let filename = href.substring(0, href.length - path.extname(href).length) + '.ogg'
                    let cmd = 'ffmpeg -i ' + href + ' -c:a libvorbis -q:a 4 ' + filename;

                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            win.send('notification', err);
                        } else {
                            let options = {
                                id: 0,
                                href: filename,
                                linktext: path.basename(filename),
                                is_folder: false,
                                grid: ''
                            }
                            win.send('add_card', options)
                        }
                    })

                    cmd = 'ffprobe -i ' + href + ' -show_entries format=size -v quiet -of csv="p=0"'
                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            win.send('notification', err)
                        } else {
                            win.send('progress', parseInt(stdout))
                        }
                    })
                }
            },
        ]

    }))

}

let sort = 'date_desc';
ipcMain.on('sort', (e, sort_by) => {
    sort = sort_by
})
function sort_menu () {

    let submenu = [
        {
            label: 'Last Modified',
            type: 'radio',
            id: 'date_desc',
            click: () => {
                sort = 'date_desc';
                win.send('sort_cards', 'date_desc')
            }
        },
        {
            label: 'First Modified',
            type: 'radio',
            id: 'date_asc',
            click: () => {
                sort = 'date_asc';
                win.send('sort_cards', 'date_asc')
            }
        },
        {
            label: 'A-Z',
            type: 'radio',
            id: 'name_asc',
            click: () => {
                sort = 'name_asc';
                win.send('sort_cards', 'name_asc')
            }
        },
        {
            label: 'Z-A',
            type: 'radio',
            id: 'name_desc',
            click: () => {
                sort = 'name_desc';
                win.send('sort_cards', 'name_desc')
            }
        },
        {
            label: 'Size',
            type: 'radio',
            id: 'size',
            click: () => {
                sort = 'size';
                win.send('sort_cards', 'size')
            }
        },
        {
            label: 'Type',
            type: 'radio',
            id: 'type',
            click: () => {
                sort = 'type';
                win.send('sort_cards', 'type')
            }
        }
    ]

    return submenu;

}

// Main Menu
ipcMain.on('main_menu', (e, destination) => {

    // console.log('dest', destination)

    is_main = 1;

    const template = [
        {
            label: 'New Window',
            click: () => {
                createWindow(destination);
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'New Folder',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.NewFolder : workspace.keyboard_shortcuts.NewFolder,
            click: () => {
                new_folder(path.format({ dir: destination, base: 'New Folder' }));
            }
        },
        {
            id: 'templates',
            label: 'New Document',
            submenu: [
                {
                    label: 'Open Templates Folder',
                    click: () => {
                        e.sender.send('context-menu-command', 'open_templates'),
                        {
                            type: 'separator'
                        }
                    }
                }],
        },
        {
            type: 'separator'
        },
        {
            label: 'Sort',
            id: 'sort_menu',
            submenu: sort_menu()
        },
        {
            type: 'separator'
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Grid',
                    click: () => {
                        win.send('view', 'grid')
                    }
                },
                {
                    label: 'List',
                    click: () => {
                        win.send('view', 'list')
                    }
                },
            ]
        },
        {
            type: 'separator'
        },
        {
            label: 'Paste',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Paste : workspace.keyboard_shortcuts.Paste,
            click: () => {
                e.sender.send('context-menu-command', 'paste')
            }
        },
        {
            label: 'Select all',
            click: () => {
                e.sender.send('select_all');
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Terminal',
            click: () => {
                e.sender.send('context-menu-command', 'terminal')
            }
        },
        {
            type: 'separator'
        },
        {
            type: 'separator'
        },
        {
            label: 'Show Hidden',
            type: 'checkbox',
            checked: false,
            click: (e) => {
                // e.sender.send('context-menu-command', 'show_hidden')
                win.send('toggle_hidden');
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Disk Usage Analyzer',
            click: () => {
                exec(`baobab ${destination}`);
            }

        }
    ]

    // Create menu
    let menu = Menu.buildFromTemplate(template)


    let sort_menu_item = menu.getMenuItemById('sort_menu');
    let sort_submenu_items = sort_menu_item.submenu.items
    for (const item of sort_submenu_items) {
        if (item.id == sort) {
            item.checked = true;
        }
    }

    // Add templates
    add_templates_menu(menu, destination)

    // Show menu
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// Folders Menu
ipcMain.on('folder_menu', (e, file) => {

    const template = [
        {
            label: 'Open with Code',
            click: () => {
                exec(`cd "${file.href}"; code .`, (err) => {
                    if (err) {
                        return;
                    }
                })
                // e.sender.send('context-menu-command', 'vscode')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'New Window',
            click: () => {
                createWindow(file.href);
            }
        },
        {
            label: 'New Tab',
            click: () => {
                ls.postMessage({ cmd: 'ls', source: file.href, tab: 1 });
            }
        },
        {
            id: 'launchers',
            label: 'Open with',
            submenu: []
        },
        {
            type: 'separator'
        },
        {
            type: 'separator'
        },
        {
            id: 'sort_menu',
            label: 'Sort',
            submenu: sort_menu()
        },
        {
            type: 'separator'
        },
        {
            label: 'New Folder',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.NewFolder : workspace.keyboard_shortcuts.NewFolder,
            click: () => {
                e.sender.send('context-menu-command', 'new_folder')
            }
        },
        // {
        //     id: 'templates',
        //     label: 'New Document',
        //     submenu: [
        //         {
        //             label: 'Open Templates Folder',
        //             click: () => {
        //                 e.sender.send('context-menu-command', 'open_templates'
        //                 ),
        //                 {
        //                     type: 'separator'
        //                 }
        //             }
        //         },],
        // },
        {
            type: 'separator'
        },
        {
            label: 'Add to workspace',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.AddWorkspace : workspace.keyboard_shortcuts.AddWorkspace,
            click: () => {
                e.sender.send('context-menu-command', 'add_workspace');
            },
        },
        {
            type: 'separator'
        },
        {
            label: 'Cut',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Cut : workspace.keyboard_shortcuts.Cut,
            click: () => {
                e.sender.send('context-menu-command', 'cut')
            }
        },
        {
            label: 'Copy',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Copy : workspace.keyboard_shortcuts.Copy,
            click: () => {
                e.sender.send('context-menu-command', 'copy')
            }
        },
        {
            label: '&Rename',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Rename : workspace.keyboard_shortcuts.Rename,
            click: () => {
                e.sender.send('context-menu-command', 'rename')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Compress',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Compress : workspace.keyboard_shortcuts.Compress,
            submenu: [
                {
                    label: 'tar.gz',
                    click: () => {
                        e.sender.send('context-menu-command', 'compress')
                    }
                },
                {
                    label: 'zip',
                    click: () => {
                        e.sender.send('context-menu-command', 'compress_zip')
                    }
                },
            ]
        },
        {
            type: 'separator'
        },
        {
            label: 'Delete',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Delete : workspace.keyboard_shortcuts.Delete,
            click: () => {
                // e.sender.send('context-menu-command', 'delete_folder')
                e.sender.send('context-menu-command', 'delete')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Open in terminal',
            click: () => {
                e.sender.send('context-menu-command', 'terminal');
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Disk Usage Analyzer',
            click: () => {
                exec(`baobab ${file.href}`);
            }

        },
        {
            type: 'separator'
        },
        {
            label: 'Properties',
            accelerator: process.platform == 'darwin' ? workspace.keyboard_shortcuts.Properties : workspace.keyboard_shortcuts.Properties,
            click: () => {
                e.sender.send('context-menu-command', 'properties')
            }
        },

    ]

    const menu = Menu.buildFromTemplate(template);

    // Handle Sort Menu
    let sort_menu_item = menu.getMenuItemById('sort_menu');
    let sort_submenu_items = sort_menu_item.submenu.items
    for (const item of sort_submenu_items) {
        if (item.id == sort) {
            item.checked = true;
        }
    }

    // ADD LAUNCHER MENU
    add_launcher_menu(menu, e, file)

    // ADD TEMPLATES
    // add_templates_menu(menu, file.);

    // ADD LAUNCHER MENU
    //   add_launcher_menu(menu1, e, args);
    menu.popup(BrowserWindow.fromWebContents(e.sender));

})

// Files Menu
ipcMain.on('file_menu', (e, file) => {

    // const template = [
    files_menu_template = [
        {
            id: 'launchers',
            label: 'Open with',
            submenu: []
        },
        {
            type: 'separator'
        },
        {
            label: 'Add to workspace',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.AddWorkspace : workspace.keyboard_shortcuts.AddWorkspace,
            click: () => {
                e.sender.send('context-menu-command', 'add_workspace')
            }
        },
        {
            type: 'separator'
        },
        {
            id: 'sort_menu',
            label: 'Sort',
            submenu: sort_menu()
        },
        {
            type: 'separator'
        },
        {
            label: 'Cut',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Cut : workspace.keyboard_shortcuts.Cut,
            click: () => {
                e.sender.send('context-menu-command', 'cut')
            }
        },
        {
            label: 'Copy',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Copy : workspace.keyboard_shortcuts.Copy,
            click: () => {
                e.sender.send('context-menu-command', 'copy')
            }
        },
        {
            label: '&Rename',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Rename : workspace.keyboard_shortcuts.Rename,
            click: () => { e.sender.send('context-menu-command', 'rename') }
        },
        {
            type: 'separator'
        },
        // {
        //     id: 'templates',
        //     label: 'New Document',
        //     submenu: [
        //         {
        //             label: 'Open Templates Folder',
        //             click: () => {
        //                 e.sender.send('context-menu-command', 'open_templates_folder'
        //                 ),
        //                 {
        //                     type: 'separator'
        //                 }
        //             }
        //         }],
        // },
        {
            label: '&New Folder',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.NewFolder : workspace.keyboard_shortcuts.NewFolder,
            click: () => {
                e.sender.send('context-menu-command', 'new_folder')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Compress',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Compress : workspace.keyboard_shortcuts.Compress,
            submenu: [
                {
                    label: 'tar.gz',
                    click: () => {
                        e.sender.send('context-menu-command', 'compress')
                    }
                },
                {
                    label: 'zip',
                    click: () => {
                        e.sender.send('context-menu-command', 'compress_zip')
                    }
                },
            ]
        },
        {
            type: 'separator'
        },
        {
            label: 'Delete File',
            accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.Delete : workspace.keyboard_shortcuts.Delete,
            click: () => {
                // e.sender.send('context-menu-command', 'delete_file')
                e.sender.send('context-menu-command', 'delete')
            }
        },
        {
            type: 'separator'
        },
        // {
        //     label: 'Terminal',
        //     click: () => {
        //         e.sender.send(
        //             'context-menu-command', 'open_terminal'
        //         )
        //     }
        // },
        {
            type: 'separator'
        },
        {
            label: 'Properties',
            accelerator: process.platform == 'darwin' ? workspace.keyboard_shortcuts.Properties : workspace.keyboard_shortcuts.Properties,
            click: () => {
                e.sender.send('context-menu-command', 'properties')
            }
        },
    ]

    let menu = Menu.buildFromTemplate(files_menu_template)

    // Handle Sort Menu
    let sort_menu_item = menu.getMenuItemById('sort_menu');
    let sort_submenu_items = sort_menu_item.submenu.items
    for (const item of sort_submenu_items) {
        if (item.id == sort) {
            item.checked = true;
        }
    }

    // ADD TEMPLATES
    // add_templates_menu(menu, e, args)

    // ADD LAUNCHER MENU
    add_launcher_menu(menu, e, file)

    // Run as program
    // if (args.access) {
    // add_execute_menu(menu, e, args)
    // }

    // Handle Audio conversion
    let ext = path.extname(file.href);
    if (ext == '.mp4' || ext == '.mp3') {
        add_convert_audio_menu(menu, file.href);
    }

    if (ext == '.xz' || ext == '.gz' || ext == '.zip' || ext == '.img' || ext == '.tar') {
        extract_menu(menu, e);
    }

    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// Devices Menu
ipcMain.on('device_menu', (e, href, uuid) => {

    console.log(uuid)

    device_menu_template = [
        {
            label: 'Connect',
            click: () => {
                connectDialog()
            }
        },
        {
            label: 'Unmount',
            click: () => {
                execSync(`gio mount -u ${href}`);
                win.send('msg', `Device Unmounted`);
                win.send('umount_device');
            }
        },
        // {
        //     label: 'Properties',
        //     accelerator: process.platform == 'darwin' ? settings.keyboard_shortcuts.Properties : settings.keyboard_shortcuts.Properties,
        //     click: () => {
        //         e.sender.send('context-menu-command', 'properties')
        //     }
        // },
    ]

    let menu = Menu.buildFromTemplate(device_menu_template)
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// Workspace Menu
ipcMain.on('workspace_menu', (e, file) => {

    // // console.log(file)
    let workspace_menu_template = [
        {
            label: 'Remove From Workspace',
            click: () => {
                win.send('remove_workspace', file.href);
            }
        },
        {
            label: 'Open Location',
            click: () => {
                win.send('get_view', path.dirname(file.href))
            }
        }
    ]

    let menu = Menu.buildFromTemplate(workspace_menu_template)

    // ADD TEMPLATES
    // add_templates_menu(menu, e, args)

    // ADD LAUNCHER MENU
    // add_launcher_menu(menu, e, args.apps)


    menu.popup(BrowserWindow.fromWebContents(e.sender))

    menu.on('menu-will-close', () => {
        win.send('clear_items');
    });

})

ipcMain.on('sidebar_menu', (e, href) => {

    console.log(href);

    let menu_template = [
        {
            label: 'Open',
            click: () => {
                win.send('get_view', href)
            }
        },
        {
            label: 'Open In New Tab',
            click: () => {
                ls.postMessage({ cmd: 'ls', source: href, tab: 1 });
            }
        },
        {
            label: 'Open In New Window',
            click: () => {

            }
        },
        {
            type: 'separator',
        },
        {
            label: 'Properties',
            click: () => {
                e.sender.send('context-menu-command', 'properties')
            }
        }
    ]
    let menu = Menu.buildFromTemplate(menu_template)
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

ipcMain.on('recent_menu', (e, file) => {

})

// Header Menu
const template = [
    {
        label: 'File',
        submenu : [
            {
                label: 'New Window',
                click: () => {
                    // win.send('context-menu-command', 'open_in_new_window')
                    createWindow();
                }
            },
            {type: 'separator'},
            // {
            //     label: 'Create New Folder',
            //     click: () => {

            //     }
            // },
            {
                label: 'Preferences',
                submenu: [
                    {
                        label: 'Settings',
                        click: () => {
                            win.send('get_settings');
                        }
                    }
                ]
            },
            {type: 'separator'},
            {
                label: 'Connect to Server',
                click: () => {
                    connectDialog();
                }
            },
            {
                label: 'Disks',
                click: () => {
                    let cmd = workspace['Disk Utility']
                    exec(cmd, (err) => {
                        console.log(err)
                    });
                }
            },
            {type: 'separator'},
            {role: 'Close'}
    ]},
    {
        label: 'Edit',
        submenu : [
            {
                role: 'copy',
                click: () => {
                    win.sender.send('copy')
                }
            }
        ]
    },
    {
        label: 'View',
        submenu: [
            // {
            //     label: 'Disk Usage Summary',
            //     click: () => {
            //         win.send('get_disk_summary_view')
            //         // get_diskspace_summary();
            //     }
            // },
            // {type: 'separator'},
            {
                label: 'Sort',
                submenu: [
                    {
                        label: 'Date',
                        // accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+D' : 'CTRL+SHIFT+D',
                        click: () => {win.send('sort', 'date')}
                    },
                    {
                        label: 'Name',
                        click: () => {
                            win.send('sort', 'size')
                        }
                    },
                    {
                        label: 'Size',
                        click: () => {win.send('sort', 'name')}
                    },
                    {
                        label: 'Type',
                        click: () => {win.send('sort', 'type')}
                    },
                ]
            },
            {
                label: 'View',
                submenu: [
                    {
                        label: 'Grid',
                        click: () => {
                            win.send('view', 'grid');
                        }
                    },
                    {
                        label: "List",
                        click: () => {
                            win.send('view', 'list');
                        }
                    }
                ]
            },
            {
                label: 'Show Hidden Files',
                click: () => {
                    // win.send('show_hidden');
                    win.send('msg', 'Error: Not yet implemented');
                }
            },
            {type: 'separator'},
            {
                label: 'Show Sidebar',
                accelerator: process.platform === 'darwin' ? workspace.keyboard_shortcuts.ShowSidebar : workspace.keyboard_shortcuts.ShowSidebar,
                click: () => {
                    let win = window.getFocusedWindow();
                    win.webContents.send('sidebar');
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Toggle theme',
                click: () => {
                    if (nativeTheme.shouldUseDarkColors) {
                        nativeTheme.themeSource = 'light'
                    } else {
                        nativeTheme.themeSource = 'dark'
                    }
                }
            },
            {role: 'toggleDevTools'},
            {type: 'separator'},
            {type: 'separator'},
            {
                label: 'Appearance',
                role: 'viewMenu'
            },
            {type: 'separator'},
            {role: 'reload'},

        ]
    },
    {
        label: 'Help',
        submenu : [
            {
                label: 'About',
                click: () => {
                    aboutDialog();
                }
            }
        ]
    }

]

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);


