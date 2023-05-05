const { ipcRenderer, shell } = require('electron');
const { parentPort, workerData, isMainThread } = require('worker_threads');
const path  = require('path');
const fs    = require('fs');
const os    = require('os')

// Get Files
function get_files(source, callback) {
    ipcRenderer.send('get_files', source);
    ipcRenderer.on('get_files', (e, dirents) => {
        return callback(dirents)
    })
}

// RETURNS A STRING PATH TO AN ICON IMAGE BASED ON FILE EXTENSION
function get_icon_theme() {
    let icon_theme = 'kora';
    let icon_dir = path.join(__dirname, 'assets', 'icons');
    try {
        if (process.platform === 'linux') {
            icon_theme = execSync('gsettings get org.gnome.desktop.interface icon-theme').toString().replace(/'/g, '').trim();
            let search_path = [];
            search_path.push(path.join(get_home(), '.local/share/icons'), path.join(get_home(), '.icons'), '/usr/share/icons');
            search_path.every(icon_path => {
                if (fs.existsSync(path.join(icon_path, icon_theme))) {
                    icon_dir = path.join(icon_path, icon_theme);
                    return false;
                } else {
                    icon_dir = path.join(__dirname, 'assets', 'icons', 'kora');
                    return true;
                }
            })
        } else if (process.platform === 'win32' || process.platform === 'darwin') {
        } else {
        }
    } catch (err) {
    }
    return icon_dir;
}

// Get icon theme directory
let theme_dir = get_icon_theme();

// Get Folder Icon
function get_folder_icon(callback) {
    let folder_icon_path = ''
    let icon_dirs = [path.join(theme_dir, '32x32/places/folder.png'), path.join(theme_dir, 'places/scalable/folder.svg'), path.join(theme_dir, 'places/64/folder.svg')];
    icon_dirs.every(icon_dir => {
        if (fs.existsSync(icon_dir)) {
            folder_icon_path = icon_dir
            return false;
        } else {
            folder_icon_path = path.join(__dirname, 'assets/icons/kora/places/scalable/folder.svg')
            return true;
        }
    })
    return folder_icon_path;
}

let folder_icon = get_folder_icon();

/**
 *
 * @param {int} fileSizeInBytes
 * @returns
 */
function getFileSize(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];

};

/**
 *
 * @param {*} date
 * @returns Formated Gio Date
 */
function getDateTime (date) {
    try {
        var d = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date * 1000));
        return d;
    } catch (err) {
        // console.log('gio getDateTime Format error')
    }
}

/**
 * Get Card for Grid View
 * @param {File} file
 * @returns File Card
 */
function get_card(file) {

    console.log(file)

    let location = document.getElementById('location');

    let card = document.createElement('div');
    let content = document.createElement('div')
    let icon = document.createElement('div');
    let img = document.createElement('img');
    let href = document.createElement('a');
    let date = document.createElement('div');
    let size = document.createElement('div');
    let br = document.createElement('br');

    card.classList.add('card');
    href.classList.add('header')
    img.classList.add('icon');
    content.classList.add('content');

    href.innerHTML = path.basename(file.href);
    href.href = file.href;

    card.draggable = true;
    card.dataset.href = file.href;

    if (file.type == 'directory') {
        // // Get Icon
        ipcRenderer.invoke('get_icon', (file.href)).then(res => {
            img.src = folder_icon;
        })
        href.onclick = (e) => {
            e.preventDefault();
            location.value = file.href;
            location.dispatchEvent(new Event('change'));
            // get_grid_view(file.href, () => {})
        }
    } else {
        // Get Icon
        ipcRenderer.invoke('get_icon', (file.href)).then(res => {
            img.src = res;
        })
        // Open href in default application
        href.onclick = (e) => {
            e.preventDefault();
            ipcRenderer.invoke('open', file.href);
        }
    }

    card.onmouseover = (e) => {
        card.classList.add('highlight');
    }
    card.onmouseleave = (e) => {
        card.classList.remove('highlight');
    }

    date.append(getDateTime(file["time::modified"]));
    size.append(getFileSize(file["size"]));
    icon.append(img);

    content.append(href, br, date, size);
    card.append(icon, content);
    return card;
}

/**
 * Get Grid View
 * @param {*} source
 * @param {*} callback
 */
function get_grid_view(source, callback) {

    let main = document.getElementById('main');
    let folder_grid = document.getElementById('folder_grid')
    let file_grid = document.getElementById('file_grid')

    folder_grid.classList.add('folder_grid')
    file_grid.classList.add('file_grid')

    // folder_grid.style = 'grid-template-columns: repeat(5, 1fr); grid-template-rows; auto;'
    // file_grid.style = 'grid-template-columns: repeat(5, 1fr); grid-template-rows: auto;'

    let sort_flag = 0;

    get_files(source, dirents => {

        folder_grid.innerHTML = ''
        file_grid.innerHTML = ''

        // Sort by date
        dirents.sort((a, b) => {
            try {
                if (sort_flag == 0) {
                    return b["time::modified"] - a["time::modified"]
                } else {
                    return a["time::modified"] - b["time::modified"]
                }
            } catch (err) {
                console.log(err)
            }
        })

        // Loop Files Array
        for (let i = 0; i < dirents.length; i++) {
            let file = dirents[i]
            if (file.type == 'directory') {
                folder_grid.append(get_card(file))
            } else {
                file_grid.append(get_card(file))
            }
        }
        main.append(folder_grid, file_grid)
        return callback()
    })
}

let state = 0

// Main - This runs after html page loads.
window.addEventListener('DOMContentLoaded', () => {

    // Primary Controls
    let location = document.getElementById('location');
    let copy_arr = []

    // Local Storage //////////////////////////////////////////////
    // Handle Location
    if (localStorage.getItem('location') !== null) {
        // todo: validate path before reusing
        location.value = localStorage.getItem('location');
    } else {
        location.value = os.homedir()
        localStorage.setItem('location', location.value)
    }

    ///////////////////////////////////////////////////////////////

    // Menu Items
    // Home
    let home = document.querySelectorAll('.home');
    home.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            location.value = os.homedir();
            location.dispatchEvent(new Event('change'));
        }
    });

    // Documents
    let documents = document.querySelectorAll('.documents');
    documents.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            location.value = path.join(os.homedir(), 'Documents');
            location.dispatchEvent(new Event('change'));
        }
    });

    // Downloads
    let downloads = document.querySelectorAll('.downloads');
    downloads.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            location.value = path.join(os.homedir(), 'Downloads');
            location.dispatchEvent(new Event('change'));
        }
    });

    // Pictures
    let pictures = document.querySelectorAll('.pictures');
    pictures.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            location.value = path.join(os.homedir(), 'Pictures');
            location.dispatchEvent(new Event('change'));
        }
    });

    /////////////////////////////////////////////////////////////////

    // Get mouse events on main
    document.onkeydown = (e) => {
        let selected_items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');
        if (e.ctrlKey === true && e.key == 'c') {
            selected_items.forEach(item => {
                copy_arr.push(item.dataset.href)
                console.log(copy_arr)
            })
        }

        if (e.ctrlKey === true && e.key == 'v') {
            copy_arr = []
        }

        // Escape Key
        if (e.key == 'Escape') {
            // Clear Arrays
            copy_arr = []
        }

    }

    // Get on mouse over
    document.onmouseover = (e) => {
        // Send the active window id to main
        ipcRenderer.send('active_window');
    }

    let view = 'grid';
    if (view == 'grid') {
        if (location.value != "") {
            get_grid_view(location.value, () => {})
        }

        location.onchange = () => {
            if (location.value != "") {
                get_grid_view(location.value, () => {})
                localStorage.setItem('location', location.value)
            }
        }

    }

});