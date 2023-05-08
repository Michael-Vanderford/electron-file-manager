const { ipcRenderer, shell } = require('electron');
const path       = require('path');
const fs         = require('fs');
const os         = require('os');
const DragSelect = require('dragselect');
const gio_utils  = require('./utils/gio.js');

// Global Arrays
let selected_files_arr  = [];
let copy_arr            = [];

// IPC ///////////////////////////////////////////////////////////////////

// Msg
ipcRenderer.on('msg', (e, message) => {
    msg(message);
})

// Edit mode
ipcRenderer.on('edit', (e) => {
    edit();
})

// Confirm delete
ipcRenderer.on('confirm_delete', (e, delete_arr) => {

    console.log('what', delete_arr);

    let confirm_delete = document.getElementById('confirm_delete')
    let delete_files = document.getElementById('delete_files')
    let delete_button = document.getElementById('delete_button')
    let cancel_delete_button = document.getElementById('cancel_delete_button')
    let br = document.createElement('br')

    delete_arr.forEach(href => {
        let item = document.createElement('div')
        item.classList.add('item')
        item.append(href)
        delete_files.append(item);
    })

    delete_button.onclick = (e) => {
        ipcRenderer.send('delete_confirmed', delete_arr);
        delete_arr = []
    }

    confirm_delete.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            ipcRenderer.send('delete_canceled');
        }
    })

    cancel_delete_button.onclick = (e) => {
        ipcRenderer.send('delete_canceled');
    }

})

// Get Card
ipcRenderer.on('get_card', (e, file) => {
    let card = getCard(file);
    if (file.type == 'directory') {
        let folder_grid = document.getElementById('folder_grid');
        folder_grid.prepend(card);
    } else {
        let file_grid = document.getElementById('file_grid');
        file_grid.prepend(card);
    }
})

// Remove Card
ipcRenderer.on('remove_card', (e, href) => {
    let cards = document.querySelectorAll('.card')
    cards.forEach(card => {
        if (card.dataset.href === href) {
            card.remove();
        }
    })
})

ipcRenderer.on('replace_card', (e, href, file) => {
    let card = document.querySelector(`[data-href="${href}"]`);
    card.replaceWith(getCard(file));
})

// Set Progress
ipcRenderer.on('set_progress', (e, data) => {

    // console.log(data)

    let progress = document.getElementById('progress')
    let progress_msg = document.getElementById('progress_msg')
    let progress_bar = document.getElementById('progress_bar')

    if (progress.classList.contains('hidden')) {
        progress.classList.remove('hidden')
    }

    progress_msg.innerHTML = data.msg;
    progress_bar.value = data.value;
    progress_bar.max = data.max;

    if (progress_bar.value == progress_bar.max) {
        progress.classList.add('hidden')
    }

})

// Context Menu Commands
ipcRenderer.on('context-menu-command', (e, cmd) => {

    let location = document.getElementById('location');

    switch (cmd) {
        case 'rename': {
            edit();
            break;
        }
        case 'mkdir': {
            console.log('running new folder')
            ipcRenderer.send('mkdir', `${path.join(location.value, 'New Folder')}`)
            break;
        }
        case 'copy': {
            getSelectedFiles();
            break
        }
        case 'paste': {
            paste();
            break;
        }
        case 'delete': {
            getSelectedFiles();
            ipcRenderer.send('delete', (selected_files_arr));
            selected_files_arr = []
            break;
        }
    }

})

// Functions //////////////////////////////////////////////////////////////

// Utilities ///////////////////////////////////////////////////////////////

function isImage(href) {
    return new Promise((resolve, reject) => {
        let isImage = 0;
        gio_utils.get_file(href, file => {
            if (file.type.indexOf('image') > -1) {
                isImage = 1;
            }
            resolve(isImage);
        })
    })
}

// Get icon theme path
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
 * Set Msg in lower right side
 * @param {string} message
 */
function msg(message) {

    let msg = document.getElementById('msg');
    msg.innerHTML = '';
    msg.classList.remove('hidden');
    if (message.indexOf('error' > -1)) {
        msg.classList.add('error')
    }
    if (message === '') {
        msg.classList.add('hidden');
    }
    msg.innerHTML = message;

}

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

function edit() {

    getSelectedFiles();
    selected_files_arr.forEach(href => {
        let card = document.querySelector(`[data-href="${href}"]`);
        let header = card.querySelector('.header');
        let header_link = card.querySelector('a');
        let input = card.querySelector('input');
        header.classList.add('hidden');
        input.classList.remove('hidden');
        input.focus();

        input.addEventListener('change', (e) => {
            let location = document.getElementById('location');
            let source = href;
            let destination = path.join(location.value, path.basename(e.target.value))
            ipcRenderer.send('rename', source, destination);

            // card.dataset.href = destination;
            // header_link.innerHTML = input.value;
            // header_link.href = destination;

            // header.classList.remove('hidden')
            // input.classList.add('hidden')
        })

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Escape') {
                input.value = path.basename(href);
                header.classList.remove('hidden');
                input.classList.add('hidden');
            }
        })

    })
    selected_files_arr = [];
}

// Sidebar Functions /////////////////////////////////////////////////////////////
function sidebarHome() {

    let home_dir = '' //get_home();
    let my_computer_arr = ['Home', 'Documents', 'Music', 'Pictures', 'Videos', 'Downloads', 'Recent', 'File System']
    let my_computer_paths_arr = [home_dir, `${path.join(home_dir, 'Documents')}`, `${path.join(home_dir, 'Music')}`, `${path.join(home_dir, 'Pictures')}`, `${path.join(home_dir, 'Video')}`, `${path.join(home_dir, 'Downloads')}`, 'Recent', 'Recent']
    let my_computer_icons_arr = ['home', 'folder', 'music', 'image', 'video', 'download', 'history', 'hdd']

    localStorage.setItem('minibar', 'mb_home')

    let sidebar = document.getElementById('sidebar')
    sidebar.innerHTML = ''
    sidebar.append(add_header('Home'))

    // Get home
    console.log(my_computer_arr.length)
    for (let i = 0; i < my_computer_arr.length; i++) {

        let href = my_computer_paths_arr[i]
        console.log(my_computer_arr[i])

        let item = add_div()
        item.classList.add('flex')

        let link = add_link(my_computer_paths_arr[i], my_computer_arr[i])


        item.classList.add('item')
        item.append(add_icon(my_computer_icons_arr[i].toLocaleLowerCase()), link)

        sidebar.append(item)

        item.onclick = () => {

            let items = sidebar.querySelectorAll('.item')
            items.forEach(item => {
                item.classList.remove('active')
            })

            item.classList.add('active')
            if (href === 'Recent') {
                get_recent_files(`${get_home()}/Documents`)
            } else {
                gio.get_file(href, (file) => {
                    if (file.type === 'directory') {
                        get_view(file.href);
                    } else {
                        open(file.href);
                    }
                })
            }
        }

    }

    // Workspace
    // sidebar_items.append(add_header('Workspace'))
    // local_items = JSON.parse(localStorage.getItem('workspace'))
    // if (local_items != undefined) {
    //     if (local_items.length > 0 && local_items != undefined) {
    //         local_items.forEach((item, idx) => {

    //             let div = add_div()
    //             let col1 = add_div()
    //             let col2 = add_div()
    //             let rm_icon = add_icon('times')

    //             rm_icon.classList.add('small');
    //             rm_icon.style = 'margin-left: auto;';

    //             div.style = 'display: flex; padding: 6px; width: 100%;'
    //             div.classList.add('item')
    //             col1.append(add_icon('bookmark'));
    //             col2.append(item.name);
    //             div.append(col1, col2, rm_icon);
    //             sidebar_items.append(div);

    //             div.title = item.href
    //             div.onclick = (e) => {

    //                 gio.get_file(item.href, file => {
    //                     if (file.type == 'directory') {
    //                         get_view(item.href)
    //                     } else {
    //                         open(item.href)
    //                     }
    //                 })
    //             }

    //             rm_icon.onclick = (e) => {

    //                 e.preventDefault()
    //                 e.stopPropagation()

    //                 div.remove();
    //                 local_items.splice(idx, 1);
    //                 if (local_items.length > 0) {
    //                     localStorage.setItem('workspace', JSON.stringify(local_items));
    //                 } else {
    //                     localStorage.removeItem('workspace')
    //                 }
    //             }

    //             div.oncontextmenu = (e) => {
    //                 div.classList.add('highlight_select')
    //                 ipcRenderer.send('show-context-menu-workspace', item);
    //             }

    //         })

    //     }

    // }

    // // Get devices
    // sidebar_items.append(add_header('Devices'))
    // gio.get_devices(devices => {

    //     devices.forEach((device, idx) => {

    //         let link = add_link(device.href, device.name);
    //         let icon = add_icon('hdd');
    //         let umount = add_icon('eject');
    //         let div = add_div()

    //         let col1 = add_div().innerHTML = (icon)
    //         let col2 = add_div().innerHTML = (link)
    //         let col3 = add_div().innerHTML = (umount)

    //         link.style = 'display: block'
    //         col2.style = 'width: 100%'
    //         col3.style = 'margin-left: auto'

    //         div.append(col1, col2, col3)
    //         div.style = 'display: flex; padding: 6px; width: 100%;'
    //         div.classList.add('item')

    //         umount.addEventListener('click', (e) => {

    //             e.preventDefault()
    //             e.stopPropagation()

    //             // let cmd = `gio mount -u -f "${item.href}"`
    //             // console.log(cmd)

    //             exec(`gio mount -u -f "${device.href}"`, (err, stdout) => {

    //                 if (!err) {
    //                     div.remove()
    //                     notification(stdout)
    //                 } else {
    //                     notification(err)
    //                 }
    //             })


    //         })

    //         div.onclick = (e) => {
    //             get_view(device.href);
    //         }

    //         div.oncontextmenu = (e) => {
    //             ipcRenderer.send('show-context-menu-devices');
    //         }

    //         sidebar_items.append(div)
    //     })



    // })

}

// Main Functions ////////////////////////////////////////////////////////////////

// Get Files
function get_files(source, callback) {
    ipcRenderer.send('get_files', source);
    ipcRenderer.on('get_files', (e, dirents) => {
        return callback(dirents)
    })
}

// Copy selected items to array
function getSelectedFiles() {
    selected_files_arr = [];
    let selected_items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');
    selected_items.forEach(item => {
        selected_files_arr.push(item.dataset.href);
    })
    if (selected_files_arr.length == 1) {
        msg(`${selected_files_arr.length} Item Selected`);
    } else if (selected_files_arr.length > 1) {
        msg(`${selected_files_arr.length} Items Selected`);
    } else {
        msg(`No Items Selected`);
    }
}

function paste() {
    // todo: check if location is valid
    let location = document.getElementById('location');
    if (selected_files_arr.length > 0) {
        for(let i = 0; i < selected_files_arr.length; i++) {
            let copy_data = {
                source: selected_files_arr[i],
                destination: path.join(location.value, path.basename(selected_files_arr[i]))
            }
            copy_arr.push(copy_data);
        }
        console.log('sending array', copy_arr);
        ipcRenderer.send('paste', copy_arr);
        selected_files_arr = [];
        copy_arr = [];
    } else {
        msg(`Nothing to Paste`);
    }
}

/**
 * Get Card for Grid View
 * @param {File} file
 * @returns File Card
 */
function getCard(file) {

    let location = document.getElementById('location');

    let is_dir = 0;

    let card    = document.createElement('div');
    let content = document.createElement('div')
    let icon    = document.createElement('div');
    let img     = document.createElement('img');
    let header  = document.createElement('div');
    let href    = document.createElement('a');
    let date    = document.createElement('div');
    let size    = document.createElement('div');
    let input   = document.createElement('input');

    card.classList.add('card');
    header.classList.add('header')
    input.classList.add('input', 'hidden');
    img.classList.add('icon');
    content.classList.add('content');

    href.href = file.href;
    href.innerHTML = path.basename(file.href);

    input.spellcheck = false;
    input.dataset.href = file.href;
    input.value = path.basename(file.href);

    href.draggable = false;
    img.draggable = false;
    card.draggable = true;
    card.dataset.href = file.href;

    if (file.type == 'directory') {

        is_dir = 1;

        // // Get Icon
        ipcRenderer.invoke('get_icon', (file.href)).then(res => {
            img.src = folder_icon;
        })
        ipcRenderer.invoke('get_folder_size', (file.href)).then(res => {
            if ((res / 4096) > 1) {
                size.append(getFileSize(res))
            } else {
                size.append(`0 items`)
            }
        })
        href.addEventListener('click', (e) => {
            e.preventDefault();
            location.value = file.href;
            location.dispatchEvent(new Event('change'));
        })
        img.addEventListener('click', (e) => {
            e.preventDefault();
            location.value = file.href;
            location.dispatchEvent(new Event('change'));
        })
        // Context Menu
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.add('highlight_select')
            ipcRenderer.send('folder_menu');
        })

    } else {
        // Get Icon
        if (file["standard::content-type"].indexOf('image') > -1) {
            img.src = file.href;
        } else {
            ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                img.src = res;
            })
        }
        // Open href in default application
        href.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.invoke('open', file.href);
        })
        img.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.invoke('open', file.href);
        })
        size.append(getFileSize(file["size"]));
        // Context Menu
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.add('highlight_select')
            ipcRenderer.send('file_menu');
        })
    }

    // Mouse Over
    card.addEventListener('mouseover', (e) => {
        card.classList.add('highlight');
    })

    // Mouse Leave
    card.addEventListener('mouseleave', (e) => {
        card.classList.remove('highlight');
    })

    // Card ctrl onclick
    card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.ctrlKey) {
            if (card.classList.contains('highlight_select')) {
                card.classList.remove('highlight_select')
            } else {
                card.classList.add('highlight_select')
            }
        }
    })

    card.addEventListener('dragstart', (e) => {

    })

    card.addEventListener('dragenter', (e) => {

    })

    card.addEventListener('dragover', (e) => {
        if (is_dir) {
            card.classList.add('highlight_target');
            msg(`Move Item to "${path.basename(file.href)}"`);
        }
    })

    card.addEventListener('dragleave', (e) => {
        card.classList.remove('highlight_target');
        msg('');
    })

    try {
        ds.addSelectables(card)
    } catch (err) {
    }

    date.append(getDateTime(file["time::modified"]));
    icon.append(img);
    header.append(href)

    content.append(header, input, date, size);
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

    folder_grid.classList.add('folder_grid', 'grid5')
    file_grid.classList.add('file_grid', 'grid5')

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
                folder_grid.append(getCard(file))
            } else {
                file_grid.append(getCard(file))
            }
        }
        main.append(folder_grid, file_grid)
        return callback()
    })
}

function clearContextMenu(e) {
    const isInsideContextMenu = e.target.closest('.context-menu');
    if (!isInsideContextMenu) {
        let selected_items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');
        selected_items.forEach(item => {
            item.classList.remove('highlight_select', '.ds-selected')
        })
    }
}

let state = 0

// Main - This runs after html page loads.
window.addEventListener('DOMContentLoaded', (e) => {

    try {

        // Primary Controls
        let location = document.getElementById('location');
        let main = document.getElementById('main')

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

        // Main Context Menu
        main.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            ipcRenderer.send('main_menu');
        })

        // Get mouse events on main
        document.addEventListener('keydown', (e) => {

            // // Ctrl+C (Copy)
            // if (e.ctrlKey === true && e.key == 'c') {
            //     getSelectedFiles();
            // }

            // // Ctrl+V (Paste)
            // if (e.ctrlKey === true && e.key == 'v') {
            //     paste();
            // }

            // // Escape (Cancel)
            // if (e.key == 'Escape') {
            //     // Clear Arrays
            //     selected_files_arr = [];
            //     copy_arr = [];
            // }
        })

        // Get on mouse over
        document.addEventListener('mouseover', (e) => {
            // Send the active window id to main
            ipcRenderer.send('active_window');
        })
        // Clear Highlighted elements on context menu close
        // document.addEventListener('mouseup', (e) => {
        //     clearContextMenu(e);
        // })
        // Clear Highlighted elements on context menu escape
        document.addEventListener('keyup', (e) => {

            // Escape
            if (e.key == 'Escape') {
                clearContextMenu(e);
            }

            // Reload
            if (e.key === 'F5') {
                get_grid_view(location.value, () => {})
            }

            // Edit
            if (e.key === 'F2') {
                edit();
            }

            // Ctrl+C (Copy)
            if (e.ctrlKey === true && e.key == 'c') {
                getSelectedFiles();
            }

            // Ctrl+V (Paste)
            if (e.ctrlKey === true && e.key == 'v') {
                paste();
            }

            // Escape (Cancel)
            if (e.key == 'Escape') {
                // Clear Arrays
                selected_files_arr = [];
                copy_arr = [];
            }

            // Nagigate back
            // if (e.key === 'Backspace') {
            //     location.value = path.dirname(location.value)
            //     get_grid_view(location.value)
            // }

        })

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

        sidebarHome();

    } catch (err) {

    }

});