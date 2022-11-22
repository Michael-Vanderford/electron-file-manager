
/*
    todo: System and fs calls need to start getting moved into main.js
    Electron v20. seems to be breaking fs and path
*/
const { BrowserWindow, Notification, getCurrentWindow, globalShortcut, ipcRenderer, contextBridge, Menu, shell, ipcMain, app, MenuItem, menu, TouchBarSegmentedControl, desktopCapturer, clipboard, nativeImage } = require('electron')
const { exec, execSync, spawn, execFileSync }   = require("child_process");
const { dirname, basename, normalize }          = require('path');
const fs                                        = require('fs');
const stat                                      = require('fs')
const watch                                     = require('fs')
const url                                       = require('url')
const path                                      = require('path')
const Mousetrap                                 = require('mousetrap');
const os                                        = require('os');
const Chart                                     = require('chart.js')
const DragSelect                                = require('dragselect')
const open                                      = require('open')
const readline                                  = require('readline');
const mime                                      = require('mime-types');
const im                                        = require('imagemagick');
const crypto                                    = require('crypto')

// Arrays
let chart_labels    = []
let chart_data      = []
let directories     = []
let files           = []

// COUNTERS
let idx             = 0

// todo: check if this is being used
let options = {
    sort:   1,
    search: ''
}

// todo: check if this is being used
let prev_target = '';
let target      = '';

// ACTIVE LINK BEING HOVERED OVER FOR CONTEXT MENU
// todo: this should replace source and target i think. needs review
let active_href = '';

// USE VAR GLOBAL
// USE LET INSIDE FUNCTIONS TO REDECLARE VARIABLE
let source              = '';
let card_id             = 0;
let mode                = 0;

// PROGRESS VARS
let intervalid          = 0;

// GLOBAL VARS
// HISTORY ARRAY
let history_arr         = []
let files_arr           = []

// CUT / COPY
let state               = 0;
let cut_files           = 0;

let prev_card
let destination

// COUNTERS FOR NAVIGATION
let nc                  = 1
let nc2                 = 0
let adj                 = 0
let is_folder_card      = 1

// FOLDER / FILE COUNTERS
let folder_count        = 0
let hidden_folder_count = 0
let file_count          = 0
let hidden_file_count   = 0

// PAGING VARIABLES
let pagesize            = 100
let page                = 1
let start_path          = ''

// Flags
let historize           = 1

let thumbnails_dir      = ''
ipcRenderer.invoke('get_thumbnails_directory').then(res => {
    thumbnails_dir = res
})

let settings = JSON.parse(fs.readFileSync('settings.json', {encoding:'utf8', flag:'r'}));


ipcRenderer.on('item_count', (e, data) => {

    let contents = document.querySelector('[data-contents="' + data.filename + '"]');
    contents.innerHTML = data.folder_count.toLocaleString() + ' Folder/s ' + data.file_count.toLocaleString() + ' File/s';

})

// Add new tab
ipcRenderer.on('open_new_tab', (e, label) => {
    add_tab(label)
})

// Start drag select
ipcRenderer.on('ds_start', (e) => {
    ds.start()
})

// ON START PATH
ipcRenderer.on('start_path', (e, res) => {
    if (res) {
        start_path = res
    }
})

ipcRenderer.on('get_view', (e, dir) => {
    get_view(dir)
})

ipcRenderer.on('view', (e, view) => {
    get_view(view)
})

// On notification
ipcRenderer.on('notification', (e, msg) => {
    notification(msg)
})

// Update Card
ipcRenderer.on('update_card', (e, href) => {
    try {
        update_card(href)
    } catch (err) {
    }
})

// On update cards
ipcRenderer.on('update_cards', (e) => {
    update_cards(document.getElementById('main_view'));
})

// On clear copy array
ipcRenderer.on('clear_copy_arr', (e) => {
    clear_copy_arr();
})

// REMOVE CARD
ipcRenderer.on('remove_card', (e, source) => {
    try {

        let cards = document.querySelectorAll('[data-href="' + source + '"]');
        cards.forEach(item => {
            let col = item.closest('.column');
            col.remove();
        })

    } catch (err) {

    }
})

// CONFIRM OVERWRITE DIALOG
ipcRenderer.on('confirming_overwrite', (e, data, copy_files_arr) => {

    let confirm_dialog = document.getElementById('confirm')

    let source_stats = fs.statSync(data.source)
    let destination_stats = fs.statSync(data.destination)

    // CHECKBOX REPLACE
    let chk_replace_div = add_checkbox('chk_replace', 'Apply this action to all files and folders');

    // CANCEL BUTTON
    let btn_cancel = add_button('btn_cancel', 'Cancel');
    btn_cancel.addEventListener('click', (e) => {
        if (is_checked) {
            ipcRenderer.send('overwrite_canceled_all', copy_files_arr);
        } else {
            ipcRenderer.send('overwrite_canceled', copy_files_arr);
        }

    })

    // CONFIRM BUTTON
    let btn_replace = add_button('btn_replace', 'Replace');
    btn_replace.classList.add('primary');
    btn_replace.addEventListener('click', (e) => {

        if (is_checked) {
            ipcRenderer.send('overwrite_confirmed_all', copy_files_arr);
        } else {
            ipcRenderer.send('overwrite_confirmed', data, copy_files_arr);
        }

    })

    // SKIP BUTTON
    let btn_skip = add_button('btn_skip', 'Skip')
    btn_skip.addEventListener('click', (e) => {
        if (is_checked) {
            ipcRenderer.send('overwrite_canceled_all');
        } else {
            ipcRenderer.send('overwrite_skip', copy_files_arr);
        }

    })

    // FOOTER
    let footer = add_div()
    footer.style = 'position:fixed; bottom:0; height: 40px; margin-bottom: 25px;';
    footer.append(btn_cancel, btn_replace, btn_skip)

    let source_data = ''
    let destination_data = ''
    let header = ''

    // DIRECTORY
    if (destination_stats.isDirectory()) {

        btn_replace = add_button('btn_replace', 'Merge')
        btn_replace.classList.add('primary')

        let description = ''
        if (destination_stats.mtime > source_stats.mtime) {
            description = '<p>A newer folder with the same name already exists '
                // 'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        } else {
            description = '<p>A older folder with the same name already exists in ' +
                'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        }

        header = add_header('<br />Copy Folder:  ' + path.basename(data.source) + '<br /><br />')

        source_data = add_p(
            description +
            add_header('Current Folder').outerHTML +
            // add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )

        destination_data = add_p(
            add_header('Overwrite with').outerHTML +
            // add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

    // FILE
    } else {

        let description
        if (destination_stats.mtime >= source_stats.mtime) {
            description = '<p>A newer file with the same name already exists. ' +
                'Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>'
        } else {
            description = '<p>A older file with the same name already exists ' +
                'Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>'
        }

        header = add_header('<br />Replace File: <span>' + path.basename(data.source) + '</span><br />')

        // This is realy destination
        source_data = add_p(
            description +
            add_header('Original file').outerHTML +
            // add_img(get_icon_path(data.destination)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )

        // This is realy source
        destination_data = add_p(

            add_header('Replace with').outerHTML +
            // add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

    }

    // HANDLE CHECKBOX
    let replace_all = add_div()
    replace_all.append(chk_replace_div)

    confirm_dialog.append(header, source_data, destination_data, replace_all, footer);

    let chk_replace = document.getElementById('chk_replace')
    let is_checked = 0
    chk_replace.addEventListener('change', (e) => {
        if (chk_replace.checked) {
            is_checked = 1
        } else {
            is_checked = 0
        }
    })

})

// OVERITE COPY FILES
ipcRenderer.on('overwrite', (e, data) => {

    let progress = document.getElementById('progress');

    let destination = data.destination;
    let source = data.source;

    let destination_stats = fs.statSync(destination);
    let source_stats = fs.statSync(source);

    destination_size = destination_stats.size;
    source_size = source_stats.size;

    notification('overwriting file ' + destination);

    if (destination_stats.isDirectory()) {
        copyFolderRecursiveSync(source, destination)
    } else {
        // COPY FILE
        fs.copyFile(source, destination, (err) => {
            let file_grid = document.getElementById('file_grid');
            if (err) {
                console.log(err)
            } else {

                // REMOVE PREVIOUS CARD
                let previous_card = document.querySelector('[data-href="' + destination + '"]')
                let col = previous_card.closest('.column')
                col.remove()

                // ADD CARD
                let options = {
                    id: 'file_grid_' + idx,
                    href: destination,
                    linktext: path.basename(destination),
                    grid: file_grid
                }

                try {

                    add_card(options).then(col => {

                        file_grid.insertBefore(col, file_grid.firstChild)

                        // COUNT ITEMS IN MAIN VIEW
                        folder_count = get_folder_count()
                        file_count = get_file_count()

                        // RESET CARD INDE TO HANDLE LAZY LOADED IMAGES
                        cardindex = 0

                    })

                } catch (err) {
                    notification(err)
                }

            }
            // UPDATE CARDS
            update_cards(file_grid);
        })
    }
})

// OVERWRITE COPY ALL
ipcRenderer.on('overwrite_all', (e, copy_files_arr) => {
    copy_files_arr.forEach(item => {
        let source_stats = fs.statSync(item.source)
        // Directory
        if (source_stats.isDirectory()) {
            copyFolderRecursiveSync(item.destination)
        // File
        } else {
            copyFileSync(item.source, item.destination)
            // fs.copyFile(data.source, data.destination , (err) => {
            //     if (err) {
            //         console.log(err)
            //     } else {
            //         console.log('copy files',data.destination)
            //     }
            // })
        }
    })
    clear_copy_arr()
})

// ON COPY COMPLETE
ipcRenderer.on('copy-complete', function (e) {
    get_files(breadcrumbs.value)
})

// Confirm move dialog
ipcRenderer.on('confirming_move', (e, data, copy_files_arr) => {

    let btn_cancel  = add_button('btn_cancel', 'Cancel')
    let btn_ok      = add_button('btn_ok', 'Move')
    btn_ok.classList.add('primary')

    let footer = add_div()
    footer.style = 'position:fixed; bottom:0; margin-bottom: 25px;';
    footer.append(btn_cancel)
    footer.append(btn_ok)

    let source_stats = fs.statSync(data.source)
    let header = add_header('<br />Confirm Move:  ' + path.basename(data.source) + '<br /><br />')

    let description = ''
    let source_data = ''
    if (fs.statSync(data.source).isDirectory()) {

        description = add_p('Move Folders ' + data.source)
        source_data = add_p(
            add_header('').outerHTML +
            // add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(localStorage.getItem(data.source)) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

    } else {

        description = add_p('Move files ' + data.source)
        source_data = add_p(
            add_header('').outerHTML +
            // add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(localStorage.getItem(data.source)) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

    }

    let chk_div = add_div()
    let chk_move_all = add_checkbox('chk_replace', 'Apply this action to all files and folders')
    chk_div.append(chk_move_all)

    let confirm_dialog = document.getElementById('confirm')
    confirm_dialog.append(header, description, source_data, chk_div, add_br(), add_br(), add_br(), footer)

    chk = document.getElementById('chk_replace');

    let is_checked = 0;
    if (localStorage.getItem('move_all') === null) {
        localStorage.setItem('move_all', 0);
    } else {
        is_checked = parseInt(localStorage.getItem('move_all'));
    }

    chk.checked = is_checked;

    // MOVE ALL
    chk.addEventListener('change', (e) => {
        if (chk.checked) {
            localStorage.setItem('move_all', 1)
            is_checked = 1;
        } else {
            localStorage.setItem('move_all', 0)
            is_checked = 0;
        }
    })

    // MOVE CONFIRMED
    btn_ok.addEventListener('click', (e) => {
        if (is_checked) {
            ipcRenderer.send('move_confirmed_all', data, copy_files_arr)
        } else {
            ipcRenderer.send('move_confirmed', data, copy_files_arr)
        }
    })

    // CANCEL MOVE
    btn_cancel.addEventListener('click', (e) => {
        if (is_checked) {
            ipcRenderer.send('move_canceled_all')
        } else {
            ipcRenderer.send('move_canceled')
        }

    })

    window.addEventListener('keyup', (e) => {
        if (e.key == 'Escape') {
            ipcRenderer.send('move_canceled')
        }
    })

})

// CONFIRM OVERWRITE MOVE DIALOG
ipcRenderer.on('confirming_overwrite_move', (e, data) => {

    let confirm_dialog = document.getElementById('confirm')

    let source_stats = fs.statSync(data.source)
    let destination_stats = fs.statSync(data.destination)

    let chk_replace_div = add_checkbox('chk_replace', 'Apply this action to all files and folders')

    let footer = add_div();
    let btn_cancel = add_button('btn_cancel', 'Cancel');
    let btn_replace = add_button('btn_replace', 'Replace');
    let btn_skip = add_button('btn_skip', 'Skip');
    let icon = add_icon('info-circle');

    footer.style = 'position:fixed; bottom:0; margin-bottom: 25px;';
    footer.append(btn_cancel)
    footer.append(btn_replace)
    footer.append(btn_skip)

    //
    let confirm_msg = add_div();

    btn_replace.classList.add('primary');

    let source_data = '';
    let destination_data = '';
    let header = '';

    // DIRECTORY
    if (destination_stats.isDirectory()) {

        let description = ''
        if (destination_stats.mtime > source_stats.mtime) {
            description = '<p>A newer folder with the same name already exists. ' +
                'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        } else {
            description = '<p>An older folder with the same name already exists. ' +
                'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        }

        header = add_header('<br />Merge Folder:  ' + path.basename(data.source) + '<br /><br />')

        destination_data = add_p(
            description +
            add_header('Merge with').outerHTML +
            // add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )
        source_data = add_p(
            add_header('Original folder').outerHTML +
            // add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

        // FILE
    } else {

        let description = ''
        if (destination_stats.mtime >= source_stats.mtime) {
            description = '<p>A newer file with the same name already exists. ' +
                'Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>'
        } else {
            description = '<p>An older file with the same name already exists. ' +
                'Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>'
        }

        header = add_header('<br />Replace File: <span>' + path.basename(data.source) + '</span><br /><br />')

        destination_data = add_p(
            description +
            add_header('Original file').outerHTML +
            // add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )
        source_data = add_p(
            add_header('Replace with').outerHTML +
            // add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime)
            // '<br />' +
            // '<br />'
        )

    }

    // HANDLE CHECKBOX
    let replace_all = add_div()
    replace_all.append(chk_replace_div)

    confirm_dialog.append(header, destination_data, source_data, add_br(), replace_all, add_br(), footer)

    // Handle checkbox
    let chk_replace = document.getElementById('chk_replace')
    let is_checked = 0
    chk_replace.addEventListener('change', (e) => {
        if (chk_replace.checked) {
            is_checked = 1
        } else {
            is_checked = 0
        }
    })

    // MOVE OVERWRITE
    btn_replace.addEventListener('click', (e) => {

        if (is_checked) {
            ipcRenderer.send('overwrite_move_confirmed_all', data)
            // alert('not implemented yet');
        } else {
            ipcRenderer.send('overwrite_move_confirmed', data)
        }

    })

    // CANCEL OVERWRITE BUTTON
    btn_cancel.addEventListener('click', (e) => {
        ipcRenderer.send('overwrite_move_canceled')

    })

    // SKIP OVERWRITE BUTTON
    btn_skip.addEventListener('click', (e) => {
        if (is_checked) {
            ipcRenderer.send('overwrite_move_canceled_all')
        } else {
            ipcRenderer.send('overwrite_move_skip')
        }
    })

})

// OVERWRITE MOVE
ipcRenderer.on('overwrite_move', (e, data) => {

    let progress = document.getElementById('progress');
    let destination = data.destination;
    let source = data.source;

    let destination_stats = fs.statSync(destination);
    let source_stats = fs.statSync(source);

    destination_size = destination_stats.size;
    source_size = source_stats.size;

    notification('overwriting file ' + destination);

    if (destination_stats.isDirectory()) {
        copyFolderRecursiveSync(source, destination)
    } else {

        // delete_file(destination).then(data => {

        // HANDLE PROGESS
        progress.classList.remove('hidden')
        progress.title = 'Moving ' + source;
        progress.max = source_size;

        let intervalid = setInterval(() => {

            progress.value = destination_size
            if (destination_size >= source_size) {
                clearInterval(intervalid)
                hide_top_progress()
            }

        }, 100)

        // COPY FILE
        fs.copyFile(source, destination, (err) => {
            let file_grid = document.getElementById('file_grid');
            if (err) {
                console.log(err)
            } else {
                delete_file(source)
            }
            // UPDATE CARDS
            update_cards(file_grid);
        })
    }

})

// ON MOVE CONFIRMED. todo: this needs work
ipcRenderer.on('move_confirmed', (e, data) => {

    let source = data.source;
    let destination = data.destination;

    fs.copyFile(source, destination, (err) => {

        if (err) {
            console.log(err)

        } else {

            // REMOVE CARD
            let card = document.querySelector('[data-href="' + source + '"]');
            let col = card.closest('.column');
            col.remove();

            delete_file(source);

        }
    })

})

// OVERWRITE MOVE ALL
ipcRenderer.on('overwrite_move_all', (e, destination) => {

    copy_files_arr.forEach(data => {

        let source_stats = fs.statSync(data.source)

        // DIRETORY
        if (source_stats.isDirectory()) {

        // FILE
        } else {

            fs.copyFile(data.source, path.join(destination, path.basename(source)), (err) => {
                if (err) {
                    console.log(err)
                } else {
                    // REMOVE CARD
                    // let card = document.querySelector('[data-href="' + data.source + '"]')
                    // let col = card.closest('.column')
                    // col.remove()
                    delete_file(data.source)
                }
            })

        }

    })

    clear_copy_arr();
    clear_items();

})

// ON FILE SIZE
ipcRenderer.on('file_size', function (e, args) {

    let href = args.href
    let size = args.size

    try {
        let card = document.querySelector('[data-href="' + href + '"]')
        let extra = card.querySelector('.extra')

        extra.innerHTML = get_file_size(size)
        localStorage.setItem(href, args.size)

    } catch (err) {
        console.log(err)
    }

})

// ON DISk SPACE - NEW
ipcRenderer.on('disk_space', (e, data) => {

    let info_view       = document.getElementById('info_view')
    let folder_count    = get_folder_count();
    let file_count      = get_file_count();

    if (folder_count === 0 && file_count === 0) {

        let msg = add_div()

        msg.append('Folder is empty');
        msg.style = 'font-size: 23px; position: absolute; top: 50%; left: 50%; margin-top: -50px; margin-left: -100px;';

        info_view.classList.remove('hidden');
        info_view.append(msg);

    }

    if (data.length > 0) {

        let status = document.getElementById('status')
        status.innerHTML = ''
        let disksize = add_div()
        let usedspace = add_div()
        let availablespace = add_div()
        let foldersize = add_div()
        let foldercount = add_div()
        let filecount = add_div()

        foldersize.id = 'du_folder_size'

        data.forEach(item => {

            disksize.innerHTML = '<div class="item">Disk size: <b>&nbsp' + item.disksize + '</b></div>'
            usedspace.innerHTML = '<div class="item">Used space: <b>&nbsp' + item.usedspace + '</b></div>'
            availablespace.innerHTML = '<div class="item">Available space: <b>&nbsp' + item.availablespace + '</b></div>'
            // foldersize.innerHTML = '<div class="item">Folder Size: <b>&nbsp' + item.foldersize + '</b></div>'
            foldersize.innerHTML = '<div class="item">Folder Size: <b>&nbspCalculating.... </b></div>'
            foldercount.innerHTML = '<div class="item">Folder Count: <b>&nbsp' + folder_count + '</b></div>'
            filecount.innerHTML = '<div class="item">File Count: <b>&nbsp' + file_count + '</b></div>'

            status.appendChild(disksize)
            status.appendChild(usedspace)
            status.appendChild(availablespace)
            status.appendChild(foldersize)
            status.appendChild(foldercount)
            status.appendChild(filecount)

        })

    } else {
        console.log('no data found')
    }

})

ipcRenderer.on('du_folder_size', (e, folder_size) => {
    let du_folder_size = document.getElementById('du_folder_size');
    du_folder_size.innerHTML = '<div class="item">Folder Size: <b>&nbsp' + folder_size + '</b></div>';
})

// ON FOLDER SIZE
ipcRenderer.on('folder_size', (e, data) => {
    try {
        let cards = document.querySelectorAll('[data-href="' + data.href + '"]')
        cards.forEach(card => {
            let extra = card.querySelector('.extra')
            if (fs.readdirSync(data.href).length > 0) {
                extra.innerHTML = get_file_size(data.size)
                localStorage.setItem(data.href, data.size)
            } else {
                extra.innerHTML = '0 Items'
            }
        })
    } catch (err) {
        console.log('on get folder size error:', err);
    }
})

//ON GIO VOLUMES
ipcRenderer.on('gio_volumes', (e, res) => {
    console.log('results ', res)
})

// ON GIO DEVICE
ipcRenderer.on('gio_devices', (e, res) => {

    // let device_grid = document.getElementById('device_grid')
    // let menu_items = add_div();

    // let data = res.split('\n')
    // // console.log('running gio devices')

    // // GET REFERENCE TO DEVICE GRID

    // device_grid.innerHTML = ''
    // menu_items.classList.add('ui', 'items')

    // // CREATE VOLUMES ARRAY
    // let volumes_arr = []
    // data.forEach((item, idx) => {

    //     // CREATE VOLLUMES ARRAY
    //     if (item.indexOf('Volume(0):') > -1) {

    //         let split_item = item.split('->')
    //         // console.log(item)
    //         let volume_obj = {
    //             idx: idx,
    //             volume: split_item[0]
    //         }

    //         volumes_arr.push(volume_obj)

    //     }

    // })


    // // LOOP OVER VOLUMES ARRAY
    // // volumes_arr.forEach((item, idx) => {

    // // GIO OBJECT
    // let gio = {}
    // let subitem_counter = 0
    // let is_activationroot = 0
    // // LOOP OVER VOLUMES
    // for (let i = 0; i < volumes_arr.length; i++) {

    //     let volume = volumes_arr[i].volume
    //     gio.volume = volume.replace('Volume(0):', '').trim()

    //     // LOOP OVER GIO DATA AND GET SUB ITEMS
    //     data.forEach((subitem, subidx) => {

    //         // console.log('running ' + volumes_arr[i + 1].idx)
    //         let volumeidx = volumes_arr[i].idx
    //         let volumeidx2 = data.length

    //         // IF MORE THAN 1 VOLUME IS FOUND GET ITS INDEX TO USE AS FILTER
    //         if (i < volumes_arr.length - 1) {
    //             volumeidx2 = volumes_arr[i + 1].idx
    //         }

    //         let uuid = ''

    //         // IF ARRAY COUNTER IS BETWEEN 1ST AND SECOND
    //         if (subidx >= volumeidx && subidx <= volumeidx2) {

    //             // console.log('sub item', subitem)

    //             if (subitem.indexOf('activation_root=') > -1) {

    //                 uuid = subitem.replace('activation_root=', '').trim()
    //                 gio.uuid = uuid
    //                 // CREATE HREF ELEMENT
    //                 let href = document.createElement('a')
    //                 let icon = document.createElement('i')
    //                 let icon_phone = document.createElement('i')
    //                 let menu_item = add_div()
    //                 let content = add_div()

    //                 href.href = '#'

    //                 href.classList.add('block')
    //                 icon.classList.add('icon', 'bi-hdd')
    //                 icon.style.marginLeft = '15px'
    //                 icon_phone.classList.add('icon', 'mobile', 'alternate')
    //                 menu_item.classList.add('item')
    //                 content.classList.add('item')

    //                 // ADD DATA
    //                 // let uuid_path = uuid
    //                 href.dataset.uuid = uuid
    //                 href.text = gio.volume
    //                 href.addEventListener('click', (e) => {
    //                     ipcRenderer.send('mount_gio', gio)
    //                 })

    //                 menu_item.appendChild(icon_phone)
    //                 content.appendChild(href)
    //                 menu_item.appendChild(content)
    //                 menu_items.appendChild(menu_item)
    //                 device_grid.appendChild(menu_items)

    //                 // if (subitem.indexOf('default_location=') > -1) {

    //                 //     uuid = path.normalize(subitem.replace('default_location=file://', '').trim())
    //                 //     // gio.uuid = uuid
    //                 //     console.log('uuid')

    //                 // }

    //                 is_activationroot = 1
    //                 console.log('activation uuid', uuid)
    //             }

    //             if (subitem.indexOf('default_location=') > -1 && is_folder_card == 1) {

    //                 uuid = path.normalize(subitem.replace('default_location=file://', '').trim())

    //                 if (uuid.indexOf('sftp') === -1) {

    //                     // IF UUID CONTAINS DEFAULT_LOCATION. ONLY SHOW FIRST INSTANCE
    //                     if (uuid.indexOf('default_location=') > -1 && subitem_counter == 0) {

    //                         // CREATE HREF ELEMENT
    //                         let href = document.createElement('a')
    //                         let icon = document.createElement('i')
    //                         let icon_phone = document.createElement('i')
    //                         let menu_item = add_div()
    //                         let content = add_div()

    //                         href.href = '#'

    //                         href.classList.add('block')
    //                         icon.classList.add('icon', 'bi-hdd')
    //                         icon.style.marginLeft = '15px'
    //                         icon_phone.classList.add('icon', 'mobile', 'alternate')
    //                         menu_item.classList.add('item')
    //                         content.classList.add('item')

    //                         // ADD DATA
    //                         uuid = uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
    //                         href.dataset.uuid = uuid
    //                         href.text = gio.volume
    //                         href.addEventListener('click', (e) => {
    //                             get_view(uuid);
    //                             // get_files(uuid, () => {})
    //                         })

    //                         content.appendChild(href)
    //                         menu_item.appendChild(icon_phone)
    //                         menu_item.appendChild(content)
    //                         menu_items.appendChild(menu_item)

    //                         device_grid.appendChild(menu_items)

    //                         subitem_counter = 1

    //                     }

    //                     // IF UUID DOES NOT CONTAIN DEFAULT_LOCATION
    //                     if (uuid.indexOf('default_location=') === -1) {

    //                         // CREATE HREF ELEMENT
    //                         let href = document.createElement('a')
    //                         let icon = document.createElement('i')
    //                         let icon_phone = document.createElement('i')
    //                         let menu_item = add_div()
    //                         let content = add_div()

    //                         href.href = '#'

    //                         href.classList.add('block')
    //                         icon.classList.add('icon', 'bi-hdd')
    //                         icon.style.marginLeft = '15px'

    //                         icon_phone.classList.add('icon', 'mobile', 'alternate')
    //                         menu_item.classList.add('item')
    //                         content.classList.add('item')

    //                         // ADD DATA
    //                         uuid = uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
    //                         href.dataset.uuid = uuid
    //                         href.text = gio.volume
    //                         href.addEventListener('click', (e) => {
    //                             get_view(uuid)
    //                             // get_files(uuid, () => {})

    //                         })

    //                         menu_item.appendChild(icon)
    //                         content.appendChild(href)
    //                         menu_item.appendChild(content)
    //                         menu_items.appendChild(menu_item)

    //                         device_grid.appendChild(menu_items)

    //                     }

    //                     // console.log('index ', subidx, 'uuid', uuid)
    //                     // console.log('default loc uuid', uuid)
    //                 }

    //             }

    //             // // IF ACTIVATION ROOT THEN ANDROID
    //             // if (subitem.indexOf('activation_root=') > -1) {

    //             //     // console.log(subitem + ' ' + subidx)
    //             //     uuid = subitem.replace('activation_root=', '').trim()
    //             //     gio.uuid = uuid

    //             //     // CREATE HREF ELEMENT
    //             //     let href = document.createElement('a')
    //             //     let icon = document.createElement('i')
    //             //     let icon_phone = document.createElement('i')
    //             //     let menu_item = add_div()
    //             //     let content = add_div()

    //             //     href.href = '#'

    //             //     href.classList.add('block')
    //             //     icon.classList.add('icon', 'hdd')
    //             //     icon_phone.classList.add('icon', 'mobile', 'alternate')
    //             //     menu_item.classList.add('item')
    //             //     content.classList.add('item')

    //             //     is_activationroot = 1

    //             //     // ADD DATA
    //             //     let uuid_path = gio.uuid
    //             //     href.dataset.uuid = uuid_path
    //             //     href.text = gio.volume
    //             //     href.addEventListener('click', (e) => {
    //             //         ipcRenderer.send('mount_gio', gio)
    //             //     })

    //             //     menu_item.appendChild(icon_phone)
    //             //     content.appendChild(href)
    //             //     menu_item.appendChild(content)
    //             //     menu_items.appendChild(menu_item)
    //             //     device_grid.appendChild(menu_items)

    //             //     if (subitem.indexOf('default_location=') > -1) {

    //             //         let uuid = path.normalize(subitem.replace('default_location=file://', '').trim())
    //             //         gio.uuid = uuid
    //             //         console.log('uuid')

    //             //     }

    //             // }

    //             // if (subitem.indexOf('default_location=') > -1 && is_folder_card == 1) {

    //             //     // CREATE HREF ELEMENT
    //             //     let href = document.createElement('a')
    //             //     let icon = document.createElement('i')
    //             //     let icon_phone = document.createElement('i')
    //             //     let menu_item = add_div()
    //             //     let content = add_div()

    //             //     href.href = '#'

    //             //     href.classList.add('block')
    //             //     icon.classList.add('icon', 'hdd')
    //             //     icon_phone.classList.add('icon', 'mobile', 'alternate')
    //             //     menu_item.classList.add('item')
    //             //     content.classList.add('item')


    //             //     if (uuid.indexOf('sftp') === -1) {
    //             //         console.log('default loc uuid', uuid)

    //             //         uuid = path.normalize(subitem.replace('default_location=file://', '').trim())
    //             //         gio.uuid = uuid


    //             //         // IF UUID CONTAINS DEFAULT_LOCATION. ONLY SHOW FIRST INSTANCE
    //             //         if (gio.uuid.indexOf('default_location=') > -1 && subitem_counter == 0) {

    //             //             // ADD DATA
    //             //             let uuid_path = gio.uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
    //             //             // let uuid_path = gio.uuid
    //             //             href.dataset.uuid = uuid_path
    //             //             href.text = gio.volume
    //             //             href.addEventListener('click', (e) => {
    //             //                 get_files(uuid_path)
    //             //             })

    //             //             menu_item.appendChild(icon_phone)
    //             //             content.appendChild(href)
    //             //             menu_item.appendChild(content)
    //             //             menu_items.appendChild(menu_item)

    //             //             subitem_counter = 1

    //             //         }

    //             //         // IF UUID DOES NOT CONTAIN DEFAULT_LOCATION
    //             //         if (gio.uuid.indexOf('default_location=') === -1) {

    //             //             // ADD DATA
    //             //             let uuid_path = gio.uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
    //             //             href.dataset.uuid = gio.uuid
    //             //             href.text = gio.volume
    //             //             href.addEventListener('click', (e) => {
    //             //                 get_files(uuid_path)

    //             //             })

    //             //             menu_item.appendChild(icon)
    //             //             content.appendChild(href)
    //             //             menu_item.appendChild(content)
    //             //             menu_items.appendChild(menu_item)

    //             //         }

    //             //         console.log('index ', subidx, 'uuid', gio.uuid)
    //             //         device_grid.appendChild(menu_items)

    //             //     }


    //             // }

    //         }

    //     })

    // }



})

// ON GIO MOUNTED
ipcRenderer.on('gio_mounted', (e, data) => {

    let path = ''
    if (data.indexOf('mounted at') > -1) {

        path = data.substring(
            data.indexOf("`") + 1,
            data.lastIndexOf("'")
        );

        if (path == '') { path = '/run/user/1000/gvfs' }
        // get_files(path, () => {})
        get_view(path)

    } else {
        console.log('gio mount error')
    }

    if (data.indexOf('mounted at') > -1) {

    }

    if (data.indexOf('already mounted') > -1) {
        get_view('/run/user/1000/gvfs');
        // get_files('/run/user/1000/gvfs', () => {})
    }

    let str_arr = data.split(' ')
    str_arr.forEach((item, idx) => {

        let direcotry = item.replace(".", "").replace("'", "").replace("`", "")

        if (item.indexOf('already mounted') != -1) {

            if (idx == 8) {
                direcotry = item.replace(".", "").replace("'", "").replace("`", "")
                get_view(direcotry.trim());
            }

        } else {
            // console.log()
        }
    })

})

// ON GIO MONITORED
ipcRenderer.on('gio_monitor', (e, data) => {

    let device_grid = document.getElementById('device_grid')
    device_grid.innerHTML = ''

})

// ON GIO FILES
ipcRenderer.on('gio_files', (e, data) => {

    // SPLIT RETURED FILES / FOLDERS
    let files = data.res.split('\n')

    let folder_grid = document.getElementById('folder_grid')
    let file_grid = document.getElementById('file_grid')

    folder_grid.innerHTML = ''
    file_grid.innerHTML = ''
    folders_card.classList.remove('hidden')

    // LOOP OVER FILES / FOLDERS
    files.forEach((item, idx) => {
        let href = path.join('/run/user/1000/gvfs', data.data.replace('//', 'host='))
        // CREATE CARD OPTIONS
        let options = {

            id: 'card_id_' + idx,
            href: href,
            linktext: item,
            grid: folder_grid

        }
        try {
            add_card(options).then(card => {
                folder_grid.insertBefore(card, folder_grid.firstChild)
                let col = add_column('three');
                col.append(card)
                // let header = document.getElementById('header_' + card_id)
                // header.classList.add('hidden')

                // let input = card.querySelector('input')
                // input.classList.remove('hidden')

                // //
                // input.focus()
                // input.select()

                // //
                // update_cards()
            })

        } catch (err) {

            notification(err)
            info(err)

        }

    })

})

// ADD CARD VIA IPC
ipcRenderer.on('add_card', (e, options) => {

    let duplicate   = 0;
    let items       = main_view.querySelectorAll('.nav_item')
    let info_view   = document.getElementById('info_view')

    info_view.innerHTML = ''

    items.forEach(item => {
        if (options.href == item.dataset.href) {
            duplicate = 1
        }
    })

    if (!duplicate) {

        let stats = fs.statSync(options.href);
        if (stats.isDirectory()) {
            options.grid = document.getElementById('folder_grid');
        } else {
            options.grid = document.getElementById('file_grid');
        }

        add_card(options).then(card => {
            let col = add_column('three');
            col.append(card);
            options.grid.insertBefore(col, options.grid.firstChild);
            update_card(card.dataset.href);
        })

    } else {
        console.log('error: duplicate found. this needs to be fixed')
    }

})

// ON DELETE CONFIRMED
ipcRenderer.on('delete_file_confirmed', (e, res) => {

    delete_confirmed()

})

// ON CREATE FILE FROM TEMPLATE
ipcRenderer.on('create_file_from_template', function (e, file) {
    create_file_from_template(file.file)
})

// On sidebar
ipcRenderer.on('sidebar', (e) => {
    let sidebar = document.getElementById('sidebar')
    if (sidebar.classList.contains('hidden')) {
        localStorage.setItem('sidebar', 1)
        show_sidebar()
    } else {
        localStorage.setItem('sidebar', 0)
        show_sidebar()
    }
})

// On clear sidebar
ipcRenderer.on('clear_sidebar', (e) => {
    let sb_items = document.getElementById('sidebar_items');
    sb_items.innerHTML = ''
})

// On file properties window
ipcRenderer.on('file_properties_window', (e, data) => {
    console.log('what', data)
    let sb_items = document.getElementById('sidebar_items');
    sb_items.innerHTML = ''
    get_properties(source)
})

// On file properties
ipcRenderer.on('file_properties', (e, file_properties_obj) => {
    get_properties(file_properties_obj);
})

// On add workspace
ipcRenderer.on('add_workspace', (e) => {
    add_workspace();
})

// On select all
ipcRenderer.on('select_all', (e) => {
    select_all();
})

// Set progress
ipcRenderer.on('progress', (e, max, destination_file) => {
    get_progress(max,destination_file);
})

// Update progress
ipcRenderer.on('update_progress', (e, step) => {
    update_progress(step)
})

// On sort
ipcRenderer.on('sort', (e, sort) => {
    let breadcrumbs = document.getElementById('breadcrumbs')
    if (sort == 'date') {
        localStorage.setItem('sort', 1)
    } else if (sort == 'size') {
        localStorage.setItem('sort', 3)
    } else if (sort == 'name') {
        localStorage.setItem('sort', 2)
    } else if (sort == 'type') {
        localStorage.setItem('sort', 4)
    }
    get_view(breadcrumbs.value)
})

// todo: these need to be consolidated at ome point
// NOTICE
function notice(notice_msg) {
    // let container = document.getElementById('notice')
    // container.innerHTML = ''
    // container.innerHTML = notice_msg
}

// INFO
function info(msg) {
    let container = document.getElementById('info')
    container.style = 'font-size:small; right: 0;'
    container.classList.remove('hidden')
    container.innerHTML = ''
    container.innerHTML = msg
}

// NOTIFICATIONS
function notification(msg) {

    let notification = document.getElementById('notification')
    notification.innerHTML = ''
    notification.append(msg)
    notification.classList.remove('hidden')
    notification.classList.add('right')

    // notice(msg)
    // info(msg)

    // let status = document.getElementById('notification')
    // let msg_div = add_div()

    // // status.style = 'overflow:auto'
    // msg_div.style = 'overflow:auto; margin-bottom: 10px;'

    // msg_div.innerHTML = ''
    // msg_div.innerHTML = msg

    // status.innerHTML = ''
    // status.appendChild(msg_div)

    // let card = add_card(options)
    // column.appendChild(card)
    // status.insertBefore(msg_div, status.firstChild)

}

///////////////////////////////////////////////////

// GET GIO DEVICES
// async function get_gio_devices() {
//     // ipcRenderer.send('get_gio_devices')
// }

// GET FILE CONTENTS. USED TO LOAD PAGES
async function get_file(file) {
    let res = fs.readFileSync(__dirname + '/' + file)
    return res
}

// CLEAR CACHE
function clear_cache() {
    let folder_cache = path.join(__dirname, '/', 'folder_cache.json')
}

// Get  sidebar view
async function get_sidebar_view() {

    try {

        switch (localStorage.getItem('minibar')) {
            case 'mb_home':
                get_sidebar_files(get_home());
                break;
            case 'mb_workspace':
                get_workspace();
                break;
            case 'mb_find':
                find_files()
                // find()
                break;
            case 'mb_fs':
                get_sidebar_files('/');
                break;
            case 'mb_devices':
                get_devices();
                break;
            case 'mb_info':
                get_info();
                break;
        }

    } catch (err) {
        console.log(err);
    }

}

// Get image properties
async function get_image_properties(image) {

    let sb_items        = document.getElementById('sidebar_items');
    let card            = add_div();
    let content         = add_div();

    card.classList.add('ui', 'card');
    content.classList.add('content');

    exec('identify -verbose "' + image + '"', (err, info) => {
        if (err) {

        } else {

            let prop_view = add_div()
            let icon      = add_icon('times');

            prop_view.style     = 'height: 100%; overflow-y: auto;'
            // sb_items.append(add_header('Image Properties'))
            icon.style  = 'display:block; float:right; width: 23px; cursor: pointer';

            icon.addEventListener('click', (e) => {
                card.remove();
            })

            let image_obj = {};
            let info_arr  = info.split('\n');
            info_arr.forEach((item, idx) => {

                if (idx <= 10) {

                    const [key, value] = item.trim().split(":");
                    image_obj[key] = value;

                    let row         = add_div();
                    let col1        = add_div();
                    let col2        = add_div();

                    row.style       = 'display:flex; padding: 5px;';
                    col1.style      = 'width: 150px;'

                    col1.append(key);
                    col2.append(value);

                    row.append(col1,col2);
                    prop_view.append(row)

                }

            })

            content.append(icon, prop_view)
            card.append(content)

            sb_items.append(card);
        }

    });

}

// rwx rwx rwx ==> ( r = 4 ) if set + ( w = 2) if set + (x = 1) if set , for example:
// You have :
// -rw-wxrw- => (4+2+0)(0+2+1)(4+2+0) = 0636
// First argument before 9 permissions is one of :
// - = regular file
// d =  directory
// b = block device
// c = character device
// s = socket
// p = pipe
// f = fifo

// FILE PROPERTIES WINDOW
async function get_properties(file_properties_obj) {

    let filename        = file_properties_obj['Name'];
    let ext             = path.extname(filename);
    let execute_chk_div = add_checkbox('', 'Make Executable')
    let sb_items        = document.getElementById('sidebar_items');
    let mb_info         = document.getElementById('mb_info')
    let file_properties = document.getElementById('file_properties');
    let remove_btn      = add_icon('times');
    let card            = add_div();
    let content         = add_div();
    let image           = add_div();

    image.classList.add('image')

    clear_minibar();
    mb_info.style = 'color: #ffffff !important;';
    remove_btn.classList.add('small');
    remove_btn.style = 'display:block; float:right; width: 23px; cursor: pointer';
    remove_btn.addEventListener('click', (e) => {
        card.remove();
        let items = sb_items.querySelectorAll('.nav_item')
        if (items.length == 0) {
            get_sidebar_view();
        }
    })

    let execute_chk = execute_chk_div.querySelector('.checkbox')

    try {
        fs.accessSync(filename, fs.constants.X_OK)
        execute_chk.checked = 1
    } catch (err) {
        execute_chk.checked = 0
    }

    execute_chk.addEventListener('change', (e) => {

        // mode: r/w 33188
        // mode: r/w/x 33261

        if (execute_chk.checked) {
            chmod = fs.chmodSync(filename, '755');
        } else {
            chmod = fs.chmodSync(filename, '33188');
        }

    })

    let stats = fs.statSync(filename)

    card.dataset.href = filename
    card.classList.add  ('ui', 'card', 'fluid', 'nav_item', 'nav');
    card.style = 'color: #ffffff !important;';
    content.classList.add('content');

    content.append(remove_btn, add_br());

    let c = 0;
    for (const prop in file_properties_obj) {

        ++c;
        let div             = add_div();
        div.style           = 'display: flex; padding: 5px; word-break: break-all';

        let col1 = add_div();
        let col2 = add_div();

        col1.style = 'width: 30%;'
        col2.style = 'width: 60%;'

        switch (prop) {
            case 'Name':

                let link = add_link(file_properties_obj[prop], file_properties_obj[prop]);
                link.addEventListener('click', (e) => {
                    if (fs.statSync(file_properties_obj[prop]).isDirectory()) {
                        get_view(file_properties_obj[prop]);
                    } else {
                        open(file_properties_obj[prop])
                    }
                })

                col2.append(link)

                // Directory
                if (stats.isDirectory()) {

                    let img = add_img(folder_icon);
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    image.append(img);

                    col1.append(image);
                    div.append(col1, col2)

                // Files
                } else {

                    ipcRenderer.invoke('get_icon', card.dataset.href).then(res => {
                        let img = document.createElement('img')
                        img.src = res
                        image.append(img);
                    })

                    // ipcRenderer.send('get_icon_path', filename);

                    col1.append(image);
                    div.append(col1, col2)

                }

            break;
            case 'Contents':

                col1.append(prop);
                col2.append('calculating..');
                col2.dataset.contents = filename
                div.append(col1, col2);

                ipcRenderer.send('item_count_recursive', filename);

            break;
            case 'Size':

                col1.append(prop);
                col2.append(get_file_size(localStorage.getItem(filename)));
                div.append(col1, col2);

            break;
            default:

                col1.append(prop);
                col2.append(`${file_properties_obj[prop]}`);
                div.append(col1, col2)

            break;
        }

        if (ext == '.sh') {
            content.append(div, execute_chk_div)
        } else {
            content.append(div)
        }

    }

    card.append(content)
    sb_items.appendChild(card);

    localStorage.setItem('sidebar', 1);
    show_sidebar()

}

// Call get file properties
async function get_file_properties() {

    file_properties_arr = []
    let sb_items        = document.getElementById('sidebar_items')
    let main_view       = document.getElementById('main_view');
    let items           = main_view.querySelectorAll('.highlight_select, .highlight, .ds-selected');

    if (items.length > 0) {

        sb_items.innerHTML  = ''

        items.forEach(item => {
            file_properties_arr.push(item.dataset.href);
            ipcRenderer.send('get_file_properties', file_properties_arr);
            file_properties_arr = [];
        })

        clear_items();

    } else {

        sb_items.innerHTML  = ''
        let href = breadcrumbs.value
        file_properties_arr.push(href);
        ipcRenderer.send('get_file_properties', file_properties_arr);
        file_properties_arr = [];

    }

}

// Get sidebar info
async function get_info() {
    let file_properties = document.getElementById('file_properties');
    if (file_properties) {
        // file_properties.classList.remove('hidden');
    }
}

// UPDATE PROGRESS
function update_progress(val) {
    let progress = document.getElementById('progress');
    progress.value = val;
}

/**
 * Show progress
 * @param {*} max
 * @param {*} destination_file
 */
function get_progress(max, destination_file) {

    let breadcrumbs     = document.getElementById('breadcrumbs');
    let progress_div    = document.getElementById('progress_div')
    let progress        = document.getElementById('progress');
    let cancel          = document.getElementById('cancel_operation')

    cancel.onclick = (e) => {
        ipcRenderer.send('cancel');
    }

    progress_div.classList.remove('hidden')
    progress.classList.remove('hidden');
    progress.value = 0;

    // CONVERT TO KB
    max = max / 1024

    if (breadcrumbs.value.indexOf('gvfs') > -1) {

        progress.max = max + 0;
        let current_size0 = 0;
        let current_size = 0;
        let interval_id = setInterval(() => {

            let stats = fs.statSync(destination_file);
            current_size0 = current_size
            current_size = parseInt(stats.size);

            progress.value = current_size;
            if (current_size0 >= current_size) {

                progress.value = 0
                progress_div.classList.add('hidden')
                progress.classList.add('hidden')

                clearInterval(interval_id);
            }

        }, 100);

    } else {

        let cmd = "du -s '" + breadcrumbs.value + "' | awk '{print $1}'";
        exec(cmd, (err, stdout) => {

            var start_size = parseInt(stdout);
            progress.max = max + start_size;
            let current_size0 = 0;
            let current_size = 0;
            let interval_id = setInterval(() => {

                current_size0 = current_size;

                cmd = "du -s '" + breadcrumbs.value + "' | awk '{print $1}'";
                exec(cmd, (err, stdout, stderr) => {
                    if (stderr) {
                        console.log(err);
                    } else {

                        current_size = parseInt(stdout);
                        progress.value = current_size;

                        if (current_size0 >= current_size) {

                            progress.value = 0
                            progress_div.classList.add('hidden')
                            progress.classList.add('hidden')

                            clearInterval(interval_id);

                        }
                    }
                })

            }, 500);

        })

    }

}

// GET AVAILABLE LAUNCHERS
function get_available_launchers(filetype, source) {

    let launchers = []
    try {

        let cmd = "grep '" + filetype + "' /usr/share/applications/mimeinfo.cache"
        let desktop_launchers = execSync(cmd).toString().replace(filetype + '=', '').split(';')

        if (desktop_launchers.length > 0) {

            for (let i = 0; i < desktop_launchers.length; i++) {

                let filepath = path.join('/usr/share/applications', desktop_launchers[i])

                if (!fs.statSync(filepath).isDirectory()) {

                    // GET DESKTOP LAUNCHER EXECUTE PATH
                    cmd = "grep '^Exec=' " + filepath
                    let exec_path = execSync(cmd).toString().split('\n')

                    // GET LAUNCHER NAME
                    cmd = "grep '^Name=' " + filepath
                    let exec_name = execSync(cmd).toString().split('\n')

                    // GET MIME TYPE
                    cmd = "xdg-mime query filetype '" + source + "'"
                    let exec_mime = execSync(cmd).toString()

                    // set_default_launcher(desktop_launchers[i],exec_mime[i].replace('MimeType=',''))

                    // let exe_path
                    // let launcher

                    // let desktop_file = fs.readFileSync(filepath,'utf8').split('\n')
                    // desktop_file.forEach((item, idx) => {
                    //     item = item.replace(',','')
                    //     if(item.indexOf('Name=') > -1 && item.indexOf('GenericName=') === -1) {
                    //         launcher = item.replace('Name=', '')
                    //     }
                    //     if(item.indexOf('Exec=') > -1 && item.indexOf('TryExec=') === -1) {
                    //         exe_path = item.replace('Exec=', '')
                    //     }
                    // })

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

        let options = {
            name: 'Code', //exec_name[0].replace('Name=', ''),
            icon: '',
            exec: '/usr/bin/code "' + source + '"',
            desktop: '', //desktop_launchers[i],
            mimetype: 'application/text'
        }

        launchers.push(options)
    }

    return launchers
}

// SET DEFAULT LAUNCHER
function set_default_launcher(desktop_file, mimetype) {

    // xdg-mime default vlc.desktop
    let cmd = 'xdg-mime default ' + desktop_file + ' ' + mimetype
    try {
        execSync(cmd)
    } catch (err) {
        notification(err)
    }

}

// GET NETWORK
async function get_network() {

    let network_grid = document.getElementById('network_grid');
    network_grid.innerHTML = '';

    let menu_items = add_div();
    menu_items.classList.add('ui', 'items');

    let dir = '/run/user/1000/gvfs/'

    fs.readdir(dir, function (err, files) {

        if (err) {
            console.log(err);
        } else {

            if (files.length > 0) {

                let content = add_div();
                content.classList.add('item');

                files.forEach((file, idx) => {

                    let filename = path.join('/run/user/1000/gvfs/', file);

                    // CREATE HREF ELEMENT
                    let href = document.createElement('a');
                    let icon = document.createElement('i')
                    let icon_phone = document.createElement('i');
                    let menu_item = add_div();

                    // let hr = add_div()

                    href.href = filename
                    href.text = file
                    href.dataset.uuid = filename
                    href.title = filename
                    // href.preventDefault = true

                    // hr.classList.add('ui','horizontal','divider')
                    href.classList.add('block', 'header_link')
                    icon.classList.add('icon', 'hdd')
                    icon.style.marginLeft = '15px'
                    icon_phone.classList.add('icon', 'mobile', 'alternate')
                    menu_item.classList.add('item')


                    menu_item.appendChild(icon)
                    content.appendChild(href)
                    menu_item.appendChild(content)
                    menu_items.appendChild(menu_item)

                    // network_grid.appendChild(hr)
                    network_grid.appendChild(menu_items)

                    href.addEventListener('click', (e) => {
                        get_view(filename)
                        // get_files(filename, () => {})
                    })


                })

                network_grid.closest('.content').classList.add('active')

            }

        }

    })

}

// GET TRANSFER SPEED
function get_transfer_speed(source_size, destination_size, elapsed_time) {

    let transfer_speed = parseInt(destination_size) / parseInt(elapsed_time)
    let transfer_time = parseInt(source_size) / parseInt(transfer_speed)
    let transfer_data_amount = parseInt(transfer_speed) * parseInt(transfer_time)

    console.log('destination size ' + get_file_size(destination_size))
    console.log('source size ' + get_file_size(source_size))

    console.log('elapsed speed ' + elapsed_time)

    console.log('transfer speed ' + get_file_size(transfer_speed))
    console.log('transfer time ' + transfer_time)
    console.log('transfer amount ' + get_file_size(transfer_data_amount))

    let options = {
        transfer_speed: transfer_speed,
        transfer_time: transfer_time,
        transfer_data_amount: transfer_data_amount
    }

    return options

}

function log(msg) {
    console.log(msg)
}

// var cardindex = 0

// ADD CARD //////////////////////////////////////////////////////////////////////
async function add_card(options) {

    try {

        // Options
        let id              = options.id
        let href            = options.href
        let linktext        = options.linktext
        let is_folder       = options.is_folder
        let grid            = options.grid
        let size            = ''

        // Create elements
        let col             = add_div()
        let card            = add_div()
        let items           = add_div()
        let item            = add_div()
        let image           = add_div()
        let content         = add_div()
        let extra           = add_div()
        let progress        = add_div()
        let form_field      = add_div()
        let popovermenu     = add_div()
        let form_control    = add_div()
        let progress_bar    = add_progress()
        let header          = document.createElement('a')
        let img             = document.createElement('img')
        let audio           = document.createElement('audio')
        let video           = document.createElement('video')
        let source          = document.createElement('source')
        let input           = document.createElement('input')
        let form            = document.createElement('form')

        col.classList.add           ('column', 'three', 'wide')
        popovermenu.classList.add   ('popup')

        // Card
        card.classList.add  ('ui', 'card', 'fluid', 'nav_item', 'nav', 'lazy')
        card.draggable      = 'true'
        card.id             = id
        card.dataset.href   = href
        input.spellcheck    = false

        // Get Extension Name
        let ext = path.extname(href).toLocaleLowerCase();
        image.appendChild(img);

        // Handle Picture / Audio / Video Files
        let is_image = 0;
        let is_audio = 0;

        // Create items
        items.classList.add('ui', 'items')

        // CREATE ITEM
        item.classList.add('item', 'fluid')

        // CREATE IMAGE CLASS
        image.classList.add('image')

        // DISABLE IMAGE DRAG
        img.draggable = false
        img.classList.add('icon','lazy')
        let icon_size = localStorage.getItem('icon_size')

        switch (icon_size) {
            case '0': {
                image.classList.add('icon16')
                img.classList.add('icon16')
                break;
            }
            case '1': {
                image.classList.add('icon24')
                img.classList.add('icon24')
                break;
            }
            case '2': {
                image.classList.add('icon32')
                img.classList.add('icon32')
                break;
            }
            case '3': {
                image.classList.add('icon48')
                img.classList.add('icon48')
                break;
            }
        }

        // Folder
        if (is_folder) {
            card.classList.add('folder_card')
            img.classList.add('icon')
            img.dataset.src = folder_icon
        // File
        } else {
            // if (
            //     ext === '.png'  ||
            //     ext === '.jpg'  ||
            //     ext === '.gif'  ||
            //     ext === '.webp' ||
            //     ext === '.jpeg'
            // ) {
            //     is_image = 1;
            //     img.classList.add('img', 'lazy');
            //     img.style = 'border: 2px solid #cfcfcf; background-color: #cfcfcf';
            //     let destination = path.join(thumbnails_dir, path.basename(href));
            //     if (fs.existsSync(destination)) {
            //         img.dataset.src = destination
            //     } else {
            //         if (icon_size > 1e-6) {
            //             notification('Saving thumbnails. Please wait.')
            //             im.resize({
            //                 srcPath: href,
            //                 dstPath: destination,
            //                 width: 128
            //             }, (err, stdout, stderr) => {
            //                 img.src = destination
            //                 notification('')
            //             })
            //         }
            //     }
            // } else if (
            //     ext === '.svg'
            // ) {
            //     img.dataset.src = img.dataset.src = href
            // } else if (
            //     ext === '.m4a' ||
            //     ext === '.mp3' ||
            //     ext === '.wav' ||
            //     ext === '.ogg'
            // ) {
            //     // audio
            //     is_audio = 1;
            //     ipcRenderer.invoke('get_icon', href).then(res => {
            //         img.dataset.src = res;
            //     })

            // } else if (
            //     ext === '.mp4' ||
            //     ext === '.webm'
            // ) {
            //     img.remove();
            //     source.src = href;
            //     video.append(source);
            //     content.append(video);
            // } else {
            //     img.src = path.join(__dirname, 'assets/icons/kora/actions/scalable/viewimage.svg');
            //     ipcRenderer.invoke('get_icon', href).then(res => {
            //         img.dataset.src = res;
            //     })
            // }
            card.classList.add('file_card');
        }

        // CARD CLICK
        card.addEventListener('click', function (e) {
            e.stopPropagation()
            // CRTRL+SHIFT ADD TO WORKSPACE
            if (e.ctrlKey == true && e.shiftKey == true) {

                // get_workspace()
                add_workspace();

                // MULTI SELECT
            } else if (e.ctrlKey == true) {

                if (card.classList.contains('highlight_select', 'highlight', 'ds-selected')) {
                    card.classList.remove('highlight_select', 'highlight', 'ds-selected');
                } else {
                    card.classList.add('highlight_select');
                }

            // SINGLE SELECT
            } else {

                clear_items()

                // HIGHLIGHT
                if (this.classList.contains('highlight_select')) {

                    this.classList.remove('highlight_select')

                    //
                } else {

                    // NAV COUNTER
                    nc = parseInt(card.dataset.id)
                    this.classList.add('highlight_select')

                    if (prev_card) {
                        prev_card.classList.remove('highlight_select')
                        prev_card = this
                    } else {
                        prev_card = this
                    }

                }

            }
        })

        // LISTEN FOR CONTEXT MENU. LISTEN ONLY DONT SHOW A MENU HERE !!!!!!
        card.addEventListener('contextmenu', function (e) {

            // SET GLOBAL CARD_ID
            card_id = card.id
            source = href

            if (is_folder) {
                card.classList.add('folder_card', 'ds-selected')
            } else {
                card.classList.add('file_card', 'ds-selected')
            }

        })

        // MOUSE OVER
        card.onmouseover = (e) => {

            // e.preventDefault();
            // e.stopPropagation();

            // SET GLOBAL CARD ID ON HOVER
            // todo: this needs to be vetted
            card_id = id;

            // HIGHLIGHT CARD timeoutid = setTimeout(() => {
            // timer = setTimeout(() => {
            card.classList.add("highlight");
            // }, 500);

            nc = nc2;
            nc2 = parseInt(card.dataset.id);

            active_href = href;

            /* Add audio controls on mouse over */
            if (is_audio) {

                source.src = href;
                audio.setAttribute('controls', '');
                audio.style = 'height: 15px; width: 100%;';
                audio.classList.add('audio')
                audio.append(source);

            }

            // notification(path.basename(href))

        }

        //  OUT
        card.onmouseout = (e) => {

            notification(path.basename(breadcrumbs.value))

            // clearTimeout(timer);
            card.classList.remove('highlight');
            // let cards = document.getElementsByClassName('card')
            // for (let i = 0; i < cards.length; i++) {
            //     cards[i].classList.remove('highlight')
            // }
            audio.removeAttribute('controls')

        }

        // IMG CLICK
        img.addEventListener('click', function (e) {
            e.preventDefault()

            historize = 1;

            if (is_folder) {
                // get_files(href, () => {})
                get_view(href)
            } else {
                open(href, { wait: false })
            }

        })

        img.onmouseover = () => {
            // get_image_properties(href)
        }

        // CREATE CONTENT
        content.classList.add('content')
        content.style = 'overflow-wrap: break-word;'

        // CREATE HEADER
        header.href = href
        header.text = linktext
        header.title = 'open file? ' + href
        header.id = 'header_' + id
        header.classList.add('header_link')
        header.draggable = false


        header.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()

            historize = 1;

            if (is_folder) {
                get_view(href);
            } else {

                open(href, { wait: false })
            }

        })

        // HEADER MOUSE OVER
        header.addEventListener('mouseover', function (e) {
            if (is_folder) {
                card_id = id
            }
        })

        // FOR EDIT MODE
        input.id = 'edit_' + id
        input.classList.add('hidden', 'input')
        input.type = 'text'
        input.spellcheck = false
        input.value = linktext

        // selrange.moveEnd(href.length - path.extname(href).length)


        // CHANGE EVENT
        input.addEventListener('change', function (e) {

            e.preventDefault()

            if (this.value == "") {

                alert('enter a name')

            } else {

                card.classList.add('highlight_select')
                source = path.dirname(href) + '/' + this.value.trim()

                // RENAME FILE
                if (!fs.existsSync(source)) {

                    rename_file(href, this.value.trim())
                    this.classList.add('hidden')
                    href = path.dirname(href) + '/' + this.value
                    card.dataset.href = href
                    header.classList.remove('hidden')
                    header.text = this.value
                    header.href = href
                    header.title = 'open file? ' + path.dirname(href) + '/' + this.value
                    update_card(source)

                } else {

                    notification(path.basename(href) + ' already exists..')

                }

                // header.focus()
                // clear_selected_files()

            }

        })

        // KEYDOWN EVENT
        input.addEventListener('keydown', function (e) {

            if (e.key === 'Escape') {

                // CLEAR ITEMS
                clear_items()

                // CLEAR COPY ARRAY
                clear_copy_arr();

            }

        })

        // INPUT CLICK
        input.addEventListener('click', function (e) {
            e.stopPropagation()
            e.preventDefault()
        })

        form_control = add_div()

        form_field.appendChild(input)
        form_control.appendChild(form_field)
        form.appendChild(form_control)

        form.preventDefault = true

        let description = add_div()
        description.classList.add('description', 'no-wrap')
        description.draggable = false


        extra.classList.add('extra')
        extra.innerHTML = size
        extra.draggable = false

        progress.id = 'progress_' + id
        progress.classList.add('hidden', 'progress')

        progress_bar.id = 'progress_bar_' + id
        progress_bar.value = '1'
        progress_bar.max = '100'

        // ON DRAG START
        card.ondragstart = function (e) {

            // e.preventDefault()
            // clear_copy_arr()

            // let datalist = e.dataTransfer.items
            // // let data = fs.readFileSync(href)
            // let blob = new Blob([data])
            // let file = new File([blob], path.basename(href), {type: 'text/plain', webkitRelativePath: href})
            // const fr = new FileReader()
            // fr.readAsText(file)
            // e.dataTransfer.setData(path.basename(href), "testing")
            // datalist.add(file)

            e.dataTransfer.effectAllowed = 'copyMove';
            let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');

            if (items.length > 0) {

                items.forEach((item, idx) => {
                    let href = item.dataset.href;
                    let id = item.dataset.id;
                    add_copy_file(href, id);
                })

            }

        }

        // INITIALIZE COUNTER
        let dragcounter = 0;

        // ON DRAG ENTER
        card.ondragenter = function (e) {

            e.preventDefault();
            e.stopPropagation();

            dragcounter++;
            let target = e.target;

            // CARD. NOTE. THIS SEEMS BACKWARDS BUT WORKS AND IS ESSENTIAL FOR SETTING THE CORRECT TARGET PATH. NOT SURE WHY ??
            if (target.id == "") {
                destination = href
                // card.classList.add('highlight_select')
                // BLANK
            } else {

                destination = breadcrumbs.value
            }

            // ipcRenderer.send('active_folder', destination)

            let main_view = document.getElementById('main_view');
            main_view.classList.add('selectableunselected');
            main_view.draggable = false;

            if (e.ctrlKey == true) {
                e.dataTransfer.dropEffect = "copy";
            } else {
                e.dataTransfer.dropEffect = "move";
            }

            return false

        }

        // DRAG OVER
        card.ondragover = function (e) {

            // ADD HIGHLIGHT
            // card.classList.add('highlight_select')
            card.classList.add('highlight')

            if (e.ctrlKey == true) {
                e.dataTransfer.dropEffect = "copy";
            } else {
                e.dataTransfer.dropEffect = "move";
            }

            ipcRenderer.send('active_folder', href);
            ipcRenderer.send('is_main_view', 0)

            e.preventDefault()
            e.stopPropagation()

            return false

        }

        // ON DRAG LEAVE
        card.ondragleave = function (e) {

            e.preventDefault()
            e.stopPropagation()

            dragcounter--

            // todo: this is breaking drag and drop on workspace
            // card.classList.remove('highlight_select')
            card.classList.remove('highlight')

            if (dragcounter === 0) {

                // TURN DRAGGABLE ON MAIN CARD ON
                // notification('setting draggable to true on main view')
                // card.classList.remove('highlight_select')

                let main_view = document.getElementById('main_view')

                // main_view.draggable = true
                // notification('running on drag leave card')

            }
            return false
        }

        card.appendChild(items);
        items.appendChild(item);
        item.appendChild(image);
        item.appendChild(content);
        item.appendChild(popovermenu);
        content.appendChild(header);
        content.appendChild(form_control);
        content.appendChild(description);
        progress.appendChild(progress_bar);
        content.appendChild(extra);
        content.append(audio);
        content.appendChild(progress);
        col.appendChild(card);

        if (grid) {
            grid.appendChild(col);
        }
        return card;

    } catch (err) {
        console.log('error adding card', err);
    }

}

// Get card
function get_card(href) {

    let card        = add_div();
    let icon        = document.createElement('img')
    let link        = add_link(href, path.basename(href));
    let input       = document.createElement('input')
    let date        = add_div();
    let size        = add_div();
    let icon_col    = add_div();
    let info_col    = add_div();
    let audio       = document.createElement('audio')
    let video       = document.createElement('video')
    let source      = document.createElement('source')
    let is_dir      = 0;
    let is_image    = 0;
    let is_audio    = 0;
    let is_video    = 0;

    let icon_size = localStorage.getItem('icon_size')

    icon_col.append(icon);
    info_col.append(input, link, date, size);

    card.append(icon_col);
    card.append(info_col);
    audio.append(source)
    card.append(audio)

    // Mouse over
    card.onmouseover = (e) => {
        active_href = href;
        card.classList.add("highlight");
    }

    //  OUT
    card.onmouseout = (e) => {
        notification(path.basename(breadcrumbs.value))
        card.classList.remove('highlight');
        audio.removeAttribute('controls')
    }

    // ON DRAG START
    card.ondragstart = function (e) {

        // e.preventDefault()
        // clear_copy_arr()

        // let datalist = e.dataTransfer.items
        // // let data = fs.readFileSync(href)
        // let blob = new Blob([data])
        // let file = new File([blob], path.basename(href), {type: 'text/plain', webkitRelativePath: href})
        // const fr = new FileReader()
        // fr.readAsText(file)
        // e.dataTransfer.setData(path.basename(href), "testing")
        // datalist.add(file)

        e.dataTransfer.effectAllowed = 'copyMove';
        let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');

        if (items.length > 0) {

            items.forEach((item, idx) => {
                let href = item.dataset.href;
                let id = item.dataset.id;
                add_copy_file(href, id);
            })

        }

    }

    // INITIALIZE COUNTER
    let dragcounter = 0;

    // ON DRAG ENTER
    card.ondragenter = function (e) {

        e.preventDefault();
        e.stopPropagation();

        dragcounter++;
        let target = e.target;

        if (target.id == "") {
            destination = href
        } else {
            destination = breadcrumbs.value
        }

        let main_view = document.getElementById('main_view');
        main_view.classList.add('selectableunselected');
        main_view.draggable = false;

        if (e.ctrlKey == true) {
            e.dataTransfer.dropEffect = "copy";
        } else {
            e.dataTransfer.dropEffect = "move";
        }

        return false

    }

    // DRAG OVER
    card.ondragover = function (e) {

        card.classList.add('highlight')

        if (e.ctrlKey == true) {
            e.dataTransfer.dropEffect = "copy";
        } else {
            e.dataTransfer.dropEffect = "move";
        }

        ipcRenderer.send('active_folder', href);
        ipcRenderer.send('is_main_view', 0)

        e.preventDefault()
        e.stopPropagation()

        return false

    }

    // ON DRAG LEAVE
    card.ondragleave = function (e) {

        e.preventDefault()
        e.stopPropagation()

        card.classList.remove('highlight')
        return false
    }

    // Input change
    input.addEventListener('change', function (e) {
        e.preventDefault()
        if (this.value == "") {
            alert('enter a name')
        } else {
            card.classList.add('highlight_select')
            source = path.join(path.dirname(href), this.value.trim())
            if (!fs.existsSync(source)) {
                rename_file(href, this.value.trim())

                this.classList.add('hidden')
                href = path.dirname(href) + '/' + this.value
                card.dataset.href = href
                link.classList.remove('hidden')
                link.text = this.value
                link.href = href
                link.title = 'open file? ' + path.dirname(href) + '/' + this.value
                update_card(source)
            } else {
                notification(path.basename(href) + ' already exists..')
            }
        }
    })

    // KEYDOWN EVENT
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            clear_items()
            clear_copy_arr();
        }
    })


    size.innerHTML = get_file_size(localStorage.getItem(href))
    fs.stat(href, (err, stats) => {

        if (!err) {

            // Directory
            if (stats.isDirectory()) {

                is_dir = 1;

                card.classList.add('folder_card');
                icon.dataset.src = folder_icon;

                // Directory event listeners
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    get_view(href);
                })
                icon.addEventListener('click', (e) => {
                    e.preventDefault();
                    get_view(href);
                })

            // Files
            } else {

                card.classList.add('file_card')

                // File event listeners
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    open(href, { wait: false });
                })
                icon.addEventListener('click', (e) => {
                    e.preventDefault();
                    open(href, { wait: false });
                })

            }

            date.innerHTML = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)
            card.dataset.href = href;

            icon.classList.add('icon')
            date.classList.add('date')
            size.classList.add('size', 'extra')

            update_card1(href)

            card.addEventListener('contextmenu', (e) => {

                e.preventDefault()
                e.stopPropagation()

                // SET GLOBAL CARD_ID
                card_id = card.id
                source = href

                let filetype = mime.lookup(href);
                let associated_apps = get_available_launchers(filetype, href);
                if (is_dir) {
                    let filetype = mime.lookup(href);
                    let associated_apps = get_available_launchers(filetype, href);
                    ipcRenderer.send('show-context-menu-directory', {associated_apps});
                } else {
                    let access = 0;
                    try {
                        fs.accessSync(href, fs.X_OK);
                        access = 1;
                        ipcRenderer.send('show-context-menu-files', {apps: associated_apps, access: access, href: href});
                    } catch (err) {
                        ipcRenderer.send('show-context-menu-files', {apps: associated_apps, access: access, href: href});
                    }
                }
            })

        } else {
            console.log('error getting card', err)
        }

    })

    // let icon_size = localStorage.getItem('icon_size')
    switch (icon_size) {
        case '0': {
            icon.classList.add('icon16')
            break;
        }
        case '1': {
            icon.classList.add('icon24')
            break;
        }
        case '2': {
            icon.classList.add('icon32')
            break;
        }
        case '3': {
            icon.classList.add('icon48')
            break;
        }
    }

    input.value = path.basename(href)
    input.classList.add('hidden')
    link.draggable = false
    card.draggable = true
    card.classList.add('card', 'flex', 'nav_item')
    icon_col.classList.add('col')
    icon_col.style = 'width: 50px'
    icon.classList.add('lazy')
    info_col.classList.add('col')

    ds.addSelectables(card)
    return card
}

// Update card
function update_card1(href) {

    // console.log('running update card');
    let cards   = document.querySelectorAll('[data-href="' + href + '"]')
    let ext     = path.extname(href)

    cards.forEach(card => {

        // Details
        let size = card.querySelector('.size')
        let date = card.querySelector('.date')
        let icon = card.querySelector('.icon')
        let audio = card.querySelector('.audio')
        let is_audio = 0;

        // Add data to card
        let stats = fs.statSync(href)
        let mtime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)
        let atime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.atime)
        let ctime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.birthtime)

        date.innerHTML = mtime
        size.innerHTML = get_file_size(localStorage.getItem(href))

        // HANDLE DIRECTORY
        if (stats.isDirectory()) {

            ipcRenderer.send('get_folder_size', { href: href })
            let links = card.querySelectorAll('.header_link');

            // CARD ON MOUSE OVER
            card.addEventListener('mouseover', (e) => {
                size = get_file_size(localStorage.getItem(href))
                card.title =
                    'Name: ' + href +
                    '\n' +
                    'Size: ' + size +
                    '\n' +
                    'Accessed: ' + atime +
                    '\n' +
                    'Modified: ' + mtime +
                    '\n' +
                    'Created: ' + ctime

            })

        // Files
        } else {

            icon.src = path.join(__dirname, 'assets/icons/kora/actions/scalable/viewimage.svg')

            if (
                ext === '.png'  ||
                ext === '.jpg'  ||
                ext === '.gif'  ||
                ext === '.webp' ||
                ext === '.jpeg'
            ) {
                is_image = 1;
                icon.style = 'border: 2px solid #cfcfcf; background-color: #cfcfcf';
                let destination = path.join(thumbnails_dir, path.basename(href));
                if (fs.existsSync(destination)) {
                    icon.dataset.src = destination
                } else {

                    notification('Saving thumbnails. Please wait.')

                    im.resize({
                        srcPath: href,
                        dstPath: destination,
                        width: 128
                    }, (err, stdout, stderr) => {
                        icon.src = destination
                        notification('')
                    })

                }

            } else if (
                ext === '.svg'
            ) {
                icon.dataset.src = href
            } else if (
                ext === '.m4a' ||
                ext === '.mp3' ||
                ext === '.wav' ||
                ext === '.ogg'
            ) {
                is_audio = 1;
                ipcRenderer.invoke('get_icon', href).then(res => {
                    icon.src = res;
                    icon.dataset.src = res;
                })

            } else if (
                ext === '.mp4' ||
                ext === '.webm'
            ) {
                is_video = 1;
                ipcRenderer.invoke('get_icon', href).then(res => {
                    icon.src = res;
                    icon.dataset.src = res;
                })
            } else {
                ipcRenderer.invoke('get_icon', href).then(res => {
                    icon.src = res;
                    icon.dataset.src = res;
                })
            }

            size = get_file_size(stats.size);
            size.innerHTML = size;
            localStorage.setItem(href, stats.size);

            // Card on mouse over
            card.addEventListener('mouseover', (e) => {

                if (is_audio) {
                    source.src = href;
                    audio.setAttribute('controls', '');
                    audio.style = 'height: 15px; width: 100%;';
                    audio.classList.add('audio')
                    audio.append(source);
                }


                size = get_file_size(localStorage.getItem(href));
                card.title =
                    'Name: ' + href +
                    '\n' +
                    'Size: ' + size +
                    '\n' +
                    'Accessed: ' + atime +
                    '\n' +
                    'Modified: ' + mtime +
                    '\n' +
                    'Created: ' + ctime
            })
        }

        ds.addSelectables(card)

    })
}

// Update card
function update_card(href) {
    let cards   = document.querySelectorAll('[data-href="' + href + '"]')
    let ext     = path.extname(href)
    cards.forEach(card => {

        // Details
        let extra = card.querySelector('.extra')
        let description = card.querySelector('.description')
        let icon = card.querySelector('.icon')

        // Add data to card
        fs.stat(href, (err, stats) => {

            // let stats = fs.statSync(href)
            let mtime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)
            let atime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.atime)
            let ctime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.birthtime)

            description.innerHTML   = mtime
            extra.innerHTML         = get_file_size(localStorage.getItem(href))

            // HANDLE DIRECTORY
            if (stats.isDirectory()) {

                ipcRenderer.send('get_folder_size', { href: href })
                let links = card.querySelectorAll('.header_link');

                // icon.src = folder_icon

                // console.log(icon)

                // CARD ON MOUSE OVER
                card.addEventListener('mouseover', (e) => {
                    size = get_file_size(localStorage.getItem(href))
                    card.title =
                        'Name: ' + href +
                        '\n' +
                        'Size: ' + size +
                        '\n' +
                        'Accessed: ' + atime +
                        '\n' +
                        'Modified: ' + mtime +
                        '\n' +
                        'Created: ' + ctime
                })

            // Files
            } else {

                if (
                    ext === '.png'  ||
                    ext === '.jpg'  ||
                    ext === '.gif'  ||
                    ext === '.webp' ||
                    ext === '.jpeg'
                ) {
                    is_image = 1;
                    icon.style = 'border: 2px solid #cfcfcf; background-color: #cfcfcf';
                    let destination = path.join(thumbnails_dir, path.basename(href));
                    if (fs.existsSync(destination)) {
                        icon.dataset.src = destination
                    } else {
                        notification('Saving thumbnails. Please wait.')
                        im.resize({
                            srcPath: href,
                            dstPath: destination,
                            width: 128
                        }, (err, stdout, stderr) => {
                            icon.dataset = destination
                            notification('')
                        })
                    }

                } else if (
                    ext === '.svg'
                ) {
                    icon.dataset.src = href
                } else if (
                    ext === '.m4a' ||
                    ext === '.mp3' ||
                    ext === '.wav' ||
                    ext === '.ogg'
                ) {
                    is_audio = 1;
                    ipcRenderer.invoke('get_icon', href).then(res => {
                        icon.src = res;
                        icon.dataset.src = res;
                    })

                } else if (
                    ext === '.mp4' ||
                    ext === '.webm'
                ) {
                    is_video = 1;
                    ipcRenderer.invoke('get_icon', href).then(res => {
                        icon.src = res;
                        icon.dataset.src = res;
                    })
                } else {
                    ipcRenderer.invoke('get_icon', href).then(res => {
                        icon.src = res;
                        icon.dataset.src = res;
                    })
                }

                size = get_file_size(stats.size);
                extra.innerHTML = size;
                localStorage.setItem(href, stats.size);

                // Card on mouse over
                card.addEventListener('mouseover', (e) => {
                    size = get_file_size(localStorage.getItem(href));
                    card.title =
                        'Name: ' + href +
                        '\n' +
                        'Size: ' + size +
                        '\n' +
                        'Accessed: ' + atime +
                        '\n' +
                        'Modified: ' + mtime +
                        '\n' +
                        'Created: ' + ctime
                })
            }

            ds.addSelectables(card)

        })
    })
}

/**
 * Update Cards - this function adds additional file information
 * @param {*} view requires a valid view to update
 */
function update_cards(view) {

    try {

        let cards = view.querySelectorAll('.nav_item')
        let cards_arr = []

        for (var i = 0; i < cards.length; i++) {
            cards_arr.push(cards[i]);
        }

        let size = ''
        let folder_counter = 0
        let file_counter = 0
        cards_arr.forEach((card, idx) => {

            // DRAG AMD DROP
            ds.addSelectables(card, false)

            let header = card.querySelector('.header_link')
            let img = card.querySelector('.image')

            // PROGRESS
            let progress = card.querySelector('.progress')
            let progress_bar = progress.querySelector('progress')

            // DETAILS
            let extra = card.querySelector('.extra')
            let description = card.querySelector('.description')

            let href = card.dataset.href

            // ADD DATA TO CARD
            let stats = fs.statSync(href)
            if (stats) {

                let atime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.atime)
                let mtime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)
                let ctime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.birthtime)

                card.dataset.id = idx + 1
                description.innerHTML = mtime

                // HANDLE DIRECTORY
                if (stats.isDirectory()) {

                    ++folder_counter

                    card.id = 'folder_card_' + folder_counter
                    card.dataset.id = folder_counter + 1
                    header.id = 'header_folder_card_' + folder_counter

                    card.classList.add('folder_card')

                    img.src = path.join(icon_dir, '-pgrey/places/scalable@2/network-server.svg')
                    img.height = '24px'
                    img.width = '24px'

                    ipcRenderer.send('get_folder_size', { href: href })

                    // CARD ON MOUSE OVER
                    card.addEventListener('mouseover', (e) => {
                        size = get_file_size(localStorage.getItem(href))
                        card.title =
                            'Name: ' + href +
                            '\n' +
                            'Size: ' + size +
                            '\n' +
                            'Accessed: ' + atime +
                            '\n' +
                            'Modified: ' + mtime +
                            '\n' +
                            'Created: ' + ctime

                    })

                // FILES
                } else {

                    ++file_counter

                    card.id = 'file_card_' + file_counter
                    header.id = 'header_file_card_' + file_counter

                    progress.id = 'progress_' + card.id
                    progress_bar.id = 'progress_bar_' + card.id

                    card.classList.add('file_card')

                    size = get_file_size(stats.size)

                    extra.innerHTML = size
                    localStorage.setItem(href, stats.size)

                    // CARD ON MOUSE OVER
                    card.addEventListener('mouseover', (e) => {
                        size = get_file_size(localStorage.getItem(href))
                        card.title =
                            'Name: ' + href +
                            '\n' +
                            'Size: ' + size +
                            '\n' +
                            'Accessed: ' + atime +
                            '\n' +
                            'Modified: ' + mtime +
                            '\n' +
                            'Created: ' + ctime
                    })

                }

            }

        })

        // clear_selected_files()

    } catch (err) {
        // console.log(err)
    }

    file_count = 0
    folder_count = 0

}

// SHOW LOADER
function show_loader() {

    let loader = document.getElementById("loader")
    loader.classList.add('active')
    loader.style = 'background: transparent !important'

    setTimeout(() => {

        if (loader.classList.contains('active')) {

            loader.classList.remove('active')
            alert('Oh no. Operation timed out!')
        }

    }, 20000);
}

// HIDE LOADER
function hide_loader() {
    let loader = document.getElementById("loader")
    loader.classList.remove('active')
}

// ADD BREADCUMBS
function add_pager_item(options) {

    let pager = document.getElementById('pager')

    let breadcrumbs = add_div()
    breadcrumbs.classList.add('ui', 'breadcrumb')

    let section = add_link(options.name, options.name)
    section.classList.add('section', 'active', 'item')
    section.text = options.name
    section.href = '#'

    let divider = add_div()
    divider.classList.add('divider')
    divider.innerText = '/'

    breadcrumbs.appendChild(section)
    breadcrumbs.appendChild(divider)
    pager.appendChild(breadcrumbs)

    section.addEventListener('click', function (e) {
        page = parseInt(options.name)
        pager.html = ''
        get_files(options.dir, () => {

        })

    })

}

// ADD LIST ITEM
function add_list_item(options) {

    let list_item = add_div()
    let list_item1 = add_div()
    let folder_icon = document.createElement('i')
    let content = add_div()
    let header = add_div() // document.createElement('a')
    let description = add_div()
    // let list1 = add_div()

    // list.classList.add('ui','list')
    list_item.classList.add('item')
    list_item1.classList.add('item')
    folder_icon.classList.add('folder', 'icon', 'large')
    content.classList.add('content')
    header.classList.add('header')
    description.classList.add('description')


    header.innerHTML = options.header
    // description.innerHTML = 'what'

    // list.appendChild(item)
    list_item.appendChild(folder_icon)
    list_item.appendChild(content)

    content.appendChild(header)
    content.appendChild(description)
    content.appendChild(list_item1)

    return list_item

}

// RUN COMMAND
var execute = function (command, callback) {
    exec(command, { maxBuffer: 1024 * 500 }, function (error, stdout, stderr) { callback(error, stdout); });
};

// GET DISK USAGE
let du = []
async function get_disk_usage() {

    let cmd = 'df -Ph'
    let child = exec(cmd)
    child.stdout.on("data", (du_data) => {

        let du_grid = document.getElementById('du_grid')
        du_grid.innerHTML = ''
        let du = du_data.split('\n')
        for (let i = 0; i < du.length; i++) {

            let du_col = add_div()

            du_col.innerHTML = du[i] + '</br></br>'
            du_grid.appendChild(du_col)

        }

    })
}

// PAGER
function paginate(array, page_size, page_number) {
    // human-readable page numbers usually start with 1, so we reduce 1 in the first argument
    return array.slice((page_number - 1) * page_size, page_number * page_size);
}

// ADD TREE ITEM
function add_tree_item(options) {

    let filename        = options.linktext
    let filepath        = options.href

    let items           = add_div()
    let item            = add_div()
    let header          = add_div()
    let icon_div        = add_div()
    let icon            = document.createElement('i')
    let chevron         = add_icon('chevron')
    let subicon_div     = add_div()
    let subicon         = document.createElement('i')
    let href            = document.createElement('a')
    let content         = add_div()
    let subitems        = add_div()
    let sidebar_items   = document.getElementById('sidebar_items');

    icon.classList.add('right', 'icon')
    items.classList.add('items', 'tree_item')
    item.classList.add('item', 'no-wrap')


    chevron.classList.add('right', 'small')
    chevron.style = 'float: left;'
    // item.style = 'margin-bottom:0px; padding-bottom:2px'
    // header.classList.add('header')
    // header.style = 'font-size: 12px;'
    // content.classList.add('content', 'tree_item')
    // subitems.style = 'margin-left: 10px;'
    item.draggable = false

    // CHECK FOR SUB DIRS
    let subdirs = ''
    try {
        subdirs = fs.readdirSync(filepath, { withFileTypes: true })
    } catch (err) {

    }

    if (subdirs.length > 0) {
    }

    href.src = filepath
    href.text = filename + ' (' + subdirs.length + ')'

    // href.style = 'color:#cfcfcf !important;'
    header.append(href)
    subitems.dataset.id = filename
    // sidebar_items.append(chevron)

    if (subdirs.length > 0) {

        // sidebar_items.append(chevron)
        for (let i = 0; i < subdirs.length; i++) {

            let subfilename = subdirs[i].name
            let subfilepath = path.join(filepath, '/', subfilename)

            let stats
            try {
                stats = fs.statSync(subfilepath)
            } catch (err) {

            }

            if (stats) {
                if (stats.isDirectory()) {

                } else {

                }
            }

            subicon.classList.add('icon', 'bi-folder', 'tree_subicon')
            subicon_div.append(subicon)

        }

    } else {

        // sidebar_items.append(add_icon('times))
        // icon.classList.add('icon')
        // subicon_div.classList.add('tree_subicon')
        subicon.classList.add('icon', 'bi-folder', 'tree_subicon')
        subicon_div.append(subicon)

    }


    if (path.dirname(filepath) == '/media/michael') {
        subicon.classList.add('icon', 'hdd', 'outline')
    }

    content.appendChild(subicon_div)
    content.appendChild(header)

    items.appendChild(item)
    items.appendChild(subitems)
    item.appendChild(content)

    sidebar_items.append(items)
    item.addEventListener('click', function (e) {

        e.preventDefault()
        e.stopPropagation()

        if (chevron.classList.contains('right')) {

            chevron.classList.remove('right')
            chevron.classList.add('down')

            try {
                get_sidebar_files(filepath)
            } catch (err) {

            }
            subitems.classList.remove('hidden')

        } else {

            chevron.classList.add('right')
            chevron.classList.remove('down')

            subitems.classList.add('hidden')

        }

    })

    // TREE ICON CLICK
    chevron.addEventListener('click', function (e) {
        e.preventDefault()

        if (chevron.classList.contains('right')) {

            chevron.classList.remove('right')
            chevron.classList.add('down')

            try {
                get_sidebar_files(filepath)
            } catch (err) {

            }
            subitems.classList.remove('hidden')

        } else {

            chevron.classList.add('right')
            chevron.classList.remove('down')

            subitems.classList.add('hidden')

        }

    })

    href.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation()
        get_view(filepath);
    })


    // HEADER CLICK
    header.addEventListener('click', function (e) {

        e.preventDefault();
        e.stopPropagation();

        e.preventDefault()

        if (chevron.classList.contains('right')) {

            chevron.classList.remove('right')
            chevron.classList.add('down')

            try {
                get_sidebar_files(filepath)
            } catch (err) {

            }
            subitems.classList.remove('hidden')

        } else {

            chevron.classList.add('right')
            chevron.classList.remove('down')

            subitems.classList.add('hidden')

        }

        // get_view(filepath);

    })

    item.addEventListener('mouseover', function (e) {
        this.classList.add('highlight')
    })


    item.addEventListener('mouseout', function (e) {
        this.classList.remove('highlight')
    })

    return items

}

// TREE
async function get_sidebar_files(dir) {

    let sidebar_items       = document.getElementById('sidebar_items');
    let sb_breadcrumbs      = document.createElement('ul') //add_div();
    let dirents             = fs.readdirSync(dir, { withFileTypes: true });

    sidebar_items.innerHTML = '';
    // sb_breadcrumbs.classList.add('ui', 'breadcrumb');
    sb_breadcrumbs.classList.add('uk-breadcrumb');

    if (dirents) {

        /* Make header dir selectable */
        let dir_arr = dir.split('/')
        let nav_path = '/'
        dir_arr.forEach((item, idx) => {

            nav_path = path.join(nav_path, item);

            let li = document.createElement('li');

            let link = add_link(nav_path, item);
            link.classList.add('nav_header', 'section');
            link.dataset.src = nav_path;
            link.style = 'font-size: 12px; color: red; padding: 2px;';
            link.style.color = 'red';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                get_sidebar_files(link.dataset.src);
                get_view(link.dataset.src);
            })

            if (idx > 0) {
                sidebar_items.append(link, '/');
            }

        })

        sidebar_items.append(add_br(), add_br());

        //SET DEFAULT SORT OPTION
        if (!options.sort) {
            options.sort = 1;
        }

        // SORT BY NAME
        let filter = dirents.sort((a, b) => {

            if (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase()) {
                return -1;
            }
            if (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase()) {
                return 1;
            }
            return 0;
        })

        const regex = /^\..*/
        filter.forEach((file, idx) => {

            if (regex.test(file.name) == false || localStorage.getItem('show_hidden') == 1) {

                let filename = file.name;
                let filepath = dir + '/' + filename;
                let stats = fs.statSync(filepath);
                let is_dir = stats.isDirectory();

                if (is_dir) {

                    let options = {
                        id: 'tree_' + idx,
                        href: filepath,
                        linktext: filename,
                        image: '../assets/icons/vscode/default_folder.svg',
                        is_folder: true,
                        grid: sidebar_items,
                        description: '',
                        size: 0
                    }

                    add_tree_item(options)

                }

            }

        })

    }

}

// // GET_TEMPLATES
// let templates_arr = []
// function get_templates(){

//     let templates = fs.readdirSync('assets/templates')
//     for(let i = 0; i < templates.length; i++){
//         console.log(templates[i])
//     }

// }


// GET FILE FROM TEMPLATE
function get_templates(file) {

    let templates = fs.readdirSync('assets/templates')
    for (let i = 0; i < templates.length; i++) {
        console.log(templates[i])
    }

}

// DISK USAGE CHART
var chart
function add_chart(chart_type, chart_labels, chart_data) {

    const ctx = document.createElement('canvas');
    ctx.getContext('2d');
    ctx.id = 'chart';
    ctx.width = 200;
    ctx.height = 100;

    chart = new Chart(ctx, {
        type: chart_type,
        data: {
            labels: chart_labels,
            datasets: [{
                data: chart_data,
                backgroundColor: [
                    // pattern.draw('square', '#ff6384'),
                    // pattern.draw('circle', '#36a2eb'),
                    // pattern.draw('diamond', '#cc65fe'),
                    // pattern.draw('triangle', '#ffce56'),
                    'rgba(255, 132, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    // 'rgba(75, 192, 192, 0.1)',
                    // 'rgba(153, 102, 255, 0.1)',
                    // 'rgba(255, 159, 64, 0.1)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, .5)',
                    'rgba(54, 162, 235, .5)',
                    'rgba(255, 206, 86, .5)',
                    'rgba(75, 192, 192, .5)',
                    'rgba(153, 102, 255, .5)',
                    'rgba(255, 159, 64, .5)'
                ],
                borderWidth: 1,
            }]
        },
        options: {
            responsive: false,
            // indexAxis: 'y',
            scales: {
                x: {
                    ticks: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                },
            },
            plugins: {
                legend: {
                    display: false,
                },
                footer: {
                    display: false,
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function (x) {
                            return get_file_size(x.dataset.data[x.dataIndex] * 1024)
                        }
                    }
                }
            }

        }
    })

    return ctx;

}

// DISK USAGE CHART
var disk_usage_chart
function bar_chart(chart_labels, chart_data) {

    if (disk_usage_chart != undefined) {
        disk_usage_chart.destroy()
    }

    const ctx = document.getElementById('myChart').getContext('2d');

    disk_usage_chart = new Chart(ctx, {

        type: 'bar',
        data: {
            labels: chart_labels,
            datasets: [{
                label: '',
                data: chart_data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(255, 159, 64, 0.2)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: {
                x: {
                    ticks: {
                        callback: function (value) {
                            return get_file_size(value)
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                },
                // yLabels: {
                //     callback: function (args1, args2) {
                //         return 'shit'
                //     }
                // }
            },
            plugins: {
                legend: {
                    display: false,
                },
                footer: {
                    display: false,
                }
            }
        }

    })

}

// CHART OPTIONS
function get_disk_usage_chart() {

    let info_view = document.getElementById('info_view');

    let grid = add_div();
    grid.classList.add('ui', 'grid');

    let col = add_div();
    col.classList.add('column', 'sixteen', 'wide');

    // notification('getting disk usage chart')
    let cmd = "df '" + breadcrumbs.value + "'";
    let child = exec(cmd);

    let chart_labels = [];
    let chart_labels1 = [];
    let chart_data = [];


    child.stdout.on("data", (res) => {

        let res1 = res.split('\n')

        let headers = res1[0].split(' ')
        for (let i = 0; i < headers.length; i++) {
            if (headers[i] != '') {
                chart_labels.push(headers[i])
            }
        }

        let details = res1[1].split(' ')
        for (let i = 0; i < details.length; i++) {
            if (details[i] != '') {
                chart_labels1.push(get_file_size(details[i]))
            }
        }

        for (let i = 0; i < details.length; i++) {
            if (details[i] != '') {
                chart_data.push(details[i])
            }
        }

        cmd = 'cd "' + breadcrumbs.value + '"; du -s'
        du = exec(cmd)

        du.stdout.on('data', function (res) {

            let size = parseInt(res.replace('.', ''))
            // size = get_file_size(size)

            chart_labels.push('folder size')
            chart_data.push((size))

            if (size > 1000000000) {
                extra.innerHTML = '<span style="color:red">' + get_file_size(size) + '</span>'
            } else {
            }

            // notification(chart_data)
            // bar_chart(chart_labels, chart_data)
            grid.append(col)
            let chart = add_chart('bar', chart_labels, chart_data)
            // chart.style = 'height: 100px !important; width: 800px !important'
            col.append(chart);
            info_view.append(grid)

        })


    })

}

// GET DISK SPACE
function get_diskspace(dir) {

    let cmd = 'df "' + dir + '"'
    let child = exec(cmd)

    // let chart_labels = []
    // let chart_data = []

    child.stdout.on("data", (res) => {

        let status = document.getElementById('status')
        status.innerHTML = ''

        res = res.split('\n')

        for (let i = 1; i < res.length - 1; i++) {


            // notification(res[i])

            res1 = res[i].split(' ')

            if (res1.length > 0) {

                // status.innerHTML = 'size:' + res1[]

                for (let i = 0; i < res1.length; i++) {

                    // 0 DISK
                    // 6 SIZE OF DISK
                    // 7 USED SPACE
                    // 8 AVAILABLE SPACE
                    // 10 PERCENTAGE USED
                    // 11 CURRENT DIR

                    if (res1[i] != '') {

                        let item = add_div()
                        item.style = 'padding-right: 5px'

                        chart_labels.push('')
                        chart_data.push(res1[i])

                        switch (i) {
                            case 6:
                                item.innerHTML = '<div class="item">Disk size: <b>&nbsp' + get_file_size(res1[i] * 1024) + '</b></div>'
                                break;
                            case 7:
                                item.innerHTML = '<div class="item">Used space: <b>&nbsp' + get_file_size(res1[i] * 1024) + '</b></div>'
                                break;
                            case 8:
                                item.innerHTML = '<div class="item">Available space: <b>&nbsp' + get_file_size(res1[i] * 1024) + '</b></div>'
                                break;
                        }

                        status.appendChild(item)

                    }

                }
                notification(chart_labels + ' ' + chart_data)
                get_disk_usage_chart(chart_labels, chart_data)
            }
        }


        cmd = 'cd "' + breadcrumbs.value + '"; du -s'
        du = exec(cmd)

        du.stdout.on('data', function (res) {

            let size = parseInt(res.replace('.', '') * 1024)
            size = get_file_size(size)

            let item1 = add_div()
            item1.innerHTML = '<div class="item">Folder Size: <b>&nbsp' + size + '</b></div>'
            status.appendChild(item1)


            let item2 = add_div()
            item2.innerHTML = '<div class="item"><b>' + directories.length + '</b>&nbsp Folders / <b>' + files.length + '</b>&nbsp Files</div>'
            status.appendChild(item2)


        })

    })

}

// GET DIR SIZE
async function get_dir_size(dir) {
    href = dir
    cmd = "cd '" + href + "'; du -s"
    du = exec(cmd)
    return new Promise((resolve, reject) => [

        du.stdout.on('data', function (res) {

            let size = parseInt(res.replace('.', '') * 1024);
            resolve(size);

        })

    ])
}

// GET FOLDER SIZE
function get_flder_size(href) {
    return new Promise(resolve => {
        let breadcrumbs = document.getElementById('breadcrumbs')
        if (breadcrumbs.value.indexOf('gvfs') == -1) {

            // cmd = 'cd "' + dir + '"; du -b'
            // return du = execSync(cmd)
            const regex = /^\..*/
            let folder_card = document.getElementsByClassName('folder_card')

            if (folder_card.length > 0) {
                for (let i = 0; i < folder_card.length; i++) {

                    cmd = 'cd "' + href + '"; du -s'
                    du = exec(cmd)
                    du.stdout.on('data', function (res) {

                        let extra = folder_card[i].querySelector('.extra')

                        let size = parseInt(res.replace('.', '') * 1024)
                        if (size > 1000000000) {
                            extra.innerHTML = '<span style="color:red">' + get_file_size(size) + '</span>'
                        } else {
                            extra.innerHTML = get_file_size(size)
                        }

                        resolve(size)

                    })

                }
            }

        } else {
            console.log('gvfs folder. dont scan size')
        }
    })
}

function get_folder_size1(href, callback) {

    cmd = 'cd "' + href + '"; du -s'
    du = exec(cmd)
    du.stdout.on('data', function (res) {

        let size = parseInt(res.replace('.', '') * 1024)
        callback(size)

    })
}

/* Clear minibar highlight */
function clear_minibar() {
    let file_properties = document.getElementById('file_properties')
    let minibar_item    = document.getElementById('minibar')
    minibar_items       = minibar_item.querySelectorAll('.item')
    if (file_properties) {
        // file_properties.classList.add('hidden')
    }

    minibar_items.forEach(item => {
        item.style = '';
    })

}

// CLEAR WORKSPACE
function clear_workspace() {
    localStorage.setItem('workspace', '[]');
    let workspace = document.getElementById('workspace');
    workspace.innerHTML = '';
}

// ADD ITEM TO WORKSPACE
function add_workspace() {

    let file_exists     = 0;
    // let local_items     = JSON.parse(localStorage.getItem('workspace'));
    let workspace       = document.getElementById('workspace')
    let items           = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');
    let sb_items        = document.getElementById('sidebar_items');
    let workspace_msg   = document.getElementById('workspace_msg');
    let mb_icon         = document.getElementById('mb_workspace');
    let workspace_arr   = [];

    // workspace_msg.innerHTML = ''

    // clear_minibar();
    // mb_icon.style = 'color: #ffffff !important'
    // localStorage.setItem('minibar', 'mb_workspace')
    localStorage.setItem('sidebar', 1);
    show_sidebar();

    // localStorage.setItem('workspace', null)

    if (localStorage.getItem('workspace') == null) {
        items.forEach(card => {
            workspace_arr.push(card.dataset.href);
        })
        localStorage.setItem('workspace', JSON.stringify(workspace_arr));
    }

    let local_items = JSON.parse(localStorage.getItem('workspace'));
    local_items.forEach(item => {
        workspace_arr.push(item);
    })

    if (items.length > 0) {

        items.forEach((item, idx) => {

            local_items.forEach(local_item => {
                if (local_item.indexOf(item.dataset.href) > -1) {
                    notification(item.dataset.href + ' is alreay in workspace')
                    file_exists = 1;
                }
            })

            if (!file_exists) {

                workspace_arr.push(item.dataset.href);

            }

        })

    } else {
        // workspace_msg.append('There are no items in your workspace. (Ctrl+Shift+Click)');
        // sb_items.append(workspace_msg);
    }


    localStorage.setItem('workspace', JSON.stringify(workspace_arr));
    // sb_items.append(workspace);

    get_workspace()
    clear_items();

}

/**
 * Get workspace items
 */
async function get_workspace() {

    clear_minibar()

    let mb_workspace        = document.getElementById('mb_workspace')
    let local_items         = JSON.parse(localStorage.getItem('workspace'))
    let sb_items            = document.getElementById('sidebar_items')
    let find                = document.getElementById('find')
    let workspace           = add_div();
    let workspace_msg       = add_div();
    let btn_clear_workspace = add_item('Clear workspace');

    workspace.classList.add('grid')

    // find.innerHTML       = '';
    sb_items.innerHTML      = '';
    workspace.id            = 'workspace';
    workspace_msg.id        = 'workspace_msg'

    mb_workspace.style = 'color: #ffffff !important'
    workspace.style.height = '100%'

    if (localStorage.getItem('workspace') == null) {

        localStorage.setItem('minibar', 'mb_workspace')
        workspace_msg = 'To add files or folders to the workspace. Right Click, (Ctrl+D) or Drag and Drop'
        // sidebar_items.append(workspace_msg)

    } else {

        localStorage.setItem('minibar', 'mb_workspace')

        if (local_items.length > 0) {

            local_items.forEach((item, idx) => {

                try {

                    let stats = fs.statSync(item);

                    /* Add card */
                    options = {
                        id: idx,
                        href: item,
                        linktext: path.basename(item),
                        is_folder: stats.isDirectory(),
                        grid: workspace
                    }

                    let card = get_card(options.href)
                    workspace.append(card)

                    let icon = add_icon('times');
                    icon.classList.add('small');
                    icon.style = 'margin-top: 10px; float:right; height:23px; width:23px; cursor: pointer;';

                    card.append(icon);

                    /* Remove card */
                    icon.addEventListener('click', (e) => {
                        card.remove();
                        local_items.splice(idx, 1);
                        localStorage.setItem('workspace',JSON.stringify(local_items));
                        get_workspace();
                    })

                } catch (err) {
                    // todo: use this clean up missing items from 'local_items' local storage
                }

            })

        } else {
            workspace_msg = 'To add files or folders to the workspace. Right Click, (Ctrl+D) or Drag and Drop'
            sidebar_items.append(workspace_msg)
        }

    }

    // Workspace on drag over
    workspace.ondragover = (e) => {
        return false;
    }

    // Workspace on drag leave
    // workspace.ondragleave = (e) => {
    //     e.preventDefault();
    //     return false;
    // }

    // Workspace content on drop
    workspace.ondrop = (e) => {
        add_workspace();
    }

    sb_items.append(workspace)

}

// QUICK SEARCH
function quick_search() {

    txt_search = document.getElementById('txt_search')

    txt_search.classList.remove('hidden')
    txt_search.focus()

    if (e.key === 'Enter') {

        cards = main_view.querySelectorAll('.nav_item')
        cards.forEach(card => {

            let href = card.dataset.href.toLocaleLowerCase()

            if (href.indexOf(txt_search.value.toLocaleLowerCase()) != -1) {
                card.classList.add('highlight_select')
                card.querySelector('a').focus()
            }

        })

    }
}

// GET TIME STAMP
function get_time_stamp(date) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

// LOAD VIEW
let view = ''
let view0 = ''

/**
*   Get view - Run all calls to files should run through this.
*/
async function get_view(dir) {

    let stats = ''
    try {
        if (dir) {

            stats = fs.statSync(dir);
            if (stats) {

                // Set local storage
                localStorage.setItem('folder', dir);

                // Update active directory in main.js
                ipcRenderer.send('current_directory', dir);

            }

        } else {

        }

    } catch (err) {
        notification(err);
    }

    /* Set active on file menu */
    let file_menu = document.getElementById('file_menu');
    let file_menu_items = file_menu.querySelectorAll('.item');

    /* Get reference to grids */
    let grid_view = document.getElementById('grid_view');
    let list_view = document.getElementById('list_view');
    let info_view = document.getElementById('info_view');

    view0 = view;
    view = localStorage.getItem('view');

    /* Grid View */
    if (view == 'grid') {

        file_menu_items.forEach(item => {

            if (item.innerText == path.basename(dir)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }

        })

        let btn_grid_view = document.getElementById('btn_grid_view');
        btn_grid_view.classList.add('active')
        btn_list_view.classList.remove('active')
        btn_disk_view.classList.remove('active')

        grid_view.classList.remove('hidden')
        // grid_view.classList.add('fm', 'tab-content')

        list_view.classList.add('hidden')
        list_view.innerHTML = ''

        info_view.classList.add('hidden')
        info_view.innerHTML = ''

        // Add tab if first page
        let tabs = document.getElementById('tabs')
        tabs.innerHTML = ''

        // get_paged_files(dir, 5, 1, files => {});

        // // let tab = document.querySelectorAll('.tab')
        // // if (tab.length == 0) {
        // //     tabs.append(add_tab(dir))
        // // }

        // Get files
        get_files(dir, () => {
            lazyload()
        });
        notification(path.basename(dir))

    /* List View */
    } else if (view == 'list') {

        file_menu_items.forEach(item => {
            if (item.innerText == path.basename(dir)) {
                item.classList.add('active')
            } else {
                item.classList.remove('active')
            }
        })

        let btn_list_view = document.getElementById('btn_list_view');
        btn_list_view.classList.add('active')
        btn_grid_view.classList.remove('active')
        btn_disk_view.classList.remove('active')

        list_view.classList.remove('hidden');
        list_view.innerHTML = ''

        info_view.classList.add('hidden')
        info_view.innerHTML = ''

        grid_view.classList.add('hidden');

        get_list_view(dir);


    /* Disk Summary */
    } else if (view == 'disk_summary') {

        let btn_disk_view = document.getElementById('btn_disk_view')
        btn_disk_view.classList.add('active')
        btn_list_view.classList.remove('active')
        btn_grid_view.classList.remove('active')

        info_view.classList.remove('hidden')
        info_view.innerHTML = ''

        list_view.classList.add('hidden')
        grid_view.classList.add('hidden')
        localStorage.setItem('view', view0)

        get_disk_summary_view()

    } else if (view == 'settings') {

        get_settings_view()

    }

    /* Change target on view */
    ipcRenderer.send('is_main_view', 1)
    ipcRenderer.send('active_folder', dir)
    ipcRenderer.send('current_directory', dir)

}

// Settings View
async function get_settings_view() {

    let main_view = document.getElementById('main_view');
    let info_view = document.getElementById('info_view');
    let message   = add_message('Be carfull editing these settings. There is currently no protection and you might break something!');
    // let btn_close = add_icon('times');
    let tabs      = document.getElementById('tabs');
    let tab_view  = add_div();
    let tab       = add_tab('Keyboard Shortuts');

    // let tab2   = add_tab('Tab2')
    tabs.innerHTML = '';
    info_view.innerHTML = '';

    tabs.append(tab);

    // tab_view.append(tab, tab2)
    // info_view.append(tab_view)

    info_view.classList.remove('hidden');
    info_view.classList.add('fm', 'tab-content')
    message.classList.add('inverted');
    // btn_close.classList.add('small');

    let views = document.querySelectorAll('.view');
    views.forEach(view => {
        view.classList.add('hidden');
    })

    // info_view.innerHTML = '';
    info_view.classList.remove('hidden');
    // btn_close.style = 'position: absolute; right: 0;';

    // info_view.append(btn_close);
    info_view.append(message);

    let div = add_div();
    let col1 = add_div();
    let col2 = add_div();
    let col3 = add_div();

    div.classList.add('fm', 'grid', 'item');
    // div.style = 'padding-bottom: 10px';
    // col1.style = 'width: 250px;';
    // col2.style = 'width: 350px;';

    col1.classList.add('fm', 'col');
    col2.classList.add('fm', 'col');
    // col3.classList.add('fm', 'col');

    col1.append(add_header('Command'));
    col2.append(add_header('Shortcut'));
    col3.append(add_header('Set Shortcut'))

    div.append(col1, col2);
    info_view.append(div);

    let settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), {encoding:'utf8', flag:'r'}));
    for (let shortcut in settings.keyboard_shortcuts) {

        let div = add_div();
        div.classList.add('fm', 'grid','item', 'stripe')
        // div.style = 'display: flex; align-items: center; height: 30px;';

        let col1 = add_div();
        let col2 = add_div();
        // let col3 = add_div();

        let label = add_label(shortcut, settings.keyboard_shortcuts[shortcut]);
        let input = add_input('text', shortcut); // add_text(settings.keyboard_shortcuts[shortcut])
        let set_shortcut = add_input('', 0)

        label.classList.add('settings_label');
        input.value = settings.keyboard_shortcuts[shortcut];
        input.classList.add('settings_input');

        col1.classList.add('fm', 'col');
        col2.classList.add('fm', 'col');

        col1.append(label);
        col2.append(input);

        div.append(col1, col2);

        info_view.append(div);

        input.addEventListener('change', (e) => {

            let key = input.id;
            settings.keyboard_shortcuts[key] = input.value;

            console.log(key, input.value);
            fs.writeFileSync(path.join(__dirname, 'settings.json'), JSON.stringify(settings, null, 4));

            ipcRenderer.send('reload_settings');

        })

        // for (let x in settings[cat]) {
        //     console.log(settings[cat][x])
        // }
    }

}

// GET DISK SUMMARY VIEW
async function get_disk_summary_view() {

    // ADD ARRAY
    let chart_labels = []
    let labels = []

    // INFO VIEW
    let view = document.getElementById('info_view')
    view.innerHTML = ''

    // GRID
    let grid = add_div()
    grid.classList.add('ui', 'grid')

    // COMMAND
    // let disks = execSync('df -l -t ext4').toString().split('\n');
    let disks = execSync('df').toString().split('\n');
    // disks.shift()
    disks_arr = disks.filter(a => { return a !== ''; })
    disks_arr.forEach((disk, i) => {

        // GRID FOR DATA
        let data_grid = add_div()
        data_grid.classList.add('ui', 'grid', 'fluid')

        let chart_data = []

        // ADD COLUMN TO GRID
        let col = add_div()
        col.classList.add('column', 'eight', 'wide')

        // ADD CARD
        let card = add_div()
        card.classList.add('ui', 'card', 'fluid', 'shadow')
        card.style = 'border: 1px solid black;'

        let image = add_div()
        image.classList.add('image1')

        // ADD CONTENT
        let content = add_div()
        content.classList.add('content')

        // ADD HEADER
        let header = add_div()
        header.classList.add('header')

        // CREATE ARRAY OF DISK INFO
        let data = disk.split(' ');
        let data_arr = data.filter(a => {
            return a !== '';
        })

        // LOOP OVER DATA ARRAY
        data_arr.forEach((item, ii) => {

            // GET LABELS
            if (i == 0) {
                labels.push(item)
            }

            // ADD CHART LABELS
            if (i == 0 && (ii > 0 && ii < 4)) {

                chart_labels.push(item)
                content.append(item)

                // ADD CHART DATA
            } else if (i > 0 && (ii > 0 && ii < 4)) {
                chart_data.push(parseInt(item))
            }

            // ADD FIRST ITEM AS HEADER
            if (ii == 0) {

                header.append(item)
                content.append(header, add_br(), add_br())

            // ADD DATA
            } else {

                // IF INTEGER THEN GET FILE SIZE
                if (ii > 0 && ii < 4) {

                    let data_col1 = add_column('three')
                    data_col1.append(labels[ii])
                    data_col1.style = 'border: none;'

                    let data_col2 = add_column('twelve')
                    data_col2.append(get_file_size(parseInt(item) * 1024))
                    data_col2.style = 'border: none;'

                    data_grid.append(data_col1, data_col2)

                } else {

                    let data_col1 = add_column('three')
                    data_col1.append(labels[ii])

                    let data_col2 = add_column('twelve')

                    // ADD LINK TO MOUNTED
                    if (ii >= data_arr.length -1) {

                        let href = add_link(item, item);
                        href.addEventListener('click', (e) => {
                            get_view(item);
                        })

                        data_col2.append(href);
                    } else {
                        data_col2.append(item);
                    }

                    data_grid.append(data_col1, data_col2)

                }

            }

            // ADD DATA GRID TO CONTENT
            content.append(data_grid)

            // ADD CONTENT TO CARD
            card.append(content)

            // ADD CARD TO COLUMN
            col.append(card)

        })

        // CREATE CHART
        if (i > 0) {

            let chart = add_chart('doughnut', chart_labels, chart_data)
            chart.style = 'float:left'

            image.append(chart)
            content.prepend(image)

            content.style = 'padding-bottom: 20px;'

            // ADD COLUMN TO GRID
            grid.append(col)

        }
    });

    // ADD GRID TO VIEW
    view.append(grid);


    get_disk_usage_chart()


}

// GET LIST VIEW
async function get_list_view(dir) {

    // let grid_view = document.getElementById('grid_view')
    let list_view = document.getElementById('list_view')

    list_view.innerHTML = ''

    // grid_view.classList.add('hidden')
    // list_view.classList.remove('hidden')

    let sort = parseInt(localStorage.getItem('sort'))

    const breadcrumbs = document.getElementById('breadcrumbs')
    breadcrumbs.classList.add('ui', 'breadcrumb')
    breadcrumbs.value = dir
    breadcrumbs.title = dir

    // SET FOLDER TO LOCAL STORAGE
    localStorage.setItem('folder', dir)

    // DEFINE COLUMNS
    let cols_arr = [
        {
            name: 'Name',
            sort: 2,
            show: 1
        },
        {
            name: 'Size',
            sort: 3,
            show: 1
        },
        {
            name: 'Modified',
            sort: 1,
            show: 1
        },
        {
            name: 'Type',
            sort: 4,
            show: 1
        },
        {
            name: 'Created',
            sort: 5,
            show: 0
        }
    ]

    // READ DIRECTORY
    fs.readdir(dir, (err, dirents_arr) => {

        if (err) {

        } else {

            let table = document.createElement('table')
            let thead = document.createElement('thead')
            let tr = document.createElement('tr')
            let tbody = document.createElement('tbody')

            // table.classList.add('ui', 'four', 'selectable', 'sortable', 'compact', 'celled', 'table')
            table.classList.add('ui', 'table', 'compact', 'small')
            thead.classList.add('full-width')
            table.style = 'background:transparent !important;'

            table.append(thead)
            thead.append(tr)

            cols_arr.forEach((col, idx) => {

                if (col.show == 1) {

                    let th = document.createElement('th')
                    th.innerHTML = col.name
                    th.dataset.sort = idx + 1

                    th.addEventListener('click', (e) => {
                        let sort = col.sort
                        localStorage.setItem('sort', sort)
                        get_list_view(dir)
                    })

                    if (col.name == 'Name') {
                        th.classList.add('eight', 'wide')
                    } else {
                        th.classList.add('two', 'wide')
                    }

                    tr.append(th)

                }


            })

            // ADD TABLE TO LIST VIEW
            list_view.append(table)

            // REGEX FOR HIDDEN FILE
            const regex = /^\..*/

            let dirents = []
            let show_hidden = localStorage.getItem('show_hidden');
            if (show_hidden === '0' || show_hidden == '') {

                dirents = dirents_arr.filter(a => !regex.test(a));

            } else {
                dirents = dirents_arr;
            }

            /* Get sort direction */
            let sort_direction = localStorage.getItem('sort_direction')
            let sort_flag = 0;
            if (sort_direction == 'asc') {
                sort_flag = 1;
            }

            // SORT
            switch (parseInt(sort)) {
                // SORT BY DATE
                case 1: {
                    // SORT BY DATE DESC
                    dirents.sort((a, b) => {
                        try {
                            s1 = fs.statSync(path.join(dir, a)).mtime;
                            s2 = fs.statSync(path.join(dir, b)).mtime;
                            // SORT FLAG
                            if (sort_flag == 0) {
                                return s2 - s1
                            } else {
                                return s1 - s2
                            }
                        } catch (err) {
                            console.log(err)
                        }
                    })
                    break
                }
                // SORT BY NAME
                case 2: {
                    dirents.sort((a, b) => {
                        if (sort_flag == 0) {
                            return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
                        } else {
                            return b.toLocaleLowerCase().localeCompare(a.toLocaleLowerCase());
                        }
                    })
                    break;
                }

                // SORT BY SIZE
                case 3: {
                    dirents.sort((a, b) => {

                        let s1 = parseInt(localStorage.getItem(path.join(dir, a)));
                        let s2 = parseInt(localStorage.getItem(path.join(dir, b)));

                        if (sort_flag == 0) {
                            return s2 - s1;
                        } else {
                            s1 - s2;
                        }


                    })
                }

                // SORT BY TYPE
                case 4: {

                }
            }

            // SORT FOLDER FIRST
            dirents.sort((a, b) => {

                let breadcrumbs = document.getElementById('breadcrumbs')
                let a_filename = path.join(breadcrumbs.value, a)
                let b_filename = path.join(breadcrumbs.value, b)

                a_stats = fs.statSync(a_filename)
                b_stats = fs.statSync(b_filename)

                return (a_stats.isFile() === b_stats.isFile()) ? 1 : a_stats.isFile() ? 0 : -1;

            })

            let file0 = '';

            // LOOP OVER FILES
            dirents.forEach((file, idx) => {

                file0 = file;

                // GET FILE NAME
                let filename = path.join(dir, file)

                try {

                    // GET FILE STATS
                    let stats = fs.statSync(filename)

                    if (stats) {

                        let type = mime.lookup(filename)

                        if (!type) {
                            type = 'inode/directory'
                        }

                        // CREATE HEADER
                        let header_link = add_link(filename, file);
                        header_link.classList.add('nav_item;', 'header_link')
                        header_link.style = 'font-weight: normal !important; color:#cfcfcf !important; text-decoration: none !important; width: 100%'

                        // CREATE INPUT
                        let input = document.createElement('input')
                        input.type = 'text'
                        input.value = file
                        input.spellcheck = false
                        input.classList.add('hidden', 'input')
                        input.setSelectionRange(0, input.value.length - path.extname(filename).length)

                        // INPUT CHANGE EVENT
                        input.addEventListener('change', (e) => {
                            rename_file(filename, input.value)
                            input.classList.add('hidden')
                            header_link.classList.remove('hidden')
                            update_cards(document.getElementById('main_view'))
                        })

                        // CREATE TABLE ROW
                        let tr = document.createElement('tr')
                        tr.dataset.href = filename
                        tr.classList.add('nav_item')
                        tr.draggable = 'true'

                        // LOOP OVER COLUMNS
                        cols_arr.forEach(item => {

                            let box = add_div();
                            box.style = 'display:flex; align-items: center';

                            let td = document.createElement('td');
                            td.style = 'color: #cfcfcf; vertical-align: middle;';

                            if (item.show == '1') {

                                // ADD DATA
                                switch (item.name) {

                                    case 'Name': {

                                        let icon = document.createElement('img')
                                        let stats = fs.statSync(header_link)
                                        if (stats.isDirectory()) {
                                            icon.src = folder_icon
                                            box.append(icon, header_link, input);
                                        } else {

                                            ipcRenderer.invoke('get_icon', filename).then(res => {
                                                icon.src = res;
                                                box.append(icon, header_link, input)
                                            })
                                            // box.append(add_img(get_icon_path(filename)), header_link, input);
                                        }

                                        td.append(box);
                                        td.tabIndex = idx

                                        // EDIT MODE
                                        td.addEventListener('keyup', (e) => {

                                            if (e.key === 'F2') {
                                                header_link.classList.add('hidden')
                                                input.classList.remove('hidden', 'input')
                                                input.select()
                                                input.focus()
                                            }

                                            if (e.key === 'Escape') {
                                                input.classList.add('hidden');
                                                input.value = file0;
                                                header_link.classList.remove('hidden');
                                            }

                                        })

                                        td.classList.add('card')

                                        break;
                                    }
                                    case 'Size': {
                                        td.append(get_file_size(localStorage.getItem(filename)));
                                        break;
                                    }
                                    case 'Modified': {
                                        td.append(new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime));
                                        break;
                                    };
                                    case 'Type': {
                                        td.append(type);
                                        break;
                                    }
                                    case 'Created': {
                                        td.append(new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.birthtime));
                                        break;
                                    }
                                }

                                tr.append(td)

                            }

                            // TABLE DATA MOUSEOVER
                            tr.addEventListener('mouseover', (e) => {

                                let title = {
                                    filename: filename,
                                    size: get_file_size(localStorage.getItem(filename)),
                                    modified: get_time_stamp(fs.statSync(filename).mtime)
                                }

                                e.target.title = title.filename +
                                    '\n' +
                                    title.size +
                                    '\n' +
                                    title.modified

                                // FOCUS FOR EDIT
                                td.focus()

                                // HIGHLIGHT ROW
                                td.classList.add('highlight')

                                // SET ACTIVE HREF FOR CONTEXT MENU
                                active_href = filename

                            })

                            tr.addEventListener('mouseout', (e) => {
                                td.classList.remove('highlight')
                            })



                        })

                        // ADD TR TO TABLE BODY
                        tbody.appendChild(tr)

                        // DIRECTORY
                        if (stats.isDirectory()) {

                            header_link.addEventListener('click', (e) => {
                                get_list_view(filename)
                            })

                            // FILES
                        } else {

                            header_link.addEventListener('click', (e) => {
                                open(filename, { wait: false })
                            })
                        }

                    }

                } catch (er) {

                }

            })

            // ADD TABLE BODY  TO TABLE
            table.append(tbody)

        }

    })

    // SHOW SIDEBAR
    if (localStorage.getItem('sidebar') == 1) {
        show_sidebar()
    } else {
        hide_sidebar()
    }

    // let sidebar = document.getElementById('sidebar')
    // sidebar.addEventListener('mouseover', (e) => {
    //     sidebar.focus()
    // })

}

function get_paged_files(dir, page_size, page_number, callback) {

    breadcrumbs.value = dir
    localStorage.setItem('folder', dir)

    fs.readdir(dir, (err, files) => {

        files = files.map(file => path.join(dir, file));
        files.slice((page_number - 1) * page_size, page_number * page_size);

        if (!err) {

            let folder_grid = document.getElementById('folder_grid')
            let file_grid = document.getElementById('file_grid')

            folder_grid.innerHTML = ''
            file_grid.innerHTML = ''

            files.forEach(file => {

                fs.stat(file, (err, stats) => {

                    // let options = {
                    //     id: 0,
                    //     href: file,
                    //     linktext: path.basename(file)
                    // }
                    // add_card(options).then(card => {
                    //     let col = add_column('three')
                    //     col.append(card)

                    //     if (stats.isDirectory()) {
                    //         folder_grid.append(col)
                    //     } else {
                    //         file_grid.append(col)
                    //     }

                    //     update_card(card.dataset.href)
                    // })

                    let col = add_column('three')
                    let card = get_card(file)
                    col.append(card)

                    if (stats.isDirectory()) {
                        folder_grid.append(col)
                    } else {
                        file_grid.append(col)
                    }

                })

            })

        }
    })
}

// MAIN GET FILES FUNCTION
async function get_files(dir, callback) {

    if (!fs.existsSync(dir)) {
        return false
    }

    show_loader()

    // GET REFERENCES
    let main_view           = document.getElementById('main_view');
    let info_view           = document.getElementById('info_view');
    let folder_grid         = document.getElementById('folder_grid');
    let hidden_folder_grid  = document.getElementById('hidden_folder_grid');
    let file_grid           = document.getElementById('file_grid');
    let hidden_file_grid    = document.getElementById('hidden_file_grid');
    let pager               = document.getElementById('pager');
    let grid_view           = document.getElementById('grid_view');
    let list_view           = document.getElementById('list_view');

    grid_view.classList.remove('hidden');
    list_view.classList.add('hidden');

    if (historize) {
        add_history(dir);
    }

    options.sort = localStorage.getItem('sort');
    options.page = localStorage.getItem('page');

    // HANDLE COUNTER
    cardindex = 0;

    if (start_path) {
        dir = start_path
        start_path = ''
    }

    if (options.page == '') {
        options.page = 1
    }

    // const breadcrumbs = document.getElementById('breadcrumbs')
    breadcrumbs.value = dir;
    breadcrumbs.title = dir;

    // SET FOLDER TO LOCAL STORAGE
    localStorage.setItem('folder', dir);

    file_grid.innerHTML = '';
    folder_grid.innerHTML = '';

    // HANDLE QUIT
    // LOOP OVER QUIT
    let quit = document.getElementsByClassName('quit')
    for (let i = 0; i < quit.length; i++) {
        quit[i].addEventListener('click', (e) => {
            ipcRenderer.send('close')
        })
    }

    // HANDLE MINIMIZE
    let min = document.getElementById('min')
    min.addEventListener('click', function (e) {
        ipcRenderer.send('minimize')
    })

    // HANDLE MAXAMIZE
    let max = document.getElementById('max')
    max.addEventListener('click', function (e) {
        ipcRenderer.send('maximize')
    })

    // CLEAR ITEMS
    folder_grid.innerText           = ''
    hidden_folder_grid.innerText    = ''
    file_grid.innerText             = ''
    hidden_file_grid.innerText      = ''
    pager.innerHTML                 = ''

    // HANDLE GNOME DISKS BUTTON
    let gnome_disks = document.querySelectorAll('.gnome_disks')
    gnome_disks.forEach(function (e) {
        e.addEventListener('click', function (e) {
            ipcRenderer.send('gnome_disks')
        })
    })

    // DISK USAGE ANALYZER
    let dua = document.getElementById('menu_dua')
    dua.addEventListener('click', function (e) {
        ipcRenderer.send('dua', { dir: breadcrumbs.value })
    })

    // GET CONTROL OPTIONS FROM LOCAL STORAGE. SUCH AS SORT
    let btn_show_hidden = document.getElementById('btn_show_hidden_folders')
    let show_hidden = localStorage.getItem('show_hidden')

    // SHOW HIDDEN FILES
    if (show_hidden === '1') {
        btn_show_hidden.classList.add('active')
        hidden_folder_grid.classList.remove('hidden')
        hidden_file_grid.classList.remove('hidden')
    } else {
        hidden_folder_grid.classList.add('hidden')
        hidden_file_grid.classList.add('hidden')
        btn_show_hidden.classList.remove('active')
    }

    /* Sort */
    let sort = parseInt(localStorage.getItem('sort'))
    switch (sort) {
        case 1:
            sort_by_date.classList.add('active')
            break
        case 2:
            sort_by_name.classList.add('active')
            break
        case 3:
            sort_by_size.classList.add('active')
            break
        case 4:
            sort_by_type.classList.add('active')
            break
    }

    // GET FILES ARRAY
    let rd_st = new Date().getTime()
    fs.readdir(dir, (err, dirents) => {

        if (err) {
            notification('error: ' + err)
        }

        if (dirents.length > 0) {

            /* Get sort direction */
            let sort_direction = localStorage.getItem('sort_direction')
            let sort_flag = 0;
            if (sort_direction == 'asc') {
                sort_flag = 1;
            }

            /* Sort */
            switch (parseInt(sort)) {
                // SORT BY DATE
                case 1: {
                    // SORT BY DATE DESC
                    dirents.sort((a, b) => {
                        try {
                            s1 = fs.statSync(path.join(dir, a)).mtime;
                            s2 = fs.statSync(path.join(dir, b)).mtime;
                            // SORT FLAG
                            if (sort_flag == 0) {
                                return s2 - s1
                            } else {
                                return s1 - s2
                            }
                        } catch (err) {
                            // console.log(err)
                        }
                    })
                    break
                }
                // SORT BY NAME
                case 2: {
                    dirents.sort((a, b) => {
                        if (sort_flag == 0) {
                            return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
                        } else {
                            return b.toLocaleLowerCase().localeCompare(a.toLocaleLowerCase());
                        }
                    })
                    break;
                }

                // SORT BY SIZE
                case 3: {
                    dirents.sort((a, b) => {
                        let s1 = parseInt(localStorage.getItem(path.join(dir, a)));
                        let s2 = parseInt(localStorage.getItem(path.join(dir, b)));
                        if (sort_flag == 0) {
                            return s2 - s1;
                        } else {
                            s1 - s2;
                        }
                    })
                    break;
                }

                // SORT BY TYPE
                case 4: {
                    dirents.sort((a, b) => {
                        try {

                            let s1 = stat.statSync(dir + '/' + a)
                            let s2 = stat.statSync(dir + '/' + b)

                            let ext1 = path.extname(path.basename(a))
                            let ext2 = path.extname(path.basename(b))

                            if (ext1 < ext2) return -1
                            if (ext1 > ext2) return 1

                            if (s1.mtime < s2.mtime) return -1
                            if (s1.mtime > s2.mtime) return 1

                        } catch {
                            console.log(err)
                        }
                    })
                }
            }

            // REGEX FOR HIDDEN FILE
            const regex = /^\..*/

            // PAGE FILES
            if (dirents.length > pagesize) {

                let number_pages = parseInt(parseInt(dirents.length) / parseInt(pagesize))
                for (let i = 1; i < number_pages + 1; i++) {

                    add_pager_item({ dir, name: i })

                }
                dirents = paginate(dirents, pagesize, page)

            }

            // HANDLE GROUP BY
            let groupby = 1
            let exts = dirents.filter((a) => {

                let ext1 = path.extname(a)
                let ext2 = path.extname(a)

                if (ext1 > ext2) return -1
                if (ext1 < ext2) return 1

            })

            if (groupby) {

                exts.forEach(ext => {

                    dirents.forEach((file, idx) => {

                        if (path.extname(file) == ext) {

                        }

                    })

                })

            }

            dirents.forEach((file, idx) => {

                let filename = file
                let filepath = path.join(dir, filename)

                try {

                    let stats = fs.statSync(filepath)

                    // DIRECTORY
                    if (stats.isDirectory()) {
                        let options = {
                            id: 'folder_card_' + idx,
                            href: filepath,
                            linktext: filename,
                            size: '',
                            is_folder: true
                        }
                        if (!regex.test(file)) {

                            // let card = get_card(filepath)
                            // let col = add_column('three')
                            // col.append(card)
                            // folder_grid.append(col)

                            options.grid = folder_grid
                            add_card(options).then((card) => {
                                update_card(card.dataset.href);
                            })

                            // let card = get_card(options.href)
                            // card.classList.remove('border')
                            // folder_grid.append(card)

                        } else {

                            // let card = get_card(filepath)
                            // let col = add_column('three')
                            // col.append(card)
                            // hidden_folder_grid.append(col)

                            options.grid = hidden_folder_grid
                            add_card(options).then((card) => {
                                update_card(card.dataset.href);
                            })
                        }
                        ++folder_count
                    // FILES
                    } else {
                        let filename = path.basename(file)
                        let filepath = path.join(dir, '/', filename)
                        if (groupby) {
                            let ext = path.extname(filename)
                        } else {
                        }
                        let options = {
                            id: 'file_card_' + idx,
                            href: filepath,
                            linktext: filename,
                            is_folder: false
                            // card_counter: card_counter
                        }
                        if (!regex.test(file)) {

                            // let card = get_card(filepath)
                            // let col = add_column('three')
                            // col.append(card)
                            // file_grid.append(col)

                            options.grid = file_grid
                            add_card(options).then((card) => {
                                update_card(card.dataset.href);
                            })

                        } else {

                            // let card = get_card(filepath)
                            // let col = add_column('three')
                            // col.append(card)
                            // hidden_file_grid.append(col)

                            options.grid = hidden_file_grid
                            add_card(options).then((card) => {
                                update_card(card.dataset.href);
                            })
                        }
                        ++file_count
                    }
                } catch (err) {
                    // add_card(options)
                    notification('get_files error:', err)
                }
            })

            if (folder_count == 0) {
                folders_card.classList.add('hidden')
            } else {
                folders_card.classList.remove('hidden')
            }

            hide_loader()
            callback(1)

            let sidebar = document.getElementById('sidebar')
            sidebar.addEventListener('mouseover', (e) => {
                // sidebar.focus()
            })

            // HANDLE QUICK SEARCH KEY PRESS. THIS IS FOR FIND BY TYPING //////////////////////////////////
            let letters = ''
            let txt_search = document.getElementById('txt_search')

            // MAIN VIEW
            main_view.tabIndex = 0

            // KEYBOARD NAVIGATION
            main_view.addEventListener('keypress', function (e) {

                // PEVENT KEYPRESS FROM BEING FIRED ON QUICK SEARCH AND FIND
                e.stopPropagation()

                // LOOK FOR LETTERS AND NUMBERS. I DONT THINK THIS
                // let regex = /[^A-Za-z0-9]+/
                let regex = /[^A-Za-z0-9-.]+/

                // TEST FOR LETTERS AND NUMBERS
                if (regex.test(e.key) === false && !e.shiftKey && e.key !== 'Delete' && !e.ctrlKey) {

                    // MAKE SURE WHERE NOT SOMETHING THAT WE NEED
                    if (e.target === e.currentTarget || e.target === txt_search || e.target.classList.contains('header_link')) {

                        txt_search.classList.remove('hidden')
                        txt_search.focus()

                        if (e.key === 'Enter' && txt_search.value != '') {

                            cards = main_view.querySelectorAll('.nav_item')
                            cards.forEach(card => {
                                let href = card.dataset.href.toLocaleLowerCase()
                                if (href.indexOf(txt_search.value.toLocaleLowerCase()) != -1) {
                                    card.classList.add('highlight_select')
                                    card.querySelector('a').focus()
                                }
                            })

                            txt_search.classList.add('hidden')

                            // })

                        }

                    }

                }

            })

            // DISABLE MOVING CONTENT ON ARROW
            document.addEventListener('keydown', (e) => {
                if (["ArrowUp", "ArrowDown"].indexOf(e.code) > -1) {
                    e.preventDefault()
                    e.stopPropagation()
                    return false
                }
            })

            // HIDE QUICK SEARCH
            txt_search.addEventListener('keydown', function (e) {

                // if (e.key === 'Escape' || e.key === 'Tab') {
                if (e.key === 'Escape') {

                    // CLEAR ITEMS
                    clear_items();
                    // CLEAR COPY ARRAY
                    clear_copy_arr();
                    // copy_files_arr = []

                }

            })

            let isMainView = 0;
            main_view.onclick = (e) => {
                console.log('main_view clicked')
            }

            main_view.onmouseover = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isMainView = 1;
                ipcRenderer.send('active_window');
            }

            main_view.onmouseout = (e) => {

                e.preventDefault();
                e.stopPropagation();

                isMainView = 0;


            }

            // ON DRAG ENTER
            main_view.ondragenter = (e) => {

                destination = breadcrumbs.value
                target = e.target

            };

            // DRAG OVER
            main_view.ondragover = (e) => {

                e.preventDefault();
                e.stopPropagation();

                ipcRenderer.send('is_main_view', 1)
                ipcRenderer.send('active_folder', breadcrumbs.value);

            }

            main_view.ondragleave = (e) => {

                e.preventDefault();
                return false;

            }

            main_view.addEventListener('scroll', (e) => {
                console.log(window.scrollX)
            })

            // ON DROP
            /* ref: https://www.geeksforgeeks.org/drag-and-drop-files-in-electronjs/ */
            let state = 0
            main_view.ondrop = function (e) {

                e.preventDefault();
                e.stopPropagation();

                for (const f of e.dataTransfer.files) {

                }

                const file_data = e.dataTransfer.files

                // GETTING FILE DROPED FROM EXTERNAL SOURCE
                if (file_data.length > 0) {

                    for (let i = 0; i < file_data.length; i++) {
                        add_copy_file(file_data[i].path, 'card_' + i)
                    }

                    copy_files(destination, state);

                } else {

                    // COPY FILES
                    if (e.ctrlKey == true) {

                        if (breadcrumbs.value == destination) {
                            ipcRenderer.send('is_main_view', 1)
                            state = 2
                        } else {
                            ipcRenderer.send('is_main_view', 0)
                            state = 0
                        }

                        // THIS IS RUNNING COPY FOLDERS TOO
                        copy_files(destination, state);
                        clear_items();

                    // MOVE FILE
                    } else {



                        if (breadcrumbs.value == destination) {
                            ipcRenderer.send('is_main_view', 1)
                            state = 2
                        } else {
                            ipcRenderer.send('is_main_view', 0)
                            state = 0
                        }

                        // notification('changing state to 0')
                        move_to_folder(destination, state)

                    }

                }

                clear_items();
                return false;

            }

            // document.getElementById('main_view').focus();

            /* RESET CARD INDEX TO 0 SO WE CAN DETECT WHEN SINGLE CARDS ARE ADDED */
            cardindex = 0;
            notice(' (' + directories.length + ') directories and (' + files.length + ') files');

        } else {

            hide_loader();
        }

        // For keyboard navigation
        let items = main_view.querySelectorAll('.nav_item')
        items.forEach((item, idx) => {
            item.dataset.id = idx + 1;
        })

        let date2 = new Date();
        get_disk_space();

    })

    ///////////////////////////////////////////////////////////////////////

    let folder_cards = document.getElementsByClassName('folder_card')
    let headers = document.getElementsByClassName('header_link')

    nc = 1
    nc2 = 0
    adj = 0
    is_folder_card = true

    let keycounter = 0
    let keycounter0 = 0

    let is_last = 0
    let is_last0 = 0

    // Shift RIGHT
    Mousetrap.bind('shift+right', (e) => {

        keycounter0 = keycounter
        keycounter += 1;

        // document.querySelector("[data-id='" +  (nc) + "']").classList.remove('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()
        // headers[nc2 - 1].focus()

        // }

    })

    // RIGHT
    Mousetrap.bind(settings.keyboard_shortcuts.Right.toLocaleLowerCase(), (e) => {

        clear_highlight();

        let items = main_view.querySelectorAll('.nav_item')
        keycounter0 = keycounter

        if (keycounter < 1) {
            keycounter = 1
        } else {

            if (keycounter < items.length) {
                keycounter += 1
                document.querySelector("[data-id='" + (keycounter0) + "']").classList.remove('highlight_select')
            }

        }

        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

    })

    // SHIFT LEFT. MULTI SELECT
    Mousetrap.bind('shift+left', (e) => {

        keycounter0 = keycounter
        keycounter -= 1;

        // document.querySelector("[data-id='" +  (nc) + "']").classList.remove('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()


    })

    // LEFT
    Mousetrap.bind(settings.keyboard_shortcuts.Left.toLocaleLowerCase(), (e) => {

        clear_highlight();

        keycounter0 = keycounter

        if (keycounter <= 1) {
            keycounter = 1
        } else {

            document.querySelector("[data-id='" + (keycounter) + "']").classList.remove('highlight_select')
            keycounter -= 1
        }

        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

    })

    // HANDLE SHIFT DOWN MULTI SELECTION
    Mousetrap.bind('shift+down', function (e) {

        e.preventDefault()

        if (nc2 == 0) {

            document.querySelector("[data-id='" + (nc) + "']").classList.add('highlight_select')
            headers[nc - 1].focus()

            nc2 = 1

        } else {

            // NC = ACTUAL LOCATION
            nc = nc2
            nc2 = nc2 + 5

            // DONT AJUST IF LESS THAN NAV COUNTER
            if (nc2 > 1) {

                // HANDLE MOVING BETWEEN GRIDS
                if (localStorage.getItem('show_hidden') == '0') {

                    adj = folder_count

                }

                if (nc2 > adj && is_folder_card == true) {

                    is_folder_card = false

                    //THIS EQUALS 25
                    let last_row_count = Math.ceil(folder_count / 5) * 5

                    if (localStorage.getItem('show_hidden') == '0') {

                        // THIS SHOULD = 1 IF FOLDER COUNT = 24 + COUNT OF HIDDEN DIRECTORIES
                        adj = 5 - (last_row_count - folder_count) + hidden_folder_count
                        nc2 = nc + adj

                    } else {

                        adj = hidden_folder_count

                    }

                }

                // document.querySelector("[data-id='" +  (nc) + "']").classList.remove('highlight_select')
                document.querySelector("[data-id='" + (nc2) + "']").classList.add('highlight_select')
                document.querySelector("[data-id='" + (nc2) + "']").querySelector('a').focus()
                // headers[nc2 - 1].focus()

            }

        }

    })

    // HANDLE KEYBOARD DOWN. DONT CHANGE
    Mousetrap.bind(settings.keyboard_shortcuts.Down.toLocaleLowerCase(), (e) => {

        clear_highlight()

        console.log(nc, nc2)

        let items = main_view.querySelectorAll('.nav_item')

        keycounter0 = keycounter

        let min = Math.floor(folder_cards.length / 5) * 5
        let diff = (Math.ceil(folder_cards.length / 5) * 5) - folder_cards.length

        is_last0 = is_last

        // CHECK IF LAST ROW
        if (keycounter > min) {
            is_last = 1
        }

        //
        if (keycounter < 1) {
            keycounter = 1
        } else {

            keycounter += 5

            // ADJUST SECOND TO LAST ROW
            if (keycounter > folder_cards.length && is_folder_card && !is_last) {
                keycounter = keycounter + (5 - diff)
                is_folder_card = 0
                // ADJUST LAST ROW
            } else if (keycounter > folder_cards.length && is_folder_card && is_last) {
                keycounter = keycounter0 + (5 - diff)
                is_folder_card = 0
                is_last = 0
            }

            document.querySelector("[data-id='" + (keycounter0) + "']").classList.remove('highlight_select')

        }

        if (keycounter > items.length) {
            is_folder = 1
            keycounter0 = 0;
            keycounter = 1;
            document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        } else {
            document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
            document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()
        }

    })

    // todo: check hidden files
    // Handle Keyboard Up.
    Mousetrap.bind(settings.keyboard_shortcuts.Up.toLocaleLowerCase(), (e) => {

        clear_highlight()

        keycounter0 = keycounter

        let min = Math.floor(folder_cards.length / 5) * 5
        let diff = 5 - ((Math.ceil(folder_cards.length / 5) * 5) - folder_cards.length)

        if (keycounter - 5 < min && !is_folder_card) {
            is_last = 1
        }

        if (keycounter <= 5) {

            keycounter = 1
            if (keycounter >= 1) {
                try {
                    document.querySelector("[data-id='" + (keycounter0) + "']").classList.remove('highlight_select')
                } catch (err) {
                }
            }

        } else {

            keycounter -= 5

            if (keycounter < folder_cards.length && !is_folder_card && is_last) {

                keycounter = keycounter - diff
                is_folder_card = 1

            } else if (keycounter < folder_cards.length && !is_folder_card && !is_last) {

                keycounter = keycounter0 - diff
                is_folder_card = 1

            }

            // if (keycounter < (folder))

            document.querySelector("[data-id='" + (keycounter0) + "']").classList.remove('highlight_select')
        }

        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

    })

    async function clear_highlight() {

        let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')
        items.forEach(item => {
            item.classList.remove('highlight')
            item.classList.remove('highlight_select')
            item.classList.remove('ds-selected')
        })
    }

    clear_items();
    autocomplete();

}

// GET HOME DIRECTORY
function get_home() {
    return os.homedir()
}

// GET FOLDER SIZE
function get_folder_size(href) {

    return new Promise(resolve => {

        let breadcrumbs = document.getElementById('breadcrumbs')
        // if (breadcrumbs.value.indexOf('gvfs') == -1) {

        // cmd = 'cd "' + dir + '"; du -b'
        // return du = execSync(cmd)
        const regex = /^\..*/
        let folder_card = document.getElementsByClassName('folder_card')

        if (folder_card.length > 0) {
            for (let i = 0; i < folder_card.length; i++) {

                // let href = folder_card[i].querySelector('a')
                // href = href.getAttribute('href')

                // href = dir.replace("'", "/")

                cmd = 'cd "' + href + '"; du -s'
                du = exec(cmd)

                console.log(href)

                du.stdout.on('data', function (res) {

                    let extra = folder_card[i].querySelector('.extra')

                    let size = parseInt(res.replace('.', '') * 1024)
                    if (size > 1000000000) {
                        extra.innerHTML = '<span style="color:red">' + get_file_size(size) + '</span>'
                    } else {
                        extra.innerHTML = get_file_size(size)
                    }
                    resolve(size)
                })

                // let extra = folder_card[i].querySelector('.extra')
                // extra.innerHTML = du

                // let card = document.getElementById(folder_card[i].id)
                // let extra = card.find()
                // console.log('what ' + folder_card[i].id)
            }
        }

        // } else {
        //     console.log('gvfs folder. dont scan size')
        // }

    })

}

// CONTEXT BRIDGE
contextBridge.exposeInMainWorld('api', {

    add_card: (options) => {
        add_card(options)
    },
    // get_gio_devices: () => {
    //     get_gio_devices()
    // },
    get_info: () => {
        get_info()
    },
    get_devices: () => {
        get_devices()
    },
    get_workspace: () => {
        get_workspace()
    },
    load_workspace: () => {
        load_workspace()
    },
    get_folder_size: () => {
        get_folder_size()
    },
    find_files: () => {
        find_files()
        // find()
    },
    get_disk_usage: () => {
        get_disk_usage()
    },
    get_folders1: (dir) => {
        return get_folders1(dir)
    },
    get_sidebar_files: (dir) => {
        return get_sidebar_files(dir)
    },
    get_files: (dir, callback) => {
        return get_files(dir, callback)
    },
    get_settings_view: () => {
        return get_settings_view();
    },
    get_view: (dir) => {
        historize = 1;
        return get_view(dir);
    },
    get_list_view: (dir) => {
        return get_list_view(dir);
    },
    get_network: () => {
        return get_network()
    },
    get_icon_path: (path) => {
        return get_icon_path(path)
    },
    get_data: (dir) => {
        return get_data(dir)
    },
    get_home: () => {
        return get_home()
    },
    navigate: (direction) => {
        navigate(direction)
    },
    get_terminal: () => {
        open_terminal()
    },
    toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
    // system: () => ipcRenderer.invoke('dark-mode:system')

})

// contextBridge.exposeInMainWorld('darkMode', {
//     toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
//     system: () => ipcRenderer.invoke('dark-mode:system')
// })

/* Add location to history array */
function add_history(dir) {

    history_arr.forEach(item => {
        if (!fs.existsSync(item)) {
            history_arr.shift()
        }
    })

    history_arr.push(dir)

    // if (history_arr.length > 0) {
    //     if (history_arr.every(x => x != dir)) {
    //         if (fs.existsSync(dir)) {
    //             history_arr.push(dir)
    //         }
    //     }
    // } else {
    //     if (fs.existsSync(dir)) {
    //         history_arr.push(dir)
    //     }
    // }
}

// CLEAR SELECTED FILES ARRAY
function clear_items() {

    let main_view           = document.getElementById('main_view');
    let pager               = document.getElementById('pager');
    let txt_search          = document.getElementById('txt_search');
    let nav_items           = document.querySelectorAll('.nav_item');
    let input               = document.getElementById('edit_' + card_id);
    let header              = document.getElementById('header_' + card_id);
    // let file_properties  = document.getElementById('file_properties');
    let breadcrumb_items    = document.getElementById('breadcrumb_items');
    let hamburger_menu      = document.getElementById('hamburger_menu')
    let info_view           = document.getElementById('info_view');


    /* Reset nav counters */
    nc              = 1;
    nc2             = 0;
    adj             = 0;
    ac              = 0;
    is_folder_card  = true;

    /* Clear arrays */
    delete_arr      = [];
    selected_files  = [];
    // workspace_arr   = [];

    /* Clear elements */
    pager.innerHTML             = '';
    txt_search.value            = '';
    // info_view.innerHTML      = '';

    /* Hidden elements */
    txt_search.classList.add          ('hidden');
    breadcrumb_items.classList.add    ('hidden');
    hamburger_menu.classList.add      ('hidden');

    if (input) {
        input.classList.add ('hidden');
    }

    if (header) {
        header.classList.remove('hidden');
    }

    /* Clear nav items */
    if (nav_items) {
        nav_items.forEach(item => {

            try {
                item.classList.remove('highlight_select', 'ds-selected', 'highlight')
                item.querySelector('input').classList.add('hidden')
                item.querySelector('a').classList.remove('hidden')
            } catch (err) {

            }

        })
    }

    if (target) {
        let card = document.getElementById(target.id)
        if (card) {

            let header = card.querySelector('a')
            let textarea = card.querySelector('textarea')
            let input = card.querySelector('input')

            //
            if (prev_target) {
                prev_target.classList.remove('highlight_select')
            }

            if (textarea) {
                header.classList.remove('hidden')
                textarea.classList.add('hidden')
            }

            if (input) {
                try {
                    header.classList.remove('hidden')
                    input.classList.add('hidden')
                } catch (err) {

                }

            }

        }
    }

    /* Set focus on main_view */
    // main_view.focus();

}

// CLEAR COPY CACHE
function clear_copy_arr() {

    if (copy_files_arr.length > 0) {
        copy_files_arr = []
    }

}

// PRELOAD IMAGES
function preloadImages(array) {
    if (!preloadImages.list) {
        preloadImages.list = []
    }
    var list = preloadImages.list;
    for (var i = 0; i < array.length; i++) {
        var img = new Image();
        img.onload = function () {
            var index = list.indexOf(this);
            if (index !== -1) {
                // remove image from the array once it's loaded
                // for memory consumption reasons
                list.splice(index, 1);
            }
        }
        list.push(img);
        img.src = array[i];
    }
}

/**
 *
 * @param {url} href
 */
function get(href, callback) {
    const xhr = new XMLHttpRequest()
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    }
    xmlHttp.open("GET", href, true); // true for asynchronous
    xmlHttp.send(null);
}

// Find for win32
async function find_win32() {

    get('../src/find.html', (find_page) => {

        let sidebar_items       = document.getElementById('sidebar_items');
        sidebar_items.innerHTML = find_page;

        let find           = document.getElementById('find');
        let search_info    = document.getElementById('search_info');
        let search_results = document.getElementById('search_results');
        let find_folders   = document.getElementById('find_folders');
        let find_files     = document.getElementById('find_files');

        let options = {
            show_folders: 1,
            show_files: 1,
            case: 0,
            depth: 1,
            start_date: '',
            end_date: '',
            size: ''
        }

        options.show_folders       = parseInt(localStorage.getItem('find_folders'))
        options.show_files         = parseInt(localStorage.getItem('find_files'))

        // if (parseInt(show_options) == 1) {find_options.classList.remove('hidden')} else {find_options.classList.add('hidden')};

        find_folders.checked        = options.show_folders;
        find_files.checked          = options.show_files;

        // FIND FOLDERS
        find_folders.addEventListener('change', (e) => {
            if (find_folders.checked) {
                localStorage.setItem('find_folders', 1);
                options.show_folders = 1
            } else {
                localStorage.setItem('find_folders', 0);
                options.show_folders = 0
            }
        })

        // FIND FILES
        find_files.addEventListener('change', (e) => {
            if (find_files.checked) {
                localStorage.setItem('find_files', 1);
                options.show_files = 1
            } else {
                localStorage.setItem('find_files', 0);
                options.show_files = 0
            }

        })

        let search_arr = []

        let inputs = find_options.querySelectorAll('.find_input')
        inputs.forEach(input => {

            options[input.id] = input.value

            input.addEventListener('change', (e) => {
                localStorage.setItem(input.id, input.value)
                options[input.id] = input.value

            })

            if (localStorage.getItem(input.id) != '') {
                input.value = localStorage.getItem(input.id)
            }
        })

        let recursive = 0;
        find.addEventListener('keyup', (e) => {

            if (e.key == 'Enter') {

                search_info.innerHTML = 'searching..'
                search_results.innerHTML = ''

                function get_files_recursive(filename) {

                    // let dirents = fs.readdirSync(filename)
                    fs.readdir(filename, (err, dirents) => {

                        if (!err) {

                            try {

                                let files = dirents.filter(item => !fs.statSync(path.join(filename, item)).isDirectory())
                                if (files.length > 0) {

                                    files.forEach((file, idx) => {

                                        if (file.toLocaleLowerCase().indexOf(find.value) > -1) {

                                            let cfilename = path.join(filename, file)

                                            search_arr.push(cfilename)
                                            // let options = {
                                            //     id: 0,
                                            //     href: cfilename,
                                            //     linktext: file
                                            // }
                                            // add_card(options).then((card) => {
                                            //     search_info.innerHTML = ''
                                            //     search_results.append(card)
                                            //     update_card(card.dataset.href)
                                            // })



                                        }

                                    })

                                } else {

                                    search_info.innerHTML = '';

                                }

                            } catch (err) {
                                // console.log(err)
                            }

                        } else {
                            // console.log(err);
                        }

                    })

                }

                let c = 0;
                function get_folders_recursive(filename) {

                    c++
                    fs.readdir(filename, (err, dirents) => {

                        if (!err) {

                            try {

                                let folders = dirents.filter(item => fs.statSync(path.join(filename, item)).isDirectory())
                                if (folders.length > 0) {

                                    search_info.innerHTML = ''
                                    folders.forEach((folder, idx) => {

                                        // Get folders recursive
                                        let cursource = path.join(filename, folder)
                                        if (options.show_folders) {

                                            if (folder.toLocaleLowerCase().indexOf(find.value) > -1) {

                                                search_arr.push(cursource)
                                                let options = {
                                                    id: 0,
                                                    href: cursource,
                                                    linktext: path.basename(cursource),
                                                    is_folder: 1,
                                                    grid: ''
                                                }

                                                add_card(options).then((card) => {

                                                    search_info.innerHTML = ''
                                                    search_results.append(card)
                                                    update_card(card.dataset.href)

                                                })

                                            }

                                        }

                                        // Get files recursive
                                        if (options.show_files) {
                                            get_files_recursive(cursource);
                                        }

                                    })

                                } else {
                                    // search_info.innerHTML = 'no results found..'
                                }

                            } catch (err) {
                                // console.log(err)
                            }

                        } else {
                            // console.log(err)
                        }

                    })

                }

                if (find.value != "") {

                    get_files_recursive(breadcrumbs.value);
                    get_folders_recursive(breadcrumbs.value)
                }

            }

        })

        find.focus()
    })

}

// FIND FILES
var search_res = '';
async function find_files(callback) {

    notification('running find files')

    if (process.platform === 'win32') {
        find_win32();
    }

    let cmd = '';
    get('../src/find.html', (find_page) => {

        let sidebar_items           = document.getElementById('sidebar_items');
        sidebar_items.innerHTML     = find_page;
        let search_results          = document.getElementById('search_results');
        let find                    = document.getElementById('find');
        let find_div                = document.getElementById('find_div');
        let find_options            = document.getElementById('find_options');
        let find_folders            = document.getElementById('find_folders')
        let find_files              = document.getElementById('find_files')
        let btn_find_options        = document.getElementById('btn_find_options');
        let breadcrumbs             = document.getElementById('breadcrumbs');
        let find_size               = document.getElementById('find_size');
        let start_date              = document.getElementById('start_date');
        let end_date                = document.getElementById('end_date');
        let mb_find                 = document.getElementById('mb_find');
        let search_progress         = document.getElementById('search_progress')

        let options = {
            show_folders:   1,
            show_files:     1,
            case:           0,
            depth:          1,
            start_date:     '',
            end_date:       '',
            size:           ''
        }

        options.show_folders       = parseInt(localStorage.getItem('find_folders'));
        options.show_files         = parseInt(localStorage.getItem('find_files'));
        options.depth              = parseInt(localStorage.getItem('depth'));

        find_folders.checked       = options.show_folders;
        find_files.checked         = options.show_files;

        localStorage.setItem('minibar', 'mb_find')

        // FIND FOLDERS
        find_folders.addEventListener('change', (e) => {
            if (find_folders.checked) {
                localStorage.setItem('find_folders', 1);
                options.show_folders = 1
            } else {
                localStorage.setItem('find_folders', 0);
                options.show_folders = 0
            }
        })

        // FIND FILES
        find_files.addEventListener('change', (e) => {
            if (find_files.checked) {
                localStorage.setItem('find_files', 1);
                options.show_files = 1
            } else {
                localStorage.setItem('find_files', 0);
                options.show_files = 0
            }

        })

        let inputs = find_div.querySelectorAll('.find_input')
        inputs.forEach(input => {

            if (localStorage.getItem(input.id) != null) {
                options[input.id] = localStorage.getItem(input.id)
            } else {

                if (input.id == 'find_files') {
                    options[input.id] = 1;
                    localStorage.setItem(options[input.id], 1);
                }

                if (input.id == 'find_folders') {
                    options[input.id] = 1;
                    localStorage.setItem(options[input.id], 1);
                }

            }

            input.value = localStorage.getItem(input.id)

            input.addEventListener('change', (e) => {
                localStorage.setItem(input.id, input.value)
                options[input.id] = input.value
            })

            input.addEventListener('keyup', (e) => {

                if (e.key === 'Enter') {

                    if (find.value != '') {
                        search_info.innerHTML    = 'Searching...';
                        search_progress.classList.remove('hidden')
                    } else {
                        search_info.innerHTML    = '';
                        search_progress.classList.add('hidden')
                    }

                    search_results.innerHTML = '';

                    if (find.value != '' || find_size.value != '' || start_date.value != '' || end_date.value != '') {

                        // CHECK LOCAL STORAGE
                        if (localStorage.getItem('find_folders') == '' || localStorage.getItem('find_folders') == null) {
                            localStorage.setItem('find_folders', 1)
                        }

                        if (localStorage.getItem('find_files') == '' || localStorage.getItem('find_files') == null) {
                            localStorage.setItem('find_files', 1)
                        }

                        let find_folders = localStorage.getItem('find_folders')
                        let find_files = localStorage.getItem('find_files')

                        options.d = find_folders,
                        options.f = find_files,
                        options.start_date = start_date.value,
                        options.end_date = end_date.value,
                        options.size = find_size.value, //localStorage.getItem('find_by_size'),
                        options.o = ' -o ',
                        options.s = '*' + find.value + '*'

                        //  SIZE
                        if (options.size != '') {
                            let size_option = document.querySelector('input[name="size_options"]:checked').value
                            options.size = '-size ' + options.size.replace('>', '+').replace('<', '-').replace(' ', '') + size_option
                        }
                        //  DEPTH
                        if (options.depth != '') {
                            options.depth = ' -maxdepth ' + options.depth
                        } else {
                            options.depth = ''
                        }
                        // START DATE
                        if (options.start_date != '') {
                            let start_date = ' -newermt "' + options.start_date + '"'
                            options.start_date = start_date
                        } else {
                            options.start_date = ''
                        }
                        // END DATE
                        if (options.end_date != '') {
                            let end_date = ' ! -newermt "' + options.end_date + '"'
                            options.end_date = end_date
                        } else {
                            options.end_date = ''
                        }
                        // DIR
                        if (options.d == 1 && options.s != '') {
                            options.d = ' -type d ' + '-iname "' + options.s + '"'
                        } else {
                            options.d = ''
                        }
                        // FILES
                        if (options.f == 1 && options.s != '') {
                            options.f = ' -type f ' + '-iname "' + options.s + '" ' + options.size
                        } else {
                            options.f = ''
                        }
                        // OR
                        if (options.d && options.f && options.s != '')   {
                            options.o = ' -or '
                        } else {
                            options.o = ''
                        }

                        cmd = 'find "' + breadcrumbs.value + '"' + options.depth + options.d + options.start_date + options.end_date + options.o + options.f + options.start_date + options.end_date
                        if (process.platform === 'Win32') {
                            notification('find is not yet implemented on window');
                            // cmd = `find [/v] [/c] [/n] [/i] [/off[line]] <"string"> [[<drive>:][<path>]<filename>[...]]`
                        }
                        let data = 0;
                        let c = 0
                        let child = exec(cmd)
                        // console.log(cmd)
                        child.stdout.on('data', (res) => {
                            data = 1;
                            search_info.innerHTML = ''
                            let files = res.split('\n')
                            search_progress.value = 0
                            search_progress.max = files.length
                            for (let i = 0; i < files.length; i++) {
                                if (files[i] != '') {
                                    ++c
                                    search_progress.value = i
                                    search_results.append(get_card(files[i]));
                                }
                            }
                            lazyload()

                        })

                        child.stdout.on('end', (res) => {

                            if (!data) {
                                search_info.innerHTML = '0 matches found'
                            } else {
                                search_info.innerHTML = c + ' matches found'
                            }

                            search_progress.classList.add('hidden')
                        })

                    } else {
                        search_results.innerHTML    = '';
                        fs.writeFileSync(path.join(__dirname, 'src/find.html'), sidebar_items.innerHTML)
                    }

                }

            })

        })

        clear_minibar();
        mb_find.style = 'color: #ffffff !important';
        // find.focus();

        // FIND OPTIONS
        btn_find_options.addEventListener('click', (e) => {

            let chevron = btn_find_options.querySelector('i');

            /* Remove hidden */
            if (find_options.classList.contains('hidden')) {
                find_options.classList.remove('hidden')

                chevron.classList.add('down')
                chevron.classList.remove('right')

                localStorage.setItem('find_options', 1);

            /* Add hidden */
            } else {

                find_options.classList.add('hidden')

                chevron.classList.add('right')
                chevron.classList.remove('down')

                localStorage.setItem('find_options', 0);

            }

        })

        // search_results.oncontextmenu = (e) => {
        //     let target = e.target
        //     let card = target.closest('.nav_item')
        //     let href = card.dataset.href

        //     card.classList.add('highlight_select')

        //     ipcRenderer.send('context-menu-find', href)

        // }
        callback(1)

    })

}

// FUNCTION SIMILAR TO STRING.FORMAT IN C# LAND
String.prototype.format = function () {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

// DARK MODE
contextBridge.exposeInMainWorld('darkMode', {
    toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
    system: () => ipcRenderer.invoke('dark-mode:system')
})

// FUNCTIONS //

async function get_disk_space() {
    let status = document.getElementById('status');
    status.innerHTML = '';
    status.append(add_icon('spinner'), 'Getting disk space..');
    ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: get_folder_count(),file_count: get_file_count()});
}

/* Get devices */
async function get_devices() {

    try {

        let devices             = [];
        let sidebar_items       = document.getElementById('sidebar_items');
        // let server              = add_input('text', 'txt_server')
        let device_view         = add_div();
        let msg                 = add_div()

        device_view.style = 'padding-top: 20px; height: 100%';
        device_view.id = 'device_view';
        device_view.addEventListener('contextmenu', function (e) {
            // ipcRenderer.send('show-context-menu-devices');
        })

        sidebar_items.innerHTML = '';

        let mnt = fs.readdirSync('/mnt/');
        mnt.forEach(item => {
            devices.push({name: item, href: path.join('/mnt', item), type: 'mount'});
        })

        let media = fs.readdirSync('/media/michael/');
        media.forEach(item => {
            devices.push({name: item, href: path.join('/media/michael', item), type: 'media'});
        })

        let uid = execSync('id -u').toString().replace('\n','');
        let gvfs_path = '/run/user/' + uid + '/gvfs/';

        let gvfs = fs.readdirSync(gvfs_path);
        gvfs.forEach(item => {
            devices.push({name: item, href: path.join(gvfs_path, item), type: 'gvfs'});
        })

        if (devices.length > 0) {

            devices.forEach(item => {

                let device  = add_div();
                let link    = add_link( item.href, item.name);
                let icon    = add_icon('hdd');
                let umount  = add_icon('eject');
                let div     = add_div()

                let col1 = add_div().innerHTML = (icon)
                let col2 = add_div().innerHTML = (link)
                let col3 = add_div().innerHTML = (umount)

                link.style = 'display: block'
                col2.style = 'width: 100%'

                div.append(col1, col2, col3)
                div.style = 'display: flex; padding: 6px; width: 100%;'
                div.classList.add('item')

                // device.classList.add('item')
                // device.style    = 'display: flex';
                // umount.title    = "Unmount '" + item.href + "'"
                // device.append(icon, add_item(link), umount)

                device.append(div)

                umount.addEventListener('click', (e) => {

                    if (item.type == 'media' || item.type == 'mnt') {
                        execSync("umount '" + item.href + "'")
                    } else if (item.type == 'gvfs') {
                        execSync("gio mount -u -f '" + item.href + "'")
                    }

                })

                // link.prepend(icon);
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    get_view(item.href);
                })

                device_view.append(device)
                sidebar_items.append(device_view)

            })

        } else {
            sidebar_items.append('No devices found.')
        }

        fs.watch('/mnt/', (e, filename) => {
            localStorage.setItem('sidebar', 1);
            show_sidebar();
            get_devices();
        })


        fs.watch('/media/michael/', (e, filename) => {
            localStorage.setItem('sidebar', 1);
            show_sidebar();
            get_devices();
        })

        // fs.watch('/run/usr/gvfs', (e) => {
        //     get_devices();
        // })

        // server.style = 'position: fixed; bottom:0'
        // server.placeholder = 'Connect to server'
        // device_view.append(server)

        msg.append('')


    } catch (err) {
        console.log('error getting devices:', err)
    }


}

/**
 * Autocomplete for directories in the location textbox (breadcrumbs)
 * refer to style.css for formating options
 */
 function autocomplete() {

    let ac = 0

    let autocomplete            = document.getElementById('autocomplete');
    let breadcrumbs             = document.getElementById('breadcrumbs');
    let breadcrumb_items        = document.getElementById('breadcrumb_items');
    let folders                 = fs.readdirSync(breadcrumbs.value);
    let folders_arr             = folders.filter(a => fs.statSync(path.join(breadcrumbs.value, a)).isDirectory());

    breadcrumbs.addEventListener('keyup', (e) => {

        console.log('running autocomplete')

        breadcrumb_items.innerHTML = '';
        let search_results = []

        let search = e.target.value.substring(path.dirname(breadcrumbs.value).length + 1, e.target.value.length)
        folders_arr.forEach(item => {
            if (item.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1 && (item.toLocaleLowerCase().indexOf(search) < 1 || item.toLocaleLowerCase().indexOf(search.toLowerCase()) < 1)) {
                search_results.push(path.join(path.dirname(breadcrumbs.value),  item));
            }
        })

        if (search_results.length > 0) {

            breadcrumb_items.classList.remove('hidden')
            if (e.key === 'Escape') {
                breadcrumb_items.classList.add('hidden')
            }

            search_results.forEach((breadcrumb_item, idx) => {

                if (idx == 0) {
                    let length0 = breadcrumbs.value.length
                    breadcrumbs.setSelectionRange(parseInt(length0), parseInt(breadcrumb_item.length));
                }

                let link = add_link(breadcrumb_item, breadcrumb_item)

                link.classList.add('header_link')

                let item =  add_item(link)
                item.tabIndex = idx
                breadcrumb_items.append(item)
                autocomplete.append(breadcrumb_items)

                item.addEventListener('click', (e) => {
                    get_view(e.target.innerText)
                    // let length0         = e.target.innerText.length
                    // breadcrumbs.value   = path.join(search_results[0], '/');
                    // breadcrumbs.focus()
                    // breadcrumbs.setSelectionRange(length0 + 1, e.target.value.length)
                })
            })

            let items = breadcrumb_items.querySelectorAll('.item')

            if (e.key === 'ArrowDown') {
                ++ac;
                console.log(ac)
                items[ac - 1].classList.add('highlight')
                if (ac > items.length) {
                    ac = 0;
                }
            }

            if (e.key === 'ArrowUp') {
                --ac;
                items[ac].classList.add('highlight')
            }

            if (e.key === 'Enter') {
                let dir = items[ac - 1].innerText
                ac = 0;
                get_view(dir)
                breadcrumb_items.classList.add('hidden')
                breadcrumbs.focus()
            }

        } else {

        }

    })

}

/* Add select files to copy array */
function copy() {

    let highlight = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');

    let folder_count = 0
    let file_count = 0

    if (highlight.length > 0) {

        let source
        let card_id
        let c1 = 0;
        let c2 = 0;
        highlight.forEach((item, idx) => {

            source = item.querySelector('a').getAttribute('href')
            stats = fs.statSync(source)

            if (stats.isDirectory()) {
                folder_count += 1
            } else {
                file_count += 1
            }

            card_id = item.id
            add_copy_file(source, card_id)

            if (fs.statSync(source).isDirectory()) {
                ++c1;
            } else {
                ++c2;
            }

        })

        notification(c1 + ' Folers ' + c2 + ' Files copied');
    }
}

/* Cut operation */
function cut() {

    let highlight = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');

    // SET CUT FLAG TO 1
    cut_files = 1;

    let folder_count = 0;
    let file_count = 0;

    if (highlight.length > 0) {

        let source = '';
        let card_id = '';

        highlight.forEach((item, idx) => {

            source = item.querySelector('a').getAttribute('href');
            item.style = 'opacity: 0.6 !important';
            item.classList.remove('ds-selected');

            stats = fs.statSync(source);

            if (stats.isDirectory()) {
                folder_count += 1;
            } else {
                file_count += 1;
            }

            card_id = item.id;
            add_copy_file(source, card_id);

        })
    }

}

/* Select all cards */
function select_all() {

    let card = document.getElementsByClassName('highlight')

    if (card.length > 0) {

        let grid = card[0].closest('.grid')
        let cards = grid.getElementsByClassName('card')

        for (let i = 0; i < cards.length; i++) {
            cards[i].classList.add('highlight_select')
        }

    } else {

        let main_view = document.getElementById('main_view')
        let nav_item = main_view.querySelectorAll('.nav_item')

        nav_item.forEach(item => {
            item.classList.add('highlight_select')
        })

        info(nav_item.length + ' items selected')

    }

}

// LAZY LOAD IMAGES
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

    // let navitems = [].slice.call(document.querySelectorAll(".nav_item"))

    // // CHECK IF WINDOW
    // if ("IntersectionObserver" in window) {

    //     // GET REFERENCE TO LAZY IMAGE
    //     let navitemObserver = new IntersectionObserver(function (entries, observer) {

    //         entries.forEach(function (entry) {
    //             if (entry.isIntersecting) {
    //                 let item = entry.target
    //                 let options = {
    //                     id: 0,
    //                     href: item.dataset.href,
    //                     linktext: path.basename(item.dataset.href),
    //                     grid: '',
    //                     is_folder: 0
    //                 }

    //                 add_card(options).then(card => {
    //                     // update_card(card);
    //                 })
    //             }

    //         })

    //     })

    //     // THIS RUNS ON INITIAL LOAD
    //     navitems.forEach(function (navitem) {
    //         navitemObserver.observe(navitem)
    //     })

    // }
}

// HIDE PROGRESS
function hide_progress(card_id) {

    let progress = document.getElementsByClassName('progress')
    if (progress) {
        for (let i = 0; i < progress.length; i++) {
            progress[i].classList.add('hidden')
        }
    }
}

// PASTE
function paste() {

    state = 2
    ipcRenderer.send('is_main_view', 1)

    // RUN MOVE TO FOLDER
    if (cut_files == 1) {

        cut_files = 0;
        move_to_folder(breadcrumbs.value, state);

    // RUN COPY FUNCTION
    } else {
        copy_files(breadcrumbs.value, state);
    }

    // CLEAN UP
    clear_items();

}

// ADD GRID
function add_grid() {
    let grid = document.createElement('div')
    grid.classList.add('ui', 'grid')
    return grid
}

// ADD DIV
function add_div() {
    let div = document.createElement('div')
    return div
}

function add_tab(label) {

    tabs.classList.remove('hidden')

    let div = add_div();
    div.classList.add('fm', 'tab');

    let col1 = add_div();
    let col2 = add_div();

    // try {
    //     get_view(label);
    // } catch (err) {

    // }

    div.onclick = (e) => {

        let tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.classList.remove('active-tab')
        })

        div.classList.add('fm', 'active-tab')
        get_view(label);

    }

    div.classList.add('fm', 'active-tab')

    let btn_close = add_icon('times');
    btn_close.classList.add('small');
    col2.onclick = (e) => {
        div.remove();
        get_view(breadcrumbs.value);
    }

    btn_close.style = 'padding-left: 10px; padding-right: 10px;'

    col1.append(label);
    col2.append(btn_close);

    div.append(col1, col2);

    return div;

}

// ADD ROW
function add_row() {
    let row = document.createElement('div')
    row.classList.add('row')
    row.style = 'width: 100%; padding: 0px !important;';
    return row
}

// ADD DRAGHANDLE
function add_draghandle() {

    let draghandle = add_div()
    draghandle.style = 'width: 4px; height:100%; position:absolute; right: 0; background-color: #2c2c2c';

    draghandle.addEventListener('mouseover', (e) => {

        draghandle.style.cursor = 'col-resize';

    })

    draghandle.addEventListener('mouseout', (e) => {

    })

    return draghandle;
}

// ADD COLUNN
function add_column(length) {

    // let width = parseInt(length) / 2

    // CREATE OOLUMN
    let column = add_div()
    // column.style = 'float:left; width:50%;'
    column.classList.add('column', length, 'wide')


    // ADD DRAG HANDLE
    // column.append(add_draghandle())
    return column
}

// ADD BREAK
function add_br() {
    return document.createElement('br')
}

/**
 *
 * @param {HTMLElement} text
 * @returns HTMLDivElement
 */
function add_item(text) {
    let item = add_div() //document.createElement('div')
    item.classList.add('item')
    item.append(text)
    return item
}

/**
 *
 * @param {String} text
 * @returns a text
 */
function add_text(text) {
    let item = add_div()
    item.append(text)
    return item;
}

/**
 *
 * @param {string} type valid types text, checkbox, color, date, datetime-local, email, file, hidden, image, month, number, password,radio, range,reset, search, submit, tel, text, time, url, week
 * @param {string} id HTML Element ID
 */
function add_input(type, id) {

    let input       = document.createElement('input');
    input.id        = id;
    input.type      = type;
    input.style     = 'height: 20px; border: none; margin-top: 10px; margin-bottom: 10px'
    return input;

}

/**
 *
 * @param {int} id
 * @param {string} text
 * @returns
 */
function add_button(id, text) {
    let button = document.createElement('input')
    button.type = 'button'
    button.classList.add('ui', 'button')
    button.value = text
    return button
}

// ADD CHECKBOX
function add_checkbox(id, label) {

    let checkbox = add_div()
    // checkbox.classList.add('checkbox')

    let chk_label = add_label(label)
    chk_label.htmlFor = id

    let chk = document.createElement('input')
    chk.type = "checkbox"
    chk.id = id
    chk.classList.add('checkbox')

    checkbox.append(chk)
    checkbox.append(chk_label)

    return checkbox

}

/**
 * Append a string or object to a label
 * @param {object} text
 * * @param {string} label_for
 * @returns HTML label element
 */
function add_label(text, label_for = '') {
    let label       = document.createElement('label');
    label.classList.add('label')
    label.htmlFor   = label_for;
    label.style = 'padding-bottom: 5px;'
    label.append(text);
    return label;
}

// ADD PROGRESS
function add_progress() {
    let progress = document.createElement('progress')
    progress.value = 1
    progress.max = 100
    return progress
}

// ADD IMG
function add_img(src) {
    let img = document.createElement('img')
    let icon_dir = path.join(__dirname, 'assets', 'icons');
    img.style = 'float:left; padding-right: 5px; vertical-align: middle !important'
    img.width = 32
    // img.height = 32
    img.classList.add('lazy')
    img.dataset.src = src
    img.src = path.join(__dirname, 'assets/icons/kora/actions/scalable/viewimage.svg')
    return img
}

/**
 *
 * @param {HtmlElement} msg
 */
function add_message(msg) {
    let div = add_div();
    div.classList.add('ui', 'message');
    div.append(msg);
    return div;
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

// let icon_theme = execSync('gsettings get org.gnome.desktop.interface icon-theme').toString().replace(/'/g, '').trim()
// let icon_dir = path.join('/usr/share/icons', get_icon_theme());
// // IF ICONS ARE NOT IN PATH THEN TRY ICONS IN .icons
// if (!fs.existsSync(folder_icon_dir)) {
//     folder_icon_dir = path.join(get_home(), '.icons', icon_theme)
//     console.log('folder_icons', folder_icon_dir)
// }

// Get icon theme directory
let theme_dir = get_icon_theme();

// GET FOLDER_ICON
function get_folder_icon(callback) {

    let folder_icon_path = ''
    let icon_dirs = [path.join(theme_dir,'32x32/places/folder.png'), path.join(theme_dir,'places/scalable/folder.svg'),path.join(theme_dir,'places/64/folder.svg')];
    icon_dirs.every(icon_dir => {

        // let icon_path = path.join(icon_dir, 'folder.png');
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

function get_icon_path(file) {
    // try {
    //     let stats = fs.statSync(file)
    //     let file_ext = path.extname(file)
    //     if (stats.isDirectory()) {
    //         // todo: this needs to be reworked to get theme folder icon
    //         // icon = path.join(__dirname, '/assets/icons/folder.png');
    //         icon_dir = path.join(__dirname, '/assets/icons/kora')
    //         icon = path.join(icon_dir, '/mimetypes/scalable/application-document.svg')
    //         // alert(icon)
    //     } else {
    //         icon_dir = path.join(__dirname, '/assets/icons/kora')
    //         if (file_ext.toLocaleLowerCase() == '.jpg' || file_ext.toLocaleLowerCase() == '.png' || file_ext.toLocaleLowerCase() == '.jpeg' || file_ext.toLocaleLowerCase() == '.gif' || file_ext.toLocaleLowerCase() == '.svg' || file_ext.toLocaleLowerCase() == '.ico' || file_ext.toLocaleLowerCase() == '.webp') {
    //             icon = file
    //             let img_data = get_img_data(file);
    //             console.log(img_data)
    //         } else if (file_ext == '.xls' || file_ext == '.xlsx' || file_ext == '.xltx' || file_ext == '.csv') {
    //             icon = path.join(icon_dir, '/apps/scalable/ms-excel.svg')
    //         } else if (file_ext == '.docx' || file_ext == '.ott' || file_ext == '.odt') {
    //             icon = path.join(icon_dir, '/apps/scalable/libreoffice-writer.svg')
    //         } else if (file_ext == '.wav' || file_ext == '.mp3' || file_ext == '.mp4' || file_ext == '.ogg') {
    //             icon = path.join(icon_dir, '/mimetypes/scalable/audio-wav.svg')
    //         } else if (file_ext == '.iso') {
    //             icon = path.join(icon_dir, '/apps/scalable/isomaster.svg')
    //         } else if (file_ext == '.pdf') {
    //             icon = path.join(icon_dir, '/apps/scalable/gnome-pdf.svg')
    //         } else if (file_ext == '.zip' || file_ext == '.xz' || file_ext == '.tar' || file_ext == '.gz' || file_ext == '.bz2') {
    //             icon = path.join(icon_dir, '/apps/scalable/7zip.svg')
    //         } else if (file_ext == '.deb') {
    //             icon = path.join(icon_dir, '/apps/scalable/gkdebconf.svg')
    //         } else if (file_ext == '.txt') {
    //             icon = path.join(icon_dir, '/apps/scalable/text.svg')
    //         } else if (file_ext == '.sh') {
    //             icon = path.join(icon_dir, '/apps/scalable/terminal.svg')
    //         } else if (file_ext == '.js') {
    //             icon = path.join(icon_dir, '/apps/scalable/applications-java.svg')
    //         } else if (file_ext == '.sql') {
    //             icon = path.join(icon_dir, '/mimetypes/scalable/application-x-sqlite.svg')
    //         } else {
    //             icon = path.join(icon_dir, '/mimetypes/scalable/application-document.svg')
    //         }
    //     }
    // } catch (err) {
    // }
    // return icon
}

// ADD LINK
function add_link(href, text) {
    let link = document.createElement('a')
    link.href = href
    link.text = text
    link.title = href
    // link.classList.add('header_link')
    return link
}

// ADD ICON
function add_icon(icon_name) {
    let icon = document.createElement('i')
    icon.classList.add('ui', 'icon', icon_name)
    return icon
}

// ADD ICON
function add_p(text) {
    let p = document.createElement('p')
    p.innerHTML = text
    return p
}

// ADD HEADER
function add_header(text) {
    let header = add_div() //document.createElement('h5');
    header.classList.add('header');
    header.title = text
    // header.style = 'font-weight:bold; font-size: 14px; padding: 5px; position: fixed;';
    // header.append(text);
    header.innerHTML = text
    return header;
}

// ADD HEADER MENU ITEM
function add_menu_item(options) {

    let item = document.createElement('a');
    item.classList.add('item');
    item.id = options.id;

    let icon = document.createElement('i');
    icon.classList.add(options.icon, 'icon');

    let content = document.createElement('div');
    content.innerText = "shit";

    item.appendChild(icon);
    item.appendChild(content);

    const header_menu = document.getElementById('header_menu');
    header_menu.appendChild(item);

}

/* SHOW SIDE BAR */
// let show = parseInt(localStorage.getItem('sidebar'));
function show_sidebar() {

    let show            = parseInt(localStorage.getItem('sidebar'));
    let sidebar         = document.getElementById('sidebar');
    let main_view       = document.getElementById('main_view');
    let draghandle      = document.getElementById('draghandle');

    // SET / GET SIDEBAR WIDTH
    let sidebar_width   = 250;
    if (localStorage.getItem('sidebar_width')) {
        sidebar_width   = localStorage.getItem('sidebar_width');
    } else {
        localStorage.setItem('sidebar_width', sidebar_width);
    }

    if (show) {

        sidebar.classList.remove('hidden');
        sidebar.style.width = sidebar_width + 'px';
        sidebar.style.maxWidth = '25%';

        draghandle.style.height = parseInt(main_view.clientHeight + 30) + 'px';

        // SET MAIN VIEW SIZE
        main_view.style.marginLeft = (parseInt(sidebar_width) + 40) + 'px';

        localStorage.setItem('sidebar', 1);
        show = 0;
        // get_sidebar_view();

    } else {

        sidebar.classList.add('hidden');
        main_view.style.marginLeft = (parseInt(0) + 50) + 'px';

        localStorage.setItem('sidebar', 0);
        show = 1;

    }

    sidebar.draggable = false;

}

// HIDE SIDE BAR
function hide_sidebar() {

    // SHOW / HIDE SIDEBAR
    let sidebar = document.getElementById('sidebar')
    let main_view = document.getElementById('main_view')

    sidebar.style.width = "0";
    sidebar.classList.add('hidden')

    main_view.style.marginLeft = "5px";

    sidebar_visible = 0

}

/** NOTIFICATION */
window.notification = function notification(msg) {

    let notification = document.getElementById('notification')
    notification.innerHTML = msg
    notification.classList.remove('hidden')
    setInterval(() => {
        notification.classList.add('hidden')
    }, 3000);
}

/** Create Folder */
async function create_folder(folder) {

    fs.mkdir(folder, {}, (err) => {

        if (err) {
            notification(err)
        } else {

            let info_view = document.getElementById('info_view');
            info_view.innerHTML = ''

            // GET REFERENCE TO FOLDERS CARD
            let folders_card = document.getElementById('folders_card')
            folders_card.classList.remove('hidden')

            // GET REFERENCE TO FOLDER GRID
            let folder_grid = document.getElementById('folder_grid')

            let items = document.getElementsByClassName('folder_card')
            let card_id = 'folder_card_' + items.length

            // CREATE CARD OPTIONS
            let options = {
                id:         card_id,
                href:       folder,
                linktext:   path.basename(folder),
                grid:       folder_grid,
                is_folder:  true
            }

            try {

                /* Add Card */
                add_card(options).then(card => {

                    let header  = card.querySelector('.header_link');
                    let input   = card.querySelector('input');
                    let col     = add_column('three');

                    input.classList.remove('hidden');

                    col.append(card);
                    folder_grid.insertBefore(col, folder_grid.firstChild);

                    input.focus();
                    input.select();
                    header.classList.add('hidden');
                    update_card(card.dataset.href);

                })

            } catch (err) {

                notification(err)
                info(err)

            }

        }

    })

    ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: get_folder_count(),file_count: get_file_count()});
    clear_items();

}

/* Add copy files array */
let copy_files_arr = []
function add_copy_file(source, card_id) {

    let c1 = 0;
    let c2 = 0;
    if (source == '' || card_id == '') {

    } else {

        if (copy_files_arr.length > 0) {

            if (copy_files_arr.every(x => x.source != source)) {

                let file = {
                    card_id: card_id,
                    source: source,
                    size: localStorage.getItem(source),
                    destination: ''
                }

                copy_files_arr.push(file)

                // ADDING MAIN COPY FILES ARRAY
                ipcRenderer.send('add_copy_files', copy_files_arr)
                // ipcRenderer.send('copy_to_clipboard', JSON.stringify(copy_files_arr));

            }

        } else {

            let file = {
                card_id: card_id,
                source: source,
                size: localStorage.getItem(source),
            }

            copy_files_arr.push(file)
            ipcRenderer.send('add_copy_files', copy_files_arr)
            // ipcRenderer.send('copy_to_clipboard', JSON.stringify(copy_files_arr));



        }
    }
}

/* COPY FILES */
async function copy_files(destination_folder, state) {

    ipcRenderer.send('get_copy_files')
    ipcRenderer.send('destination_folder', destination_folder); // set destination folder for updates

    let info_view = document.getElementById('info_view');
    info_view.innerHTML = '';

    // RESET COUNTER. HANDLES SETTING ROOT FOLDER SO THE SIZE CAN BE UPDATED
    // copy_folder_counter = 0

    // ADD DESTINATION TO COPY FILES ARRAY
    copy_files_arr.forEach((item, idx) => {
        item.destination = destination_folder;
    })

    ipcRenderer.send('copy', state);
    clear_copy_arr();

}

// todo: need to figure out when this is done

// COPY FILE SYNC
let number_of_files = 0
let recursive = 0

// COPY FILE
function copyFileSync(source, target) {

    console.log('running')

    var targetFile = target
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    recursive++

    // HANDLE PROGRESS
    let progress = document.getElementById('progress')
    progress.classList.remove('hidden')

    let source_stats = fs.statSync(source)
    let intervalid = setTimeout(() => {

        try {

            let destination_stats = fs.statSync(target)
            progress.value = destination_stats.size

            if (destination_stats.size >= source_stats.size) {
                hide_top_progress()
                clearInterval(intervalid)
            }

        } catch (err) {

        }



    }, 100);

    // COPY FILE
    fs.copyFile(source, targetFile, (err) => {

        if (err) {

            console.log(err)

        } else {

            if (--recursive == 0) {

                // CLEAR PROGRESS
                hide_top_progress()
                c = 0

                // UPDATE CARDS
                let main_view = document.getElementById('main_view')
                update_cards(main_view)

                notification('done copying folder files to ' + target)

            } else {

                notification('copying folder files to ' + targetFile)
            }
            // console.log('copied file from ' + source + ' to ' + targetFile)
        }
    })
}

// COPY FOLDER
let root = ''
let copy_folder_counter = 0
let destination0 = ''
function copyFolderRecursiveSync(source, destination) {

    console.log('folder_count ' + folder_count)
    copy_folder_counter += 1

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
                } else {
                    fs.mkdirSync(destination + ' Copy')
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

                                // alert('curdest ' + curdestination)
                                copyFolderRecursiveSync(cursource, curdestination)

                                console.log('running copyfoldersync')
                                console.log('running copyfoldersync', 'cursource ', cursource, 'curdestination', curdestination)
                                // UPDATE FOLDER_SIZE
                                // ipcRenderer.send('get_folder_size', { href: destination })


                                // FILE
                            } else if (stats.isFile() == true) {

                                // debugger
                                copyFileSync(cursource, curdestination)
                                console.log('running copyfilesync', cursource, curdestination)

                            }

                            // DONT GET DISK SPACE HERE

                        }

                    })


                })

            }

        }

    })

}

// MOVE FOLDER - done
function move_to_folder(destination, state) {

    console.log("running move to folder")

    // // ADD DESTINATION TO ARRAY
    // copy_files_arr.forEach((item, idx) => {
    //     item.destination = destination
    // })

    // SEND TO MAIN
    ipcRenderer.send('move', state);
    // ipcRenderer.send('move', copy_files_arr, state)
    // clear_copy_arr()

}

// CREATE FILE FROM TEMPLATE
function create_file_from_template(filename) {

    let main_view = document.getElementById('main_view')
    let info_view = document.getElementById('info_view')

    let template = path.join(__dirname, 'assets/templates/', filename)
    let destination = path.join(breadcrumbs.value, filename)

    info_view.innerHTML = ''

    console.log('running create file ' + template + ' destin ' + destination)
    console.log(breadcrumbs.value)

    if (fs.existsSync(destination) == true) {
        alert('this file already exists')

    } else {

        fs.copyFileSync(template, destination)
        console.log('done')

        if (fs.existsSync(destination) == true) {

            watch_count = 1

            // GET REFERENCE TO FOLDERS CARD
            let files_card = document.getElementById('files_card')
            files_card.classList.remove('hidden')

            // let file_grid = document.getElementById('file_grid')
            let card_id = 'file_card_1001'

            // CREATE CARD OPTIONS
            let options = {

                id: card_id,
                href: destination,
                linktext: path.basename(destination),
                grid: file_grid

            }

            try {

                add_card(options).then(card => {

                    let col = add_column('three');
                    col.append(card)

                    let files_card = document.getElementById('files_card')
                    files_card.classList.remove('hidden')

                    let file_grid = document.getElementById('file_grid')
                    file_grid.insertBefore(col, file_grid.firstChild)


                    let input = card.getElementsByTagName('input')
                    input[0].classList.remove('hidden')
                    input[0].focus()
                    // input[0].select()
                    input[0].setSelectionRange(0, input[0].value.length - path.extname(filename).length)

                    console.log(card_id)

                    let header = document.getElementById('header_' + card_id)
                    header.classList.add('hidden')

                    update_card(destination)

                })

            } catch (err) {

                notification(err)

            }

        }

        ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: get_folder_count(),file_count: get_file_count()});

    }

    clear_items()

}

// // CREATE FILE FROM TEMPLATE
// ipcRenderer.on('create_file_from_template', function (e, file) {
//     console.log('im running too many times')
//     create_file_from_template(file.file)

// })


// RENAME FILE OR FOLDER
function rename_file(source, destination_name) {

    let main_view = document.getElementById('main_view')

    if (destination_name == "") {
        alert('Enter a file name');
    } else {

        let filename = path.join(path.dirname(source), destination_name)
        console.log('renaming', source, filename)

        if (fs.existsSync(filename)) {

            // todo: this is not working correctly
            // alert(filename + ' already exists!')
            // return false

        } else {

            console.log(source, filename)
            fs.rename(source, filename, function (err) {

                if (err) {
                    console.log(err)
                } else {

                    notification('Renamed ' + path.basename(source) + ' to ' + destination_name);
                    update_card(destination_name);

                    let card = main_view.querySelector("[data-href='" + filename + "']");
                    card.querySelector('.header_link').focus();

                }

            })
        }

    }

}

// DELETE CONFIRMED
delete_files_count = 0
delete_folder_count = 0
function delete_confirmed() {

    let info_view = document.getElementById('info_view');

    // LOOP OVER ITEMS DELETE ARRAY
    if (delete_arr.length > 0) {

        delete_arr.forEach((file, idx) => {

            card_id = file.card_id;

            // IF DIRECTORY
            if (fs.statSync(file.source).isDirectory()) {

                ++delete_folder_count;

                // RUN PROGRESS
                get_progress(parseInt(localStorage.getItem(file.source) * -1));

                // DELETE FOLDER
                delete_file(file.source);

                // IF FILE
            } else if (fs.statSync(file.source).isFile()) {

                ++delete_files_count;

                // DELETE FILE
                delete_file(file.source);

            }

            active_href = ''

        })

        let msg = "";
        if (delete_folder_count > 0) {
            msg = delete_folder_count + ' folder/s deleted.';
        }
        if (delete_files_count > 0) {
            msg = msg + ' ' + delete_files_count + ' file/s deleted';
        }

        notification(msg);

        // CLEAR DELETE ARRAY
        delete_arr = [];
        clear_items();

        ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: get_folder_count(),file_count: get_file_count()});

    } else {
        // console.log('nothing to delete');
        // notification('Nothing to delete');
        // indexOf('Nothing to delete.')
    }

}

// Delete file
async function delete_file(file) {
    ipcRenderer.send('delete_file', file);
}

// Get folder count
function get_folder_count() {
    let folder_count = 0;
    let main_view = document.getElementById('main_view');
    let folder_cards = main_view.querySelectorAll('.folder_card');
    folder_count = folder_cards.length;
    // console.log('folder_count', folder_cards.length);
    return folder_count;
}

// Get file count
function get_file_count() {
    let file_count = 0;
    let main_view = document.getElementById('main_view');
    let file_cards = main_view.querySelectorAll('.file_card');
    file_count = file_cards.length;
    // console.log('file count',file_cards.length);
    return file_count;
}

// Calculate file size
function get_file_size(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];

};

// Get raw file size
function get_raw_file_size(fileSizeInBytes) {
    var i = -1;
    // var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1);

};

// Open terminal
function open_terminal() {

    let cards = main_view.querySelectorAll('.highlight, .highlight_select, .ds-selected')
    if (cards.length > 0) {
        cards.forEach(card => {
            exec('gnome-terminal --working-directory=' + card.dataset.href, (error, data, getter) => {});
        })
    } else {
        exec('gnome-terminal --working-directory=' + breadcrumbs.value, (error, data, getter) => {});
    }

}

// NAVIGATE FUNCTION LEFT RIGHT UP
let back_counter = 0;
function navigate(direction) {

    let dir         = get_home();
    let breadcrumbs = document.getElementById('breadcrumbs');
    let last_index  = history_arr.lastIndexOf(breadcrumbs.value);
    let idx         = 0;
    historize       = 0;

    if (direction === 'left') {
        ++back_counter;
        idx = history_arr.length - back_counter;
        if (idx > 0) {
            dir = history_arr[idx]
        } else {
            idx = 0;
            back_counter = 0;
        }
    }

    if (direction === 'right') {
        ++back_counter
        idx = history_arr + back_counter;
        if (idx < history_arr.length) {
            dir = history_arr[idx]
        } else {
            idx = 0
            back_counter = 0;
        }
    }

    if (idx > 0) {
        get_view(dir);
    } else {
        get_view(get_home());
    }


    // for (i = 0; i < history_arr.length; i++) {

    //     if (history_arr[i] == breadcrumbs.value) {

    //         // NAVIGATE LEFT
    //         if (direction == 'left') {

    //             if (i > 1) {
    //                 dir = history_arr[last_index - 1];
    //             } else {
    //                 dir = breadcrumbs.value.substring(0, breadcrumbs.value.length - path.basename(breadcrumbs.value).length - 1)
    //             }
    //         }

    //         // NAVIGATE RIGHT
    //         if (direction == 'right') {

    //             if (i < history_arr.length - 1) {
    //                 dir = history_arr[last_index + 1];
    //             }
    //         }

    //     }

    // };

    // // LOAD VIEW
    // get_view(dir);

}

// EXTRACT HERE / DECOMPRESS
function extract() {

    let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')

    items.forEach(item => {

        let cmd         = '';
        let us_cmd      = '';
        let filename    = '';
        let source      = item.dataset.href;
        let ext         = path.extname(source).toLowerCase()
        let makedir     = 1;

        console.log('extension ', source)
        let c = 0;
        switch (ext) {
            case '.zip':
                filename = source.replace('.zip', '')
                c = 0
                while(fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
                cmd = "unzip '" + source + "' -d '" + filename + "'"
                break;
            case '.tar':
                filename = source.replace('.tar', '')
                c = 0
                while(fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
                cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xzf "' + source + '"'
                break;
            case '.gz':
                filename = source.replace('.tar.gz', '')
                c = 0
                while(fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
                cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar -xzf "' + source + '" -C "' + filename + '"';

                break;
            case '.xz':
                filename = source.replace('tar.xz', '')
                filename = filename.replace('.img.xz', '')
                c = 0
                while(fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "xz -l -v '" + source + "' | awk 'FNR==11{print $6}'"
                // cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xf "' + source + '" -C "' + filename + '"'
                if (source.indexOf('img.xz') > -1) {
                    makedir = 0;
                    cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/unxz -k "' + source + '"';
                    // cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/xz -d -k "' + source + '"';
                } else {
                    cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar -xf "' + source + '" -C "' + filename + '"';
                }
                break;
            case '.bz2':
                filename = source.replace('.bz2', '')
                c = 0
                while(fs.existsSync(filename) && c < 5) {
                    filename = filename + ' Copy'
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
                cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/bzip2 -dk "' + source + '"'
                break;

        }

        console.log('cmd ' + cmd);
        console.log('uncompressed size cmd ' + us_cmd);

        if (makedir) {
            fs.mkdirSync(filename);
        }

        // GET UNCOMPRESSED SIZE
        let uncompressed_size = parseInt( execSync(us_cmd).toString().replaceAll(',',''))

        console.log('uncompressed size:', uncompressed_size);

        // RUN PROGRESS
        // get_progress(get_raw_file_size(uncompressed_size))
        get_progress(uncompressed_size)

        console.log('executing ' + cmd)
        notification('Extracting ' + source)

        open(cmd);

        // THIS NEEDS WORK. CHECK IF DIRECTORY EXIST. NEED OPTION TO OVERWRITE
        exec(cmd,{maxBuffer: Number.MAX_SAFE_INTEGER}, (err, stdout, stderr) => {

            if (err) {

                console.log('error ' + err)
                notification('error ' + err)

            } else {

                try {

                    if (makedir) {

                        // GET REFERENCE TO FOLDER GRID
                        let folder_grid     = document.getElementById('folder_grid');
                        let folders_card    = document.getElementById('folders_card')

                        // CREATE CARD OPTIONS
                        let options = {
                            id: 0,
                            href: filename,
                            linktext: path.basename(filename),
                            is_folder: true,
                            grid: folder_grid
                        }

                        //
                        // let folder_grid = document.getElementById('folder_grid')
                        // notification('filename ' + filename);

                        add_card(options).then(card => {

                            console.log(card);

                            let col = add_column('three');
                            col.append(card)

                            // console.log('card ' + card)
                            folders_card.classList.remove('hidden');
                            folder_grid.insertBefore(col, folder_grid.firstChild)

                            // UPDATE CARDS
                            // update_cards(document.getElementById('main_view'))
                            update_card(filename)



                        })

                    } else {
                        makedir = 1;
                    }


                } catch (err) {

                    console.log(err)
                    notification(err)

                }

                if (uncompressed_size > (1024 * 1024 * 1024)) {
                    ipcRenderer.send('add_system_notification', 'Operation Complete', 'Done extractig file ' + filename);
                }

                clear_items()
                // ds.start()
                notification('Extracted ' + source)

            }

        })

    })

}

// COMPRESS
function compress() {

    let cards       = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');
    let file_grid   = document.getElementById('file_grid');
    let files_card  = document.getElementById('files_card')
    let file_name   = ''; //'Untitled.tar.gz'
    let file_list   = '';
    let max         = 0;

    cards.forEach((card, idx) => {

        if (idx == 0) {
            file_name = path.basename(card.dataset.href);
            file_name = file_name.substring(0, file_name.length - path.extname(file_name).length) + '.tar.gz';

            console.log(file_name);
        }

        let file = path.basename(card.dataset.href)
        file_list += "'" + file + "' ";

        max += parseInt(localStorage.getItem(card.dataset.href))

    })

    // let cmd_size = 'cd "' + breadcrumbs.value + '"; tar czf "' + file_name + '" ' + file_list + ' | wc -c';
    // exec(cmd_size, (err, stdout) => {
    //     stdout.on('data', (res) => {
    //         console.log('compressed size', res)
    //     })
    // })

    // console.log(cmd_size)

    get_progress(max, file_name)

    // Create compressed file
    let cmd = 'cd "' + breadcrumbs.value + '"; tar czf "' + file_name + '" ' + file_list;
    console.log(cmd);
    exec(cmd, (err, stdout) => {
        if (err) {
            console.log(err);
        } else {
            console.log(stdout);
            update_card(path.join(breadcrumbs.value, file_name));
            clearInterval(intervalid);

            notification('Done compressinge files.')

            let options = {
                id: 0,
                href: path.join(breadcrumbs.value, file_name),
                linktext: file_name,
                is_folder: false,
                grid: file_grid
            }

            add_card(options).then(card => {

                console.log('what')

                let col = add_column('three')
                col.append(card)
                file_grid.insertBefore(col, file_grid.firstChild);

                update_card(card.dataset.href);
                files_card.classList.remove('hidden')

                card.classList.add('highlight_select')

            })

        }

    })


    // let intervalid = setInterval(() => {
    //     update_card(path.join(breadcrumbs.value, file_name));
    //     max = max / cards.length
    //     // get_progress(max, path.join(breadcrumbs.value, file_name))
    // }, 500);


    clear_items()

}

//////////////////////////////////////////////////////////////////

// CONTEXT MENU COMMANDS
// FILES AND BLANK AREA
ipcRenderer.on('context-menu-command', (e, command, args) => {

    // OPEN TEMPLATES FOLDER
    if (command == 'open_templates_folder') {
        get_files(path.join(__dirname, 'assets/templates'), { sort: localStorage.getItem('sort') });
    }

    // EXTRACT HERE
    if (command === 'extract_here') {
        extract();
    }

    // COMPRESS HERE
    if (command === 'compress_folder') {
        compress();
    }

    // RELOAD
    if (command === 'reload') {

        // mainWindow.loadURL(mainAddr);
    }

    if (command === 'open_in_new_window') {
        // let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')
        // items.forEach(item => {
            ipcRenderer.send('new_window');
        // })
    }

    // NEW WINDOW
    if (command === 'new_window') {
        ipcRenderer.send('new_window');
    }

    // CREATE NEW FOLDER
    if (command === 'new_folder') {

        let folder = breadcrumbs.value;
        console.log(folder);

        if (folder != '') {
            create_folder(folder + '/Untitled Folder');
        }

    }

    // DELETE COMMAND
    delete_arr = []
    if (command === 'delete') {

        // CLEAR ARRAY
        delete_arr = []
        // CLEAR LIST
        let list = ''

        // GET HIGHLIGHTED ITEMS
        // let items = document.getElementsByClassName('highlight_select')
        let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');
        if (items.length > 0) {

            // LOOP OVER ITEMS AND ADD TO DELETE ARRAY
            for (let i = 0; i < items.length; i++) {

                let item = items[i];
                let href = item.getAttribute('data-href');

                let file = {
                    card_id: item.id,
                    source: href
                }

                delete_arr.push(file);
                list += href + '\n';

            }

            ipcRenderer.send('confirm_file_delete', list);

        }

    }

    // FILES /////////////////////////////////////////////////////////////////////

    // CREATE FILE
    if (command === 'new_file') {

        // alert('test')
        // console.log(breadcrumbs.value)
        // create_file()

    }

    // RENAME FILE
    if (command === 'rename') {

        href2 = source

        console.log('card id ' + card_id)
        let card = document.getElementById(card_id)

        if (card) {

            let header = card.querySelector('a')
            let input = card.querySelector('input')

            header.classList.add('hidden')
            input.classList.remove('hidden')

            console.log('running focus')
            input.focus()
            input.select()

        }

    }

    // COPY FILE OR FOLDER
    if (command === 'cut') {
        cut()
    }

    // COPY FILE OR FOLDER
    if (command === 'copy') {
        copy()
    }

    // PASTE COMMAND
    if (command === 'paste') {
        // PAST FILES
        paste();
    }

    // IF WE RECIEVE DELETE CONFIRMED THEN DELETE FILE/S
    ipcRenderer.on('delete_file_confirmed', (e, res) => {

        delete_confirmed()

    })

    // OPEN TERMINAL
    if (command === 'open_terminal') {
        open_terminal()
    }

    // OPEN VSCODE
    if (command === 'vscode') {
        let items = document.querySelectorAll('.highlight_select, .highlight, .ds-selected')
        items.forEach(item => {
            if (fs.statSync(item.dataset.href).isDirectory()) {
                exec('cd "' + item.dataset.href + '"; code .');
            } else {
                exec('code ' + item.dataset.href);
            }

        })

    }

    // OPEN WITH
    if (command === 'open_with_application') {

        let items = document.querySelectorAll('.highlight_select, .highlight, .ds-selected')
        items.forEach(item => {

            let cmd = args
            console.log('cmd args', args)
            // let filename = path.basename(source)
            // let filepath = path.dirname(source)

            cmd = cmd.replace('%U', "'" + item.dataset.href + "'")
            cmd = cmd.replace('%F', "'" + item.dataset.href + "'")
            cmd = cmd.replace('%u', "'" + item.dataset.href + "'")
            cmd = cmd.replace('%f', "'" + item.dataset.href + "'")

            console.log('cmd ' + cmd)
            exec(cmd)

        });

        clear_items()

    }

    if (command === 'open_new_tab') {

        let tabs = document.getElementById('tabs');
        let items = document.querySelectorAll('.highlight_select, .highlight, .ds-selected');
        items.forEach((item, idx) => {
            let tab = add_tab(item.dataset.href)
            tabs.append(tab)

            if (items.length == idx + 1) {
                get_view(item.dataset.href)
            }

        })


    }

    // FILE PROPERTIES
    if (command === 'props') {

        // let sb_items = document.getElementById('sidebar_items');
        // sb_items.innerHTML = ''

        // file_properties_arr = []
        // let main_view       = document.getElementById('main_view')
        // let items           = main_view.querySelectorAll('.highlight_select, .highlight, .ds-selected');
        // items.forEach(item => {

        //     switch (path.extname(item.dataset.href)) {
        //         case '.jpg':
        //         case '.png':
        //         case '.jpeg':
        //         case '.svg':
        //         case '.gif':
        //             get_image_properties(item.dataset.href);
        //         break;
        //         default: {
        //             file_properties_arr.push(item.dataset.href);
        //             ipcRenderer.send('get_file_properties', file_properties_arr)
        //             console.log('props array', file_properties_arr)
        //             file_properties_arr = []
        //         }
        //     }

        // })
        get_file_properties();

    }

})

// RUN ON CONTEXT MENU CLOSE
ipcRenderer.on('clear_selected_files', (e, res) => {
    clear_items()
})

// ON DOCUMENT LOAD
window.addEventListener('DOMContentLoaded', () => {

    // let breadcrumbs     = document.getElementById('breadcrumbs');
    // breadcrumbs.addEventListener('keyup', (e) => {
        // try {

            // autocomplete();

            // console.log('running')
            // document.addEventListener('keydown', (e) => {
            //     let breadcrumb_items = document.getElementById('breadcrumb_items')
            //     if (e.key === 'ArrowDown') {
            //         let ac = 0;
            //         console.log('counter', ++ac)
            //         // let items = breadcrumb_items.querySelectorAll('.item')
            //         // items.forEach((item, idx) => {
            //         //     if (idx == ac) {
            //         //         item.classList.add('highlight')
            //         //     }
            //         // })
            //     }
            //     // if (ac > search_results.length) {
            //     //     ac = 0;
            //     // }
            // })


        // } catch (err) {
        // }
    // })

    /* Initialize sort */
    let sort = localStorage.getItem('sort');
    if (sort == null || sort == '') {
        console.log('setting sort');
        localStorage.setItem('sort', 1);
    }

    /* Initialize sort direction */
    let sort_direction = localStorage.getItem('sort_direction');
    if (sort_direction == null || sort_direction == '') {
        console.log('setting sort direction')
        localStorage.setItem('sort_direction', 'desc');
    }

    /* Initialize view */
    view = localStorage.getItem('view');
    if (view == null || view == '') {
        console.log('setting view');
        localStorage.setItem('view', 'grid');
        view = 'grid';
    }

    /* Initialize side bara */
    sidebar = localStorage.getItem('sidebar')
    if (sidebar == null || sidebar == '') {
        console.log('setting sidebar to 1')
        localStorage.setItem('sidebar', 1);
    }

    let minibar = document.getElementById('minibar')
    if (minibar) {
        minibar.addEventListener('click', (e) => {
            localStorage.setItem('sidebar', 1)
            show_sidebar()
        })
    }

    // INITIALIZE DRAG SELECT
    try {

        ds = new DragSelect({
            area: document.getElementById('main_view'),
            selectorClass: 'drag_select',
            keyboardDragSpeed: 0,
        })

        ds.subscribe('predragmove', ({ isDragging, isDraggingKeyboard }) => {
            if(isDragging || isDraggingKeyboard) {
              ds.break()
            }
        })


    } catch (err) {
        console.log(err);
    }

    // Show workspace
    Mousetrap.bind(settings.keyboard_shortcuts.ShowWorkspace.toLocaleLowerCase(), () => {
        get_workspace();
        localStorage.setItem('sidebar', 1);
        show_sidebar();
    })

    Mousetrap.bind(settings.keyboard_shortcuts.ShowDevices.toLocaleLowerCase(), () => {
        get_devices();
        localStorage.setItem('sidebar', 1);
        show_sidebar();
    })

    // Get File info
    Mousetrap.bind(settings.keyboard_shortcuts.Properties.toLocaleLowerCase(), () => {
        get_file_properties();
    })

    // Navigate right
    Mousetrap.bind(settings.keyboard_shortcuts.Right.toLocaleLowerCase(), () => {
        console.log('back pressed')
        navigate('right')
    })

    // ALT+E EXTRACT
    Mousetrap.bind(settings.keyboard_shortcuts.Extract.toLocaleLowerCase(), (e) => {

        console.log('extracting file')
        extract();

    })

    // Compress
    Mousetrap.bind(settings.keyboard_shortcuts.Compress.toLocaleLowerCase(), (e) => {

        compress()

        // let href = ''
        // if (items.length > 0) {
        //     for (let i = 0; i < items.length; i++) {

        //         // let item = items[i]

        //         // if (item.classList.contains('highlight') || item.classList.contains('highlight_select')) {
        //         //     href = item.dataset.href
        //         //     console.log('source ' + href)
        //         //     compress(href)
        //         // }
        //     }
        // }

    })

    // Select all
    Mousetrap.bind(settings.keyboard_shortcuts.SelectAll.toLocaleLowerCase(), (e) => {

        e.preventDefault();
        select_all();

    })

    /**
     * ctrl+b toggle sidebar
     */
    // Mousetrap.bind('ctrl+b', (e) => {
    //     let sidebar = document.getElementById('sidebar')
    //     if (sidebar.classList.contains('hidden')) {
    //         localStorage.setItem('sidebar', 1)
    //         show_sidebar()
    //     } else {
    //         localStorage.setItem('sidebar', 0)
    //         show_sidebar()
    //     }
    // })

    // DEL DELETE KEY
    Mousetrap.bind(settings.keyboard_shortcuts.Delete.toLocaleLowerCase(), (e, res) => {

        items = []
        items = document.querySelectorAll('.highlight_select, .ds-selected')

        let source = ''
        if (items.length > 0) {

            for (let i = 0; i < items.length; i++) {

                let item = items[i]

                source += item.getAttribute('data-href') + '\n'

                let file = {
                    source: item.getAttribute('data-href'),
                    card_id: item.id
                }

                delete_arr.push(file)
            }

            ipcRenderer.send('confirm_file_delete', source)

        }

    })

    // CTRL-L - LOCATION
    Mousetrap.bind('ctrl+l', (e, res) => {
        let breadcrumb = document.getElementById('breadcrumbs')

        breadcrumb.focus()
        breadcrumb.select()
    })

    // CTRL V - PASTE
    Mousetrap.bind(settings.keyboard_shortcuts.Paste.toLocaleLowerCase(), () => {
        // PAST FILES
        paste()
    })

    // NEW WINDOW
    Mousetrap.bind('ctrl+n', () => {
        // window.open('../src/index.html','_blank', 'width=1600,height=800,frame=false')
        ipcRenderer.send('new_window')
    })

    // NEW FOLDER
    Mousetrap.bind(settings.keyboard_shortcuts.NewFolder.toLocaleLowerCase(), () => {
        create_folder(breadcrumbs.value + '/Untitled Folder')
    })

    // RENAME
    Mousetrap.bind(settings.keyboard_shortcuts.Rename.toLocaleLowerCase(), () => {

        console.log('f2 pressed')

        let cards = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')
        if (cards.length > 0) {
            cards.forEach(card => {
                if (card) {
                    let header = card.querySelector('a')
                    header.classList.add('hidden')

                    let input = card.querySelector('input')
                    input.spellcheck = false
                    input.classList.remove('hidden')
                    input.setSelectionRange(0, input.value.length - path.extname(header.href).length)
                    input.focus()

                    console.log('running focus')
                }

            })
        }

    })

    // RELOAD
    Mousetrap.bind('f5', () => {

        get_view(breadcrumbs.value)
        localStorage.setItem('folder', breadcrumbs.value)

    })

    // FIND
    Mousetrap.bind(settings.keyboard_shortcuts.Find.toLocaleLowerCase(), () => {

        // find_files();
        localStorage.setItem('sidebar', 1);
        show_sidebar();

        // find();
        find_files(res => {
            let find = document.getElementById('find')
            find.focus()
            find.select()
        })

    })

    // CTRL C COPY
    Mousetrap.bind(settings.keyboard_shortcuts.Copy.toLocaleLowerCase(), (e) => {
        copy();
    })

    // CTRL+X CUT
    Mousetrap.bind(settings.keyboard_shortcuts.Cut.toLocaleLowerCase(), (e) => {
        cut();
    })

    // ESC KEY
    Mousetrap.bind('esc', () => {

        notification('');
        clear_copy_arr();
        clear_items();

    })

    // Backspace
    Mousetrap.bind(settings.keyboard_shortcuts.Backspace.toLocaleLowerCase(), () => {
        navigate('left');
    })

    // Add worksoace
    Mousetrap.bind(settings.keyboard_shortcuts.AddWorkspace.toLocaleLowerCase(), () => {
        add_workspace()
    })

    // Show settings
    Mousetrap.bind(settings.keyboard_shortcuts.ShowSettings.toLocaleLowerCase(), () => {
        get_settings_view()
    })

    pagesize = 200;
    page = 1
    get_view(localStorage.getItem('folder'))
    // get_paged_files(localStorage.getItem('folder'), 150, 1, files => {})

    /* Toggle sidebar */
    try {
        show_sidebar()
    } catch (err) {

    }

    // LISTEN FOR CONTEXTMENU. DO NOT CHANGE THIS - I MEAN IT !!!!!!!!!!!!!!!!!!!!!!!!!
    let main_view = document.getElementById('main_view')
    if (main_view) {
        main_view.addEventListener('contextmenu', function (e) {

            if (active_href) {
                let stats = fs.statSync(active_href);
                if (stats) {

                    let filetype = mime.lookup(active_href);
                    let associated_apps = get_available_launchers(filetype, active_href);

                    // CHECK FOR FOLDER CARD CLASS
                    if (stats.isDirectory()) {

                        ipcRenderer.send('show-context-menu-directory', associated_apps);

                    // CHECK IF FILE CARD
                    } else if (stats.isFile()) {

                        let access = 0;
                        try {
                            fs.accessSync(active_href, fs.X_OK);
                            access = 1;
                            ipcRenderer.send('show-context-menu-files', {apps: associated_apps, access: access, href: active_href});
                        } catch (err) {
                            ipcRenderer.send('show-context-menu-files', {associated_apps, href:active_href});
                        }



                    // EMPTY AREA
                    } else {
                        ipcRenderer.send('show-context-menu');
                    }

                    active_href = '';
                }

            } else {

                let data = {
                    source: path.join(__dirname, 'assets/templates/'),
                    destination: breadcrumbs.value + '/'
                }

                ipcRenderer.send('show-context-menu', data);

            }

        })
        main_view.focus();
    }


})

