const {contextBridge, ipcRenderer, shell, clipboard } = require('electron');
const { exec, execSync } = require('child_process');
const mt         = require('mousetrap');
// const path       = require('path');
// const fs         = require('fs');
// const os         = require('os');
const DragSelect = require('dragselect');
const Chart      = require('chart.js')

// Global Arrays
let selected_files_arr  = [];
let auto_complete_arr   = [];

let ds;
let sort = 'date_desc';
let folder_icon;
let symlink_icon;
let thumbnail_dir;

let view = 'grid';
if (localStorage.getItem('view') == null) {
    localStorage.setItem('view', view);
} else {
    view = localStorage.getItem('view');
}

// IPC ///////////////////////////////////////////////////////////////////
/**/

ipcRenderer.on('done_merging_files', (e) => {

    let active_tab = document.querySelector('.active-tab-content');
    const table = active_tab.querySelector('.destination_table');
    let msg = active_tab.querySelector('.merge_done_msg');

    msg.innerHTML = '<i class="bi bi-info-circle"></i>Done merging files.';
    table.remove();

})

ipcRenderer.on('merge_view', (e, source, destination, copy_merge_arr) => {
    merge(source, destination, copy_merge_arr);
})

ipcRenderer.on('merge_files', (e, merge_arr) => {

    if (merge_arr.length > 0) {

        const url = './views/merge.html';
        fetch(url).then(res => {
            return res.text();
        }).then(data => {

            const main = document.querySelector('.main');
            let tab_content = add_tab('Merge');
            let active_tab = document.querySelector('.active-tab');
            tab_content.innerHTML = data

            const table = document.querySelector('.destination_table');
            const btn_merge = document.querySelector('.btn_merge');

            merge_arr.forEach(item => {

                const row = table.insertRow();

                const dest_cell = row.insertCell(0);
                const source_date_cell = row.insertCell(1);
                const destination_date_cell = row.insertCell(2);
                const action_cell = row.insertCell(3);

                ipcRenderer.invoke('get_icon', item.destination).then(icon => {

                    let img = document.createElement('img');
                    img.classList.add('icon', 'icon16');
                    img.src = icon;

                    let href = document.createElement('a');
                    href.preventDefault = true;
                    href.href = "#"
                    href.text = item.destination

                    href.addEventListener('click', (e) => {
                        ipcRenderer.send('open', item.destination);
                    })

                    dest_cell.append(img, href);
                    source_date_cell.textContent = getDateTime(item.source_date);
                    if (item.destination_date != "") {
                        destination_date_cell.textContent = getDateTime(item.destination_date);
                    }

                    let action_select = document.createElement('select');
                    action_select.classList.add('input');
                    let action_arr = ['Skip', 'Replace', 'New'];
                    for (let i = 0; i < action_arr.length; i++) {
                        let action_option = document.createElement('option');
                        action_option.text = action_arr[i];
                        action_option.value = i;
                        action_select.append(action_option);
                    }
                    action_cell.append(action_select); //item.action

                    for (const option of action_select.options) {
                        if (option.value == item.action) {
                            option.selected = true
                            option.selectedIndex = item.action;
                            break;
                        }
                    }

                    action_select.addEventListener('change', (e) => {
                        let target = e.target;
                        item.action = target.value;
                    })

                })

            })

            btn_merge.addEventListener('click', (e) => {
                let filter_merge_arr = merge_arr.filter(x => x.action != 0)
                ipcRenderer.send('merge_files_confirmed', filter_merge_arr);
                // console.log(filter_merge_arr)
            })

        }).catch(err => {
            console.log(err);
        })

    } else {
        alert('Files exists and there is nothing to merge!')
    }


    // merge_arr = []

})

// Get folder count
ipcRenderer.on('get_folder_count', (e, href) => {
    getFolderCount(href);
})

ipcRenderer.on('get_folder_size', (e, href) => {
    getFolderSize(href)
})

// Update thumbnails
ipcRenderer.on('get_thumbnail', (e, href, thumbnail) => {

    let card = document.querySelector(`[data-href="${href}"]`);
    let img = card.querySelector('img');
    img.src = thumbnail
})

// On ls - Get Directory
ipcRenderer.on('ls', (e, dirents, source, tab) => {

    localStorage.setItem('location', source);
    auto_complete_arr = [];

    msg('');
    let main = document.querySelector('.main');
    let tabs = document.querySelectorAll('.tab');
    let tabs_content = document.querySelectorAll('.tab_content');
    let tab_content = document.querySelector('.tab_content');

    let file_menu =document.querySelector('.header_menu');
    let menu_items = file_menu.querySelectorAll('.item');

    // Set active on menu
    menu_items.forEach(item => {
        let menu_item = item.querySelector('a')
        if (menu_item) {
            ipcRenderer.invoke('basename', source).then(basename => {
                let match = basename.toLocaleLowerCase();
                if (menu_item.classList.contains(match)) {
                    item.classList.add('active')
                } else {
                    item.classList.remove('active')
                }
            })
        }
    })

    let sidebar = document.querySelector('.sidebar');
    let sidebar_items = sidebar.querySelectorAll('.item');
    sidebar_items.forEach(item => {
        let sidebar_item = item.querySelector('a');
        // console.log(sidebar_item.href)
        if (sidebar_item) {
            if (sidebar_item.title === source) {
                item.classList.add('active')
            } else {
                item.classList.remove('active')
            }
        }
    })

    // Add new tab if tab = 1
    if (tab) {
        tab_content = add_tab(source);
    }

    if (tabs.length === 0) {
        add_tab(source);
    }

    let active_tab = document.querySelector('.active-tab');
    let active_label = active_tab.querySelector('.label')
    let active_tab_content = document.querySelector('.active-tab-content');
    active_tab_content.innerHTML = '';

    active_tab.dataset.href = source;
    active_tab.title = source;

    ipcRenderer.invoke('basename', source).then(basename => {
        active_label.innerHTML = basename;
    })

    let location = document.querySelector('.location');
    let slider = document.querySelector('.slider');

    let folder_grid = active_tab_content.querySelector('.folder_grid');
    if (!folder_grid) {
        folder_grid = add_div()
        folder_grid.classList.add('folder_grid')
        folder_grid.id = 'folder_grid'
    }
    let file_grid = active_tab_content.querySelector('.file_grid');
    if (!file_grid) {
        file_grid = add_div()
        file_grid.classList.add('file_grid')
        file_grid.id = 'file_grid'
    }

    let hidden_folder_grid = active_tab_content.querySelector('.hidden_folder_grid');
    if (!hidden_folder_grid) {
        hidden_folder_grid = add_div(['hidden_folder_grid']);
        hidden_folder_grid.id = 'hidden_folder_grid';
    }

    let hidden_file_grid = active_tab_content.querySelector('.hidden_file_grid');
    if (!hidden_file_grid) {
        hidden_file_grid = add_div(['hidden_file_grid']);
        hidden_file_grid.id = 'hidden_file_grid';
    }

    if (localStorage.getItem('show_hidden') !== null) {
        let show_hidden_icon = document.querySelector('.show_hidden')
        let show_hidden = parseInt(localStorage.getItem('show_hidden'));
        if (show_hidden) {
            hidden_folder_grid.classList.remove('hidden');
            hidden_file_grid.classList.remove('hidden');
            show_hidden_icon.classList.add('active')
        } else {
            hidden_folder_grid.classList.add('hidden');
            hidden_file_grid.classList.add('hidden');
            show_hidden_icon.classList.remove('active')
        }
    }

    let grid_view = document.querySelector('.grid_view');
    let list_view = document.querySelector('.list_view');

    folder_grid.classList.add('folder_grid');
    file_grid.classList.add('file_grid');
    hidden_folder_grid.classList.add('hidden_folder_grid');
    hidden_file_grid.classList.add('hidden_file_grid');

    file_grid.draggable = false;
    hidden_file_grid.draggable = false;
    folder_grid.draggable = false;
    hidden_folder_grid.draggable = false;
    // hidden_folder_grid.style = "border: 1px solid red;"

    location.value = source;
    ipcRenderer.invoke('basename', location.value).then(basename => {
        document.title = basename;
    })

    let header = active_tab_content.querySelector('.header_row')
    if (!header) {

        header = add_div();
        header.classList.add('header_row', 'content', 'list');

        let colNames = ['Name', 'Date', 'Size', 'Items'];
        let colClasses = ['name', 'date', 'size', 'items'];
        let sort_by = '_desc'
        let headerRow = colNames.map((colName, index) => {
            let col = add_div();
            col.classList.add('item', colClasses[index]);
            col.append(colName);
            col.addEventListener('click', (e) => {

                sort = colName.toLocaleLowerCase();
                if (sort === 'name' || sort === 'date') {
                    if (sort_by === '_desc') {
                        sort_by = '_asc'
                    } else if (sort_by === '_asc') {
                        sort_by = '_desc'
                    }
                    localStorage.setItem('sort', `${sort}${sort_by}`);
                }

                if (sort === 'size' || sort === 'items') {
                    localStorage.setItem('sort', `${sort}`)
                }

                sort_cards();

            })

            return col;
        });

        header.append(...headerRow);
        active_tab_content.append(header)

    }

    if (view == 'list') {

        main.classList.replace('grid_container', 'list_container');
        header.classList.remove('hidden');

        const list_view_columns = add_div();
        list_view_columns.className = 'list_view_columns';
        list_view_columns.innerHTML = '';

        list_view.classList.add('active');
        grid_view.classList.remove('active');

        [folder_grid, file_grid, hidden_folder_grid, hidden_file_grid].forEach((element) => {
            element.classList.remove('grid');
            element.classList.add('grid1');
        });

    } else {

        main.classList.replace('list_container', 'grid_container');
        header.classList.add('hidden');

        list_view.classList.remove('active');
        grid_view.classList.add('active');

        [folder_grid, file_grid, hidden_folder_grid, hidden_file_grid].forEach((element) => {
            element.classList.remove('grid1');
            element.classList.add('grid');
        });

    }

    folder_grid.innerHTML = ''
    file_grid.innerHTML = ''

    hidden_folder_grid.innerHTML = ''
    hidden_file_grid.innerHTML = ''

    if (localStorage.getItem('sort') === null) {
        sort = 'date';
    } else {
        sort = localStorage.getItem('sort');
    }

    // Loop Files Array
    for (let i = 0; i < dirents.length; i++) {

        let file = dirents[i];
        let card = getCardGio(file);

        if (file.is_dir || file.content_type === 'inode/symlink') {

            if (file.is_hidden) {
                hidden_folder_grid.append(card);
            } else {
                folder_grid.append(card);
            }

            // this is slowing the load time down dont use for now
            if (file.href.indexOf('mtp:') > -1) {

            } else {
                // Call Get Folder Size
                getFolderSize(file.href);
                getFolderCount(file.href);
            }

            auto_complete_arr.push(file.href);

        } else {

            if (file.is_hidden) {
                hidden_file_grid.append(card);
            } else {
                file_grid.append(card);
            }

        }

        // mt.bind(shortcut.Down.toLocaleLowerCase(), (e) => {
        //     console.log('down')
        // })

        // mt.bind(shortcut.Up.toLocaleLowerCase(), (e) => {
        //     active_tab_content.tabIndex = 0
        //     active_tab_content.scrollTop -= 10;
        //     console.log('up')
        // })

    }

    main.addEventListener('dragover', (e) => {
        e.preventDefault();
    })

    main.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        for (const f of e.dataTransfer.files) {

        }

        ipcRenderer.send('main', 1);
        paste(location.value);
    })

    main.addEventListener('mouseenter', (e) => {
        // console.log("running mouse enter");
        // document.addEventListener('keyup', quick_search)

        // let cards = active_tab_content.querySelectorAll('.card')
        // let href = cards[0].querySelector('a')
        // href.tabIndex = 1
        // href.focus()

    })

    main.addEventListener('mouseleave', (e) => {
        // console.log('running mouse leave')
        document.removeEventListener('keyup', quickSearch)
    })

    // main.append(folder_grid, hidden_folder_grid, file_grid, hidden_file_grid);
    active_tab_content.append(folder_grid, hidden_folder_grid, file_grid, hidden_file_grid);
    main.append(active_tab_content)

    // tab_content.append(folder_grid, hidden_folder_grid, file_grid, hidden_file_grid);
    // main.append(tab_content)

    // Set Icon Size
    if (localStorage.getItem('icon_size') !== null) {
        let icon_size = localStorage.getItem('icon_size')
        slider.value = icon_size;
        resizeIcons(icon_size);
    }

    // watch_dir(location.value);

    lazyload();

    sort_cards();

    clearHighlight();

    main.classList.remove('loader')

    // const selectionRectangle = document.getElementById('selection-rectangle');
    // const cards = document.querySelectorAll('.card');
    // let isSelecting = false;
    // let startPosX, startPosY, endPosX, endPosY;

    // main.addEventListener('mousedown', (e) => {

    //     // console.log('running')

    //     isSelecting = true;
    //     startPosX = e.clientX;
    //     startPosY = e.clientY;

    //     selectionRectangle.style.left = startPosX + 'px';
    //     selectionRectangle.style.top = startPosY + 'px';
    //     selectionRectangle.style.width = '0';
    //     selectionRectangle.style.height = '0';
    //     selectionRectangle.style.display = 'block';

    //     cards.forEach(item => item.classList.remove('selected'));

    // });

    // document.addEventListener('mousemove', (e) => {

    //     if (!isSelecting) return;

    //     console.log(cards)

    //     endPosX = e.clientX;
    //     endPosY = e.clientY;

    //     const rectWidth = endPosX - startPosX;
    //     const rectHeight = endPosY - startPosY;

    //     selectionRectangle.style.width = Math.abs(rectWidth) + 'px';
    //     selectionRectangle.style.height = Math.abs(rectHeight) + 'px';
    //     selectionRectangle.style.left = rectWidth > 0 ? startPosX + 'px' : endPosX + 'px';
    //     selectionRectangle.style.top = rectHeight > 0 ? startPosY + 'px' : endPosY + 'px';

    //     // Highlight selectable items within the selection area
    //     cards.forEach(item => {

    //         const itemRect = item.getBoundingClientRect();
    //         const isSelected =
    //         ((itemRect.left < endPosX && itemRect.right > startPosX) ||
    //         (itemRect.left < startPosX && itemRect.right > endPosX)) &&
    //         ((itemRect.top < endPosY && itemRect.bottom > startPosY) ||
    //         (itemRect.top < startPosY && itemRect.bottom > endPosY));

    //         if (isSelected) {
    //             item.classList.add('highlight_select');
    //         } else {
    //             // item.classList.remove('highlight_select');
    //         }
    //     });

    // });

    // document.addEventListener('mouseup', () => {
    //     isSelecting = false;
    //     selectionRectangle.style.display = 'none';

    // });

    // merge();

})

// Get icon theme directory
ipcRenderer.invoke('folder_icon').then(icon => {
    folder_icon = icon;
    // console.log('folder_icon', folder_icon)
})

ipcRenderer.invoke('symlink_icon').then(icon => {
    // console.log(icon)
    symlink_icon = icon;
})

ipcRenderer.on('lazyload', (e) => {
    lazyload();
})

// Get Thumbnil directory
ipcRenderer.invoke('get_thumbnails_directory').then(res => {
    // console.log('thumb dir', res)
    thumbnail_dir = res
})

// Get Devices
ipcRenderer.on('get_devices', (e) => {
    // console.log('getting devices');
    let device_view = document.querySelector('.device_view');
    getDevices(devices => {
        device_view.innerHTML = '';
        device_view.append(devices);
    })
})

// On Search Results
ipcRenderer.on('search_results', (e, find_arr) => {

    // console.log('getting array');

    let location = document.querySelector('.location');
    // location.value = 'Search Results';

    let folder_grid = add_div(['folder_grid']);
    let hidden_folder_grid = add_div(['hidden_folder_grid']);
    let file_grid = add_div(['file_grid']);
    let hidden_file_grid = add_div(['hidden_file_grid']);

    let tab_content = add_tab('Search Results');
    tab_content.append(folder_grid, file_grid);

    find_arr.forEach(file => {

        if (file !== undefined) {
            let card = getCardGio(file)
            if (file.is_dir === true) {
                if (file.is_hidden) {
                    hidden_folder_grid.append(card);
                } else {
                    folder_grid.append(card);
                }

                getFolderSize(file.href)
                getFolderCount(file.href)

            } else {
                if (file.is_hidden) {
                    hidden_file_grid.append(card);
                } else {
                    file_grid.append(card);
                }
            }
        }

    })

    resizeIcons(localStorage.getItem('icon_size'));

    switch_view(localStorage.getItem('view'));
    lazyload();

})

// Sort Views
ipcRenderer.on('sort_cards', (e, sort_by) => {
    localStorage.setItem('sort', sort_by);
    sort_cards();
})

// On Recent Files
ipcRenderer.on('recent_files', (e, dirents) => {
    getRecentView(dirents);
})

// Get Folder Size for properties
ipcRenderer.on('folder_size', (e, source, folder_size) => {
    let card = document.querySelector(`[data-properties_href="${source}"]`)
    let size = card.querySelector('.size')
    size.innerHTML = ''
    size.innerHTML = getFileSize(folder_size);
})

// On folder count for properties
ipcRenderer.on('folder_count', (e, href, folder_count) => {
    let cards = document.querySelectorAll('.properties');
    cards.forEach(card => {
        if (card.dataset.properties_href === href) {
            let count = card.querySelector('.folder_count');
            count.innerHTML = `${folder_count} Items`;
        }
    })
})

// On Disk Space
ipcRenderer.on('disk_space', (e, data) => {

    let folder_count = 0; //get_folder_count();
    let file_count = 0; //get_file_count();

    if (folder_count === 0 && file_count === 0) {

        // let msg = add_div();
        // msg.classList.add('empty_folder');
        // let icon = add_icon('folder');
        // msg.append(icon, 'Folder is empty');
        // info_view.classList.remove('hidden');
        // info_view.append(msg);

    }
    let disk_space = document.getElementById('disk_space')
    disk_space.innerHTML = ''

    if (data.length > 0) {

        let ds = add_div();
        let us = add_div();
        let as = add_div();

        ds.classList.add('item')
        us.classList.add('item')
        as.classList.add('item')

        ds.innerHTML = `Disk Space: ${data[0].disksize}`;
        us.innerHTML = `Used Space: ${data[0].usedspace}`;
        as.innerHTML = `Available: ${data[0].availablespace}`;

        disk_space.append(ds, us, as)

    } else {

    }

})

ipcRenderer.on('open_with', (e, file, exe_arr) => {

    let list = document.getElementById('list')
    exe_arr.forEach(exe_item => {

        let item = add_div();
        item.classList.add('item');

        item.append(add_icon('app'), exe_item.exe)
        list.append(item)

    })

})

// Refresh on theme change
ipcRenderer.on('theme_changed', (e) => {
    if (localStorage.getItem('location' !== null)) {
        getView(localStorage.getItem('location'))
    }
})

// Properties
ipcRenderer.on('properties', (e, properties_arr) => {

    clearViews();
    let sidebar = document.querySelector('.sidebar');
    getProperties(properties_arr, properties_view => {
        sidebar.append(properties_view);
    })
})

// Toggle Hidden
ipcRenderer.on('toggle_hidden', (e) => {
    toggleHidden();
})

// Files
ipcRenderer.on('get_files', (e, dirents) => {
    // console.log('dirents', dirents);
})

// Get Folder and File Count
ipcRenderer.on('count', (e, source, item_count) => {
    // console.log(source, item_count);
    let active_tab_content = document.querySelector('.active-tab-content')
    let card = active_tab_content.querySelector(`[data-href="${source}"]`);
    if (card) {
        let count = card.querySelector('.count');
        count.innerHTML = '';
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
    getView(href)
})

// Get Workspace
ipcRenderer.on('get_workspace', (e) => {
    getWorkspace(workspace => {});
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
    getView(location.value);
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

                ipcRenderer.invoke('connect', cmd).then(res => {
                    if (res) {
                        // console.log('connection success')
                        connect_msg.style.color = 'green';
                        connect_msg.innerHTML = `Connected to ${conntection_type[conntection_type.options.selectedIndex].text} Server.`;
                    } else {
                        connect_msg.innerHTML = res;
                    }
                })

            // exec(cmd, (err, stdout, stderr) => {
            //     if (!err) {
            //         connect_msg.style.color = 'green';
            //         connect_msg.innerHTML = `Connected to ${conntection_type[conntection_type.options.selectedIndex].text} Server.`;

            //     } else {
            //         if (stderr) {
            //             connect_msg.innerHTML = stderr;
            //         }
            //     }
            // })
        }
        // console.log(conntection_type.value);
    }
})

// Msg
ipcRenderer.on('msg', (e, message, has_timeout) => {
    msg(message, has_timeout);
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

    // // console.log('what', delete_arr);

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

    // console.log('running get card gio');

    let active_tab_content = document.querySelector('.active-tab-content');
    let folder_grid = active_tab_content.querySelector('.folder_grid');
    let file_grid = active_tab_content.querySelector('.file_grid');

    // Check if card already exists
    let exists = 0;
    let cards = active_tab_content.querySelectorAll('.card')
    cards.forEach(card => {
        if (card.dataset.href === file.href) {
            exists = 1;
            return;
        }
    })

    if (!exists) {
        let card = getCardGio(file);
        if (file.is_dir) {
            folder_grid.prepend(card);
            getFolderCount(file.href);
            getFolderSize(file.href);
        } else {
            file_grid.prepend(card);
        }
        lazyload();
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

    let active_tab_content = document.querySelector('.active-tab-content');
    let card = active_tab_content.querySelector(`[data-href="${href}"]`);
    let newcard = getCardGio(file);
    card.replaceWith(newcard);

    getFolderCount(href);
    getFolderSize(href);

})

ipcRenderer.on('update_card', (e, href, file) => {

})

// Set Progress
ipcRenderer.on('set_progress', (e, data) => {

    // // console.log(data)
    let main = document.querySelector('.main')
    let progress = document.getElementById('progress');
    let progress_msg = document.getElementById('progress_msg');
    let progress_bar = document.getElementById('progress_bar');

    if (!progress) {
        progress = add_div(['progress', 'bottom']);
        progress_msg = add_div(['progress_msg']);
        progress_bar = document.createElement('progress');

        progress.id = 'progress';
        progress_msg.id = 'progress_msg';
        progress_bar.id = 'progress_bar';

        progress.append(progress_msg, progress_bar)
        main.append(progress)
    }

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
            // console.log('running new folder')
            ipcRenderer.send('new_folder', location.value);
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
            clear()
            break;
        }
        case 'terminal': {

            ipcRenderer.invoke('settings')
            .then(settings => {
                let cmd = settings.Terminal;
                let cards = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');
                // console.log(cards.length)
                if (cards.length > 0) {
                    cards.forEach(card => {
                        let new_cmd = cmd.replace(/%u/g, `'${card.dataset.href}'`)
                        ipcRenderer.send('command', (e, new_cmd))
                        // exec(cmd.replace(/%u/g, `'${card.dataset.href}'`), (error, data, getter) => { });
                    })
                } else {
                    let new_cmd = cmd.replace(/%u/g, `'${location.value}'`);
                    ipcRenderer.send('command', (e, new_cmd));
                    // exec(cmd.replace(/%u/g, `'${location.value}'`), (error, data, getter) => { });
                    // exec(`gnome-terminal --working-directory="${location.value}"`, (error, data, getter) => { });
                }
                clear();
            })
            .catch(err => {
                msg(err);
            })

            break;
        }
        case 'connect': {
            ipcRenderer.send('connect');
            break;
        }
        case 'add_workspace': {
            getSelectedFiles();
            ipcRenderer.send('add_workspace', selected_files_arr);
            clear()
            break;
        }
        case 'compress': {
            compress('tar.gz');
            break;
        }
        case 'compress_zip': {
            compress('zip');
            break;
        }
        case 'extract': {
            extract();
            break;
        }
        case 'properties': {
            getSelectedFiles();
            ipcRenderer.send('get_properties', selected_files_arr);
            clear();
            break;
        }
        case 'open_templates': {
            ipcRenderer.invoke('get_templates_folder').then(path => {
                getView(path, 1)
            })
            break;
        }

    }

    // clearHighlight();

})

// Functions //////////////////////////////////////////////////////////////

// Utilities ///////////////////////////////////////////////////////////////
/** */

// Merge Dialog
function merge(source, destination, copy_merge_arr) {

    // const url = './views/merge.html';
    // fetch(url).then(res => {
    //     return res.text();
    // }).then(data => {

    //     const main = document.querySelector('.main');
    //     let tab_content = add_tab('Merge Directory');
    //     let active_tab = document.querySelector('.active-tab');
    //     tab_content.innerHTML = data

        // let source = '/home/michael/Downloads/chartjs/'
        // let destination = '/home/michael/Downloads/testing/chartjs/'

        // let merge_source = document.querySelector('.merge_source');
        // let merge_destination = document.querySelector('.merge_destination');
        // let btn_cancel = document.querySelector('.btn_cancel');

        // merge_source.innerText = ` ${source}`;
        // merge_destination.innerText = ` ${destination}`;

        ipcRenderer.send('get_files_arr_merge', source, destination, copy_merge_arr);

        // btn_cancel.addEventListener('click', (e) => {

        //     tab_content.remove();
        //     active_tab.remove();

        //     let tabs = document.querySelectorAll('.tabs');
        //     let content = document.querySelectorAll('.tab_content')

        //     let tab = tabs[0].querySelector('.tab');
        //     tab.classList.add('active-tab')
        //     content[0].classList.remove('hidden')

        // })

    //     main.append(tab_content);

    // }).catch(err => {
    //     console.log(err);
    // })

}

// DISK USAGE CHART
let chart
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
            indexAxis: 'y',
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        display: false
                    }
                },
                y: {
                    display:false,
                    grid: {
                        display: false
                    },
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
                            return getFileSize(x.dataset.data[x.dataIndex] * 1024)
                        }
                    }
                }
            }

        }
    })

    return ctx;

}

// GET DISK SUMMARY VIEW
async function get_disk_summary_view(callback) {

    let main = document.querySelector('.main')
    // main.innerHTML = ''

    let tab_content = add_tab('Disk Usage')

    // ADD ARRAY
    let chart_labels = []
    let labels = []

    // INFO VIEW
    let view = add_div(['info_view']) //document.getElementById('info_view')
    view.innerHTML = ''
    // view.style = 'background: white;'

    // GRID
    let grid = add_div()
    grid.classList.add('grid2')

    // COMMAND
    // let disks = execSync('df -l -t ext4').toString().split('\n');
    let disks = execSync('df').toString().split('\n');
    // disks.shift()
    disks_arr = disks.filter(a => { return a !== ''; })

    // Sort Disks
    // disks_arr.sort((a, b) => {
    //     if (a < b) {
    //         return -1;
    //     }
    //     if (a > b) {
    //         return 1;
    //     }
    // })

    disks_arr.forEach((disk, i) => {

        // console.log(disk)

        // GRID FOR DATA
        let data_grid = add_div()
        data_grid.classList.add('grid')

        let chart_data = []

        // ADD COLUMN TO GRID
        let col = add_div()
        // col.classList.add('column', 'eight', 'wide')

        // ADD CARD
        let card = add_div()
        card.classList.add('drive')
        // card.style = 'border: 1px solid black;'

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
                content.append(header)

                // ADD DATA
            } else {

                // IF INTEGER THEN GET FILE SIZE
                if (ii > 0 && ii < 4) {

                    let data_col1 = add_column('three')
                    data_col1.append(labels[ii])
                    data_col1.style = 'border: none;'

                    let data_col2 = add_column('twelve')
                    data_col2.append(getFileSize(parseInt(item) * 1024))
                    data_col2.style = 'border: none;'

                    data_grid.append(data_col1, data_col2)

                } else {

                    let data_col1 = add_column('three')
                    data_col1.append(labels[ii])

                    let data_col2 = add_column('twelve')

                    // ADD LINK TO MOUNTED
                    if (ii >= data_arr.length - 1) {

                        let href = add_link(item, item);
                        href.addEventListener('click', (e) => {
                            e.preventDefault()
                            // localStorage.setItem('view', 'grid');
                            // get_view(item)
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
            card.dataset.label = item

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

    // main.innerHTML = ''
    // main.append(view)
    tab_content.append(view);
    main.append(tab_content);

    // return callback(view)

}

// Switch View
function switch_view(view) {

    let list_view = document.querySelector('.list_view');
    let grid_view = document.querySelector('.grid_view');
    let folder_grids = document.querySelectorAll('.folder_grid');
    let file_grids = document.querySelectorAll('.file_grid');

    // let folders = Array.from(folder_grid.querySelectorAll('.card'));
    // let files = Array.from(file_grid.querySelectorAll('.card'));

    list_view.classList.remove('active');
    grid_view.classList.remove('active');

    folder_grids.forEach(folder_grid => {
        folder_grid.classList.remove('grid','grid1');
    })
    file_grids.forEach(file_grid => {
        file_grid.classList.remove('grid','grid1');
    })

    switch (view) {
        case 'list': {

            list_view.classList.add('active')

            folder_grids.forEach(folder_grid => {
                folder_grid.classList.add('grid1');
            })
            file_grids.forEach(file_grid => {
                file_grid.classList.add('grid1');
            })
            let headers = document.querySelectorAll('.header_row')
            headers.forEach(header => {
                header.classList.remove('hidden')
            })
            let cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                card.classList.add('list');
                let icon = card.querySelector('.icon')
                let content = card.querySelector('.content');

                icon.classList.add('icon16');
                content.classList.add('list');

            })
            break;
        }
        case 'grid': {

            grid_view.classList.add('active')

            folder_grids.forEach(folder_grid => {
                folder_grid.classList.add('grid');
            })
            file_grids.forEach(file_grid => {
                file_grid.classList.add('grid');
            })
            let headers = document.querySelectorAll('.header_row')
            headers.forEach(header => {
                header.classList.add('hidden')
            })
            let cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                card.classList.remove('list');

                let icon = card.querySelector('.icon')
                let content = card.querySelector('.content');

                icon.classList.remove('icon16');
                content.classList.remove('list');

            })

            break;
        }
    }

    lazyload();

}

// Sort Cards
function sort_cards() {

    let sort = '';
    if (localStorage.getItem('sort') !== null) {
        sort = localStorage.getItem('sort');
    }
    ipcRenderer.send('sort', sort);

    let active_tab_content = document.querySelector('.active-tab-content')
    let grids = ['folder_grid', 'hidden_folder_grid', 'file_grid', 'hidden_file_grid'];

    grids.forEach(grid => {
        let grid_items = document.querySelectorAll(`.${grid}`);
        grid_items.forEach(grid_item => {

            let grid_cards = Array.from(grid_item.querySelectorAll('.card'))
            switch (sort) {
                case 'name_asc': {
                    grid_cards.sort((a, b) => {
                        if (a.dataset.name.toLocaleLowerCase() < b.dataset.name.toLocaleLowerCase()) {
                            return -1;
                        }
                        if (a.dataset.name.toLocaleLowerCase() > b.dataset.name.toLocaleLowerCase()) {
                            return 1;
                        }
                        return 0;
                    })
                    break;
                }
                case 'name_desc': {
                    grid_cards.sort((a, b) => {
                        if (b.dataset.name.toLocaleLowerCase() < a.dataset.name.toLocaleLowerCase()) {
                            return -1;
                        }
                        if (b.dataset.name.toLocaleLowerCase() > a.dataset.name.toLocaleLowerCase()) {
                            return 1;
                        }
                        return 0;
                    })
                    break;
                }
                case 'date_desc': {
                    grid_cards.sort((a, b) => {
                        return b.dataset.mtime - a.dataset.mtime
                    })
                    break;
                }
                case 'date_asc': {
                    grid_cards.sort((a, b) => {
                        return a.dataset.mtime - b.dataset.mtime
                    })

                    break;
                }
                case 'size': {
                    grid_cards.sort((a, b) => {
                        return b.dataset.size - a.dataset.size
                    })
                    break;
                }
            }
            grid_cards.forEach(card => {
                grid_item.appendChild(card);
            })
        })

    })

}

function find_files(callback) {

    clearViews();

    let mb = document.getElementById('mb_find');
    mb.classList.add('active');

    let location = document.querySelector('.location');
    let sidebar = document.querySelector('.sidebar');

    let sb_search = document.querySelector('.sb_search');
    if (sb_search) {
        sb_search.classList.remove('hidden');
    } else {

        sb_search = add_div();
        sb_search.classList.add('sb_search', 'sb_view');
        let search_view = document.querySelector('.search_view');
        if (!search_view) {
            search_view = add_div();
            search_view.classList.add('search_view');
        }

        ipcRenderer.invoke('path:join', __dirname, 'views/find.html').then(path => {

            fetch(path)
            .then(res => {
                return res.text();
            })
            .then(search_html => {

                search_view.innerHTML = search_html;
                sb_search.innerHTML = search_view.innerHTML;
                sidebar.append(sb_search);

                let cmd = '';
                let search_results = document.getElementById('search_results');
                let find = document.getElementById('find');
                let find_div = document.getElementById('find_div');
                let find_options = document.getElementById('find_options');
                let find_folders = document.getElementById('find_folders')
                let find_files = document.getElementById('find_files')
                let btn_find_options = document.getElementById('btn_find_options');
                let find_size = document.getElementById('find_size');
                let start_date = document.getElementById('start_date');
                let end_date = document.getElementById('end_date');
                let mb_find = document.getElementById('mb_find');
                let search_progress = document.getElementById('search_progress')

                let options = {
                    show_folders: 1,
                    show_files: 1,
                    case: 0,
                    depth: 1,
                    start_date: '',
                    end_date: '',
                    size: ''
                }

                find.focus();
                find.select();

                if (localStorage.getItem('find_folders') != null) {
                    options.show_files = parseInt(localStorage.getItem('find_files'));
                } else {
                    options.find_files = 1;
                    options.depth = localStorage.setItem('find_files', options.find_files);
                }

                if (localStorage.getItem('find_folders')) {
                    options.show_folders = parseInt(localStorage.getItem('find_folders'));
                } else {
                    options.find_folders = 1;
                    options.depth = localStorage.setItem('find_folders', options.find_folders);
                }

                if (localStorage.getItem('depth') != null) {
                    options.depth = parseInt(localStorage.getItem('depth'));
                } else {
                    options.depth = 1;
                    options.depth = localStorage.setItem('depth', options.depth);
                }


                find_folders.checked = options.show_folders;
                find_files.checked = options.show_files;

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

                    input.preventDefault = true

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
                                search_info.innerHTML = 'Searching...';
                                search_progress.classList.remove('hidden')
                            } else {
                                search_info.innerHTML = '';
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
                                let depth = parseInt(localStorage.getItem('depth'));

                                options.d = find_folders,
                                options.f = find_files,
                                options.depth = depth,
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
                                if (options.d && options.f && options.s != '') {
                                    options.o = ' -or '
                                } else {
                                    options.o = ''
                                }

                                cmd = `find "${location.value}"${options.depth}${options.d}${options.start_date}${options.end_date}${options.o}${options.f}${options.start_date}${options.end_date}`
                                if (process.platform === 'Win32') {
                                    // notification('find is not yet implemented on window');
                                    // cmd = `find [/v] [/c] [/n] [/i] [/off[line]] <"string"> [[<drive>:][<path>]<filename>[...]]`
                                }
                                let data = 0;
                                let c = 0
                                let child = exec(cmd)
                                // console.log(cmd)

                                let search_arr = [];
                                child.stdout.on('data', (res) => {

                                    data = 1;
                                    search_info.innerHTML = ''
                                    let files = res.split('\n')
                                    search_progress.value = 0
                                    search_progress.max = files.length

                                    if (files.length > 500) {

                                        search_info.innerHTML = 'Please narrow your search.'
                                        search_progress.classList.add('hidden')
                                        return false;

                                    } else {

                                        for (let i = 0; i < files.length; i++) {

                                            if (files[i] != '') {
                                                ++c
                                                search_arr.push(files[i])
                                            }

                                        }

                                    }

                                })

                                child.stdout.on('end', (res) => {
                                    if (!data) {
                                        search_info.innerHTML = '0 matches found';
                                    } else {

                                        // console.log('ipc send search results');
                                        ipcRenderer.send('search_results', search_arr);
                                        search_info.innerHTML = c + ' matches found';
                                    }
                                    search_progress.classList.add('hidden');
                                })

                            } else {
                                search_results.innerHTML = '';
                            }

                        }

                    })

                })

                // FIND OPTIONS
                btn_find_options.addEventListener('click', (e) => {

                    let chevron = btn_find_options.querySelector('i');

                    // Remove Hidden
                    if (find_options.classList.contains('hidden')) {

                        find_options.classList.remove('hidden')
                        chevron.classList.add('down')
                        chevron.classList.remove('right')
                        localStorage.setItem('find_options', 1);

                    } else {

                        find_options.classList.add('hidden')
                        chevron.classList.add('right')
                        chevron.classList.remove('down')
                        localStorage.setItem('find_options', 0);

                    }

                })

            })
            .catch (err => {
                console.log(err)
            })

        })

    }

    callback(1)

}

function add_img(src) {
    let img = document.createElement('img')
    img.width = 32
    img.src = src
    return img
}

function extract() {
    let location = document.getElementById('location');
    getSelectedFiles();
    ipcRenderer.send('extract', location.value);
    clear();
}

// Compress Files
function compress(type) {
    let location = document.getElementById('location');
    getSelectedFiles();
    ipcRenderer.send('compress', location.value, type);
    clear();
}

function resizeIcons(icon_size) {
    let slider = document.getElementById('slider');
    let cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        if (!card.classList.contains('list')) {
            let icon = card.querySelector('.icon');
            icon.style.width = `${icon_size}px`;
            icon.style.height = `${icon_size}px`;
        }
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

        localStorage.setItem('show_hidden', 1);

    } else {
        hidden_folder_grid.classList.add('hidden')
        hidden_file_grid.classList.add('hidden')
        show_hidden.forEach(item => {
            item.classList.remove('active')
        })

        localStorage.setItem('show_hidden', 0);

    }

}

// Clear Items
function clear() {

    // console.log('running clear');
    clearHighlight();
    msg('');

    copy_arr = [];
    selected_files_arr = [];

}

// Clear Highlighted Cards
function clearHighlight() {

    let cards = document.querySelectorAll('.highlight, .highlight_select, .highlight_target, .ds-selected')
    cards.forEach(item => {
        item.classList.remove('highlight', 'highlight_select', 'highlight_target', 'ds-selected')
    })
}

// Add column
function add_column(length) {

    let column = add_div()
    column.classList.add('column', length, 'wide')
    return column
}

// Add Div
function add_div(classlist = []) {
    let div = document.createElement('div')
    if (classlist.length > 0) {
        for (let i = 0; i < classlist.length; i++) {
            div.classList.add(classlist[i])
        }
    }
    return div
}

// Add Tab
let tab_id = 0
function add_tab(href) {

    ++tab_id;

    let main = document.querySelector('.main');
    let location = document.querySelector('.location');
    let tab_content = add_div(['tab_content']); //document.querySelector('.tab_content');
    let tab = add_div(['tab']);
    let tab_container = add_div(['tab_container','flex'])

    let col1 = add_div(['label']);
    let col2 = add_div(['tab_close']);

    let close_btn = document.createElement('i')
    close_btn.classList.add('bi', 'bi-x')

    tab_container.append(col1, col2);

    let tabs = document.querySelector('.tabs');
    if (!tabs) {
        tabs = add_div(['tabs', 'sticky']);
        main.append(tabs);
    }

    tab.dataset.href = href;
    tab.dataset.id = tab_id;
    tab.title = href;

    let current_tab_content = document.querySelectorAll('.tab_content');
    let current_tabs = tabs.querySelectorAll('.tab');

    col2.append(close_btn);

    // Handle tab switching
    tab.addEventListener('click', (e) => {
        current_tabs = tabs.querySelectorAll('.tab');
        current_tab_content = document.querySelectorAll('.tab_content')
        current_tabs.forEach((current_tab, i) => {
            current_tab.classList.remove('active-tab');
            current_tab_content[i].classList.remove('active-tab-content')
            current_tab_content[i].classList.add('hidden');
        })

        tab.classList.add('active-tab');
        tab_content.classList.add('active-tab-content');
        tab_content.classList.remove('hidden');
        location.value = tab.dataset.href
    })

    current_tabs.forEach((current_tab, i) => {
        let current_label = current_tab.querySelector('.label');
        if (current_label.dataset.href === href) {
            label_exist = 1
        } else {
            current_tab.classList.remove('active-tab');
            current_tab_content[i].classList.remove('active-tab-content')
            current_tab_content[i].classList.add('hidden');
        }
    })
    tab.classList.add('active-tab');
    tab_content.classList.remove('hidden');
    tab_content.classList.add('active-tab-content');

    ipcRenderer.invoke('basename', href).then(basename => {
        col1.append(basename);
    })
    tab.append(tab_container);
    tabs.append(tab);
    main.append(tab_content);

    // Handle closing tabs
    col2.addEventListener('click', (e) => {

        e.preventDefault();
        e.stopPropagation();

        let active_tab = document.querySelector('.active-tab');
        if (active_tab == tab) {

            if (current_tabs.length > 0) {

                let tabs = document.querySelectorAll('.tab')
                let idx = Array.from(tabs).indexOf(tab) - 1

                if (idx >= 0) {

                    tab.remove();
                    tab_content.remove();

                    current_tabs[idx].classList.add('active-tab');
                    current_tab_content[idx].classList.add('active-tab-content');
                    current_tab_content[idx].classList.remove('hidden');
                    location.value = current_tabs[idx].dataset.href;

                }

            }

        } else {
            if (current_tabs.length > 0) {
                tab.remove();
                tab_content.remove();
            }
        }

    })

    tabs.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    })

    tabs.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // console.log(e.target)
    })

    return tab_content;

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

/**
 * Set Msg in lower right side
 * @param {string} message
 */
function msg(message, has_timeout = 1) {

    let main = document.querySelector('.main');
    let msg = document.querySelector('.msg');
    if (!msg) {
        msg = add_div(['msg', 'bottom']);
        main.append(msg);
    }

    msg.innerHTML = '';
    msg.classList.remove('hidden');
    if (message === '') {
        msg.classList.add('hidden');
    }

    if (message.toString().toLocaleLowerCase().indexOf('error') > -1) {
        msg.classList.add('error')
    } else {
        msg.classList.remove('error')
    }

    msg.innerHTML = message;

    if (has_timeout) {
        setTimeout(() => {
            msg.classList.add('hidden')
        }, 3000);
    }

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
        // // console.log('gio getDateTime Format error')
    }
}

// Edit Mode
function edit() {

    // console.log('running edit');
    let main = document.querySelector('.main');
    let quicksearch = document.querySelector('.quicksearch');

    // getSelectedFiles();
    let active_tab_content = document.querySelector('.active-tab-content');
    let cards = Array.from(active_tab_content.querySelectorAll('.highlight, .highlight_select, .ds-selected'));

    cards.forEach(card => {
        let href = card.dataset.href;
        let header_link = card.querySelector('a');
        let input = card.querySelector('input');

        header_link.classList.add('hidden');
        input.classList.remove('hidden');

        input.select();
        input.focus();

        main.removeEventListener('keydown', quickSearch);

        input.addEventListener('change', (e) => {
            e.preventDefault();
            e.stopPropagation();

            let location = document.getElementById('location');
            let source = href;
            ipcRenderer.invoke('path:format', location.value, e.target.value).then(destination => {
                ipcRenderer.send('rename', source, destination);
            })
        })

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Escape') {
                ipcRenderer.invoke('basename', href).then(basename => {
                    input.value = basename;
                    header_link.classList.remove('hidden');
                    input.classList.add('hidden');
                })
            }
        })
    })

    // selected_files_arr.forEach(href => {
    //     let active_tab_content = document.querySelector('.active-tab-content');
    //     let card = active_tab_content.querySelector(`[data-href="${href}"]`);
    //     let header = card.querySelector('.header');
    //     let header_link = card.querySelector('a');
    //     let input = card.querySelector('input');
    //     header_link.classList.add('hidden');
    //     input.classList.remove('hidden');
    //     input.select();
    //     input.focus();
    //     main.removeEventListener('keydown', quickSearch);
    //     input.addEventListener('change', (e) => {
    //         e.preventDefault();
    //         e.stopPropagation();

    //         let location = document.getElementById('location');
    //         let source = href;
    //         ipcRenderer.invoke('path:format', location.value, e.target.value).then(destination => {
    //             ipcRenderer.send('rename', source, destination);
    //         })
    //     })
    //     document.addEventListener('keyup', (e) => {
    //         if (e.key === 'Escape') {
    //             ipcRenderer.invoke('basename', href).then(basename => {
    //                 input.value = basename;
    //                 header_link.classList.remove('hidden');
    //                 input.classList.add('hidden');
    //             })
    //         }
    //     })
    // })
    // selected_files_arr = [];

}

// Sidebar Functions /////////////////////////////////////////////////////////////

// Get Properties View
function getProperties(properties_arr) {

    // console.log('running get properties');
    clearViews();

    let mb = document.getElementById('mb_info');
    mb.classList.add('active');

    let sidebar = document.querySelector('.sidebar');

    let properties_view = document.querySelector('.properties_view');
    if (properties_view) {
        properties_view.classList.remove('hidden');
    } else {
        properties_view = add_div();
        properties_view.classList.add('sb_properties', 'sb_view', 'properties_view');
        sidebar.append(properties_view);
    }

    properties_arr.forEach(file => {

        let card = add_div();
        let content = add_div();

        card.dataset.properties_href = file.href;

        let closebtn = add_div();
        let closeicon = document.createElement('i');
        closeicon.classList.add('bi', 'bi-x');
        closebtn.classList.add('float', 'right', 'pointer');
        closebtn.append(closeicon);
        card.append(closebtn);
        closebtn.addEventListener('click', (e) => {
            card.remove()

            let cards = document.querySelectorAll('.properties')
            if (cards.length === 0) {
                clearViews()
                sidebarHome();
            }

        })

        let tab_container = add_div()
        let tab_header = add_div()

        content.classList.add('content')
        card.classList.add('properties');
        // content.classList.add('grid2');

        let icon = add_div();
        icon.classList.add('icon');
        card.append(icon);

        content.append(add_item('Name:'), add_item(file.name));

        let folder_count = add_div();
        folder_count.classList.add('item', 'folder_count');

        let size = add_div();
        size.classList.add('size');
        size.append('Calculating..');

        // let file_count = add_div();
        // file_count.classList.add('item', 'file_count');
        // content.append(add_item('Foder Count:'), folder_count);

        content.append(add_item('Type:'), add_item(file.content_type));
        content.append(add_item(`Contents:`), folder_count);

        let location = add_item(file.location)
        location.title = file.location

        content.append(add_item('Location:'), location);
        if (file.is_dir) {
            folder_count.append('Calculating..');
            content.append(add_item('Size:'), add_item(size));
        } else {
            folder_count.append('1');
            content.append(add_item('Size:'), add_item(getFileSize(file.size)));
        }
        content.append(add_item(`Modified:`), add_item(getDateTime(file.mtime)));
        content.append(add_item(`Accessed:`), add_item(getDateTime(file.atime)));
        content.append(add_item(`Created:`), add_item(getDateTime(file.ctime)));

        card.append(content);

        properties_view.append(card);

        if (file.is_dir) {

            icon.append(add_img(folder_icon))
            ipcRenderer.send('get_folder_count', file.href);
            ipcRenderer.send('get_folder_size', file.href);
        } else {
            ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                icon.append(add_img(res));
            })
        }

        // note:
        // ipcRenderer.send('get_file_count', item.href);

    })

}

// Get Recent View
function getRecentView(dirents) {

    // console.log(dirents)

    let location = document.querySelector('.location')
    location.value = 'Recent'

    let folder_grid = add_div(['folder_grid']);
    let file_grid = add_div(['file_grid']);

    if (view === 'list') {
        folder_grid.classList.add('grid1')
        file_grid.classList.add('grid1')
        folder_grid.classList.remove('grid')
        file_grid.classList.remove('grid')
    } else {
        folder_grid.classList.add('grid')
        file_grid.classList.add('grid')
        folder_grid.classList.remove('grid1')
        file_grid.classList.remove('grid1')
    }

    let tab_content = add_tab('Recent')

    dirents.sort((a, b) => {
        return b.atime - a.atime
    })

    // console.log(dirents)

    let add_folder_label = 1;
    let add_file_label = 1;
    let folder_counter = 0;
    let file_counter = 0;
    dirents.forEach(file => {
        if (file.is_dir) {

            if (folder_counter < 20) {

                ++folder_counter;
                if (add_folder_label === 1) {
                    add_folder_label = 0;
                }

                let card = getCardGio(file);
                folder_grid.append(card)

            }

            getFolderCount(file.href);
            getFolderSize(file.href);

        } else {

            if (file_counter < 20) {
                ++folder_counter;
                if (add_file_label === 1) {
                    add_file_label = 0;
                }
            }

            let card = getCardGio(file);
            file_grid.append(card);
        }

    })

    tab_content.append(folder_grid, file_grid)
    localStorage.setItem('location', 'Recent');

    resizeIcons(localStorage.getItem('icon_size'));

    lazyload();

}

// Get Settings View
function getSettings() {

    let location = document.querySelector('.location');
    let tab_content = add_tab('Settings');

    ipcRenderer.invoke('path:join', __dirname, 'views/settings.html').then(path => {

        fetch(path)
        .then(res => {
            return res.text();
        })
        .then(settings_html => {

            tab_content.innerHTML = settings_html;
            location.value = 'Settings';
            // localStorage.setItem('location', 'Settings')

            ipcRenderer.invoke('settings')
            .then(res => res)
            .then(settings => settingsForm(settings))
            .catch(error => console.error('Error:', error))

        })
        .catch (err => {
            console.log(err)
        })

    })

}

let obj_key;
function settingsForm(settings) {

    const form = document.querySelector('.settings_view');

    // Object.keys(settings.Terminal).forEach(key => {
    //     console.log(settings)
    // })

    Object.keys(settings).forEach(key => {

        const value = settings[key];
        if (typeof value === 'object') {
            let header = document.createElement('h4');
            let hr = document.createElement('hr')

            header.classList.add('header');

            header.innerHTML = `${key.charAt(0).toUpperCase()}${key.slice(1)}`; //key.toUpperCase();
            form.append(hr, header);
            settingsForm(value);
        } else {

            // console.log(typeof value)
            let settings_item = add_div(['settings_item']);

            // Create input field for non-nested properties
            const label = document.createElement('label');
            label.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}:`;
            let input;
            if (typeof value === 'boolean') {
                // For boolean values, create a checkbox
                // input = document.createElement('input');
                // input.type = 'checkbox';
                // input.name = key;
                // input.checked = value;
                // settings_item.append(label, input);
            } else {
                // For other types (string, number), create a text input
                if (key === 'Description') {
                    input = add_div();
                    input.innerHTML = value
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                    input.name = key;
                    input.id = key;
                    input.value = value;

                    switch (key.toLocaleLowerCase()) {
                        case 'theme': {
                            // console.log('running theme')
                            input = document.createElement('select');
                            let options = ['Light', 'Dark']
                            options.forEach((option, i) => {
                                let option_select = document.createElement('option');
                                option_select.text = option
                                option_select.value = option
                                input.append(option_select);

                                if (option.toLocaleLowerCase() === value.toLocaleLowerCase()) {
                                    option_select.selected = true
                                }
                            })

                            // console.log('selecting ', value)


                            input.addEventListener('change', (e) => {
                                ipcRenderer.send('change_theme', input.value);
                                ipcRenderer.send('update_settings', key, input.value)
                            })

                            settings_item.append(label, input)
                            break;
                        }
                        case 'terminal': {
                            input.addEventListener('change', (e) => {
                                ipcRenderer.send('update_settings', key, input.value)
                            })
                            settings_item.append(label, input);
                            break;
                        }
                        case 'disk utility': {
                            input.addEventListener('change', (e) => {
                                ipcRenderer.send('update_settings', key, input.value)
                            })
                            settings_item.append(label, input);
                            break;
                        }
                        default: {
                            settings_item.append(label, input);
                            input.disabled = true;
                            break;
                        }

                    }
                }
            }

            // settings_item.append(label, input);
            form.appendChild(settings_item);

        }

    });

    for (let setting in settings.keyboard_shortcuts) {
        let input = document.getElementById(`${setting}`)

        input.addEventListener('change', (e) => {
            // Need some Input validation
            ipcRenderer.send('update_settings', setting, input.value)
        })
    };

}

function sidebarHome() {

    let mb = document.getElementById('mb_home');
    mb.classList.add('active');

    let sb_home = document.querySelector('.sb_home')
    if (sb_home) {
        sb_home.classList.remove('hidden')
    } else {
        sb_home = add_div();
        sb_home.classList.add('sb_home', 'sb_view');

        getHome(home => {
            sb_home.append(home)
        })

        // Workspace
        getWorkspace(workspace => {
            sb_home.append(document.createElement('br'));
            sb_home.append(workspace)
        })

        // Get Device
        getDevices(devices => {
            sb_home.append(document.createElement('br'));
            sb_home.append(devices)
        })

        sidebar.append(sb_home)
    }

    // sb_home.innerHTML = ''

    // let sidebar = document.getElementById('sidebar')
    // sidebar.innerHTML = ''

}

function getSub(dir) {
    ipcRenderer.send('get_sub', dir);
}

function getSubFolders(dir, callback) {
    ipcRenderer.invoke('get_subfolders', dir).then(dirents => {
        // console.log('dir', dirents)
    })
}

// Get Home
function getHome(callback) {

    let location = document.getElementById('location');
    // let home_dir = os.homedir();
    let my_computer_arr = [
        'Home',
        'Documents',
        'Downloads',
        'Music',
        'Pictures',
        'Videos',
        'Recent',
        'File System'
    ]

    let my_computer_paths_arr = [
        'Home',
        'Documents',
        'Downloads',
        'Music',
        'Pictures',
        'Videos',
        'Recent',
        '/'
    ]

    let my_computer_icons_arr = [
        'house',
        'folder',
        'download',
        'file-music',
        'image',
        'film',
        'clock-history',
        'hdd'
    ]

    localStorage.setItem('minibar', 'mb_home')

    let home = add_div();
    home.innerHTML = ''
    home.append(add_header('Home'))

    // Get home
    for (let i = 0; i < my_computer_arr.length; i++) {

        let href = my_computer_paths_arr[i];
        let item = add_div();

        item.classList.add('item');

        let link = add_link(my_computer_paths_arr[i], my_computer_arr[i]);
        item.append(add_icon(my_computer_icons_arr[i].toLocaleLowerCase()), link);
        home.append(item);

        item.title = link.href.replace('file://', '');

        item.addEventListener('click', (e) => {
            let items = home.querySelectorAll('.item');
            items.forEach(item => {
                item.classList.remove('active');
            })

            item.classList.add('active')
            if (href === 'Recent') {
                ipcRenderer.send('get_recent_files', location.value);
            } else {
                ipcRenderer.invoke('nav_item', my_computer_paths_arr[i]).then(nav_path => {
                    if (e.ctrlKey) {
                        getView(nav_path, 1);
                    } else {
                        getView(nav_path);
                    }
                })
            }
        })

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
    return callback(home);
}

// Get Workspace
function getWorkspace(callback) {

    ipcRenderer.invoke('get_workspace').then(res => {

        let workspace = document.getElementById('workspace');
        if (!workspace) {
            workspace = add_div(); //document.getElementById('workspace');
            workspace.id = 'workspace'
            workspace.classList.add('workspace')
        }
        workspace.innerHTML = ''
        workspace.append(add_header('Workspace'));

        if (res.length == 0) {
            workspace.append('Drop a file or folder');
        }

        workspace.addEventListener('mouseout', (e) => {
            workspace.classList.remove('active')
        })

       workspace.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            workspace.classList.add('active')
        })

        workspace.addEventListener('dragleave', (e) => {
            workspace.classList.remove('active')
        })

        workspace.addEventListener('drop', (e) => {
            getSelectedFiles()
            ipcRenderer.send('add_workspace', selected_files_arr);
            clear()
        })

        res.forEach(file => {

            let workspace_div = add_div(['flex', 'item'])
            let workspace_item = add_div(['workspace_item']);
            let img = document.createElement('img')

            // workspace_item.classList.add('item');
            img.classList.add('icon', 'icon16')

            let a = document.createElement('a');
            a.href = file.href;
            a.innerHTML = file.name;
            a.preventDefault = true;

            if (file.content_type === 'inode/directory') {
                img.src = folder_icon;
                workspace_item.append(a);
                workspace_div.append(img, workspace_item);
            } else {
                ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                    img.src = res;
                    workspace_item.append(a);
                    workspace_div.append(img, workspace_item);
                    // workspace_item.append(img, a);
                })
            }

            workspace_div.addEventListener('mouseover', (e) => {
                workspace_div.title = file.href
            })

            // Show Workspace Context Menu
            workspace_div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                ipcRenderer.send('workspace_menu', file);
                workspace_div.classList.add('highlight')
            });

            // Open Workspace Item
            workspace_div.addEventListener('click', (e) => {
                e.preventDefault();
                if (file.is_dir) {
                    getView(file.href);
                } else {
                    ipcRenderer.send('open', file.href);
                }

            })

            // workspace_item.append(img, a);
            workspace.append(workspace_div);

        })
        return callback(workspace);

    })
}

// Get Devices
function getDevices(callback) {

    let location = document.getElementById('location');
    let devices = document.querySelector('device_view')
    if (!devices) {
        devices = add_div()
        devices.classList.add('device_view')
        devices.append(add_header('Devices'));
        ipcRenderer.invoke('get_devices').then(device_arr => {
            // console.log('running get devices', device_arr)
            device_arr.sort((a, b) => {
                return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase());
            })

            device_arr.forEach(device => {

                let item = add_div();
                let a = document.createElement('a');
                a.preventDefault = true;
                a.href = device.path; //item.href;
                a.innerHTML = device.name;

                item.classList.add('item');

                if (item.type == 0) {
                    item.append(add_icon('usb-symbol'), a);
                } else {
                    item.append(add_icon('hdd-network'), a);
                }

                item.addEventListener('mouseover', (e) => {
                    item.title = device.path
                })

                item.addEventListener('click', (e) => {
                    e.preventDefault();

                    // console.log('device path', device.path)
                    getView(`${device.path}`);

                })

                item.addEventListener('contextmenu', (e) => {
                    ipcRenderer.send('device_menu', device.path, device.uuid);
                    item.classList.add('highlight_select');
                })

                devices.append(item);
            })

            return callback(devices)

        }).catch(err => {
            console.log(err);
        })
    }
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
    let active_tab_content = document.querySelector('.active-tab-content');
    let selected_items = Array.from(active_tab_content.querySelectorAll('.highlight, .highlight_select, .ds-selected'));
    selected_items.forEach(item => {
        // console.log(item)
        selected_files_arr.push(item.dataset.href);
        // selected_files_arr.push(item.dataset.search_href);
    })
    if (selected_files_arr.length == 1) {
        msg(`${selected_files_arr.length} Item Selected`);
    } else if (selected_files_arr.length > 1) {
        msg(`${selected_files_arr.length} Items Selected`);
    } else {
        msg(`No Items Selected`);
    }

    // console.log(selected_files_arr)
    ipcRenderer.send('get_selected_files', selected_files_arr);

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
    // console.log('running paste', destination)
    ipcRenderer.send('paste', destination);
    clearHighlight();
}

function move(destination) {

    ipcRenderer.send('move', destination);
    selected_files_arr = [];

}

// Get Folder Count
function getFolderCount(href) {
    // console.log('running get folder count', href)
    ipcRenderer.send('count', href);
}

// Load Folder Size Seperatley
function getFolderSize(href) {

    ipcRenderer.invoke('get_folder_size', (href)).then(res => {
        let active_tab_content = document.querySelector('.active-tab-content')
        let card = active_tab_content.querySelector(`[data-href="${href}"]`);
        if (card) {
            let size = card.querySelector('.size');
            size.innerHTML = '';

            // if (href.indexOf('sftp:') > -1) {
            //     size.innerHTML = ''
            // } else {
                card.dataset.size = res;
                size.append(getFileSize(res));
            // }

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

    let location = document.getElementById('location');
    let is_dir   = 0;
    let is_symlink = 0;

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

    card.style.opacity = 1;

    href.href = file.href;
    href.innerHTML = file.name;
    input.value = file.name;
    card.dataset.name = file.name;

    input.spellcheck = false;
    input.type = 'text';
    input.dataset.href = file.href;

    href.draggable = false;
    img.draggable = false;
    icon.draggable = false;
    card.draggable = true;

    card.dataset.href = file.href;
    card.dataset.mtime = file.mtime;
    card.dataset.size = file.size;

    // tooltip.append(`Name: ${path.basename(file.href)}`);
    let tooltip_timeout;

    // Mouse Over
    card.addEventListener('mouseover', (e) => {

        card.classList.add('highlight');
        title =
            'Name: ' + file.name +
            '\n' +
            'Location: ' + file.location +
            '\n' +
            'Size: ' + getFileSize(file.size) +
            '\n' +
            'Accessed: ' + getDateTime(file.atime) +
            '\n' +
            'Modified: ' + getDateTime(file.mtime) +
            // '\n' +
            // 'Created: ' + getDateTime(file.ctime) +
            '\n' +
            'Type: ' + file.content_type

        card.title = title;


        // main.tabIndex = 0;
        // tooltip_timeout = setTimeout(() => {

        //     // Calculate the position
        //     const rect = card.getBoundingClientRect();
        //     const top = rect.top + rect.height;
        //     const left = rect.left;

        //     // const main_rect = main.getBoundingClientRect();

        //     // Set the position of the popup
        //     tooltip.style.top = top + 'px';
        //     tooltip.style.left = left + 'px';

        //     tooltip.classList.remove('hidden')
        //     tooltip.innerText = title;

        //     const tooltip_rect = tooltip.height;


        // }, 1000);

    })

    tooltip.addEventListener('mouseout', (e) => {
        tooltip.classList.add('hidden')
    })

    card.addEventListener('mouseout', (e) => {
        clearTimeout(tooltip_timeout);
        tooltip.classList.add('hidden');
        card.classList.remove('highlight');
    })

    card.addEventListener('mouseenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
    })

    // Mouse Leave
    card.addEventListener('mouseleave', (e) => {

    })

    // Card ctrl onclick
    card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.ctrlKey) {
            if (card.classList.contains('ds-selected')) {
                card.classList.remove('highlight_select')
            } else {
                card.classList.add('highlight_select')
            }
        }
    })

    card.addEventListener('dragstart', (e) => {

        e.stopPropagation();

        // clearTimeout(tooltip_timeout);
        // tooltip.classList.add('hidden')
        // clearTimeout(tooltip_timeout)
        getSelectedFiles();

        // const dataTransfer = new DataTransfer();
        // dataTransfer.setData('application/x-electron-file', file.href)
        // // console.log(dataTransfer)
        // ipcRenderer.send('ondragstart', file.href)
        // selected_files_arr.forEach(href => {
            // e.dataTransfer.setData('application/x-electron-file', JSON.stringify([{ path: href }]));
            // ipcRenderer.send('ondragstart', path.join(process.cwd(), href))
            // e.target.classList.add('dragged')
        // })
    })

    card.addEventListener('dragenter', (e) => {
        // e.preventDefault();
        // e.stopPropagation();
    })

    card.addEventListener('dragover', (e) => {
        e.preventDefault();

        if (is_dir && !card.classList.contains('highlight')) {
            card.classList.add('highlight_target');
            if (e.ctrlKey) {
                e.dataTransfer.dropEffect = "copy";
                // msg(`Copy Item to "${file.href}"`, 0);
            } else {
                e.dataTransfer.dropEffect = "move";
                // msg(`Move Item to "${file.href}"`, 0);
            }

        }
    })

    card.addEventListener('dragleave', (e) => {
        card.classList.remove('highlight_target');
        msg('');
    })

    card.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        ipcRenderer.send('main', 0)
        if (!card.classList.contains('highlight') && card.classList.contains('highlight_target')) {
            if (e.ctrlKey) {
                paste(file.href);
            } else {
                // console.log('moving to', file.href);
                move(file.href);
            }
        } else {
            // console.log('did not find target')
        }
    })

    mtime.append(getDateTime(file.mtime));
    ctime.append(getDateTime(file.ctime));
    atime.append(getDateTime(file.atime));
    type.append(file.content_type);

    icon.append(img);
    header.append(href, input);

    // console.log(file)

    // Directory
    if (file.is_dir || file.type === 'inode/directory') {

        is_dir = 1;
        img.src = folder_icon;
        card.classList.add('folder_card', 'lazy')

        if (file.is_symlink) {
            let symlink_img = document.createElement('img');
            symlink_img.src = symlink_icon;
            symlink_img.classList.add('symlink');
            icon.append(symlink_img);
        }

        // Href
        href.addEventListener('click', (e) => {
            e.preventDefault();
            location.value = file.href;
            if (e.ctrlKey) {
                ipcRenderer.send('get_files', file.href, 1);
            } else {
                location.dispatchEvent(new Event('change'));
            }
            ipcRenderer.send('saveRecentFile', file.href);
        })

        // Img
        img.addEventListener('click', (e) => {
            e.preventDefault();
            location.value = file.href;
            if (e.ctrlKey) {
                ipcRenderer.send('get_files', file.href, 1);
            } else {
                location.dispatchEvent(new Event('change'));
            }
            ipcRenderer.send('saveRecentFile', file.href);
        })
        // Context Menu
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.add('highlight_select')
            ipcRenderer.send('folder_menu', file);
        })

    // Files
    } else {
        // Get Icon
        try {

            if (file.is_symlink) {
                let symlink_img = document.createElement('img');
                symlink_img.src = symlink_icon;
                symlink_img.classList.add('symlink');
                icon.append(symlink_img);
            }

            if (file.content_type.indexOf('image/') > -1) {

                // Load generic icon
                img.src = './assets/icons/image-generic.svg';

                if (file.content_type === 'image/x-xcf') {
                    img.classList.remove('lazy')
                    ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                        img.src = res;
                    })
                } else if (file.content_type === 'image/svg+xml') {
                    img.classList.add('lazy')
                    img.dataset.src = file.href;
                    img.classList.add('svg')
                } else if (file.content_type === 'image/webp') {
                    img.src = file.href;
                } else if (file.content_type === 'image/gif') {
                    img.src = file.href;
                } else {
                    img.src = './assets/icons/image-generic.svg';

                    if (file.href.indexOf('thumbnails') > 1) {
                        img.src = file.href
                    } else if (file.href.indexOf('mtp') > -1) {
                        ipcRenderer.invoke('get_thumbnail', file).then(thumbnail => {
                            img.src = thumbnail;
                        })
                    } else {
                        ipcRenderer.invoke('get_thumbnail', file).then(thumbnail => {
                            img.src = thumbnail;
                        })
                    }

                }
            } else if (file.content_type.indexOf('video/') > -1) {
                ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                    img.src = res;
                })
            } else {
                ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                    img.src = res;
                })
            }
        } catch (err) {
            ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                img.src = res;
            })
        }
        // Open href in default application
        href.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.send('open', file.href);
            ipcRenderer.send('saveRecentFile', file.href);

        })
        img.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.send('open', file.href);
            ipcRenderer.send('saveRecentFile', file.href);
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
        content.append(header, mtime, ctime, atime, size, count);
    }

    if (view === 'grid') {
        card.classList.remove('list');
        content.classList.remove('list');
        content.append(header, mtime, ctime, atime, size, count);
    }

    card.append(icon, content, tooltip);
    ds.addSelectables(card);

    return card;
}

/**
 * Get Grid View
 * @param {*} dir
 * @param {*} callback
 */
function getView(dir, tab = 0) {

    let main = document.querySelector('.main');
    main.classList.add('loader')
    // Moved code
    // reference: ipcRenderer.on('ls', (e, dirents)
    // getSubFolders(dir, () => {});
    ipcRenderer.send('get_files', dir, tab);
    clearHighlight();

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

// function lazyloadCards() {
//     // Lazy load images
//     let lazy = [].slice.call(document.querySelectorAll('.card'));
//     // // console.log(lazy)
//     // Check if window
//     if ("IntersectionObserver" in window) {
//         // Get reference to lazy objects
//         let lazyObserver = new IntersectionObserver(function (entries, observer) {
//             // console.log('entries', entries.length);
//             entries.forEach((e, idx) => {
//                 if (e.isIntersecting) {
//                     let lazyCard = e.target;
//                     // let card = document.querySelector(`[data-href="${lazyCard.dataset.href}"]`)
//                     // // console.log(file);
//                     // card.append(getCardGio(file));
//                     // lazyCard.append(card);
//                     // lazyCard.src = lazyCard.dataset.src;
//                     lazyCard.classList.remove("lazy");
//                     // // console.log(lazyCard.dataset.href)
//                     // ipcRenderer.send('get_card_gio', lazyCard.dataset.href);
//                     lazyObserver.unobserve(lazyCard);
//                 }
//             })
//         })
//         // THIS RUNS ON INITIAL LOAD
//         for (let i = 0; i < lazy.length; i++) {
//             lazyObserver.observe(lazy[i])
//         }
//     }
// }

function lazyload() {
    // Lazy load images
    let lazyImages = [].slice.call(document.querySelectorAll(".lazy"))
    // CHECK IF WINDOW
    if ("IntersectionObserver" in window) {
        // GET REFERENCE TO LAZY IMAGE
        let lazyImageObserver = new IntersectionObserver(function (entries, observer) {
            // console.log('entries', entries.length)
            entries.forEach((e, idx) => {
                if (e.isIntersecting) {

                    let img = e.target;
                    img.src = img.dataset.src;
                    // let exists = fs.existsSync(thumbnail);
                    // if (exists) {
                    //     console.log(thumbnail)
                    //     img.src = thumbnail;
                    // } else {
                    //     // ipcRenderer.send('create_thumbnail', img.dataset.src, thumbnail);
                    //     img.src = img.dataset.src;
                    // }

                    img.classList.remove("lazy");
                    lazyImageObserver.unobserve(img);
                }
            })
        })
        // THIS RUNS ON INITIAL LOAD
        for (let i = 0; i < lazyImages.length; i++) {
            lazyImageObserver.observe(lazyImages[i])
        }
    }
}

function quickSearch (e) {
    let main = document.querySelector('.main');
    let quicksearch = add_div(['quicksearch', 'bottom', 'right']); //document.querySelector('.quicksearch');
    let txt_quicksearch = document.createElement('input'); //document.getElementById('txt_quicksearch');

    txt_quicksearch.id = 'txt_quicksearch';
    txt_quicksearch.classList.add('input');
    txt_quicksearch.type = 'text';

    quicksearch.append(txt_quicksearch);
    quicksearch.classList.remove('hidden');
    main.append(quicksearch);

    txt_quicksearch.focus();

    txt_quicksearch.addEventListener('keydown', (e) => {
        if (/^[A-Za-z]$/.test(e.key)) {
            // txt_quicksearch.value = e.key
        }

        if (e.key === 'Enter') {

            let cards = document.querySelectorAll('.card')
            cards.forEach(card => {
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
}

function clearViews() {

    let mb = document.getElementById('minibar');
    let mb_items = mb.querySelectorAll('.item');
    mb_items.forEach(mb_item => {
        mb_item.classList.remove('active');
    })

    let views = document.querySelectorAll('.sb_view');
    views.forEach(view => {
        view.classList.add('hidden');
    })
}

// Main - This runs after html page loads.
window.addEventListener('DOMContentLoaded', (e) => {

    try {

        // Primary Controls
        let location = document.querySelector('.location');
        let main = document.querySelector('.main');
        let sidebar = document.querySelector('.sidebar');
        let slider = document.getElementById('slider');
        let header_menu = document.querySelectorAll('.menu_bar');
        let nav_menu = document.querySelector('.nav_menu');
        let settings  = document.querySelector('.settings');
        // let active_tab_content = document.querySelector('.active-tab-content');

        // Flags
        let cut_flag = 0;
        let show_sidebar = 0;

        let minibar = document.getElementById('minibar');
        let mb_items = minibar.querySelectorAll('.item');
        mb_items.forEach(mb_item => {

            mb_item.addEventListener('click', (e) => {

                clearViews();

                let sb_view;
                switch (mb_item.id) {
                    case 'mb_home': {
                        sb_view = document.querySelector('.sb_home');
                        sb_view.classList.remove('hidden');
                        sidebarHome();
                        mb_item.classList.add('active')
                        break;
                    }
                    case 'mb_workspace': {
                        getWorkspace(workspace => {
                            sidebar.innerHTML = '';
                            sidebar.append(workspace);
                        })
                        mb_item.classList.add('active')
                        break;
                    }
                    case 'mb_find': {
                        // sb_view = document.querySelector('.sb_search');
                        // sb_view.classList.remove('hidden');
                        // getSearch();
                        mb_item.classList.add('active')
                        find_files(res => {})
                        break;
                    }
                    case 'mb_info': {
                        // sb_view = document.querySelector('.sb_search');
                        // sb_view.classList.remove('hidden');
                        let properties_view = document.querySelector('.properties_view');
                        properties_view.classList.remove('hidden')
                        mb_item.classList.add('active')
                        break;
                    }
                }
                sidebar.classList.remove('hidden');
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
            location.value = localStorage.getItem('location');
        } else {

            ipcRenderer.invoke('home').then(home => {
                location.value = home;
                getView(location.value);
                localStorage.setItem('location', location.value);
            })
            // location.value = os.homedir();
            // localStorage.setItem('location', location.value);
        }

        // Load view on reload
        if (location.value != "") {
            switch (location.value) {
                case 'Recent': {
                    ipcRenderer.send('get_recent_files');
                    break;
                }
                case 'Settings': {
                    getSettings();
                    break;
                }
                default: {
                    getView(location.value)
                    break;
                }
            }
        }

        // Change Location on change
        location.onchange = () => {
            if (location.value != "") {
                getView(location.value)
            }
        }

        // Auto Complete
        // let autocomplete_container = document.querySelector('.autocomplete_container');
        // if (!autocomplete_container) {
        //     autocomplete_container = add_div(['autocomplete', 'hidden']);
        //     const input_container = nav_menu.querySelector('.input');
        //     input_container.append(autocomplete_container);
        // }
        // location.addEventListener('input', (e) => {
        //     let input = location.value.trim().toLocaleLowerCase();
        //     autocomplete_container.innerHTML = '';
        //     const dir_list = auto_complete_arr.filter(option => {
        //         return option.toLowerCase().startsWith(input);
        //     });
        //     dir_list.forEach((dir, i) => {
        //         let suggestion = add_div(['suggestion']);
        //         suggestion.textContent = dir;
        //         autocomplete_container.appendChild(suggestion);
        //         autocomplete_container.classList.remove('hidden');
        //         suggestion.addEventListener('click', (e) => {
        //             getView(dir);
        //             autocomplete_container.classList.add('hidden');
        //         })
        //     })
        // })
        // location.addEventListener('keydown', (e) => {
        //     if (e.key === 'Escape') {
        //         autocomplete_container.classList.add('hidden');
        //     }
        // })

        // Handle Sidebar
        if (localStorage.getItem('sidebar') !== null) {
            show_sidebar = localStorage.getItem('sidebar');
        } else {
            show_sidebar = 1;
            localStorage.setItem('sidebar', show_sidebar);
        }

        if (parseInt(show_sidebar)) {
            sidebar.classList.remove('hidden');
        } else {
            sidebar.classList.add('hidden');
        }

        ///////////////////////////////////////////////////////////////

        // Menu Items

        header_menu.forEach(item => {
            let menu_items = item.querySelectorAll('.item')
            menu_items.forEach(menu_item => {
                menu_item.classList.remove('active')
            })
        })

        let nav_items = document.querySelectorAll('.nav_item')
        // console.log(nav_items)
        nav_items.forEach(nav_item => {
            nav_item.addEventListener('click', (e) => {
                let dir = nav_item.innerText.replace(' ', '');
                if (dir === 'Home') {dir = ''}
                ipcRenderer.invoke('nav_item', dir).then(path => {
                    location.value = path;
                    getView(path)
                })
            })
        })

        // // Home
        // let home = document.querySelectorAll('.home');
        // home.forEach(item => {

        //     item.onclick = (e) => {
        //         e.preventDefault();
        //         location.value = os.homedir();
        //         location.dispatchEvent(new Event('change'));
        //     }
        // });

        // // Documents
        // let documents = document.querySelectorAll('.documents');
        // documents.forEach(item => {
        //     item.onclick = (e) => {
        //         e.preventDefault();
        //         location.value = path.join(os.homedir(), 'Documents');
        //         location.dispatchEvent(new Event('change'));
        //     }
        // });

        // // Downloads
        // let downloads = document.querySelectorAll('.downloads');
        // downloads.forEach(item => {
        //     item.onclick = (e) => {
        //         e.preventDefault();
        //         location.value = path.join(os.homedir(), 'Downloads');
        //         location.dispatchEvent(new Event('change'));
        //     }
        // });

        // // Music
        // let music = document.querySelectorAll('.music');
        // music.forEach(item => {
        //     item.onclick = (e) => {
        //         e.preventDefault();
        //         location.value = path.join(os.homedir(), 'Music');
        //         location.dispatchEvent(new Event('change'));
        //     }
        // });

        // // Pictures
        // let pictures = document.querySelectorAll('.pictures');
        // pictures.forEach(item => {
        //     item.onclick = (e) => {
        //         e.preventDefault();
        //         location.value = path.join(os.homedir(), 'Pictures');
        //         location.dispatchEvent(new Event('change'));
        //     }
        // });

        // // videos
        // let videos = document.querySelectorAll('.videos');
        // videos.forEach(item => {
        //     item.onclick = (e) => {
        //         e.preventDefault();
        //         location.value = path.join(os.homedir(), 'Videos');
        //         location.dispatchEvent(new Event('change'));
        //     }
        // });

        // List view
        let list_view = document.querySelectorAll('.list_view');
        list_view.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                view = 'list';
                localStorage.setItem('view', view);
                switch_view(view);
                // getView(location.value);
            })
        })

        // Grid view
        let grid_view = document.querySelectorAll('.grid_view');
        grid_view.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                view = 'grid';
                localStorage.setItem('view', view);
                switch_view(view);
                // getView(location.value);
            })
        })

        // Show hidden
        let show_hidden = document.querySelectorAll('.show_hidden')
        show_hidden.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                // localStorage.setItem('show_hidden', view);
                toggleHidden()
            })
        })

        // Disk usage
        let disk_usage = document.querySelector('.disk_usage')
        disk_usage.addEventListener('click', (e) => {
            get_disk_summary_view(disk_usage => {
                main.append(disk_usage)
            })
        })

        // Navigate left
        let left = document.getElementById('left');
        left.addEventListener('click', (e) => {

            ipcRenderer.invoke('dirname', location.value).then(dir => {
                getView(dir);
                localStorage.setItem('location', dir);
                // location.value = location.value.replace(dir, '');
                // getView(location.value);
                // localStorage.setItem('location', location.value);
            })

        })

        // Settings
        settings.addEventListener('click', (e) => {
            getSettings();
        })

        /////////////////////////////////////////////////////////////////

        // Main Context Menu
        main.addEventListener('contextmenu', (e) => {
            // e.preventDefault();
            // console.log('running main menu');
            ipcRenderer.send('main_menu', location.value);
        })

        // Get on mouse over
        document.addEventListener('mouseover', (e) => {
            // Send the active window id to main
            ipcRenderer.send('active_window');
        })

        let special_view = 0;
        if (location.value === 'Recent' || location.value === 'Settings') {
            special_view = 1;
        }

        // document.addEventListener('keydown', (e) => {

            ipcRenderer.invoke('settings').then(res => {
                shortcut =  res.keyboard_shortcuts;
            }).then(() => {

                // Delete
                mt.bind(shortcut.Delete.toLocaleLowerCase(), (e) => {
                    e.preventDefault();
                    getSelectedFiles();
                    if (selected_files_arr.length > 0) {
                        ipcRenderer.send('delete', (selected_files_arr));
                    }
                    clear();
                })

                // Escape (Cancel)
                mt.bind(shortcut.Escape.toLocaleLowerCase(), (e) => {
                    // Clear Arrays and selected items
                    clear();
                })

                // Reload
                mt.bind(shortcut.Reload.toLocaleLowerCase(), (e) => {
                    getView(location.value)
                })

                // Edit
                mt.bind(shortcut.Rename.toLocaleLowerCase(), (e) => {
                    edit();
                })

                // Ctrl+C (Copy)
                mt.bind(shortcut.Copy.toLocaleLowerCase(), (e) => {
                    getSelectedFiles();
                })

                // Ctrl+X (Cut)
                mt.bind(shortcut.Cut.toLocaleLowerCase(), (e) => {
                    cut_flag = 1;
                    getSelectedFiles();
                    selected_files_arr.forEach(item => {
                        let active_tab_content = document.querySelector('.active-tab-content');
                        let card = active_tab_content.querySelector(`[data-href="${item}"]`);
                        card.style = 'opacity: 0.6 !important';
                    })
                })

                // Ctrl+V (Paste)
                mt.bind(shortcut.Paste.toLocaleLowerCase(), (e) => {
                    ipcRenderer.send('main', 1);
                    if (cut_flag) {
                        move(location.value);
                    } else {
                        paste(location.value);
                    }
                    cut_flag = 0;
                })

                // Show / Hide Sidebar
                mt.bind(shortcut.ShowSidebar.toLocaleLowerCase(), (e) => {
                    if (sidebar.classList.contains('hidden')) {
                        sidebar.classList.remove('hidden');
                        localStorage.setItem('sidebar', 1);
                    } else {
                        sidebar.classList.add('hidden');
                        localStorage.setItem('sidebar', 0);
                    }
                })

                // Find
                mt.bind(shortcut.Find.toLocaleLowerCase(), (e) => {
                    // getSearch();
                    find_files(res => {})
                })

                // Quick Search
                mt.bind(shortcut.QuickSearch.toLowerCase(), (e) => {
                    quickSearch(e);
                })

                // New Window
                mt.bind(shortcut.NewWindow.toLocaleLowerCase(), (e) => {
                    ipcRenderer.send('new_window');
                })

                // Show Home View Sidebar
                mt.bind(shortcut.ShowHome.toLocaleLowerCase(), (e) => {
                    clearViews();
                    sidebarHome();
                })

                // Get File Info
                mt.bind(shortcut.Properties.toLocaleLowerCase(), (e) => {
                    getSelectedFiles();
                    ipcRenderer.send('get_properties', selected_files_arr, location.value);
                    selected_files_arr = [];
                })

                // Select All
                mt.bind(shortcut.SelectAll.toLocaleLowerCase(), (e) => {
                    e.preventDefault();
                    let cards = main.querySelectorAll('.card')
                    cards.forEach(item => {
                        item.classList.add('highlight');
                    })
                })

                // Go Back
                mt.bind(shortcut.Backspace.toLocaleLowerCase(), (e) => {
                    ipcRenderer.invoke('dirname', location.value).then(dir => {
                        // console.log('dir', dir)
                        // location.value = location.value.replace(dir, '');
                        getView(dir);
                        localStorage.setItem('location', dir);
                    })
                    // ipcRenderer.invoke('basename', location.value).then(basename => {
                    //     location.value = basename;
                    //     getView(location.value);
                    // })
                    // localStorage.setItem('location', location.value);
                })

                // Add to Workspace
                mt.bind(shortcut.AddWorkspace.toLocaleLowerCase(), (e) => {
                    getSelectedFiles()
                    ipcRenderer.send('add_workspace', selected_files_arr);
                    clear()
                })

                // New Folder
                mt.bind(shortcut.NewFolder.toLocaleLowerCase(), (e) => {
                    ipcRenderer.send('new_folder', location.value);
                })

                // Show settings
                mt.bind(shortcut.ShowSettings.toLocaleLowerCase(), (e) => {
                    getSettings();
                })

                // Extract Compressed Files
                mt.bind(shortcut.Extract.toLocaleLowerCase(), (e) => {
                    extract();
                })

                // Compress Files
                mt.bind(shortcut.Compress.toLocaleLowerCase(), (e) => {
                    compress('zip');
                })

                // New Tav
                mt.bind(shortcut.NewTab.toLocaleLowerCase(), (e) => {
                    getView(location.value, 1);
                })


                mt.bind(shortcut.Down.toLocaleLowerCase(), (e) => {
                    console.log('down')
                })

            })

        // })


        // Get local storage for icon size
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
                    // localStorage.setItem('icon_size', init_size);
                    // console.log("scrolling up", init_size)
                }
            } else if (e.ctrlKey && e.deltaY > 0) {
                if ((init_size) > 16) {
                    init_size -= 16
                    resizeIcons(init_size);
                    // localStorage.setItem('icon_size', init_size);
                    // console.log("scrolling up", init_size)
                }
            }
        })

        slider.addEventListener('change', (e) => {
            init_size = slider.value;
            resizeIcons(init_size);
            // localStorage.setItem('icon_size', init_size);
        })

        sidebarHome();

        // INITIALIZE DRAG SELECT
        try {

            ds = new DragSelect({
                area: main, //document.querySelector('.active-tab-content'), //main, //document.getElementById('files_grid'),
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
            // console.log(err);
        }


        // Resize Sidebar -----------------------------------------------------
        // let sidebarWidth = '350';

        // Get references to the resize handle element
        const resizeHandle = document.getElementById("draghandle");

        // Add event listener to the resize handle
        resizeHandle.addEventListener("mousedown", startResize);

        // Function to handle the resize action
        function startResize(e) {

            // Get the initial mouse position
            const initialMousePos = e.clientX;

            // Get the initial widths of sidebar and main divs
            const initialSidebarWidth = sidebar.offsetWidth;
            const initialMainWidth = main.offsetWidth;

            // Add event listeners for mousemove and mouseup events
            document.addEventListener("mousemove", resize);
            document.addEventListener("mouseup", stopResize);

            main.classList.add('margin_left')

            // Function to handle the resizing logic
            function resize(e) {
                // Calculate the distance moved by the mouse
                const distanceMoved = e.clientX - initialMousePos;

                // Calculate the new widths of sidebar and main divs
                const newSidebarWidth = initialSidebarWidth + distanceMoved;
                const newMainWidth = initialMainWidth - distanceMoved;

                if (newSidebarWidth < 500) {
                    // Set the new widths
                    sidebar.style.width = newSidebarWidth + "px";
                    main.style.width = newMainWidth + "px";
                }

            }

            // Function to stop the resizing action
            function stopResize() {

                document.removeEventListener("mousemove", resize);
                document.removeEventListener("mouseup", stopResize);

                // console.log('testing', sidebar.style.width)
                localStorage.setItem('sidebar_width', sidebar.style.width)

            }
        }

        if (localStorage.getItem("sidebar_width") !== null) {
            // console.log(localStorage.getItem("sidebar_width"));
            sidebar.style.width = localStorage.getItem("sidebar_width")
        }


    } catch (err) {
        console.log(err)
    }

});