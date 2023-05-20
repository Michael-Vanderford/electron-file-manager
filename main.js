// Import the required modules
const { app, BrowserWindow, ipcMain, nativeImage, shell, screen, Menu, MenuItem, systemPreferences, dialog } = require('electron');
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const { execSync } = require('child_process')
const window = require('electron').BrowserWindow;
const windows = new Set();
const fs = require('fs')
const path = require('path');
const { Worker } = require('worker_threads');
const Store = require('electron-store');
const gio_utils = require('./utils/gio');



// Bootstrap Init
const store = new Store();
const worker = new Worker('./worker.js', );
const home = app.getPath('home');

let win;
let window_id = 0;
let window_id0 = 0;
let is_main = 1;

let settings_file = path.join(app.getPath('userData'), 'settings.json');
let settings = {};
try {
    settings = JSON.parse(fs.readFileSync(settings_file, 'utf-8'));
} catch (err) {
    // File does not exist or is invalid
}

const folderIconPath = systemPreferences

worker.postMessage({cmd: 'monitor'});

// Set window id
ipcMain.on('active_window', (e) => {
    window_id0 = window_id
    window_id = e.sender.id;
    if (window_id != window_id0) {
        win = window.fromId(window_id);
    }
})

// Worker Threads ///////////////////////////////////////////
let progress_counter = 0;
worker.on('message', (data) => {

    if (data.cmd === 'ls_done') {
        win.send('ls', data.dirents);
    }

    if (data.cmd === 'confirm_overwrite') {
        confirmOverwrite(data.source, data.destination);
    }

    if (data.cmd === 'msg') {
        win.send('msg', data.msg);
    }

    if (data.cmd === 'move_done') {
        win.send('remove_card', data.source);
        win.send('clear');
    }

    if (data.cmd === 'rename_done') {
        gio_utils.get_file(data.destination, file => {
            win.send('replace_card', data.source, file);
        })
    }

    if (data.cmd === 'copy_done') {

        if (is_main) {
            gio_utils.get_file(data.destination, file => {
                win.send('get_card', file);
            })
        } else {
            let href = path.dirname(data.destination)
            gio_utils.get_file(href, file => {
                win.send('replace_card', href, file);
            })
        }
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

let file_arr = [];
let cp_recursive = 0;
function get_files_arr (source, destination, callback) {
    cp_recursive++
    file_arr.push({type: 'directory', source: source, destination: destination})
    gio_utils.get_dir(source, dirents => {
        for (let i = 0; i < dirents.length; i++) {
            let file = dirents[i]
            // parentPort.postMessage({cmd: 'msg', msg: `Getting Folders and Files.`})
            if (file.type == 'directory') {
                get_files_arr(file.href, path.format({dir: destination, base: file.name}), callback)
            } else {
                file_arr.push({type: 'file', source: file.href, destination: path.format({dir: destination, base: file.name})})
            }
        }
        if (--cp_recursive == 0) {
            // parentPort.postMessage({cmd: 'msg', msg: ``})

            let file_arr1 = file_arr;
            file_arr = []
            return callback(file_arr1);
        }
    })
}


// Get files array
function get_files(source, callback) {

    // get files from gio module
    worker.postMessage({cmd: 'ls', source: source});
    // gio_utils.get_dir(source, dirents => {
    //     return callback(dirents);
    // })
}

function copyOverwrite (copy_overwrite_arr) {
    copy_overwrite_arr.every(item => {
        gio_utils.get_file(item.source, source_file => {

            gio_utils.get_file(item.destination, destination_file => {
                confirmOverwrite(source_file, destination_file);
            })

        })

    })
}

// IPC ////////////////////////////////////////////////////

// Confirm Overwrite


ipcMain.handle('settings', (e) => {
    let settings = JSON.parse(fs.readFileSync(settings_file, 'utf-8'));
    return settings;
})

ipcMain.on('count', (e, href) => {
    worker.postMessage({cmd: 'count', source: href});
})

// New Window
ipcMain.on('new_window', (e) => {
    createWindow();
})

ipcMain.on('ondragstart', (e, filePath) => {
    const icon = path.join(__dirname, 'assets/icons/dd.png');
    e.sender.startDrag({
        file: filePath,
        icon: icon
    })
})

// Get Devices
ipcMain.handle('get_devices', async (e) => {
    return new Promise((resolve, reject) => {
        gio_utils.get_devices(device_arr => {
            console.log(device_arr);
            resolve(device_arr);
        });
    });
})

// Add Workspace
ipcMain.on('add_workspace', (e, selected_files_arr) => {

    let settings_file = path.join(app.getPath('userData'), 'settings.json');
    settings = JSON.parse(fs.readFileSync(settings_file, 'utf8'))

    selected_files_arr.forEach(item => {
        let workspace_item = {
            name: path.basename(item),
            href: item
        }
        settings['workspace'].push(workspace_item)
    })
    fs.writeFileSync(settings_file, JSON.stringify(settings, null, 4));
    win.send('get_workspace');
    selected_files_arr = [];
})

// Remove Workspace
ipcMain.on('remove_workspace', (e, href) => {

    let settings_file = path.join(app.getPath('userData'), 'settings.json');
    settings = JSON.parse(fs.readFileSync(settings_file, 'utf8'));

    settings['workspace'] = settings['workspace'].filter(data => data.href !== href);
    fs.writeFileSync(settings_file, JSON.stringify(settings, null, 4));

    win.send('get_workspace');

    selected_files_arr = [];
})

// Get Workspae
ipcMain.handle('get_workspace', async (e) => {
    let settings_file = path.join(app.getPath('userData'), 'settings.json');
    let workspace_items = JSON.parse(fs.readFileSync(settings_file, 'utf-8')).workspace;
    return workspace_items;

})

// Set isMain Flag
ipcMain.on('main', (e, flag) => {
    // console.log('setting main to ', flag)
    is_main = flag;
})

// New Folder
ipcMain.on('mkdir', (e, href) => {
    worker.postMessage({cmd: 'mkdir', destination: href})
})

// Open File in Native Application
ipcMain.handle('open', (e, href) => {
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

// Send Copy array to Worker for Processing
ipcMain.on('paste', (e, copy_arr) => {
    worker.postMessage({ cmd: 'paste', copy_arr: copy_arr });
    copy_arr = [];
})

// Move
ipcMain.on('move', (e, selecte_files_arr ) => {
    worker.postMessage({cmd: 'mv', selected_items: selecte_files_arr})
})

// Get Folder Size
ipcMain.handle('get_folder_size', async (e, href) => {
    try {
        cmd = "cd '" + href.replace("'", "''") + "'; du -Hs";
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
    worker.postMessage({cmd: 'rename', source: source, destination: destination });
})

//////////////////////////////////////////////////////////////

// Create Main Winsow
function createWindow() {

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
        icon: path.join(__dirname, '/assets/icons/folder.png'),
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: true,
            nativeWindowOpen: false,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
        },
    }

    win = new BrowserWindow(options);
    win.loadFile('index.html');



    win.once('ready-to-show', () => {
        win.show();
    });

    win.on('closed', () => {
        windows.delete(win);
    });

    win.on('resize', (e) => {
        let intervalid = setInterval(() => {
            settings.window.width = win.getBounds().width;
            settings.window.height = win.getBounds().height;
            // fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings, null, 4));
            fs.writeFileSync(settings_file, JSON.stringify(settings, null, 4));
        }, 1000);
    })

    win.on('move', (e) => {
        settings.window.x = win.getBounds().x;
        settings.window.y = win.getBounds().y;
        // fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings, null, 4));
        fs.writeFileSync(settings_file, JSON.stringify(settings, null, 4));
    })
    windows.add(win);

};

// Define the app events
app.whenReady().then(createWindow);
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

ipcMain.on('get_files', (e, source) => {

    get_files(source, dirents => {
        win.send('get_files', dirents);
    })

})

// Dialogs ////////////////////////////////////////////////////////////

// Network connect dialog
function connectDialog() {

    let bounds = win.getBounds()

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

// Confirm Overwrite
function confirm(source_file, destination_file, copy_overwrite_arr) {

    let source = source_file.href;
    let destination = destination_file.href;

    let source_date = source_file["time::modified"];
    let destination_date = destination_file["time::modified"];

    // console.log(source, destination)

    let is_newer = 0;
    if (destination_date > source_date) {
        is_newer = 1;
    } else if (destination_date < source_date) {
        is_newer = 0;
    } else if (destination_date == source_date) {
        is_newer = 2;
        // copy_overwrite_arr.splice(0, 1);
        // overWriteNext(copy_overwrite_arr);
        // return;
    }

    let is_dir = 0;
    if (source_file.type == 'directory') {
        is_dir = 1;
    } else {
        is_dir = 0;
    }

    let title = ''
    let msg = ''
    let buttons = []

    if (is_dir) {

        title = `Folder Conflict "${path.basename(source)}"`

        msg = `Merge Folder "${path.basename(source)}"\n`

        if (is_newer) {
            msg = msg + `A newer folder with the same name already exists.\n`
        } else {
            msg = msg + `A older folder with the same name already exists.\n`
        }

        msg = msg + `Merging will ask for confirmation before replacing any files in te folder that confilict with the files being copied.\n`

        msg = msg + `\nOriginal Folder\n`
        buttons = ['Cancel', 'Merge', 'Skip'];

    } else {

        title = `File Confict "${path.basename(source)}"`

        msg = msg +  `Replace File "${path.basename(source)}"\n`

        if (is_newer == 1) {
            msg = msg + `A newer file with the same name already exists. `
        } else if (is_newer == 0) {
            msg = msg + `An older file with the same name already exists. `
        } else if (is_newer == 2) {
            msg = msg + `An file with the same name already exists. `
        }

        msg = msg + `Replacing it will overwrite its content\n`

        msg = msg + `\nOriginal File\n`
        buttons = ['Cancel', 'Replace', 'Skip'];
    }

    msg = msg + `Last Modified: ${gio_utils.getDateTime(destination_date)}\n\n`

    if (is_dir) {
        msg = msg + `Merge With\nLast Modified: ${gio_utils.getDateTime(source_date)}`
    } else {
        msg = msg + `Replace With\nLast Modified: ${gio_utils.getDateTime(source_date)}`
    }

    dialog.showMessageBox(win, {

        type: 'warning',
        title: title, //`Merge Folder "${path.basename(source)}"`,
        message: msg,
        buttons: buttons, //['Cancel', 'Merge', 'Skip'],
        checkboxLabel: 'Apply this action to all files and folders',

    }).then((response) => {
        const overwrite_all = response.checkboxChecked;
        switch (response.response) {
            case 0: {
                // Cancel
                break;
            }
            case 1: {
                // Merge / Replace
                let copy_arr = copy_overwrite_arr.filter(x => x.source == source);
                copy_arr[0].overwrite_flag = 1;

                console.log(`Overwrite Confirmed ${source} with ${destination}`);

                if (!is_dir) {
                    worker.postMessage({cmd: 'paste', copy_arr: copy_arr});
                }
                copy_overwrite_arr.splice(0, 1);
                overWriteNext(copy_overwrite_arr);

                break;
            }
            case 2: {
                // Skip
                let copy_arr = copy_overwrite_arr.filter(x => x.source == source);
                copy_arr[0].overwrite_flag = 1;

                console.log(`Overwrite Skipped ${source} with ${destination}`);

                copy_overwrite_arr.splice(0, 1);
                overWriteNext(copy_overwrite_arr);

                break;
            }
            default:
                // Cancel
                break;

          }

    }).catch((error) => {
        console.error(error);
    });

}

// Handle Processing each OverWrite Dialog
function overWriteNext(copy_overwrite_arr) {

    copy_overwrite_arr.every((item, idx) => {
        gio_utils.get_file(item.source, source_file => {
            gio_utils.get_file(item.destination, destination_file => {
                // Show Overwrite Dialog
                // confirmOverwrite(source_file, destination_file, copy_overwrite_arr);
                confirm(source_file, destination_file, copy_overwrite_arr);

                return false;
            })
        })
    })
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

    console.log(`Overwrite Confirmed ${source} with ${destination}`);
    worker.postMessage({cmd: 'paste', copy_arr: copy_arr});

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
        modal:true,
        width: 550,
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
    worker.postMessage({cmd: 'delete_confirmed', files_arr: selecte_files_arr});

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

// Get Launchers
function get_launchers(file) {

    let launchers = []
    try {
        let filetype = file["standard::content-type"];
        let cmd = `grep "${filetype}" /usr/share/applications/mimeinfo.cache`
        let desktop_launchers = execSync(cmd).toString().replace(filetype + '=', '').split(';')
        if (desktop_launchers.length > 0) {
            for (let i = 0; i < desktop_launchers.length; i++) {
                let filepath = path.join('/usr/share/applications', desktop_launchers[i])
                console.log(filepath)
                if (file.type !== 'directory') {

                    // GET DESKTOP LAUNCHER EXECUTE PATH
                    cmd = "grep '^Exec=' " + filepath
                    let exec_path = execSync(cmd).toString().split('\n')

                    // GET LAUNCHER NAME
                    cmd = "grep '^Name=' " + filepath
                    let exec_name = execSync(cmd).toString().split('\n')

                    // GET MIME TYPE
                    cmd = "xdg-mime query filetype '" + file.href + "'"
                    let exec_mime = execSync(cmd).toString()

                    set_default_launcher(desktop_launchers[i],exec_mime[i].replace('MimeType=',''))

                    let exe_path
                    let launcher

                    let desktop_file = fs.readFileSync(filepath,'utf8').split('\n')
                    desktop_file.forEach((item, idx) => {
                        item = item.replace(',','')
                        if(item.indexOf('Name=') > -1 && item.indexOf('GenericName=') === -1) {
                            launcher = item.replace('Name=', '')
                        }
                        if(item.indexOf('Exec=') > -1 && item.indexOf('TryExec=') === -1) {
                            exe_path = item.replace('Exec=', '')
                        }
                    })

                    console.log(cmd)

                    let options = {
                        name: exec_name[0].replace('Name=', ''),
                        icon: '',
                        exec: exec_path[0].replace('Exec=', ''),
                        desktop: desktop_launchers[i],
                        mimetype: exec_mime
                    }
                    launchers.push(options)
                }

            }
        }

    } catch (err) {

        console.log(err)

        let options = {
            name: 'Code', //exec_name[0].replace('Name=', ''),
            icon: '',
            exec: '/usr/bin/code "' + file.href + '"',
            desktop: '', //desktop_launchers[i],
            mimetype: 'application/text'
        }

        launchers.push(options)
    }

    return launchers
}

// Lanucher Menu
let launcher_menu
function add_launcher_menu(menu, e, file) {

    launchers = get_launchers(file);
    console.log(file.href, launchers)
    launcher_menu = menu.getMenuItemById('launchers')
    try {
        for(let i = 0; i < launchers.length; i++) {
            console.log('launchers', launchers[i])
            launcher_menu.submenu.append(new MenuItem({
                label: launchers[i].name,
                click: () => {
                    // e.sender.send('context-menu-command', 'open_with', launchers[i].exec)

                    // Set Default Application
                    execSync(`xdg-mime default ${launchers[i].desktop} ${launchers[i].mimetype}`);
                    shell.openPath(file.href);

                }
            }))
        }

    } catch (err) {
        console.log(err)
    }
}

function createFileFromTemplate(source, destination) {
    worker.postMessage({cmd: 'cp', source: source, destination: destination});
}

// Templated Menu
function add_templates_menu(menu, e, location) {
    let template_menu = menu.getMenuItemById('templates')
    let templates = fs.readdirSync(path.join(__dirname, 'assets/templates'))
    templates.forEach((file,idx) => {
        let source = path.join(__dirname, 'assets/templates', file);
        let destination = path.format({dir: location, base: file});
        template_menu.submenu.append(new MenuItem({
            label: file.replace(path.extname(file),''),
            click: () => {
                createFileFromTemplate(source, destination);
            }
        }));
    })
}

// Main Menu
ipcMain.on('main_menu', (e, destination) => {

    is_main = 1;

    const template = [
    {
        label: 'New Window',
        click: () => {
            createWindow(destination);
            // e.sender.send('context-menu-command', 'open_in_new_window')
        }
    },
    {
        type: 'separator'
    },
    {
        label: 'New Folder',
        accelerator: process.platform === 'darwin' ? settings.keyboard_shortcuts.NewFolder : settings.keyboard_shortcuts.NewFolder,
        click: () => {
            win.send('context-menu-command', 'mkdir')
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
                icon: './assets/icons/menus/terminal.png',
                click: () => {win.send('sort', 'date')}
            },
            {
                label: 'Name',
                click: () => {win.send('sort', 'name')}
            },
            {
                label: 'Size',
                click: () => {win.send('sort', 'size')}
            },
            {
                label: 'Type',
                click: () => {win.send('sort', 'type')}
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
        click: () => {
            e.sender.send('context-menu-command', 'show_hidden')
        }
    },
    ]

    // Create menu
    let menu = Menu.buildFromTemplate(template)

    // Add templates
    add_templates_menu(menu, e, destination)

    // Show menu
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// Folders Menu
ipcMain.on('folder_menu', (e, href) => {

    const template1 = [
        {
            label: 'Open with Code',
            click: () => {
                exec(`cd "${href}"; code .`, (err) => {
                    if (err) {
                        console.log(err);
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
                    click: () => {win.send('sort', 'date')}
                },
                {
                    label: 'Name',
                    click: () => {win.send('sort', 'name')}
                },
                {
                    label: 'Size',
                    click: () => {win.send('sort', 'size')}
                },
                {
                    label: 'Type',
                    click: () => {win.send('sort', 'type')}
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
                e.sender.send('context-menu-command', 'add_workspace');
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
    // add_templates_menu(menu1, e, args[0]);

    // ADD LAUNCHER MENU
    //   add_launcher_menu(menu1, e, args);
    menu1.popup(BrowserWindow.fromWebContents(e.sender));

})

// Files Menu
ipcMain.on('file_menu', (e, file) => {

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
            //     // e.sender.send('open_with_application')
            //     win.send('')
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
                e.sender.send('context-menu-command', 'add_workspace')
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
                    click: () => {win.send('sort', 'date')}
                },
                {
                    label: 'Name',
                    click: () => {win.send('sort', 'name')}
                },
                {
                    label: 'Size',
                    click: () => {win.send('sort', 'size')}
                },
                {
                    label: 'Type',
                    click: () => {win.send('sort', 'type')}
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
            label: 'Delete File',
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
    // add_templates_menu(menu, e, args)

    // ADD LAUNCHER MENU
    add_launcher_menu(menu, e, file)

    // Run as program
    // if (args.access) {
        // add_execute_menu(menu, e, args)
    // }

    // let ext = path.extname(args.href);
    // if (ext == '.mp4' || ext == '.mp3') {
    //     add_convert_audio_menu(menu, args.href);
    // }

    // if (ext == '.xz' || ext == '.gz' || ext == '.zip' || ext == '.img' || ext == '.tar') {
    //     extract_menu(menu, e, args);
    // }

    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// Devices Menu
ipcMain.on('device_menu', (e, href) => {

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
        }
    ]

    let menu = Menu.buildFromTemplate(device_menu_template)
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// Workspace Menu
ipcMain.on('workspace_menu', (e, file) => {

    // console.log(file)
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


