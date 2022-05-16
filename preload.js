
const {BrowserWindow, getCurrentWindow, globalShortcut, ipcRenderer, contextBridge, Menu, shell, ipcMain, app, MenuItem, menu, TouchBarSegmentedControl, desktopCapturer, clipboard, nativeImage } = require('electron')
const fs = require('fs');
const stat = require('fs')
const watch = require('fs')
const url = require('url')
const path = require('path')
const { exec, execSync, spawn, execFileSync } = require("child_process");
const Mousetrap = require('mousetrap');
const os = require('os');
const { dirname, basename, normalize } = require('path');
const Chart = require('chart.js');
const mime = require('mime-types')


// ARRAYS
let chart_labels = []
let chart_data = []
let directories = []
let files = []

// HISTORY OBJECT
class history {
    dir
    idx
}

// FILE OBJECT
class fileinfo {

    filename
    is_dir
    dir
    extension
    size
    is_hidden
    filecount
    mtime
    ctime
    count
    is_sym_link
    idx

}

class selected_file_obj {

    card_id
    source

}

// ITEM OPTIONS
class card_options {

    id = 0
    href = ''
    image = ''
    linktext = ''
    description = ''
    extra = ''
    is_directory = false
}

let options = {
    sort: 1,
    search: ''
}

let prev_target
let target

// USE VAR GLOBAL
// USE LET INSIDE FUNCTIONS TO REDECLARE VARIABLE
let source = ''
let card_id = 0
let mode = 0

// PROGRESS VARS
let intervalid = 0

// GLOBAL VARS
// HISTORY ARRAY
let history_arr = []
let files_arr = []

// SELECTED FILES ARRAY
let selected_files = []
let find_files_arr = []

// STATE 1 = COPY
// STATE 2 = MOVE
// STATE 3 =
let state = 0;
let prev_card

let destination

// COUNTERS FOR NAVIGATION
let nc = 1
let nc2 = 0
let adj = 0
let is_folder_card = 1

// FOLDER / FILE COUNTERS
let folder_count = 0
let hidden_folder_count = 0
let file_count = 0
let hidden_file_count = 0

// PAGING VARIABLES
let watch_count = 0
let pagesize = 500
let page = 1

let start_path = ''

// this doesnt work
let main_view = document.getElementById('main_view')
let folder_grid = document.getElementById('folder_grid')
// let file_grid = document.getElementById('file_grid')
let progress = document.getElementById('progress')

// ON START PATH
ipcRenderer.on('start_path', (e, res) => {
    if (res) {
        start_path = res
    }
})



// ON COPY FILES
ipcRenderer.on('copy_files', (e, files) => {

    let destination_folder = files.destination_folder
    let file_grid = document.getElementById('file_grid')

    console.log('copy files array legth ' + files.copy_files_arr.length + ' destination folder ' + destination_folder)

    if (files.copy_files_arr.length > 0) {

        notification('running copy_files. (this also handles directories)')

        // let folder_size = localStorage.getItem(files.copy_files_arr[0].source)
        let progress = document.getElementById('progress')

        // todo: will need to remove size if duplicate cancelled
        let source_size = 0
        files.copy_files_arr.forEach(file => {
            source_size += parseInt(file.size)
        })

        // LOOP OVER SELECTED FILES ARRAY
        // copy_files_arr.forEach((file, idx) => {
        files.copy_files_arr.forEach((file, idx) => {

            let source_folder = path.dirname(file.source)
            let source_filename = path.basename(file.source) // get filename

            console.log('copy files array ' + file.source)

            // CHECK IF SOURCE FILE EXISTS ? NOT SURE WHY ??
            // if (fs.existsSync(file.source) == true) {

                // IF SOURCE AND DESTINATION FOLDER ARE THE SAME THEN MAKE A COPY
                if (source_folder == destination_folder) {

                    // GET SOURCE FILE STATS
                    let stats = fs.statSync(file.source)

                    // notification('duplicate found ' + file.source + ' to ' + destination)

                    // DIRECTORY
                    if (stats.isDirectory()) {

                        // BUILD DESTINATION PATH
                        destination = destination_folder + '/' + source_filename.substr(0, source_filename.length - path.extname(source_filename).length) + ' Copy' + path.extname(source_filename)

                        // SET DESTINATION ROOT DIRECTORY
                        if (idx == 0) {
                            root = destination
                            console.log('root directory is ', root)
                        }

                        // COPY FOLDERS RECURSIVE
                        copyFolderRecursiveSync(file.source, destination)

                        // ADD FOLDER CARD
                        let folder_grid = document.getElementById('folder_grid')

                        // let folders_card = document.getElementById('folders_card')
                        folders_card.classList.remove('hidden')

                        let options = {

                            id: 'folder_card_' + idx,
                            href: destination,
                            linktext: path.basename(destination),
                            grid: folder_grid

                        }

                        try {

                            add_card(options).then(col => {

                                console.log(col)
                                console.log(folder_grid)
                                folder_grid.insertBefore(col, folder_grid.firstChild)

                                // // CLEAR INTERVAL
                                // clearInterval(interval_id)

                                // // UPDATE CARDS
                                // update_cards(folder_grid)

                                // RESET CARD INDE TO HANDLE LAZY LOADED IMAGES
                                cardindex = 0

                            })

                        } catch (err) {
                            notification(err)
                        }

                        update_cards(folder_grid)
                        clear_selected_files()

                    // FILE
                    } else {

                        // BUILD DESTINATION PATH
                        destination = destination_folder + '/' + source_filename.substr(0, source_filename.length - path.extname(source_filename).length) + ' Copy' + path.extname(source_filename)

                        // COPY FILE
                        fs.copyFile(file.source, destination, (err) => {

                            if (err) {

                                notification(err)

                            } else {

                                notification('copied file ' + destination)

                                let file_grid = document.getElementById('file_grid')
                                file_grid.classList.remove('hidden')

                                let options = {

                                    id: 'file_card_100000_' + idx,
                                    href: destination,
                                    linktext: path.basename(destination),
                                    grid: file_grid

                                }

                                try {

                                    add_card(options).then(col => {

                                        console.log('adding card')
                                        console.log('col ' + col)
                                        console.log('file grid ' + file_grid)
                                        file_grid.insertBefore(col, file_grid.firstChild)

                                        // RESET CARD INDE TO HANDLE LAZY LOADED IMAGES
                                        cardindex = 0

                                    })

                                } catch (err) {
                                    notification(err)
                                }

                                // UPDATE CARDS
                                update_cards(file_grid)
                                clear_selected_files()

                            }
                        })

                    }


                // NO DUPLICATES FOUND. COPY FILE / DIR
                } else {

                    console.log(file.source)

                    // todo: if selected files is greater than 1 then look at running rsync
                    let stats = fs.statSync(file.source)

                    // DIRECTORY
                    if (stats.isDirectory() == true) {

                        destination = destination_folder + '/' + source_filename.substr(0, source_filename.length - path.extname(source_filename).length) + path.extname(source_filename)
                        notification('dest ' + destination)

                        // IF DESTINATION FOLDER EXISTS CREATE COPY
                        if (fs.existsSync(destination)) {

                            let data = {
                                source: file.source,
                                destination: destination
                            }

                            ipcRenderer.send('show_confirm_dialog', data)
                            console.log("running here")

                            // ipcRenderer.send('confirm_overwrite', data)
                            // console.log(test)

                            // console.log('wawgawgawegawegaweg')

                            // destination = destination_folder + '/' + source_filename.substr(0, source_filename.length - path.extname(source_filename).length) + ' Copy' + path.extname(source_filename)
                            // copyFolderRecursiveSync(file.source, destination)

                            // ipcRenderer.on('overwrite_canceled', (e, res) => {
                            //     console.log(res)
                            //     hide_top_progress()
                            // })


                        } else {

                            copyFolderRecursiveSync(file.source, destination)

                            // ADD FOLDER CARD
                            let folder_grid = document.getElementById('folder_grid')

                            let folders_card = document.getElementById('folders_card')
                            folders_card.classList.remove('hidden')

                            let options = {

                                id: 'folder_grid_' + idx,
                                href: destination,
                                linktext: path.basename(destination),
                                grid: folder_grid

                            }

                            try {

                                add_card(options).then(col => {

                                    console.log(col)
                                    console.log(folder_grid)
                                    folder_grid.insertBefore(col, folder_grid.firstChild)


                                    // GET FOLDER_SIIZE
                                    ipcRenderer.send('get_folder_size', { href: destination })

                                    // COUNT ITEMS IN MAIN VIEW
                                    folder_count = get_folder_count()
                                    file_count = get_file_count()
                                    ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: folder_count, file_count: file_count })

                                    // RESET CARD INDE TO HANDLE LAZY LOADED IMAGES
                                    cardindex = 0

                                })

                            } catch (err) {
                                notification(err)
                            }

                        }



                    // FILES
                    } else {

                        // BUILD FILE NAME
                        destination = destination_folder + '/' + source_filename

                        // OVERWRITE IF EXISTS
                        if (fs.existsSync(destination)) {

                            let destination_stats = fs.statSync(destination)

                            let data = {
                                source: file.source,
                                destination: destination
                            }

                            // ipcRenderer.sendSync('confirm_overwrite_dialog', data)

                            // ipcRenderer.sendSync('show_confirm_message', data)

                            // ipcRenderer.on('what', (e, data) => {
                            //     console.log(data)
                            // })

                            // ipcRenderer.send('confirm_overwrite', data)

                            ipcRenderer.send('show_confirm_dialog', data)

                            // console.log('awhawehawehawehwshesrhsethsrh')

                            // ipcRenderer.on('overwrite_canceled', (e, res) => {
                            //     console.log(res)
                            //     hide_top_progress()
                            // })

                        // NEW FILE
                        } else {

                            // BUILD FILE NAME
                            destination = destination_folder + '/' + source_filename
                            notification('copying file to ' + destination)


                            // HANDLE PROGESS
                            progress.classList.remove('hidden')
                            progress.title = 'copying ' + source_filename
                            progress.max = source_size

                            let intervalid = setInterval(() => {

                                let destination_stats = fs.statSync(destination)
                                destination_size = destination_stats.size
                                progress.value = destination_size

                                // console.log('source size', source_size,'destination size', destination_size)
                                if (destination_size >= source_size) {
                                    clearInterval(intervalid)
                                    hide_top_progress()
                                }

                            }, 100)

                            // COPY FILE
                            fs.copyFile(file.source, destination, (err) => {


                                // RE BUILD FILENAME. ITS GETTING LOST IN THE LOOP.
                                destination = path.join(destination_folder, path.basename(file.source))
                                console.log('destination ' + destination)

                                let file_grid = document.getElementById('file_grid')

                                if (err) {
                                    console.log(err)
                                } else {

                                    // ADD CARD
                                    let options = {

                                        id: 'file_grid_' + idx,
                                        href: destination,
                                        linktext: path.basename(destination),
                                        grid: file_grid

                                    }

                                    try {

                                        add_card(options).then(col => {

                                            console.log(col)
                                            file_grid.insertBefore(col, file_grid.firstChild)

                                            // COUNT ITEMS IN MAIN VIEW
                                            folder_count = get_folder_count()
                                            file_count = get_file_count()
                                            ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: folder_count, file_count: file_count })

                                            // // CLEAR INTERVAL
                                            // clearInterval(interval_id)

                                            // // UPDATE CARDS
                                            // update_cards(file_grid)

                                            // RESET CARD INDE TO HANDLE LAZY LOADED IMAGES
                                            cardindex = 0

                                        })

                                    } catch (err) {
                                        notification(err)
                                    }

                                    // console.log('copying files from ' + source + ' to ' + target)

                                }

                                // UPDATE CARDS
                                update_cards(file_grid)

                            })

                        }

                    }

                }

            // }



        })

        // DONT THINK I NEED THIS ANYMORE MOVED THE COPY ARRAY TO MAIN
        clear_copy_arr()
        clear_selected_files()

    } else {
        notification('nothing to copy')
    }

})


// CONFIRM OVERWRITE DIALOG
ipcRenderer.on('confirming_overwrite', (e, data) => {
// function confirming_overwrite(data) {

    console.log('running confirming overwrite')

    // const childWindow = window.open('src/confirm.html')
    // childWindow.document.write('Hello')

    let confirm_dialog = document.getElementById('confirm')

    let source_stats = fs.statSync(data.source)
    let destination_stats = fs.statSync(data.destination)

    // let chk_replace_label = add_label('Apply this action to all files and folders')
    let chk_replace_div = add_checkbox('chk_replace', 'Apply this action to all files and folders')


    let btn_cancel = add_button('btn_cancel', 'Cancel')
    let btn_replace = add_button('btn_replace', 'Replace')
    let btn_skip = add_button('btn_skip', 'Skip')
    let icon = add_icon('info-circle')


    let confirm_msg = add_div()

    btn_replace.classList.add('primary')

    let source_data = ''
    let destination_data = ''
    let header = ''

    // DIRECTORY
    if (destination_stats.isDirectory()) {

        let description = ''
        if (destination_stats.mtime > source_stats.mtime) {
            description = '<p>A newer folder with the same name already exists in ' +
            'Meging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        }

        header = add_header('<br />Merge Folder:  ' + path.basename(data.source) + '<br /><br />')

        destination_data = add_p(
            description +
            add_header('Merge with').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )
        source_data = add_p(
            add_header('Original folder').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

    // FILE
    } else {

        let description
        if (destination_stats.mtime >= source_stats.mtime) {
            description = '<p>A newer file with the same name already exists in ' +
            'Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>'
        }

        header = add_header('<br />Replace File: <span>' + path.basename(data.source) + '</span><br /><br />')

        destination_data = add_p(
            description +
            add_header('Original file').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified:' + destination_stats.mtime +
            '<br />' +
            '<br />'
        )
        source_data = add_p(
            add_header('Replace with').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified:' + source_stats.mtime +
            '<br />' +
            '<br />'
        )

    }


    // HANDLE CHECKBOX
    let replace_all = add_div()
    let br = document.createElement('br')
    let br1 = document.createElement('br')
    replace_all.append(br)
    replace_all.append(br1)
    replace_all.append(chk_replace_div)


    confirm_dialog.append(header,destination_data,source_data,btn_cancel,btn_replace,btn_skip, replace_all)


    // CONFIRM BUTTON
    btn_replace.addEventListener('click', (e) => {
        ipcRenderer.send('overwrite_confirmed', data)
    })

    // CANCEL BUTTON
    btn_cancel.addEventListener('click', (e) => {
        ipcRenderer.send('overwrite_canceled')
    })

    // SKIP BUTTON
    btn_skip.addEventListener('click', (e) => {
        ipcRenderer.send('overwrite_canceled')
    })

    let chk_replace = document.getElementById('chk_replace')
    chk_replace.addEventListener('change', (e) => {
        alert(chk_replace.checked)
    })


})


// OVERITE COPY FILES
ipcRenderer.on('overwrite', (e, data) => {

    console.log('testing')

    let progress = document.getElementById('progress')


    let destination = data.destination
    let source = data.source

    console.log('destination ', destination, 'source', source)

    let destination_stats = fs.statSync(destination)
    let source_stats = fs.statSync(source)

    destination_size = destination_stats.size
    source_size = source_stats.size

    notification('overwriting file ' + destination)
    console.log('overwrite ', source, destination)

    if (destination_stats.isDirectory()) {
        copyFolderRecursiveSync(source,destination)
    } else {

        delete_file(destination).then(data => {

            // HANDLE PROGESS
            progress.classList.remove('hidden')
            progress.title = 'copying ' + source
            progress.max = source_size

            let intervalid = setInterval(() => {

                progress.value = destination_size

                // console.log('source size', source_size,'destination size', destination_size)
                if (destination_size >= source_size) {
                    clearInterval(intervalid)
                    hide_top_progress()
                }

            }, 100)

            // COPY FILE
            fs.copyFile(source, destination, (err) => {

                let file_grid = document.getElementById('file_grid')

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

                            console.log(col)
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
                update_cards(file_grid)

            })

        })

    }

})

// ON COPY COMPLETE
ipcRenderer.on('copy-complete', function (e) {
    get_files(breadcrumbs.value, { sort: localStorage.getItem('sort') })
})


// CONFIRMI OVERWRITE MOVE DIALOG
ipcRenderer.on('confirming_overwrite_move', (e, data) => {
// function confirming_overwrite(data) {

    console.log('running confirming move overwrite')



    let confirm_dialog = document.getElementById('confirm')

    let source_stats = fs.statSync(data.source)
    let destination_stats = fs.statSync(data.destination)

    // let chk_replace_label = add_label('Apply this action to all files and folders')
    let chk_replace_div = add_checkbox('chk_replace', 'Apply this action to all files and folders')


    let btn_cancel = add_button('btn_cancel', 'Cancel')
    let btn_replace = add_button('btn_replace', 'Replace')
    let btn_skip = add_button('btn_skip', 'Skip')
    let icon = add_icon('info-circle')


    let confirm_msg = add_div()

    btn_replace.classList.add('primary')

    let source_data = ''
    let destination_data = ''
    let header = ''

    // DIRECTORY
    if (destination_stats.isDirectory()) {

        let description = ''
        if (destination_stats.mtime > source_stats.mtime) {
            description = '<p>A newer folder with the same name already exists. ' +
            'Meging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        } else {
            description = '<p>An older folder with the same name already exists. ' +
            'Meging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        }

        header = add_header('<br />Merge Folder:  ' + path.basename(data.source) + '<br /><br />')

        destination_data = add_p(
            description +
            add_header('Merge with').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )
        source_data = add_p(
            add_header('Original folder').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
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
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )
        source_data = add_p(
            add_header('Replace with').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

    }


    // HANDLE CHECKBOX
    let replace_all = add_div()
    let br = document.createElement('br')
    let br1 = document.createElement('br')
    replace_all.append(br)
    replace_all.append(br1)
    replace_all.append(chk_replace_div)


    confirm_dialog.append(header,destination_data,source_data,btn_cancel,btn_replace,btn_skip, replace_all)


    // CONFIRM BUTTON
    btn_replace.addEventListener('click', (e) => {

        let chk_replace = document.getElementById('chk_replace')
        chk_replace.addEventListener('change', (e) => {
            alert(chk_replace.checked)
            if (chk_replace.checked) {

            } else {
                ipcRenderer.send('overwrite_move_confirmed', data)
            }
        })


    })

    // CANCEL BUTTON
    btn_cancel.addEventListener('click', (e) => {
        ipcRenderer.send('overwrite_move_canceled')
    })

    // SKIP BUTTON
    btn_skip.addEventListener('click', (e) => {
        ipcRenderer.send('overwrite_move_canceled')
    })


})


// OVERWRITE MOVE
ipcRenderer.on('overwrite_move', (e, data) => {

    console.log('testing')

    let progress = document.getElementById('progress')


    let destination = data.destination
    let source = data.source

    console.log('destination ', destination, 'source', source)

    let destination_stats = fs.statSync(destination)
    let source_stats = fs.statSync(source)

    destination_size = destination_stats.size
    source_size = source_stats.size

    notification('overwriting file ' + destination)
    console.log('overwrite ', source, destination)

    if (destination_stats.isDirectory()) {
        copyFolderRecursiveSync(source,destination)
    } else {

        // delete_file(destination).then(data => {

            // HANDLE PROGESS
            progress.classList.remove('hidden')
            progress.title = 'Moving ' + source
            progress.max = source_size

            let intervalid = setInterval(() => {

                progress.value = destination_size

                // console.log('source size', source_size,'destination size', destination_size)
                if (destination_size >= source_size) {
                    clearInterval(intervalid)
                    hide_top_progress()
                }

            }, 100)

            // COPY FILE
            fs.copyFile(source, destination, (err) => {

                console.log('copying file')

                let file_grid = document.getElementById('file_grid')

                if (err) {

                    console.log(err)

                } else {

                    // // REMOVE PREVIOUS CARD
                    // let card = document.querySelector('[data-href="' + source + '"]')
                    // let col = card.closest('.column')
                    // col.remove()

                    // // ADD CARD
                    // let options = {

                    //     id: 'file_grid_' + idx,
                    //     href: destination,
                    //     linktext: path.basename(destination),
                    //     grid: file_grid

                    // }

                    // try {

                    //     add_card(options).then(col => {

                    //         console.log(col)
                    //         file_grid.insertBefore(col, file_grid.firstChild)

                    //         // COUNT ITEMS IN MAIN VIEW
                    //         folder_count = get_folder_count()
                    //         file_count = get_file_count()

                    //         // RESET CARD INDE TO HANDLE LAZY LOADED IMAGES
                    //         cardindex = 0

                    //     })

                    // } catch (err) {
                    //     notification(err)
                    // }

                    delete_file(source)

                }

                // UPDATE CARDS
                update_cards(file_grid)

            })

        // })

    }

})


// ON MOVE CONFIRMED. todo: this needs work
ipcRenderer.on('move_confirmed', (e, data) => {

    let source = data.source
    let destination = data.destination

    console.log(destination,source)

    fs.copyFile(source,destination, (err) => {

        if (err) {
            console.log(err)

        } else {

            // REMOVE CARD
            let card = document.querySelector('[data-href="' + source + '"]')
            let col = card.closest('.column')
            col.remove()

            delete_file(source)

        }

    })

    // if (copy_files_arr.length > 0) {

    //     copy_files_arr.forEach((file, idx) => {

    //         let start_path = file.source
    //         let filename = path.basename(start_path)
    //         let destinationpath = path.join(destination, '/', filename)
    //         // let destination = path.join(destination, '/', filename)

    //         console.log('moving file from ' + path.basename(file.source) + ' to ' + path.basename(destination))
    //         notification('moving file from ' + file.source + ' to ' + destinationpath)

    //         if (start_path != destinationpath && start_path != '' && destinationpath != '') {

    //             console.log('running move to folder')

    //             let stats = fs.statSync(start_path)

    //             // DIRECTORY
    //             if (stats.isDirectory()) {

    //                 try {

    //                     console.log('copying folder from ' + start_path + ' to ' + destinationpath)

    //                     // COPY FOLDER
    //                     copyFolderRecursiveSync(start_path, destinationpath)

    //                     if (fs.existsSync(destinationpath)) {

    //                         // delete_folder(start_path)

    //                         // REMOVE CARD
    //                         let card = document.getElementById(file.card_id)
    //                         let col = card.closest('.column')
    //                         col.remove()
    //                     }



    //                 } catch (err) {
    //                     console.log(err)
    //                 }


    //             // FILE
    //             } else {

    //                 try {

    //                     // COPY FIE
    //                     // copyFileSync(start_path, destination)



    //                     fs.copyFile(start_path, destinationpath, (err) => {

    //                         if (err) {
    //                             console.log(err)
    //                         } else {

    //                             if (fs.existsSync(destinationpath)) {

    //                                 delete_file(start_path)
    //                                 console.log('file moved to ' + destinationpath)

    //                                 // REMOVE CARD
    //                                 let card = document.getElementById(file.card_id)
    //                                 let col = card.closest('.column')
    //                                 col.remove()

    //                             }

    //                         }

    //                     })


    //                 } catch (err) {
    //                     console.log(err)
    //                 }

    //             }


    //         //
    //         } else {

    //             if (fs.existsSync(destination)) {

    //                 // let data = {
    //                 //     source: start_path,
    //                 //     destination: destinationpath
    //                 // }


    //                 // ipcRenderer.send('show_confirm_dialog', data)


    //             }

    //         }

    //     })

    //     // CLEAR COPY ARRAY
    //     clear_copy_arr()
    //     clear_selected_files()

    // }



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

    // console.log(data)

    if (data.length > 0) {

        let status = document.getElementById('status')
        status.innerHTML = ''
        let disksize = add_div()
        let usedspace = add_div()
        let availablespace = add_div()
        let foldersize = add_div()
        let foldercount = add_div()
        let filecount = add_div()

        data.forEach(item => {

            disksize.innerHTML = '<div class="item">Disk size: <b>&nbsp' + item.disksize + '</b></div>'
            usedspace.innerHTML = '<div class="item">Used space: <b>&nbsp' + item.usedspace + '</b></div>'
            availablespace.innerHTML = '<div class="item">Available space: <b>&nbsp' + item.availablespace + '</b></div>'
            foldersize.innerHTML = '<div class="item">Folder Size: <b>&nbsp' + item.foldersize + '</b></div>'
            foldercount.innerHTML = '<div class="item">Folder Count: <b>&nbsp' + item.foldercount + '</b></div>'
            filecount.innerHTML = '<div class="item">File Count: <b>&nbsp' + item.filecount + '</b></div>'

            console.log('disk size ' + item.disksize)
            console.log('used space ' + item.usedspace)
            console.log('available space ' + item.availablespace)
            console.log('folder size ' + item.foldersize)

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

// ON FOLDER SIZE
ipcRenderer.on('folder_size', (e, data) => {

    console.log('href ' + data.href)
    console.log('setting local storage to ' + get_file_size(data.size))

    try {

        let card = document.querySelector('[data-href="' + data.href + '"]')
        let extra = card.querySelector('.extra')
        extra.innerHTML = get_file_size(data.size)

    } catch (err) {
        console.log(err)
    }

    // SET SIZE TO HREF IN LOCAL STORAGE
    localStorage.setItem(data.href, data.size)

})

//ON GIO VOLUMES
ipcRenderer.on('gio_volumes', (e, res) => {

    console.log('results ', res)

})

// ON GIO DEVICE
ipcRenderer.on('gio_devices', (e, res) => {

    let data = res.split('\n')

    console.log('running gio devices')

    // GET REFERENCE TO DEVICE GRID
    let device_grid = document.getElementById('device_grid')
    device_grid.innerHTML = ''

    let menu_items = add_div()
    menu_items.classList.add('ui', 'items')

    // CREATE VOLUMES ARRAY
    let volumes_arr = []

    data.forEach((item, idx) => {

        // CREATE VOLLUMES ARRAY
        if (item.indexOf('Volume(0):') > -1) {

            let split_item = item.split('->')

            console.log(item)

            let volume_obj = {
                idx: idx,
                volume: split_item[0]
            }

            volumes_arr.push(volume_obj)

        }

    })


    // LOOP OVER VOLUMES ARRAY
    // volumes_arr.forEach((item, idx) => {

    // GIO OBJECT
    let gio = {}
    let subitem_counter = 0
    let is_activationroot = 0
    // LOOP OVER VOLUMES
    for (let i = 0; i < volumes_arr.length; i++) {

        let volume = volumes_arr[i].volume
        gio.volume = volume.replace('Volume(0):', '').trim()

        // LOOP OVER GIO DATA AND GET SUB ITEMS
        data.forEach((subitem, subidx) => {

            // console.log('running ' + volumes_arr[i + 1].idx)
            let volumeidx = volumes_arr[i].idx
            let volumeidx2 = data.length

            // IF MORE THAN 1 VOLUME IS FOUND GET ITS INDEX TO USE AS FILTER
            if (i < volumes_arr.length - 1) {
                volumeidx2 = volumes_arr[i + 1].idx
            }

            let uuid = ''

            // IF ARRAY COUNTER IS BETWEEN 1ST AND SECOND
            if (subidx >= volumeidx && subidx <= volumeidx2) {

                // console.log('sub item', subitem)

                if (subitem.indexOf('activation_root=') > -1) {

                    uuid = subitem.replace('activation_root=', '').trim()
                    gio.uuid = uuid
                    // CREATE HREF ELEMENT
                    let href = document.createElement('a')
                    let icon = document.createElement('i')
                    let icon_phone = document.createElement('i')
                    let menu_item = add_div()
                    let content = add_div()

                    href.href = '#'

                    href.classList.add('block')
                    icon.classList.add('icon', 'bi-hdd')
                    icon.style.marginLeft = '15px'
                    icon_phone.classList.add('icon', 'mobile', 'alternate')
                    menu_item.classList.add('item')
                    content.classList.add('item')

                    // ADD DATA
                    // let uuid_path = uuid
                    href.dataset.uuid = uuid
                    href.text = gio.volume
                    href.addEventListener('click', (e) => {
                        ipcRenderer.send('mount_gio', gio)
                    })

                    menu_item.appendChild(icon_phone)
                    content.appendChild(href)
                    menu_item.appendChild(content)
                    menu_items.appendChild(menu_item)
                    device_grid.appendChild(menu_items)

                    // if (subitem.indexOf('default_location=') > -1) {

                    //     uuid = path.normalize(subitem.replace('default_location=file://', '').trim())
                    //     // gio.uuid = uuid
                    //     console.log('uuid')

                    // }

                    is_activationroot = 1
                    console.log('activation uuid', uuid)
                }

                if (subitem.indexOf('default_location=') > -1 && is_folder_card == 1) {

                    uuid = path.normalize(subitem.replace('default_location=file://', '').trim())

                    if (uuid.indexOf('sftp') === -1) {

                        // IF UUID CONTAINS DEFAULT_LOCATION. ONLY SHOW FIRST INSTANCE
                        if (uuid.indexOf('default_location=') > -1 && subitem_counter == 0) {

                            // CREATE HREF ELEMENT
                            let href = document.createElement('a')
                            let icon = document.createElement('i')
                            let icon_phone = document.createElement('i')
                            let menu_item = add_div()
                            let content = add_div()

                            href.href = '#'

                            href.classList.add('block')
                            icon.classList.add('icon', 'bi-hdd')
                            icon.style.marginLeft = '15px'
                            icon_phone.classList.add('icon', 'mobile', 'alternate')
                            menu_item.classList.add('item')
                            content.classList.add('item')

                            // ADD DATA
                            uuid = uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
                            href.dataset.uuid = uuid
                            href.text = gio.volume
                            href.addEventListener('click', (e) => {
                                get_files(uuid)
                            })

                            content.appendChild(href)
                            menu_item.appendChild(icon_phone)
                            menu_item.appendChild(content)
                            menu_items.appendChild(menu_item)

                            device_grid.appendChild(menu_items)

                            subitem_counter = 1

                        }

                        // IF UUID DOES NOT CONTAIN DEFAULT_LOCATION
                        if (uuid.indexOf('default_location=') === -1) {

                            // CREATE HREF ELEMENT
                            let href = document.createElement('a')
                            let icon = document.createElement('i')
                            let icon_phone = document.createElement('i')
                            let menu_item = add_div()
                            let content = add_div()

                            href.href = '#'

                            href.classList.add('block')
                            icon.classList.add('icon', 'bi-hdd')
                            icon.style.marginLeft = '15px'

                            icon_phone.classList.add('icon', 'mobile', 'alternate')
                            menu_item.classList.add('item')
                            content.classList.add('item')

                            // ADD DATA
                            uuid = uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
                            href.dataset.uuid = uuid
                            href.text = gio.volume
                            href.addEventListener('click', (e) => {
                                get_files(uuid)

                            })

                            menu_item.appendChild(icon)
                            content.appendChild(href)
                            menu_item.appendChild(content)
                            menu_items.appendChild(menu_item)

                            device_grid.appendChild(menu_items)

                        }

                        console.log('index ', subidx, 'uuid', uuid)
                        console.log('default loc uuid', uuid)
                    }

                }

                // // IF ACTIVATION ROOT THEN ANDROID
                // if (subitem.indexOf('activation_root=') > -1) {

                //     // console.log(subitem + ' ' + subidx)
                //     uuid = subitem.replace('activation_root=', '').trim()
                //     gio.uuid = uuid

                //     // CREATE HREF ELEMENT
                //     let href = document.createElement('a')
                //     let icon = document.createElement('i')
                //     let icon_phone = document.createElement('i')
                //     let menu_item = add_div()
                //     let content = add_div()

                //     href.href = '#'

                //     href.classList.add('block')
                //     icon.classList.add('icon', 'hdd')
                //     icon_phone.classList.add('icon', 'mobile', 'alternate')
                //     menu_item.classList.add('item')
                //     content.classList.add('item')

                //     is_activationroot = 1

                //     // ADD DATA
                //     let uuid_path = gio.uuid
                //     href.dataset.uuid = uuid_path
                //     href.text = gio.volume
                //     href.addEventListener('click', (e) => {
                //         ipcRenderer.send('mount_gio', gio)
                //     })

                //     menu_item.appendChild(icon_phone)
                //     content.appendChild(href)
                //     menu_item.appendChild(content)
                //     menu_items.appendChild(menu_item)
                //     device_grid.appendChild(menu_items)

                //     if (subitem.indexOf('default_location=') > -1) {

                //         let uuid = path.normalize(subitem.replace('default_location=file://', '').trim())
                //         gio.uuid = uuid
                //         console.log('uuid')

                //     }

                // }

                // if (subitem.indexOf('default_location=') > -1 && is_folder_card == 1) {

                //     // CREATE HREF ELEMENT
                //     let href = document.createElement('a')
                //     let icon = document.createElement('i')
                //     let icon_phone = document.createElement('i')
                //     let menu_item = add_div()
                //     let content = add_div()

                //     href.href = '#'

                //     href.classList.add('block')
                //     icon.classList.add('icon', 'hdd')
                //     icon_phone.classList.add('icon', 'mobile', 'alternate')
                //     menu_item.classList.add('item')
                //     content.classList.add('item')


                //     if (uuid.indexOf('sftp') === -1) {
                //         console.log('default loc uuid', uuid)

                //         uuid = path.normalize(subitem.replace('default_location=file://', '').trim())
                //         gio.uuid = uuid


                //         // IF UUID CONTAINS DEFAULT_LOCATION. ONLY SHOW FIRST INSTANCE
                //         if (gio.uuid.indexOf('default_location=') > -1 && subitem_counter == 0) {

                //             // ADD DATA
                //             let uuid_path = gio.uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
                //             // let uuid_path = gio.uuid
                //             href.dataset.uuid = uuid_path
                //             href.text = gio.volume
                //             href.addEventListener('click', (e) => {
                //                 get_files(uuid_path)
                //             })

                //             menu_item.appendChild(icon_phone)
                //             content.appendChild(href)
                //             menu_item.appendChild(content)
                //             menu_items.appendChild(menu_item)

                //             subitem_counter = 1

                //         }

                //         // IF UUID DOES NOT CONTAIN DEFAULT_LOCATION
                //         if (gio.uuid.indexOf('default_location=') === -1) {

                //             // ADD DATA
                //             let uuid_path = gio.uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
                //             href.dataset.uuid = gio.uuid
                //             href.text = gio.volume
                //             href.addEventListener('click', (e) => {
                //                 get_files(uuid_path)

                //             })

                //             menu_item.appendChild(icon)
                //             content.appendChild(href)
                //             menu_item.appendChild(content)
                //             menu_items.appendChild(menu_item)

                //         }

                //         console.log('index ', subidx, 'uuid', gio.uuid)
                //         device_grid.appendChild(menu_items)

                //     }


                // }

            }

        })

    }



})

// ON GIO MOUNTED
ipcRenderer.on('gio_mounted', (e, data) => {

    console.log('data ' + data)

    let path = ''
    if (data.indexOf('mounted at') > -1) {

        path = data.substring(
            data.indexOf("`") + 1,
            data.lastIndexOf("'")
        );

        if (path == '') { path = '/run/user/1000/gvfs' }
        get_files(path)

        console.log('path ' + path)

    } else {
        console.log('ohhhh nooooooo!')
    }

    if (data.indexOf('mounted at') > -1) {

    }

    if (data.indexOf('already mounted') > -1) {
        get_files('/run/user/1000/gvfs', { sort: localStorage.getItem('sort'), page: 1 })
    }

    let str_arr = data.split(' ')
    console.log(str_arr)
    str_arr.forEach((item, idx) => {

        let direcotry = item.replace(".", "").replace("'", "").replace("`", "")

        if (item.indexOf('already mounted') != -1) {

            if (idx == 8) {

                // let direcotry = item.replace(".","").replace("'","").replace("`","")

                direcotry = item.replace(".", "").replace("'", "").replace("`", "")
                console.log(direcotry)
                get_files(direcotry.trim(), { sort: localStorage.getItem('sort'), page: localStorage.getItem('page') })
            }


            // console.log(direcotry)
            // get_files(direcotry.trim(), {sort: localStorage.getItem('sort'), page: localStorage.getItem('page')})

            // get_files(path, {sort: localStorage.getItem('sort')})

        } else {
            // console.log()
        }
    })

})

// ON GIO MONITORED
ipcRenderer.on('gio_monitor', (e, data) => {

    console.log(data)

    let device_grid = document.getElementById('device_grid')
    device_grid.innerHTML = ''

    // ipcRenderer.send('get_gio_devices')

})

// ON GIO FILES
ipcRenderer.on('gio_files', (e, data) => {

    console.log(data.res)

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

        console.log(options)

        try {

            add_card(options).then(card => {

                console.log(card)
                folder_grid.insertBefore(card, folder_grid.firstChild)

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

// ON DELETE CONFIRMED
ipcRenderer.on('delete_file_confirmed', (e, res) => {

    delete_confirmed()

})

// ON CREATE FILE FROM TEMPLATE
ipcRenderer.on('create_file_from_template', function (e, file) {
    console.log('im running too many times')
    create_file_from_template(file.file)

})

// ON DEVICES
ipcRenderer.on('devices', (e, args) => {
    console.log('what the ' + args)
})

// // PROPERTIES WINDOW
// ipcRenderer.on('file_properties_window', (e,data) => {
//     get_file_properties(source)
// })

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
    container.classList.remove('hidden')
    container.innerHTML = ''
    container.innerHTML = msg
}

// NOTIFICATIONS
function notification(msg) {

    console.log(msg)

    notice(msg)
    info(msg)

    let status = document.getElementById('notification')
    let msg_div = add_div()

    // status.style = 'overflow:auto'
    msg_div.style = 'overflow:auto; margin-bottom: 10px;'

    msg_div.innerHTML = ''
    msg_div.innerHTML = msg


    // status.innerHTML = ''
    status.appendChild(msg_div)

    // let card = add_card(options)
    // column.appendChild(card)
    status.insertBefore(msg_div, status.firstChild)

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

// FILE PROPERTIES WINDOW
async function get_file_properties(filename) {

    let stats = fs.statSync(filename)

    console.log('source ' + stats)

    // properties_modal = document.getElementById('properties_modal')
    // properties_modal.classList.remove('hidden')
    // properties_modal.classList.add('active', 'visible')

    let properties_grid = document.getElementById('properties_grid')

    // BUILD PROPERTIES
    let name = path.basename(filename)
    let parent_folder = path.basename(filename)
    let type = stats.isDirectory()
    let modified = stats.mtime
    let crerated = stats.ctime

    properties_grid.innerHTML = name

}


// function getprogress(copy_files_arr) {

//     alert(copy_files_arr.length)

//     copy_files_arr.forEach(file => {

//         console.log('progress copy file array',file.source)

//     });

// }


function get_progress(source_size, destination_file, c) {

    let progress = document.getElementById('progress')
    progress.classList.remove('hidden')

    // GET STATS
    let stats = fs.statSync(destination_file)
    console.log('dest size', stats.size, 'destination', destination_file)

    // DIRECTORY
    if (stats.isDirectory()) {

        ipcRenderer.send('get_folder_size', { href: destination_file })
        ipcRenderer.on('folder_size', (e, data) => {

            current_size = data.size
            transfer_speed = get_transfer_speed(source_size, current_size, c)

            if (progress) {

                progress.value = current_size

                if (current_size >= source_size) {

                    // HIDE PROGRESS BAR
                    hide_progress()

                    // CLEAR TIMER INTERVAL
                    clearInterval(intervalid)
                    console.log('clearing interval',interval_id)

                }



            }

        })

    // FILE
    } else {

        current_size = stats.size
        transfer_speed = get_transfer_speed(source_size, current_size, c)

        if (progress) {

            progress.value = current_size

            if (parseInt(current_size) >= parseInt(source_size)) {

                // HIDE PROGRESS BAR
                hide_progress()

                // CLEAR TIMER INTERVAL
                clearInterval(interval_id)
                console.log('clearing interval',interval_id)

            }

        }

    }

}


// GET FILE TYPE
function get_mime_type(source) {

    let filepath = path.dirname(source)
    let filename = path.basename(source)

    // note: cmd needs to have this format. do not change "" for command and '' for path.
    let cmd = "xdg-mime query filetype '" + path.join(filepath, filename) + "'"

    console.log(cmd)
    let filetype = exec(cmd)

    filetype.on.stdout('data', data => {
        return data
    })

    // return filetype.toString().replace(/^\s+|\s+$/g, '')

}


// GET AVAILABLE LAUNCHERS
function get_available_launchers(filetype) {

    let launchers = []
    try {

        let cmd = "grep '" + filetype + "' /usr/share/applications/mimeinfo.cache"

        let desktop_launchers = execSync(cmd).toString().replace(filetype + '=', '').split(';')

        // const maptest = desktop_launchers.map(x => x.indexOf('Name=') > -1)
        // console.log('maptest ' + maptest)

        // maptest.forEach((item, idx) => {
        //     console.log('item ' + item)
        // })

        // console.log('filetype ' + desktop_launchers)
        // let searchStr = 'Exec='
        // let test = desktop_launchers.filter(x => x ==)

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
                // .split(';')

                console.log('source = ' + source)
                console.log('desktop launcher = ' + desktop_launchers[i])
                console.log('exec path = ' + exec_path[0].replace('Exec=', ''))
                console.log('name = ' + exec_name[0].replace("Name=", ""))
                console.log('mimetype = ' + exec_mime)

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
            // console.log('name ' + launcher + ' ' + exe_path)

        }

    } catch (err) {
        console.log(err)
    }



    return launchers

    //     let launchers = []
    //     for(let i = 0; i < desktop_launchers.length - 1; i++) {

    //         let name = desktop_launchers[i]
    //         let filepath = path.join('/usr/share/applications', name)

    //         console.log(filepath)

    //         let exec

    //         try {

    //             let desktop_file = fs.readFileSync(filepath, 'utf8').split('\n')
    //             desktop_file.forEach((items, idx) => {

    //                 console.log('item = ' + items)

    //                 if (items.indexOf('Name=') !== -1){
    //                     name = items.replace('Name=', '')
    //                 }

    //                 if (items.indexOf('Exec=') !== -1) {
    //                     exec = items.replace('Exec=','')
    //                     console.log(exec)
    //                 }

    //             })


    //             // desktop_file = desktop_file.split('=')



    //             let options = {
    //                 name: name,
    //                 icon:'',
    //                 exec: exec,
    //             }

    //             launchers.push(options)


    //         } catch (err) {
    //             console.log('error ' + err)
    //         }


    //     }

    //     return launchers

    // } catch (err) {

    //     return err

    // }

}

// SET DEFAULT LAUNCHER
function set_default_launcher(desktop_file, mimetype) {

    // xdg-mime default vlc.desktop
    let cmd = 'xdg-mime default ' + desktop_file + ' ' + mimetype
    console.log(cmd)

    try {
        execSync(cmd)
    } catch (err) {
        notification(err)
    }

}


// GET NETWORK
async function get_network() {

    let network_grid = document.getElementById('network_grid')
    network_grid.innerHTML = ''

    let menu_items = add_div()
    menu_items.classList.add('ui', 'items')

    let dir = '/run/user/1000/gvfs/'

    fs.readdir(dir, function (err, files) {

        if (err) {
            console.log(err)
        } else {

            console.log('network length ' + files.length)
            if (files.length > 0) {

                files.forEach((file, idx) => {

                    let filename = path.join('/run/user/1000/gvfs/', file)

                    // CREATE HREF ELEMENT
                    let href = document.createElement('a')
                    let icon = document.createElement('i')
                    let icon_phone = document.createElement('i')
                    let menu_item = add_div()
                    let content = add_div()
                    // let hr = add_div()

                    href.href = filename
                    href.text = file
                    href.dataset.uuid = filename
                    // href.preventDefault = true

                    // hr.classList.add('ui','horizontal','divider')
                    href.classList.add('block', 'header_link')
                    icon.classList.add('icon', 'hdd')
                    icon.style.marginLeft = '15px'
                    icon_phone.classList.add('icon', 'mobile', 'alternate')
                    menu_item.classList.add('item')
                    content.classList.add('item')

                    menu_item.appendChild(icon)
                    content.appendChild(href)
                    menu_item.appendChild(content)
                    menu_items.appendChild(menu_item)

                    // network_grid.appendChild(hr)
                    network_grid.appendChild(menu_items)

                    href.addEventListener('click', (e) => {
                        get_files(filename)
                    })


                })

            }

        }

        update_cards(network_grid)

    })



}


// START DRAG
function startDrag(href) {
    ipcRenderer.send('ondragstart', href)
}

// function run_progress_decompree(){}

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

// PROGRESS
// function run_progress(href) {

//     console.log('running ')

//     let c = 0
//     let stats
//     let stats1
//     let size
//     let size1
//     let href_stats = fs.statSync(source)
//     let href_size = href_stats.size

//     // if (path.extname === '.gz') {
//         // ipcRenderer.send('get_uncompressed_size', href)
//     //     ipcRenderer.on('uncompressed_size', (e, data) => {
//     //         href_size = data
//     //         console.log('href_size ' + href_size)
//     //     })
//     // }

//     // GET SIZE OF UNCOMPRESSED FILE
//     href_size = execSync("gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'")

//     // THIS NEEDS TO BE HREF
//     // href = execSync("gzip -Nl '" + source + "' | awk 'FNR==2{print $4}'")


//     console.log('href size ' + href_size)
//     console.log('href ' + href)
//     // console.log('progress source is ' + href.toString().replace('.tar',''))


//     // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
//     let progress_file_card = document.getElementById('progress_' + card_id)
//     let progress_bar = document.getElementById('progress_bar_' + card_id)

//     progress_file_card.classList.remove('hidden')

//     var interval_id = setInterval(() => {

//         // href = href.toString().replace('.tar','')
//         ipcRenderer.send('get_folder_size', {href: href})
//         ipcRenderer.on('folder_size', (e, data) => {

//             let folder_size = data.size
//             console.log('folder size ' + folder_size)


//         let file_exists = fs.existsSync(href)

//         // COUNT ELAPSED SECONDS
//         c = c + 1

//         if (file_exists) {

//             // // SET PREVIOUS STATS
//             // stats1 = stats
//             // // SET NEW STATS
//             // stats = fs.statSync(href)
//             size1 = size
//             size = href_size


//             // LET STATS1 GET POPULATED
//             if (c > 1) {

//                 // EXIT INTERVAL IF FILE SIZE DOESNT CHANGE
//                 // if (stats1.size == stats.size) {
//                 //     progress_file_card.classList.add('hidden')
//                 //     clearInterval(interval_id)
//                 // }
//                 if (size1 == size) {
//                     progress_file_card.classList.add('hidden')
//                     clearInterval(interval_id)
//                 }

//             }

//             // CALCULATE TRANSFER RATE
//             // let transferspeed = stats.size / c
//             let transferspeed = href_size / c
//             let transfer_time =  folder_size / transferspeed
//             let transfer_data_amount = transferspeed * transfer_time


//             // CHECK PROGRESS
//             console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
//             console.log('transfer time is  ' + Math.floor(data.size))
//             console.log('data transfer amount is ' + get_file_size(transfer_data_amount))


//             // UPDATE PROGRESS
//             if (c < 4) {

//                 if (fs.statSync(href).isDirectory() === true) {

//                     console.log('running ' + href + '....................')

//                     ipcRenderer.send('get_folder_size', { dir: href })
//                     ipcRenderer.on('folder_size', (e, data) => {

//                         console.log('data size ' + data.size + ' transferspeed ' + transferspeed)

//                         transfer_time = data.size / transferspeed
//                         // progress_bar.max = Math.floor(transfer_time)
//                         progress_bar.max = Math.floor(data.size)

//                         info('transfer speed is  ' + get_file_size(transferspeed) + ' /s')

//                         // // CHECK PROGRESS
//                         // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
//                         // console.log('transfer time is  ' + Math.floor(transfer_time))
//                         // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

//                     })

//                 } else {

//                     console.log('setting progress max to ' + Math.floor(transfer_time))
//                     progress_bar.max = Math.floor(folder_size)



//                     info('transfer speed is  ' + get_file_size(transferspeed) + ' /s')

//                     // // CHECK PROGRESS
//                     // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
//                     // console.log('transfer time is  ' + Math.floor(transfer_time))
//                     // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

//                 }

//             }

//             if (progress_bar) {
//                 console.log('progress value is ' + get_file_size(c))
//                 progress_bar.value = c
//             }

//             // // CHECK PROGRESS
//             // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
//             // console.log('transfer time is  ' + Math.floor(data.size))
//             // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

//         }

//     })


//     }, 1000);

// }


// GET FILE FROM INPUT
async function get_file_from_input() {

    let input = document.getElementById('files')
    let file = input.files[0]

}


var cardindex = 0

// ADD CARD //////////////////////////////////////////////////////////////////////
async function add_card(options) {

    try {

        //
        // network-server-symbolic.svg
        let id = options.id
        let href = options.href
        let linktext = options.linktext
        let icon_path = get_icon_path(href) //options.image
        let is_folder = options.is_folder

        // STATS
        // let stats = '' //fs.lstatSync(options.href)
        // let is_folder = 0 //stats.isDirectory() //options.is_directory
        // let mtime = '' //new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime) //options.description


        // CHECK IF GVFS
        // let is_gvfs = 0
        // let gvfs = href.indexOf('/gvfs') // -1 is false
        // if (gvfs > -1) {
        //     is_gvfs = 1
        // }

        // GET START TIME OF STATS
        // let stats_st = new Date().getTime()
        // try {
        //     stats = fs.statSync(options.href)
        //     is_folder = stats.isDirectory() //options.is_directory
        //     mtime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime) //options.description
        // } catch (err) {
        //     console.log(err)
        // }

        // SEE HOW LONG STATS ARE TAKING
        // let stats_et = new Date().getTime() - stats_st
        // console.log('getting stats elapsed time ' + stats_et)

        let size = '' //options.size
        let grid = options.grid

        // CREATE ELEMENTS
        let col = add_div()
        let card = add_div()
        let items = add_div()
        let item = add_div()
        let image = add_div()
        let img = document.createElement('img')
        let content = add_div()
        let extra = add_div()
        let progress = add_div()
        let progress_bar = add_progress()
        let header = document.createElement('a')
        let input = document.createElement('input')
        let form_field = add_div()
        let popovermenu = add_div()

        let form_control = add_div()
        let form = document.createElement('form')


        // ADD CSS
        input.setAttribute('required', 'required')
        col.classList.add('column', 'three', 'wide')
        popovermenu.classList.add('popup')
        card.classList.add('ui', 'card', 'fluid', 'nav_item')
        card.draggable = 'true'


        card.id = id
        card.dataset.href = href
        card.tabIndex = cardindex
        input.autocomplete = true


        // SET INDEX FOR NAVIGATION
        if (grid.id == 'folder_grid' || grid.id == 'file_grid') {
            cardindex += 1
            card.dataset.id = cardindex
        }

        // CHECK IF IMAGE
        if (

            path.extname(href) === '.png' ||
            path.extname(href) === '.jpg' ||
            path.extname(href) === '.svg' ||
            path.extname(href) === '.gif' ||
            path.extname(href) === '.webp' ||
            path.extname(href) === '.jpeg'

        ) {
            img.classList.add('img')
            img.style = 'border: 2px solid #cfcfcf; background-color: #cfcfcf'
        } else {
            // img.classList.add(img, 'efm-icon')
        }

        // CREATE ITEMS
        items.classList.add('ui', 'items')

        // CREATE ITEM
        item.classList.add('item', 'fluid')

        // CREATE IMAGE CONTAINER
        image.classList.add('image')
        // image.style = 'width:36px; height:36px;cursor:pointer'


        // CREATE IMAGE
        img.draggable = false

        if (grid.id == 'folder_grid') {

            // img.classList.add('tree_subicon')
            img.src = get_icon_path(href)


        } else if (grid.id == 'search_results' || grid.id == 'workspace_grid') {

            card.style.marginLeft = '15px'
            img.classList.add('workspace_icon')
            img.src = get_icon_path(href)

        } else {

            if (cardindex > 1) {

                img.src = path.join(icon_dir, '/actions/scalable/image-x-generic-symbolic.svg')
                img.dataset.src = icon_path
                img.classList.add('lazy')

            } else {

                img.src = icon_path

            }

        }

        /////////////////////////////////////////////////////////////

        let cardclick_st = new Date().getTime()

        // CARD CLICK
        card.addEventListener('click', function (e) {

            e.preventDefault()
            e.stopPropagation()

            // ADD ITEM TO CLIPBOARD FOR IMAGES THIS WILL NEED TO CHANGE
            // let clipboard_image = nativeImage.createFromPath(href)
            // clipboard.writeImage(clipboard_image, "clipboard")


            // CRTRL+SHIFT ADD TO WORKSPACE
            if (e.ctrlKey == true && e.shiftKey == true) {

                notification('ctrl + shift clicked')
                add_workspace()

                // MULTI SELECT
            } else if (e.ctrlKey == true) {

                notification('ctlr pressed')

                // CHECK IF ALREADY SELECTED
                if (this.classList.contains('highlight_select')) {

                    // REMOVE HIGHLIGHT
                    this.classList.remove('highlight_select')

                } else {

                    // ADD HIGHLIGHT
                    this.classList.add('highlight_select')

                }


                // SINGLE SELECT
            } else {

                clear_selected_files()

                // HIGHLIGHT
                if (this.classList.contains('highlight_select')) {

                    // remove_selected_file(href)
                    this.classList.remove('highlight_select')

                    //
                } else {

                    notification('selected ' + href)

                    // NAV COUNTER
                    nc = parseInt(card.dataset.id)
                    console.log('counter ' + nc)

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

        let cardclick_et = new Date().getTime() - cardclick_st
        // console.log('cardclick elapsed time ' + cardclick_et)


        // // LISTEN FOR CONTEXT MENU. LISTEN ONLY DONT SHOW A MENU HERE !!!!!!
        card.addEventListener('contextmenu', function (e) {

            // SET GLOBAL CARD_ID
            console.log('setting global card_id to ' + card.id)
            card_id = card.id

            // todo: this needs work add selected files here has unintended results
            // !! DO NOT USE ADD_SELECTED_FILES HERE. YOU MIGHT DELETE SOMETHING IMPORTANT!!!
            source = href

            if (e.ctrlKey == true) {

            } else {

                clear_selected_files()
            }

            if (is_folder) {

                // SHOW FOLDER MENU
                card.classList.add('folder_card', 'highlight_select')

            } else {

                // SHOW FILE MENU
                card.classList.add('file_card', 'highlight_select')

            }

        })



        // MOUSE OVER
        let timeoutid
        card.addEventListener('mouseover', function (e) {

            e.preventDefault()

            // SET GLOBAL CARD ID ON HOVER
            // todo: this needs to be vetted
            card_id = id


            // HIGHLIGHT CARD timeoutid = setTimeout(() => {
            card.classList.add("highlight")

            nc = nc2
            nc2 = parseInt(card.dataset.id)

        })


        //  OUT
        card.addEventListener('mouseout', function (e) {

            let cards = document.getElementsByClassName('card')
            for (let i = 0; i < cards.length; i++) {
                cards[i].classList.remove('highlight')
            }

        })


        // IMG CLICK
        img.addEventListener('click', function (e) {

            e.preventDefault()

            if (is_folder) {
                // window.loaddata(href)
                get_files(href, options)
            } else {
                shell.openPath(href)
            }

        })

        // IMG MOUSE OVER
        img.addEventListener('mouseover', function (e) {
            e.preventDefault()
            if (is_folder) {
                // this.src = '../assets/icons/korla/places/scalable/gnome-folder.svg'
                // img.src = path.join(icon_dir, '/places/scalable/folder-black-drag-accept.svg')
            } else {
                // img.style = 'background-color:rgb(0, 0, 0);'
            }

        })

        img.addEventListener('mouseout', (e) => {
            e.preventDefault()
            img.src = icon_path
        })

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


        // HEADER MOUSE OVER
        header.addEventListener('mouseover', function (e) {

            if (is_folder) {

                card_id = id
                img.src = path.join(icon_dir, '/places/scalable/folder-black-drag-accept.svg')
            }

        })

        header.addEventListener('mouseout', function (e) {
            img.src = icon_path
        })

        form_field.classList.add('one', 'fields')

        // FOR EDIT MODE
        input.id = 'edit_' + id
        input.classList.add('hidden', 'input')
        input.type = 'text'
        input.value = linktext


        // selrange.moveEnd(href.length - path.extname(href).length)


        // CHANGE EVENT
        input.addEventListener('change', function (e) {

            e.preventDefault()

            console.log(this.required)

            // todo: this needs a lot of input checking

            if (this.value == "") {

                alert('need a name bro')

            } else {

                card.classList.add('highlight_select')

                // RENAME FILE
                rename_file(href, path.dirname(href) + '/' + this.value.trim())

                this.classList.add('hidden')

                href = path.dirname(href) + '/' + this.value
                card.dataset.href = href

                header.classList.remove('hidden')
                header.text = this.value
                header.href = href
                header.title = 'open file? ' + path.dirname(href) + '/' + this.value

                console.log('linktext ' + linktext + ' setting source to ' + this.value)
                source = path.dirname(href) + '/' + this.value.trim()
                header.focus()

                clear_selected_files()

            }

        })

        // KEYDOWN EVENT
        input.addEventListener('keydown', function (e) {

            if (e.key === 'Escape' || e.key === 'Tab') {

                // CLEAR ITEMS
                console.log('esc pressed on keydown')
                clear_selected_files()

                // CLEAR COPY ARRAY
                copy_files_arr = []

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
        // description.innerHTML = mtime
        description.draggable = false


        extra.classList.add('extra')
        extra.innerHTML = size
        extra.draggable = false

        progress.id = 'progress_' + id
        progress.classList.add('hidden', 'progress')

        progress_bar.id = 'progress_bar_' + id
        progress_bar.value = '1'
        progress_bar.max = '100'

        // let c = 9
        // const regex = /^\..*/


        // ON DRAG START
        card.ondragstart = function (e) {

            console.log('on drag start')

            var f = new File([""], linktext, { type: mime.lookup(href), lastModified: '' })
            // console.log(file_obj)
            // console.log('generated file ' + file_obj[0])

            // const blob = new Blob(files, {type:"text/plain"})
            // const file = new File([blob], href, {type: "text/plain"})
            // const filedata = new filedata()

            console.log(f)
            e.dataTransfer.items.add(f)
            // e.dataTransfer.setData("DownloadURL", "application/octet-stream:" + href + ".bin:data:application/octet-stream;base64");

            if (e.ctrlKey) {
                console.log('ctrl pressed')
                e.dataTransfer.effectAllowed = 'copy'
            } else {
                e.dataTransfer.effectAllowed = 'copyMove'
            }


            // var datalist = e.dataTransfer.items
            // datalist.add(href, 'text/uri-list')

            let items = document.querySelectorAll('.highlight,.highlight_select')
            // console.log('i am ', items.length)
            if (items.length > 0) {
                items.forEach((item,idx) => {

                    let href = item.dataset.href
                    let id = item.dataset.id
                    add_copy_file(href, id)
                    console.log('size', items,length, 'href', href)

                })
            }

            // add_copy_file(href, id)

        }

        // INITIALIZE COUNTER
        let dragcounter = 0

        // ON DRAG ENTER
        card.ondragenter = function (e) {

            dragcounter++

            let target = e.target
            notification('running card on dragenter ' + target.id)

            // CARD. NOTE. THIS SEEMS BACKWARDS BUT WORKS AND IS ESSENTIAL FOR SETTING THE CORRECT TARGET PATH. NOT SURE WHY ??
            if (target.id == "") {
                destination = href
                // card.classList.add('highlight_select')

                // BLANK
            } else {

                destination = breadcrumbs.value

            }

            notification('setting destination ' + destination)

            if (e.ctrlKey) {
                console.log('ctrl pressed')
                e.dataTransfer.dropEffect = 'copy'
            } else {
                e.dataTransfer.dropEffect = 'copyMove'
            }

            // SET DRAGGABLE ON MAIN VIEW TO FALSE
            notification('setting draggable to false on main view')
            let main_view = document.getElementById('main_view')
            main_view.classList.add('selectableunselected')
            main_view.draggable = false

            e.preventDefault()
            e.stopPropagation()

        }

        // DRAG OVER
        card.ondragover = function (e) {

            // ADD HIGHLIGHT
            card.classList.add('highlight_select')

            e.preventDefault()
            e.stopPropagation()

            if (e.ctrlKey) {
                console.log('ctrl pressed')
                e.dataTransfer.dropEffect = 'copy'
            } else {
                e.dataTransfer.dropEffect = 'copyMove'
            }

            return false

        }

        // ON DRAG LEAVE
        card.ondragleave = function (e) {

            dragcounter--

            card.classList.remove('highlight_select')

            if (dragcounter === 0) {


                // TURN DRAGGABLE ON MAIN CARD ON
                notification('setting draggable to true on main view')

                // card.classList.remove('highlight_select')

                let main_view = document.getElementById('main_view')

                // main_view.draggable = true

                notification('running on drag leave card')

            }

            e.preventDefault()
            e.stopPropagation()


        }

        // console.log(card)

        card.appendChild(items)
        items.appendChild(item)
        item.appendChild(image)
        image.appendChild(img)
        item.appendChild(content)
        item.appendChild(popovermenu)
        content.appendChild(header)
        content.appendChild(form_control)
        content.appendChild(description)

        progress.appendChild(progress_bar)

        content.appendChild(extra)
        content.appendChild(progress)

        col.appendChild(card)
        grid.appendChild(col)


        return await col


    } catch (err) {
        return err
    }

}


// SHOW LOADER
function show_loader() {

    let loader = document.getElementById("loader")
    loader.classList.add('active')

    setTimeout(() => {

        // console.log(loader.classList.contains('active'))
        // alert('Oh no. Operation timed out!')

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

    let section = add_link()
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
        pager.html = ''
        get_files(options.dir, { sort: localStorage.getItem('sort'), page: options.name })
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

    // cmd = 'cd "' + filename + '"; du -s'
    let child = exec(cmd)

    //
    child.stdout.on("data", (du_data) => {

        let du_grid = document.getElementById('du_grid')
        du_grid.innerHTML = ''
        // let du = du_data.split('\t')
        let du = du_data.split('\n')

        for (let i = 0; i < du.length; i++) {

            console.log(du[i])

            let du_col = add_div()


            du_col.innerHTML = du[i] + '</br></br>'
            du_grid.appendChild(du_col)

        }

        // console.log(du_data)

        //     options.size = get_file_size(size)

        //     let card = add_card(options,i)
        //         let files_col = add_div()
        //         files_col.classList.add('column', 'three', 'wide')
        //         files_col.appendChild(card)
        //         folder_grid.appendChild(files_col)

    })


}

// PAGER
function paginate(array, page_size, page_number) {
    // human-readable page numbers usually start with 1, so we reduce 1 in the first argument
    return array.slice((page_number - 1) * page_size, page_number * page_size);
}

// ADD TREE ITEM
function add_tree_item(options) {

    let filename = options.linktext
    let filepath = options.href

    // console.log(path.dirname(filepath))

    let items = add_div()
    let item = add_div()
    let header = add_div()
    let icon_div = add_div()
    let icon = document.createElement('i')
    let subicon_div = add_div()
    let subicon = document.createElement('i')
    let href = document.createElement('a')
    let content = add_div()
    let subitems = add_div()


    // icon.classList.add('angle', 'right', 'large')
    icon.classList.add('right')
    items.classList.add('ui', 'items')
    item.classList.add('item', 'no-wrap')
    item.style = 'margin-bottom:0px; padding-bottom:2px'
    header.classList.add('header')
    header.style = 'font-size: 12px;'
    content.classList.add('content', 'tree_item')
    subitems.style = 'margin-left: 10px;'
    item.draggable = false


    // CHECK FOR SUB DIRS
    // let subdirs = fs.readdirSync(filepath, {withFileTypes:true})
    let subdirs = ''
    try {
        subdirs = fs.readdirSync(filepath, { withFileTypes: true })
    } catch (err) {

    }

    if (subdirs.length > 0) {
        // filename = filename + ' (' + subdirs.length + ')'
        // filename = filename + ' (' + subdirs.length + ')'
    }

    href.src = filepath
    href.text = filename + ' (' + subdirs.length + ')'
    href.style = 'color:#cfcfcf !important;'
    header.appendChild(href)

    subitems.dataset.id = filename

    if (subdirs.length > 0) {

        for (let i = 0; i < subdirs.length; i++) {

            let subfilename = subdirs[i].name
            let subfilepath = path.join(filepath, '/', subfilename)

            let stats
            try {
                stats = fs.statSync(subfilepath)
            } catch (err) {

            }


            if (stats) {

                if (stats.isDirectory() == true) {

                    // icon.classList.add('icon','angle', 'right', 'large')
                    // icon_div.classList.add('tree_icon')
                    // icon_div.innerHTML = subdirs.length

                } else {

                    // icon.classList.add('icon')

                }

            }

            // subicon.classList.add('icon', 'folder', 'outline')
            subicon_div.classList.add('tree_subicon')

        }

    }

    else {

        // icon.classList.add('icon')
        subicon_div.classList.add('tree_subicon')

    }


    if (path.dirname(filepath) == '/media/michael') {
        console.log('here we are')
        subicon.classList.add('icon', 'hdd', 'outline')
    }

    // content.appendChild(icon)
    // content.appendChild(subicon)
    content.appendChild(subicon_div)
    content.appendChild(header)
    // content.appendChild(icon_div)

    items.appendChild(item)
    items.appendChild(subitems)
    item.appendChild(content)


    // ITEM CLICK
    item.addEventListener('click', function (e) {

        e.preventDefault()
        e.stopPropagation()

        if (icon.classList.contains('right')) {

            icon.classList.remove('right')
            icon.classList.add('down')

            try {
                get_tree(filepath)
            } catch (err) {

            }
            subitems.classList.remove('hidden')

        } else {

            icon.classList.add('right')
            icon.classList.remove('down')

            subitems.classList.add('hidden')

        }

        // get_files(filepath,{sort: localStorage.getItem('sort')})

    })

    // TREE ICON CLICK
    icon.addEventListener('click', function (e) {
        e.preventDefault()

        if (icon.classList.contains('right')) {

            icon.classList.remove('right')
            icon.classList.add('down')

            try {
                get_tree(filepath)
            } catch (err) {

            }
            subitems.classList.remove('hidden')

        } else {

            icon.classList.add('right')
            icon.classList.remove('down')

            subitems.classList.add('hidden')

        }

    })


    // HEADER CLICK
    header.addEventListener('click', function (e) {

        e.preventDefault()
        e.stopPropagation()


        // // CHECK IF THERE ARE SUBDIRECTORIES
        // if (icon.classList.contains('right')) {

        //     icon.classList.remove('right')
        //     icon.classList.add('down')

        //     try {
        //         get_tree(filepath)
        //     } catch (err) {

        //     }

        //     subitems.classList.remove('hidden')

        // } else {

        //     icon.classList.add('right')
        //     icon.classList.remove('down')

        //     subitems.classList.add('hidden')

        // }

        get_files(filepath, { sort: localStorage.getItem('sort') })

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
async function get_tree(dir) {

    console.log('running get tree ' + dir)

    let dirents = fs.readdirSync(dir, { withFileTypes: true })

    if (dirents) {

        let tree_grid
        if (dir == '/') {
            tree_grid = document.querySelector('[data-id="/"]')
        } else if (dir == '/media/michael') {
            tree_grid = document.querySelector('[data-id="/media/michael"]')
        } else {
            tree_grid = document.querySelector('[data-id="' + basename(dir) + '"]')
        }


        tree_grid.innerHTML = ''


        //SET DEFAULT SORT OPTION
        if (!options.sort) {
            options.sort = 1
        }

        // SORT BY NAME
        filter = dirents.sort((a, b) => {
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

                let filename = file.name
                let filepath = dir + '/' + filename
                let stats = fs.statSync(filepath)
                let is_dir = stats.isDirectory()

                if (is_dir) {

                    let options = {
                        id: 'tree_' + idx,
                        href: filepath,
                        linktext: filename,
                        image: '../assets/icons/vscode/default_folder.svg',  //get_icon_path(filepath),
                        is_folder: true,
                        description: '',
                        size: 0
                    }

                    // console.log(options)
                    // let card = add_card(options)
                    let card = add_tree_item(options)


                    // console.log(card)a
                    tree_grid.appendChild(card)
                    card.style = 'border: none; margin:0px'


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
var disk_usage_chart
function bar_chart(chart_labels, chart_labels1, chart_data) {

    console.log(chart_labels)
    console.log(chart_data)

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

    notification('getting disk usage chart')


    let cmd = "df '" + breadcrumbs.value + "'"
    let child = exec(cmd)

    let chart_labels = []
    let chart_labels1 = []
    let chart_data = []


    child.stdout.on("data", (res) => {

        let res1 = res.split('\n')

        let headers = res1[0].split(' ')
        let details = res1[1].split(' ')
        for (let i = 0; i < headers.length; i++) {

            if (headers[i] != '') {
                chart_labels.push(headers[i])
            }

            // if(details[i] != ''){
            //     chart_data.push(details[i])
            // }
        }


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

            // let item = add_div()
            // let extra = folder_card[i].querySelector('.extra')

            let size = parseInt(res.replace('.', ''))
            // size = get_file_size(size)

            chart_labels.push('folder size')
            chart_data.push((size))

            // if (size > 1000000000) {
            //     extra.innerHTML = '<span style="color:red">' + get_file_size(size) + '</span>'
            // } else {
            // }

            notification(chart_data)
            bar_chart(chart_labels, chart_labels1, chart_data)


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


            notification(res[i])

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

    // need to replace href here

    href = dir


    cmd = "cd '" + href + "'; du -s"

    console.log(cmd)

    du = exec(cmd)

    return new Promise((resolve, reject) => [

        du.stdout.on('data', function (res) {

            let size = parseInt(res.replace('.', '') * 1024)
            resolve(size)

        })

    ])

}

// GET FOLDER SIZE
function get_folder_size(href) {

    return new Promise(resolve => {

    console.log('running get folder size')

    let breadcrumbs = document.getElementById('breadcrumbs')
    if (breadcrumbs.value.indexOf('gvfs') == -1) {

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

    } else {
        console.log('gvfs folder. dont scan size')
    }

})

}

// CLEAR WORKSPACE
function clear_workspace() {
    workspace_arr = []
    if (localStorage.getItem('workspace')) {
        localStorage.setItem('workspace', '')
        let workspace_grid = document.getElementById('workspace_grid')
        let workspace_content = document.getElementById('workspace_content')
        workspace_content.classList.remove('active')
        workspace_grid.innerHTML = ''
    }

}

// GET WORKSPACE ITEMS
async function get_workspace() {

    if (localStorage.getItem('workspace')) {

        let items = JSON.parse(localStorage.getItem('workspace'))

        let workspace_content = document.getElementById('workspace_content')
        let workspace_grid = document.getElementById('workspace_grid')
        workspace_content.classList.add('active')

        workspace_grid.innerHTML = ''

        for (let i = 0; i < items.length; i++) {

            let item = items[i]
            let href = item

            options = {
                id: 'workspace_' + i,
                href: href,
                linktext: path.basename(href),
                grid: workspace_grid
            }

            workspace_arr.push(options.href)

            add_card(options)

        }

        update_cards(workspace_grid)

    }

}

// ADD ITEM TO WORKSPACE
let workspace_arr = []
function add_workspace() {

    let items = document.querySelectorAll('.highlight, .highlight_select')
    if (items.length > 0) {

        let workspace_content = document.getElementById('workspace_content')
        let workspace_grid = document.getElementById('workspace_grid')
        workspace_content.classList.add('active')

        let file_exists = 0
        for (let i = 0; i < items.length; i++) {

            if (localStorage.getItem('workspace')) {
                let local_items = JSON.parse(localStorage.getItem('workspace'))
                for (let ii = 0; ii < local_items.length; ii++) {

                    if (items[i].dataset.href == local_items[0]) {
                        file_exists = 1
                        return
                    }

                }
            }

            if (!file_exists) {

                let item = items[i]
                let href = item.dataset.href

                options = {
                    id: 'workspace_' + i,
                    href: href,
                    linktext: path.basename(href),
                    grid: workspace_grid
                }

                workspace_arr.push(options.href)
                add_card(options)

                localStorage.setItem('workspace', JSON.stringify(workspace_arr))

            }

        }



    }

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




async function get_files_list(dir) {

    let list_view = document.getElementById('list_view')

    let sort = localStorage.getItem('sort')

    const breadcrumbs = document.getElementById('breadcrumbs')
    breadcrumbs.classList.add('ui', 'breadcrumb')
    breadcrumbs.value = dir
    breadcrumbs.title = dir

    // SET FOLDER TO LOCAL STORAGE
    localStorage.setItem('folder', dir)

    let col_size = []
    let cols_arr = [
        {
            name:'Name',
            size: 'six'
        },
        {
            name:'Size',
            size:'three'
        },
        {
            name:'Modified',
            size:'three'

        },
        {
            name:'Type',
            size:'three'

        }
    ]

    // REGEX FOR HIDDEN FILE
    const regex = /^\..*/

    // let list_view_header = document.getElementById('list_view_header')
    // let folder_grid = document.getElementById('folder_grid')
    // let file_grid = document.getElementById('file_grid')

    let show_hidden = 0
    if (localStorage.getItem('show_hidden')) {
        show_hidden = localStorage.getItem('show_hidden')
    }

    fs.readdir(dir, (err, dirents) => {

        if (err) {

        } else {

            // let col0 = add_column('one')
            let header_grid = add_grid()
            let folder_grid = add_grid()
            let file_grid = add_grid()

            let row = add_row()
            cols_arr.forEach(col => {
                let col1 = add_column(col.size)
                col1.appendChild(add_header(col.name))
                row.appendChild(col1)
            })

            // let col1 = add_column('five')
            // let col2 = add_column('three')
            // let col3 = add_column('three')
            // let col4 = add_column('three')

            // let row = add_row()

            // col1.appendChild(add_header('Name'))
            // col2.appendChild(add_header('Size'))
            // col3.appendChild(add_header('Modified'))

            // row.appendChild(col1)
            // row.appendChild(col2)
            // row.appendChild(col3)

            header_grid.appendChild(row)

            list_view.appendChild(header_grid)


            // SORT BY DATE
            if (sort == 1) {

                console.log('running sort 1 on list')

                // SORT START TIME
                sort_st = new Date().getTime()

                // SORT BY DATE
                dirents.sort((a, b) => {

                    try {

                        let s1 = stat.statSync(path.join(dir, a))
                        let s2 = stat.statSync(path.join(dir, b))

                        return s2.mtime - s1.mtime

                    } catch (err) {
                        console.log(err)
                    }

                })

                let sort_et = new Date().getTime() - sort_st
                console.log('sort by date elapsed time ' + sort_et)

            }


            dirents.forEach((file, idx) => {

                // GET FILE NAME
                let filename = path.join(dir, file)

                try {

                    // GET FILE STATS
                    let stats = fs.statSync(filename)

                    if (stats) {

                        let isdir = stats.isDirectory()
                        let ishidden = regex.test(file)
                        let type = mime.lookup(filename)

                        if (!type) {
                            type = 'Folder'
                        }

                        let row = add_row()

                        let col1 = add_column('six')
                        let col2 = add_column('three')
                        let col3 = add_column('three')
                        let col4 = add_column('three')

                        col1.appendChild(add_link('#',file))
                        col3.appendChild(add_item(new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)))
                        col4.appendChild(add_item(type))

                        row.appendChild(col1)
                        row.appendChild(col2)
                        row.appendChild(col3)
                        row.appendChild(col4)

                        if (isdir && !ishidden) {
                            col2.appendChild(add_item(size))
                            folder_grid.appendChild(row)
                        } else if (!isdir) {
                            col2.appendChild(add_item(get_file_size(stats.size)))
                            file_grid.appendChild(row)
                        }

                    }

                } catch (er) {

                }



            })

            //
            list_view.appendChild(folder_grid)
            list_view.appendChild(file_grid)

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


// MAIN GET FILES FUNCTION
let card_counter = 0
async function get_files(dir) {

    show_loader()

    options.sort = localStorage.getItem('sort')
    options.page = localStorage.getItem('page')

    // HANDLE COUNTER
    cardindex = 0

    // NEED TO FIGURE OUT WHAT THIS IS DOING
    console.log(start_path)

    if (start_path) {
        dir = start_path
        start_path = ''
    }

    console.log('running get files')


    if (options.page == '') {
        options.page = 1
    }

    const breadcrumbs = document.getElementById('breadcrumbs')
    breadcrumbs.value = dir
    breadcrumbs.title = dir

    // SET FOLDER TO LOCAL STORAGE
    localStorage.setItem('folder', dir)

    // GET REFERENCES
    let main_view = document.getElementById('main_view')
    let dimmer = document.getElementsByClassName('dimmer')
    let folder_grid = document.getElementById('folder_grid')
    let hidden_folder_grid = document.getElementById('hidden_folder_grid')
    let file_grid = document.getElementById('file_grid')
    let hidden_file_grid = document.getElementById('hidden_file_grid')
    let pager = document.getElementById('pager')


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
    folder_grid.innerText = ''
    hidden_folder_grid.innerText = ''
    file_grid.innerText = ''
    hidden_file_grid.innerText = ''
    pager.innerHTML = ''

    // dimmer[0].classList.add('active')

    // HANDLE GNOME DISKS BUTTON
    let gnome_disks = document.querySelectorAll('.gnome_disks')
    gnome_disks.forEach(function (e) {
        e.addEventListener('click', function (e) {
            ipcRenderer.send('gnome_disks')
        })
    })
    // addEventListener('click', function (e) {
    //     exec('gnome-disks')
    // })

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

    // ipcRenderer.send('get_files', dir)

    // dirents
    // ipcRenderer.on('files', (err, dirents)  => {

    // GET FILES ARRAY
    let rd_st = new Date().getTime()
    fs.readdir(dir, (err, dirents) => {

        if (err) {
            notification('error: ' + err)
        }

        // console.log('dirents length is ' + dirents.length)
        console.log(new Date().getTime() - rd_st)

        if (dirents.length > 0) {

            // let dirents = dirents
            console.log('sort ' + sort)

            // SORT BY DATE
            if (sort == 1) {

                console.log('running sort 1')

                // SORT START TIME
                sort_st = new Date().getTime()

                // SORT BY DATE
                dirents.sort((a, b) => {

                    try {
                        let s1 = stat.statSync(path.join(dir, a))
                        let s2 = stat.statSync(path.join(dir, b))

                        return s2.mtime - s1.mtime

                    } catch (err) {
                        console.log(err)
                    }

                })

                let sort_et = new Date().getTime() - sort_st
                console.log('sort by date elapsed time ' + sort_et)

            }

            // SORT BY NAME
            if (sort == 2) {

                // SORT Y NAME
                dirents = dirents.sort((a, b) => {
                    if (a.toLocaleLowerCase() < b.toLocaleLowerCase()) {
                        return -1;
                    }
                    if (a.toLocaleLowerCase() > b.toLocaleLowerCase()) {
                        return 1;
                    }
                    return 0;
                })

                notification('Sorted by name ')

            }

            // SORT BY SIZE
            if (sort == 3) {

                // SORT BY SIZE
                dirents.sort((a, b) => {

                    let s1 = stat.statSync(dir + '/' + a)
                    let s2 = stat.statSync(dir + '/' + b)

                    notification(s1.size + ' ' + s2.size)

                    // if(a.size < b.size){
                    //     return -1
                    // }

                    // if(a.size > b.size) {
                    //     return 1
                    // }

                    return s2.size - s1.size
                    // s1.size > s2.size

                })

            }

            // SORT BY TYPE
            if (sort == 4) {


                dirents.sort((a, b) => {

                    try {

                        let s1 = stat.statSync(dir + '/' + a)
                        let s2 = stat.statSync(dir + '/' + b)

                        let ext1 = path.extname(path.basename(a))
                        let ext2 = path.extname(path.basename(b))

                        if (ext1 > ext2) return -1
                        if (ext1 < ext2) return 1

                        if (s1.mtime > s2.mtime) return -1
                        if (s1.mtime < s2.mtime) return 1

                    } catch {
                        console.log(err)
                    }

                })

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
            // let exts = []
            let exts = dirents.filter((a) => {

                let ext1 = path.extname(a)
                let ext2 = path.extname(a)

                if (ext1 > ext2) return -1
                if (ext1 < ext2) return 1

            })



            if (groupby) {

                exts.forEach(ext => {

                    console.log('extension ', ext)

                    dirents.forEach((file, idx) => {

                        if (path.extname(file) == ext) {
                            console.log('extension ', file)
                        }

                    })


                })

            }




            dirents.forEach((file, idx) => {

                console.log('im a file ', file)

                try {

                    let filename = file
                    let filepath = path.join(dir, filename)

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

                            options.grid = folder_grid

                        } else {

                            options.grid = hidden_folder_grid

                        }

                        add_card(options)

                        // FILES
                    } else {
                        let filename = path.basename(file)
                        let filepath = path.join(dir, '/', filename)

                        if (groupby) {

                            let ext = path.extname(filename)
                            console.log('ext',ext)



                        } else {

                        }

                        let options = {
                            id: 'file_card_' + idx,
                            href: filepath,
                            linktext: filename,
                            is_folder: false,
                            card_counter: card_counter
                        }

                        if (!regex.test(file)) {
                            options.grid = file_grid
                        } else {
                            options.grid = hidden_file_grid
                        }

                        add_card(options)

                    }

                } catch (err) {

                    console.log(err)

                }

            })

            /////////////////////////////////////////////////////////////////////

            // PAGE FILES
            if (dirents.length > pagesize) {

                let number_pages = parseInt(parseInt(dirents.length) / parseInt(pagesize))

                for (let i = 1; i < number_pages + 1; i++) {

                    add_pager_item({ dir, name: i })

                }

                dirents = paginate(dirents, pagesize, page)

            }

            hide_loader()

            // GET DISK SPACE
            // console.log('folder count ' + folder_count + ' file count ' + file_count)
            notification('loaded ' + folder_count + ' folders ' + file_count + ' files')

            if (dir.indexOf('/gvfs') === -1) {

                console.log('getting disk space')

                ipcRenderer.send('get_disk_space', { href: dir, folder_count: folder_count, file_count: file_count })

                // GET DISK USAGE CHART
                get_disk_usage_chart()

            }

            // UPDATE CARDS
            update_cards(main_view)


            // let lazy = [].slice.call(document.querySelectorAll('.file_card'))
            // if ("IntersectionObserver" in window) {

            //     let lazyObserver = new IntersectionObserver(function(entries, observer) {

            //         notification('Running lazy file card')

            //         entries.forEach(function(entry) {
            //             if (entry.isIntersecting) {
            //             let lazy = entry.target;

            //             // THIS NEEDS TO CHANGE TO HANDLE CARD
            //             lazy.src = lazy.dataset.src;
            //             lazy.srcset = lazy.dataset.src;


            //             lazy.classList.remove("lazy");
            //             lazyObserver.unobserve(lazy);
            //             }
            //         })

            //     })

            //     lazy.forEach(function(lazy) {
            //         notification('running observe')
            //         lazyObserver.observe(lazy)
            //     })

            // } else {
            //     // Possibly fall back to event handlers here
            // }


            // LAZY LOAD IMAGES
            let lazyImages = [].slice.call(document.querySelectorAll("img.lazy"))

            // CHECK IF WINDOW
            if ("IntersectionObserver" in window) {

                // GET REFERENCE TO LAZY IMAGE
                let lazyImageObserver = new IntersectionObserver(function (entries, observer) {

                    // if (entries.length > 1) {

                    entries.forEach(function (entry) {

                        if (entry.isIntersecting) {

                            let lazyImage = entry.target;
                            lazyImage.src = lazyImage.dataset.src;
                            // lazyImage.srcset = lazyImage.dataset.src;
                            lazyImage.classList.remove("lazy");
                            lazyImageObserver.unobserve(lazyImage);

                        }

                    })

                    // }

                })

                // THIS RUNS ON INITIAL LOAD
                // if (lazyImages.length > 1) {

                lazyImages.forEach(function (lazyImage) {
                    console.log('your lazy')
                    lazyImageObserver.observe(lazyImage)
                })

                // }


            } else {

                alert('lazy')
                // Possibly fall back to event handlers here
            }


            let sidebar = document.getElementById('sidebar')
            sidebar.addEventListener('mouseover', (e) => {
                sidebar.focus()
            })

            // // MAIN
            // let main_view = document.getElementById('main_view')

            // // HANDLE MAIN VIEW ON MOUSE OVER
            // main_view.addEventListener('mouseover', function (e) {

            //     e.preventDefault()

            //     // console.log('focusing')
            //     // main_view.backgroundColor = '#000000'
            //     main_view.focus()

            // })

            // HANDLE MAIN VIEW CLICK
            main_view.addEventListener('click', function (e) {

                // messagebox('what', 'when')

                e.preventDefault()
                clear_selected_files()

            })

            // HANDLE QUICK SEARCH KEY PRESS. THIS IS FOR FIND BY TYPING //////////////////////////////////
            let letters = ''
            let txt_search = document.getElementById('txt_search')

            main_view.addEventListener('keypress', function (e) {

                // LOOK FOR LETTERS AND NUMBERS. I DONT THINK THIS
                // let regex = /[^A-Za-z0-9]+/
                let regex = /[^A-Za-z0-9]+/

                console.log('key code is ' + e.key)

                // TEST FOR LETTERS AND NUMBERS
                if (regex.test(e.key) === false && !e.shiftKey && e.key !== 'Delete' && !e.ctrlKey) {

                    // MAKE SURE WHERE NOT SOMETHING THAT WE NEED
                    if (e.target === e.currentTarget || e.target === txt_search || e.target.classList.contains('header_link')) {

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

                            txt_search.classList.add('hidden')

                            // })

                        }

                    }

                }

            })

            // HIDE QUICK SEARCH
            txt_search.addEventListener('keydown', function (e) {

                // if (e.key === 'Escape' || e.key === 'Tab') {
                if (e.key === 'Escape') {

                    // CLEAR ITEMS
                    console.log('esc pressed on keydown')

                    clear_selected_files()
                    // // CLEAR COPY ARRAY
                    // copy_files_arr = []

                }

            })

            /////////////////////////////////////////////////////////////////////

            // let destination
            // main_view.draggable = 'true'

            // // let destination = breadcrumbs.value

            let dragging = 0

            // ON DRAG START
            main_view.ondragstart = function (e) {



            }

            // ON DRAG ENTER
            main_view.ondragenter = function (e) {

                dragging++

                destination = breadcrumbs.value

                target = e.target
                notification('running main view on drag enter ' + destination)

                //
                e.preventDefault()
                e.stopPropagation()
                // return false;

            };

            // DRAG OVER
            main_view.ondragover = function (e) {

                e.stopPropagation()
                e.preventDefault()
                e.dataTransfer.effectAllowed = 'move,copy,none'
                // return false

            }

            // ON DRAG LEAVE
            // main_view.ondragleave = function (e) {

            //     // dragging--
            //     // if (dragging === 0) {

            //     //     notification('running on drag leave main view')

            //     //     let target = e.target
            //     //     if (target.classList.contains('folder_card')) {
            //     //         notification('main view on drag leave ' + target.id)
            //     //         notification('running too much')
            //     //     }

            //     // }

            //     // e.preventDefault()
            //     // e.stopPropagation()
            //     // return false

            // };

            // main_view.ondragend = function (e) {
            //     return false
            // }




            // ON DROP
            main_view.ondrop = function (e) {

                e.preventDefault();
                e.stopPropagation();

                var files = e.dataTransfer.files


                console.log(files[0])

                // dodrop(e)

                // for (let f of e.dataTransfer.files) {
                //     console.log('File(s) you dragged here: ', f.path)
                // }

                notification('on drop main view destination ' + destination)

                // COPY FILES
                if (e.ctrlKey == true) {

                    state = 1
                    notification('changing state to 1')
                    notification('running copy files on main_view ' + destination)

                    console.log('destination ' + destination)

                    // THIS IS RUNNING COPY FOLDERS TOO
                    copy_files(destination)

                // MOVE FILE
                } else {

                    state = 0
                    notification('changing state to 0')

                    move_to_folder(destination)
                    // clear_selected_files()
                    // clear_copy_cache()

                }

                return false

            }


            // WORSPACE

            // POPULATE WORKSPACE
            workspace_arr = []
            get_workspace()

            let clearworkspace = document.getElementById('clear_workspace')
            clearworkspace.addEventListener('click', function (e) {
                clear_workspace()
            })

            let workspace = document.getElementById('workspace')

            // WORKSPACE ON DRAG ENETER
            workspace.ondragenter = function (e) {
                notification('running')
                workspace_content.classList.add('active')

                e.preventDefault()
            }

            workspace.ondragleave = function (e) {

                e.preventDefault()

            }

            // navigator.clipboard.write([
            //     new ClipboardItem({
            //         'image/png': pngImageBlob
            //     })
            // ]);


            // WORKSPACE CONTENT
            let workspace_content = document.getElementById('workspace_content')

            workspace_content.ondragenter = function (e) {
                notification('running on drag enter workspace content')
                e.preventDefault()
            }

            workspace_content.ondragover = function (e) {
                e.preventDefault()
            }

            workspace_content.ondrop = function (e) {

                notification('running workspace on drop ')

                add_workspace()

            }

            // // WATCH DIRECTORY FOR CHANGES
            // fs.watch(dir, "", (eventtype, filename) => {

            //     // watch_count = watch_count + 1

            //     let grid
            //     let filepath = path.join(dir,filename)
            //     let stats = fs.statSync(filepath)
            //     let idx = 0

            //     // IF EVENT TYPE IS CHANGE THEN SOMETHING WAS ADDED
            //     if (eventtype == 'change' && watch_count == 0) {

            //         console.log('eventtype ' + eventtype + ' trigger ' + filename)

            //         if (stats.isDirectory()) {

            //             grid = document.getElementById('folder_grid')
            //             idx = grid.getElementsByClassName('folder_card').length

            //         } else {

            //             grid = document.getElementById('file_grid')
            //             idx = grid.getElementsByClassName('file_card').length
            //         }

            //         let options = {

            //             id: grid.id + '_'+ idx + 1,
            //             href: filepath,
            //             linktext: filename,
            //             grid: grid
            //         }

            //         try {

            //             add_card(options).then(card => {

            //                 console.log('what THE')
            //                 grid.insertBefore(card, grid.firstChild)

            //                 // setTimeout(() => {
            //                 //     watch_count = 0
            //                 // }, 5000);

            //             })

            //         } catch (err) {

            //             notification(err)

            //         }

            //     }


            // })

            // new DragSelect({
            //     selectables: document.getElementsByClassName('card'),
            //     area: document.getElementById('main view')
            // });


            // REMOVE SPINNER
            // dimmer[0].classList.remove('active')
            // get_folder_size()

            // get_dir_size(dir)
            // console.log('folder count ' + folder_count + ' file count ' + file_count)
            // ipcRenderer.send('get_disk_space', { dir: dir, folder_count: folder_count, file_count: file_count })
            // folder_count = 0
            // file_count = 0

            // FOCUS MAIN VIEW ON AFTER GETTING FILES
            main_view.focus()

            // RESET CARD INDEX TO 0 SO WE CAN DETECT WHEN SINGLE CARDS ARE ADDED
            cardindex = 0

            notice(' (' + directories.length + ') directories and (' + files.length + ') files')

        } else {

            hide_loader()

            // let img = add_img(path.join(icon_dir, '/places/scalable/gnome-folder.svg'))
            // let p = document.createElement('p')
            // let div = add_div()

            // p.innerHTML = "Folder is Empty"

            // div.appendChild(img)
            // div.appendChild(p)
            // main_view.appendChild(div)

            info('Folder is Empty')
            return false
        }

    })


    // // GET DISK SPACE
    // get_diskspace(dir)

    // console.log('folder count ' + folder_count + ' file count ' + file_count)
    // ipcRenderer.send('get_disk_space', { dir: dir, folder_count: folder_count, file_count: file_count } )


    ///////////////////////////////////////////////////////////////////////

    // let find = document.getElementById('find')
    // let find_options = document.getElementById('find_options')
    // let find_directory = document.getElementById('find_directory')

    // find_directory.setAttribute('checked', localStorage.getItem('find_directory'))
    // find_directory.addEventListener('click', function(e) {
    //     if (localStorage.getItem('find_directory') == '') {
    //         localStorage.setItem('find_directory','1')
    //     } else {
    //         localStorage.setItem('find_directory','')
    //     }
    // })

    // find.addEventListener('click', function(e) {

    //     find_options.classList.remove('hidden')

    // })

    // find.addEventListener('change',function (e) {

    //     find_options.classList.add('hidden')

    // })

    // c = 0

    let folder_cards = document.getElementsByClassName('folder_card')
    let file_cards = document.getElementsByClassName('file_card')
    let items = document.querySelectorAll('.nav_item')
    let selected_items = document.getElementsByClassName('highlight')
    let headers = document.getElementsByClassName('header_link')


    nc = 1
    nc2 = 0
    adj = 0
    is_folder_card = true

    // ALT+E EXTRACT
    Mousetrap.bind('shift+e', (e) => {

        e.preventDefault()
        console.log('extracting file')

        let href = selected_items[0].dataset.href
        extract(href)

    })

    Mousetrap.bind('shift+c', (e) => {

        let href = ''
        if (items.length > 0) {
            for (let i = 0; i < items.length; i++) {

                let item = items[i]

                if (item.classList.contains('highlight') || item.classList.contains('highlight_select')) {
                    href = item.dataset.href
                    console.log('source ' + href)
                    compress(href)
                }
            }
        }

    })


    // KEYBOARD SHORTCUTS SECTION
    Mousetrap.bind('ctrl+a', (e) => {

        e.preventDefault()

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

    })


    // CTRL S SHOW SIDEBAR
    Mousetrap.bind('ctrl+s', (e) => {

        let sidebar = document.getElementById('sidebar')

        console.log(sidebar.hidden)

        if (sidebar.classList.contains('hidden')) {

            show_sidebar()
            localStorage.setItem('sidebar', 1)
            console.log('show side bar')

        } else {
            hide_sidebar()
            localStorage.setItem('sidebar', 0)
            console.log('hide side bar')
        }

    })




    let down = 1
    let up = 1
    let left = 1
    let right = 1

    let keycounter = 0
    let keycounter0 = 0

    let is_last = 0
    let is_last0 = 0

    // RIGHT
    Mousetrap.bind('shift+right', (e) => {


        e.preventDefault()
        // if (nc > 0) {
        nc = nc2
        nc2 = nc2 + 1
        console.log('nc2 ' + nc2)
        console.log('nc ' + nc)

        // document.querySelector("[data-id='" +  (nc) + "']").classList.remove('highlight_select')
        document.querySelector("[data-id='" + (nc2) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (nc2) + "']").querySelector('a').focus()
        // headers[nc2 - 1].focus()

        // }

    })

    // RIGHT
    Mousetrap.bind('right', (e) => {

        keycounter0 = keycounter

        if (keycounter < 1) {
            keycounter = 1
        } else {
            document.querySelector("[data-id='" + (keycounter0) + "']").classList.remove('highlight_select')
            keycounter += 1
        }

        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

        console.log(keycounter, keycounter0, folder_cards.length)

    })

    // SHIFT LEFT. MULTI SELECT
    Mousetrap.bind('shift+left', (e) => {

        // e.preventDefault()

        // if (nc2 > 1) {

        //     nc = nc2
        //     nc2 = nc2 - 1

        //     console.log('nc2 ' + nc2)
        //     console.log('nc ' + nc)

        //     // document.querySelector("[data-id='" +  (nc) + "']").classList.remove('highlight_select')
        //     document.querySelector("[data-id='" + (nc2) + "']").classList.add('highlight_select')
        //     document.querySelector("[data-id='" + (nc2) + "']").querySelector('a').focus()
        //     // headers[nc2 - 1].focus()

        // }
    })

    // LEFT
    Mousetrap.bind('left', (e) => {

        keycounter0 = keycounter

        if (keycounter <= 1) {
            keycounter = 1
        } else {
            document.querySelector("[data-id='" + (keycounter) + "']").classList.remove('highlight_select')
            keycounter -= 1
        }

        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

        console.log(keycounter, keycounter0, folder_cards.length)

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
    Mousetrap.bind('down', (e) => {

        keycounter0 = keycounter

        let min = Math.floor(folder_cards.length / 5) * 5
        let diff = (Math.ceil(folder_cards.length / 5) * 5) - folder_cards.length

        is_last0 = is_last

        // CHECK IF LAST ROW
        if (keycounter > min) {
            is_last = 1
        }

        console.log(min, is_last)

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

        console.log(keycounter, keycounter0, folder_cards.length, diff)
        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

        // items.forEach(item => {
        //     items.classList.remove('highlight')
        // })


    })

    // todo: check hidden files
    Mousetrap.bind('up', (e) => {

        keycounter0 = keycounter

        let min = Math.floor(folder_cards.length / 5) * 5
        let diff = 5 - ((Math.ceil(folder_cards.length / 5) * 5) - folder_cards.length)

        if (keycounter - 5 < min && !is_folder_card) {
            is_last = 1
            console.log('eurika')
        }

        if (keycounter <= 1) {
            keycounter = 1
        } else {

            keycounter -= 5

            if (keycounter < folder_cards.length && !is_folder_card && is_last) {

                keycounter = keycounter - diff
                is_folder_card = 1

            } else if (keycounter < folder_cards.length && !is_folder_card && !is_last) {

                keycounter = keycounter0 - diff
                is_folder_card = 1

            }

            document.querySelector("[data-id='" + (keycounter0) + "']").classList.remove('highlight_select')
        }

        console.log(keycounter, folder_cards.length)
        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

    })


    // SHOW SIDEBAR
    if (localStorage.getItem('sidebar') == "1") {
        show_sidebar()
    }


    // DEL DELETE KEY
    Mousetrap.bind('del', (e, res) => {

        console.log('running del')

        // delete_arr = []
        let items = document.getElementsByClassName('highlight_select')

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
    Mousetrap.bind('ctrl+v', () => {

        // RUN COPY FUNCTION
        copy_files(breadcrumbs.value)

        // CLEAN UP
        clear_selected_files()

        // UPDATE DIRECTORY
        // get_diskspace(breadcrumbs.value)

        // CLEAR COPY ARRAY
        copy_files_arr = []



    })


    // NEW WINDOW
    Mousetrap.bind('ctrl+n', () => {
        // window.open('../src/index.html','_blank', 'width=1600,height=800,frame=false')
        ipcRenderer.send('new_window')
    })


    // NEW FOLDER
    Mousetrap.bind('ctrl+shift+n', () => {
        create_folder(breadcrumbs.value + '/Untitled Folder')

    })


    // RENAME
    Mousetrap.bind('f2', () => {

        let cards = document.querySelectorAll('.highlight, .highlight_select')
        if (cards.length > 0) {
            cards.forEach(card => {

                if (card) {

                    let header = card.querySelector('a')
                    let input = card.querySelector('input')

                    header.classList.add('hidden')
                    input.classList.remove('hidden')

                    console.log('running focus')
                    input.focus()
                    // input.select()
                    input.setSelectionRange(0, input.value.length - path.extname(header.href).length)
                    // var selrange = document.createRange()
                    // selrange.setStart(input, 0)
                    // selrange.setEnd(input, 1)

                }

            })
        }

    })

    // RELOAD
    Mousetrap.bind('f5', () => {

        // get_tree(breadcrumbs.value)
        get_files(breadcrumbs.value, { sort: localStorage.getItem('sort') })

        localStorage.setItem('folder', breadcrumbs.value)

    })

    // FIND
    Mousetrap.bind('ctrl+f', () => {
        let find = document.getElementById('find')
        find.focus()
        find.select()
    })


    // // LEFT
    // let left = document.getElementById('left')
    // left.addEventListener('click', function (e) {

    //     // alert('test')
    //     ipcRenderer.send('go_back', 'test')


    // })


    // CTRL C COPY
    Mousetrap.bind('ctrl+c', function (e) {

        let highlight = document.querySelectorAll('.highlight, .highlight_select')

        let folder_count = 0
        let file_count = 0

        if (highlight.length > 0) {

            let source
            let card_id

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

            })
        }

        info('Copied ' + folder_count + ' Folders ' + file_count + ' files')

        // clear_selected_files()

        // add_selected_file(source, card_id)
        // console.log('copy selected file ')

    })

    // ESC KEY
    Mousetrap.bind('esc', () => {

        clear_copy_arr()
        clear_selected_files()
        console.log('esc pressed')

    })

    // BACKSPACE
    Mousetrap.bind('backspace', () => {

        console.log('back pressed')
        navigate('left')

    })

    // GET DISK SPACE
    // get_diskspace(dir)

    // ipcRenderer.send('get_disk_space', { href: dir, folder_count: folder_count, file_count: file_count })

    // ipcRenderer.on('diskspace', (df) => {
    //     console.log(df)
    // })

    // TESTING GET DEVICE LIST
    // const filters = [
    //     {vendorId: 0x1209, productId: 0xa800},
    //     {vendorId: 0x1209, productId: 0xa850}
    // ];
    // navigator.usb.requestDevice({filters: filters})
    // .then(usbDevice => {
    //     console.log("Product name: " + usbDevice.productName);
    // })
    // .catch(e => {
    //     console.log("There is no device. " + e);
    // });

    // UPDATE CARD ID'S
    // if (dir.indexOf('/gvfs') === -1) {
    update_cards(main_view)
    // }



    clear_selected_files()


    console.log('finished running get files')

}

// GET HOME DIRECTORY
function get_home() {
    return os.homedir()
}


// CONTEXT BRIDGE
contextBridge.exposeInMainWorld('api', {

    add_card: (options) => {
        add_card(options)
    },
    // get_gio_devices: () => {
    //     get_gio_devices()
    // },
    get_folder_size: () => {
        get_folder_size()
    },
    find_files: () => {
        find_files()
    },
    get_disk_usage: () => {
        get_disk_usage()
    },
    get_folders1: (dir) => {
        return get_folders1(dir)
    },
    get_tree: (dir) => {
        return get_tree(dir)
    },
    get_files: (dir, options) => {
        return get_files(dir, options)
    },
    get_files_list: (dir) => {
        return get_files_list(dir)
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
        get_terminal()
    }

})

/////////////////////////////////////////////////////////////////////////////


// LOAD DATA



// window.loaddata = async function loaddata(dir,options = {}) {

//       console.log('loading data....')

//       fs.watch(dir, { encoding: 'buffer' }, (eventType, filename) => {
//           if (filename) {
//             console.log(filename);
//           }
//       });

//       source = ''

//       // REF TO DOM ELEMENTS ON PAGE
//       const breadcrumbs = document.getElementById('breadcrumbs')
//       const sidebar  = document.getElementById('show_sidebar')
//       sidebar.addEventListener('click',function(e){

//           if(show_sidebar()){
//               hide_sidebar()
//           }

//       })

//       const btn_create_folder = document.getElementById('btn_create_folder')

//       breadcrumbs.value = dir
//       breadcrumbs.title = dir

//       let active_folder = localStorage.getItem('folder')
//       if(active_folder){

//         let home = path.basename(get_home())
//         let folder = path.basename(active_folder).toLocaleLowerCase()

//         switch(folder){
//           case 'gvfs':
//             document.getElementById('devices').classList.add('active')
//           break;
//           case home:
//             document.getElementById('home').classList.add('active')
//           break;
//           case 'media':
//              document.getElementById('network').classList.add('active')
//           break;
//           default:
//             if(folder){
//               document.getElementById(folder.toLocaleLowerCase()).classList.add('active')
//             }

//           break;
//         }

//       }

//       // NAVIGATE
//       if(!is_navigate){

//         idx = idx + 1
//         // console.log(idx)

//         let history_obj = new history()
//         history_obj.dir = dir
//         history_arr.push(history_obj)
//         click_counter += 1

//       } else{
//         is_navigate = false
//       }

//         get_files(dir,options)

// }


let copy_files_arr = []
function add_copy_file(source, card_id) {

    console.log('adding files to copy array')

    if (source == '' || card_id == '') {
        console.log('error line #2955: empty source or card_id')
    } else {

        if (copy_files_arr.length > 0) {

            if (copy_files_arr.every(x => x.source != source)) {

                console.log('adding selected file ' + source)
                console.log('card id is ' + card_id)

                let file = {
                    card_id: card_id,
                    source: source,
                    size: localStorage.getItem(source)
                }

                copy_files_arr.push(file)

                // ADDING MAIN COPY FILES ARRAY
                ipcRenderer.send('add_copy_files', copy_files_arr)

                // console.log('Added source ' + file.source + ' card_id ' + file.card_id + ' to the copy array')
                notification('Added source ' + file.source + ' card_id ' + file.card_id + ' to the copy array')

                info('Copied ' + file.source)

            }

        } else {

            let file = {
                card_id: card_id,
                source: source,
                size: localStorage.getItem(source)
            }

            copy_files_arr.push(file)

            ipcRenderer.send('add_copy_files', copy_files_arr)

            // console.log('Added source ' + file.source + ' card_id ' + file.card_id + ' to the copy array')
            notification('Added source ' + file.source + ' card_id ' + file.card_id + ' to the copy array')

            info('Copied ' + file.source)

        }
    }

}

// ADD TO SELECTED FILES ARRAY
function add_selected_file(source, card_id) {

    //

    if (source == '' || card_id == '') {
        console.log('error line #2955: empty source or card_id')
    } else {

        if (selected_files.length > 0) {

            if (selected_files.every(x => x.source != source)) {

                console.log('adding selected file ' + source)
                console.log('card id is ' + card_id)

                let file = {
                    card_id: card_id,
                    source: source
                }

                selected_files.push(file)

                console.log('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')
                notification('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')

            }

        } else {

            let file = {
                card_id: card_id,
                source: source
            }

            selected_files.push(file)
            console.log('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')
            notification('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')

        }

    }

}

// REMOVE FILE FROM SELECTED FILES ARRAY
function remove_selected_file(source) {

    console.log('removing')

    // let card = document.getElementById(card_id)
    // card.classList.add('highlight_select')

    // let file_idx = selected_files.indexOf()
    // selected_files.splice(file_idx,1)


    //   let selected_files_list = document.getElementById('selected_files_list')
    //   selected_files_list.innerHTML = ''

    // LOOP OVER SELECTED FILES ARRAY
    // selected_files.forEach((file, idx) => {

    //     if (file.source == source) {
    //         console.log('removed selected file ' + source)
    //         notification('removed selected file ' + source)
    //         console.log('length ' + selected_files.length)

    //         // selected_files.pop()

    //         console.log('length ' + selected_files.length)

    //     }

    //     // console.log('running ' + idx)

    //     // // CREATE ITEM
    //     // let item = add_div()

    //     // // ADD NAME TO ITEM
    //     // item.innerText = file

    //     // // APPEND TO SELECTED FILES LIST
    //     // selected_files_list.appendChild(item)

    // })

}

function clear_highlight() {

    let cards = document.querySelectorAll('.card')
    cards.forEach((card, idx) => {
        if (card.classList.contains('highlight')) {
            card.classList.remove('highlight')
        }
    })

}

function clear_highlight_select() {

    let cards = document.querySelectorAll('.card')
    cards.forEach((card, idx) => {
        card.classList.remove('highlight_select')
    })

}

// CLEAR SELECTED FILES ARRAY
function clear_selected_files() {

    nc = 1
    nc2 = 0
    adj = 0
    is_folder_card = true

    // clear_highlight_select

    delete_arr = []

    // CLEAR SELECTED FILES ARRAY
    selected_files = []

    // CLEAR COPY_FILES_ARR
    //THIS SHOULD BE CLEARED AFTER COPY NOT HERE
    // copy_files_arr = []

    let find_options = document.getElementById('find_options')
    find_options.classList.add('hidden')

    let pager = document.getElementById('pager')
    pager.innerHTML = ''

    let txt_search = document.getElementById('txt_search')
    txt_search.value = ''
    txt_search.classList.add('hidden')

    // CLEAR TEXT
    // let selected_files_list = document.getElementById('selected_files_list')
    // selected_files_list.innerText = ''


    // body.style.cursor = 'default'
    // console.log('card = ' + card_id)

    let input = document.getElementById('edit_' + card_id)
    if (input) {
        input.classList.add('hidden')
    }

    let header = document.getElementById('header_' + card_id)
    if (header) {
        header.classList.remove('hidden')
    }

    // CLEAR FOLDER CARD
    // let folder_card = document.getElementsByClassName('folder_card')
    // for (var i = 0; i < folder_card.length; i++) {

    //     // let input = document.getElementById('edit_folder_card_' + i)
    //     // input.classList.add('hidden')

    //     folder_card[i].classList.remove('highlight_select')

    //     folder_card[i].querySelector('input').classList.add('hidden')
    //     folder_card[i].querySelector('a').classList.remove('hidden')

    // }


    // // CLEAR FILE CARD
    // let file_card = document.getElementsByClassName('file_card')
    // for (let i = 0; i < file_card.length; i++) {

    //     file_card[i].classList.remove('highlight_select')

    //     file_card[i].querySelector('input').classList.add('hidden')
    //     file_card[i].querySelector('a').classList.remove('hidden')
    // }


    // CLEAR ALL NAV ITEMS
    let nav_items = document.querySelectorAll('.nav_item')
    nav_items.forEach(item => {

        item.classList.remove('highlight_select')
        item.classList.remove('highlight')

        item.querySelector('input').classList.add('hidden')
        item.querySelector('a').classList.remove('hidden')

    })


    // // CLEAR ALL CARDS
    // let cards = document.getElementsByClassName('card')
    // for (let i = 0; i < cards.length; i++) {
    //     let card = cards[i]
    //     card.classList.remove('highlight_select')
    // }


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
                header.classList.remove('hidden')
                input.classList.add('hidden')
            }

        }

    }

    // notification('items cleared')
    // console.log('clearing selected files')

    // FOCUS MAIN VIEW
    let main_view = document.getElementById('main_view')
    main_view.focus()



}

// CLEAR COPY CACHE
function clear_copy_arr() {
    console.log('clearing copy cache')
    copy_files_arr = []
}

// PRELOAD IMAGES
function preloadImages(array) {
    if (!preloadImages.list) {
        preloadImages.list = [];
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

// FIND FILES
async function find_files() {

    let filename
    let cmd

    // SEARCH VIEW
    // let search_results_col = document.getElementById('search_results_col')
    let search_results = document.getElementById('search_results')
    // let search_results_card = document.getElementById('search_results_card')
    search_results.innerHTML = ''

    let search = document.getElementById('find')
    let breadcrumbs = document.getElementById('breadcrumbs').value
    let find_size = document.getElementById('find_size').value
    let start_date = document.getElementById('start_date').value
    let end_date = document.getElementById('end_date').value

    // CANCEL SEARCH
    search.addEventListener('keydown', function (e) {

        if (e.key === 'Escape') {

            console.log('esc pressed on keydown')

            // CLEAR ITEMS
            search.value = ''

            // FOCUS MAIN VIEW ON AFTER GETTING FILES
            let main_view = document.getElementById('main_view')
            main_view.focus()

        }

    })


    if (search.value > '' || find_size > '' || start_date > '' || end_date > '') {


        search_results.innerHTML = ''

        console.log('running find files')

        let options = {

            d: localStorage.getItem('find_folders'),
            f: localStorage.getItem('find_files'),
            start_date: start_date,
            end_date: end_date,
            size: find_size, //localStorage.getItem('find_by_size'),
            o: ' -o ',
            s: search.value
        }


        if (!options.d && !options.f) {
            alert('select file or folder filter')
            return
        }


        //  SIZE
        if (find_size != '') {
            let size_option = document.querySelector('input[name="size_options"]:checked').value
            options.size = '-size +' + options.size + size_option
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
        if (options.d != '' && options.s != '') {
            options.d = ' -type d ' + options.size + ' -iname "' + options.s + '*"'
        } else {
            options.d = ''
        }
        // FILES
        if (options.f != '' && options.s != '') {
            options.f = ' -type f ' + options.size + ' -iname "' + options.s + '*"'
        } else {
            options.f = ''
        }


        // OR
        if (options.d && options.f && options.s != '') {
            options.o = ' -or '
        } else {
            options.o = ''
        }


        search_results.innerHTML = 'Searching...'


        //  FIND FILES
        cmd = ' find "' + breadcrumbs + '" ' + options.start_date + options.end_date + options.size + options.d + options.o + options.f
        console.log(cmd)
        let child = exec(cmd)

        console.log(child)

        child.stdout.on('data', (res) => {

            res = res.split('\n')
            if (res.length > 0 && res.length < 500) {

                search_results.innerHTML = ''

                // let sort = res.sort((a, b) => {
                //     return (fs.statSync(a).isDirectory() - fs.statSync(b).isDirectory())
                //     // let stata = fs.statSync(a)
                //     // let statb = fs.statSync(b)
                //     // return (stata.isDirectory() === statb.isDirectory())? 0 : x? -1 : 1
                // })

                for (let i = 0; i < res.length; i++) {

                    try {

                        let filename = res[i]

                        if (fs.statSync(filename).isDirectory() || fs.statSync(filename).isFile()) {

                            let options = {

                                id: 'find_file_' + i,
                                linktext: path.basename(filename),
                                href: filename,
                                grid: search_results

                            }

                            add_card(options)

                        }


                    } catch (err) {
                        notification(err)
                    }

                }

            }

        })

        child.stdout.on('end', (res) => {
            if (search_results.innerHTML == 'Searching...') {
                search_results.innerHTML = 'No results found......'
            }
        })


        show_sidebar()

    }


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

// LISTEN FOR CONTEXTMENU. DO NOT CHANGE THIS - I MEAN IT !!!!!!!!!!!!!!!!!!!!!!!!!
window.addEventListener('contextmenu', function (e) {

    console.log('context-menu')
    console.log('card id is: ' + card_id)

    let target = this.document.getElementById(card_id)

    // todo: clear the selected files array
    //       for now but this breaks multiple selects
    // selected_files = []

    let header

    if (target) {

        // GET REFERENCE TO HREF
        header = target.querySelector('a')

        // GET FOLDER NAME
        source = header.getAttribute('href')
        console.log(card_id)

        let filetype = mime.lookup(source)
        let associated_apps = get_available_launchers(filetype)

        // CHECK FOR FOLDER CARD CLASS
        if (target.classList.contains('folder_card')) {

            notification(1)
            ipcRenderer.send('show-context-menu-directory', associated_apps)

            // CHECK IF FILE CARD
        } else if (target.classList.contains('file_card')) {

            // notification(2)
            // ipcRenderer.send('open_with_applications', associated_apps)
            ipcRenderer.send('show-context-menu-files', associated_apps)

        } else {

            notification(3)

            // clear_selected_files()
            // let data = []
            // data.push(breadcrumbs.value)
            ipcRenderer.send('show-context-menu')

        }

        target = ''
        // console.log(target)

    } else {

        notification(4)

        let data = {
            source: path.join(__dirname, 'assets/templates/'),
            destination: breadcrumbs.value + '/'
        }

        ipcRenderer.send('show-context-menu', data)



        // // ON COPY COMPLETE
        // ipcRenderer.on('copy-complete', function (e) {
        //     get_files(breadcrumbs.value, { sort: localStorage.getItem('sort') })
        // })



    }

})

// FUNCTIONS //////////////////////////////////////////////////////


var k = 0;
function show_top_progress(href) {

    let progress_bar = document.getElementById('progress')
    if (progress_bar) {

        progress_bar.classList.remove('hidden')

        setInterval(() => {

            k += 1
            if (progress_bar) {
                progress_bar.value = k
            }

        }, 1000);

    }

}

function hide_top_progress() {

    let progress = document.getElementById('progress')
    if (progress) {
        progress.classList.add('hidden')
    }

}

// SHOW PROGRESS
var k = 0;
function show_progress(card_id) {

    console.log('showing progress on card_id ' + card_id)


    let progress = document.getElementById('progress_' + card_id)
    if (progress) {
        progress.classList.remove('hidden')
    }

    let progress_bar = document.getElementById('progress_bar_' + card_id)

    setInterval(() => {

        k += 1
        if (progress_bar) {
            progress_bar.value = k
        }


    }, 1000);
    // progress_bar.value = 50

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

function get_stats(file_count, folder_count) {

    let stats = document.getElementById('file_stats')
    stats.innerText = file_count

}

// GET FOLDERS
function get_folders() {


    // // REF TO DOM ELEMENTS ON PAGE
    // const breadcrumbs = document.getElementById('breadcrumbs')
    // const stats = document.getElementById('folder_stats')
    // const directory = document.getElementById('folder_grid')
    // const folders_card = document.getElementById('folders_card')
    // const hidden_directory = document.getElementById('hidden_folder_grid')

    // directory.innerHTML = ''
    // hidden_directory.innerHTML = ''

    // let prev_size = 0
    // let size = 0

    // // GET FILESz
    // get_files(dir,options,function({files}){

    //     breadcrumbs.value = dir

    //     let folders = files.filter(file => file.is_dir == true)
    //     folders_card.classList.remove('hidden')

    //     // HIDE FOLDERS CARD
    //     if(folders.length == 0) {
    //         folder_grid.classList.add('hidden')
    //         folders_card.classList.add('hidden')
    //     }

    //     // TEST FOR HIDDEN DIRECOTRY
    //     const regex = /^\..*/

    //     folders.forEach((file, idx)=>{

    //         let breadcrumbs = document.getElementById('breadcrumbs')
    //         let target_path = file.dir

    //         // CREATE FOLDERS CONTAINER
    //         let folders = add_div()
    //         folders.classList.add('column', 'three', 'wide')

    //         // CREATE OPTIONS OBJECT
    //         let options = new item_options()

    //         // DEFINE OPTIONS
    //         options.id = 'folder_card_' + idx
    //         options.linktext = file.name
    //         options.href = file.dir
    //         options.image = get_icon_path(file.dir)
    //         options.description = file.mtime
    //         options.is_directory = file.is_dir

    //         // GET FOLDER SIZE
    //         let folder_size = 0

    //         // CREATE FOLDER CARD
    //         let folder_card //= add_card(options,idx)

    //         // IF NOT HIDDEN
    //         if(!regex.test(file.name)){

    //             folder_card = add_card(options)

    //             // ADD ELEMENTS TO PAGE
    //             folders.appendChild(folder_card)

    //             // ADD FOLDER TO DIRECTORY
    //             directory.appendChild(folders)

    //         // IF HIDDEN
    //         } else if(regex.test(file.name)) {

    //             folder_card = add_card(options)

    //             // ADD ELEMENTS TO PAGE
    //             folders.appendChild(folder_card)

    //             // ADD FOLDER TO DIRECTORY
    //             hidden_directory.appendChild(folders)

    //             // hidden_directory.classList.add('hidden')

    //         }

    //         dir_grid.classList.remove('hidden')

    //     })

    // })

}

// ANOTHER GET ALL FILES
const get_files_recursive = function (source) {

    // files = fs.readdir(dirPath, (err, files)){

    files_arr = []
    fs.readdir(source, (err, files) => {
        if (err)
            console.log(err);
        else {
            console.log("\nCurrent directory filenames:");
            files.forEach(file => {

                if (fs.statSync(source).isDirectory()) {
                    files_arr = get_files_recursive(source)
                } else {
                    files_arr.push(file)
                }

                console.log(file);
            })
        }
    })

}



// RUN SHELL command
function run_shell_command(command, callback) {

    exec(command, function (err, stdout, stderr) {
        if (err) {
            callback(stderr);
        } else {
            callback(stdout);
        }
    });

}


// PASTE
function paste() {

    // RUN COPY FUNCTION
    copy_files(breadcrumbs.value)

    // CLEAN UP
    clear_selected_files()

    // CLEAR COPY ARRAY
    copy_files_arr = []



}


function messagebox(msg_header, msg_content) {

    let message = document.getElementById('messagebox')

    let modal = add_div()
    header = add_div()
    content = add_div()
    actions = add_div()

    // modal.id = "messagbox"

    modal.classList.add('ui', 'modal', 'centered')
    header.classList.add('ui', 'header')
    modal.backgroundColor = '#000000'
    content.classList.add('content')
    actions.classList.add('actions')

    header.innerHTML = msg_header
    content.innerHTML = msg_content


    modal.appendChild(header)
    modal.appendChild(content)
    // modal.appendChild(actions)
    modal.classList.add('active')

    message.appendChild(modal)

    // return modal
    // div class="ui basic modal">
    // <div class="ui icon header">


    {/* <i class="archive icon"></i>
        Archive Old Messages
    </div>
    <div class="content">
        <p>Your inbox is getting full, would you like us to enable automatic archiving of old messages?</p>
    </div>
    <div class="actions">
        <div class="ui red basic cancel inverted button">
        <i class="remove icon"></i>
        No
        </div>
        <div class="ui green ok inverted button">
        <i class="checkmark icon"></i>
        Yes
        </div>
    </div>
</div> */}

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

// ADD COLUNN
function add_column(length) {
    let div = document.createElement('div')
    div.classList.add('column', length, 'wide')
    return div
}

// ADD ROW
function add_row() {
    let div = document.createElement('div')
    div.classList.add('row')
    return div
}

// ADD HEADER
function add_header(text) {
    let header = document.createElement('div')
    header.classList.add('ui', 'header')
    header.innerHTML = text
    return header
}

// ADD ITEM
function add_item(text) {
    let item = document.createElement('div')
    item.classList.add('item')
    item.innerHTML = text
    return item
}

// ADD BUTTON
function add_button(id, text) {
    let button = document.createElement('input')
    button.type = 'button'
    button.classList.add('ui', 'button', 'default')
    button.value = text
    return button
}

// ADD CHECKBOX
function add_checkbox(id, label) {

    let checkbox = add_div()
    checkbox.classList.add('ui', 'checkbox')

    let chk_label = add_label(label)
    chk_label.htmlFor = id

    let chk = document.createElement('input')
    chk.type = "checkbox"
    chk.id = id

    checkbox.append(chk)
    checkbox.append(chk_label)

    return checkbox

}

// ADD LABEL
function add_label(text) {
    let label = document.createElement('label')
    label.innerHTML = text
    return label
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
    img.style.float = 'left'
    img.style.paddingRight = '5px'
    img.width = 32
    img.height = 32
    img.src = src
    return img
}

// RETURNS A STRING PATH TO AN ICON IMAGE BASED ON FILE EXTENSION

let icon_theme = execSync('gsettings get org.gnome.desktop.interface icon-theme').toString().replace(/'/g, '').trim()
let icon_dir = path.join('/usr/share/icons', icon_theme)

let folder_icon_path = ''
let folder_icon_path0
console.log(icon_dir,fs.existsSync(icon_dir))

if (fs.existsSync(icon_dir) == false) {
    console.log(icon_dir)
    icon_dir = path.join(path.join(get_home(), '.icons'), icon_theme)
} else {

}

function get_icon_path(file) {

    try {

        let stats = fs.statSync(file)
        let file_ext = path.extname(file)
        // let mimetype = mime.lookup(file)

        // mem = os.totalmem()  // environ.get('MESON_INSTALL_PREFIX', '/usr/local')
        // info(get_file_size(mem))

        // datadir = os.path.join(prefix, 'share')
        // console.log('icon dir', icon_dir, 'icon dir 0', icon_dir0)

        if (stats.isDirectory()) {
            icon = path.join(__dirname, '/assets/icons/korla/places/scalable/folder.svg')
        } else if (stats.isFile()) {

            icon_dir = path.join(__dirname,'/assets/icons/korla')
            console.log(icon_dir)

            if (file_ext.toLocaleLowerCase() == '.jpg' || file_ext.toLocaleLowerCase() == '.png' || file_ext.toLocaleLowerCase() == '.jpeg' || file_ext.toLocaleLowerCase() == '.gif' || file_ext.toLocaleLowerCase() == '.svg' || file_ext.toLocaleLowerCase() == '.ico' || file_ext.toLocaleLowerCase() == '.webp') {
                icon = file
            } else if (file_ext == '.xls' || file_ext == '.xlsx' || file_ext == '.xltx' || file_ext == '.csv') {
                icon = path.join(icon_dir,'/apps/scalable/ms-excel.svg') //../assets/icons/korla/apps/scalable/libreoffice-calc.svg'
            } else if (file_ext == '.docx' || file_ext == '.ott' || file_ext == '.odt') {
                icon = path.join(icon_dir,'/apps/scalable/libreoffice-writer.svg')
            } else if (file_ext == '.wav' || file_ext == '.mp3' || file_ext == '.mp4' || file_ext == '.ogg') {
                icon = path.join(icon_dir,'/mimetypes/scalable/audio-wav.svg')
            } else if (file_ext == '.iso') {
                icon = path.join(icon_dir,'/apps/scalable/isomaster.svg')
            } else if (file_ext == '.pdf') {
                icon = path.join(icon_dir,'/apps/scalable/gnome-pdf.svg')
            } else if (file_ext == '.zip' || file_ext == '.xz' || file_ext == '.tar' || file_ext == '.gz' || file_ext == '.bz2') {
                icon = path.join(icon_dir,'/apps/scalable/7zip.svg')
            } else if (file_ext == '.deb') {
                icon = path.join(icon_dir, '/apps/scalable/gkdebconf.svg')
            } else if (file_ext == '.txt') {
                icon = path.join(icon_dir,'/apps/scalable/text.svg')
            } else if (file_ext == '.sh') {
                icon = path.join(icon_dir,'/apps/scalable/terminal.svg')
            } else if (file_ext == '.js') {
                icon = path.join(icon_dir,'/apps/scalable/applications-java.svg')
            } else if (file_ext == '.sql') {
                icon = path.join(icon_dir,'/mimetypes/scalable/application-x-sqlite.svg')
            } else {
                icon = path.join(icon_dir,'/mimetypes/scalable/application-document.svg')
            }



        }


    } catch (err) {
        // icon = path.join(icon_dir,'/mimetypes/scalable/application-document.svg')
    }



    return icon

}

// ADD LINK
function add_link(href, text) {
    let link = document.createElement('a')
    link.href = href
    link.text = text
    link.classList.add('header_link')
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

// ADD ICON
function add_header(text) {
    let header = document.createElement('h4')
    header.classList.add('ui', 'header')
    header.innerHTML = text
    return header
}

function logKey(e) {
    console.log(e.code)
}

// RENDER FILES
function get_folder_files(dir, options) {

    // // CLEAR SELECTED FILES ARRAY
    // selected_files.length = 0
    // console.log('clearing array')

    // REF TO DOM ELEMENTS ON PAGE
    let files_card = document.getElementById('files_card')
    let file_grid = document.getElementById('file_grid')
    let file_grid_hidden = document.getElementById('file_grid_hidden')

    file_grid.innerHTML = ''
    file_grid_hidden.innerHTML = ''

    // CREATE GRID
    let grid = add_div()
    grid.classList.add('ui', 'grid')

    // CREATE COLUMN
    let column = add_div()
    column.classList.add('column', 'sixteen', 'wide')

    // ADD COLUMN TO GRID
    grid.appendChild(column)

    // CREATE SECOND GRID
    let grid1 = add_div()
    grid1.classList.add('ui', 'grid')

    let size = 0
    let prev_size = 0

    get_files(dir, options, function ({ files }) {


        // FILES FILTER
        let filter = files.filter(file => !file.is_dir)
        // console.log('files ' + files.is_dir + ' length ' + filter.length)

        // HIDE FILES CARD IF NO FILES FOUND
        files_card.classList.remove('hidden')
        if (filter.length == 0) {
            // console.log('adding hidden to files_card')
            files_card.classList.add('hidden')
        }

        // FILTER EXTENSION
        let exts = Array.from(new Set(filter.map(ext => ext.extension)))

        // LOOP OVER EXTENSION
        exts.forEach((ext, idx) => {

            // CREATE HEADER LABEL
            let label = document.createElement('h5')
            // label.setAttribute('draggable',true)
            label.innerText = ext

            // CREATE HEADER COLUMN
            let header_col = add_div()
            header_col.classList.add('column', 'sixteen', 'wide')
            header_col.appendChild(label)

            // ADD HEADER COLUMN TO GRID 1
            grid1.appendChild(header_col)

            // ADD GRID 1 TO FILE GRID
            file_grid.appendChild(grid1)

            // ADD SECOND FILTER HERE
            let filter1 = []
            filter1 = filter.filter(file_ext => file_ext.extension == ext)

            // LOOP OVER EACH FILE IN FILES
            // filter1.forEach((file,idx1) => {
            for (let i = 0; i < filter1.length; i++) {

                let options = new item_options()

                // CREATE COLUMN 1
                let column1 = add_div()
                column1.classList.add('column', 'three', 'wide')

                // CREATE OPTIONS FOR ITEM
                options.id = 'file_card_' + idx + i

                options.href = filter[i].dir

                options.linktext = filter[i].name
                options.image = get_icon_path(filter[i].dir)
                options.description = filter[i].mtime
                options.is_directory = filter[i].is_dir

                // ADD FILE CARD
                let file_card = add_card(options, i)
                console.log('adding file card')

                // ADD FILE STATS !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                // prev_size = size
                // size = prev_size + filter[i].size

                // ADD CARD 1 TO COLUMN 1
                column1.appendChild(file_card)

                // ADD COLUMN1 TO GRID 1
                grid1.appendChild(column1)

            }

            // REMOVE HIIDEN FROM FILE GRID
            file_grid.classList.remove('hidden')

        })

    })

    grid.appendChild(grid1)

    // ADD GRID TO FILE GRID
    file_grid.appendChild(grid1)

    // console.log('removing')

}



// ADD HEADER MENU ITEM
function add_menu_item(options) {

    let item = document.createElement('a')
    item.classList.add('item')
    item.id = options.id

    let icon = document.createElement('i')
    icon.classList.add(options.icon, 'icon')

    let content = document.createElement('div')
    content.innerText = "shit"

    item.appendChild(icon)
    item.appendChild(content)

    const header_menu = document.getElementById('header_menu')
    header_menu.appendChild(item)

}


// SHOW SIDE BAR
let sidebar_visible = 0
function show_sidebar() {

    console.log('show sidebar')

    // SHOW / HIDE SIDEBAR
    let sidebar = document.getElementById('sidebar')
    let main_view = document.getElementById('main_view')

    sidebar.draggable = false
    sidebar.classList.remove('hidden')
    let sidebar_width = 250
    if (localStorage.getItem('sidebar_width')) {
        sidebar_width = localStorage.getItem('sidebar_width')
    } else[
        localStorage.setItem('sidebar_width', sidebar_width)
    ]

    sidebar.style.width = sidebar_width + 'px'
    // sidebar.style.minWidth = '200px'
    // main_view.style.minLeft = '250px'
    // main_view.style.marginLeft = '270px' //sidebar_width
    main_view.style.marginLeft = (parseInt(sidebar_width) + 10) + 'px'

    let accordion = document.getElementById('accordion')
    accordion.focus()

    console.log('setting focus')

    sidebar_visible = 1

}

// // HIDE SIDE BAR
function hide_sidebar() {

    // SHOW / HIDE SIDEBAR
    let sidebar = document.getElementById('sidebar')
    let main_view = document.getElementById('main_view')

    sidebar.style.width = "0";
    sidebar.classList.add('hidden')

    main_view.style.marginLeft = "5px";

    sidebar_visible = 0

}

// NOTIFICATION
window.notification = function notification(msg) {

    let notification = document.getElementById('notification')
    notification.innerHTML = msg
    notification.classList.remove('hidden')
    setInterval(() => {
        notification.classList.add('hidden')
    }, 3000);
}


// CREATE FOLDER
function create_folder(folder) {

    fs.mkdir(folder, {}, (err) => {

        console.log('folder is ' + folder)

        if (err) {

            notification(err)
            alert(err)

        } else {

            // GET REFERENCE TO FOLDERS CARD
            let folders_card = document.getElementById('folders_card')
            folders_card.classList.remove('hidden')

            // GET REFERENCE TO FOLDER GRID
            let folder_grid = document.getElementById('folder_grid')

            let items = document.getElementsByClassName('folder_card')
            let card_id = 'folder_card_' + items.length

            // CREATE CARD OPTIONS
            let options = {

                id: card_id,
                href: folder,
                linktext: path.basename(folder),
                grid: folder_grid

            }

            try {

                add_card(options).then(card => {

                    folder_grid.insertBefore(card, folder_grid.firstChild)

                    let header = document.getElementById('header_' + card_id)
                    header.classList.add('hidden')

                    let input = card.querySelector('input')
                    input.classList.remove('hidden')

                    //
                    input.focus()
                    input.select()

                    update_cards(folder_grid)

                })

            } catch (err) {

                notification(err)
                info(err)

            }

            // // ADD CARD
            // let card = add_card(options)
            // // column.appendChild(card)
            // folder_grid.insertBefore(card, folder_grid.firstChild)

            // INPUT
            // let input = card.getElementsByTagName('input')
            // input[0].classList.remove('hidden')
            // input[0].focus()
            // input[0].select()

            // console.log(card_id)

            // let header = document.getElementById('header_' + card_id)
            // header.classList.add('hidden')

            console.log('Created ' + path.dirname(folder));

        }

    })

    clear_selected_files()

}

// RENAME FOLDER
function rename_folder(directory, new_directory) {

    fs.rename(directory, new_directory, function (err) {
        if (err) {
            notification(err)
            console.log(err)
        } else {
            notification('Folder renamed successfully')
            console.log('Folder renamed successfully!');
        }
    })


}

// COPY FILES
async function copy_files(destination_folder) {

    // RESET COUNTER. HANDLES SETTING ROOT FOLDER SO THE SIZE CAN BE UPDATED
    copy_folder_counter = 0
    ipcRenderer.send('get_copy_files', destination_folder)

}


// todo: need to figure out when this is done

// COPY FILE SYNC
let number_of_files = 0
let recursive = 0

function copyFileSync(source, target) {

    let main_view = document.getElementById('main_view')

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

                notification('done copying folder files to ' + root)

                // CLEAR PROGRESS
                clearInterval(interval_id)

                hide_top_progress()
                // if (progress) {
                //     progress.classList.add('hidden')
                // }

                c = 0

                // UPDATE CARDS
                let folder_grid = document.getElementById('folder_grid')
                update_cards(main_view)

            } else {

                console.log('copying folder files to ' + root)
            }
            // console.log('copied file from ' + source + ' to ' + targetFile)
        }
    })



}

// COPY FOLDER
let root = ''
let copy_folder_counter = 0
function copyFolderRecursiveSync(source, destination) {


    console.log('folder_count ' + folder_count)
    copy_folder_counter += 1

    // notification('copy folder source ' + source)
    // notification('destination ' + destination)

    console.log('source ', source, ' destination ', destination)

    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination);

        let folder_card = document.getElementsByClassName('folder_card')
        let grid = document.getElementById('folder_grid')

    } else {

        fs.mkdirSync(destination + ' Copy');

    }

    // COPY
    // READ SOURCE DIRECTORY
    fs.readdir(source, function (err, files) {

        if (err) {
            console.log(err)
        } else {

            // CHECK LENGTH
            if (files.length > 0) {

                // FILES COUNT FOR PROGRESS BAR
                number_of_files = files.length

                // // SET UP PROGRESS BAR
                // let progress = document.getElementById('progress')
                // progress.classList.remove('hidden')
                // progress.value = 1
                // progress.max = number_of_files

                // progress.max = files.length

                console.log('getting folder size of ' + root)
                // ipcRenderer.send('get_folder_size', { href: root })

                // LOOP OVER FILES
                let c = 0
                files.forEach((file, idx) => {

                    // GET FOLDER SIZE WORKS HERE KIND OF!!!. RUNS TOO MANY TIMES.
                    // todo: need to figure out how to handle this better

                    // console.log('getting folder size of ' + root)
                    // ipcRenderer.send('get_folder_size' ,{href: root })

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


                                // UPDATE FOLDER_SIZE
                                // ipcRenderer.send('get_folder_size', { href: destination })


                                // FILE
                            } else if (stats.isFile() == true) {

                                // console.log('copying file ' + file + ' to ' + curdestination + ' idx ' + idx + ' length ' + files.length)
                                // progress.value = idx

                                // debugger
                                copyFileSync(cursource, curdestination)

                                // GET FOLDER SIZE
                                // DOES NOT WORK HERE
                                // ipcRenderer.send('get_folder_size', destination)


                                // c++
                                // if (c === files.length) {

                                //     // PROGRESS BAR ON TOP
                                //     setTimeout(() => {
                                //         progress.value = 0
                                //         progress.classList.add('hidden')
                                //     }, 1000);

                                // }

                                // GET FOLDER_SIZE
                                // DOES NOT WORK HERE

                            }


                            // DONT GET DISK SPACE HERE


                        }

                    })


                })

            }

        }

    })

}


// MOVE FOLDER
function move_to_folder(end_path) {


    if (copy_files_arr.length == 0) {
        alert('i did not find anything to copy.')
        return false
    }

    console.log(copy_files_arr.length)

    copy_files_arr.forEach(file => {

        // let stats = fs.statqSync(file.source)

        let data = {
            source: file.source,
            destination: path.join(end_path, path.basename(file.source))
        }

        console.log(data.source, data.destination)

        // Check folder
        if (fs.existsSync(destination)) {

            ipcRenderer.send('show_overwrite_move_dialog', data)

        } else {

            msg = 'Confirm move to ' + end_path
            ipcRenderer.send('confirm_move', data)

        }

        // ipcRenderer.send('show_confirm_dialog', data)

        // // Directory
        // if (stats.isDirectory()) {



        // // File
        // } else {



        // }

    })

    clear_copy_arr()

    // console.log('len ' + copy_files_arr.length)
    // msg = 'Confirm move to ' + end_path

    // ipcRenderer.send('')

    // ipcRenderer.send('confirm_move', msg)

}

// UPDATE PARENT SET LOCAL STORAGE SIZE
function update_parent() {

    // GET FOLDER SIZE
    let parent_folder = breadcrumbs.value
    ipcRenderer.send('get_folder_size', { href: parent_folder })

    // ipcRenderer.on('folder_size', (e, args) => {
    //     localStorage.setItem(parent_folder, get_file_size(args.size))
    // })

}

// CREATE FILE FROM TEMPLATE
function create_file_from_template(filename) {

    let template = path.join(__dirname, 'assets/templates/', filename)
    let destination = path.join(breadcrumbs.value, filename)

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

                    // let files_card = document.getElementById('files_card')
                    // files_card.classList.remove('hidden')

                    let file_grid = document.getElementById('file_grid')
                    file_grid.insertBefore(card, file_grid.firstChild)



                    let input = card.getElementsByTagName('input')
                    input[0].classList.remove('hidden')
                    input[0].focus()
                    input[0].select()

                    console.log(card_id)

                    let header = document.getElementById('header_' + card_id)
                    header.classList.add('hidden')

                    update_parent()

                    // update_cards()

                })

            } catch (err) {

                notification(err)

            }

        }

    }

    clear_selected_files()

}


// // CREATE FILE FROM TEMPLATE
// ipcRenderer.on('create_file_from_template', function (e, file) {
//     console.log('im running too many times')
//     create_file_from_template(file.file)

// })


// RENAME FILE OR FOLDER
function rename_file(directory, new_name) {

    let exixts = fs.existsSync(new_name)

    if (exixts) {

        alert(new_name + ' already exists!')

    } else {
        fs.rename(directory, new_name, function (err) {
            if (err) {

                console.log(err)

            } else {

                console.log('File/folder renamed successfully!');
                notification('renamed ' + directory + ' to ' + new_name);

                let card = document.getElementById(card_id)
                let input = card.querySelector('input')
                let header = card.querySelector('a')

                let href = new_name //path.join(path.dirname(directory), input.value)
                card.dataset.href = href

                card.classList.remove('highlight')
                let stats = fs.statSync(href)
                let file_size = stats.size
                let mtime = stats.mtime
                card.title =
                    href +
                    '\n' +
                    file_size +
                    '\n' +
                    mtime

                input.classList.add('hidden')

                header.classList.remove('hidden')
                header.text = input.value
                header.href = href
                header.title = 'open file? ' + path.dirname(href) + '/' + input.value

                source = href

                header.focus()


            }
        })
    }



}


// DELETE CONFIRMED
function delete_confirmed() {


    // LOOP OVER ITEMS DELETE ARRAY
    if (delete_arr.length > 0) {

        delete_arr.forEach((file, idx) => {

            card_id = file.card_id
            console.log('file source ' + file.source + ' card_id ' + file.card_id)

            // CLEAR HREF LOCAL STORAGE
            console.log('href ' + file.source)
            localStorage.setItem(file.source, '')

            // IF DIRECTORY
            if (fs.statSync(file.source).isDirectory()) {

                // console.log('running delete folder on ' + file.source)
                console.log('running delete folder ' + file.source + ' card_id ' + file.card_id)

                // DELETE FOLDER
                delete_folder(file.source)

                // IF FILE
            } else if (fs.statSync(file.source).isFile()) {

                console.log('running delete file ' + file.source + ' card_id ' + file.card_id)

                // DELETE FILE
                delete_file(file.source)

            }


            // // REMOVE CARD
            // let card = document.getElementById(file.card_id)
            // let col = card.closest('.column')
            // col.remove()

            // // UPDATE CARDS
            // update_cards(main_view)

        })


        // ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: 0,file_count: 0 })

        // CLEAR DELETE ARRAY
        delete_arr = []
        clear_selected_files()


        // UPDATE CARDS
        update_cards(main_view)



    } else {
        console.log('nothing to delete')
        // indexOf('Nothing to delete.')
    }

}


// DELETE FILE
async function delete_file(file) {

    console.log('deleting file ' + file)
    notification('deleting file ' + file)

    let main_view = document.getElementById('main_view')

    let stats = fs.statSync(file)

    if (stats) {

        if (stats.isFile()) {

            fs.unlink(file, function (err) {

                if (err) {

                    clear_selected_files()

                    notification('Error deleting file: ' + source + ' \n' + err)
                    console.log('Error deleting file: ' + source + ' \n' + err)


                } else {

                    notification('deleted file ' + file)
                    // ipcRenderer.send('get_folder_size', { href: breadcrumbs.value })

                    // HIDE PROGRESS
                    // hide_top_progress()

                    let card = document.querySelector('[data-href="' + file + '"]')
                    let col = card.closest('.column')
                    col.remove()

                    // UDATE CARDS
                    update_cards(main_view)

                }

            })


        } else {

            notification('error deleted file ' + source)
            console.log('Error deleting file: ' + source)
        }

    }

}

// DELETE FOLDER
function delete_folder(directory) {

    // let breadcrumbs = document.getElementById('breadcrumbs')
    notification('running delete foder')
    console.log('direcotry = ' + path.basename(directory))

    // CHECK IF YOU ARE ABOUT TO WACK IMPORTANT FOLDER
    if (breadcrumbs.value == 'Documents' || breadcrumbs.value == 'Home' || breadcrumbs.value == 'Downloads' || breadcrumbs.value == 'Pictures' || breadcrumbs.value == 'Music') {

        alert('This is a system Directory. Do not delete!')
        return 0

    } else {

        // CHECK IF ITS A DIRECTORY
        if (fs.statSync(directory).isDirectory()) {

            // DELETE FOLDER
            fs.rmdir(directory, { recursive: true }, (err) => {

                if (err) {

                    notification(err)
                    console.error(err)

                } else {

                    // COUNT ITEMS IN MAIN VIEW
                    folder_count = get_folder_count()
                    file_count = get_file_count()

                    let card = document.querySelector('[data-href="' + directory + '"]')
                    let col = card.closest('.column')
                    col.remove()

                    // update_cards(main_view)

                    // hide_progress(card_id)
                    notification('Deleted directory ' + directory)
                    ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: folder_count, file_count: file_count })

                }

            })

        } else {

            notification('Error: This is not directory!')
            console.log('Error: This is not directory!')

        }

    }

}


function get_folder_count() {
    let main_view = document.getElementById('main_view')
    let folder_cards = main_view.querySelectorAll('.folder_card')
    return folder_cards.length
}


function get_file_count() {
    let main_view = document.getElementById('main_view')
    let file_cards = main_view.querySelectorAll('.file_card')
    return file_cards.length
}


// CALCULATE FILE SIZE
function get_file_size(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];

};

function get_raw_file_size(fileSizeInBytes) {
    var i = -1;
    // var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1);

};


// OPEN TERMINAL
function get_terminal() {

    exec('gnome-terminal --working-directory=' + breadcrumbs.value, (error, data, getter) => {

    });

}
// COUNTERS
let click_counter = 0
let history_arr_size = 0
let idx = 0

// SET FALG FOR HISTORY MANAGEMENT
let is_navigate = false;

// NAVIGATE FUNCTION LEFT RIGHT UP
function navigate(direction) {

    is_navigate = true;
    let directory = breadcrumbs.value

    history_arr_size = history_arr.length

    if (direction === 'left') {

        idx = idx - 1
        if (idx < 0) {
            idx = history_arr_size
        }

        directory = path.dirname(directory)
        // directory = history_arr[idx - 1].dir
        // cout.append(idx + ' ' + directory)

    } else if (direction === 'right') {

        idx = idx + 1
        if (idx < history_arr.length) {
            directory = history_arr[idx - 1].dir
            // console.log(idx + ' ' + directory)
        }
    }

    //   loaddata(directory)
    get_files(directory, options)

}


// function update_card(card) {

//     let href = card.querySelector('.header_link').getAttribute('href')
//     let extra = card.querySelector('.extra')
//     let description = card.querySelector('.description')

//     console.log(href)

//     let stats = fs.statSync(href)

//     let mtime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)

//     description.innerHTML = mtime

// }


// UPDATE CARDS WITH
function update_cards(view) {

    console.log('running card update')

    // let folder_count = main_view.querySelectorAll('folder_card').length
    // let file_count = main_view.querySelectorAll('folder_card').length

    // let main_view = document.getElementById('main_view')
    // let main_view = document.querySelectorAll(view)

    let cards = view.querySelectorAll('.nav_item')
    let size = ''
    cards.forEach((card, idx) => {

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
        let mtime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)

        card.tabIndex = idx
        card.dataset.id = idx + 1

        description.innerHTML = mtime

        // HANDLE DIRECTORY
        if (stats.isDirectory()) {

            card.id = 'folder_card_' + idx
            card.dataset.id = idx + 1
            card.tabIndex = idx

            progress.id = 'progress_' + card.id
            progress_bar.id = 'progress_bar_' + card.id

            console.log('updating cards ' + card.id)

            card.classList.add('folder_card')

            // GET FILES
            header.addEventListener('click', (e) => {
                e.preventDefault()
                get_files(href)
            })

            img.src = path.join(icon_dir, '-pgrey/places/scalable@2/network-server.svg')
            img.height = '24px'
            img.width = '24px'

            ipcRenderer.send('get_folder_size', { href: href })

            // CARD ON MOUSE OVER
            card.addEventListener('mouseover', (e) => {
                size = localStorage.getItem(href)
                card.title =
                    href +
                    '\n' +
                    size +
                    '\n' +
                    mtime
            })

        // FILES
        } else {

            card.id = 'file_card_' + idx
            card.dataset.id = idx + 1
            card.tabIndex = idx

            progress.id = 'progress_' + card.id
            progress_bar.id = 'progress_bar_' + card.id

            card.classList.add('file_card')

            // OPEN FILE
            header.addEventListener('click', (e) => {
                e.preventDefault()
                shell.openPath(href)
                return false
            })

            // if (href.indexOf('/gvfs') === -1) {

            size = get_file_size(stats.size)
            extra.innerHTML = size
            localStorage.setItem(href, stats.size)

            // CARD ON MOUSE OVER
            card.addEventListener('mouseover', (e) => {
                size = localStorage.getItem(href)
                card.title =
                    href +
                    '\n' +
                    size +
                    '\n' +
                    mtime
            })

            // }

        }

    })

    file_count = 0
    folder_count = 0

}


// EXTRACT HERE
function extract(source) {

    notification('extracting ' + source)
    console.log('to dest ' + breadcrumbs.value)

    let cmd = ''
    let us_cmd = ''
    let filename = ''

    let ext = path.extname(source).toLowerCase()

    switch (ext) {
        case '.zip':
            filename = source.replace('.zip', '')
            us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
            // us_cmd = "unzip '" + source + "' -d "
            cmd = "unzip '" + source + "' -d '" + filename + "'"
            break;
        case '.tar':
            filename = source.replace('.tar', '')
            // cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xzf "' + source + '" -C "' + filename + '"'
            us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
            cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xzf "' + source + '"'
            break;
        case '.gz':
            filename = source.replace('.tar.gz', '')
            us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
            cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xzf "' + source + '" -C "' + filename + '"'
            break;
        case '.xz':
            filename = source.replace('.tar.xz', '')
            filename = source.replace('.xz', '')
            us_cmd = "xz -l '" + source + "' | awk 'FNR==2{print $5}'"
            cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xf "' + source + '" -C "' + filename + '"'
            break;
        case '.bz2':
            filename = source.replace('.bz2', '')
            us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
            cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/bzip2 -dk "' + source + '"'
            break;

    }

    console.log('cmd ' + cmd)
    console.log('uncompressed size cmd ' + us_cmd)


    // CREATE DIRECTORY FOR COMPRESSED FILES
    if (fs.existsSync(filename)) {

        data = {
            source:source,
            destination: filename
        }

        // ipcRenderer.send('confirm_overwrite', data)

        let confirm_overwrite = confirm('Folder exists.\nWould you like to overwrite?\n')
        if (confirm_overwrite) {
            alert('overwrite confirmed')
        }


    } else {
        fs.mkdirSync(filename)
    }



    // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
    let card_id = document.querySelector('[data-href="' + source + '"]').id
    let progress_file_card = document.getElementById('progress_' + card_id)
    progress_file_card.classList.remove('hidden')

    progress = document.getElementById('progress_bar_' + card_id)

    console.log(progress)

    // GET UNCOMPRESSED SIZE
    let uncompressed_size = parseInt(execSync(us_cmd))

    console.log('size is ' + uncompressed_size)

    // SET MAX OF PROGRESS BAR
    // if (ext == '.xz') {
    progress.max = get_raw_file_size(uncompressed_size)
    // } else {
    // progress.max = uncompressed_size
    // }


    let c = 0
    interval_id = setInterval(() => {

        ++c

        console.log('ahhhh', uncompressed_size, filename, c)
        get_progress(uncompressed_size, filename, c)

    }, 1000);



    notification('executing ' + cmd)
    notification('source ' + source)
    console.log('executing ' + cmd)

    // THIS NEEDS WORK. CHECK IF DIRECTORY EXIST. NEED OPTION TO OVERWRITE
    exec(cmd, (err, stdout, stderr) => {

        if (err) {

            console.log('error ' + err)
            notification('error ' + err)

        } else {

            try {

                // GET REFERENCE TO FOLDER GRID
                let folder_grid = document.getElementById('folder_grid')

                // CREATE CARD OPTIONS
                let options = {
                    id: 'folder_card_10000',
                    href: filename,
                    linktext: path.basename(filename),
                    grid: folder_grid
                }

                //
                // let folder_grid = document.getElementById('folder_grid')
                notification('filename ' + filename)

                add_card(options).then(col => {

                    console.log(col)

                    // console.log('card ' + card)
                    folder_grid.insertBefore(col, folder_grid.firstChild)

                    let card = col.querySelector('.nav_item')
                    card.classList.add('highlight_select')

                    let header_link = card.querySelector('.header_link')
                    header_link.focus()

                    // CLEAR INTERVAL
                    clearInterval(interval_id)

                    // UPDATE CARDS
                    update_cards(folder_grid)


                })

            } catch (err) {

                console.log(err)
                notification(err)

            }

            clear_selected_files()
            notification('extracted ' + source)

        }

    })



}

// COMPRESS
function compress(source) {

    notification('compressing ' + source + ' to dest ' + breadcrumbs.value)

    let filename = path.basename(source) + '.tar.gz'
    let filepath = breadcrumbs.value

    let file_exists = fs.existsSync(path.join(filepath, filename))

    if (file_exists == true) {

        let msg = 'confirm overwrite'
        ipcRenderer.send('confirm_overwrite', msg)

        ipcRenderer.on('overwrite_canceled', (e, res) => {
            hide_progress()
        })


        // ipcRenderer.on('overwrite_confirmed', (e, res) => {

        //     notification('overwriting file ' + destination)

        //     // BUILD COMPRESS COMMAND
        //     let cmd = 'cd "' + filepath + '"; tar czvf "' + path.basename(source) + '.tar.gz" "' + path.basename(source) + '"' //var/www/websit'

        //     // let cmd = 'cd ' + breadcrumbs.value + ';/usr/bin/tar -xvf "' + source + '"'
        //     console.log('cmd ' + cmd)

        //     show_progress(card_id)
        //     exec(cmd, (err, stdout, stderr) => {

        //         if (!err) {

        //             try {

        //                 // GET REFERENCE TO FOLDER GRID
        //                 let grid = document.getElementById('file_grid')

        //                 // CREATE CARD OPTIONS
        //                 let options = {

        //                     id: 'file_card_10000',
        //                     href: filepath + '/' + filename,
        //                     linktext: filename,
        //                     grid: grid

        //                 }

        //                 //
        //                 // let folder_grid = document.getElementById('folder_grid')
        //                 notification('filename ' + filename)
        //                 add_card(options).then(card => {
        //                     grid.insertBefore(card, grid.firstChild)
        //                     // update_cards()
        //                 })

        //             } catch (err) {
        //                 notification(err)
        //             }

        //         } else {
        //             clear_selected_files()
        //             notification('error ' + err)
        //         }

        //     })

        //     clear_selected_files()

        // })

    } else {


        // BUILD COMPRESS COMMAND
        let cmd = 'cd "' + filepath + '"; tar czf  "' + path.basename(source) + '.tar.gz" "' + path.basename(source) + '"'


        // let cmd = 'cd ' + breadcrumbs.value + ';/usr/bin/tar -xvf "' + source + '"'
        console.log('cmd ' + cmd)

        exec(cmd, (err, stdout, stderr) => {

            // console.log(stdout)

            if (!err) {

                try {

                    // GET REFERENCE TO FOLDER GRID
                    let grid = document.getElementById('file_grid')

                    // CREATE CARD OPTIONS
                    let options = {

                        id: 'file_card_10000',
                        href: filepath + '/' + filename,
                        linktext: filename,
                        grid: grid
                    }

                    //
                    // let folder_grid = document.getElementById('folder_grid')
                    notification('filename ' + filename)

                    add_card(options).then(col => {

                        grid.insertBefore(col, grid.firstChild)

                        let card = col.querySelector('.card')
                        card.classList.add('highlight_select')
                        update_cards(grid)

                    })

                } catch (err) {

                    notification(err)

                }

                // hide_progress(card_id)
                clear_selected_files()


            } else {
                notification('error: ' + err)
            }

        })



        let c = 0
        let stats
        let stats1
        let href_stats = fs.statSync(source)
        let href_size = href_stats.size

        console.log('source is ' + source)

        // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
        let progress_file_card = document.getElementById('progress_' + card_id)
        let progress_bar = document.getElementById('progress_bar_' + card_id)

        progress_file_card.classList.remove('hidden')

        var interval_id = setInterval(() => {

            // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
            // let progress_file_card = document.getElementById('progress_' + card_id)
            // let progress_bar = document.getElementById('progress_bar_' + card_id)

            // progress_file_card.classList.remove('hidden')

            let file = path.join(filepath, filename)
            let file_exists = fs.existsSync(file)

            // COUNT ELAPSED SECONDS
            c = c + 1

            if (file_exists) {
                stats1 = stats
                stats = fs.statSync(file)

                // LET STATS1 GET POPULATED
                if (c > 1) {

                    // EXIT INTERVAL IF FILE SIZE DOESNT CHANGE
                    if (stats1.size == stats.size) {
                        progress_file_card.classList.add('hidden')
                        clearInterval(interval_id)
                    }

                }

                // CALCULATE TRANSFER RATE
                let transferspeed = stats.size / c
                let transfer_time = href_size / transferspeed
                let transfer_data_amount = transferspeed * transfer_time

                // CHECK PROGRESS
                // console.log('uncompressed size is  ' + get_file_size(uncompressed_size))
                console.log('transfer speed is  ' + get_file_size(transferspeed))
                console.log('transfer time is  ' + get_file_size(transfer_time))
                console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                // UPDATE PROGRESS
                if (c < 5) {

                    if (fs.statSync(source).isDirectory() === true) {

                        console.log('running ' + source + '....................')

                        ipcRenderer.send('get_folder_size', { dir: source })

                        ipcRenderer.on('folder_size', (e, data) => {

                            transfer_time = data.size / transferspeed
                            progress_bar.max = Math.floor(transfer_time)

                            // // CHECK PROGRESS
                            // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                            // console.log('transfer time is  ' + Math.floor(transfer_time))
                            // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                        })

                    } else {
                        console.log('setting progress max to ' + Math.floor(transfer_time))
                        progress_bar.max = Math.floor(transfer_time)

                        // // CHECK PROGRESS
                        // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                        // console.log('transfer time is  ' + Math.floor(transfer_time))
                        // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                    }

                }

                if (progress_bar) {
                    progress_bar.value = c
                }

            }


        }, 1000);


        clear_selected_files()

    }
}


//////////////////////////////////////////////////////////////////

// DIRECTORY VARS
// let target
// let card
// let target_id = 0
// let target_path = ''
// let target_name = ''
// let is_dir = 0

// // FILE VARS
// let file_path = ''

// CONTEXT MENU COMMANDS
// FILES AND BLANK AREA
ipcRenderer.on('context-menu-command', (e, command, args) => {

    // console.log('running context command')
    // console.log('running context command ' + source)

    // OPEN TEMPLATES FOLDER
    if (command == 'open_templates_folder') {
        get_files(path.join(__dirname, 'assets/templates'), { sort: localStorage.getItem('sort') })
    }

    // console.log('command ' + args)

    // EXTRACT HERE
    if (command === 'extract_here') {

        extract(source)

        // notification('extracting using ' + source)
        // console.log('to dest ' + breadcrumbs.value)

        // let cmd = ''
        // let filename = ''

        // // .ZIP
        // if (path.extname(source).toLowerCase() == '.zip') {

        //     filename = source.replace('.zip', '')
        //     cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/unzip -a "' + source + '"'


        //     // .TAR
        // } else if (path.extname(source).toLowerCase() == '.tar') {

        //     filename = source.replace('.tar', '')
        //     cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar -xf "' + source + '" -C "' + filename + '"'

        //     // .GZ
        // } else if (path.extname(source).toLowerCase() == '.gz') {

        //     filename = source.replace('.tar.gz', '')
        //     cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar -xf "' + source + '" -C "' + filename + '"'
        //     // cmd = '/usr/bin/tar -xf "' + source + '" -C "' + filename + '"'

        //     // .XZ
        // } else if (path.extname(source).toLowerCase() == '.xz') {

        //     filename = source.replace('.xz', '')
        //     cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar -xf "' + filename + '"'

        // }

        // if (fs.existsSync(filename) === true) {

        //     console.log('error: file exists.')

        // } else {

        //     execSync('mkdir "' + filename + '"')

        // }


        // notification('executing ' + cmd)
        // notification('source ' + source)
        // console.log('executing ' + cmd)

        // // THIS NEEDS WORK. CHECK IF DIRECTORY EXIST. NEED OPTION TO OVERWRITE
        // exec(cmd, (err, stdout, stderr) => {

        //     if (err) {

        //         console.log('error ' + err)
        //         notification('error ' + err)

        //     } else {

        //         try {

        //             // GET REFERENCE TO FOLDERS_CARD
        //             // let folders_card = document.getElementById('folders_card')
        //             // folders_card.classList.remove('hidden')

        //             // GET REFERENCE TO FOLDER GRID
        //             let folder_grid = document.getElementById('folder_grid')

        //             // CREATE CARD OPTIONS
        //             let options = {

        //                 // id: card_id,
        //                 // href: folder,
        //                 // linktext: path.basename(folder),
        //                 // grid: folder_grid

        //                 id: 'folder_card_10000',
        //                 href: filename,
        //                 linktext: path.basename(filename),
        //                 grid: folder_grid
        //             }

        //             //
        //             // let folder_grid = document.getElementById('folder_grid')
        //             notification('filename ' + filename)

        //             add_card(options).then(col => {

        //                 console.log(col)

        //                 // console.log('card ' + card)
        //                 folder_grid.insertBefore(col, folder_grid.firstChild)

        //                 let card = col.querySelector('.nav_item')
        //                 card.classList.add('highlight_select')

        //                 let header_link = card.querySelector('.header_link')
        //                 header_link.focus()

        //                 // hide_progress(card_id)
        //                 // update_cards()

        //             })

        //         } catch (err) {

        //             console.log(err)
        //             notification(err)

        //         }

        //         clear_selected_files()
        //         notification('extracted ' + source)

        //     }

        // })

        // // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
        // let progress_file_card = document.getElementById('progress_' + card_id)
        // let progress_bar = document.getElementById('progress_bar_' + card_id)

        // progress_file_card.classList.remove('hidden')

        // // GET UNCOMPRESSED SIZE USING GZIP
        // let uncompressed_size = execSync("gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'")
        // progress_bar.max = uncompressed_size

        // let c = 0
        // let size = 0
        // var interval_id = setInterval(() => {

        //     c += 1

        //     ipcRenderer.send('get_folder_size', { href: filename })

        //     ipcRenderer.on('folder_size', (e, data) => {

        //         console.log('registering folder size listener')

        //         size = data.size

        //         let transferspeed = size / c
        //         let transfer_time = uncompressed_size / transferspeed
        //         let transfer_data_amount = size

        //         // CHECK PROGRESS
        //         console.log('uncompressed size is  ' + get_file_size(uncompressed_size))
        //         console.log('transfer speed is  ' + get_file_size(transferspeed))
        //         console.log('transfer time is  ' + get_file_size(transfer_time))
        //         console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

        //         progress_bar.value = transfer_data_amount

        //         if (size >= uncompressed_size) {

        //             progress_file_card.classList.add('hidden')
        //             clearInterval(interval_id)

        //         }

        //     })

        // }, 1000);


    }




    // COMPRESS HERE
    if (command === 'compress_folder') {

        notification('compressing ' + source + ' to dest ' + breadcrumbs.value)

        let filename = path.basename(source) + '.tar.gz'
        let filepath = breadcrumbs.value

        let file_exists = fs.existsSync(path.join(filepath, filename))

        if (file_exists == true) {

            let msg = 'confirm overwrite'
            ipcRenderer.send('confirm_overwrite', msg)

            ipcRenderer.on('overwrite_canceled', (e, res) => {
                hide_progress()
            })


            // ipcRenderer.on('overwrite_confirmed', (e, res) => {


            //     notification('overwriting file ' + destination)

            //     // BUILD COMPRESS COMMAND
            //     let cmd = 'cd "' + filepath + '"; tar czvf "' + path.basename(source) + '.tar.gz" "' + path.basename(source) + '"' //var/www/websit'

            //     // let cmd = 'cd ' + breadcrumbs.value + ';/usr/bin/tar -xvf "' + source + '"'
            //     console.log('cmd ' + cmd)

            //     show_progress(card_id)
            //     exec(cmd, (err, stdout, stderr) => {

            //         if (!err) {

            //             try {

            //                 // GET REFERENCE TO FOLDER GRID
            //                 let grid = document.getElementById('file_grid')

            //                 // CREATE CARD OPTIONS
            //                 let options = {

            //                     id: 'file_card_10000',
            //                     href: filepath + '/' + filename,
            //                     linktext: filename,
            //                     grid: grid

            //                 }

            //                 //
            //                 // let folder_grid = document.getElementById('folder_grid')
            //                 notification('filename ' + filename)

            //                 add_card(options).then(card => {

            //                     grid.insertBefore(card, grid.firstChild)

            //                     update_cards(grid)

            //                 })

            //             } catch (err) {

            //                 notification(err)

            //             }



            //         } else {
            //             clear_selected_files()
            //             notification('error ' + err)
            //         }

            //     })

            //     clear_selected_files()

            // })

        } else {


            // BUILD COMPRESS COMMAND
            let cmd = 'cd "' + filepath + '"; tar czf  "' + path.basename(source) + '.tar.gz" "' + path.basename(source) + '"'


            // let cmd = 'cd ' + breadcrumbs.value + ';/usr/bin/tar -xvf "' + source + '"'
            console.log('cmd ' + cmd)

            exec(cmd, (err, stdout, stderr) => {

                // console.log(stdout)

                if (!err) {

                    try {

                        // GET REFERENCE TO FOLDER GRID
                        let grid = document.getElementById('file_grid')

                        // CREATE CARD OPTIONS
                        let options = {

                            id: 'file_card_10000',
                            href: filepath + '/' + filename,
                            linktext: filename,
                            grid: grid
                        }

                        //
                        // let folder_grid = document.getElementById('folder_grid')
                        notification('filename ' + filename)

                        add_card(options).then(col => {

                            grid.insertBefore(col, grid.firstChild)

                            let card = col.querySelector('.card')
                            card.classList.add('highlight_select')
                            // update_cards()

                        })

                    } catch (err) {

                        notification(err)

                    }

                    // hide_progress(card_id)
                    clear_selected_files()


                } else {
                    notification('error: ' + err)
                }

            })



            let c = 0
            let stats
            let stats1
            let href_stats = fs.statSync(source)
            let href_size = href_stats.size

            console.log('source is ' + source)

            // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
            let progress_file_card = document.getElementById('progress_' + card_id)
            let progress_bar = document.getElementById('progress_bar_' + card_id)

            progress_file_card.classList.remove('hidden')

            var interval_id = setInterval(() => {

                // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
                // let progress_file_card = document.getElementById('progress_' + card_id)
                // let progress_bar = document.getElementById('progress_bar_' + card_id)

                // progress_file_card.classList.remove('hidden')

                let file = path.join(filepath, filename)
                let file_exists = fs.existsSync(file)

                // COUNT ELAPSED SECONDS
                c = c + 1

                if (file_exists) {
                    stats1 = stats
                    stats = fs.statSync(file)

                    // LET STATS1 GET POPULATED
                    if (c > 1) {

                        // EXIT INTERVAL IF FILE SIZE DOESNT CHANGE
                        if (stats1.size == stats.size) {
                            progress_file_card.classList.add('hidden')
                            clearInterval(interval_id)
                        }

                    }

                    // CALCULATE TRANSFER RATE
                    let transferspeed = stats.size / c
                    let transfer_time = href_size / transferspeed
                    let transfer_data_amount = transferspeed * transfer_time

                    // CHECK PROGRESS
                    // console.log('uncompressed size is  ' + get_file_size(uncompressed_size))
                    console.log('transfer speed is  ' + get_file_size(transferspeed))
                    console.log('transfer time is  ' + get_file_size(transfer_time))
                    console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                    // UPDATE PROGRESS
                    if (c < 5) {

                        if (fs.statSync(source).isDirectory() === true) {

                            console.log('running ' + source + '....................')

                            ipcRenderer.send('get_folder_size', { dir: source })

                            ipcRenderer.on('folder_size', (e, data) => {

                                transfer_time = data.size / transferspeed
                                progress_bar.max = Math.floor(transfer_time)

                                // // CHECK PROGRESS
                                // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                                // console.log('transfer time is  ' + Math.floor(transfer_time))
                                // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                            })

                        } else {
                            console.log('setting progress max to ' + Math.floor(transfer_time))
                            progress_bar.max = Math.floor(transfer_time)

                            // // CHECK PROGRESS
                            // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                            // console.log('transfer time is  ' + Math.floor(transfer_time))
                            // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                        }

                    }

                    if (progress_bar) {
                        // console.log('progress value is ' + get_file_size(c))
                        progress_bar.value = c
                    }

                    // // CHECK PROGRESS
                    // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                    // console.log('transfer time is  ' + Math.floor(transfer_time))
                    // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                }


            }, 1000);


            clear_selected_files()

        }

    }



    // RELOAD
    if (command === 'reload') {
        mainWindow.loadURL(mainAddr);
    }


    // NEW WINDOW
    if (command === 'new_window') {
        ipcRenderer.send('new_window')
    }

    // todo: these need input checking

    // CREATE NEW FOLDER
    if (command === 'new_folder') {

        let folder = breadcrumbs.value
        console.log(folder)

        if (folder != '') {
            create_folder(folder + '/Untitled Folder')
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
        let items = document.getElementsByClassName('highlight_select')
        if (items.length > 0) {

            // LOOP OVER ITEMS AND ADD TO DELETE ARRAY
            for (let i = 0; i < items.length; i++) {

                let item = items[i]
                let href = item.getAttribute('data-href')

                let file = {
                    card_id: item.id,
                    source: href
                }

                delete_arr.push(file)
                list += href + '\n'

            }

            ipcRenderer.send('confirm_file_delete', list)

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
    if (command === 'copy') {

        let highlight = document.querySelectorAll('.highlight, .highlight_select')

        if (highlight.length > 0) {

            let source
            let card_id
            highlight.forEach((item, idx) => {

                source = item.querySelector('a').getAttribute('href')
                card_id = item.id
                add_copy_file(source, card_id)

            })

        }

    }





    // PASTE COMMAND
    if (command === 'paste') {

        paste();

    }


    // DELETE FILE. DELETE COMMAND
    if (command === 'delete_file') {


        // console.log('source ' + source)

        // let source_list = ''
        // // clear_selected_files()

        // add_selected_file(source, card_id)
        // if(selected_files.length > 0) {

        //     selected_files.forEach((files,idx) => {
        //         source_list += files.source + '\n'
        //     })

        // }else {

        //     console.log('delete file source: ' + source)

        // }

        // console.log('source list ' + source_list)

        // // SEND A COMMAND TO MAIN TO SHOW A CONFIRMATION DIALOG
        // ipcRenderer.send('confirm_file_delete', source_list)

    }





    // // CONFIRM DELETE FOLDER
    // ipcRenderer.on('delete_folder_confirmed',(e, res) => {

    //     alert('what')

    //     // delete_confirmed()

    //     // if(fs.statSync(source).isDirectory()){

    // //   delete_folder(source)
    // //   console.log('delete folder confirmed ' + source)

    // // }else {

    // //   console.log('im a file. i should not be running ' + source)

    // // }

    // // CLEAR ARRAY
    // // clear_selected_files()
    //     // loaddata(breadcrumbs.value)

    // })


    // IF WE RECIEVE DELETE CONFIRMED THEN DELETE FILE/S
    ipcRenderer.on('delete_file_confirmed', (e, res) => {

        delete_confirmed()

    })

    // OPEN TERMINAL
    if (command === 'menu_terminal') {

        get_terminal()

    }

    // OPEN VSCODE
    if (command === 'vscode') {
        // notification('running vscode')
        console.log('running vscode')
        exec('cd "' + source + '"; code .')
        // execSync('cd "'  + breadcrumbs.value + '"; code .')
    }

    // OPEN WITH
    if (command === 'open_with_application') {

        // ipcRenderer.on('open_with_application', (e, res) => {

        let cmd = args

        console.log(args)

        // let filename = path.basename(source)
        // let filepath = path.dirname(source)

        cmd = cmd.replace('%U', "'" + source + "'")
        cmd = cmd.replace('%F', "'" + source + "'")

        cmd = cmd.replace('%u', "'" + source + "'")
        cmd = cmd.replace('%f', "'" + source + "'")

        console.log('cmd ' + cmd)
        exec(cmd)

        clear_selected_files()

    }

    // FILE PROPERTIES
    if (command === 'props') {

        ipcRenderer.send('get_file_properties', source)
        // get_file_properties(source)

    }

})


// RUN ON CONTEXT MENU CLOSE
ipcRenderer.on('clear_selected_files', (e, res) => {

    clear_selected_files()

})


window.addEventListener('DOMContentLoaded', () => {

    // CHECK WHAT THIS IS
    ipcRenderer.on('devices', (_event, text) => replaceText('devices', text))

    // GET GIO DEVICE LIST
    let device_grid = document.getElementById('device_grid')
    device_grid.innerHTML = ''
    ipcRenderer.send('get_gio_devices')

    get_network()

    // ipcRenderer.send('get_gio_volumes')

    // START MONITORING FOR GIO DEVICES
    // ipcRenderer.send('monitor_gio')


    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency])
    }

    ipcRenderer.on('devices', (_event, text) => replaceText('devices', text))


})




// // WATCH DIRECTORY FOR CHANGES
// fs.watch(breadcrumbs.value, "", (eventtype, filename) => {

//     //     // watch_count = watch_count + 1

//     //     let grid
//     //     let filepath = path.join(dir,filename)
//     //     let stats = fs.statSync(filepath)
//     //     let idx = 0

//     // IF EVENT TYPE IS CHANGE THEN SOMETHING WAS ADDED
//     if (eventtype == 'change') {

//         console.log('eventtype ' + eventtype + ' trigger ' + filename)

//         //         if (stats.isDirectory()) {

//         //             grid = document.getElementById('folder_grid')
//         //             idx = grid.getElementsByClassName('folder_card').length

//         //         } else {

//         //             grid = document.getElementById('file_grid')
//         //             idx = grid.getElementsByClassName('file_card').length
//         //         }

//         //         let options = {

//         //             id: grid.id + '_'+ idx + 1,
//         //             href: filepath,
//         //             linktext: filename,
//         //             grid: grid
//         //         }

//         //         try {

//         //             add_card(options).then(card => {

//         //                 console.log('what THE')
//         //                 grid.insertBefore(card, grid.firstChild)

//         //                 // setTimeout(() => {
//         //                 //     watch_count = 0
//         //                 // }, 5000);

//         //             })

//         //         } catch (err) {

//         //             notification(err)

//         //         }

//     }


// })





    // function get(href) {
    //     var xhttp = new XMLHttpRequest();
    //     xhttp.onreadystatechange = function() {
    //       if (this.readyState == 4 && this.status == 200) {
    //        document.getElementById("demo").innerHTML = this.responseText;
    //       }
    //     };
    //     xhttp.open("GET", href, true);
    //     xhttp.send();
    // }






/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////







