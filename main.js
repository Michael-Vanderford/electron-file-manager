// Import the required modules
const { app, BrowserWindow, ipcMain, nativeImage, shell, screen, Menu, systemPreferences } = require('electron');
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const window = require('electron').BrowserWindow;
const windows = new Set();
const fs = require('fs')
const path = require('path');
const { Worker } = require('worker_threads');
const Store = require('electron-store');
const gio_utils = require('./utils/gio');

// Bootstrap Init
const store = new Store();
const worker = new Worker('./worker.js');
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

})

// Functions //////////////////////////////////////////////

// Get files array
function get_files(source, callback) {

    // get files from gio module
    // worker.postMessage({cmd: 'ls', source: source});

    gio_utils.get_dir(source, dirents => {
        return callback(dirents);
    })
}

// IPC ////////////////////////////////////////////////////

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

// Templated Menu
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

// Main Menu
ipcMain.on('main_menu', (e, options) => {

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
          e.sender.send('context-menu-command', 'mkdir')
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
    // add_templates_menu(menu, e, options)

    // Show menu
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})

// Folders Menu
ipcMain.on('folder_menu', (e, args) => {

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
ipcMain.on('file_menu', (e, args) => {

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
    // add_launcher_menu(menu, e, args.apps)

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
ipcMain.on('device_menu', (e, args) => {

    device_menu_template = [
        // {
        //     label: 'Unmount',
        //     click: () => {

        //     }
        // },
        {
            label: 'Connect',
            click: () => {
                connectDialog()
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


