const { app, globalShortcut, Notification, BrowserWindow, Menu, screen, dialog, accelerator, WebContents, webContents, MenuItem, ipcRenderer} = require('electron')
const path = require('path')
const fs = require('fs')
const { exec, execSync, spawn, execFileSync } = require("child_process");
const ipcMain = require('electron').ipcMain
const nativeTheme = require('electron').nativeTheme
const nativeImage = require('electron')
const shell = require('electron').shell
const move_windows = new Set()
const window = require('electron').BrowserWindow;
const windows = new Set()
const { clipboard } = require('electron')

// app.disableHardwareAcceleration()

let settings_file = path.join(__dirname, 'settings.json');

if (!fs.existsSync(settings_file)) {
    let data = {
        window: {
            length: 1400,
            width: 700,
            x: 0,
            y: 0
        },
        keyboard_shortcuts: {
            Back: "Backspace",
            ShowWorkspace: "Alt+W",
            ShowSidebar: "Ctrl+B",
            Find: "Ctrl+F",
            Down: "Down",
            Up: "Up",
            Left: "Left",
            Right: "Right",
            Rename: "F2",
            Cut: "Ctrl+X",
            Copy: "Ctrl+C",
            Paste: "Ctrl+P",
            SelectAll: "Ctrl+A",
            Delete: "Delete",
            Compress: "Shift+C",
            Extract: "Shift+E",
            Properties: "Ctrl+I",
            NewFolder: "Ctrl+Shift+N",
            AddWorkspace: "Ctrl+D",
            OpenNewTab: "Ctrl+Enter"
        }

    }
    fs.writeFileSync(settings_file, JSON.stringify(data, null, 4));
}

let settings = JSON.parse(fs.readFileSync('settings.json', {encoding:'utf8', flag:'r'}));
ipcMain.on('reload_settings', (e) => {
    settings = JSON.parse(fs.readFileSync('settings.json', {encoding:'utf8', flag:'r'}));
})

let canceled = 0;
ipcMain.on('cancel', (e) => {
    // console.log('setting cancel to 1');
    canceled = 1;
})

ipcMain.on('delete_file', (e, file) => {
    delete_file(file, () => {});
})

ipcMain.on('open_file', (e) => {

})

// GET DESTINATION DIRECTORY
let destination     = ''; // destination
let destination0    = ''; // destination
let isMainView      = 1;  // state
ipcMain.on('is_main_view', (e, state = 0) => {
    // console.log('running on is_main_view', state);
    isMainView = state;
})

let window_id  = 0;
let window_id0 = 0;
ipcMain.on('active_window', (e) => {

    window_id0 = window_id
    window_id = e.sender.id;

    if (window_id != window_id0) {

        // console.log('setting active window')
        active_window = window.fromId(window_id);

    }
})

let active_window   = '';
ipcMain.on('active_folder', (e, breadcrumb, state = 0) => {

    /* Get active window */
    let window_id = e.sender.id;
    active_window = window.fromId(window_id);

    if (breadcrumb != destination) {

        destination = breadcrumb;
        isMainView  = state;

        // console.log('active window', active_window)
        // console.log('setting target destination', destination, isMainView);

    }

})

ipcMain.on('item_count_recursive', (e, filename) => {

    get_folder_count_recursive(filename);
    get_file_count_recursive(filename);

    let data = {
        filename: filename,
        folder_count: folder_count_recursive,
        file_count: file_count_recursive
    }

    active_window.send('item_count', data);

})

let current_directory   = '';
ipcMain.on('current_directory', (e, directory) => {

    if (directory != current_directory) {
        current_directory = directory;
    }
    // console.log('setting current directory to ' + current_directory);

})

ipcMain.on('add_system_notification', (e, title, body) => {
    AddSysNotification(title, body);
})

function AddSysNotification (title, body) {
    new Notification({ title: title, body: body}).show()
}

// COPY FILES RECURSIVE
let recursive = 0
async function copyfile(source, target, state, callback) {

    // TARGET
    var targetFile = target
    try {
        if (fs.existsSync(target)) {
            if (fs.lstatSync(target).isDirectory()) {
                targetFile = path.join(target, path.basename(source));
            }
        }
    } catch (err) {
        console.log('copy file sync. stat sync err', err)
    }

    recursive++
    let file_exists = fs.existsSync(targetFile)

    // console.log(targetFile, current_directory);

    /* Add card if copying into the current direcoty unless one exists */
    // if (path.dirname(targetFile) == current_directory) {
    // if (path.dirname(targetFile) == current_directory) {
    //     let options = {
    //         id: 0,
    //         href: targetFile,
    //         linktext: path.basename(targetFile),
    //         is_folder: fs.statSync(source).isDirectory(),
    //         grid: ''
    //     }
    //     // windows.forEach(win => {
    //         try {
    //             let win = active_window; //window.getFocusedWindow();
    //             win.webContents.send('add_card', options);
    //         } catch {err} {
    //             // console.log();
    //         }
    //     // })
    // }

    /* Copy file */
    fs.copyFile(source, targetFile, (err) => {

        if (err) {
            console.log('copy file sync err', err)
        } else {

            callback(1);

            /* Update cards */
            if (--recursive == 0) {

                // if (current_directory == path.dirname(targetFile)) {

                    try {

                        active_window.webContents.send('update_cards');
                        // callback(1);
                        return 1;

                        // windows.forEach(win => {
                        // })
                        // callback(1);
                    } catch (err) {``
                        // console.log(err);
                        // callback(0)
                        return 0;
                    }

                // }

            }



        }

    })

}

// COPY FOLDER RECURSIVE
copy_folder_counter = 0
function copyfolder(source, destination, state, callback) {

    // console.log('reading source', source)

    // COPY
    // READ SOURCE DIRECTORY
    fs.readdir(source, function (err, files) {

        if (err) {
            console.log(err)
        } else {

            // CHECK LENGTH
            if (files.length > 0) {

                if (!fs.existsSync(destination)) {
                    destination0 = destination
                    fs.mkdirSync(destination)
                }

                // LOOP OVER FILES
                files.forEach((file, idx) => {

                    // GET FOLDER SIZE WORKS HERE KIND OF!!!. RUNS TOO MANY TIMES.
                    // todo: need to figure out how to handle this better

                    // GET CURRENT SOURCE / CURRENT DESTINATION
                    let cursource = path.join(source, file)
                    let curdestination = path.join(destination, file)

                    // GET STATS OF CURRENT SOURCE
                    fs.stat(cursource, (err, stats) => {

                        if (err) {
                            console.log(err)
                        } else {

                            // DIRECTORY
                            if (stats.isDirectory() == true) {

                                copyfolder(cursource, curdestination, state, () => {});

                            // COPY FILES
                            } else if (stats.isFile() == true) {

                                copyfile(cursource, curdestination, state, () => {

                                })

                            }

                        }

                    })


                })

            }

            callback(1)

        }

    })

}

let file_count_recursive = 0
async function get_file_count_recursive(filename) {
    let dirents = fs.readdirSync(filename)

    ++recursive;

    // fs.readdir(filename, (err, files) => {

    //     // dirents.filter(item => !fs.statSync(path.join(filename, item)).isDirectory())
    //     file_count_recursive += files.length;

    //     if (--recursive == 0) {
    //         active_window.sender('file_count_recursive', file_count_recursive)
    //     }
    //     // console.log(file_count_recursive);
    //     // console.log(files.length)

    // })
    try {
        let files = dirents.filter(item => !fs.statSync(path.join(filename, item)).isDirectory())
        // console.log('files', files)
        file_count_recursive += files.length
    } catch (err) {

    }
}

let folder_count_recursive = 0;
async function get_folder_count_recursive(filename) {

    let dirents = fs.readdirSync(filename)
    try {

        let folders = dirents.filter(item => fs.statSync(path.join(filename, item)).isDirectory())
        folders.forEach((folder, idx) => {

            let cursource = path.join(filename, folder)
            get_folder_count_recursive(cursource)
            ++folder_count_recursive;
            if (fs.statSync(cursource).isDirectory()) {
                get_file_count_recursive(cursource);
            }

        })

    } catch (err) {

    }

}


/* Get files properties */
function get_file_properties(filename) {

    // console.log(filename)

    let stats           = fs.statSync(filename)
    let cmd             = "xdg-mime query filetype '" + filename + "'"
    let exec_mime       = execSync(cmd).toString()

    folder_count_recursive  = 0;
    file_count_recursive    = 0;

    // BUILD PROPERTIES
    let name            = filename;
    let parent_folder   = path.basename(path.dirname(filename));
    let type            = exec_mime;
    let size            = '';
    let accessed        = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.atime);
    let modified        = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime);
    let created         = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.ctime);
    let mode            = stats.mode;
    let group           = stats.uid;
    let contents        = '';


    // // todo: need a better way to do this
    // if (type == true) {
    //     size = 0;
    // } else {
    //     size = get_file_size(stats.size)
    // }

    let file_properties = {

        Name:       name,
        Type:       type,
        Size:       size,
        Parent:     parent_folder,
        Accessed:   accessed,
        Modified:   modified,
        Created:    created,
        Mode:       mode,
        Group:      group,

    }

    if (stats.isDirectory()) {

        // get_folder_count_recursive(filename);
        // get_file_count_recursive(filename);

        contents = folder_count_recursive.toLocaleString() + ' Folder/s ' + file_count_recursive.toLocaleString() + ' File/s ';

        file_properties = {
            Name:       name,
            Type:       type,
            Contents:   contents,
            Size:       size,
            Parent:     parent_folder,
            Accessed:   accessed,
            Modified:   modified,
            Created:    created,
            Mode:       mode,
            Group:      group,

        }

    }

    // console.log('send file properties')
    active_window.send('file_properties', file_properties);
}

/* Get disk space */
async function get_disk_space(href, callback) {

    df = []
    // RUN DISK FREE COMMAND
    let cmd = 'df "' + href.href + '"'

    let data = execSync(cmd).toString()
    let data_arr = data.split('\n')

    // CREATE OPTIONS OBJECT
    let options = {
        disksize: 0,
        usedspace: 0,
        availablespace:0,
        foldersize:0,
        foldercount:0,
        filecount:0
    }

    if (data_arr.length > 0) {

        let res1 = data_arr[1].split(' ')

        let c = 0;
        res1.forEach((size, i) => {

            if (size != '') {

                // 0 DISK
                // 6 SIZE OF DISK
                // 7 USED SPACE
                // 8 AVAILABLE SPACE
                // 10 PERCENTAGE USED
                // 11 CURRENT DIR

                switch (c) {
                    case 1:
                        // console.log('found 6 ' + res1[i])
                        options.disksize = get_file_size(parseFloat(size) * 1024)
                        break;
                    case 2:
                        options.usedspace = get_file_size(parseFloat(size) * 1024)
                        break;
                    case 3:
                        options.availablespace = get_file_size(parseFloat(size) * 1024)
                        break;
                }

                ++c;

            }
        })

        options.foldercount = href.folder_count
        options.filecount = href.file_count

        df.push(options)

        // SEND DISK SPACE
        active_window.send('disk_space', df)

        cmd = 'cd "' + href.href + '"; du -s'
        du = exec(cmd)

        du.stdout.on('data', function (res) {

            let size = parseInt(res.replace('.', '') * 1024)
            size = get_file_size(size)
            active_window.send('du_folder_size', size)

        })

    }

    // callback(options)

}

function get_diskspace_summary() {

    // console.log('getting diskspace summary')

    get_disk_space({href: '/'}, (res) => {
        // console.log('root disk space', res);
    });


}

// DELETE FILE / FOLDER
function delete_file(file, callback) {

    // console.log('deleting file ' + file)
    let stats = fs.statSync(file)

    if (stats) {

        /* Folder */
        if (stats.isDirectory()) {

            fs.rm(file, {recursive: true}, (err) => {
                if (err) {
                    console.log(err);
                } else {

                    try{

                        // console.log('folder deleted');
                        windows.forEach(win => {
                            win.send('remove_card', file);
                        })

                    } catch (err) {
                        console.log(err);
                    }

                    // Update disk size
                    get_disk_space({href: current_directory}, (res) => {
                        active_window.send('disk_space', res)
                    });

                    callback(1);
                }
            })

        /* File */
        } else {

            fs.unlink(file, err => {

                if (err) {
                    console.log('error deleteing file', file);
                    callback(0);
                } else {

                    // console.log('file deleted');

                    try {
                        active_window.send('remove_card', file);
                    } catch (err) {

                    }

                    // Update disk size
                    get_disk_space({href: current_directory}, (res) => {
                        active_window.send('disk_space', res)
                    });

                    callback(1);
                }

            })

        }

    }

}

function clear_copy_arr() {
    // console.log('clearing copy array')
    copy_files_arr = []
}

// RETURN FORMATED FILE/FOLDER SIZE
function get_file_size(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.0).toFixed(1) + byteUnits[i];

}

/**
 * Copy string to the clipboard
 * @param {string} data
 */
function CopyToClipboard(data) {
    clipboard.writeText(data);
    // console.log(clipboard.readText());
}

/**
 * Read clipboard
 * Return Clopboard
 */
function ReadClipboard () {
    return clipboard.readText();
}

/**
 * Clear Clipboard
 */
function ClearClipboard() {
    clipboard.clear();
}

// CREATE MAIN WINDOW
// let win;
// function createWindow() {

//     let displayToUse = 0
//     let lastActive = 0
//     let displays = screen.getAllDisplays()

//     // Single Display
//     if (displays.length === 1) {
//         displayToUse = displays[0]
//     }

//     // Multi Display
//     else {
//         // if we have a last active window, use that display for the new window
//         if (!displayToUse && lastActive) {
//             displayToUse = screen.getDisplayMatching(lastActive.getBounds());
//         }

//         // fallback to primary display or first display
//         if (!displayToUse) {
//             displayToUse = screen.getPrimaryDisplay() || displays[3];
//         }
//     }

//     // WINDOW OPTIONS
//     let options = {
//         minWidth: 1024,
//         minHeight: 600,
//         width: 1600,
//         height: 768,
//         backgroundColor: '#2e2c29',
//         x:displayToUse.bounds.x + 50,
//         y:displayToUse.bounds.y + 50,
//         frame: true,
//         webPreferences: {
//             nodeIntegration: false, // is default value after Electron v5
//             contextIsolation: true, // protect against prototype pollution
//             enableRemoteModule: false, // turn off remote
//             nodeIntegrationInWorker: false,
//             nativeWindowOpen: false,
//             preload: path.join(__dirname, 'preload.js'),
//             sandbox: false
//         },
//     }

//     win = new BrowserWindow(options);

//     // win.removeMenu()
//     // win.webContents.openDevTools();

//     // LOAD INDEX FILE
//     win.loadFile('src/index.html')

//     win.once('ready-to-show', () => {
//         win.show();
//     });
// }

const createWindow = exports.createWindow = () => {

    let displayToUse = 0
    let lastActive = 0
    let displays = screen.getAllDisplays()

    // Single Display
    if (displays.length === 1) {
        displayToUse = displays[0]
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

    if (settings.window.x == 0) {
        settings.window.x = displayToUse.bounds.x + 50
    }

    if (settings.window.y == 0) {
        settings.window.y = displayToUse.bounds.y + 50
    }

    // WINDOW OPTIONS
    let options = {
        minWidth: 1024,
        minHeight: 600,
        width: settings.window.width,
        height: settings.window.height,
        backgroundColor: '#2e2c29',
        x: settings.window.x,
        y: settings.window.y,
        frame: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            nativeWindowOpen: false,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            // offscreen: true
        },
    }

    let win = new BrowserWindow(options);
    // win.removeMenu()

    win.loadFile('src/index.html');

    win.once('ready-to-show', () => {
        win.show();
    });

    win.on('closed', () => {
        windows.delete(win);
        // win = null;
    });

    win.on('resize', (e) => {

        let intervalid = setInterval(() => {

            settings.window.width   = win.getBounds().width;
            settings.window.height  = win.getBounds().height;
            // settings.window.x       = win.getBounds().x;
            // settings.window.y       = win.getBounds().y;

            fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings, null, 4));
        }, 1000);

    })

    win.on('move', (e) => {

        settings.window.x       = win.getBounds().x;
        settings.window.y       = win.getBounds().y;

        fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings, null, 4));

    })

    // win.webContents.on('paint', (event, dirty, image) => {
    //     fs.writeFileSync('ex.png', image.toPNG())
    //   })
    // win.webContents.setFrameRate(60)

    // console.log('win', win);
    windows.add(win);

    const sess = win.webContents.session
    // sess.fromPartition(current_directory)
    // console.log('user agent' ,sess.getUserAgent())


};

app.whenReady().then(() => {

    // globalShortcut.register('Escape', (e) => {
    //     console.log('Escape is pressed');
    //     let active_window = BrowserWindow.getFocusedWindow()
    //     active_window.hide()

    // });

    createWindow();

    // ACTIVATE EVENTS GO HERE?
    // app.on('activate', function () {
    //     // On macOS it's common to re-create a window in the app when the
    //     // dock icon is clicked and there are no other windows open.
    //     if (BrowserWindow.getAllWindows().length === 0) createWindow()
    // })

})

// ipcMain.handle('dark-mode:toggle', () => {
//     if (nativeTheme.shouldUseDarkColors) {
//         nativeTheme.themeSource = 'light'
//     } else {
//         nativeTheme.themeSource = 'dark'
//     }
//     return nativeTheme.shouldUseDarkColors
// })

nativeTheme.themeSource = 'dark'

ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system'
})

ipcMain.on('copy_to_clipboard', (a, data) => {
    // console.log('copying to clipboard', data)
    CopyToClipboard(data);
});

ipcMain.on('read_clipboard', (a) => {
    ReadClipboard(data);
    // win.webContents
})

ipcMain.on('clear_clipboard', (a, data) => {

})

// RELOAD WINDOW
ipcMain.on('reload',function(e){
    win.loadFile('src/index.html')
})

// MAXAMIZE WINDOW
ipcMain.on('maximize', () => {
    active_window.maximize()
})

// MINIMIZE WINDOW
ipcMain.on('minimize', () => {
    active_window.minimize()
})

// CLOSE WINDOW
ipcMain.on('close', () => {
    // var win = BrowserWindow.getFocusedWindow();
    // console.log('removing window from set');
    windows.delete(active_window)
    active_window.close();
})

// GO BACK
ipcMain.on('go_back', function(e, msg) {
    // console.log('running go back from main ')
    windows.forEach(win => {
        win.webContents.goBack()
    })
})

ipcMain.on('go_foward', (e) => {
    win.webContents.goFoward()
})

// GET ICON PATH
ipcMain.on('get_icon_path', (e, href) => {
    get_icon_path(href)
})

// GET ICON PATH
function get_icon_path(href) {

    app.getFileIcon(href).then(icon => {

        let win = window.getFocusedWindow();

        icon_path = icon.toDataURL()
        let data = {
            href: href,
            icon_path: icon_path
        }

        win.send('icon_path',data);

    }).catch((err) => {

    })
}

// HANDLE DRAG START
ipcMain.on('ondragstart', (e, href) => {

    // console.log('added', href, 'to start drag')

    let icon_path = path.join(__dirname, '/assets/icons/file.png')
    if (fs.statSync(href).isDirectory()) {
        icon_path = path.join(__dirname,'/assets/icons/folder.png')
    }

    e.sender.startDrag({
        file: href,
        icon: icon_path //path.join(__dirname,'/assets/icons/folder.png')
    })
})


// ADD FILES TO COPY ARRAY
let copy_files_arr = [];
ipcMain.on('add_copy_files', function( e, data) {

    // console.log('on add copy files', data);
    copy_files_arr = data;

    e.sender.send('clear_copy_arr');

})


// COPY
// ipcMain.on('copy', (e, copy_files_arr, state) => {

//     console.log('on copy', copy_files_arr);
//     copy(copy_files_arr, state);

// })

ipcMain.on('copy', (e, copy_files_arr_old, state = 0) => {

    // console.log('on copy', copy_files_arr);
    copy(copy_files_arr, state);

})

// COPY
function copy(state) {

    // console.log('copy arr length', copy_files_arr.length)

    copy_files_arr.every((item, idx) => {

        let source = item.source;
        // let destination = dir; //item.destination

        let source_stats = fs.statSync(source)
        // let destination_stats = fs.statSync(destination)

        let destination_file = path.join(destination, path.basename(source))

        let max = 0

        // DIRECTORY - Done
        if (source_stats.isDirectory()) {

            let options = {
                id: 0,
                href: destination_file,
                linktext: path.basename(destination_file),
                is_folder: 1,
                grid: ''
            }

            if (source == destination_file) {

                // GET SIZE FOR PROGRESS
                let max = 0;
                copy_files_arr.forEach(item => {
                    max += parseInt(item.size);
                })

                // SHOW PROGRESS
                windows.forEach(win => {
                    win.webContents.send('progress', max);
                })

                // BUILD DESTINATION PATH
                let c = 0
                destination_file = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(path.basename(source)).length)) + ' Copy'
                while (fs.existsSync(destination_file) && c < 2) {
                    destination_file = destination_file + ' Copy'
                    ++c;
                }

                state = 0
                copyfolder(source, destination_file, state, () => {

                    // console.log('running',path.basename(source))
                    if (isMainView) {

                        let options = {
                            href: destination_file,
                            linktext: path.basename(destination_file),
                            is_folder: true
                        }

                        active_window.send('add_card', options)
                        // active_window.send('update_cards')

                    }
                    copy_files_arr.shift()
                    copy(copy_files_arr,state)

                })

                // CREATE FOLDER
                options.href = destination_file
                options.linktext = path.basename(destination_file)

                // console.log('copy files array ', copy_files_arr.length())
                // active_window.send('add_card', options)

                return true

            } else {

                if (fs.existsSync(destination_file)) {

                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination_file
                    }

                    createConfirmDialog(data, copy_files_arr)

                    return false;

                } else {

                    // GET SIZE FOR PROGRESS
                    let max = 0;
                    copy_files_arr.forEach(item => {
                        max += parseInt(item.size);
                    })

                    // SHOW PROGRESS
                    // windows.forEach(win => {
                    let win = window.getFocusedWindow();
                    win.webContents.send('progress', max, destination_file);

                    // if (!canceled) {

                        // COPY FOLDERS RECURSIVE
                        copyfolder(source, destination_file, state, () => {


                            // console.log('running',path.basename(source))
                            if (isMainView) {

                                let options = {
                                    href: destination_file,
                                    linktext: path.basename(destination_file),
                                    is_folder: true
                                }

                                active_window.send('add_card', options)
                                active_window.send('update_cards')

                            }
                            copy_files_arr.shift()
                            copy(copy_files_arr,state)



                        })
                        return false;
                    // }
                }
            }

        // FILES
        } else {

            // console.log(source, destination)

            // APPEND COPY TO FILENAME IF SAME
            if (path.dirname(source) == destination) {

                // CREATE NEW FILE NAME
                let c = 0;
                destination_file = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(source).length) + ' Copy' + path.extname(source));
                while (fs.existsSync(destination_file) && c < 2) {
                    destination_file = destination_file + ' Copy'
                    ++c;
                }

                // COPY FILE
                state = 1;
                // let max = parseInt(item.size)
                copyfile(source, destination_file, state, () => {

                    let options = {
                        id: 0,
                        href: destination_file,
                        linktext: path.basename(destination_file),
                        is_folder: false,
                        grid: ''
                    }

                    active_window.send('add_card', options)

                })

                copy_files_arr.shift();
                copy(copy_files_arr, state);
                return true;


            } else {

                // IF DESTINATION EXISTS
                if (fs.existsSync(destination_file)) {

                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination_file
                    }

                    createConfirmDialog(data, copy_files_arr);
                    return false;

                } else {

                    // GET SIZE FOR PROGRESS
                    let max = 0;
                    copy_files_arr.forEach(item => {
                        max += parseInt(item.size);
                    })

                    // SHOW PROGRESS
                    windows.forEach(win => {
                        // let win = window.getFocusedWindow();
                        win.webContents.send('progress', max, destination_file);
                    })

                    // console.log('copy array', copy_files_arr)
                    copyfile(source, destination_file, state, () => {});

                    if (isMainView) {

                        let options = {
                            id: 0,
                            href: destination_file,
                            linktext: path.basename(destination_file),
                            is_folder: false,
                            grid: ''
                        }

                        active_window.webContents.send('add_card', options)

                    }



                    copy_files_arr.shift();
                    copy(state);

                    // console.log('copy array', copy_files_arr)

                    return true;

                }

            }

        }

    })

    return true
}


// SHOW COPY CONFIRM OVERWRITE DIALOG
ipcMain.on('show_confirm_dialog', (e, data) => {

    // console.log('running')

    e.preventDefault()
    createConfirmDialog(data)
    // console.log(data1)

})

// CONFIRM COPY OVERWRITE DIALOG
// let confirm = null
function createConfirmDialog(data, copy_files_arr) {

    let win = window.getFocusedWindow();

    let bounds = screen.getPrimaryDisplay().bounds;
    let x = bounds.x + ((bounds.width - 400) / 2);
    let y = bounds.y + ((bounds.height - 400) / 2);

    const confirm = new BrowserWindow({
        parent: win,
        modal:true,
        width: 550,
        height: 400,
        backgroundColor: '#2e2c29',
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    // LOAD INDEX FILE
    confirm.loadFile('src/confirm.html')

    //
    confirm.once('ready-to-show', () => {

        if (fs.statSync(data.source).isDirectory()) {
            confirm.title = 'Copy Folder Conflict'
        } else {
            confirm.title = 'Copy File Conflict'
        }

        confirm.removeMenu()
        confirm.show()

        // confirm.webContents.openDevTools()
        confirm.send('confirming_overwrite', data, copy_files_arr)

    })

}

// OVERWRITE COPY CONFIRMED ALL
ipcMain.on('overwrite_confirmed_all', (e) => {

    // console.log('running overwrite confirmed all')

    // todo: remove references to data.destination. use destination instead
    // data.destination = destination;

    // HIDE WINDOW
    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide();

    // GET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach(item => {
        max += parseInt(item.size);
    })

    // SHOW PROGRESS
    active_window.send('progress', max);

    // LOOP OVER COPY ARRAY
    copy_files_arr.forEach((data, idx) => {

        // console.log(data.source);

        let destination_file = path.join(destination, path.basename(data.source));

        // COPY DIRECTORY
        if (fs.statSync(data.source).isDirectory()) {

            copyfolder(data.source, destination_file, data.state, () => {

            })

        // COPY FILES - done
        } else {
            copyfile(data.source, destination_file, data.state, () => {

            })
        }
    })

    copy_files_arr = []

})

// OVERWRITE COPY CONFIRMED
ipcMain.on('overwrite_confirmed', (e, data, copy_files_arr1) => {

    // todo: remove references to data.destination. use destination instead
    // console.log('running overwrite confirmed', data.source, data.destination)

    let destination_file = path.join(destination, path.basename(data.source))

    // HIDE
    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide();

    // GET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach(item => {
        max += parseInt(item.size)
    })

    // SHOW PROGRESS
    windows.forEach(win => {
        win.webContents.send('progress', max);
    })

    // COPY FOLDER
    if (fs.statSync(data.source).isDirectory()) {
        copyfolder(data.source, destination_file, data.state, () => {

            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift()

            if (copy_files_arr.length > 0) {
                copy(copy_files_arr, data.state);
            }

        })

    // COPY FILE - done
    } else {

        copyfile(data.source, destination_file, 0, () => {

            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift()

            if (copy_files_arr.length > 0) {

                copy(copy_files_arr, data.state);

            }

        })
    }

})

// OVERWRITE COPY SKIP - needs work
ipcMain.on('overwrite_skip', (e, copy_files_arr) => {

    // console.log('running overwrite skipped',copy_files_arr.length);

    // confirm.hide()
    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide()

    // REMOVE ITEM FROM ARRAY
    copy_files_arr.shift()

    if (copy_files_arr.length > 0) {

        data = {
            state: 0,
            source: copy_files_arr[0].source,
            destination: copy_files_arr[0].destination
        }

        // RUN MAIN COPY FUNCTION
        copy(copy_files_arr, data.state);

    }

})

// OVERWRITE COPY CANCLED ALL - done
ipcMain.on('overwrite_canceled_all', (e, copy_files_arr) => {

    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide()

    copy_files_arr = []

})

// OVERWRITE COPY CANCLED - done
ipcMain.on('overwrite_canceled', (e) => {

    // console.log('running overwrite canceled', copy_files_arr);

    // HIDE
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide()

    // REMOVE ITEM FROM ARRAY
    copy_files_arr.shift()

    if (copy_files_arr.length > 0) {

        // data = {
        //     state: 0,
        //     source: copy_files_arr[0].source,
        //     destination: copy_files_arr[0].destination
        // }

        // RUN MAIN COPY FUNCTION
        copy(0);

    }

})

// MOVE DIALOG
function createMoveDialog(data, copy_files_arr) {

    console.log('data', data);

    let bounds = screen.getPrimaryDisplay().bounds;
    let x = bounds.x + ((bounds.width - 400) / 2);
    let y = bounds.y + ((bounds.height - 400) / 2);

    // DIALOG SETTINGS
    let confirm = new BrowserWindow({

        parent: window.getFocusedWindow(),
        modal:true,
        width: 550,
        height: 275,
        backgroundColor: '#2e2c29',
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    // LOAD FILE
    confirm.loadFile('src/confirm_move.html')
    // confirm.webContents.openDevTools()

    // SHOW DIALG
    confirm.once('ready-to-show', () => {

        let title = ''
        if (fs.statSync(data.source).isDirectory()) {
            title = 'Move Folder'
        } else {
            title = 'Move File'
        }

        confirm.title = title
        confirm.removeMenu()

        // console.log('create move data', data, copy_files_arr)
        confirm.send('confirming_move', data, copy_files_arr)

    })

    // // MOVE CANCELED - done
    // ipcMain.on('move_canceled', (e) => {
    //     confirm.hide()
    //     if (copy_files_arr.length > 0) {
    //         data = {
    //             state:          0,
    //             source:         copy_files_arr[0].source,
    //             destination:    copy_files_arr[0].destination
    //         }
    //         if (fs.existsSync(path.join(data.destination, path.basename(data.source)))) {
    //             createOverwriteMoveDialog(data,copy_files_arr);
    //         } else {
    //             createMoveDialog(data, copy_files_arr);
    //         }

    //         // REMOVE ITEM FROM ARRAY
    //         copy_files_arr.shift()
    //     }

    // })

}

// MOVE
ipcMain.on('move', (e) => {

    // console.log('running on move');
    move();

})

/* Move files */
function move() {

    // console.log('running move', copy_files_arr);

    // Set destination1 since destination (active_folder) will change on mouseover events
    // let destination1 = destination;

    copy_files_arr.every((item, idx) => {

        let source = item.source
        // let destination = item.destination

        let source_stats = fs.statSync(source)
        let destination_file = path.join(destination, path.basename(source))

        // DIRECTORY
        if (source_stats.isDirectory()) {

            let options = {
                id: 0,
                href: destination_file,
                linktext: path.basename(destination_file),
                grid: ''
            }

            if (source == destination_file) {

                active_window.webContents.send('notification', 'select a different directory')

            } else {

                if (fs.existsSync(destination_file)) {

                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        state: 0,
                        source: source,
                        destination: destination_file
                    }

                    createConfirmDialog(data, copy_files_arr)
                    return false;

                } else {

                    let data = {
                        state: 0,
                        source: source,
                        destination: destination_file
                    }

                    // REMOVE ITEM FROM ARRAY
                    // copy_files_arr.splice(idx,1)

                    // CREATE MOVE DIALOG
                    createMoveDialog(data, copy_files_arr)

                    // EXIT LOOP
                    return false

                }

            }

        // FILES
        } else {

            // APPEND COPY TO FILENAME IF SAME
            if (path.dirname(source) == destination_file) {

                // CREATE NEW FILE NAME
                destination_file = path.join(destination1, path.basename(source).substring(0, path.basename(source).length - path.extname(source).length) + ' Copy' + path.extname(source))

                // COPY FILE
                copyfile(source, destination_file, 0, () => {})

            } else {

                // CHECK IF FILE EXISTS
                // CREATE OVERWRITE MOVE DIALOG
                if (fs.existsSync(destination_file)) {

                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination_file
                    }

                    createOverwriteMoveDialog(data, copy_files_arr)

                // CREATE MOVE DIALOG
                } else {

                    let data = {
                        state: 0,
                        source: source,
                        destination: destination_file
                    }

                    // console.log('create move data', data, copy_files_arr);
                    createMoveDialog(data,copy_files_arr);
                    return false;

                }

            }

        }

    })

    return true

}

// MOVE CONFIRMED - done
ipcMain.on('move_confirmed', (e, data) => {

    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide()

    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach(item => {
        max += parseInt(item.size)
    })

    // SHOW PROGRESS
    // let win = window.getFocusedWindow();
    windows.forEach(win => {
        win.webContents.send('progress', max);
    })

    // DIRECTORY
    if (fs.statSync(data.source).isDirectory()) {
        // state = 0
        copyfolder(data.source, data.destination, data.state, () => {

            // console.log('done copying folder')

            try {

                if (fs.existsSync(data.destination)) {

                    delete_file(data.source, () => {

                        // REMOVE ITEM FROM ARRAY
                        copy_files_arr.shift()

                        // console.log('folder deleted array length ', copy_files_arr.length)

                        if (copy_files_arr.length > 0) {
                            move();
                        }

                    })
                }
            } catch (err) {
                console.log('copy folder recursive error', err)
            }

        })


    // FILES - done
    } else {

        // state = 0
        copyfile(data.source, data.destination, data.state, (res) => {

            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift();
            delete_file(data.source, (res) => {

                if (isMainView) {

                    let options = {
                        id: 0,
                        href: data.destination,
                        linktext: path.basename(data.destination),
                        is_folder: false,
                        grid: ''
                    }

                    active_window.webContents.send('add_card', options);

                }

                move();

            })


        })

    }

})

// MOVE CONFIRMED ALL - done
ipcMain.on('move_confirmed_all', (e, data, copy_files_arr) => {

    // console.log('running move confirmmed all', copy_files_arr);

    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide()

    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach(item => {
        max += parseInt(item.size)
    })

    // SHOW PROGRESS
    windows.forEach(win => {
        win.webContents.send('progress', max);
    })

    // SET STATE TO 1 IF PASTE
    // todo: state has been replaced with ismainview
    let state = 0; //data.state;

    // COPY FILES
    copy_files_arr.forEach((data, idx) => {

        let destination_file = path.join(destination, path.basename(data.source));

        // DIRECTORY
        if (fs.statSync(data.source).isDirectory()) {

            copyfolder(data.source, destination_file, state, () => {

                if (fs.existsSync(destination_file)) {

                    delete_file(data.source, () => {

                        if (isMainView) {
                            active_window.send('remove_card', data.source);

                            let options = {
                                id: 0,
                                href: destination_file,
                                linktext: path.basename(destination_file),
                                is_folder: true,
                                grid: ''

                            }

                            active_window.send('add_card', options);

                        }


                    })

                }

                move_windows.forEach(win => {
                    win.hide();
                })
                move_windows.clear();

            })


        // FILES
        } else {

            // state = 0
            copyfile(data.source, destination_file, state, (res) => {

                // console.log('runninig copy file')
                // console.log('callback', res)

                if (fs.existsSync(destination_file)) {

                    if (isMainView) {

                        let options = {
                            id: 0,
                            href: destination_file,
                            linktext: path.basename(destination_file),
                            is_folder: false,
                            grid: ''
                        }

                        active_window.webContents.send('add_card', options);

                    }

                    delete_file(data.source, () => {});

                }


                // if (fs.existsSync(data.destination)) {
                //     console.log('file exists',data.source)

                //     delete_file(data.source, () => {
                //         win.send('remove_card', data.source)
                //         // let active_window = BrowserWindow.getFocusedWindow()
                //         // active_window.close()

                //     })
                // }

                move_windows.forEach(win => {
                    win.hide();
                })
                move_windows.clear();

            })

        }
    })

})

// MOVE CANCELED - done
ipcMain.on('move_canceled', (e) => {

    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide()

    if (copy_files_arr.length > 0) {

        // data = {
        //     state:       0,
        //     source:      copy_files_arr[0].source,
        //     destination: copy_files_arr[0].destination
        // }

        // if (fs.existsSync(path.join(data.destination, path.basename(data.source)))) {
        //     createOverwriteMoveDialog(data,copy_files_arr);
        // } else {
        //     createMoveDialog(data, copy_files_arr);
        // }

        // REMOVE ITEM FROM ARRAY
        copy_files_arr.shift();

        move();

    }

})

ipcMain.on('move_canceled_all', (e) => {

    let win = window.getFocusedWindow();
    win.hide();
    copy_files_arr = [];

})

// GET CONFIRM DIALOG
ipcMain.on('show_overwrite_move_dialog', (e, data) => {

    // console.log('running')

    e.preventDefault()
    createOverwriteMoveDialog(data)

})

// CONFIRM OVERWRITE FOR MOVE DIALOG
// let confirm = ''
function createOverwriteMoveDialog(data, copy_files_arr) {

    let bounds = screen.getPrimaryDisplay().bounds;
    let x = bounds.x + ((bounds.width - 400) / 2);
    let y = bounds.y + ((bounds.height - 400) / 2);

    let confirm = new BrowserWindow({
        parent: window.getFocusedWindow(),
        modal:true,
        width: 550,
        height: 350,
        backgroundColor: '#2e2c29',
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    // LOAD FILE
    confirm.loadFile('src/overwritemove.html')

    // SHOE OVERWRITE MOVE DIALOG
    confirm.once('ready-to-show', () => {

        confirm.title = 'Move File Conflict'
        confirm.removeMenu()
        confirm.show()

        // confirm.webContents.openDevTools()
        confirm.send('confirming_overwrite_move', data)

    })

    // windows.add(confirm)
    // console.log(windows)



 // OVERWRITE MOVE CONFIRMED
 ipcMain.on('overwrite_move_confirmed', (e, data) => {

    // console.log('running overwrite move confirmed')

    let confirm = window.getFocusedWindow();
    confirm.hide();

    data.destination = destination

    // DIRECTORY
    if (fs.statSync(data.source).isDirectory()) {

        copyfolder(data.source, data.destination, () => {
            delete_file(data.source);
        })

    // FILES - done
    } else {

        copyfile(data.source, data.destination, data.state, () => {

            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift()

            // DELETE SOURCE FILE
            delete_file(data.source, () => {

                // CHECK ARRAY LENGTH
                if (copy_files_arr.length > 0) {
                    move();
                }

            })



        })

    }

    // // REMOVE ITEM FROM ARRAY
    // copy_files_arr.shift()

    // // CHECK ARRAY LENGTH
    // if (copy_files_arr.length > 0) {

    //     data = {
    //         state: 0,
    //         source: copy_files_arr[0].source,
    //         destination: copy_files_arr[0].destination
    //     }

    //     console.log('copy files array length', copy_files_arr.length, 'data', data)

    //     // CREATE MOVE DIALOG
    //     // todo: this needs to determin if we need createmove or createmoveoverwrite
    //     // or can they be combined?
    //     if (fs.existsSync(data.destination)) {
    //         createOverwriteMoveDialog(data, copy_files_arr)
    //     } else {
    //         createMoveDialog(data, copy_files_arr);
    //     }

    // }

})}

// OVERWRITE MOVE CONFIRMED ALL
ipcMain.on('overwrite_move_confirmed_all', (e) => {

    // console.log('overwrite move confirmed all')

    let confirm = window.getFocusedWindow();
    confirm.hide();

    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach(item => {
        max += parseInt(item.size)
    })

    // SHOW PROGRESS
    // windows.forEach(item => {
        active_window.send('progress', max);
    // })

    // let state = data.state

    // SET STATE TO 1 IF PASTE
    // let state = data.state
    // if (state == 2) {
    //     state = 1;
    // }

    // COPY FILES
    copy_files_arr.forEach((data, idx) => {

        let destination_file = path.join(destination, path.basename(data.source));

        // console.log(data.source);

        // DIRECTORY - todo: needs work
        if (fs.statSync(data.source).isDirectory()) {

            copyfolder(data.source, destination_file, 0, () => {

                delete_file(data.source, () => {
                    active_window.send('remove-card', data.source)
                    // windows.forEach(win => {
                    //     win.send('remove_card', data.source);
                    // })
                })

            })


        // FILES - done
        } else {

            // state = 0
            copyfile(data.source, destination_file, 0, () => {

                copy_files_arr.forEach(data => {
                    delete_file(data.source, () => {

                        active_window.send('remove-card', data.source)
                        // windows.forEach(win => {
                        //     win.send('remove_card', data.source);
                        // })
                    })
                })

            })

        }
    })

})



// OVERWRITE MOVE SKIP - done
ipcMain.on('overwrite_move_skip', (e) => {

    // console.log('overwrite move skip')
    let confirm = window.getFocusedWindow();
    confirm.hide()

    // REMOVE ITEM FROM ARRAY
    copy_files_arr.shift()

    if (copy_files_arr.length > 0) {
        move();
    }

})

// OVERWRITE MOVE CANCELED ALL - done
ipcMain.on('overwrite_move_canceled_all', (e) => {

    // console.log('overwrite_move_canceled_all');

    let confirm = window.getFocusedWindow();
    confirm.hide();
    copy_files_arr = [];

})

// OVERWRITE CANCELED - done
ipcMain.on('overwrite_move_canceled', (e) => {

    // console.log('overwrite_move_canceled');

    let confirm = window.getFocusedWindow();
    confirm.hide();
    copy_files_arr = [];

})

// FILE PROPERTIES WINDOW
function create_properties_window(filename) {

    let bounds = screen.getPrimaryDisplay().bounds;
    let x = bounds.x + ((bounds.width - 400) / 2);
    let y = bounds.y + ((bounds.height - 400) / 2);

    const win = new BrowserWindow({
        width: 500,
        height: 500,
        backgroundColor: '#2e2c29',
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    // LOAD INDEX FILE
    win.loadFile('src/properties.html')

    win.once('ready-to-show', () => {

            win.title = path.basename(filename)
            // win.removeMenu()
            win.show()

            let stats = fs.statSync(filename)

            cmd = "xdg-mime query filetype '" + filename + "'"
            let exec_mime = execSync(cmd).toString()

            // BUILD PROPERTIES
            let name = path.basename(filename)
            let parent_folder = path.basename(path.dirname(filename))
            let type = exec_mime
            let contents = '0 items, totalling 0 MB'
            let size = ''
            let accessed = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.atime)
            let modified = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)
            let created = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.ctime)

            if (type == true) {

                // type = 'Folder'
                size = ''

            } else {

                // type = 'File'
                size = get_file_size(stats.size)

            }

            let file_properties = {
                Name: name,
                Parent: parent_folder,
                Type: type,
                Contents: contents,
                Size: size,
                Accessed: accessed,
                Modified: modified,
                Created: created
            }

            // console.log('send file properties')
            win.send('file_properties', file_properties)
            // win.webContents.openDevTools()
            console.log(file_properties)




    })

    // CLOSE WINDOW
    ipcMain.on('close_properties_window', () => {
        var window = BrowserWindow.getFocusedWindow();
        windows.delete(win)
        window.close()
    })

    windows.add(win)
}

ipcMain.on('get_image_properties', (e) => {

})

// GET FILE PROPERTIES
ipcMain.on('get_file_properties', (e, file_properties_arr) => {

    file_properties_arr.forEach(filename => {
        get_file_properties(filename)
        // create_properties_window(filename);
    })

})

// GET DEVICES USING GIO COMMAND LINE UTILITY
ipcMain.on('get_gio_devices', (e) => {

    let output = ''

    // GET GIO LIST
    let cmd = "gio mount --list -i"
    let gio_device = exec(cmd)

    // console.log('running get gio cmd ' + cmd)

    // GET DATA FROM COMMAND
    // let output = ''
    gio_device.stdout.setEncoding('utf8')
    gio_device.stdout.on('data', (data) => {

        // console.log('running get_gio_devces ')
        // e.sender.send('gio_devices', data)
        output = output + data

    })

    gio_device.stderr.on('data', function (res) {

        console.log('running get_gio_device error ')
        e.sender.send('gio_devices', res)

    })

    gio_device.on('exit', (data) => {
        // console.log('running get_gio_devces exit')
        e.sender.send('gio_devices', output)
        // console.log('running get_gio_devces ' + output)
    })


})

// MOUNT GIO DEVICE
ipcMain.on('mount_gio', (e, data) => {

    let uuid = data.uuid

    let cmd = "gio mount " + uuid
    // console.log('gio mount cmd ' + cmd)

    let mount_gio = exec(cmd)

    mount_gio.stdout.on('data', (res) => {
        // console.log('device mounted ' + res)
        e.sender.send('gio_mounted', res)
    })

    mount_gio.stderr.on('data', (res) => {
        // console.log('device already connected ' + res)
        e.sender.send('gio_mounted', res)
    })

    mount_gio.on('exit', (code) => {
        // console.log('exit code ' + code)
    })

})

// MONITOR GIO DEVICES
ipcMain.on('monitor_gio', (e, data) => {

    let cmd = 'gio mount -o'
    let monitor_gio = exec(cmd)

    // console.log('starting gio monitor ' + cmd)

    //
    monitor_gio.stdout.on('data', (res) => {
        // console.log('gio monitor' + res)
        e.sender.send('gio_monitor', res)
    })

    monitor_gio.stderr.on('data', (res) => {
        // console.log('gio monitor error ' + res)
        e.sender.send('gio_monitor', res)
    })




})

// LIST FILES USING GIO
ipcMain.on('get_gio_files', (e, data) => {

    // console.log(data)

    let files = exec('gio list ' + data)

    // STDOUT
    files.stdout.on('data', (res) => {
        // console.log(res)
        e.sender.send('gio_files', {res, data})
    })

    // S
    files.stderr.on('data', (data) => {
        // console.log(data)
        e.sender.send('gio_files', data)
    })


})

// GET GZIP SIZE
ipcMain.on('get_uncompressed_size', (e, filename) => {

    // RUN GZIP -L TO GET FILE SIZE. ONLY WORKS ON GZIPED FILES
    let cmd = "gzip -l '" + filename + "' | awk 'FNR==2{print $2}'"
    let size = 0

    try {
        size = execSync(cmd)
    } catch (err) {

    }

    // console.log('uncompressed size ' + size)
    e.sender.send('uncompressed_size', size)

})

// GET FILES
ipcMain.on('get_files', (e, dir) => {

    // console.log('directory ' + dir)
    fs.readdir(dir, (err, dirents) => {
        e.sender.send('files', dirents)
    })
})

// GNOME-DISKS
ipcMain.on('gnome_disks', (e, args) => {
    let cmd = 'gnome-disks'
    exec(cmd)
})

// DISK USAGE ANAYLIZER
ipcMain.on('dua', (e, args) => {
    let cmd = 'baobab "' + args.dir + '"'
    exec(cmd)
})


// GET FILE SIZE. todo: this is just formating and the name needs to change
ipcMain.on('get_file_size', (e, args) => {
    e.sender.send('file_size', {href: args.href, size: args.size})
})


// GET FOLDER SIZE
ipcMain.on('get_folder_size', (e , args) => {

    if (fs.existsSync(args.href)) {

        let stats = fs.statSync(args.href)
        if (stats && stats.isDirectory() === true) {

            // GET FOLDER SIZE
            cmd = "cd '" + args.href + "'; du -Hs"
            du = exec(cmd)
            du.stdout.on('data', function (res) {

                // let win = window.getFocusedWindow();

                windows.forEach(win => {
                    // SEND FOLDER SIZE TO RENDERER
                    let size = parseInt(res.replace('.', '') * 1024)
                    win.send('folder_size', {href: args.href, size: size})
                })

            })
        }
    }

})

// GET DISK SPACE
// CREATE DF ARRAY
ipcMain.on('get_disk_space', (e, href) => {

    get_disk_space(href, (res) => {
        active_window.send('disk_space', res)
    });

})

// GET DISK SPACE SUMMARY
ipcMain.on('get_diskspace_summary', (e) => {
    get_diskspace_summary()
})

// CREATE CHILD WINDOW
function createChildWindow() {
    chileWindow = new BrowserWindow({

        minWidth:1024,
        minHeight:600,
        width: 1600,
        height: 768,
        backgroundColor: '#2e2c29',
        x:displayToUse.bounds.x + 50,
        y:displayToUse.bounds.y + 50,
        frame: false,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'preload.js'),
        },

    })

    // LOAD INDEX FILE
    chileWindow.loadFile('src/index.html')
}

process.on('uncaughtException', function (err) {
  console.log(err);
})

/* Header Menu */
const template = [
    {
        label: 'File',
        submenu : [
            {
                role: 'Close'
            }
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
            {
                label: 'Disk Usage Summary',
                click: () => {
                    // win.webContents.send('view', get
                    get_diskspace_summary();
                }
            },
            {type: 'separator'},
            {
                label: 'Sort',
                submenu: [
                    {
                        label: 'Date',
                        // accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+D' : 'CTRL+SHIFT+D',
                        click: () => {active_window.send('sort', 'date')}
                    },
                    {
                        label: 'Name',
                        click: () => {active_window.send('sort', 'size')}
                    },
                    {
                        label: 'Size',
                        click: () => {active_window.send('sort', 'name')}
                    },
                    {
                        label: 'Type',
                        click: () => {active_window.send('sort', 'type')}
                    },
                ]
            },
            {type: 'separator'},
            {
                label: 'Show Sidebar',
                accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.ShowSidebar : settings.keyboard_shortcuts.ShowSidebar,
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
                label: 'About'
            }
        ]
    }

]

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// TEMPLATE MENU
function add_templates_menu(menu, e, args) {

    let template_menu = menu.getMenuItemById('templates')

    let templates = fs.readdirSync(path.join(__dirname, 'assets/templates'))
    templates.forEach((file,idx) => {

        template_menu.submenu.append(new MenuItem({
            label: file.replace(path.extname(file),''),
            click: () => {
                e.sender.send('create_file_from_template', {file: file})
            }
        }));
    })
}

// LAUNCHER MENU
let launcher_menu
function add_launcher_menu(menu, e, args) {

    launcher_menu = menu.getMenuItemById('launchers')

    try {

        for(let i = 0; i < args.length; i++) {

            launcher_menu.submenu.append(new MenuItem({
                label: args[i].name,
                click: () => {

                    // console.log(e)
                    // e.sender.send('', args[i].exec)
                    e.sender.send('context-menu-command', 'open_with_application', args[i].exec)

                    let cmd = 'xdg-mime default ' + args[i].desktop + ' ' + args[i].mimetype
                    console.log(cmd)

                    execSync(cmd)

                    // e.sender.send('open_with')

                }
            }))
        }

    } catch (err) {

    }

}

// Run as Program
function add_execute_menu(menu, e, args) {

    menu.append(new MenuItem({
        label: 'Run as Program',
        click: () => {
            console.log('run as program');
        }

    }))

}

// Run as Program
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
                            console.log(err);
                        } else {
                            // console.log(stdout);
                            let options = {
                                id: 0,
                                href: filename,
                                linktext: path.basename(filename),
                                is_folder: false,
                                grid: ''
                            }
                            active_window.send('add_card', options)
                        }
                    })

                    cmd = 'ffprobe -i ' + href + ' -show_entries format=size -v quiet -of csv="p=0"'
                    // console.log(cmd)
                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            console.log(err)
                        } else {
                            // console.log('stderr', stderr)
                            // console.log('stdout', stdout);
                            active_window.send('progress', parseInt(stdout))
                        }
                    })

                },
            },
            {
                label: 'Convert to Ogg Vorbis',
                click: () => {
                    let filename = href.substring(0, href.length - path.extname(href).length) + '.ogg'
                    let cmd = 'ffmpeg -i ' + href + ' -c:a libvorbis -q:a 4 ' + filename;
                    // console.log(cmd);

                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            console.log(err);
                        } else {
                            // console.log(stdout);
                            let options = {
                                id: 0,
                                href: filename,
                                linktext: path.basename(filename),
                                is_folder: false,
                                grid: ''
                            }
                            active_window.send('add_card', options)
                        }
                    })

                    cmd = 'ffprobe -i ' + href + ' -show_entries format=size -v quiet -of csv="p=0"'
                    // console.log(cmd)
                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            console.log(err)
                        } else {
                            // console.log('stderr', stderr)
                            // console.log('stdout', stdout);
                            active_window.send('progress', parseInt(stdout))
                        }
                    })
                }
            },
        ]

    }))

}

// Compress Menu
function extract_menu(menu, e) {

    let menu_item = new MenuItem (
        {
            label: '&Extract',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Extract : settings.keyboard_shortcuts.Extract,
            click: () => {
                e.sender.send('context-menu-command', 'extract_here')
            }
        }
    )

    menu.insert(15, menu_item)
}


// Scripte Menu
function add_scripts_menu(menu, e, args) {

    let scripts_menu = menu.getMenuItemById('scripts')

    let templates = fs.readdirSync(path.join(__dirname, 'assets/scripts'))
    templates.forEach((file,idx) => {

        template_menu.submenu.append(new MenuItem({
            label: file.replace(path.extname(file),''),
            click: () => {
                console.log('scripts test')
                // e.sender.send('create_file_from_template', {file: file})
            }
        }));
    })
}

// Find context menu
ipcMain.on('context-menu-find', (e, args) => {

    let stats = fs.statSync(args)

    if (stats.isDirectory()) {

        find_menu_template = [
            {
                label: 'Open location',
                click: () => {
                    active_window.send('get_view', path.dirname(args))
                }
            },
            {
                type: 'separator'
            },

        ]

    } else {

        find_menu_template = [
            {
                label: 'Open location',
                click: () => {
                    active_window.send('get_view', path.dirname(args))
                }
            },
            {
                type: 'separator'
            },
            {
                id: 'launchers',
                label: 'Open with',
                // click: () => {
                //     e.sender.send('open_with')
                // },
                submenu: []
            },
            {
                type: 'separator'
            },
            {
                label: 'Add to workspace',
                accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.AddWorkspace : settings.keyboard_shortcuts.AddWorkspace,
                click: () => {
                    e.sender.send('add_workspace')
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Cut',
                accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Cut : settings.keyboard_shortcuts.Cut,
                click: () => {
                e.sender.send('context-menu-command', 'cut')
                }
            },
            {
                label: 'Copy',
                accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Copy : settings.keyboard_shortcuts.Copy,
                click: () => {
                    e.sender.send('context-menu-command', 'copy')
                }
            },
            {
                label: '&Rename',
                accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Rename : settings.keyboard_shortcuts.Rename,
                click: () => { e.sender.send('context-menu-command', 'rename') }
            },
            {
                type: 'separator'
            },
            {
            type: 'separator'
            },
            {
                label: 'Delete file',
                accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Delete : settings.keyboard_shortcuts.Delete,
                click: () => {
                    // e.sender.send('context-menu-command', 'delete_file')
                    e.sender.send('context-menu-command', 'delete')
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Properties',
                accelerator: process.platform == 'darwin' ? settings.keyboard_shortcuts.Properties : settings.keyboard_shortcuts.Properties,
                click:()=>{
                    // createPropertiesWindow()
                    e.sender.send('context-menu-command', 'props')
                }
            },

        ]

    }



    let menu = Menu.buildFromTemplate(find_menu_template);
    menu.popup(BrowserWindow.fromWebContents(e.sender));

})


// Devices menu
ipcMain.on('show-context-menu-devices', (e, args) => {

    device_menu_template = [
        // {
        //     label: 'Unmount',
        //     click: () => {

        //     }
        // },
        {
            label: 'Connect',
            click: () => {

            }
        }
    ]

    let menu = Menu.buildFromTemplate(device_menu_template)
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})


// MAIN MENU
ipcMain.on('show-context-menu', (e, options) => {

    // console.log(data)
    // console.log('running main menu')
    const template = [
    {
        label: 'New Folder',
        accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.NewFolder : settings.keyboard_shortcuts.NewFolder,
        click: () => {
          e.sender.send('context-menu-command', 'new_folder')
        }
    },
    {
        id: 'templates',
        label: 'New Document',
        submenu: [
        {
            label: 'Open Templates Folder',
            click: () => {
                e.sender.send('context-menu-command', 'open_templates_folder'),
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
        submenu: [
            {
                label: 'Date',
                click: () => {active_window.send('sort', 'date')}
            },
            {
                label: 'Name',
                click: () => {active_window.send('sort', 'name')}
            },
            {
                label: 'Size',
                click: () => {active_window.send('sort', 'size')}
            },
            {
                label: 'Type',
                click: () => {active_window.send('sort', 'type')}
            }

        ]
    },
    {
        type: 'separator'
    },
    {
        label: 'Paste',
        accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Paste : settings.keyboard_shortcuts.Paste,
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
        e.sender.send(
          'context-menu-command', 'open_terminal'
        )
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
      type: 'checkbox'

    },
  ]

    // CALL BUILD TEMPLATE. CREATE NEW FILES
    let menu = Menu.buildFromTemplate(template)


    // ADD TEMPLATES
    add_templates_menu(menu, e, options)


    // SHOW MENU
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// FOLDERS MENU
ipcMain.on('show-context-menu-directory', (e, args) => {

    const template1 = [
        {
            label: 'Open with Code',
            click: () => {
                e.sender.send('context-menu-command', 'vscode')
            }
        },
        {
            type: 'separator'
        },
        // {
        //     label: 'Open in New Tab',
        //     accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.OpenNewTab : settings.keyboard_shortcuts.OpenNewTab,
        //     click: () => {
        //         e.sender.send('context-menu-command', 'open_new_tab');
        //     }
        // },
        {
            label: 'Open',
            click: () => {
                e.sender.send('open')
            }
        },
        {
            label: 'Open in new window',
            click: () => {
                e.sender.send('context-menu-command', 'open_in_new_window')
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
            label: 'Sort',
            submenu: [
                {
                    label: 'Date',
                    click: () => {active_window.send('sort', 'date')}
                },
                {
                    label: 'Name',
                    click: () => {active_window.send('sort', 'name')}
                },
                {
                    label: 'Size',
                    click: () => {active_window.send('sort', 'size')}
                },
                {
                    label: 'Type',
                    click: () => {active_window.send('sort', 'type')}
                }

            ]
        },
        {
            type: 'separator'
        },
        {
            label: 'New Folder',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.NewFolder : settings.keyboard_shortcuts.NewFolder,
            click: () => {
                e.sender.send('context-menu-command', 'new_folder')
            }
        },
        {
            id: 'templates',
            label: 'New Document',
            submenu: [
            {
                label: 'Open Templates Folder',
                click: () => {
                    e.sender.send('context-menu-command', 'open_templates_folder'
                ),
                {
                    type: 'separator'
                }
            }
        },],
        },
        {
            type: 'separator'
        },
        {
            label: 'Add to workspace',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.AddWorkspace : settings.keyboard_shortcuts.AddWorkspace,
            click: () => {
                // console.log('add workspace')
                e.sender.send('add_workspace')
            },
        },
        {
            type: 'separator'
        },
        {
            label: 'Cut',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Cut : settings.keyboard_shortcuts.Cut,
            click: () => {
            e.sender.send('context-menu-command', 'cut')
            }
        },
        {
            label: 'Copy',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Copy : settings.keyboard_shortcuts.Copy,
            click: () => {
                e.sender.send('context-menu-command', 'copy')
            }
        },
        {
            label: 'Paste',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Paste : settings.keyboard_shortcuts.Paste,
            click: () => {
                e.sender.send('context-menu-command', 'paste')
            }
        },
        {
            label: '&Rename',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Rename : settings.keyboard_shortcuts.Rename,
            click: () => {
                e.sender.send('context-menu-command', 'rename')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Compress',
                accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Compress : settings.keyboard_shortcuts.Compress,
                submenu: [
                    {
                        label: 'tar.gz',
                        click: () => {
                            e.sender.send('context-menu-command', 'compress_folder')
                        }
                    },
                    // {
                    //     label: 'zip',
                    //     click: () => {
                    //         e.sender.send('context-menu-command', 'compress_folder')
                    //     }
                    // },
                ]
        },
        {
            type: 'separator'
        },
        {
          label: 'Delete',
          accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Delete : settings.keyboard_shortcuts.Delete,
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
                e.sender.send('context-menu-command', 'open_terminal')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Properties',
            accelerator: process.platform == 'darwin' ? settings.keyboard_shortcuts.Properties : settings.keyboard_shortcuts.Properties,
            click:()=>{
                // createPropertiesWindow()
                e.sender.send('context-menu-command', 'props');
            }
        },
        {
            type: 'separator'
        }
    ]

      const menu1 = Menu.buildFromTemplate(template1);

      // ADD TEMPLATES
      add_templates_menu(menu1, e, args[0]);

      // ADD LAUNCHER MENU
      add_launcher_menu(menu1, e, args);
      console.log(args);

      menu1.popup(BrowserWindow.fromWebContents(e.sender));

})

// FILES MENU
let files_menu_template = []
ipcMain.on('show-context-menu-files', (e, args) => {

    // const template = [
    files_menu_template = [
        {
            label: 'Open with Code',
            click: () => {
                e.sender.send('context-menu-command', 'vscode')
            }
        },
        {
            type: 'separator'
        },
        {
            id: 'launchers',
            label: 'Open with',
            // click: () => {
            //     e.sender.send('open_with')
            // },
            submenu: []
        },
        {
            type: 'separator'
        },
        {
            label: 'Add to workspace',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.AddWorkspace : settings.keyboard_shortcuts.AddWorkspace,
            click: () => {
                e.sender.send('add_workspace')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Sort',
            submenu: [
                {
                    label: 'Date',
                    click: () => {active_window.send('sort', 'date')}
                },
                {
                    label: 'Name',
                    click: () => {active_window.send('sort', 'name')}
                },
                {
                    label: 'Size',
                    click: () => {active_window.send('sort', 'size')}
                },
                {
                    label: 'Type',
                    click: () => {active_window.send('sort', 'type')}
                }

            ]
        },
        {
            type: 'separator'
        },
        {
            label: 'Cut',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Cut : settings.keyboard_shortcuts.Cut,
            click: () => {
            e.sender.send('context-menu-command', 'cut')
            }
        },
        {
            label: 'Copy',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Copy : settings.keyboard_shortcuts.Copy,
            click: () => {
                e.sender.send('context-menu-command', 'copy')
            }
        },
        {
            label: '&Rename',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Rename : settings.keyboard_shortcuts.Rename,
            click: () => { e.sender.send('context-menu-command', 'rename') }
        },
        {
            type: 'separator'
        },
        {
            id: 'templates',
            label: 'New Document',
            submenu: [
            {
                label: 'Open Templates Folder',
                click: () => {
                    e.sender.send('context-menu-command', 'open_templates_folder'
                ),
                {
                    type: 'separator'
                }
            }
        }],
        },
        {
            label: '&New Folder',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.NewFolder : settings.keyboard_shortcuts.NewFolder,
            click: () => {
            e.sender.send('context-menu-command', 'new_folder')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Compress',
                accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Compress : settings.keyboard_shortcuts.Compress,
                submenu: [
                    {
                        label: 'tar.gz',
                        click: () => {
                            e.sender.send('context-menu-command', 'compress_folder')
                        }
                    },
                    // {
                    //     label: 'zip',
                    //     click: () => {
                    //         e.sender.send('context-menu-command', 'compress_folder')
                    //     }
                    // },
                ]
        },
        {
        type: 'separator'
        },
        {
            label: 'Delete file',
            accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.Delete : settings.keyboard_shortcuts.Delete,
            click: () => {
                // e.sender.send('context-menu-command', 'delete_file')
                e.sender.send('context-menu-command', 'delete')
            }
        },
        {
            type: 'separator'
        },
        {
        label: 'Terminal',
        click: () => {
            e.sender.send(
            'context-menu-command', 'open_terminal'
            )
        }
        },
        {
            type: 'separator'
        },
        {
            label: 'Properties',
            accelerator: process.platform == 'darwin' ? settings.keyboard_shortcuts.Properties : settings.keyboard_shortcuts.Properties,
            click:()=>{
                // createPropertiesWindow()
                e.sender.send('context-menu-command', 'props')
            }
        },
    ]

    // files_menu_template = template;

    let menu = Menu.buildFromTemplate(files_menu_template)

    // ADD TEMPLATES
    add_templates_menu(menu, e, args)

    // ADD LAUNCHER MENU
    add_launcher_menu(menu, e, args.associated_apps)
    console.log(args)

    // Run as program
    if (args.access) {
        add_execute_menu(menu, e, args)
    }

    // console.log(args.href)

    // Convert audio menu
    // console.log(path.extname(args.href))

    let ext = path.extname(args.href);
    if (ext == '.mp4' || ext == '.mp3') {
        add_convert_audio_menu(menu, args.href);
    }

    if (ext == '.xz' || ext == '.gz' || ext == '.zip' || ext == '.img' || ext == '.tar') {
        // console.log('extract compressed file');
        extract_menu(menu, e, args);
    }

    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// CREATE WINDOW
ipcMain.on('new_window', function (e, args) {
    createWindow()
})

// GET HOME FOLDER
ipcMain.on('get_home_folder',function(e) {

    e.sender.send('home_folder', app.getPath('home'))

})


// FIND ON PAGE
ipcMain.on('find', function (e, args) {
})

// GET HOME FOLDER
ipcMain.on('get_home_folder',function(e){

  e.sender.send('home_folder', app.getPath('home'))

})


// FIND ON PAGE
ipcMain.on('find', function (e, args) {
})

// CONFIRM DELETE FILES DIALOG
ipcMain.on('confirm_file_delete', function (e, target_name) {

    let res = dialog.showMessageBoxSync(null, {

        type: 'warning',
        title: 'Warning',
        buttons: ['Delete', 'Cancel'],
        // type: 'question',
        normalizeAccessKeys: true,
        message: 'Are you sure you want to permanently delete',
        detail: target_name

    })

    if (res == 0) {
        e.sender.send('delete_file_confirmed', res)
    }

    if(res == 1){
        e.sender.send('clear_selected_files')
    }

})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('quit', () => {
    app.quit()
})

// ipcMain.on('reload',()=> {

//     let folder = localStorage.getItem('folder')

// })

