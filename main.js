const { app, globalShortcut, BrowserWindow, Menu, screen, dialog, accelerator, WebContents, webContents, MenuItem, ipcRenderer} = require('electron')
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
    console.log('running on is_main_view', state);
    isMainView = state;
})

ipcMain.on('active_window', (e) => {
    console.log('setting active window')
    /* Get active window */
    let window_id = e.sender.id;
    active_window = window.fromId(window_id);
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
        console.log('setting target destination', destination, isMainView);

    }

})

let current_directory   = '';
ipcMain.on('current_directory', (e, directory) => {

    if (directory != current_directory) {
        current_directory = directory;
    }
    console.log('setting current directory to ' + current_directory);

})

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

    console.log(targetFile, current_directory);

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

/* Get files properties */
function get_file_properties(filename) {

    let stats           = fs.statSync(filename)
    let cmd             = "xdg-mime query filetype '" + filename + "'"
    let exec_mime       = execSync(cmd).toString()

    // BUILD PROPERTIES
    let name            = path.basename(filename);
    let parent_folder   = path.basename(path.dirname(filename));
    let type            = exec_mime;
    let size            = '';
    let accessed        = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.atime);
    let modified        = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime);
    let created         = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.ctime);
    let contents        = '0 items, totalling 0 MB';

    if (stats.isDirectory()) {

        // let folders = fs.readdirSync(filename)
        // let folders_arr = folders.filter(item => fs.statSync(path.join(path.dirname(filename),item)).isDirectory())
        // console.log(folders_arr.length)

    }


    if (type == true) {
        size = ''
    } else {
        size = get_file_size(stats.size)
    }

    let file_properties = {
        Name:       name,
        Parent:     parent_folder,
        Size:       size,
        // Contents: contents,
        Accessed:   accessed,
        Modified:   modified,
        Created:    created,
        Type:       type

    }

    console.log('send file properties')
    let win = window.getFocusedWindow();
    win.send('file_properties', file_properties);
}

/* Get disk space */
function get_disk_space(href, callback) {

    df = []

    // RUN DISK FREE COMMAND
    let cmd = 'df "' + href.href + '"'

    console.log('running get disk space', cmd)

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

        // // CREATE OPTIONS OBJECT
        // let options = {
        //     disksize: 0,
        //     usedspace: 0,
        //     availablespace:0,
        //     foldersize:0,
        //     foldercount:0,
        //     filecount:0
        // }

        let res1 = data_arr[1].split(' ')

        let c = 0;
        res1.forEach((size, i) => {

            if (size != '') {

                console.log('size', size);

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

        cmd = 'cd "' + href.href + '"; du -s'
        du = exec(cmd)

        // console.log('command ' + cmd)

        du.stdout.on('data', function (res) {

            let win = window.getFocusedWindow();

            let size = parseInt(res.replace('.', '') * 1024)
            size = get_file_size(size)

            options.foldersize = size

            options.foldercount = href.folder_count
            options.filecount = href.file_count

            df.push(options)

            // SEND DISK SPACE
            active_window.send('disk_space', df)

        })

        // console.log(options)

    }

    callback(options)

// })

    // let child = exec(cmd)

    // // console.log(cmd)

    // let df = []

    // child.stdout.on("data", (res) => {

    //     // CREATE ARRAY FROM RESULT
    //     let disk_arr = res.split('\n')

    //     if (res.length > 0) {



    //         // CREATE OPTIONS OBJECT
    //         let options = {
    //             disksize: 0,
    //             usedspace: 0,
    //             availablespace:0,
    //             foldersize:0,
    //             foldercount:0,
    //             filecount:0
    //         }

    //         let res1 = disk_arr[1].split(' ')

    //         let c = 0;
    //         res1.forEach((size, i) => {

    //             if (size != '') {

    //                 console.log('size', size);

    //                 // 0 DISK
    //                 // 6 SIZE OF DISK
    //                 // 7 USED SPACE
    //                 // 8 AVAILABLE SPACE
    //                 // 10 PERCENTAGE USED
    //                 // 11 CURRENT DIR

    //                 switch (c) {
    //                     case 1:
    //                         // console.log('found 6 ' + res1[i])
    //                         options.disksize = get_file_size(parseFloat(size) * 1024)
    //                         break;
    //                     case 2:
    //                         options.usedspace = get_file_size(parseFloat(size) * 1024)
    //                         break;
    //                     case 3:
    //                         options.availablespace = get_file_size(parseFloat(size) * 1024)
    //                         break;
    //                 }

    //                 ++c;

    //             }
    //         })

    //         cmd = 'cd "' + href.href + '"; du -s'
    //         du = exec(cmd)

    //         // console.log('command ' + cmd)

    //         du.stdout.on('data', function (res) {

    //             let size = parseInt(res.replace('.', '') * 1024)
    //             size = get_file_size(size)

    //             options.foldersize = size

    //             options.foldercount = href.folder_count
    //             options.filecount = href.file_count

    //             df.push(options)

    //             // SEND DISK SPACE
    //             win.webContents.send('disk_space', df)

    //         })

    //     }

    // })



}

function get_diskspace_summary() {

    console.log('getting diskspace summary')

    get_disk_space({href: '/'}, (res) => {
        console.log('root disk space', res);

    });


}

// DELETE FILE
function delete_file(file, callback) {

    console.log('deleting file ' + file)
    let stats = fs.statSync(file)

    if (stats) {

        /* Folder */
        if (stats.isDirectory()) {

            fs.rm(file, {recursive: true}, (err) => {
                if (err) {
                    console.log(err);
                } else {

                    try{
                        console.log('folder deleted');
                        windows.forEach(win => {
                            win.send('remove_card', file);
                        })
                    } catch (err) {
                        console.log(err);
                    }
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

                    console.log('file deleted');

                    try {
                        active_window.send('remove_card', file);
                    } catch (err) {

                    }

                    // if (current_directory == path.dirname(file)) {
                        // try {
                        //     windows.forEach(win => {
                        //         win.send('remove_card', file);
                        //     })
                        // } catch (err) {
                        //     console.log(err)
                        // }
                    // }

                    callback(1);
                }

            })

        }

    }

}

function clear_copy_arr() {
    console.log('clearing copy array')
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
    console.log(clipboard.readText());
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

    // WINDOW OPTIONS
    let options = {
        minWidth: 1024,
        minHeight: 600,
        width: 1600,
        height: 768,
        backgroundColor: '#2e2c29',
        x:displayToUse.bounds.x + 50,
        y:displayToUse.bounds.y + 50,
        frame: true,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            nativeWindowOpen: false,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false
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

    console.log('win', win);
    windows.add(win);
    // return win;

};

app.whenReady().then(() => {

    // globalShortcut.register('Escape', (e) => {
    //     console.log('Escape is pressed');
    //     let active_window = BrowserWindow.getFocusedWindow()
    //     active_window.hide()

    // });

    createWindow()

    // ACTIVATE EVENTS GO HERE?
    // app.on('activate', function () {
    //     // On macOS it's common to re-create a window in the app when the
    //     // dock icon is clicked and there are no other windows open.
    //     if (BrowserWindow.getAllWindows().length === 0) createWindow()
    // })

})

ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = 'light'
    } else {
        nativeTheme.themeSource = 'dark'
    }
    return nativeTheme.shouldUseDarkColors
})

ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system'
})

ipcMain.on('copy_to_clipboard', (a, data) => {
    console.log('copying to clipboard', data)
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
    win.maximize()
})

// MINIMIZE WINDOW
ipcMain.on('minimize', () => {
    win.minimize()
})

// CLOSE WINDOW
ipcMain.on('close', () => {
    var win = BrowserWindow.getFocusedWindow();
    console.log('removing window from set');
    windows.delete(win)
    window.hide()
})

// GO BACK
ipcMain.on('go_back', function(e, msg) {
    console.log('running go back from main ')
    windows.forEach(win => {
        win.webContents.goBack()
    })
})

ipcMain.on('go_foward', (e) => {
    win.webContents.goFoward()
})

// showDevices()
// win.webContents.on('get_devices', (e, devicelist, callback) => {
//     console.log('device lengh list ' + devicelist.length)
// })

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

    })
}

// HANDLE DRAG START
ipcMain.on('ondragstart', (e, href) => {

    console.log('added', href, 'to start drag')

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

    console.log('on add copy files', data);
    copy_files_arr = data;

    e.sender.send('clear_copy_arr');

})


// COPY
// ipcMain.on('copy', (e, copy_files_arr, state) => {

//     console.log('on copy', copy_files_arr);
//     copy(copy_files_arr, state);

// })

ipcMain.on('copy', (e, copy_files_arr_old, state = 0) => {

    console.log('on copy', copy_files_arr);
    copy(copy_files_arr, state);

})

// COPY
function copy(state) {

    console.log('copy arr length', copy_files_arr.length)

    copy_files_arr.every((item, idx) => {

        let source = item.source;
        // let destination = dir; //item.destination

        let source_stats = fs.statSync(source)
        // let destination_stats = fs.statSync(destination)

        let destination_file = path.join(destination, path.basename(source))

        let max = 0

        // DIRECTORY
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
                destination_file = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(path.basename(source)).length)) + ' Copy'

                state = 0
                copyfolder(source, destination_file, state, () => {

                })

                // CREATE FOLDER
                options.href = destination_file
                options.linktext = path.basename(destination_file)

                // let win = window.getFocusedWindow()
                active_window.send('add_card', options)

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
                    // })

                    // COPY FOLDERS RECURSIVE
                    copyfolder(source, destination_file, state, () => {

                        console.log('running',path.basename(source))

                        // switch (state) {
                        //     // PASTE
                        //     case 2:

                        if (isMainView) {

                            let options = {
                                href: destination_file,
                                linktext: path.basename(destination_file),
                                is_folder: true
                            }

                            active_window.send('add_card', options)
                            active_window.send('update_cards')

                        }

                        //     break;
                        // }

                        copy_files_arr.shift()
                        copy(copy_files_arr,state)

                    })
                    return false;
                }
            }

        // FILES
        } else {

            console.log(source, destination)

            // APPEND COPY TO FILENAME IF SAME
            if (path.dirname(source) == destination) {

                // CREATE NEW FILE NAME
                destination_file = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(source).length) + ' Copy' + path.extname(source));

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
                return false;


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

                    console.log('copy array', copy_files_arr)
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

                    console.log('copy array', copy_files_arr)

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

    console.log('running overwrite confirmed all')

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

        console.log(data.source);

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
    console.log('running overwrite confirmed', data.source, data.destination)

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

    console.log('running overwrite skipped',copy_files_arr.length);

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

    console.log('running overwrite canceled', copy_files_arr);

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

    // let destination = data.destination

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

        console.log('create move data', data, copy_files_arr)
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

    console.log('running on move');
    move();

})

/* Move files */
function move() {

    console.log('running move', copy_files_arr);

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

                win.webContents.send('notification', 'select a different directory')

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

                    console.log('create move data', data, copy_files_arr);
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

            console.log('done copying folder')

            try {

                if (fs.existsSync(data.destination)) {

                    delete_file(data.source, () => {

                        // REMOVE ITEM FROM ARRAY
                        copy_files_arr.shift()

                        console.log('folder deleted array length ', copy_files_arr.length)

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

    console.log('running move confirmmed all', copy_files_arr);

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

                console.log('runninig copy file')

                console.log('callback', res)

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

    console.log('running')

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

    console.log('running overwrite move confirmed')

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

    console.log('overwrite move confirmed all')

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

        console.log(data.source);

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

    console.log('overwrite move skip')
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

    console.log('overwrite_move_canceled_all');

    let confirm = window.getFocusedWindow();
    confirm.hide();
    copy_files_arr = [];

})

// OVERWRITE CANCELED - done
ipcMain.on('overwrite_move_canceled', (e) => {

    console.log('overwrite_move_canceled');

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

            console.log('send file properties')
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
        console.log('device mounted ' + res)
        e.sender.send('gio_mounted', res)
    })

    mount_gio.stderr.on('data', (res) => {
        console.log('device already connected ' + res)
        e.sender.send('gio_mounted', res)
    })

    mount_gio.on('exit', (code) => {
        console.log('exit code ' + code)
    })

})

// MONITOR GIO DEVICES
ipcMain.on('monitor_gio', (e, data) => {

    let cmd = 'gio mount -o'
    let monitor_gio = exec(cmd)

    console.log('starting gio monitor ' + cmd)

    //
    monitor_gio.stdout.on('data', (res) => {
        console.log('gio monitor' + res)
        e.sender.send('gio_monitor', res)
    })

    monitor_gio.stderr.on('data', (res) => {
        console.log('gio monitor error ' + res)
        e.sender.send('gio_monitor', res)
    })




})

// LIST FILES USING GIO
ipcMain.on('get_gio_files', (e, data) => {

    console.log(data)

    let files = exec('gio list ' + data)

    // STDOUT
    files.stdout.on('data', (res) => {
        console.log(res)
        e.sender.send('gio_files', {res, data})
    })

    // S
    files.stderr.on('data', (data) => {
        console.log(data)
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

    console.log('uncompressed size ' + size)
    e.sender.send('uncompressed_size', size)

})

// GET FILES
ipcMain.on('get_files', (e, dir) => {

    // console.log('directory ' + dir)
    // let dirents = fs.readdirSync(args.dir)
    // if (dirents.length > 0) {
    //     e.sender.send('files', dirents)
    // }
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

    // console.log('getting folder size', args)

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

// // SEND COPY FILES ARRAY
// ipcMain.on('get_copy_files_arr', (e, destination_folder) => {

//     console.log('on get_copy_files arr', copy_files_arr)

//     let win = window.getFocusedWindow();
//     win.webContents.send('copy_files_arr', copy_files_arr);
//     // win.webContents.send('copy_files', {copy_files_arr : copy_files_arr, destination_folder: destination_folder})

//     // CLEAR COPY FILES ARRAY
//     copy_files_arr = []

// })

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

// win.loadURL('file://' + __dirname + '/src/backup.html')


// const contents = win.webContents
// console.log(contents)


//   const ses = win.webContents.session
//   const ses = session.fromPartition('persist:name')


//   win.once('ready-to-show',() => {
//       win.show()
//   })

// // TESTING ??
// if (process.argv[2]) {
//     start_path = process.argv[2]
//     console.log(start_path)
//     win.webContents.send('start_path', start_path)
//   }





  // // START OF SESSION MANAGEMENT
  // const ses = win.webContents.session

  // ses.fromPartion('partition', true)




  /////////////////////////////////////////////////////////

//   win.once('ready-to-show', () => {
//     console.log('ready-to-show')
//     win.show();
//   });

//   win.on('closed', () => {
//     windows.delete(win);
//     win = null;
//   });



//   windows.add(win);

    // const ses = session.fromPartition('persist:name')

    // console.log('all running session ' + session.defaultSession.serviceWorkers.getAllRunning())

    // session.defaultSession.serviceWorkers.on('console-message', (event, messageDetails) => {
    //     console.log(
    //       'Got service worker message',
    //       messageDetails,
    //       'from',
    //       session.defaultSession.serviceWorkers.getFromVersionID(messageDetails.versionId)
    //     )
    // })

    // console.log(ses.getCacheSize())

    // win.setFullScreen = true
    // win.webContents.openDevTools()

    // win.maximize()


    // // RELOAD WINDOW
    // ipcMain.on('reload',function(e){
    //     win.loadFile('src/index.html')
    // })


    // // MAXAMIZE WINDOW
    // ipcMain.on('maximize', () => {
    //     win.maximize()
    // })


    // // MINIMIZE WINDOW
    // ipcMain.on('minimize', () => {
    //     win.minimize()
    // })

    // // CLOSE WINDOW
    // ipcMain.on('close', () => {
    //     win.close()
    // })


  // let displays = screen.getAllDisplays()

  // displays.forEach(element => {
  //   console.log(element)
  // });


  // let externalDisplay = displays.find((display) => {
  //   return display.bounds.x !== 0 || display.bounds.y !== 0
  // })

  // if (externalDisplay) {
  //   win = new BrowserWindow({
  //     x: externalDisplay.bounds.x + 50,
  //     y: externalDisplay.bounds.y + 50
  //   })
  // }

  // Menu.setApplicationMenu(menu);


// }

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
                        accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+D' : 'CTRL+SHIFT+D',
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
                accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+B' : 'CTRL+B',
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
function add_templates_menu(menu, e, args){

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
    if (args.length > 0) {
        for(let i = 0; i < args.length; i++) {
            launcher_menu.submenu.append(new MenuItem({
                label: args[i].name,
                click: () => {

                    console.log(e)

                    // e.sender.send('', args[i].exec)
                    e.sender.send('context-menu-command', 'open_with_application', args[i].exec)

                    let cmd = 'xdg-mime default ' + args[i].desktop + ' ' + args[i].mimetype
                    console.log(cmd)
                    execSync(cmd)

                    // e.sender.send('open_with')

                }
            }))
        }
    }
}

// MAIN MENU
ipcMain.on('show-context-menu', (e, options) => {

    // console.log(data)

  console.log('running main menu')
  const template = [
    {
        label: 'New Folder',
        accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+N' : 'CTRL+SHIFT+N',
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
                click: () => {win.webContents.send('sort', 'date')}
            },
            {
                label: 'Name',
                click: () => {win.webContents.send('sort', 'name')}
            },
            {
                label: 'Size',
                click: () => {win.webContents.send('sort', 'size')}
            },
            {
                label: 'Type',
                click: () => {win.webContents.send('sort', 'type')}
            }

        ]
    },
    {
        type: 'separator'
    },
    {
        label: 'Paste',
        accelerator: process.platform === 'darwin' ? 'CTRL+V' : 'CTRL+V',
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
          'context-menu-command', 'menu_terminal'
        )
      }
    },
    {
      type: 'separator'
    },
    // {
    //   label: 'Properties',
    //   click:()=>{
    //     // createPropertiesWindow()
    //     e.sender.send('context-menu-command', 'props')
    //   }
    // },
    {
        type: 'separator'
    },
    {
      label: 'Show Hidden',
      type: 'checkbox'

    },
    // { label: 'Terminal', type: 'button', checked: true }
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
                    click: () => {win.webContents.send('sort', 'date')}
                },
                {
                    label: 'Name',
                    click: () => {win.webContents.send('sort', 'name')}
                },
                {
                    label: 'Size',
                    click: () => {win.webContents.send('sort', 'size')}
                },
                {
                    label: 'Type',
                    click: () => {win.webContents.send('sort', 'type')}
                }

            ]
        },
        {
            type: 'separator'
        },
        {
            label: 'New Folder',
            accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+N' : 'CTRL+SHIFT+N',
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
            click: () => {
                e.sender.send('add_workspace')
            },
        },
        {
            type: 'separator'
        },
        {
            label: 'Cut',
            accelerator: process.platform === 'darwin' ? 'CTRL+X' : 'CTRL+X',
            click: () => {
            e.sender.send('context-menu-command', 'cut')
            }
        },
        {
            label: 'Copy',
            accelerator: process.platform === 'darwin' ? 'CTRL+C' : 'CTRL+C',
            click: () => {
                e.sender.send('context-menu-command', 'copy')
            }
        },
        {
            label: 'Paste',
            accelerator: process.platform === 'darwin' ? 'CTRL+V' : 'CTRL+V',
            click: () => {
                e.sender.send('context-menu-command', 'paste')
            }
        },
        {
            label: 'Paste file into folder',
            click: () => {
            e.sender.send('context-menu-command', 'paste_file')
            }
        },
        {
            label: '&Rename',
            accelerator: process.platform === 'darwin' ? 'F2' : 'F2',
            click: () => {
            e.sender.send('context-menu-command', 'rename')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Compress',
            click: () => {
            e.sender.send('context-menu-command', 'compress_folder')
            }
        },
        {
            type: 'separator'
        },
        {
          label: 'Delete',
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
            e.sender.send('context-menu-command', 'open_folder_in_terminal')
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Properties',
            accelerator: process.platform == 'darwin' ? 'ALT+I' : 'ALT+I',
            click:()=>{
                // createPropertiesWindow()
                e.sender.send('context-menu-command', 'props')
            }
        },
        {
            type: 'separator'
        }
        // {
        //   label: 'Move to trash',
        //   click: () => {
        //     e.sender.send('context-menu-command', 'move_to_trash')
        //   }
        // },
    ]

      const menu1 = Menu.buildFromTemplate(template1)

      // ADD TEMPLATES
      add_templates_menu(menu1, e, args)

      // ADD LAUNCHER MENU
      add_launcher_menu(menu1, e, args)


      menu1.popup(BrowserWindow.fromWebContents(e.sender))

})

// FILES MENU
ipcMain.on('show-context-menu-files', (e, args) => {

    const template = [
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
                    click: () => {win.webContents.send('sort', 'date')}
                },
                {
                    label: 'Name',
                    click: () => {win.webContents.send('sort', 'name')}
                },
                {
                    label: 'Size',
                    click: () => {win.webContents.send('sort', 'size')}
                },
                {
                    label: 'Type',
                    click: () => {win.webContents.send('sort', 'type')}
                }

            ]
        },
        {
            type: 'separator'
        },
        {
            label: 'Cut',
            accelerator: process.platform === 'darwin' ? 'CTRL+X' : 'CTRL+X',
            click: () => {
            e.sender.send('context-menu-command', 'cut')
            }
        },
        {
            label: 'Copy',
            accelerator: process.platform === 'darwin' ? 'CTRL+C' : 'CTRL+C',
            click: () => {
                e.sender.send('context-menu-command', 'copy')
            }
        },
        {
            label: '&Rename',
            accelerator: process.platform === 'darwin' ? 'F2' : 'F2',
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
            accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+N' : 'CTRL+SHIFT+N',
            click: () => {
            e.sender.send('context-menu-command', 'new_folder')
            }
        },
        {
            type: 'separator'
        },
        {
        label: '&Extract',
        accelerator: process.platform === 'darwin' ? 'SHIFT+E' : 'SHIFT+E',
        click: () => { e.sender.send('context-menu-command', 'extract_here') }
        },
        {
            label: 'Compress',
            click: () => {
            e.sender.send(
                'context-menu-command', 'compress_folder'
            )
            }
        },
        {
        type: 'separator'
        },
        {
        label: 'Delete file',
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
            'context-menu-command', 'menu_terminal'
            )
        }
        },
        {
            type: 'separator'
        },
        {
            label: 'Properties',
            accelerator: process.platform == 'darwin' ? 'ALT+I' : 'ALT+I',
            click:()=>{
                // createPropertiesWindow()
                e.sender.send('context-menu-command', 'props')
            }
        },
    ]


    let menu = Menu.buildFromTemplate(template)

    // ADD TEMPLATES
    add_templates_menu(menu, e, args)


    // ADD LAUNCHER MENU
    add_launcher_menu(menu, e, args)


    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// CREATE NEW WINDOW
ipcMain.on('new_window', function (e, args) {
    createWindow()
})

// GET HOME FOLDER
ipcMain.on('get_home_folder',function(e) {

    e.sender.send('home_folder', app.getPath('home'))

})


// FIND ON PAGE
ipcMain.on('find', function (e, args) {
  console.log('running find')
  // const requestId = win.webContents.findInPage(text, args);
})

// CREATE NEW WINDOW
// ipcMain.on('new_window', function (e, args) {
//     // createWindow()
//     window.open('src/index.html')
//     console.log('running new window')
// })


// GET HOME FOLDER
ipcMain.on('get_home_folder',function(e){

  e.sender.send('home_folder', app.getPath('home'))

})


// FIND ON PAGE
ipcMain.on('find', function (e, args) {
  console.log('running find')
  // const requestId = win.webContents.findInPage(text, args);
})

// CONFIRM DELETE FILES DIALOG
ipcMain.on('confirm_file_delete', function (e, target_name) {
  // e.preventDefault()

  let res = dialog.showMessageBoxSync(null, {

    type: 'warning',
    title: 'Warning',
    buttons: ['Delete', 'Cancel'],
    // type: 'question',
    normalizeAccessKeys: true,
    message: 'Are you sure you want to permanently delete',
    detail: target_name

  })

  console.log(res)

  if (res == 0) {
    e.sender.send('delete_file_confirmed', res)
  }

  if(res == 1){
    e.sender.send('clear_selected_files')
  }



})

// // CONFIRM OVERWRITE FILE DIALOG
// ipcMain.on('confirm_move_overwrite', function (e, msg) {
//     // e.preventDefault()

//     let res = dialog.showMessageBoxSync(null, {

//         // defaultId: 0,
//         type: 'warning',
//         title: 'Warning',
//         buttons: ['Ok', 'Cancel'],
//         // type: 'question',
//         message: 'Are you sure you want to overwrite your stuff',
//         detail: msg

//     })

//     // console.log(res)

//     if (res == 0) {

//         e.sender.send('move_overwrite_confirmed', res)
//     }

// })




/////////////////////////////////////////////////////////////////////////////////////

// app.whenReady().then(() => {
//   createWindow()
//   app.on('activate', () => {
//     if (BrowserWindow.getAllWindows().length === 0) {

//         createWindow()

//         const ses = session.fromPartition('persist:name')
//         console.log(ses.getUserAgent())

//     }
//   })
// })


// ipcMain.on('ondragstart', (e, filePath) => {
//   e.sender.startDrag({
//     file: path.join(__dirname, filePath),
//     icon: iconName,
//   })
// })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('quit', () => {
    app.quit()
})


ipcMain.on('reload',()=> {

  // let folder = localStorage.getItem('folder')

})


// ipcMain.on('ondragstart', (event, filePath) => {
//   event.sender.startDrag({
//     file: filePath,
//     icon: '/path/to/icon.png'
//   })
// })












// ipc.on('btn_getdir', function (event, arg) {
//   win.webContents.send('targetPriceVal', arg)
// })


// ipc.on('update-notify-value', function (event, arg) {
//   win.webContents.send('targetPriceVal', arg)
// })