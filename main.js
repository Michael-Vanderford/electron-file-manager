const { app, globalShortcut, Notification, BrowserWindow, Menu, screen, dialog, accelerator, WebContents, webContents, MenuItem, ipcRenderer} = require('electron')
const { exec, execSync, spawn, execFileSync } = require("child_process");
const util                  = require('util')
const exec1                 = util.promisify(require('child_process').exec)
const path                  = require('path')
const fs                    = require('fs')
const ipcMain               = require('electron').ipcMain
const nativeTheme           = require('electron').nativeTheme
const nativeImage           = require('electron').nativeImage
const shell                 = require('electron').shell
const move_windows          = new Set()
const window                = require('electron').BrowserWindow;
const windows               = new Set()
const { clipboard }         = require('electron')
const os                    = require('os')
const gio                   = require('./utils/gio')


let copy_files_arr          = [];
let canceled                = 0;
let isMainView              = 1;
let window_id               = 0;
let window_id0              = 0;
let recursive               = 0;
let recursive0              = 0;
let file_count_recursive    = 0;
let folder_count_recursive  = 0;
let active_folder           = '';
let destination0            = '';
let active_window           = '';
let current_directory       = '';
let destination_folder      = '';

app.disableHardwareAcceleration();

ipcMain.on('connect', (e) => {
    createConnectDialog();
})

// Network connect dialog
function createConnectDialog() {

    let bounds = active_window.getBounds()

    let x = bounds.x + parseInt((bounds.width - 550) / 2);
    let y = bounds.y + parseInt((bounds.height - 350) / 2);


    let connect = new BrowserWindow({
        parent: window.getFocusedWindow(),
        width: 550,
        height: 350,
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

    connect.loadFile('src/connect.html')
    // connect.webContents.openDevTools()

    // SHOW DIALG
    connect.once('ready-to-show', () => {
        let title = 'Connect to server'
        connect.title = title
        connect.removeMenu()
        connect.send('connect')
    })

}

// Settings
let settings_file = path.join(app.getPath('userData'), 'settings.json');
if (!fs.existsSync(settings_file)) {
    let data = {
        window: {
            length: 1400,
            width: 700,
            x: 0,
            y: 0
        },
        display: {
            "Icon Caption": {
                None: "None",
                Size: "Size"
            }
        },
        keyboard_shortcuts: {
            Backspace: "Backspace",
            ShowWorkspace: "Alt+W",
            ShowSidebar: "Ctrl+B",
            ShowDevices: "Ctrl+D",
            ShowSettings: "",
            Find: "Ctrl+F",
            Down: "Down",
            Up: "Up",
            Left: "Left",
            Right: "Right",
            Rename: "F2",
            Cut: "Ctrl+X",
            Copy: "Ctrl+C",
            Paste: "Ctrl+V",
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

let thumbnails_dir  = path.join(app.getPath('userData'), 'thumbnails')
if (!fs.existsSync(thumbnails_dir)) {
    fs.mkdirSync(thumbnails_dir)
}

ipcMain.on('get_devices', (e) => {
    active_window.send('get_devices')
})

ipcMain.handle('image_to_clipboard', (e, href) => {
    const image = nativeImage.createFromPath(href)
    return image
})

ipcMain.handle('username', (e) => {
    return os.userInfo().username;
})

ipcMain.handle('userdata_dir', (e) => {
    return app.getPath('userData');
})

ipcMain.handle('get_thumbnails_directory', async (e) => {
    return thumbnails_dir;
})

ipcMain.on('cancel', (e) => {
    canceled = 1;
})

ipcMain.on('delete_file', (e, file) => {
    delete_file(file, () => {});
})

ipcMain.on('open_file', (e) => {

})

ipcMain.on('is_main_view', (e, state = 0) => {
    isMainView = state;
})

ipcMain.on('active_window', (e) => {

    window_id0 = window_id
    window_id = e.sender.id;

    if (window_id != window_id0) {
        active_window = window.fromId(window_id);
    }
})

ipcMain.on('active_folder', (e, href, state = 0) => {

    /* Get active window */
    let window_id = e.sender.id;
    active_window = window.fromId(window_id);

    // if (href == destination || href == active_folder) {
        // console.log('setting active folder', href, isMainView)
        active_folder = href;
        isMainView  = state;

    // } else {
        // active_folder = href
    // }

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

ipcMain.on('current_directory', (e, directory) => {

    if (directory != current_directory) {
        current_directory = directory;
    }

})

ipcMain.on('add_system_notification', (e, title, body) => {
    AddSysNotification(title, body);
})

ipcMain.on('destination_folder', (e, directory) => {
    destination_folder = directory;
})

function formatDate(date) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

let fsr = 1;
function get_folder_size_recursive (href) {
    gio.get_dir(href, dirents => {
        let size = 0;
        dirents.forEach(file => {
            if (file.is_dir) {
                let next_dir = file.href
                console.log(next_dir)
                get_folder_size_recursive(next_dir)
                ++fsr
            } else {
                size += parseInt(file.size)
            }


        })

        if (--fsr == 0) {
           console.log(get_file_size(size))
        }

        // console.log(fsr)



    })
}

/**
 * I dont think this is being used
 * Get folder size. Runs du -Hs command
 * @param {string} href
 */
function get_folder_size(href) {
    try {
        cmd = "cd '" + href + "'; du -Hs"
        du = exec(cmd)
        du.stdout.on('data', function (res) {
            let size = parseInt(res.replace('.', '') * 1024)
            active_window.send('folder_size', {href: href, size: size})
        })
    } catch (err) {
        // active_window.send('notification', err)
    }
}

/**
 * Get folder size. Runs du -Hs command
 * @param {string} href
 */
function get_folder_size1(href) {
    // cmd = "cd '" + href + "'; du -Hs"
    // du = exec(cmd)
    // du.stdout.on('data', function (res) {
    //     let size = parseInt(res.replace('.', '') * 1024)
    //     active_window.send('folder_size', {href: href, size: size})
    // })
    // du.stderr
    try {
        cmd = "cd '" + href.replace("'", "''") + "'; du -Hs";
        const {err, stdout, stderr } = exec1(cmd);
        return stdout;
    } catch (err) {
        active_window.send('notification', err)
        return 0
    }

}

function AddSysNotification (title, body) {
    new Notification({ title: title, body: body}).show()
}

function isGioFile(href) {
    if (href.indexOf('smb:') > -1 || href.indexOf('sftp:') > -1 || href.indexOf('mtp:') > -1) {
        return 1
    } else {
        return 0
    }
}

let do_copy_arr = []
let source_base = ""
let do_copy_counter = 0;
function do_copy(source, destination, copystate, callback) {

    if (copystate == 0) {

        // // Get size for progress
        let max = 0;
        copy_files_arr.forEach(item => {
            max += parseInt(item.size);
        })

        // // Show progress
        // active_window.send('progress', max, destination);

        source_base = source
        if (destination.indexOf('smb') > -1 || destination.indexOf('sftp') > -1 || destination.indexOf('mtp') > -1) {
            exec1(`gio mkdir "${destination}"`)
        } else {
            fs.mkdirSync(destination)
        }

        if (isMainView) {
            let file_obj = {
                name: path.basename(destination),
                href: destination,
                mtime: new Date(),
                is_dir: 1
            }
            active_window.send('get_card', file_obj)

        }

        copystate = 1;

        // let file_arr_obj = {source: source, destination: destination, is_dir: 1}
        // do_copy_arr.push(file_arr_obj)

    }

    // init
    if (copystate == 1) {


        gio.get_dir(source, files => {

            files.forEach(file => {

                let cursource = path.join(source, file.name)
                let curdestination = ''

                if (file.is_dir) {
                    curdestination = path.join(destination, path.basename(cursource))

                    if (!fs.existsSync(curdestination)) {

                        gio.mkdir(curdestination, (res) => {
                            if(res.err) {
                                console.log(res.err)
                            }
                        })

                        let file_arr_obj = {source: cursource, destination: curdestination, is_dir: 1}
                        do_copy_arr.push(file_arr_obj)

                    }

                    do_copy(cursource, curdestination, copystate)

                } else {

                    curdestination = path.join(destination, path.basename(cursource))

                    if (isGioFile(cursource)) {

                        gio.cp(cursource, curdestination, (res) => {
                            if (res.err) {
                                console.log(res.err)
                            }
                        })

                    } else {

                        fs.copyFile(cursource, curdestination, (err) => {
                            if (err) {
                                active_window.send('notification', err)
                            } else {
                                // active_window.send('update_card1', destination)
                                get_folder_size1(destination)
                            }

                            ++do_copy_counter

                        })

                    }

                    // let file_arr_obj = {source: cursource, destination: curdestination, is_dir: 0}
                    // do_copy_arr.push(file_arr_obj)

                }

            })


            // console.log('do copy array', do_copy_arr)

            // do_copy_arr.forEach(item => {
                // console.log(item)
                // fs.copyFileSync(item.source, item.destination)
            // })

        })


        // fs.readdir(source, (err, files) => {

        //     if (!err) {

        //         files.forEach((file, idx) => {

        //             let cursource = path.join(source, file);
        //             let curdestination = '' //path.join(destination, source.substring(source_base.length, source.length), file)

        //             fs.lstat(cursource, (err, stats) => {

        //                 if (!err) {

        //                     if (stats.isDirectory()) {

        //                         curdestination = path.join(destination, path.basename(cursource))

        //                         if (!fs.existsSync(curdestination)) {

        //                             gio.mkdir(curdestination, (res) => {
        //                                 if(res.err) {
        //                                     console.log(res.err)
        //                                 }
        //                             })

        //                             let file_arr_obj = {source: cursource, destination: curdestination, is_dir: 1}
        //                             do_copy_arr.push(file_arr_obj)

        //                         }

        //                         // let file_arr_obj = {source: cursource, destination: curdestination, is_dir: 0}
        //                         // do_copy_arr.push(file_arr_obj)

        //                         do_copy(cursource, curdestination, copystate)

        //                     } else {

        //                         curdestination = path.join(destination, path.basename(cursource))

        //                         if (isGioFile(cursource)) {

        //                             gio.cp(cursource, curdestination, (res) => {
        //                                 if (res.err) {
        //                                     console.log(res.err)
        //                                 }
        //                             })

        //                         } else {

        //                             fs.copyFile(cursource, curdestination, (err) => {
        //                                 if (err) {
        //                                     active_window.send('notification', err)
        //                                 }

        //                             })

        //                         }

        //                         let file_arr_obj = {source: cursource, destination: curdestination, is_dir: 0}
        //                         do_copy_arr.push(file_arr_obj)



        //                         // exec1(`cp "${cursource}" "${curdestination}`).then(res => {
        //                         // })
        //                     }

        //                 } else {
        //                     active_window.send('notification', err)
        //                 }

        //                 // Process done
        //                 if (idx == files.length - 1) {
        //                     // get_folder_size(path.dirname(destination)) // update the size on the primary folder
        //                     active_window.send('update_card1', destination)
        //                 }

        //             })

        //             // console.log(do_copy_arr)

        //         })


        //     } else {
        //         active_window.send('notification', err)
        //     }

        // })

    }

}

/**
 *
 * @param {string} source
 * @param {string} target
 * @param {int} state
 * @param {*} callback
 */
function copyfile(source, target, callback) {

    // active_window.send('set_progress_msg', `Moving File ${path.basename(source)}`)

    // TARGET
    var targetfile = target;
    if (fs.existsSync(target)) {

        if (fs.lstatSync(target).isDirectory()) {
            targetfile = path.join(target, path.basename(source));
        }

    }



    if (isGioFile(targetfile)) {

        // todo: do error handling
        gio.cp(source, targetfile, (res) => {
            return callback(1)
        });

        // return callback(res)
        // gio.cp(source, targetfile, (res) => {

        //     if (res.stderr) {
        //         active_window.send('notification', res.sterr)
        //         return callback(res)
        //     } else {
        //         active_window.send('notification', res.stdout)
        //     }
        // })

    } else {

        fs.copyFile(source, targetfile, (err) => {

            if (!err) {
                return callback(1);
            } else {
                active_window.send('remove_card', targetfile)
                active_window.send('notification', err);
                return callback(err)
            }

        })

    }

}

/**
 * Copy folders recursive
 * @param {sting} source
 * @param {string} destination
 * @param {int} state
 * @param {*} callback
 */
function copyfolder(source, destination, callback) {


    if (isGioFile(destination)) {

        gio.get_dir(source, (dirents) => {

            gio.mkdir(destination, (res) => {
                // active_window.send('notification', res)
                // console.log(res)
            })

            dirents.forEach(file => {

                let cursource = path.format({dir: source, base: file.name}) //source + file.name //path.join(source, file.name)
                let curdestination = path.format({dir: destination, base: file.name}) //destination + file.name //path.join(destination, file.name)

                if (file.is_dir) {
                    copyfolder(cursource, curdestination, (res) => {
                        return callback(res)
                    });
                } else {
                    copyfile(cursource, curdestination, () => {
                        // get_folder_size1(active_folder)
                    })
                }

            })

            return callback(1)

        })

    } else {

        fs.readdir(source, (err, files) => {

            if (!err) {

                // Check length
                // if (files.length > 0) {

                if (isGioFile(destination)) {

                    gio.mkdir(destination, (res) => {

                    })

                } else {

                    if (!fs.existsSync(destination)) {
                        fs.mkdirSync(destination)
                    }

                }

                    // Loop over files
                    files.forEach((file, idx) => {

                        let cursource = path.join(source, file)
                        let curdestination = path.join(destination, file)

                        fs.stat(cursource, (err, stats) => {

                            if (!err) {

                                // Directory
                                if (stats.isDirectory()) {

                                    copyfolder(cursource, curdestination, () => {



                                    });

                                // Copy files
                                // } else if (stats.isFile() == true) {
                                } else {

                                    copyfile(cursource, curdestination, () => {
                                        // get_folder_size1(active_folder)
                                    })

                                }

                            } else {
                                active_window.send('notification', err)
                            }
                        })
                    })

                // }

                return callback(1)

            } else {
                active_window.send('notification', err)
                return callback(err)
            }



        })

    }

    // } catch (err) {
    //     active_window.send('notification', err)
    // }
}

// Add files to copy array
ipcMain.on('add_copy_files', function( e, data) {

    copy_files_arr = data;
    e.sender.send('clear_copy_arr');

})

// todo: remove old copy file array reference from preload
ipcMain.on('copy', (e) => {
    copy();
})


// Copy
let size = 0;
function copy() {

    // SET SIZE FOR PROGRESS
    // let max = 0;
    // copy_files_arr.forEach(item => {
    //     max += parseInt(item.size)
    // })

    // // SHOW PROGRESS
    // active_window.send('progress', max);

    let source0 = "";
    let source = "";
    copy_files_arr.every((file, idx) => {

        console.log('copying file', file.href)

        source0 = source;
        source = file.href;
        let destination = path.format({dir: active_folder, base: path.basename(file.href)}) //`${active_folder}/${path.basename(file.href)}`

        // if (source != destination) { // trap
        if (copy_files_arr.length > 0) {

            if (!isGioFile(destination)) {

                // SET SIZE FOR PROGRESS
                let max = 0;
                copy_files_arr.forEach(item => {
                    max += parseInt(item.size)
                })

                // SHOW PROGRESS
                active_window.send('progress', max);

            }

            if (file.is_dir) {

                if (source == destination) {
                    destination = destination + ' Copy'
                }

                if (fs.existsSync(destination)) {

                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination
                    }

                    createConfirmDialog(data, copy_files_arr)
                    return false

                } else {
                    cp_gio_files(source, destination)
                    if (isMainView) {

                    } else {
                        console.log('what')
                        get_folder_size(active_folder);
                    }
                }


            } else {

                if (source == destination) {
                    let c = 0;
                    destination = `${active_folder}/${path.join(path.dirname(destination), path.basename(source).substring(0, path.basename(source).length - path.extname(source).length))}/Copy ${path.extname(source)}`;
                    while (fs.existsSync(destination)) {
                        destination = `${active_folder}/${path.basename(destination).replace(`(${c})`, `(${++c})`)}`
                        console.log(destination)
                    }
                    c = 0
                }

                if (fs.existsSync(destination)) {

                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination
                    }

                    createConfirmDialog(data, copy_files_arr);
                    return false

                } else {

                    if (isMainView) {

                        console.log('is main view')

                        let file_obj = {
                            name: path.basename(destination),
                            href: destination,
                            is_dir: 0,
                            ["time::modified"]: new Date / 1000,
                            size: 0
                        }

                        active_window.send('get_card', file_obj)

                    } else {
                        console.log('is not main view')
                    }


                    active_window.send('set_progress_msg', `Copying File ${path.basename(source)}`)
                    copyfile(source, destination, (res) => {
                        // Success
                        if (res) {

                            active_window.send('set_progress', copy_files_arr.length - 1, idx)

                            if (isMainView) {
                                active_window.send('update_card', destination)
                                active_window.send('update_cards1', active_folder)
                            } else {
                                console.log(active_folder)
                                get_folder_size(active_folder)
                            }

                        } else {
                        }
                    })

                }

            }

        }

        return true

    })

    // copy_files_arr = []
    // // Get size of copy
    // copy_files_arr.forEach(file => {
    //     size += parseInt(file.size)
    // })

    // copy_files_arr.forEach(file => {

    //     let source = file.href

    //     let destination = ''
    //     if (isGioFile(active_folder)) {
    //         destination = `${active_folder}${path.basename(file.href)}`
    //     } else {
    //         destination = path.join(active_folder, path.basename(file.href))
    //     }

    //     // SET SIZE FOR PROGRESS
    //     let max = 0;
    //     copy_files_arr.forEach(item => {
    //         max += parseInt(item.size)
    //     })

    //     // SHOW PROGRESS
    //     active_window.send('progress', max);

    //     if (file.is_dir) {

    //         if (source == destination) {
    //             destination = destination + ' Copy'
    //         }

    //         if (fs.existsSync(destination)) {

    //             let data = {
    //                 source: source,
    //                 destination: destination
    //             }

    //             createConfirmDialog(data, copy_files_arr)
    //             // return false;

    //         } else {

    //             copyfolder(source, destination, (res) => {

    //                 if (res) {

    //                     if (isMainView) {

    //                         let file_obj = {
    //                             name: path.basename(destination),
    //                             href: destination,
    //                             is_dir: 1,
    //                             mtime: new Date() / 1000,
    //                             size: 0
    //                         }
    //                         active_window.send('get_card', file_obj)
    //                         active_window.send('update_card1', destination)
    //                         get_folder_size1(destination)

    //                     } else {
    //                         get_folder_size1(active_folder)
    //                     }

    //                 }

    //                 // copy_files_arr.shift()
    //                 // return true

    //             })

    //         }

    //     } else {

    //         if (source == destination) {
    //             destination = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(source).length) + ' Copy' + path.extname(source));
    //         }

    //         if (fs.existsSync(destination)) {

    //             // CREATE CONFIRM COPY OVERWRITE
    //             let data = {
    //                 source: source,
    //                 destination: destination
    //             }

    //             createConfirmDialog(data, copy_files_arr);
    //             // return false;

    //         } else {

    //             if (isMainView) {

    //                 let file_obj = {
    //                     name: path.basename(destination),
    //                     href: destination,
    //                     is_dir: 0,
    //                     mtime: new Date(),
    //                     size: 0,
    //                     ext: path.extname(destination)
    //                 }

    //                 active_window.send('get_card', file_obj)

    //                 let c = 0;
    //                 let intervalid = setInterval(() => {
    //                     gio.get_file(destination, file => {

    //                         if (file.size === file.size) {
    //                             ++c
    //                         } else {
    //                             c = 0
    //                         }

    //                         if (c > 20) {
    //                             c = 0
    //                             clearInterval(intervalid)
    //                         }

    //                         active_window.send('folder_size', {href: destination, size: parseInt(file.size)})
    //                     })
    //                 }, 1000);
    //                 // active_window.send('folder_size', {href: file.href, size: file.size})

    //             }

    //             copyfile(source, destination, (res) => {

    //                 if (res) {

    //                     if (isMainView) {
    //                         active_window.send('update_card1', destination)
    //                     } else {
    //                         get_folder_size1(active_folder)
    //                     }

    //                 } else {
    //                     active_window.send('notification', res)
    //                 }

    //                 // return true

    //             })

    //         }


    //     }

    // })

    // tmp_copy_arr = []


    // active_window.send('notification', 'Done copying file/s')

    // copy_files_arr.every((item, idx) => {

    //     try {

    //         let source = item.source;
    //         let source_stats = fs.statSync(source)
    //         let destination_file = path.join(destination, path.basename(source))

    //         // DIRECTORY - Done
    //         if (source_stats.isDirectory()) {
    //             let options = {
    //                 id: 0,
    //                 href: destination_file,
    //                 linktext: path.basename(destination_file),
    //                 is_folder: 1,
    //                 grid: ''
    //             }

    //             if (source == destination_file) {

    //                 // GET SIZE FOR PROGRESS
    //                 let max = 0;
    //                 copy_files_arr.forEach(item => {
    //                     max += parseInt(item.size);
    //                     // console.log(item.size)
    //                 })

    //                 // SHOW PROGRESS
    //                 active_window.send('progress', max);

    //                 // BUILD DESTINATION PATH
    //                 destination_file = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(path.basename(source)).length)) + ' Copy'
    //                 destination_folder = destination_file

    //                 copyfolder(source, destination_file, () => {

    //                     if (isMainView) {

    //                         // let options = {
    //                         //     href: destination_file,
    //                         //     linktext: path.basename(destination_file),
    //                         //     is_folder: true
    //                         // }
    //                         // active_window.send('add_card', options)
    //                     }

    //                     copy_files_arr.shift()
    //                     copy()

    //                 })

    //                 options.href = destination_file
    //                 options.linktext = path.basename(destination_file)

    //                 return true

    //             } else {

    //                 // Overwrite directory
    //                 if (fs.existsSync(destination_file)) {

    //                     let data = {
    //                         source: source,
    //                         destination: destination_file
    //                     }

    //                     createConfirmDialog(data, copy_files_arr)
    //                     return false;

    //                 } else {

    //                     // Get progress size
    //                     let max = 0;
    //                     copy_files_arr.forEach(item => {
    //                         max += parseInt(item.size);
    //                     })

    //                     // Show progress
    //                     let win = window.getFocusedWindow();
    //                     win.webContents.send('progress', max, destination_file);

    //                     copyfolder(source, destination_file, destination_folder, () => {

    //                         if (isMainView) {

    //                             // let options = {
    //                             //     href: destination_file,
    //                             //     linktext: path.basename(destination_file),
    //                             //     is_folder: true
    //                             // }

    //                             // active_window.send('add_card', options)

    //                         }

    //                         copy_files_arr.shift()
    //                         copy()

    //                     })

    //                     return false;
    //                 }
    //             }

    //         // FILES
    //         } else {

    //             // APPEND COPY TO FILENAME IF SAME
    //             if (path.dirname(source) == destination) {

    //                 // CREATE NEW FILE NAME
    //                 let c = 0;
    //                 destination_file = path.join(destination, path.basename(source).substring(0, path.basename(source).length - path.extname(source).length) + ' Copy' + path.extname(source));

    //                 // COPY FILE
    //                 state = 1;
    //                 copyfile(source, destination_file, () => {

    //                     // let options = {
    //                     //     id: 0,
    //                     //     href: destination_file,
    //                     //     linktext: path.basename(destination_file),
    //                     //     is_folder: 0,
    //                     //     grid: ''
    //                     // }

    //                     // active_window.send('add_card', options)


    //                     copy_files_arr.shift();
    //                     copy();
    //                     return true;

    //                 })

    //             } else {

    //                 // IF DESTINATION EXISTS
    //                 if (fs.existsSync(destination_file)) {

    //                     // CREATE CONFIRM COPY OVERWRITE
    //                     let data = {
    //                         source: source,
    //                         destination: destination_file
    //                     }

    //                     createConfirmDialog(data, copy_files_arr);
    //                     return false;

    //                 } else {

    //                     // GET SIZE FOR PROGRESS
    //                     let max = 0;
    //                     copy_files_arr.forEach(item => {
    //                         max += parseInt(item.size);
    //                     })

    //                     // SHOW PROGRESS
    //                     active_window.send('progress', max, destination_file);
    //                     active_window.send('notification', 'Copying File ' + destination_file)

    //                     if (isMainView) {

    //                         // let options = {
    //                         //     id: 0,
    //                         //     href: destination_file,
    //                         //     linktext: path.basename(destination_file),
    //                         //     is_folder: false,
    //                         //     grid: ''
    //                         // }

    //                         // active_window.send('add_card', options)

    //                     }

    //                     copyfile(source, destination_file, () => {
    //                         active_window.send('notification', 'Done Copying File')
    //                     });

    //                     copy_files_arr.shift();
    //                     copy();
    //                     return true;

    //                 }

    //             }

    //         }

    //     } catch (err) {
    //         active_window.send('notification', err);
    //     }

    // })

    // return true


}

async function get_file_count_recursive(href) {
    let dirents = fs.readdirSync(href)
    ++recursive;
    try {
        let files = dirents.filter(item => !fs.statSync(path.join(href, item)).isDirectory())
        file_count_recursive += files.length
        return file_count_recursive;
    } catch (err) {

    }

}

async function get_folder_count_recursive(href) {

    let dirents = fs.readdirSync(href)
    try {
        let folders = dirents.filter(item => fs.statSync(path.join(href, item)).isDirectory())
        folders.forEach((folder, idx) => {
            let cursource = path.join(href, folder)
            get_folder_count_recursive(cursource)
            ++folder_count_recursive;
            if (fs.statSync(cursource).isDirectory()) {
                get_file_count_recursive(cursource);
            }
        })

        return folder_count_recursive;

    } catch (err) {

    }
}

ipcMain.handle('get_folder_count_recursive', async (e, href) => {
    folder_count_recursive = 0;
    file_count_recursive = 0;
    return await get_folder_count_recursive(href);
})

ipcMain.handle('get_file_count_recursive', async (e, href) => {
    return await get_file_count_recursive(href);
})

function get_file_properties(filename) {

    // gio.get_file(filename, file => {

    //     folder_count_recursive  = 0;
    //     file_count_recursive    = 0;

    //     let name            = filename;
    //     let parent_folder   = path.basename(path.dirname(filename));
    //     let type            = file.type;
    //     let size            = '';
    //     let accessed        = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(file['time::access']);
    //     let created         = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.birthtime);
    //     let modified        = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime);
    //     let mode            = stats.mode;
    //     let group           = stats.uid;
    //     let contents        = '';

    // })



    let stats           = fs.statSync(filename)
    let cmd          = "xdg-mime query filetype '" + filename + "'"
    let exec_mime       = execSync(cmd).toString()


    folder_count_recursive  = 0;
    file_count_recursive    = 0;

    // BUILD PROPERTIES
    let name            = filename;
    let parent_folder   = path.basename(path.dirname(filename));
    let type            = exec_mime;
    let size            = '';
    let accessed        = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.atime);
    let created         = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.birthtime);
    let modified        = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime);
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

    active_window.send('file_properties', file_properties);
}

/**
 * Get disk space and send back to preload
 * @param {string} href
 */
async function get_disk_space(href) {

    // console.log('running get disk space')

    if (href.href.indexOf('smb:') > -1 || href.href.indexOf('sftp:') > -1 || href.href.indexOf('mtp:') > -1) {

        active_window.send('du_folder_size', 0)

    } else {

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

    }


}

/**
 * Get disk space summary
 */
function get_diskspace_summary() {
    get_disk_space({href: '/'}, (res) => {
    });
}

/**
 * Get File Information from GIO (gvfs)
 * @param {*} href
 */
get_file1 = async (href, callback) => {

    file_obj = {}
    await exec1(`gio info "${href}"`).then(res => {

        if (!res.stderr) {

            let files = res.stdout.split('\n').map(p => p.trim().split(': '))

            file_obj.href = href
            file_obj.name = path.basename(href)

            files.forEach(item => {
                file_obj[item[0]] = item[1]
                if (file_obj["time::changed"]) {
                    file_obj.mtime = file_obj["time::changed"]
                }
            })

            // console.log(file_obj)
            return res.stdout;

        } else {
            return res.stderr
        }

    })


    // file_obj = {}
    // await exec1(`gio info "${href}"`, (err, stdout, stderr) => {
    //     if (!err) {
    //         let files = stdout.split('\n').map(p => p.trim().split(': '))
    //         file_obj.href = href
    //         file_obj.name = path.basename(href)
    //         files.forEach(item => {
    //             file_obj[item[0]] = item[1]
    //             if (file_obj["time::changed"]) {
    //                 file_obj.mtime = file_obj["time::changed"]
    //             }
    //         })
    //         // file_arr = dirents;
    //     } else {
    //         return (err)
    //     }
    // }).then(res => {
    //     return file_obj
    // })

}

let copy_arr_folders = []
let copy_arr_files = []
let copy_arr_counter = 1
let copy_arr_counter1 = 1
/**
 * Copy GIO Files
 * @param {string} source
 */
async function cp_gio_files(source, destination) {

    // source = '/home/michael/Downloads/marsviewer
    // destination = 'sftp://michael@192.168.1.10/home/michael/share/marsviewer

    active_window.send('set_progress_msg', `Getting Files to Copy. ${path.basename(source)}`)

    copy_arr_folders.push({source: source, destination: destination})
    gio.mkdir(destination, (res) => {
        // console.log(res)
    })

    gio.get_dir(source, files => {
        files.forEach(file => {
            if (file.is_dir) {
                cp_gio_files(source + "/" + file.name, destination + '/' + file.name)
                ++copy_arr_counter;
            }
        })
        --copy_arr_counter;
        if (copy_arr_counter == 0) {
            let files_arr = []
            copy_arr_folders.forEach(folder => {
                gio.get_dir_async(folder.source, dirents => {
                    files_arr = dirents.filter(x => x.is_dir == 0)
                    // files_arr.forEach(file => {
                    // })
                }).then(() => {
                    // copy_arr_files.push({source:folder.source, destination: folder.destination})
                    files_arr.forEach(file => {
                        copy_arr_files.push({source:file.href, destination: folder.destination})
                    })
                }).then(() => {
                    if (++copy_arr_counter1 == copy_arr_folders.length + 1) {

                        copy_arr_files.sort((a,b) => {
                            return a.source.length - b.source.length
                        })

                        copy_arr_files.forEach((file, idx) => {

                            // active_window.send('notification', path.basename(file.source), path.basename(file.destination))
                            // try {
                            gio.cp(file.source, file.destination, (res) => {

                                active_window.send('set_progress_msg', `Copied File ${path.basename(file.source)}`)
                                active_window.send('set_progress', copy_arr_files.length - 1, idx)
                                if (copy_arr_files.length - 1 == idx) {

                                    console.log(copy_arr_folders.length)
                                    console.log(copy_arr_files.length)

                                    active_window.send('notification', `Copied ${copy_arr_folders.length} Folders and ${copy_arr_files.length} Files.`)

                                    gio.get_file(copy_arr_folders[0].destination, (file) => {
                                        file.is_dir = 1
                                        if (isMainView) {
                                            active_window.send('get_card', file);
                                        }
                                    })

                                    copy_arr_counter = 1;
                                    copy_arr_counter1 = 1;
                                    copy_arr_files = [];
                                    copy_arr_folders = [];
                                }

                            })

                        })


                    }
                })
            })
        }
    })
}

let del_file_arr = []
let del_folder_arr = []
let rec = 1;
let state = 0
async function rm_gio_files(href, callback) {

    if (state == 0) {
        del_folder_arr.push(href)
        state = 1;
    }

    gio.get_dir(href, dirents => {

        for (let i = 0; i < dirents.length; i++) {
            if (dirents[i].is_dir) {
                rm_gio_files(dirents[i].href)
                ++rec
                active_window.send('set_progress_msg', `Getting Folder ${path.basename(dirents[i].href)}`)
                del_folder_arr.push(dirents[i].href)
            } else {
                active_window.send('set_progress_msg', `Getting File ${path.basename(dirents[i].href)}`)
                del_file_arr.push(dirents[i])
            }
        }

        --rec
        if (rec == 0) {
            console.log('done', rec)

            for (let i = 0; i < del_file_arr.length; i++) {
                console.log('file', del_file_arr[i].href)
                gio.rm(del_file_arr[i].href, () => {
                    active_window.send('set_progress_msg', `Deleted File ${path.basename(del_file_arr[i].href)}`)
                    active_window.send('set_progress', del_file_arr.length - 1, i)
                })
            }

            del_folder_arr.sort((a,b) => {
                return b.length - a.length
            })

            for (let i = 0; i < del_folder_arr.length; i++) {
                console.log('rm folder', del_folder_arr[i])
                gio.rm(del_folder_arr[i], () => {
                    active_window.send('set_progress_msg', `Deleted Folder ${path.basename(del_folder_arr[i])}`)
                    active_window.send('set_progress', del_folder_arr.length - 1, i);
                })
            }

            if (isMainView) {
                active_window.send('remove_card', del_folder_arr[del_folder_arr.length - 1])
            }

            del_file_arr = []
            del_folder_arr = []
            state = 0
            rec = 1

            setImmediate(callback)

        }

    })

}

/**
 * Delete a file or folder from the filesystem
 * @param {string} href
 * @param {int} callback *
 */
async function delete_file(href, callback) {

    if (!isGioFile(href)) {

        fs.stat(href, (err, stats) => {

            if (!err) {
                /* Folder */
                if (stats.isDirectory()) {
                    fs.rm(href, {recursive: true}, (err) => {
                        if (err) {
                            active_window.send('notification', err)
                            callback(err)
                        } else {

                            try{

                                windows.forEach(win => {
                                    win.send('remove_card', href);
                                })

                            } catch (err) {
                                active_window.send('notification', err)
                                active_window.send('notification', err);
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
                    fs.unlink(href, err => {

                        if (err) {
                            active_window.send('notification', err)
                            console.log('error deleteing file', href);
                            callback(err);
                        } else {

                            try {
                                active_window.send('remove_card', href);
                            } catch (err) {
                                active_window.send('notification', err)
                                console.log('error deleting file', err)
                            }

                            // Update disk size
                            get_disk_space({href: current_directory}, (res) => {
                                active_window.send('disk_space', res)
                            });

                            callback(1);
                        }

                    })
                }

            } else {

                if (href.indexOf('smb') > -1 || href.indexOf('sftp') > -1) {

                    gio.rm(href, () => {})
                        // if (!res.stderr) {
                    active_window.send('remove_card', href);
                        // } else {
                            // active_window.send('notification', res.stderr)
                        // }
                    // })

                    // exec1(`gio remove -f "${file}"`).then(res => {
                    //     if (!res.stderr) {
                    //         active_window.send('remove_card', file);
                    //     } else {
                    //         active_window.send('notification', res)
                    //     }

                    // }).catch(err => {
                    //     active_window.send('notification', err)
                    // })
                }
            }

        })

    } else {
        gio.get_file(href, file => {
            if (file.type == 'directory') {
                rm_gio_files(href, () => {})
                // delete_gio_files(href)
                // active_window.send('notification','Error: Deleting Remote Directory is not Implemented')
            } else {
                gio.rm(href).then(() => {
                    if (isMainView) {
                        active_window.send('remove_card', href)
                    }
                })
            }
        })
    }



}

function clear_copy_arr() {
    copy_files_arr = []
}

/**
 *
 * @param {double} fileSizeInBytes
 * @returns String formated file size
 */
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

/**
 * Create main window
 */
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
        minWidth: 400,
        minHeight: 600,
        width: settings.window.width,
        height: settings.window.height,
        backgroundColor: '#2e2c29',
        x: settings.window.x,
        y: settings.window.y,
        frame: true,
        autoHideMenuBar: true,
        icon: path.join(__dirname,'/assets/icons/folder.png'),
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: true,
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

    windows.add(win);

};

app.whenReady().then(() => {
    createWindow();
})

nativeTheme.themeSource = 'dark'

ipcMain.handle('dir_size', async (e, href) => {

    let cmd = "du -s '" + href + "' | awk '{print $1}'";
    const {err, stdout, stderr } = await exec(cmd);
    stdout.on('data', (res) => {
        return res.replace('.','').trim();
    })
})

ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system'
})

ipcMain.on('copy_to_clipboard', (a, data) => {
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
    windows.delete(active_window)
    active_window.close();
})

// GO BACK
ipcMain.on('go_back', function(e, msg) {
    windows.forEach(win => {
        win.webContents.goBack()
    })
})

ipcMain.on('go_foward', (e) => {
    win.webContents.goFoward()
})

// On get icon path
ipcMain.on('get_icon_path', (e, href) => {
    get_icon_path(href)
})

// Get icon path
function get_icon_path(href) {

    app.getFileIcon(href).then(icon => {

        icon_path = icon.toDataURL()
        let data = {
            href: href,
            icon_path: icon_path
        }
        active_window.send('icon_path',data);

    }).catch((err) => {
        active_window.send('notification', err)
    })
}

ipcMain.handle('get_icon', async (e, href) => {

    try {
        const res = await app.getFileIcon(href);
        return res.toDataURL();
    } catch (err) {
        active_window.send('notification', err)
        return path.join(__dirname, 'assets/icons/kora/actions/scalable/gtk-file.svg');
    }
})

ipcMain.handle('get_thumbnail', async (e, href) => {
    const res = await nativeImage.createFromPath(href);
    return res;
})

// todo: remove
// // HANDLE DRAG START
// ipcMain.on('ondragstart', (e, href) => {
//     console.log('ahhhhh')
//     let icon_path = path.join(__dirname, '/assets/icons/file.png')
//     if (fs.statSync(href).isDirectory()) {
//         icon_path = path.join(__dirname,'/assets/icons/folder.png')
//     }
//     e.sender.startDrag({
//         file: href,
//         icon: icon_path //path.join(__dirname,'/assets/icons/folder.png')
//     })
// })



// SHOW COPY CONFIRM OVERWRITE DIALOG
ipcMain.on('show_confirm_dialog', (e, data) => {

    e.preventDefault()
    createConfirmDialog(data)

})

// CONFIRM COPY OVERWRITE DIALOG
// let confirm = null
function createConfirmDialog(data, copy_files_arr) {

    let win = window.getFocusedWindow();

    let bounds = active_window.getBounds()

    let x = bounds.x + parseInt((bounds.width - 500) / 2);
    let y = bounds.y + parseInt((bounds.height - 400) / 2);

    const confirm = new BrowserWindow({
        parent: win,
        modal:true,
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

        // confirm.removeMenu()
        confirm.show()

        // confirm.webContents.openDevTools()
        confirm.send('confirming_overwrite', data, copy_files_arr)

    })

}

// OVERWRITE COPY CONFIRMED ALL
ipcMain.on('overwrite_confirmed_all', (e, copy_files_arr) => {

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

        let source = data.href;
        let destination_file = path.join(active_folder, path.basename(source));

        // COPY DIRECTORY
        if (fs.statSync(source).isDirectory()) {

            copyfolder(source, destination_file, (res) => {

            })

        // COPY FILES - done
        } else {
            copyfile(source, destination_file, (res) => {

            })
        }
    })

    copy_files_arr = []

})

// OVERWRITE COPY CONFIRMED
ipcMain.on('overwrite_confirmed', (e, data) => {

    let destination_file = path.join(active_folder, path.basename(data.source))

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

        copyfolder(data.source, destination_file, () => {

            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift()

            if (copy_files_arr.length > 0) {
                copy()
            }

        })

    // COPY FILE - done
    } else {

        copyfile(data.source, destination_file, () => {

            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift()

            if (copy_files_arr.length > 0) {
                copy()
            }

        })
    }

})

// Overwrite copy skip - needs work
ipcMain.on('overwrite_skip', (e) => {

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
        copy();

    }

})

// OVERWRITE COPY CANCLED ALL - done
ipcMain.on('overwrite_canceled_all', (e) => {

    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide()
    copy_files_arr = []

})

// OVERWRITE COPY CANCLED - done
ipcMain.on('overwrite_canceled', (e) => {

    // HIDE
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide()

    // REMOVE ITEM FROM ARRAY
    copy_files_arr.shift()

    if (copy_files_arr.length > 0) {

        // RUN MAIN COPY FUNCTION
        copy();

    }

})

// MOVE DIALOG
function createMoveDialog(data, copy_files_arr) {

    let bounds = active_window.getBounds()

    let x = bounds.x + parseInt((bounds.width - 550) / 2);
    let y = bounds.y + parseInt((bounds.height - 275) / 2);

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
            nodeIntegration: true, // is default value after Electron v5
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
    move();
})

/**
 *
 * @returns
 */
function move() {

    console.log('running move')

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

    copy_files_arr.forEach((file, idx) => {

        let source = file.href
        let destination = path.join(active_folder, path.basename(file.href))

        if (source != destination) { // trap

            // // SET SIZE FOR PROGRESS
            // let max = 0;
            // copy_files_arr.forEach(item => {
            //     max += parseInt(item.size)
            // })

            // // SHOW PROGRESS
            // // let win = window.getFocusedWindow();
            // windows.forEach(win => {
            //     win.webContents.send('progress', max);
            // })

            if (file.is_dir) {

                if (fs.existsSync(destination)) {

                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination
                    }

                    createOverwriteMoveDialog(data, copy_files_arr)

                } else {

                    copyfolder(source, destination, (res) => {

                        if (res) {

                            // copy_files_arr.shift()
                            delete_file(source, () => {

                                if (isMainView) {

                                    let file_obj = {
                                        name: path.basename(destination),
                                        href: destination,
                                        is_dir: 1,
                                        mtime: new Date(),
                                        size: 0
                                    }
                                    active_window.send('get_card', file_obj)
                                    active_window.send('update_cards1', destination)

                                    get_folder_size1(destination)

                                } else {
                                    get_folder_size1(active_folder)
                                }

                            })

                        }

                    })

                }


            } else {

                if (fs.existsSync(destination)) {

                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination
                    }

                    createOverwriteMoveDialog(data, copy_files_arr)

                } else {

                    copyfile(source, destination, (res) => {

                        if (res) {

                            active_window.send('set_progress_msg', `Moving File ${path.basename(source)}`)

                            delete_file(source, (res) => {

                                if (isMainView) {

                                    let file_obj = {
                                        name: path.basename(destination),
                                        href: destination,
                                        is_dir: 0,
                                        mtime: new Date / 1000,
                                        size: 0
                                    }

                                    active_window.send('get_card', file_obj)
                                    active_window.send('update_cards1', active_folder)

                                } else {
                                    get_folder_size1(active_folder)
                                }

                            })

                        }

                    })

                }

            }

        } else {
            active_window.send('notification', 'Error: Operation not Permitted!')
        }


    })

    copy_files_arr = []
    copy_arr = []
    // console.log(tmp_copy_arr)
    // // DIRECTORY
    // if (fs.statSync(data.source).isDirectory()) {
    //     // state = 0
    //     copyfolder(data.source, data.destination, data.state, () => {

    //         try {

    //             if (fs.existsSync(data.destination)) {

    //                 delete_file(data.source, () => {

    //                     // REMOVE ITEM FROM ARRAY
    //                     copy_files_arr.shift()

    //                     if (copy_files_arr.length > 0) {
    //                         move();
    //                     }

    //                     active_window.send('update_card', data.destination)

    //                 })
    //             }
    //         } catch (err) {
    //             console.log('copy folder recursive error', err)
    //         }

    //     })


    // // FILES - done
    // } else {

    //     // state = 0
    //     copyfile(data.source, data.destination, (res) => {

    //         // REMOVE ITEM FROM ARRAY
    //         copy_files_arr.shift();
    //         delete_file(data.source, (res) => {

    //             if (isMainView) {

    //                 let options = {
    //                     id: 0,
    //                     href: data.destination,
    //                     linktext: path.basename(data.destination),
    //                     is_folder: false,
    //                     grid: ''
    //                 }

    //                 active_window.webContents.send('add_card', options);
    //                 active_window.send('update_card', data.destination)

    //             }

    //             move();

    //         })


    //     })

    // }

    // copy_files_arr.every((item, idx) => {

    //     let source = item.href
    //     let destination_file = path.join(active_folder, path.basename(source))

    //     if (source != destination_file) {

    //         // Directory
    //         if (item.is_dir) {

    //             let options = {
    //                 id: 0,
    //                 href: destination_file,
    //                 linktext: path.basename(destination_file),
    //                 grid: ''
    //             }

    //             if (source == destination_file) {

    //                 active_window.webContents.send('notification', 'select a different directory')

    //             } else {

    //                 if (fs.existsSync(destination_file)) {

    //                     // CREATE CONFIRM COPY OVERWRITE
    //                     let data = {
    //                         state: 0,
    //                         source: source,
    //                         destination: destination_file
    //                     }

    //                     createConfirmDialog(data, copy_files_arr)
    //                     return false;

    //                 } else {

    //                     let data = {
    //                         state: 0,
    //                         source: source,
    //                         destination: destination_file
    //                     }

    //                     // REMOVE ITEM FROM ARRAY
    //                     // copy_files_arr.splice(idx,1)

    //                     // CREATE MOVE DIALOG
    //                     createMoveDialog(data, copy_files_arr)

    //                     // EXIT LOOP
    //                     return false

    //                 }

    //             }

    //         // FILES
    //         } else {

    //             // APPEND COPY TO FILENAME IF SAME
    //             if (path.dirname(source) == destination_file) {

    //                 // CREATE NEW FILE NAME
    //                 destination_file = path.join(destination1, path.basename(source).substring(0, path.basename(source).length - path.extname(source).length) + ' Copy' + path.extname(source))

    //                 // COPY FILE
    //                 copyfile(source, destination_file, () => {})

    //             } else {

    //                 // CHECK IF FILE EXISTS
    //                 // CREATE OVERWRITE MOVE DIALOG
    //                 if (fs.existsSync(destination_file)) {

    //                     // CREATE CONFIRM COPY OVERWRITE
    //                     let data = {
    //                         source: source,
    //                         destination: destination_file
    //                     }

    //                     createOverwriteMoveDialog(data, copy_files_arr)

    //                 // CREATE MOVE DIALOG
    //                 } else {

    //                     let data = {
    //                         state: 0,
    //                         source: source,
    //                         destination: destination_file
    //                     }

    //                     // createMoveDialog(data, copy_files_arr);
    //                     return false;

    //                 }

    //             }

    //         }

    //         let confirm = BrowserWindow.getFocusedWindow()
    //         confirm.hide()

    //         // SET SIZE FOR PROGRESS
    //         let max = 0;
    //         copy_files_arr.forEach(item => {
    //             max += parseInt(item.size)
    //         })

    //         // SHOW PROGRESS
    //         // let win = window.getFocusedWindow();
    //         windows.forEach(win => {
    //             win.webContents.send('progress', max);
    //         })

    //         // DIRECTORY
    //         if (fs.statSync(data.source).isDirectory()) {
    //             // state = 0
    //             copyfolder(data.source, data.destination, data.state, () => {

    //                 try {

    //                     if (fs.existsSync(data.destination)) {

    //                         delete_file(data.source, () => {

    //                             // REMOVE ITEM FROM ARRAY
    //                             copy_files_arr.shift()

    //                             if (copy_files_arr.length > 0) {
    //                                 move();
    //                             }

    //                             active_window.send('update_card', data.destination)

    //                         })
    //                     }
    //                 } catch (err) {
    //                     console.log('copy folder recursive error', err)
    //                 }

    //             })


    //         // FILES - done
    //         } else {

    //             // state = 0
    //             copyfile(data.source, data.destination, (res) => {

    //                 // REMOVE ITEM FROM ARRAY
    //                 copy_files_arr.shift();
    //                 delete_file(data.source, (res) => {

    //                     if (isMainView) {

    //                         let options = {
    //                             id: 0,
    //                             href: data.destination,
    //                             linktext: path.basename(data.destination),
    //                             is_folder: false,
    //                             grid: ''
    //                         }

    //                         active_window.webContents.send('add_card', options);
    //                         active_window.send('update_card', data.destination)

    //                     }

    //                     move();

    //                 })


    //             })

    //         }


    //     } else {
    //         active_window.send('notification', 'destination already exists ' + destination_file);
    //     }

    // })

    // return true

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

            try {

                if (fs.existsSync(data.destination)) {

                    delete_file(data.source, () => {

                        // REMOVE ITEM FROM ARRAY
                        copy_files_arr.shift()

                        if (copy_files_arr.length > 0) {
                            move();
                        }

                        active_window.send('update_card', data.destination)

                    })
                }
            } catch (err) {
                console.log('copy folder recursive error', err)
            }

        })


    // FILES - done
    } else {

        // state = 0
        copyfile(data.source, data.destination, (res) => {

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
                    active_window.send('update_card1', data.destination)

                }

                move();

            })


        })

    }

})

// MOVE CONFIRMED ALL - done
ipcMain.on('move_confirmed_all', (e, data) => {

    // console.log(data)
    // console.log(copy_files_arr)

    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach(item => {
        max += parseInt(item.size)
    })

    // SHOW PROGRESS
    // windows.forEach(win => {
    active_window.send('progress', max);

    // COPY FILES
    copy_files_arr.forEach((file, idx) => {

        let destination_file = path.join(active_folder, path.basename(file.href));
        // console.log('destination', destination_file)

        // DIRECTORY
        // if (fs.statSync(file.href).isDirectory()) {
        if (file.is_dir) {

            // console.log('is dir')
            // console.log('ismainiew', isMainView)

            copyfolder(file.href, destination_file, () => {

                if (fs.existsSync(destination_file)) {

                    delete_file(file.href, () => {

                        if (isMainView) {
                            // console.log('is main view', isMainView)
                            active_window.send('get_card', file)
                        } else {
                            // console.log('is not main view', isMainView)
                            active_window.send('remove_card', file.href);
                            get_folder_size(active_folder)
                        }

                    })

                }

            })

        // FILES
        } else {

            // state = 0
            copyfile(file.href, destination_file, () => {

                if (fs.existsSync(destination_file)) {

                    delete_file(file.href, () => {

                        if (isMainView) {
                            active_window.send('get_card', file)
                        } else {
                            active_window.send('remove_card', file.href);
                            get_folder_size(active_folder)
                        }

                    });

                }

            })

        }
    })

    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide()

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

    e.preventDefault()
    createOverwriteMoveDialog(data)

})

// CONFIRM OVERWRITE FOR MOVE DIALOG
// let confirm = ''
function createOverwriteMoveDialog(data, copy_files_arr) {

    let bounds = active_window.getBounds()

    let x = bounds.x + parseInt((bounds.width - 550) / 2);
    let y = bounds.y + parseInt((bounds.height - 350) / 2);

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
            nodeIntegration: true, // is default value after Electron v5
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

}

// OVERWRITE MOVE CONFIRMED ALL
ipcMain.on('overwrite_move_confirmed', (e, data) => {

    let confirm = window.getFocusedWindow();
    confirm.hide();

    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach(item => {
        max += parseInt(item.size)
    })

    active_window.send('progress', max);

    let source = data.source
    let destination_file = path.join(active_folder, path.basename(source));

    // DIRECTORY - todo: needs work
    if (fs.statSync(source).isDirectory()) {

        copyfolder(source, destination_file, (res) => {

            if (res) {
                delete_file(source, (res) => {
                    active_window.send('remove-card', source)
                })
                active_window.send('update_card', destination_file)
            }

        })

    // FILES - done
    } else {

        // state = 0
        copyfile(source, destination_file, (res) => {

            if (res) {

                copy_files_arr.forEach(file => {
                    delete_file(file.href, () => {
                        active_window.send('remove-card', file.href)
                    })
                })

            }


            active_window.send('update_card', destination_file)

        })

    }


})

// OVERWRITE MOVE CONFIRMED ALL
ipcMain.on('overwrite_move_confirmed_all', (e) => {

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

        let destination_file = path.join(active_folder, path.basename(data.source));

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
            copyfile(data.source, destination_file, () => {

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

    let confirm = window.getFocusedWindow();
    confirm.hide();
    copy_files_arr = [];

})

// OVERWRITE CANCELED - done
ipcMain.on('overwrite_move_canceled', (e) => {

    let confirm = window.getFocusedWindow();
    confirm.hide();
    copy_files_arr = [];

})

// Create Delete Dialog
function createDeleteDialog(delete_files_arr) {

    let bounds = active_window.getBounds()

    let x = bounds.x + parseInt((bounds.width - 400) / 2);
    let y = bounds.y + parseInt((bounds.height - 250) / 2);

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
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'preload.js'),
        },

    })

    // confirm.center()

    // LOAD FILE
    confirm.loadFile('src/confirm_delete.html')

    // SHOW DIALG
    confirm.once('ready-to-show', () => {

        let title = 'Confirm Delete'
        confirm.title = title
        confirm.removeMenu()

        confirm.send('confirm_delete', delete_files_arr)
        delete_files_arr = []

    })

}

ipcMain.on('delete_confirmed', (e, delete_files_arr) => {
    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide()
    delete_files_arr.forEach(item => {

        // delete_file(item.source)
        delete_file(item.source)

        // delete_file(item.source, () => {
        //     active_window.send('remove_card', item.source)
        // })
    })
})

ipcMain.on('delete_canceled', (e) => {
    let confirm = BrowserWindow.getFocusedWindow()
    confirm.hide()
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
            nodeIntegration: true, // is default value after Electron v5
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
            let created = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.birthtime)
            let modified = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)

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

            win.send('file_properties', file_properties)
            // win.webContents.openDevTools()

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

    // GET DATA FROM COMMAND
    // let output = ''
    gio_device.stdout.setEncoding('utf8')
    gio_device.stdout.on('data', (data) => {

        // e.sender.send('gio_devices', data)
        output = output + data

    })

    gio_device.stderr.on('data', function (res) {
        e.sender.send('gio_devices', res)
    })

    gio_device.on('exit', (data) => {
        e.sender.send('gio_devices', output)
    })


})

// MOUNT GIO DEVICE
ipcMain.on('mount_gio', (e, data) => {

    let uuid = data.uuid
    let cmd = "gio mount " + uuid
    let mount_gio = exec(cmd)

    mount_gio.stdout.on('data', (res) => {
        e.sender.send('gio_mounted', res)
    })

    mount_gio.stderr.on('data', (res) => {
        e.sender.send('gio_mounted', res)
    })

    mount_gio.on('exit', (code) => {
    })

})

// MONITOR GIO DEVICES
ipcMain.on('monitor_gio', (e, data) => {

    let cmd = 'gio mount -o'
    let monitor_gio = exec(cmd)

    //
    monitor_gio.stdout.on('data', (res) => {
        e.sender.send('gio_monitor', res)
    })

    monitor_gio.stderr.on('data', (res) => {
        e.sender.send('gio_monitor', res)
    })

})

// LIST FILES USING GIO
ipcMain.on('get_gio_files', (e, data) => {

    let files = exec('gio list ' + data)

    // STDOUT
    files.stdout.on('data', (res) => {
        e.sender.send('gio_files', {res, data})
    })

    // S
    files.stderr.on('data', (data) => {
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

    e.sender.send('uncompressed_size', size)

})

// GET FILES
ipcMain.on('get_files', (e, dir) => {
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
    get_folder_size(args.href);
})

// GET FOLDER SIZE
ipcMain.handle('get_folder_size1', async (e , href) => {

    // get_folder_size_recursive(href)

    try {
        cmd = "cd '" + href.replace("'", "''") + "'; du -Hs";
        const {err, stdout, stderr } = await exec1(cmd);
        return stdout;
    } catch (err) {
        return 0
        // active_window.send('notification', err)
    }

    // stdout.on('data', (res) => {
    //      res //parseInt(res.replace('.', '') * 1024)
    // })
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
            nodeIntegration: true, // is default value after Electron v5
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
//   active_window.send('notification', err);
})

/* Header Menu */
const template = [
    {
        label: 'File',
        submenu : [
            {
                label: 'New Window',
                click: () => {
                    active_window.send('context-menu-command', 'open_in_new_window')
                }
            },
            {type: 'separator'},
            {
                label: 'Create New Folder',
                click: () => {
                    active_window.send('new_folder')
                }
            },
            {type: 'separator'},
            {
                label: 'Connect to Server',
                click: () => {
                    createConnectDialog()
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
            {
                label: 'Disk Usage Summary',
                click: () => {
                    active_window.send('get_disk_summary_view')
                    // get_diskspace_summary();
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
                    e.sender.send('context-menu-command', 'open_with_application', args[i].exec)
                    let cmd = 'xdg-mime default ' + args[i].desktop + ' ' + args[i].mimetype
                    execSync(cmd)
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
            exec1(args.href)
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
                            active_window.send('notification', err);
                        } else {
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
                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            active_window.send('notification', err)
                        } else {
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

                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            active_window.send('notification', err);
                        } else {
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
                    exec(cmd, (err, stdout, stderr) => {
                        if (err) {
                            active_window.send('notification', err)
                        } else {
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

// Scripts Menu
function add_scripts_menu(menu, e, args) {

    let scripts_menu = menu.getMenuItemById('scripts')

    let templates = fs.readdirSync(path.join(__dirname, 'assets/scripts'))
    templates.forEach((file,idx) => {

        template_menu.submenu.append(new MenuItem({
            label: file.replace(path.extname(file),''),
            click: () => {
                // e.sender.send('create_file_from_template', {file: file})
            }
        }));
    })
}

// Find Context Menu
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

// Devices Menu
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
                createConnectDialog()
            }
        }
    ]

    let menu = Menu.buildFromTemplate(device_menu_template)
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// Workspace Menu
ipcMain.on('show-context-menu-workspace', (e, file) => {

    // console.log(file)
    let workspace_menu_template = [
        {
            label: 'Remove From Workspace',
            click: () => {
                active_window.send('remove_from_workspace', file.href)
            }
        },
        {
            label: 'Open Location',
            click: () => {
                active_window.send('get_view', path.dirname(file.href))
            }
        }
    ]

    let menu = Menu.buildFromTemplate(workspace_menu_template)

    // ADD TEMPLATES
    // add_templates_menu(menu, e, args)

    // ADD LAUNCHER MENU
    // add_launcher_menu(menu, e, args.apps)

    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// MAIN MENU
ipcMain.on('show-context-menu', (e, options) => {

    const template = [
    {
        label: 'New Window',
        click: () => {
            e.sender.send('context-menu-command', 'open_in_new_window')
        }
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
        e.sender.send('context-menu-command', 'open_terminal')
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
        click: () => {
            e.sender.send('context-menu-command', 'show_hidden')
        }
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
        // {
        //     label: 'Open',
        //     click: () => {
        //         e.sender.send('get_view', args[0].href)
        //     }
        // },
        {
            label: 'New Window',
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
    add_launcher_menu(menu, e, args.apps)

    // Run as program
    if (args.access) {
        add_execute_menu(menu, e, args)
    }

    let ext = path.extname(args.href);
    if (ext == '.mp4' || ext == '.mp3') {
        add_convert_audio_menu(menu, args.href);
    }

    if (ext == '.xz' || ext == '.gz' || ext == '.zip' || ext == '.img' || ext == '.tar') {
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
ipcMain.on('confirm_file_delete', function (e, delete_arr) {

    createDeleteDialog(delete_arr)

    // let res = dialog.showMessageBoxSync(null, {

    //     type: 'warning',
    //     title: 'Warning',
    //     buttons: ['Delete', 'Cancel'],
    //     // type: 'question',
    //     normalizeAccessKeys: true,
    //     message: 'Are you sure you want to permanently delete',
    //     detail: target_name

    // })

    // if (res == 0) {
    //     e.sender.send('delete_file_confirmed', res)
    // }

    // if(res == 1){
    //     e.sender.send('clear_selected_files')
    // }

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

