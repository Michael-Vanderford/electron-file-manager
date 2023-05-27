const { ipcRenderer, shell, clipboard } = require('electron');
const { exec, execSync } = require('child_process');
const path       = require('path');
const fs         = require('fs');
const os         = require('os');
const DragSelect = require('dragselect');
const gio_utils  = require('./utils/gio.js');
// const gio        = require('./gio/build/Release/gio');

// Global Arrays
let selected_files_arr  = [];
let copy_arr_overwrite  = [];
let copy_arr            = [];
let copy_overwrite_arr  = [];

let ds;
let sort = 'date';

let view = 'grid';
if (localStorage.getItem('view') == null) {
    localStorage.setItem('view', view);
} else {
    view = localStorage.getItem('view')
}

// IPC ///////////////////////////////////////////////////////////////////

// Get Settings
let settings = []
ipcRenderer.on('settings', (e, settings_data) => {
    settings = settings_data;
})

// Refresh on theme change
ipcRenderer.on('theme_changed', (e) => {
    if (localStorage.getItem('location' !== null)) {
        getView(localStorage.getItem('location'), () => {})
    }
})

ipcRenderer.on('new_folder', (e, file) => {

    let folder_grid = document.getElementById('folder_grid');
    let card = getCardGio(file);
    folder_grid.prepend(card);

    let input = card.querySelector('.input');
    let header = card.querySelector('.header');

    header.classList.add('hidden');
    input.classList.remove('hidden');

    header.classList.add('hidden');
        input.classList.remove('hidden');

        input.select()
        input.focus();

        input.addEventListener('change', (e) => {

            console.log('running rename')

            let location = document.getElementById('location');
            let source = file.href;
            let destination = path.format({dir: location.value, base: path.basename(e.target.value)}); //path.join(location.value, path.basename(e.target.value))
            ipcRenderer.send('rename', source, destination);

        })

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Escape') {
                input.value = path.basename(file.href);
                header.classList.remove('hidden');
                input.classList.add('hidden');
            }
        })

})

// Properties
ipcRenderer.on('properties', (e, properties) => {
    getProperties(properties)
})

// Toggle Hidden
ipcRenderer.on('toggle_hidden', (e) => {
    toggleHidden();
})

// Files
ipcRenderer.on('get_files', (e, dirents) => {
    console.log('dirents', dirents);
})

// Returns Files and Folders ot the main view
ipcRenderer.on('ls', (e, dirents) => {

    console.log('running ls');

    let location = document.getElementById('location');
    let slider = document.getElementById('slider')

    let folder_grid = document.getElementById('folder_grid');
    let file_grid = document.getElementById('file_grid');

    let hidden_folder_grid = document.getElementById('hidden_folder_grid');
    let hidden_file_grid = document.getElementById('hidden_file_grid');

    let grid_view = document.querySelector('.grid_view');
    let list_view = document.querySelector('.list_view');

    msg('');

    folder_grid.classList.add('folder_grid');
    file_grid.classList.add('file_grid');
    hidden_file_grid.classList.add('hidden_file_grid');

    document.title = path.basename(location.value);

    if (view == 'list') {

        list_view.classList.add('active');
        grid_view.classList.remove('active');

        folder_grid.classList.remove('grid');
        file_grid.classList.remove('grid');

        folder_grid.classList.add('grid1');
        file_grid.classList.add('grid1');

        hidden_folder_grid.classList.remove('grid');
        hidden_file_grid.classList.remove('grid');

        hidden_folder_grid.classList.add('grid1');
        hidden_file_grid.classList.add('grid1');

    } else {

        list_view.classList.remove('active');
        grid_view.classList.add('active');

        folder_grid.classList.remove('grid1');
        file_grid.classList.remove('grid1');

        folder_grid.classList.add('grid');
        file_grid.classList.add('grid');

        hidden_folder_grid.classList.remove('grid1');
        hidden_file_grid.classList.remove('grid1');

        hidden_folder_grid.classList.add('grid');
        hidden_file_grid.classList.add('grid');
    }

    let sort_flag = 0;

    folder_grid.innerHTML = ''
    file_grid.innerHTML = ''

    hidden_folder_grid.innerHTML = ''
    hidden_file_grid.innerHTML = ''

    // Sort by date
    if (sort === 'date') {
        dirents.sort((a, b) => {
            if (sort_flag == 0) {
                return b.mtime - a.mtime
            } else {
                return a.mtime - b.mtime
            }
        })
    }

    // // Sort by Name
    // if (sort === 'name') {
    //     dirents.sort((a, b) => {
    //         return a.href.toLocaleLowerCase().localeCompare(b.href.toLocaleLowerCase());
    //     })
    // }

    // // Sort by Size
    // if (sort === 'size') {
    //     dirents.sort((a, b) => {
    //         let s1 = a.size; //parseInt(localStorage.getItem(path.join(dir, a)));
    //         let s2 = b.size; //parseInt(localStorage.getItem(path.join(dir, b)));

    //         if (sort_flag == 0) {
    //             return s2 - s1;
    //         } else {
    //             s1 - s2;
    //         }
    //     })
    // }

    // // Sort by Type
    // if (sort === 'type') {
    //     dirents.sort((a, b) => {
    //         let ext1 = path.extname(path.basename(a.href));
    //         let ext2 = path.extname(path.basename(b.href));
    //         if (ext1 < ext2) return -1;
    //         if (ext1 > ext2) return 1;
    //         if (a.mtime < b.mtime) return -1;
    //         if (a.mtime > b.mtime) return 1;
    //     })
    // }

    // const chunck = 500;
    // let currentidx = 0;

    // const endidx = Math.min(currentidx + chunck, dirents.length);
    // console.log(endidx, 'test')

    // Loop Files Array
    for (let i = 0; i < dirents.length; i++) {
        if (i < 1000) {
            let file = dirents[i]
            let card = getCardGio(file);
            if (file.is_dir) {

                if (file.is_hidden) {
                    console.log(file.name)
                }

                if (file.is_hidden) {
                    hidden_folder_grid.append(card)
                } else {
                    folder_grid.append(card)
                }

                // Call Get Folder Size
                getFolderSize(file.href)

                // this is slowing the load time down dont use for now
                getFolderCount(file.href);

            } else {

                if (file.is_hidden) {
                    hidden_file_grid.append(card)
                } else {
                    file_grid.append(card)
                }

            }
        }
    }

    main.addEventListener('dragover', (e) => {
        e.preventDefault();
    })

    main.addEventListener('drop', (e) => {
        e.preventDefault();
        ipcRenderer.send('main', 1);
        paste(location.value);
    })

    main.append(folder_grid, hidden_folder_grid, file_grid, hidden_file_grid);

    // Set Icon Size
    if (localStorage.getItem('icon_size') !== null) {
        let icon_size = localStorage.getItem('icon_size')
        console.log('icon_size', icon_size);
        slider.value = icon_size;
        resizeIcons(icon_size);
    }

    // watch_dir(location.value);

})

// Get Folder Size
ipcRenderer.on('folder_size', (e, source, folder_size) => {
    // console.log(source, folder_size)
    let card = document.querySelector(`[data-href="${source}"]`)
    let size = card.querySelector('.size')
    size.innerHTML = ''
    size.innerHTML = `${folder_size}`;
})

// Get Folder and File Count
ipcRenderer.on('count', (e, source, item_count) => {
    // console.log(source, item_count)
    let card = document.querySelector(`[data-href="${source}"]`)
    if (card) {
        let count = card.querySelector('.count')
        count.innerHTML = ''
        count.innerHTML = `${item_count} Items`;
    }
})

// Unmount Device
ipcRenderer.on('unmount_device', (e) => {
    let devices = document.getElementById('devices');
    let device_arr = getDevices();
    devices.innerHTML = device_arr;
})

// Get View
ipcRenderer.on('get_view', (e, href) => {
    getView(href, () => {})
})

// Get Workspace
ipcRenderer.on('get_workspace', (e) => {
    getWorkspace();
})

// Remove Workspace
ipcRenderer.on('remove_workspace', (e, href) => {
    ipcRenderer.send('remove_workspace', (e, href));
})

ipcRenderer.on('sort', (e, sort_by) => {
    let location = document.getElementById('location');
    if (sort_by === 'date') {
        sort = 'date';
    }
    if (sort_by == 'name') {
        sort = 'namae'
    }
    if (sort_by == 'size') {
        sort = 'size'
    }
    if (sort_by == 'type') {
        sort = 'type'
    }
    getView(location.value, () => {});
})

// Connect to Network
ipcRenderer.on('connect', (e) => {

    // Init
    let cmd = '';
    let connect = document.querySelector('.connect')
    let chk_pk = document.getElementById('chk_pk')
    let btn_connect = document.getElementById('button_connect')
    let btn_close = document.getElementById('button_close')
    let password = document.getElementById('txt_password')
    btn_connect.tabIndex = 1

    connect.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            window.close()
        }
    })

    btn_close.onclick = (e) => {
        window.close()
    }

    chk_pk.onchange = () => {
        if (chk_pk.checked) {
            password.disabled = true
        } else {
            password.disabled = false
        }
    }

    btn_connect.onclick = (e) => {

        e.preventDefault()

        // Inputs
        let state = 0;
        let conntection_type = document.getElementById('connection_type')
        let server = document.getElementById('txt_server')
        let username = document.getElementById('txt_username')

        let connect_msg = document.getElementById('connect_msg')

        connect_msg.innerHTML = `Connecting to ${server.value}`

        // Process
        let inputs = [].slice.call(document.querySelectorAll('.input, .checkbox'))

        inputs.every(input => {

            if (input.value == '' && input.disabled == false) {
                connect_msg.innerHTML = `${input.placeholder} Required.`, add_br()
                state = 0;
                return false
            } else {
                state = 1
                return true
            }

        })

        // Output
        if (state == 1) {
            if (conntection_type.value == 'ssh') {
                // let cmd = `zenity --password --title="SSH Password" | gio mount ssh://${username.value}@${server.value}`
                cmd = `echo '${password.value}' | gio mount ssh://${username.value}@${server.value}`
            } else if (conntection_type.value == 'smb') {
                cmd = `echo '${username.value}\n${'workgroup'}\n${password.value}\n' | gio mount smb://${server.value}`
            }
            exec(cmd, (err, stdout, stderr) => {
                if (!err) {
                    connect_msg.style.color = 'green';
                    connect_msg.innerHTML = `Connected to ${conntection_type[conntection_type.options.selectedIndex].text} Server.`;

                } else {
                    if (stderr) {
                        connect_msg.innerHTML = stderr;
                    }
                }
            })
        }
        console.log(conntection_type.value);
    }
})

// Msg
ipcRenderer.on('msg', (e, message) => {
    msg(message);
})

// Edit mode
ipcRenderer.on('edit', (e) => {
    edit();
})

ipcRenderer.on('clear', (e) => {
    clear();
})

// Dialog handlers ///////////////////////////////////////////////////////////////////////////

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

// Get Card Gio
ipcRenderer.on('get_card_gio', (e, file) => {

    console.log('running get card gio');

    let folder_grid = document.getElementById('folder_grid');
    let file_grid = document.getElementById('file_grid');
    let card = getCardGio(file);

    if (file.is_dir) {
        folder_grid.prepend(card);
    } else {
        file_grid.prepend(card);
    }

    getFolderCount();
    getFolderSize();
})

// Get Card
ipcRenderer.on('get_card', (e, file) => {

    console.log('running get card')

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

    console.log('running replace card')

    let card = document.querySelector(`[data-href="${href}"]`);
    let newcard = getCard(file);
    card.replaceWith(newcard);
    console.log('card', card, 'new card', newcard)

    // getFolderCount();
    // getFolderSize();

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
            ipcRenderer.send('mkdir', `${path.format({dir: location.value, base: 'New Folder'})}`)
            break;
        }
        case 'copy': {
            getSelectedFiles();
            break
        }
        case 'paste': {
            paste(location.value);
            break;
        }
        case 'delete': {
            getSelectedFiles();
            ipcRenderer.send('delete', (selected_files_arr));
            selected_files_arr = []
            break;
        }
        case 'terminal': {
            let cards = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')
            if (cards.length > 0) {
                cards.forEach(card => {
                    exec(`gnome-terminal --working-directory="${card.dataset.href}"`, (error, data, getter) => { });
                })
            } else {
                exec(`gnome-terminal --working-directory="${location.value}"`, (error, data, getter) => { });
            }
        }
        case 'connect': {
            ipcRenderer.send('connect');
        }
        case 'add_workspace': {
            getSelectedFiles();
            ipcRenderer.send('add_workspace', selected_files_arr);
            clear()
        }
        case 'compress': {
            compress();
        }
    }

    clearHighlight();

})

// Functions //////////////////////////////////////////////////////////////

// Utilities ///////////////////////////////////////////////////////////////

function watch_dir(dir) {
    let fsTimeout
    let watcher = fs.watch(dir, (e, filename) => {
        console.log(e)
        let href = path.join(dir, filename);
        ipcRenderer.send('get_card_gio', href);
        fsTimeout = setTimeout(function() {
            fsTimeout = null
            // fs.unwatchFile(dir, )
        }, 5000)
    })
}

function compress() {

    let location = document.getElementById('location');
    let destination = '';
    let file_list = '';

    getSelectedFiles()
    selected_files_arr.forEach((item, idx) => {
        if (idx == 0) {
            destination = path.basename(item);
            destination = destination.substring(0, destination.length - path.extname(destination).length) + '.tar.gz';
            console.log(destination);
        }
        file_list += "'" + path.basename(item) + "' ";

    })
    selected_files_arr = [];
    console.log('file list', file_list);

    // let cmd_size = 'cd "' + location.value + '"; tar czf "' + file_name + '" ' + file_list + ' | wc -c';
    // exec(cmd_size, (err, stdout) => {
    //     stdout.on('data', (res) => {
    //         console.log('compressed size', res)
    //     })
    // })

    // Create compressed file
    let cmd = 'cd "' + location.value + '"; tar czf "' + destination + '" ' + file_list;
    console.log(cmd);
    exec(cmd, (err, stdout) => {
        if (err) {
            console.log(err);
        } else {
            ipcRenderer.send('get_card_gio',path.format({dir: location.value, base: destination}))
        }

    })

}

var isResizing = false;
var startX, startWidth;

/**
 * Display Loader
 */

function resizeIcons(icon_size) {
    let slider = document.getElementById('slider');
    let cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        let icon = card.querySelector('.icon');
        icon.style.width = `${icon_size}px`;
        icon.style.height = `${icon_size}px`;
    })
    slider.value = icon_size;
    localStorage.setItem('icon_size', icon_size);
}

function show_loader() {

    let loader = document.getElementById("loader")
    loader.classList.add('active')
    loader.style = 'background: transparent !important'

    setTimeout(() => {

        if (loader.classList.contains('active')) {

            hide_loader()
            // notification("Error Reading the Directory. Operation Timed Out")
            // alert('Oh no. Operation timed out!')
        }

    }, 10000);
}

/**
 * Hide Loader
 */
function hide_loader() {
    let loader = document.getElementById("loader")
    loader.classList.remove('active')
}

function add_item(text) {
    let item = add_div();
    item.classList.add('item');
    item.append(text);
    return item;
}

function getProperties(file_properties) {

    let sidebar = document.getElementById('sidebar')
    let cards = document.querySelectorAll('.card')

    sidebar.innerHTML = ''
    sidebar.append(add_header('Properties'))
    sidebar.append(add_item(file_properties.name))
    sidebar.append(add_item(file_properties.href))
    sidebar.append(add_item(file_properties.size))
    sidebar.append(add_item(file_properties.content_type))
    sidebar.append(add_item(file_properties.mtime))
    clear();
}

function toggleHidden() {

    let hidden_folder_grid = document.getElementById('hidden_folder_grid')
    let hidden_file_grid = document.getElementById('hidden_file_grid')
    let show_hidden = document.querySelectorAll('.show_hidden')

    if (hidden_folder_grid.classList.contains('hidden')) {
        hidden_folder_grid.classList.remove('hidden')
        hidden_file_grid.classList.remove('hidden')

        show_hidden.forEach(item => {
            item.classList.add('active')
        })

    } else {
        hidden_folder_grid.classList.add('hidden')
        hidden_file_grid.classList.add('hidden')

        show_hidden.forEach(item => {
            item.classList.remove('active')
        })

    }

}

function initResize(event) {
    isResizing = true;
    var grid = document.getElementsByClassName("grid")[0];
    startX = event.clientX;
    startWidth = parseInt(document.defaultView.getComputedStyle(grid).getPropertyValue("width"), 10);

    document.addEventListener("mousemove", doResize, false);
    document.addEventListener("mouseup", stopResize, false);
}

function doResize(event) {
    if (!isResizing) return;

    var grid = document.getElementsByClassName("grid")[0];
    var width = startWidth + (event.clientX - startX);
    grid.style.width = width + "px";
}

function stopResize() {
    isResizing = false;
    document.removeEventListener("mousemove", doResize, false);
    document.removeEventListener("mouseup", stopResize, false);
}

// Clear Items
function clear() {
    let cards = document.querySelectorAll('.highlight, .highlight_select, .highlight_target, .ds-selected')
    console.log(cards)
    cards.forEach(item => {
        item.classList.remove('highlight', 'highlight_select', 'highlight_target', 'ds-selected')
    })
    copy_arr = [];
    selected_files_arr = [];
    msg('');
}

// Clear Highlighted Cards
function clearHighlight() {
    let cards = document.querySelectorAll('.highlight, .highlight_select, .highlight_target, .ds-selected')
    console.log(cards)
    cards.forEach(item => {
        item.classList.remove('highlight', 'highlight_select', 'highlight_target', 'ds-selected')
    })
}

// Add Div
function add_div() {
    let div = document.createElement('div')
    return div
}

// Add Link
function add_link(href, text) {

    let link = document.createElement('a')
    link.href = href
    link.text = text
    link.title = href

    link.onclick = (e) => {
        e.preventDefault()
    }
    return link
}

// Add Icon
function add_icon(icon_name) {
    let icon = document.createElement('i');
    icon.classList.add('bi', `bi-${icon_name}`, 'icon');

    let icon_names = icon_name.split(',');
    icon_names.forEach(item => {
        icon.classList.add(item)
    })
    return icon
}

// Add Header
function add_header(text) {
    let header = add_div() //document.createElement('h5');
    header.classList.add('header');
    header.title = text
    header.innerHTML = text
    return header;
}

// Get icon theme path
function get_icon_theme() {
    console.log('running icon theme')
    let icon_theme = 'kora';
    let icon_dir = path.join(__dirname, 'assets', 'icons');
    try {
        if (process.platform === 'linux') {
            icon_theme = execSync('gsettings get org.gnome.desktop.interface icon-theme').toString().replace(/'/g, '').trim();
            console.log('icon_theme',icon_theme)
            let search_path = [];
            search_path.push(path.join(os.homedir(), '.local/share/icons'), path.join(os.homedir(), '.icons'), '/usr/share/icons');
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
    if (message === '') {
        msg.classList.add('hidden');
    }

    if (message.indexOf('Error') > -1) {
        msg.classList.add('error')
    } else {
        msg.classList.remove('error')
    }

    msg.innerHTML = message;

    // setTimeout(() => {
    //     msg.innerHTML = ''
    //     msg.classList.add('hidden')
    // }, 3000);

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

// Edit Mode
function edit() {

    getSelectedFiles();
    selected_files_arr.forEach(href => {
        let card = document.querySelector(`[data-href="${href}"]`);
        let header = card.querySelector('.header');
        let header_link = card.querySelector('a');
        let input = card.querySelector('input');

        header.classList.add('hidden');
        input.classList.remove('hidden');

        input.select()
        input.focus();

        input.addEventListener('change', (e) => {

            console.log('running rename')

            let location = document.getElementById('location');
            let source = href;
            let destination = path.format({dir: location.value, base: path.basename(e.target.value)}); //path.join(location.value, path.basename(e.target.value))
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
                quicksearch.classList('hidden')
            }
        })

    })
    selected_files_arr = [];
}

// Sidebar Functions /////////////////////////////////////////////////////////////
function sidebarHome() {

    let sidebar = document.getElementById('sidebar')
    sidebar.innerHTML = ''

    getHome(home => {
        sidebar.append(home)
    })

    // Workspace
    getWorkspace(workspace => {
        sidebar.append(workspace)
    })

    // Get Device
    getDevices(devices => {
        sidebar.append(devices)
    })
}

function getSub(dir) {
    ipcRenderer.send('get_sub', dir);
}

function getSubFolders(dir, callback) {
    ipcRenderer.invoke('get_subfolders', dir).then(dirents => {
        console.log('dir', dirents)
    })
}

// Get Home
function getHome(callback) {

    let location = document.getElementById('location');
    let home_dir = os.homedir();
    let my_computer_arr = ['Home', 'Documents', 'Music', 'Pictures', 'Videos', 'Downloads', 'Recent', 'File System']
    let my_computer_paths_arr = [home_dir, `${path.join(home_dir, 'Documents')}`, `${path.join(home_dir, 'Music')}`, `${path.join(home_dir, 'Pictures')}`, `${path.join(home_dir, 'Videos')}`, `${path.join(home_dir, 'Downloads')}`, 'Recent', '/']
    let my_computer_icons_arr = ['house', 'folder', 'file-music', 'image', 'film', 'download', 'clock-history', 'hdd']
    // let home_chevron_icons_arr = ['chevron-right', 'chevron-right', 'chevron-right', 'chevron-right', 'chevron-right', 'chevron-right', 'chevron-right', 'chevron-right']

    localStorage.setItem('minibar', 'mb_home')

    let home = add_div();
    home.innerHTML = ''
    home.append(add_header('Home'))

    // Get home
    for (let i = 0; i < my_computer_arr.length; i++) {

        let href = my_computer_paths_arr[i]
        console.log(my_computer_arr[i])

        let item = add_div()
        item.classList.add('flex')

        let link = add_link(my_computer_paths_arr[i], my_computer_arr[i])

        item.classList.add('item')
        // item.append(add_icon('chevron-right'), add_icon(my_computer_icons_arr[i].toLocaleLowerCase()), link)
        item.append(add_icon(my_computer_icons_arr[i].toLocaleLowerCase()), link)

        home.append(item)

        item.onclick = () => {

            let items = home.querySelectorAll('.item')
            items.forEach(item => {
                item.classList.remove('active')
            })

            item.classList.add('active')
            if (href === 'Recent') {
                get_recent_files(`${home_dir}/Documents`)
            } else {
                // location.value = my_computer_paths_arr[i];
                getView(my_computer_paths_arr[i], () => {});
            }
        }

        item.draggable = true;
        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            // getView(my_computer_paths_arr[i], () => {});
        })

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.classList.add('highlght_select')
        })

    }

    return callback(home)

}

// Get Workspace
function getWorkspace(callback) {

    ipcRenderer.invoke('get_workspace').then(res => {

        let workspace = document.getElementById('workspace');
        if (!workspace) {
            workspace = add_div(); //document.getElementById('workspace');
            workspace.id = 'workspace'
        }
        workspace.innerHTML = ''
        workspace.append(add_header('Workspace'));

        res.forEach(item => {

            let workspace_item = document.createElement('div');
            workspace_item.classList.add('item');

            let a = document.createElement('a');
            a.href = item.href;
            a.innerHTML = item.name;
            a.preventDefault = true;

            workspace_item.append(add_icon('bookmark'), a);
            workspace.append(workspace_item);

            // Show Workspace Context Menu
            workspace_item.addEventListener( 'contextmenu', (e) => {
                ipcRenderer.send('workspace_menu', item);
                workspace_item.classList.add('highlight_select')
            });

            // Open Workspace Item
            workspace_item.addEventListener('click', (e) => {
                e.preventDefault();
                gio_utils.get_file(item.href, file => {
                    if (file.type === 'directory') {
                        getView(file.href, () => {});
                    } else {
                        ipcRenderer.invoke('open', file.href);
                    }
                })
            })
        })
        return callback(workspace);
    })

}

// Get Devices
function getDevices(callback) {

    let location = document.getElementById('location');
    let devices = document.createElement('devices');
    devices.innerHTML = ''
    devices.append(add_header('Devices'));

    ipcRenderer.invoke('get_devices').then(device_arr => {
        device_arr.forEach(item => {

            let device = document.createElement('div');


            let a = document.createElement('a');
            a.preventDefault = true;
            a.href = item.href;
            a.innerHTML = item.name;

            device.classList.add('item');

            if (item.type == 0) {
                device.append(add_icon('usb-symbol'), a);
            } else {
                device.append(add_icon('hdd-network'), a);
            }

            device.addEventListener('click', (e) => {
                e.preventDefault();
                location.value = item.href;
                getView(item.href, () => {});
            })

            device.addEventListener('contextmenu', (e) => {
                ipcRenderer.send('device_menu', item.href);
                device.classList.add('highlight_select');
            })

            devices.append(device);
        })

        return callback(devices)

    })

}

// Main Functions ////////////////////////////////////////////////////////////////

// Get Files
function getFiles(source, callback) {
    // ipcRenderer.send('get_files', source);
    // ipcRenderer.on('get_files', (e, dirents) => {
    //     let filter = dirents.filter(x => x.is_hidden != 1);
    //     return callback(filter)
    // })
}

/**
 * Add Highlighted Divs to selected_files_arr[]
 */
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

// Add Button
function add_button(text) {
    let button = document.createElement('input')
    button.type = 'button'
    button.classList.add('button')
    button.value = text
    return button
}

function paste(destination) {

    let overwrite = 0;
    let location = destination; //document.getElementById('location');
    if (selected_files_arr.length > 0) {
        for(let i = 0; i < selected_files_arr.length; i++) {

            let source = selected_files_arr[i];
            let destination = path.format({dir: location, base: path.basename(selected_files_arr[i])});

            gio_utils.get_file(source, file => {

                console.log(source, destination)

                // Directory
                if (file.type === 'directory') {
                    if (source == destination) {
                        // destination = `${destination} (1)`;
                    } else {
                        console.log('exists',gio_utils.exists(destination))
                        if (gio_utils.exists(destination)) {
                            msg('Error: Overwrite not yet implmeneted');
                            overwrite = 1;
                        }
                    }

                // Files
                } else {
                    if (source == destination) {
                        destination = path.dirname(destination) + '/' + path.basename(destination, path.extname(destination)) + ' (Copy)' + path.extname(destination);
                    } else {
                        if (gio_utils.exists(destination)) {
                            msg('Error: Overwritet not yet implmeneted');
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
                    console.log('confirm overwrite 12312313')
                    copy_overwrite_arr.push(copy_data)
                }

                if (i == selected_files_arr.length - 1) {
                    if (copy_arr.length > 0) {
                        console.log('sending array', copy_arr);
                        ipcRenderer.send('paste', copy_arr);
                    }

                    if (copy_overwrite_arr.length > 0) {
                        console.log('confirm overwrite')
                        ipcRenderer.send('confirm_overwrite', copy_overwrite_arr);
                    }

                    copy_arr = [];
                    copy_overwrite_arr = [];
                    selected_files_arr = [];

                }


                // Reset variables
                overwrite = 0;

            })

        }

    } else {
        msg(`Nothing to Paste`);
    }

    clearHighlight();

}

function move(destination) {

    let location = destination; //document.getElementById('location');

    if (selected_files_arr.length > 0) {
        for(let i = 0; i < selected_files_arr.length; i++) {
            let copy_data = {
                source: selected_files_arr[i],
                destination: path.format({dir: location, base: path.basename(selected_files_arr[i])})
            }
            copy_arr.push(copy_data);
        }
        console.log('sending array', copy_arr);
        ipcRenderer.send('move', copy_arr);
        selected_files_arr = [];
        copy_arr = [];
    } else {
        msg(`Nothing to Paste`);
    }

}

// Get Folder Count
function getFolderCount() {
    let cards = document.querySelectorAll('.folder_card')
    cards.forEach(card => {
        // console.log(card.dataset.href)
        ipcRenderer.send('count', card.dataset.href);
    })
}

// Load Folder Size Seperatley
function getFolderSize(href) {

    // Note: Dont do this may try returning calculated size using gio in cpp
    // let cards = document.querySelectorAll('.folder_card')
    // cards.forEach(card => {
    //     ipcRenderer.send('get_folder_size', card.dataset.href);
    // })

    ipcRenderer.invoke('get_folder_size', (href)).then(res => {
        let card = document.querySelector(`[data-href="${href}"]`);
        if (card) {
            let size = card.querySelector('.size');
            size.innerHTML = '';

            if (href.indexOf('sftp:') > -1) {
                size.innerHTML = ''
            } else {
                size.append(getFileSize(res));
            }

        }
    })
}

/**
 * Get Card for Grid View
 * @param {File} file
 * @returns File Card
 */
function getCardGio(file) {

    console.log(file)

    let location    = document.getElementById('location');
    let is_dir      = 0;

    let card    = add_div();
    let content = add_div();
    let icon    = add_div();
    let img     = document.createElement('img');
    let header  = add_div();
    let href    = document.createElement('a');
    let mtime   = add_div();
    let atime   = add_div();
    let ctime   = add_div();
    let size    = add_div();
    let type    = add_div();
    let count   = add_div();
    let input   = document.createElement('input');
    let tooltip = add_div();

    // todo: pull options so we can control column visibility
    card.classList.add('card');
    header.classList.add('header', 'item');
    input.classList.add('input', 'item', 'hidden');
    img.classList.add('icon');
    mtime.classList.add('date', 'item');
    atime.classList.add('date', 'item', 'hidden');
    ctime.classList.add('date', 'item', 'hidden');
    size.classList.add('size', 'item');
    type.classList.add('type', 'item', 'hidden');
    count.classList.add('count', 'item');
    content.classList.add('content');
    tooltip.classList.add('tooltip', 'hidden');

    card.style.opacity = 1

    href.href = file.href;
    href.innerHTML = path.basename(file.href);

    input.spellcheck = false;
    input.type = 'text';
    input.dataset.href = file.href;
    input.value = path.basename(file.href);

    href.draggable = false;
    img.draggable = false;
    card.draggable = true;
    card.dataset.href = file.href;

    // tooltip.append(`Name: ${path.basename(file.href)}`);
    let tooltip_timeout;

    // Mouse Over
    card.addEventListener('mouseover', (e) => {

        e.preventDefault();
        e.stopPropagation();
        card.classList.add('highlight');

        title =
            'Name: ' + path.basename(file.href) +
            '\n' +
            'Size: ' + getFileSize(file.size) +
            '\n' +
            'Accessed: ' + getDateTime(file.atime) +
            '\n' +
            'Modified: ' + getDateTime(file.mtime) +
            '\n' +
            'Created: ' + getDateTime(file.ctime) +
            '\n' +
            'Type: ' + file.content_type

        card.title = title;

        // tooltip_timeout = setTimeout(() => {
        //     var x = e.clientX - 75;
        //     var y = e.clientY + 20;
        //     tooltip.style.left = x + "px";
        //     tooltip.style.top = y + "px";
        //     tooltip.classList.remove('hidden')
        //     tooltip.innerText = title;
        // }, 1000);

    })

    card.addEventListener('mouseout', (e) => {
        clearTimeout(tooltip_timeout);
        tooltip.classList.add('hidden');
        card.classList.remove('highlight');
    })

    // Mouse Leave
    card.addEventListener('mouseleave', (e) => {
        // card.classList.remove('highlight');
        // clearTimeout(tooltip_timeout);
        // tooltip.classList.add('hidden');
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
        // e.preventDefault();
        clearTimeout(tooltip_timeout);
        getSelectedFiles();
        // selected_files_arr.forEach(href => {
            // e.dataTransfer.setData('application/x-electron-file', JSON.stringify([{ path: href }]));
            // ipcRenderer.send('ondragstart', path.join(process.cwd(), href))
            // e.target.classList.add('dragged')
        // })
    })

    card.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
    })

    card.addEventListener('dragover', (e) => {
        e.preventDefault();

        if (is_dir && !card.classList.contains('highlight')) {
            card.classList.add('highlight_target');
            if (e.ctrlKey) {
                e.dataTransfer.dropEffect = "copy";
                msg(`Copy Item to "${path.basename(file.href)}"`);
            } else {
                e.dataTransfer.dropEffect = "move";
                msg(`Move Item to "${path.basename(file.href)}"`);
            }

        }
    })

    card.addEventListener('dragleave', (e) => {
        card.classList.remove('highlight_target');
        // ipcRenderer.send('main', 1);
        msg('');
    })

    card.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ipcRenderer.send('main', 0)
        if (!card.classList.contains('highlight')) {
            if (e.ctrlKey) {
                paste(file.href);
            } else {
                move(file.href);
            }
        }
    })

    try {
        ds.addSelectables(card)
    } catch (err) {
    }

    mtime.append(getDateTime(file.mtime));
    ctime.append(getDateTime(file.ctime));
    atime.append(getDateTime(file.atime));
    type.append(file.content_type);

    icon.append(img);
    header.append(href);

    // Directory
    if (file.is_dir) {

        is_dir = 1;
        img.src = folder_icon;

        card.classList.add('folder_card')

        // Href
        href.addEventListener('click', (e) => {
            e.preventDefault();
            location.value = file.href;
            location.dispatchEvent(new Event('change'));
        })

        // Img
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
            ipcRenderer.send('folder_menu', file.href);
        })

    // Files
    } else {
        // Get Icon
        try {
            // console.log(file.content-type)
            if (file.content_type.indexOf('image/') > -1) {

                console.log('whererergeger')

                img.classList.add('lazy');
                img.dataset.src = file.href;
                // img.src = file.href;
            } else {
                ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                    img.src = res;
                })
            }
            if (file.content_type === 'image/svg+xml') {
                img.src = file.href;
                img.classList.add('svg')
            }
        } catch (err) {
            ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                img.src = res;
            })
            console.log('fix images for sftp files')
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
            ipcRenderer.send('file_menu', file);
        })
    }

    if (view == 'list') {
        card.classList.add('list');
        content.classList.add('list');
        content.append(header, input, mtime, ctime, atime, size, type, count);
    }

    if (view === 'grid') {
        card.classList.remove('list');
        content.classList.remove('list');
        content.append(header, input, mtime, ctime, atime, size, count);
    }

    card.append(icon, content, tooltip);
    ds.addSelectables(card)
    lazyload();

    return card;
}

/**
 * Get Card for Grid View
 * @param {File} file
 * @returns File Card
 */
function getCard(file) {

    console.log(file)

    let location    = document.getElementById('location');
    let is_dir      = 0;

    let card    = document.createElement('div');
    let title   = document.createElement('div')
    let content = document.createElement('div')
    let icon    = document.createElement('div');
    let img     = document.createElement('img');
    let header  = document.createElement('div');
    let href    = document.createElement('a');
    let mtime   = document.createElement('div');
    let atime   = document.createElement('div');
    let ctime   = document.createElement('div');
    let size    = document.createElement('div');
    let count   = document.createElement('div');
    let input   = document.createElement('input');

    card.classList.add('card');
    title.classList.add('title', 'hidden')
    header.classList.add('header', 'item');
    input.classList.add('input', 'item', 'hidden');
    img.classList.add('icon');
    mtime.classList.add('date', 'item');
    atime.classList.add('date', 'item', 'hidden');
    ctime.classList.add('date', 'item', 'hidden');
    size.classList.add('size', 'item');
    count.classList.add('count', 'item');
    content.classList.add('content');

    card.style.opacity = 1

    if (view == 'list') {
        card.classList.add('list');
        content.classList.add('list');
    }

    if (view === 'grid') {
        card.classList.remove('list');
        content.classList.remove('list');
    }

    href.href = file.href;
    href.innerHTML = path.basename(file.href);

    input.spellcheck = false;
    input.type = 'text';
    input.dataset.href = file.href;
    input.value = path.basename(file.href);

    href.draggable = false;
    img.draggable = false;
    card.draggable = true;
    card.dataset.href = file.href;

    // Mouse Over
    card.addEventListener('mouseover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.classList.add('highlight');
        if (is_dir) {
            ipcRenderer.send('main', 0);
        }
        // size = get_file_size(localStorage.getItem(href));
        // title.classList.remove('hidden');
        // title.innerHTML = ''
        card.title =
            'Name: ' + path.basename(file.href) +
            '\n' +
            'Size: ' + getFileSize(file.size) +
            '\n' +
            'Accessed: ' + getDateTime(file["time::access"]) +
            '\n' +
            'Modified: ' + getDateTime(file["time::modified"]) +
            '\n' +
            'Created: ' + getDateTime(file["time::created"])
    })

    // Mouse Leave
    card.addEventListener('mouseleave', (e) => {
        card.classList.remove('highlight');
        title.classList.add('hidden');

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
        // e.preventDefault();
        getSelectedFiles();
        // selected_files_arr.forEach(href => {
            // e.dataTransfer.setData('application/x-electron-file', JSON.stringify([{ path: href }]));
            // ipcRenderer.send('ondragstart', path.join(process.cwd(), href))
            // e.target.classList.add('dragged')
        // })
    })

    card.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        tooltip.classList.add('hidden')
    })

    card.addEventListener('dragover', (e) => {
        e.preventDefault();

        if (is_dir && !card.classList.contains('highlight')) {
            card.classList.add('highlight_target');
            if (e.ctrlKey) {
                e.dataTransfer.dropEffect = "copy";
                msg(`Copy Item to "${path.basename(file.href)}"`);
            } else {
                e.dataTransfer.dropEffect = "move";
                msg(`Move Item to "${path.basename(file.href)}"`);
            }

        }
    })

    card.addEventListener('dragleave', (e) => {
        card.classList.remove('highlight_target');
        // ipcRenderer.send('main', 1);
        msg('');
    })

    card.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ipcRenderer.send('main', 0);
        if (!card.classList.contains('highlight')) {
            if (e.ctrlKey) {
                paste(file.href);
            } else {
                move(file.href);
            }
        }
    })

    try {
        ds.addSelectables(card)
    } catch (err) {
    }

    mtime.append(getDateTime(file["time::modified"]));
    ctime.append(getDateTime(file["time::created"]));
    atime.append(getDateTime(file["time::access"]));

    icon.append(img);
    header.append(href);

    content.append(header, input, mtime, ctime, atime, size, count);
    card.append(icon, content);

    if (file.type == 'directory') {

        is_dir = 1;
        img.src = folder_icon;

        card.classList.add('folder_card')

        // Href
        href.addEventListener('click', (e) => {
            e.preventDefault();
            location.value = file.href;
            location.dispatchEvent(new Event('change'));
        })

        // Img
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
            ipcRenderer.send('folder_menu', file.href);
        })


    } else {
        // Get Icon
        try {
            if (file["standard::content-type"].indexOf('image') > -1) {
                img.classList.add('lazy');
                img.dataset.src = file.href;
                // img.src = file.href;
            } else {
                ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                    img.src = res;
                })
            }
            if (file["standard::content-type"] === 'image/svg+xml') {
                img.src = file.href;
                img.classList.add('svg')
            }
        } catch (err) {
            ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                img.src = res;
            })
            console.log('fix images for sftp files')
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
            ipcRenderer.send('file_menu', file);
        })
    }


    ds.addSelectables(card)

    lazyload();

    return card;
}

/**
 * Get Grid View
 * @param {*} dir
 * @param {*} callback
 */
function getView(dir, callback) {

    // Moved code
    // reference: ipcRenderer.on('ls', (e, dirents)
    // getSubFolders(dir, () => {});

    console.log('running getview', dir)
    show_loader();
    ipcRenderer.send('get_files', dir);
    return callback;

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

function lazyload() {
    // LAZY LOAD IMAGES
    let lazyImages = [].slice.call(document.querySelectorAll(".lazy"))
    // CHECK IF WINDOW
    if ("IntersectionObserver" in window) {
        // GET REFERENCE TO LAZY IMAGE
        let lazyImageObserver = new IntersectionObserver(function (entries, observer) {
            entries.forEach((e, idx) => {
                if (e.isIntersecting) {
                    let lazyImage = e.target;
                    lazyImage.src = lazyImage.dataset.src;
                    lazyImage.classList.remove("lazy");
                    lazyImageObserver.unobserve(lazyImage);
                }
            })
        })
        // THIS RUNS ON INITIAL LOAD
        lazyImages.forEach(function (lazyImage) {
            lazyImageObserver.observe(lazyImage)
        })
    }
}

// Main - This runs after html page loads.
window.addEventListener('DOMContentLoaded', (e) => {

    try {

        // Primary Controls
        let location = document.getElementById('location');
        let main = document.getElementById('main');
        let sidebar = document.getElementById('sidebar');
        let quicksearch = document.getElementById('quicksearch');
        let txt_quicksearch = document.getElementById('txt_quicksearch');
        let slider = document.getElementById('slider');

        let minibar = document.getElementById('minibar')
        let mb_items = minibar.querySelectorAll('.item')
        mb_items.forEach(mb_item => {

            mb_item.addEventListener('click', (e) => {

                switch (mb_item.id) {
                    case 'mb_home': {
                        sidebarHome();
                        break;
                    }
                    case 'mb_workspace': {
                        getWorkspace(workspace => {
                            sidebar.innerHTML = ''
                            sidebar.append(workspace)
                        })
                    }
                }

            })

            // if (mb_item.id === 'mb_workspace') {
            //     sidebar.innerHTML = ''
            //     getWorkspace(workspace => {
            //         sidebar.append(workspace)
            //     })

            // }
        })

        ipcRenderer.send('get_settings');

        // Local Storage //////////////////////////////////////////////
        // Handle Location
        if (localStorage.getItem('location') !== null) {
            // todo: validate path before reusing
            location.value = localStorage.getItem('location');
        } else {
            location.value = os.homedir();
            localStorage.setItem('location', location.value);
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

        // Music
        let music = document.querySelectorAll('.music');
        music.forEach(item => {
            item.onclick = (e) => {
                e.preventDefault();
                location.value = path.join(os.homedir(), 'Music');
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

        let videos = document.querySelectorAll('.videos');
        videos.forEach(item => {
            item.onclick = (e) => {
                e.preventDefault();
                location.value = path.join(os.homedir(), 'Videos');
                location.dispatchEvent(new Event('change'));
            }
        });

        let list_view = document.querySelectorAll('.list_view');
        list_view.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                view = 'list';
                localStorage.setItem('view', view);
                getView(location.value, () => {});
            })
        })

        let grid_view = document.querySelectorAll('.grid_view');
        grid_view.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                view = 'grid';
                localStorage.setItem('view', view);
                getView(location.value, () => {});
            })
        })



        let show_hidden = document.querySelectorAll('.show_hidden')
        show_hidden.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                // localStorage.setItem('show_hidden', view);
                toggleHidden()
            })
        })

        let left = document.getElementById('left');
        left.addEventListener('click', (e) => {
            location.value = path.dirname(location.value);
            getView(location.value, () => {});
            localStorage.setItem('location', location.value);
        })

        /////////////////////////////////////////////////////////////////

        // Main Context Menu
        main.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            ipcRenderer.send('main_menu', location.value);
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
        document.addEventListener('keydown', (e) => {

            let keycode;
            ipcRenderer.invoke('settings').then(res => {
                shortcut =  res.keyboard_shortcuts;
            }).then(() => {

                // Escape
                if (e.key == shortcut.Escape) {

                    // console.log('whathathathetaha')
                    clear();
                    // clearContextMenu(e);
                }

                // Reload
                if (e.key === 'F5') {
                    getView(location.value, () => {})
                }

                // Edit
                if (e.key === 'F2') {
                    edit();
                }

                // Ctrl+C (Copy)
                if (e.ctrlKey === true && e.key.toLocaleLowerCase() == 'c') {
                    getSelectedFiles();
                }

                // Ctrl+X (Cut)
                if (e.ctrlKey === true && e.key == 'x') {
                    getSelectedFiles();
                    selected_files_arr.forEach(item => {
                        let card = document.querySelector(`[data-href="${item}"]`)
                        card.style = 'opacity: 0.6 !important';
                    })
                }

                // Ctrl+V (Paste)
                if (e.ctrlKey === true && e.key.toLowerCase() == 'v') {
                    ipcRenderer.send('main', 1);
                    paste(location.value);
                }

                // Escape (Cancel)
                if (e.key == 'Escape') {
                    // Clear Arrays
                    selected_files_arr = [];
                    copy_arr = [];
                    msg('');
                }

                // Show / Hide Sidebar
                if (e.ctrlKey === true && e.key === 'b') {
                    if (sidebar.classList.contains('hidden')) {
                        sidebar.classList.remove('hidden');
                    } else {
                        sidebar.classList.add('hidden');
                    }
                }

                // New Window
                if (e.ctrlKey === true && e.key === 'n') {
                    ipcRenderer.send('new_window');
                }

                // Selet All
                if (e.ctrlKey === true && e.key == 'a') {
                    e.preventDefault();
                    let cards = main.querySelectorAll('.card')
                    cards.forEach(item => {
                        item.classList.add('highlight')
                    })
                }

                if (e.key && (!e.ctrlKey || e.shiftKey || e.altKey) &&  /^[A-Za-z]$/.test(e.key)) {
                    quicksearch.classList.remove('hidden')
                    txt_quicksearch.focus();
                }


            })

        })

        // // Get local storage for icon size
        let init_size = 32;
        // if (localStorage.getItem('icon_size') !== null) {
        //     scaleIcons(`${localStorage.getItem('icon_size')}`)
        // } else {
        //     scaleIcons(`${init_size}px`)
        //     localStorage.setItem('icon_size', init_size);
        // }

        document.addEventListener('wheel', (e) => {
            if (e.ctrlKey && e.deltaY < 0) {
                if ((init_size) < 64) {
                    init_size += 16
                    resizeIcons(init_size);
                    localStorage.setItem('icon_size', init_size);
                    console.log("scrolling up", init_size)
                }
            } else if (e.ctrlKey && e.deltaY > 0) {
                if ((init_size) > 16) {
                    init_size -= 16
                    resizeIcons(init_size);
                    localStorage.setItem('icon_size', init_size);
                    console.log("scrolling up", init_size)
                }
            }
        })

        slider.addEventListener('change', (e) => {
            init_size = slider.value;
            resizeIcons(init_size);
            localStorage.setItem('icon_size', init_size);
        })

        txt_quicksearch.addEventListener('keydown', (e) => {
            if (/^[A-Za-z]$/.test(e.key)) {
                // txt_quicksearch.value = e.key
            }

            if (e.key === 'Enter') {
                let cards = document.querySelectorAll('.card')
                cards.forEach(card => {
                    console.log(txt_quicksearch.value)
                    if (card.dataset.href.toLocaleLowerCase().indexOf(txt_quicksearch.value) > -1) {
                        card.classList.add('highlight');
                    }
                })
                quicksearch.classList.add('hidden');
                txt_quicksearch.value = '';
            }

            if (e.key === 'Escape') {
                quicksearch.classList.add('hidden')
            }

        })

        // document.addEventListener('keydown', (e) => {
        //     e.preventDefault();
        //     e.stopPropagation()
        //     // Nagigate back
        //     if (e.key === 'Backspace') {
        //         getView(path.dirname(location.value))
        //     }
        // })

        if (location.value != "") {
            getView(location.value, () => {})
        }

        location.onchange = () => {
            if (location.value != "") {
                getView(location.value, () => {})
                localStorage.setItem('location', location.value)
            }
        }

        sidebarHome();

        // INITIALIZE DRAG SELECT
        try {

            ds = new DragSelect({
                area: main,
                selectorClass: 'drag_select',
                keyboardDragSpeed: 0,
            })

            let sc = 0;
            ds.subscribe('elementselect', (e) => {
                // msg(`${++sc} Items Selected`)
            });
            ds.subscribe('elementunselect', (e) => {
                if (--sc == 0) {
                    msg('')
                } else {
                    // msg(`${sc} Items Selected`)
                }

            });

            ds.subscribe('predragmove', ({ isDragging, isDraggingKeyboard }) => {
                if (isDragging || isDraggingKeyboard) {
                    ds.break()
                } else {

                }
            })


        } catch (err) {
            console.log(err);
        }

        // Resize Sidebar
        let sidebar_width = '350';
        if (localStorage.getItem('sidebar_width') === null) {
            localStorage.setItem('sidebar_width', sidebar_width);
        } else {
            sidebar_width = localStorage.getItem('sidebar_width');
            sidebar.style = `width: ${sidebar_width}px;`
        }

        if (sidebar) {
            let resizer = document.getElementById('draghandle')
            resizer.addEventListener('mousedown', initResize, false)
        }

        /* Init resize sidebar */
        function initResize(e) {
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('mousemove', Resize, false);
            window.addEventListener('mouseup', stopResize, false);
        }

        /* Resize sidebar */
        function Resize(e) {
            if (e.clientX < 400) {
                sidebar.style.width = (e.clientX - sidebar.offsetLeft) + 'px';
                // main.style.marginLeft = (e.clientX - (sidebar.offsetLeft - 40)) + 'px'
            }
        }

        /* Stop resize of sidebar */
        function stopResize(e) {
            console.log('running')
            window.removeEventListener('mousemove', Resize, false);
            window.removeEventListener('mouseup', stopResize, false);
            localStorage.setItem('sidebar_width', sidebar.clientWidth);
            console.log(sidebar.clientWidth)
        }

    } catch (err) {

    }

});