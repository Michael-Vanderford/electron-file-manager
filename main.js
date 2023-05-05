// Import the required modules
const { app, BrowserWindow, ipcMain, nativeImage, shell, screen }   = require('electron');
const window        = require('electron').BrowserWindow;
const windows       = new Set();
const fs            = require('fs')
const path          = require('path');
const { Worker }    = require('worker_threads');
const Store         = require('electron-store');
const gio           = require('./utils/gio');

// Bootstrap Init
const store     = new Store();
const worker    = new Worker('./worker.js');
const home      = app.getPath('home');

let win;
let window_id = 0;
let window_id0 = 0;

let settings_file = path.join(app.getPath('userData'), 'settings.json');
let settings = {};
try {
    settings = JSON.parse(fs.readFileSync(settings_file, 'utf-8'));
} catch (err) {
    // File does not exist or is invalid
}

ipcMain.on('active_window', (e) => {

    window_id0 = window_id
    window_id = e.sender.id;

    if (window_id != window_id0) {
        win = window.fromId(window_id);
    }
})


// Functions //////////////////////////////////////////////

// Get files array
function get_files (source, callback) {
    gio.get_dir(source, dirents => {
        return callback(dirents);
    })
}

// IPC ////////////////////////////////////////////////////

// Open File in Native Application
ipcMain.handle('open', (e, href) => {
    shell.openPath(href);
})

// Get File Icon
ipcMain.handle('get_icon', async (e, href) => {
    return await app.getFileIcon(href, {size: 32}).then(icon => {
        return icon.toDataURL();
    }).catch((err) => {
        return err;
    })
})

// // Define the window properties
// const windowOptions = {
//     width: 800,
//     height: 600,
//     webPreferences: {
//         nodeIntegration: true,
//         contextIsolation: true,
//         preload: path.join(__dirname, 'preload.js')
//     }
// };

// let win
// // Define the function to create the window
// function createWindow() {
//     window = new BrowserWindow(windowOptions);
//     window.loadFile('index.html');
//     win = window.webContents;
// }

function createWindow () {

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
            settings.window.width   = win.getBounds().width;
            settings.window.height  = win.getBounds().height;
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

