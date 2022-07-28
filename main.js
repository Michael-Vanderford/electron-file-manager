const { app, globalShortcut, BrowserWindow, Menu, screen, dialog, accelerator, WebContents, webContents, MenuItem, ipcRenderer} = require('electron')
const path = require('path')
const fs = require('fs')
const { exec, execSync, spawn, execFileSync } = require("child_process");
const ipcMain = require('electron').ipcMain
const nativeTheme = require('electron').nativeTheme
const nativeImage = require('electron')
const shell = require('electron').shell
const usb = require('usb');

const move_windows = new Set()
const windows = new Set()
const mime = require('mime-types')




ipcMain.on('open_file', (e) => {

})

// COPY FILES RECURSIVE
let recursive = 0
function copyFileSync(source, target, state, callback) {

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

    if (state == 1) {
        // console.log('adding card state ', state)
        let options = {
            id: 0,
            href: targetFile,
            linktext: path.basename(targetFile),
            grid: ''
        }
        win.webContents.send('add_card', options)
    }

    // COPY FILE
    fs.copyFile(source, targetFile, (err) => {

        if (err) {
            console.log('copy file sync err', err)
        } else {

            if (--recursive == 0) {

                win.webContents.send('update_cards')

                // const result = 1
                callback(1)

            }

        }

    })

}

// COPY FOLDER RECURSIVE
copy_folder_counter = 0
function copyFolderRecursiveSync(source, destination, state, callback) {

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

                                // console.log('running copy folder sync')

                                copyFolderRecursiveSync(cursource, curdestination, state, () => {
                                    win.webContents.send('update_cards')

                                })

                            // COPY FILES
                            } else if (stats.isFile() == true) {

                                // console.log('running copy file sync')

                                copyFileSync(cursource, curdestination, state, () => {

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

// DELETE FILE
function delete_file(file, callback) {

    console.log('deleting file ' + file)
    let stats = fs.statSync(file)

    if (stats) {

        if (stats.isDirectory()) {

            fs.rm(file, {recursive: true}, (err) => {
                if (err) {
                    console.log(err)
                } else {
                    console.log('folder deleted')
                    win.send('remove_card', file)
                    callback(1)
                }
            })

        } else {

            fs.unlink(file, err => {

                if (err) {
                    console.log('error deleteing file', source)
                    callback(0)
                } else {
                    console.log('file deleted')
                    win.send('remove_card', file)
                    callback(1)
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

// CREATE MAIN WINDOW
let win = null
function createWindow() {

    let displayToUse = 0
    let lastActive = 0
    let displays = screen.getAllDisplays()

    // Single Display
    if (displays.length === 1) {
        displayToUse = displays[0]
    }

    // Multi Display
    else {
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
        minWidth:1024,
        minHeight:600,
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
            // nativeWindowOpen: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    }


    win = new BrowserWindow(options)

    win.webContents.openDevTools()

    // LOAD INDEX FILE
    win.loadFile('src/index.html')

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
        var window = BrowserWindow.getFocusedWindow();
        window.hide()
    })

    // GO BACK
    ipcMain.on('go_back', function(e, msg) {
        console.log('running go back from main ')
        win.webContents.goBack()
    })

    ipcMain.on('go_foward', (e) => {
        win.webContents.goFoward()
    })

    // showDevices()
    // win.webContents.on('get_devices', (e, devicelist, callback) => {
    //     console.log('device lengh list ' + devicelist.length)
    // })

}

// THEME
nativeTheme.on('updated', () => {

    console.log('changed theme', nativeTheme.shouldUseDarkColors)

    if (nativeTheme.shouldUseDarkColors == true) {
        // console.log('what')
        // app.relaunch()
        // win.webContents.send('updatetheme', 'dark')
        // nativeTheme.themeSource = 'dark'
        // // win.loadFile('src/index.html')
    } else {
        // console.log('where')
        // nativeTheme.themeSource = 'light'
        // win.loadFile('src/index.html')
        // app.relaunch()

    }

})

// GET ICON PATH
ipcMain.on('get_icon_path', (e, href) => {
    get_icon_path(href)
})

// GET ICON PATH
function get_icon_path(href) {

    app.getFileIcon(href).then(icon => {

        icon_path = icon.toDataURL()
        let data = {
            href: href,
            icon_path: icon_path
        }

        win.webContents.send('icon_path',data)
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

// COPY
function copy(copy_files_arr, state) {

    // console.log('arr length', copy_files_arr.length)

    copy_files_arr.every((item, idx) => {

        let source = item.source
        let destination = item.destination

        let source_stats = fs.statSync(source)
        let destination_stats = fs.statSync(destination)

        let destination_file = path.join(destination, path.basename(source))

        let max = 0

        // DIRECTORY
        if (source_stats.isDirectory()) {

            let options = {
                id: 0,
                href: destination_file,
                linktext: path.basename(destination_file),
                grid: ''
            }

            if (source == destination_file) {

                // BUILD DESTINATION PATH
                destination_file = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(path.basename(source)).length)) + ' Copy'

                state = 0
                copyFolderRecursiveSync(source, destination_file, state, () => {

                })

                // CREATE FOLDER
                options.href = destination_file
                options.linktext = path.basename(destination_file)
                win.webContents.send('add_card', options)

                return false

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

                    // COPY FOLDERS RECURSIVE
                    copyFolderRecursiveSync(source, destination_file, state, () => {

                        // console.log('running',path.basename(source))

                        switch (state) {
                            // PASTE
                            case 2:

                                let options = {
                                    href: destination_file,
                                    linktext: path.basename(destination_file)
                                }

                                win.webContents.send('add_card', options)
                                // win.webContents.send('update_cards')

                            break;
                        }

                        copy_files_arr.shift()
                        copy(copy_files_arr,state)

                    })


                    return false;

                }

            }

        // FILES
        } else {

            // APPEND COPY TO FILENAME IF SAME
            if (path.dirname(source) == destination) {

                // CREATE NEW FILE NAME
                destination_file = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(source).length) + ' Copy' + path.extname(source));

                // COPY FILE
                state = 1;
                // let max = parseInt(item.size)
                copyFileSync(source, destination_file, state, () => {})

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

                    // COPY FILE - done
                    // if state = 2 then change to 1 to add cards
                    // console.log('copy files ', path.basename(destination_file), copy_files_arr.length)

                    if (state == 2) {
                        state = 1
                    }

                    copyFileSync(source, destination_file, state, () => {})

                    copy_files_arr.shift()
                    copy(copy_files_arr, state);

                    return false

                }

            }

        }

    })

    return true
}

// COPY
ipcMain.on('copy', (e, copy_files_arr, state) => {

    copy(copy_files_arr, state);

})

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

    let bounds = screen.getPrimaryDisplay().bounds;
    let x = bounds.x + ((bounds.width - 400) / 2);
    let y = bounds.y + ((bounds.height - 400) / 2);


    const confirm = new BrowserWindow({
        parent:win,
        modal:true,
        width: 550,
        height: 415,
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
ipcMain.on('overwrite_confirmed_all', (e, copy_files_arr) => {

    console.log('running overwrite confirmed all')

    // HIDE WINDOW
    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide();

    // GET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach(item => {
        max += parseInt(item.size);
    })

    // SHOW PROGRESS
    win.webContents.send('progress', max);

    // LOOP OVER COPY ARRAY
    copy_files_arr.forEach((data, idx) => {
        console.log(data.source);

        // COPY DIRECTORY
        if (fs.statSync(data.source).isDirectory()) {

            copyFolderRecursiveSync(data.source, data.destination, data.state, () => {

            })

        // COPY FILES - done
        } else {
            copyFileSync(data.source, data.destination, data.state, () => {

            })
        }
    })

    copy_files_arr = []

})

// OVERWRITE COPY CONFIRMED
ipcMain.on('overwrite_confirmed', (e, data, copy_files_arr) => {

    console.log('running overwrite confirmed', data.source, data.destination)

    // HIDE
    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide();

    // GET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach(item => {
        max += parseInt(item.size)
    })

    // SHOW PROGRESS
    win.webContents.send('progress', max);

    // COPY FOLDER
    if (fs.statSync(data.source).isDirectory()) {
        copyFolderRecursiveSync(data.source, data.destination, data.state, () => {

            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift()

        })

    // COPY FILE - done
    } else {

        copyFileSync(data.source, data.destination, 0, () => {

            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift()

            if (copy_files_arr.length > 0) {

                data = {
                    state: 0,
                    source: copy_files_arr[0].source,
                    destination: copy_files_arr[0].destination
                }

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
ipcMain.on('overwrite_canceled', (e, copy_files_arr) => {

    console.log('running overwrite canceled');

    // HIDE
    let confirm = BrowserWindow.getFocusedWindow();
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


// MOVE DIALOG
function createMoveDialog(data, copy_files_arr) {

    let destination = data.destination

    let bounds = screen.getPrimaryDisplay().bounds;
    let x = bounds.x + ((bounds.width - 400) / 2);
    let y = bounds.y + ((bounds.height - 400) / 2);

    // DIALOG SETTINGS
    let confirm = new BrowserWindow({
        parent:win,
        modal:true,
        width: 550,
        height: 300,
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

        // console.log('create move data', data)
        // confirm.webContents.openDevTools()
        confirm.send('confirming_move', data, copy_files_arr)

    })

    // MOVE CONFIRMED - todo: needs work
    ipcMain.on('move_confirmed', (e, data, copy_files_arr) => {

        confirm.hide()

        // SET SIZE FOR PROGRESS
        let max = 0;
        copy_files_arr.forEach(item => {
            max += parseInt(item.size)
        })

        // SHOW PROGRESS
        win.webContents.send('progress', max);

        // SET STATE TO 1 IF PASTE
        let state = data.state
        if (state == 2) {
            state = 1;
        }

        // DIRECTORY
        if (fs.statSync(data.source).isDirectory()) {
            // state = 0
            copyFolderRecursiveSync(data.source, data.destination, data.state, () => {

                console.log('done copying folder')

                try {

                    if (fs.existsSync(data.destination)) {

                        delete_file(data.source, () => {

                            // REMOVE ITEM FROM ARRAY
                            copy_files_arr.shift()

                            console.log('folder deleted array length ', copy_files_arr.length)

                            if (copy_files_arr.length > 0) {

                                data = {
                                    state: data.state,
                                    source: copy_files_arr[0].source,
                                    destination: copy_files_arr[0].destination
                                }

                                createMoveDialog(data, copy_files_arr)
                            }

                        })
                    }
                } catch (err) {
                    console.log('copy folder recursive error', err)
                }

            })


        // FILES - done
        } else {

            console.log('data', data, 'array',copy_files_arr)

            // state = 0
            copyFileSync(data.source, data.destination, data.state, () => {

                if (fs.existsSync(data.destination)) {

                    delete_file(data.source, () => {

                        // REMOVE ITEM FROM ARRAY
                        copy_files_arr.shift();

                        if (copy_files_arr.length > 0) {

                            if (data.state == 2) {
                                data.state = 1;
                            }

                            data = {
                                state: data.state,
                                source: copy_files_arr[0].source,
                                destination: copy_files_arr[0].destination
                            }


                            if (fs.existsSync(path.join(data.destination, path.basename(data.source)))) {
                                createOverwriteMoveDialog(data,copy_files_arr);
                            } else {
                                createMoveDialog(data, copy_files_arr);
                            }

                        }

                    })
                }

            })

        }
    })

    // MOVE CANCELED - done
    ipcMain.on('move_canceled', (e) => {
        confirm.hide()
        // REMOVE ITEM FROM ARRAY
        copy_files_arr.shift()
        if (copy_files_arr.length > 0) {
            data = {
                state: 0,
                source: copy_files_arr[0].source,
                destination: copy_files_arr[0].destination
            }
            if (fs.existsSync(path.join(data.destination, path.basename(data.source)))) {
                createOverwriteMoveDialog(data,copy_files_arr);
            } else {
                createMoveDialog(data, copy_files_arr);
            }
        }
    })

    // MOVE CONFIRMED ALL
    ipcMain.on('move_confirmed_all', (e, data, copy_files_arr) => {

        confirm.hide()

        // SET SIZE FOR PROGRESS
        let max = 0;
        copy_files_arr.forEach(item => {
            max += parseInt(item.size)
        })

        // SHOW PROGRESS
        win.webContents.send('progress', max);

        // SET STATE TO 1 IF PASTE
        let state = data.state
        if (state == 2) {
            state = 1;
        }

        // COPY FILES
        copy_files_arr.forEach((data, idx) => {
            console.log(data.source);

            // DIRECTORY
            if (fs.statSync(data.source).isDirectory()) {

                copyFolderRecursiveSync(data.source, data.destination, state, () => {

                    copy_files_arr.forEach(data => {
                        delete_file(data.source, () => {
                            win.send('remove_card', data.source);
                        })
                    })

                    move_windows.forEach(win => {
                        win.hide();
                    })
                    move_windows.clear();

                })


            // FILES
            } else {

                // state = 0
                copyFileSync(data.source, data.destination, state, () => {

                    copy_files_arr.forEach(data => {
                        delete_file(data.source, () => {
                            win.send('remove_card', data.source);
                        })
                    })

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


}

// MOVE
ipcMain.on('move', (e, copy_files_arr, state) => {

    copy_files_arr.every((item, idx) => {

        let source = item.source
        let destination = item.destination

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
                        state: state,
                        source: source,
                        destination: destination_file
                    }

                    createConfirmDialog(data, copy_files_arr)

                } else {

                    let data = {
                        state: state,
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
            if (path.dirname(source) == destination) {

                // CREATE NEW FILE NAME
                destination_file = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(source).length) + ' Copy' + path.extname(source))

                // COPY FILE
                copyFileSync(source,destination_file, state, () => {})

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
                        state: state,
                        source: source,
                        destination: destination_file
                    }

                    console.log('data', data, copy_files_arr)


                    createMoveDialog(data,copy_files_arr)
                    return false

                }

            }

        }

    })
    return true
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
        parent:win,
        modal:true,
        width: 550,
        height: 450,
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

    // OVERWRITE MOVE CONFIRMED
    ipcMain.on('overwrite_move_confirmed', (e, data) => {

        console.log('running overwrite move confirmed')
        confirm.hide()

        // console.log('copy files array length', copy_files_arr.length, 'data', data)

        // DIRECTORY
        if (fs.statSync(data.source).isDirectory()) {

            copyFolderRecursiveSync(data.source, data.destination, () => {

            })

        // FILES - done
        } else {

            copyFileSync(data.source, data.destination, data.state, () => {

                // DELETE SOURCE FILE
                delete_file(data.source, () => {})

                // REMOVE ITEM FROM ARRAY
                copy_files_arr.shift()

                // CHECK ARRAY LENGTH
                if (copy_files_arr.length > 0) {

                    data = {
                        state: 0,
                        source: copy_files_arr[0].source,
                        destination: copy_files_arr[0].destination
                    }

                    // console.log('copy files array length', copy_files_arr.length, 'data', data)

                    // CREATE MOVE DIALOG
                    // todo: this needs to determin if we need createmove or createmoveoverwrite
                    // or can they be combined?
                    if (fs.existsSync(path.join(data.destination, path.basename(data.source)))) {
                        createOverwriteMoveDialog(data,copy_files_arr);
                    } else {
                        createMoveDialog(data, copy_files_arr);
                    }

                }

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

    })

    // OVERWRITE MOVE CONFIRMED ALL
    ipcMain.on('overwrite_move_confirmed_all', (e) => {

        console.log('overwrite move confirmed all')

        confirm.hide()

        // SET SIZE FOR PROGRESS
        let max = 0;
        copy_files_arr.forEach(item => {
            max += parseInt(item.size)
        })

        // SHOW PROGRESS
        win.webContents.send('progress', max);

        let state = data.state

        // SET STATE TO 1 IF PASTE
        // let state = data.state
        if (state == 2) {
            state = 1;
        }

        // COPY FILES
        copy_files_arr.forEach((data, idx) => {
            console.log(data.source);

            // DIRECTORY - todo: needs work
            if (fs.statSync(data.source).isDirectory()) {

                copyFolderRecursiveSync(data.source, data.destination, data.state, () => {

                    // delete_file(data.source, () => {})

                })


            // FILES - done
            } else {

                // state = 0
                copyFileSync(data.source, data.destination, data.state, () => {

                    copy_files_arr.forEach(data => {
                        delete_file(data.source, () => {
                            win.send('remove_card', data.source);
                        })
                    })

                })

            }
        })

    })

    // OVERWRITE MOVE SKIP - done
    ipcMain.on('overwrite_move_skip', (e) => {

        console.log('overwrite move skip')
        confirm.hide()

        // REMOVE ITEM FROM ARRAY
        copy_files_arr.shift()

        if (copy_files_arr.length > 0) {

            data = {
                state: 0,
                source: copy_files_arr[0].source,
                destination: copy_files_arr[0].destination
            }

            console.log('copy files array length', copy_files_arr.length, 'data', data)

            if (fs.existsSync(path.join(data.destination, path.basename(data.source)))) {
                createOverwriteMoveDialog(data,copy_files_arr);
            } else {
                createMoveDialog(data, copy_files_arr);
            }

            // if (data.source == destination) {

            // }

            // createMoveDialog(data, copy_files_arr);

        }

    })

    // OVERWRITE MOVE CANCELED ALL - done
    ipcMain.on('overwrite_move_canceled_all', (e) => {
        console.log('overwrite_move_canceled_all');
        confirm.hide();
        copy_files_arr = [];
    })

    // OVERWRITE CANCELED - done
    ipcMain.on('overwrite_move_canceled', (e) => {

        console.log('overwrite_move_canceled');
        confirm.hide();
        copy_files_arr = [];

    })


    // windows.add(confirm)
    // console.log(windows)

}

// FILE PROPERTIES WINDOW
function createPropertiesWindow(filename) {

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
            // nativeWindowOpen: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    // LOAD INDEX FILE
    win.loadFile('src/properties.html')


    win.once('ready-to-show', () => {

        win.title = path.basename(filename)
        win.removeMenu()
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
            name: name,
            parent_folder: parent_folder,
            type: type,
            contents: contents,
            size: size,
            accessed: accessed,
            modified: modified,
            created: created
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


// GET FILE PROPERTIES
ipcMain.on('get_file_properties', (e, filename) => {
    createPropertiesWindow(filename)
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

                // SEND FOLDER SIZE TO RENDERER
                let size = parseInt(res.replace('.', '') * 1024)
                e.sender.send('folder_size', {href: args.href, size: size})

            })

        }

    }


})


// GET DISK SPACE
// CREATE DF ARRAY
ipcMain.on('get_disk_space', (e, href) => {

    // console.log('directory ' + href.href)
    // if (href.href.indexOf('gvfs') === -1) {

        // RUN DISK FREE COMMAND
        let cmd = 'df "' + href.href + '"'
        let child = exec(cmd)

        // console.log(cmd)

        child.stdout.on("data", (res) => {

            // CREATE ARRAY FROM RESULT
            let disk_arr = res.split('\n')

            if (res.length > 0) {

                let df = []

                // CREATE OPTIONS OBJECT
                let options = {
                    disksize: 0,
                    usedspace: 0,
                    availablespace:0,
                    foldersize:0,
                    foldercount:0,
                    filecount:0
                }

                let res1 = disk_arr[1].split(' ')

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

                    let size = parseInt(res.replace('.', '') * 1024)
                    size = get_file_size(size)

                    options.foldersize = size

                    options.foldercount = href.folder_count
                    options.filecount = href.file_count

                    df.push(options)

                    // SEND DISK SPACE
                    e.sender.send('disk_space', df)

                })

            }

        })

    // }
})



// ADD FILES TO COPY ARRAY
ipcMain.on('add_copy_files', function( e, data) {

    copy_files_arr = data

})


// SEND COPY FILES ARRAY
ipcMain.on('get_copy_files', (e, destination_folder) => {

    e.sender.send('copy_files', {copy_files_arr : copy_files_arr, destination_folder: destination_folder})

    // CLEAR COPY FILES ARRAY
    copy_files_arr = []

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

app.whenReady().then(() => {

    // globalShortcut.register('Escape', (e) => {
    //     console.log('Escape is pressed');
    //     let active_window = BrowserWindow.getFocusedWindow()
    //     active_window.hide()

    // });

    // webusb.addEventListener('connect', showDevices);
    // webusb.addEventListener('disconnect', showDevices);

    createWindow()

    // ACTIVATE EVENTS GO HERE?
    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

})

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
                e.sender.send('context-menu-command', 'open_templates_folder'
            ),
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
        label: 'Paste',
        accelerator: process.platform === 'darwin' ? 'CTRL+V' : 'CTRL+V',
        click: () => {
          e.sender.send('context-menu-command', 'paste')
        }
    },
    {
        label: 'Select all',
        click: () => {
          e.sender.send('context-menu-command', 'select_all')
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
      click:()=>{
        // createPropertiesWindow()
        e.sender.send('context-menu-command', 'props')
      }
    },
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
          label: 'New Folder',
          accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+N' : 'CTRL+SHIFT+N',
          click: () => {
              e.sender.send('context-menu-command', 'new_folder')
          }
      },
      {
        type: 'separator'
      },
      {
          label: 'Add to workspace',
          click: () => {
              e.sender.send('open')
          }
      },
      {
          type: 'separator'
      },
      {
        label: 'Cut',
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
            label: '&New Folder',
            accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+N' : 'CTRL+SHIFT+N',
            click: () => {
            e.sender.send('context-menu-command', 'new_folder')
            }
        },
        {
            label: 'Cut',
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
        label: '&Rename',
        accelerator: process.platform === 'darwin' ? 'F2' : 'F2',
        click: () => { e.sender.send('context-menu-command', 'rename') }
        },
        {
            type: 'separator'
        },
        {
        label: '&Extract',
        accelerator: process.platform === 'darwin' ? 'ALT+E' : 'ALT+E',
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
        // {
        //   label: 'Trash',
        //   click: () => {
        //     e.sender.send(
        //       'context-menu-command', 'trash_file'
        //     )
        //   }
        // },
        // {
        //   type: 'separator'
        // },
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