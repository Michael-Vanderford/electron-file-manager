const { ipcRenderer } = require('electron');

class FileManager {

    constructor(tabManager, iconManager) {

        // this.events = [];
        this.tabManager = tabManager;
        this.iconManager = iconManager;

        this.loaded_rows = 0;
        this.chunk_size = 1000;
        this.view = '';
        this.selected_files = [];
        this.files_arr = [];
        this.location0 = '';
        this.location = '';
        this.startup = 1;

        this.tab_data_arr = [];
        this.drag_handle = null;

        this.ctrlKey = false;

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Control') this.ctrKey = true;
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control') this.ctrKey = false;
        });

        this.main = document.querySelector('.main');
        if (!this.main) {
            console.log('error getting main');
            return;
        }

        // get view settings
        this.view = settingsManager.get_view_settings();

        if (settingsManager.get_location() === '') {
            this.location = utilities.home_dir;
        } else {
            this.location = settingsManager.get_location();
        }

        // this.get_files(this.location);
        let tabs = tabManager.get_tabs();
        if (tabs.length > 0) {
            tabs.forEach(tab => {
                console.log('location', tab.tab.location);

                // tabManager.add_tab(tab.tab.location);
                this.get_files(tab.tab.location, true);


            })
        }

        this.filter = document.querySelector('.filter');
        this.specialKeys = [
            'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Shift', 'Backspace',
            'Tab', 'PageUp', 'PageDown', 'Home', 'End', 'Control', 'Alt', 'Meta', 'Escape',
            'CapsLock', 'Insert', 'Delete', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8',
            'F9', 'F10', 'F11', 'F12', 'ScrollLock', 'Pause', 'ContextMenu', 'PrintScreen',
            'NumLock'
        ];
        this.init_filter();

        // resize column
        this.list_view_settings = settingsManager.get_list_view_settings();
        this.settings = settingsManager.get_settings();

        // get sort settings
        this.sort_by = this.settings.sort_by;
        this.sort_direction = this.settings.sort_direction;

        if (this.sort_by === undefined || this.sort_by === null || this.sort_by === '') {
            this.sort_by = 'mtime';
        }

        if (this.sort_direction === undefined || this.sort_direction === null || this.sort_direction === '') {
            this.sort_direction = 'desc';
        }

        this.initialX = 0;
        this.initialWidth = 0;
        this.sidebar_width = 0;
        this.nextColumn = null;

        this.currentColumn = null;
        this.dragHandle = null;
        this.startX = 0;
        this.startWidth = 0;
        this.minWidth = 50; // Minimum column width
        this.maxWidth = 1000; // Maximum column width

        this.is_resizing = false;
        this.resize_col = this.resize_col.bind(this);
        this.stop_col_resize = this.stop_col_resize.bind(this);

        // sort menu
        ipcRenderer.on('sort_by', (e, sort, sort_direction) => {

            console.log('sort by', sort, sort_direction)

            if (sort === null || sort === undefined || sort === '') {
                utilities.set_msg(`Error: Sort is null or undefined ${sort}`);
                return;
            }
            if (sort_direction === null || sort_direction === undefined || sort_direction === '') {
                utilities.set_msg(`Error: Sort direction is null or undefined ${sort_direction}`);
                return;
            }
            if (this.location === null || this.location === undefined || this.location === '') {
                utilities.set_msg(`Error: Location is null or undefined ${this.location}`);
                return;
            }

            this.sort_by = sort;
            this.sort_direction = sort_direction;

            let view_container = document.querySelector('.view_container');
            let items = Array.from(view_container.querySelectorAll('.card'));

            let sortedItems = utilities.sortItems(items, this.sort_by, this.sort_direction);

            // Remove and re-append to update DOM order
            sortedItems.forEach(item => view_container.appendChild(item));

            // Save sort settings
            this.settings.sort_by = this.sort_by;
            this.settings.sort_direction = this.sort_direction;
            settingsManager.update_settings(this.settings);

            // this.get_files(this.location);

            // // save sort direction
            // this.settings.sort_by = this.sort_by;
            // this.settings.sort_direction = this.sort_direction;
            // settingsManager.update_settings(this.settings);

        });

        // switch view
        ipcRenderer.on('switch_view', (e, view) => {

            if (view === null || view === undefined || view === '') {
                utilities.set_msg(`Error: View is null or undefined ${view}`);
                return;
            }

            let tab_content = document.querySelectorAll('.tab-content');
            tab_content.forEach(tc => {

                let view_container = tc.querySelector('.view_container');
                if (!view_container) {
                    utilities.set_msg('Error: getting view container');
                    return;
                }

                this.view = view;
                if (this.view === 'list_view') {

                    view_container.classList.remove('grid_view', 'grid3');
                    view_container.classList.add('list_view');

                    // add list view header
                    let header = this.get_list_view_header(); //document.createElement('div');
                    view_container.prepend(header);

                } else if (this.view === 'grid_view') {

                    view_container.classList.add('grid_view', 'grid3');
                    view_container.classList.remove('list_view');

                    let header = tc.querySelector('.list_view_header');
                    if (header) {
                        header.remove();
                    }

                }

            })

            this.settings.view = this.view;
            ipcRenderer.send('update_settings', this.settings);

            // console.log('data', data, this.files_arr)

            // this.location = settingsManager.get_location();
            // if (this.location === null || this.location === undefined || this.location === '') {
            //     this.location = utilities.home_dir;
            // }

            // this.view = view;

            // switch (this.view) {
            //     case 'list_view':
            //         this.get_files(this.location);
            //         break;
            //     case 'grid_view':
            //         // this.get_files(this.location);
            //         this.get_grid_view(this.files_arr);
            //         break;
            //     default:
            //         console.error(`Unknown view: ${this.view}`);
            //         break;
            // }

            // this.settings.view = this.view;
            // this.settings.location = this.location;
            // ipcRenderer.send('update_settings', this.settings);

        });

        // Get files
        ipcRenderer.on('get_files', (e, location) => {
            this.get_files(location);
        });

        // get files
        ipcRenderer.on('ls', (e, files_arr, new_tab) => {

            this.files_arr = files_arr;
            if (this.view === '' || this.view === undefined) {
                console.log('view is undefined');
            }

            if (new_tab) {

                if (files_arr.length > 0) {
                    this.location = files_arr[0].location;
                }

                tabManager.add_tab(this.location);
                utilities.set_location(this.location);

                // set location in settings, utilities and breadcrumbs
                // this handles unreachable paths on startup or when a valid location becomes unreachable
                // get_ls(location, add_tab) in main will set the location back to home dir
                settingsManager.set_location(this.location);
                utilities.set_destination(this.location);
                this.get_breadcrumbs(this.location);

            }

            // if (this.view === 'list_view') {
            //     this.get_list_view(files_arr);
            // } else if (this.view === 'grid_view') {
            //     this.get_grid_view(files_arr);
            // }

            // populate view from files array
            this.get_view(files_arr);

            tabManager.set_tab_data_arr(files_arr);
            tabManager.update_tab(this.location);

            ipcRenderer.send('get_disk_space', this.location);
            this.check_for_empty_folder();

        });

        // add items
        ipcRenderer.on('add_items', (e, copy_arr) => {

            this.add_items(copy_arr);
            this.check_for_empty_folder();

        });

        // get item
        ipcRenderer.on('get_item', (e, f) => {

            console.log('get_item', f);

            // get active tab
            let active_tab_content = tabManager.get_active_tab_content();
            if (!active_tab_content) {
                console.log('error getting active tab content');
                return;
            }

            // check if item exists
            let item = active_tab_content.querySelector(`[data-id="${f.id}"]`)
            if (item) {
                if (item.dataset.id === f.id) {
                    this.update_item(f);
                    return;
                }
            }

            // get view container
            let view_container = active_tab_content.querySelector('.view_container');
            if (!view_container) {
                console.log('error getting view container');
                utilities.set_msg('Error: getting view container');
                return;
            }

            // get view item
            item = this.get_view_item(f);
            if (!item) {
                console.log('error getting view item');
                utilities.set_msg('Error: getting view item');
                return;
            }

            if (this.view === 'grid_view') {

                // insert item at top of view container
                view_container.prepend(item);

            } else if (this.view === 'list_view') {

                // insert item below header
                let header = view_container.querySelector('.list_view_header');
                if (!header) {
                    console.log('error getting list view header');
                    utilities.set_msg('Error: getting list view header');
                    return;
                }
                view_container.insertBefore(item, header.nextSibling);

            }

            // console.log('get_item', f);

            // let active_tab_content = tabManager.get_active_tab_content();
            // if (!active_tab_content) {
            //     console.log('error getting active tab content');
            //     return;
            // }

            // let item = active_tab_content.querySelector(`[data-id="${f.id}"]`)
            // if (item) {
            //     if (item.dataset.id === f.id) {
            //         this.update_item(f);
            //         return;
            //     }
            // }

            // if (this.view === 'grid_view') {

            //     console.log('grid view');
            //     let grid = active_tab_content.querySelector('.grid3');
            //     if (!grid) {
            //         console.log('Error: getting grid');
            //         utilities.set_msg('Error: getting grid');
            //         return;
            //     }

            //     let items = grid.querySelectorAll('.card');
            //     if (items.length > 0) {

            //         let idx = Array.from(items).filter(item => item.dataset.is_dir === 'true').length;
            //         let card = this.get_view_item(f);

            //         if (!card) {
            //             console.log('error getting card');
            //             utilities.set_msg('Error: getting card');
            //             return;
            //         }

            //         if (f.is_dir) {
            //             grid.prepend(card);
            //         } else {
            //             // insert row at position idx
            //             grid.insertBefore(card, grid.children[idx]);
            //         }

            //     }

            // } else if (this.view === 'list_view') {

            //     let table = active_tab_content.querySelector('.table');
            //     if (!table) {
            //         console.log('error getting table');
            //         return;
            //     }
            //     let tbody = table.querySelector('tbody');
            //     let items = active_tab_content.querySelectorAll('.tr')

            //     // convert items to array and get number of directories
            //     let idx = Array.from(items).filter(item => item.dataset.is_dir === 'true').length;
            //     let tr = this.get_list_view_item(f);

            //     if (f.is_dir) {
            //         tbody.prepend(tr);
            //     } else {
            //         // insert row at position idx
            //         tbody.insertBefore(tr, tbody.children[idx]);
            //     }

            //     // focus item
            //     tr.classList.add('highlight_select');
            //     let href = tr.querySelector('a');
            //     if (href) {
            //         href.focus();
            //     } else {
            //         utilities.set_msg("Error: getting href in get_item");
            //     }

            // }

            // this.check_for_empty_folder();

        });

        // edit item mode
        ipcRenderer.on('edit_item', (e, f) => {

            console.log('edit_item', f);

            if (f.id === undefined || f.id === null) {
                utilities.set_msg('Error: getting file id');
                return;
            }

            let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
            let item = active_tab_content.querySelector(`[data-id="${f.id}"]`);
            if (!item) {
                console.log('error getting data-id', f.id);
                utilities.set_msg(`Error: getting  data-id ${f.id}`);
                return;
            }

            let edit_name = item.querySelector('.href');
            if (edit_name) {
                edit_name.classList.add('hidden');
            } else {
                console.log('error getting edit name');
                utilities.set_msg('Error: getting edit name');
                return;
            }

            let input = item.querySelector('input');
            if (input) {
                input.classList.remove('hidden');

                input.focus();
                input.setSelectionRange(0, input.value.lastIndexOf('.'));

                input.addEventListener('blur', (e) => {
                    e.preventDefault();
                    input.focus();
                });

            } else {
                console.log('error getting input');
                utilities.set_msg('Error: getting input');
                return;
            }



            this.check_for_empty_folder();

        });

        // handle updating item on rename
        ipcRenderer.on('update_item', (e, f) => {
            this.update_item(f);
        });

        // remove item
        ipcRenderer.on('remove_item', (e, id) => {

            if (id === undefined || id === null) {
                utilities.set_msg('Error: getting file id');
                console.log('error getting file id');
                return;
            }

            // let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
            let active_tab_content = document.querySelector('.main');
            let item = active_tab_content.querySelector(`[data-id="${id}"]`);
            if (item) {
                item.remove();
                this.check_for_empty_folder();
                utilities.get_disk_space(this.location);
            } else {
                utilities.set_msg(`Error: removing item ${id}`);
                console.log('error removing item', id);
            }

        });

        // remove items
        ipcRenderer.on('remove_items', (e, files_arr) => {
            // const active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
            const active_tab_content = document.querySelector('.main');
            files_arr.forEach(f => {
                let item = active_tab_content.querySelector(`[data-id="${f.id}"]`);
                if (item) {
                    item.remove();
                }
            })
            this.check_for_empty_folder();
            utilities.get_disk_space(this.location);
        });

        ipcRenderer.on('overwrite', (e, overwrite_arr) => {
            // this.overwrite(overwrite_arr);
        });

        ipcRenderer.on('recent_files', (e, files_arr) => {
            if (this.view == 'grid_view') {
                tabManager.add_tab('Recent');
                this.get_grid_view(files_arr);
            } else if (this.view == 'list_view') {
                this.get_list_view(files_arr);
            }
        })

    }

    // set / remove empty folder message
    check_for_empty_folder() {

        let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
        let items = active_tab_content.querySelectorAll('.card, .tr');

        console.log('check for empty folder', items.length);

        if (items.length === 0) {
            this.folder_is_empty();
        } else {
            let empty_msg = active_tab_content.querySelector('.empty_msg');
            if (empty_msg) {
                empty_msg.remove();
            }
        }

    }

    // Folder is Empty
    folder_is_empty() {

        let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');

        let div = document.createElement('div');
        div.classList.add('empty_msg');

        let i = document.createElement('i');
        i.classList.add('bi', 'bi-folder');

        let msg = document.createElement('div');
        msg.classList.add('msg');
        msg.innerHTML = 'Folder is Empty';

        div.append(i, msg);
        active_tab_content.append(div);

        utilities.set_msg('');

    }

    // init column resize
    init_col_resize(e) {

        this.is_resizing = true;

        this.currentColumn = e.target.parentElement;
        this.startX = e.clientX;
        this.startWidth = this.currentColumn.offsetWidth;

        document.addEventListener('mousemove', this.resize_col);
        document.addEventListener('mouseup', this.stop_col_resize);

    }

    // resize column
    resize_col(e) {

        if (!this.is_resizing) return;

        // change cursor
        document.body.style.cursor = 'col-resize';


        requestAnimationFrame(() => {
            const dx = e.clientX - this.startX;
            let width = this.startWidth + dx;
            // let width = this.startWidth + (e.clientX - this.startX);
            width = Math.max(this.minWidth, Math.min(width, this.maxWidth)); // Constrain width
            this.currentColumn.style.width = `${width}px`;

        });

        // // disable drag select
        dragSelect.set_is_dragging(true);


    }

    // stop column resize
    stop_col_resize(e) {

        document.body.style.cursor = 'default';

        document.removeEventListener('mousemove', this.resize_col);
        document.removeEventListener('mouseup', this.stop_col_resize);

        // update column size in settings
        this.list_view_settings.col_width[this.currentColumn.dataset.col_name] = this.currentColumn.offsetWidth;
        ipcRenderer.send('update_list_view_settings', this.list_view_settings);

        const drag_handle = this.currentColumn.querySelector('.drag_handle');
        drag_handle.style.width = '10px';
        drag_handle.style.right = '-5px';

        setTimeout(() => {
            this.is_resizing = false;
        }, 500);

    }

    // init filter
    init_filter() {

        if (!this.filter) {
            return;
        }

        // if filter active then handle ctrl+v
        this.filter.addEventListener('paste', (e) => {
            this.run_filer();
        })

        this.filter.addEventListener('focus', (e) => {
            this.filter.classList.add('active');
        })

        this.filter.addEventListener('blur', (e) => {
            if (this.filter.innerText === '') {
                this.filter.classList.remove('active');
            }
        })

        this.filter.addEventListener('input', (e) => {
            this.run_filer();
        });

        this.filter.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.clear_filter();
            }
        })

        document.addEventListener('keydown', (e) => {

            if (document.activeElement.tagName.toLowerCase() === 'input' || section == 2) {
                return;
            }

            if (e.ctrlKey && e.key === 'l') {
                // this.location.focus();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.clear_filter();
            }

            if (this.specialKeys.includes(e.key)) {
                return;
            }

            if (e.key.match(/[a-z0-9-_.]/i) && (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)) {
                return;
            }

            if (!this.specialKeys.includes(e.key) && document.activeElement !== this.filter) {
                if (e.key.match(/[a-z0-9-_.]/i)) {
                    this.filter.focus();
                    this.filter.classList.remove('empty');
                    this.quick_search_sting += e.key;
                    this.run_filer();
                }
            }

        });

    }

    // run filter
    run_filer() {

        setTimeout(() => {

            this.filter.focus();
            this.quick_search_sting = this.filter.innerText;

            if (this.quick_search_sting === '') {
                this.clear_filter();
            } else {
                this.filter.classList.add('active');
            }

            if (!this.specialKeys.includes(this.quick_search_sting) && this.quick_search_sting.match(/[a-z0-9-_.]/i)) {

                let active_tab_content = document.querySelector('.active-tab-content');
                let items = active_tab_content.querySelectorAll('.card');

                items.forEach((item) => {
                    if (item.dataset.name.toLocaleLowerCase().includes(this.quick_search_sting)) {

                        item.classList.remove('hidden');

                        console.log('filtering items', item.dataset.name);
                        console.log('')

                    } else {
                        item.classList.remove('highlight_select');
                        item.classList.add('hidden');
                    }

                })

                // reset nav idx for up down navigation
                // navigation.clearNavIdx();

                // set indexes for up down navigation
                // navigation.getCardGroups();

            }

        }, 100);

    }

    // clear filter
    clear_filter() {

        let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
        if (active_tab_content) {

            let cards = active_tab_content.querySelectorAll('.card, .tr');
            cards.forEach((card) => {
                card.classList.remove('hidden');
            })

            let filter = document.querySelector('.filter');
            if (filter) {
                filter.innerText = '';
                filter.classList.remove('active');
            } else {
                console.log('no filter');
            }

        }

        // utilities.set_msg(`Loaded ${cards.length} items`);

        // reset nav idx for up down navigation
        // navigation.clearNavIdx();

        // set indexes for up down navigation
        // navigation.getCardGroups();

    }

    // sanitize file name
    sanitize_file_name(href) {
        return href.replace(/\n/g, ' ');
    }

    // overwrite


    // chunk load files array
    chunk_load_files(idx, files_arr, table) {

        // const last_idx = Math.min(idx + this.chunk_size, files_arr.length);
        // const chunk = files_arr.slice(idx, last_idx);

        // console.log('loading next chunk', idx);
        // let start = new Date().getTime();
        // chunk.forEach(f => {
        //     let tr = this.get_list_view_item(f);
        //     table.appendChild(tr);
        // });
        // let end = new Date().getTime();
        // console.log('chunk load time', (end - start) / 1000);

        // idx += this.chunk_size;

        // // Check if more chunks need to be loaded
        // if (idx < files_arr.length) {
        //     setTimeout(() => {
        //         this.chunk_load_files(idx, files_arr, table);
        //     }, 0);
        //     // this.chunk_load_files(idx, files_arr, table);
        // } else {
        //     if (files_arr.length > 0) {
        //         utilities.set_msg(`Loaded ${files_arr.length} items`);
        //     }
        // }

    }

    get_list_view_header() {

        console.log('get list view header');

        this.settings = settingsManager.get_settings();
        this.list_view_settings = settingsManager.get_list_view_settings();

        let header = utilities.add_div(['list_view_header']);
        let col_widths = [];

        for (const key in this.settings.columns) {

            if (this.settings.columns[key]) {

                let col_width = this.list_view_settings.col_width[key] ? this.list_view_settings.col_width[key] : 100;

                let col = document.createElement('div');
                col.classList.add('sort_column');

                let sort_icon = document.createElement('i');
                sort_icon.classList.add('th_sort_icon');
                if (this.settings.sort_by === key) {

                    // th_sort_icon.classList.add('bi', 'bi-caret-up-fill');
                    if (this.settings.sort_direction === 'desc') {
                        sort_icon.classList.remove('bi', 'bi-caret-up-fill');
                        sort_icon.classList.add('bi', 'bi-caret-down-fill');
                    } else {
                        sort_icon.classList.remove('bi', 'bi-caret-down-fill');
                        sort_icon.classList.add('bi', 'bi-caret-up-fill');
                    }
                }

                // add event listener for sorting
                this.handleSort(col);

                let drag_handle = document.createElement('div');
                drag_handle.classList.add('drag_handle');

                // handle name column
                if (key === 'name') {

                    col.innerHTML = 'Name';
                    // th.appendChild(drag_handle);
                    col.dataset.col_name = key;
                    header.appendChild(col);

                    // add column width to array
                    // col_widths.push(this.list_view_settings.col_width[key]);
                    col_widths.push('1fr');

                } else {

                    // let th = document.createElement('th');

                    switch (key) {
                        case 'size':
                            col.innerHTML = 'Size';
                            break;
                        case 'mtime':
                            col.innerHTML = 'Modified';
                            break;
                        case 'ctime':
                            col.innerHTML = 'Created';
                            break;
                        case 'atime':
                            col.innerHTML = 'Accessed';
                            break;
                        case 'type':
                            col.innerHTML = 'Type';
                            break;
                        case 'location':
                            col.innerHTML = 'Location';
                            break;
                        case 'count':
                            col.innerHTML = 'Count';
                            break;
                    }

                    col.appendChild(sort_icon);
                    // th.appendChild(drag_handle);
                    col.dataset.col_name = key;
                    header.appendChild(col);

                    // add column width to array
                    col_widths.push(`${col_width}px`);

                }

            }

        }

        // add event listener for columns menu
        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            ipcRenderer.send('columns_menu');
        });

        // set grid template columns
        header.style.gridTemplateColumns = col_widths.join(' ');

        return header;

    };

    handleSort(col) {

        col.addEventListener('click', (e) => {

            e.preventDefault();
            e.stopPropagation();

            this.settings.sort_by = col.dataset.col_name;

            if (this.settings.sort_direction === 'asc') {
                this.settings.sort_direction = 'desc';
            } else {
                this.settings.sort_direction = 'asc';
            }

            this.sort_by = this.settings.sort_by;
            this.sort_direction = this.settings.sort_direction;

            ipcRenderer.send('update_settings', this.settings);

            let view_container = document.querySelector('.view_container');
            if (!view_container) {
                console.log('error getting view container');
                utilities.set_msg('Error: getting view container');
                return;
            }

            let items = Array.from(view_container.querySelectorAll('.card'));


            let sortedItems = utilities.sortItems(items, this.sort_by, this.sort_direction);

            // Remove and re-append to update DOM order
            sortedItems.forEach(item => view_container.appendChild(item));

            // update sort icons
            let sort_icons = document.querySelectorAll('.th_sort_icon');
            sort_icons.forEach(icon => {
                icon.classList.remove('bi', 'bi-caret-up-fill', 'bi-caret-down-fill');
            });
            let sort_icon = col.querySelector('.th_sort_icon');
            if (this.sort_direction === 'desc') {
                sort_icon.classList.add('bi', 'bi-caret-down-fill');
            } else {
                sort_icon.classList.add('bi', 'bi-caret-up-fill');
            }


        });

    }

    // get grid view
    get_view(files_arr) {

        this.clear_filter();

        // active tab content
        let active_tab_content = tabManager.get_active_tab_content();
        if (!active_tab_content) {
            this.tabManager.add_tab(utilities.get_location());
            active_tab_content = document.querySelector('.active-tab-content');
        }
        active_tab_content.innerHTML = '';

        // scroll to top of active tab content
        active_tab_content.scrollTop = 0;

        let view_container = document.createElement('div');
        view_container.classList.add('view_container');

        if (this.view === 'list_view') {

            view_container.classList.remove('grid_view', 'grid3');
            view_container.classList.add('list_view');

            let header = this.get_list_view_header();
            view_container.appendChild(header);

        } else if (this.view === 'grid_view') {

            view_container.classList.remove('list_view');
            view_container.classList.add('grid_view', 'grid3');

        }

        // sort files array
        files_arr = utilities.sort(files_arr, this.sort_by, this.sort_direction);

        for (let i = 0; i < files_arr.length; i++) {

            let card = utilities.add_div(['card', 'lazy'])
            card.dataset.id = files_arr[i].id;
            card.dataset.href = files_arr[i].href;
            card.dataset.name = files_arr[i].name;
            card.dataset.size = files_arr[i].size;
            card.dataset.mtime = files_arr[i].mtime;
            card.dataset.content_type = files_arr[i].content_type;
            card.dataset.is_dir = files_arr[i].is_dir;
            card.dataset.location = files_arr[i].location;
            card.dataset.content_type = files_arr[i].content_type;
            view_container.appendChild(card);

        }

        active_tab_content.appendChild(view_container);
        this.lazy_load_files(files_arr);

    }

    // // get grid view
    // get_grid_view(files_arr) {
    //     this.clear_filter();
    //     // active tab content
    //     let active_tab_content = tabManager.get_active_tab_content();
    //     if (!active_tab_content) {
    //         this.tabManager.add_tab(utilities.get_location());
    //         active_tab_content = document.querySelector('.active-tab-content');
    //     }
    //     active_tab_content.innerHTML = '';
    //     // scroll to top of active tab content
    //     active_tab_content.scrollTop = 0;
    //     let grid = document.createElement('div');
    //     grid.classList.add('view_container');
    //     grid.classList.add('grid_view', 'grid3');
    //     // sort files array
    //     files_arr = utilities.sort(files_arr, this.sort_by, this.sort_direction);
    //     for (let i = 0; i < files_arr.length; i++) {
    //         let card = utilities.add_div(['card', 'lazy']) //this.get_grid_view_item(f);
    //         card.dataset.id = files_arr[i].id;
    //         card.dataset.href = files_arr[i].href;
    //         card.dataset.name = files_arr[i].name;
    //         card.dataset.size = files_arr[i].size;
    //         card.dataset.mtime = files_arr[i].mtime;
    //         card.dataset.content_type = files_arr[i].content_type;
    //         card.dataset.is_dir = files_arr[i].is_dir;
    //         card.dataset.location = files_arr[i].location;
    //         card.dataset.content_type = files_arr[i].content_type;
    //         grid.appendChild(card);
    //     }
    //     active_tab_content.appendChild(grid);
    //     this.lazy_load_files(files_arr);
    // }

    get_view_item(f) {

        for (let items in f) {
            if (f[items] === undefined || f[items] === null) {
                console.log('error getting grid view item', f);
                return -1;
            }
        }

        this.settings = settingsManager.get_settings();
        this.list_view_settings = settingsManager.get_list_view_settings();

        let card = utilities.add_div(['card', 'lazy']);
        let content = utilities.add_div(['content']);
        let icon = utilities.add_div(['icon']);
        let img = document.createElement('img');
        let video = document.createElement('video');
        let filename = utilities.add_div(['header', 'item']);

        let href = document.createElement('a');
        let input = document.createElement('input');

        let col_widths = [];

        card.draggable = true;

        // handle icon
        icon.append(img);
        icon.style = 'cursor: pointer';
        img.classList.add('img');

        for (const key in this.settings.columns) {

            if (this.settings.columns[key]) {

                let col_width = this.list_view_settings.col_width[key] ? this.list_view_settings.col_width[key] : 100;

                // handle name column
                if (key === 'name') {

                    // let href = document.createElement('a');
                    href.classList.add('href');
                    href.classList.add('item');
                    href.innerHTML = f.display_name;
                    href.href = f.href;

                    // let input = document.createElement('input');
                    input.classList.add('input', 'item', 'hidden', 'edit_name');
                    input.value = f.display_name;
                    input.spellcheck = false;
                    input.type = 'text';
                    input.dataset.href = f.href;

                    filename.append(href, input);
                    content.appendChild(filename);

                    // filename.style.width = `${col_width - 40}px`;
                    // col_widths.push(col_width - 40);
                    col_widths.push('1fr');

                } else {

                    let item = utilities.add_div(['item']);
                    content.appendChild(item);

                    item.innerHTML = f[key] ? f[key] : '';
                    item.classList.add(key);

                    switch (key) {
                        case 'size':
                            item.innerHTML = utilities.get_file_size(f["size"]);
                            break;
                        case 'mtime':
                            item.innerHTML = utilities.get_date_time(f.mtime);
                            break;
                        case 'ctime':
                            item.innerHTML = utilities.get_date_time(f.ctime);
                            break;
                        case 'atime':
                            item.innerHTML = utilities.get_date_time(f.atime);
                            break;
                        case 'type':
                            item.innerHTML = f.content_type;
                            break;
                        case 'location':
                            item.innerHTML = f.location;
                            break;
                        case 'count':
                            item.innerHTML = f.count;
                            break;
                    }

                    col_widths.push(`${col_width}px`);

                }



            }

        }

        // set grid template columns
        content.style.gridTemplateColumns = col_widths.join(' ');
        // console.log('col widths', col_widths.map(w => `${w}px`).join(' '));

        // Directory
        if (f.is_dir || f.type === 'inode/directory') {

            ipcRenderer.send('get_folder_icon', f.href);
            ipcRenderer.send('get_folder_size', f.href);

            card.classList.add('folder_card');

            // Context Menu
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                card.classList.add('highlight_select')
                ipcRenderer.send('folder_menu', f);
            })

            // Files
        } else {

            // Context Menu
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                card.classList.add('highlight_select')
                ipcRenderer.send('file_menu', f);
            })

        }

        // handle rename
        this.handleRename(input, f);

        // Handle drag drop events
        this.handleDragStart(card);
        this.handleDragOver(card);
        this.handleDragLeave(card);
        this.handleDrop(card);

        this.handleDataAttributes(card, f);
        this.handleTitle(card, f);

        // handle click events - Card click is handled in drag select
        this.handleClick(card, f);
        this.handleClick(href, f);
        this.handleClick(img, f);

        // this.handleMouseover(card);
        // this.handleMouseout(card);

        // Get Icon
        this.handleIcon(icon, f);

        card.append(icon, content);
        return card;

    }

    // Settings View
    get_settings_view() {

        // build settings view (cleanly formatted)
        console.log('get settings view');
        tabManager.add_tab('Settings');

        const active_tab_content = tabManager.get_active_tab_content();
        if (!active_tab_content) {
            console.log('error getting active tab content');
            return;
        }
        active_tab_content.innerHTML = '';

        const settings = settingsManager.get_settings();
        if (!settings || typeof settings !== 'object') {
            utilities.set_msg('Error: Invalid settings');
            return;
        }

        Object.keys(settings).forEach((key, idx) => {

            const value = settings[key];

            if (typeof value === 'string') {

                console.log('key', key, 'value', value);

                let input = document.createElement('input');
                input.classList.add('input');

                let settings_item = utilities.add_div(['settings_item']);
                let label = document.createElement('label');

                label.innerText = key;

                switch (key.toLocaleLowerCase()) {
                    case 'theme': {
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

                        input.addEventListener('change', (e) => {
                            ipcRenderer.send('change_theme', input.value);
                            ipcRenderer.send('update_settings', [key], input.value)
                        })

                        settings_item.append(label, input)
                        break;
                    }
                    case 'terminal': {
                        input.addEventListener('change', (e) => {
                            ipcRenderer.send('update_settings', [key], input.value)
                        })
                        settings_item.append(label, input);
                        break;
                    }
                    case 'disk_utility': {
                        input.addEventListener('change', (e) => {
                            ipcRenderer.send('update_settings', [key], input.value)
                        })
                        settings_item.append(label, input);

                        break;
                    }
                }

                input.value = settings[key];
                active_tab_content.append(settings_item);

            }


            if (typeof value === 'object') {

                let header = document.createElement('h4');
                let hr = document.createElement('hr');

                header.classList.add('header');

                header.innerHTML = `${key.charAt(0).toUpperCase()}${key.slice(1)}`; //key.toUpperCase();
                active_tab_content.append(hr, header);
                // this.settingsForm(value);

                for (let sub_key in settings[key]) {

                    let input;
                    let settings_item = utilities.add_div(['settings_item']);

                    let sub_value = settings[`${key}`][`${sub_key}`];
                    let type = typeof sub_value;

                    let label = document.createElement('label');
                    label.textContent = `${sub_key.charAt(0).toUpperCase() + sub_key.slice(1)}:`;

                    // Create input field for non-nested properties
                    switch (type) {
                        case 'boolean': {
                            input = document.createElement('input');
                            input.type = 'checkbox';
                            input.checked = sub_value;

                            // input.addEventListener('click', (e) => {
                            //     if (input.checked) {
                            //         // ipcRenderer.send('update_settings', [key,sub_key], true);
                            //     } else {
                            //         // ipcRenderer.send('update_settings', [key,sub_key], false);
                            //     }

                            //     switch (key) {
                            //         case 'File Menu': {
                            //             // ipcRenderer.send('show_menubar')
                            //             break;
                            //         }
                            //         case 'Header Menu': {
                            //             // this.showHeaderMenu();
                            //             break;
                            //         }
                            //         case 'Navigation Menu': {
                            //             // this.moveNavMenu();
                            //             break;
                            //         }
                            //         case 'Minibar': {
                            //             // this.showMinibar();
                            //             break;
                            //         }
                            //     }

                            // })

                            if (sub_key === 'name') {
                                input.disabled = true;
                            }
                            settings_item.append(label, input);
                            active_tab_content.append(settings_item);
                            break;
                        }
                        case 'string': {
                            input = document.createElement('input');
                            input.type = 'text';
                            input.value = sub_value
                            if (key.toLocaleLowerCase() === 'keyboard_shortcuts') {
                                console.log(sub_key, sub_value)
                                input.disabled = true;
                            }
                            settings_item.append(label, input);
                            active_tab_content.append(settings_item);
                            break;
                        }
                        case 'number': {
                            input = document.createElement('input');
                            input.type = 'number';
                            input.value = sub_value;

                            settings_item.append(label, input);
                            active_tab_content.append(settings_item);

                            break;
                        }
                        default: {
                            input = document.createElement('input');
                            input.type = 'text';
                            input.value = sub_value;
                            break;
                        }

                    }

                    // let label = document.createElement('label');
                    // label.textContent = `${sub_key.charAt(0).toUpperCase() + sub_key.slice(1)}:`;
                    // settings_item.append(label, input);
                    // form.append(settings_item);

                }

                // viewManager.resize();

            }

        })

    }

    // // get grid view item
    // get_grid_view_item(f) {

    //     // loop f to make sure its complete
    //     for (let items in f) {
    //         if (f[items] === undefined || f[items] === null) {
    //             console.log('error getting grid view item', f);
    //             return -1;
    //         }
    //     }

    //     let card = utilities.add_div(['card']);
    //     let content = utilities.add_div(['content']);
    //     let icon = utilities.add_div(['icon']);
    //     let img = document.createElement('img');
    //     let video = document.createElement('video');
    //     let header = utilities.add_div(['header', 'item']);
    //     let href = document.createElement('a');
    //     let path = utilities.add_div(['path', 'item', 'hidden']);
    //     let mtime = utilities.add_div(['date', 'mtime', 'item']);
    //     let atime = utilities.add_div(['date', 'atime', 'item', 'hidden']);
    //     let ctime = utilities.add_div(['date', 'ctime', 'item', 'hidden']);
    //     let size = utilities.add_div(['size', 'item']);
    //     let type = utilities.add_div(['type', 'item', 'hidden']);
    //     let count = utilities.add_div(['count', 'item', 'hidden']);
    //     let input = document.createElement('input');
    //     let tooltip = utilities.add_div('tooltip', 'hidden');

    //     href.classList.add('href', 'item');
    //     input.classList.add('input', 'item', 'hidden', 'edit_name');

    //     icon.style = 'cursor: pointer';

    //     img.classList.add('img');
    //     img.loading = 'lazy';

    //     card.classList.add('lazy');
    //     // card.style.opacity = 1;

    //     // Populate values
    //     href.href = f.href;
    //     href.innerHTML = f.display_name;
    //     input.value = f.display_name;

    //     input.spellcheck = false;
    //     input.type = 'text';
    //     input.dataset.href = f.href;

    //     href.draggable = false;
    //     img.draggable = false;
    //     icon.draggable = false;
    //     card.draggable = true;

    //     // Check file values
    //     if (f.size) {
    //         card.dataset.size = f.size;
    //     }
    //     if (f.mtime) {
    //         mtime.append(utilities.get_date_time(f.mtime));
    //     }
    //     if (f.ctime) {
    //         ctime.append(utilities.get_date_time(f.ctime));
    //     }
    //     if (f.atime) {
    //         atime.append(utilities.get_date_time(f.atime));
    //     }
    //     if (f.content_type) {
    //         type.append(f.content_type);
    //     }

    //     card.querySelectorAll('.item').forEach(item => {
    //         item.draggable = false;
    //     })

    //     icon.append(img);
    //     header.append(href, input);

    //     // Directory
    //     if (f.is_dir || f.type === 'inode/directory') {

    //         ipcRenderer.send('get_folder_icon', f.href);
    //         ipcRenderer.send('get_folder_size', f.href);

    //         card.classList.add('folder_card', 'lazy');

    //         // Context Menu
    //         card.addEventListener('contextmenu', (e) => {
    //             e.preventDefault();
    //             e.stopPropagation();
    //             card.classList.add('highlight_select')
    //             ipcRenderer.send('folder_menu', f);
    //         })

    //         // Files
    //     } else {

    //         size.append(utilities.get_file_size(f["size"]));

    //         // Context Menu
    //         card.addEventListener('contextmenu', (e) => {
    //             e.preventDefault();
    //             e.stopPropagation();
    //             card.classList.add('highlight_select')
    //             ipcRenderer.send('file_menu', f);
    //         })

    //     }

    //     // // Handle events
    //     this.handleDragStart(card);
    //     this.handleDragOver(card);
    //     this.handleDragLeave(card);
    //     this.handleDrop(card);

    //     this.handleDataAttributes(card, f);
    //     this.handleTitle(card, f);
    //     this.handleRename(input, f);

    //     // Get Icon
    //     this.handleIcon(icon, f);

    //     // handle click events - Card click is handled in drag select
    //     this.handleClick(card, f);
    //     this.handleClick(href, f);
    //     this.handleClick(img, f);

    //     // this.handleMouseover(card);
    //     // this.handleMouseout(card);

    //     content.append(header, path, mtime, ctime, atime, type, size, count);
    //     card.append(icon, content, tooltip);

    //     return card;
    // }

    // get_list_view() {

    //     // this.settings = settingsManager.get_settings();
    //     // this.list_view_settings = settingsManager.get_list_view_settings();

    //     // let view_container = document.querySelector('.view_container');
    //     // let content = view_container.querySelector('.content');

    //     // for (const key in this.settings.columns) {

    //     //     if (this.settings.columns[key]) {

    //     //         // handle name column
    //     //         if (key === 'name') {

    //     //             let header = view_container.querySelector('.header');
    //     //             header.style.backgroundColor = 'red';
    //     //             header.style.width = this.list_view_settings.col_width[key] + 'px';
    //     //             console.log('header', header);

    //     //         } else {

    //     //             // let th = document.createElement('th');

    //     //             switch (key) {
    //     //                 case 'size':

    //     //                     break;
    //     //                 case 'mtime':

    //     //                     break;
    //     //                 case 'ctime':

    //     //                     break;
    //     //                 case 'atime':

    //     //                     break;
    //     //                 case 'type':

    //     //                     break;
    //     //                 case 'location':

    //     //                     break;
    //     //                 case 'count':

    //     //                     break;
    //     //             }

    //     //             // th.style.width = this.list_view_settings.col_width[key] + 'px';

    //     //         }

    //     //     }

    //     // }

    // };

    // lazy load files
    lazy_load_files(files_arr) {

        let active_tab_content = document.querySelector('.active-tab-content');
        let lazyItems = active_tab_content.querySelectorAll(".lazy");

        console.log('running lazy load files', lazyItems.length);

        // listen for scroll event
        if ("IntersectionObserver" in window) {
            let observer = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        load_item(entry.target, observer);
                        // console.log('lazy load item', entry.target.dataset.id);
                    }
                });
            });

            // Immediately load items that are already in viewport
            lazyItems.forEach((lazy_item, idx) => {

                if (isInViewport(lazy_item)) {
                    setTimeout(() => {
                        load_item(lazy_item, observer);
                    }, 10);
                } else {
                    observer.observe(lazy_item);
                }

                if (idx === 0) {
                    //     active_tab_content.addEventListener('mouseover', (e) => {
                    //         e.target.focus();
                    //     });
                }

                if (idx === lazyItems.length - 1) {
                    utilities.set_msg(`Loaded ${files_arr.length} items`);
                    setTimeout(() => {
                        // dragSelect.initialize();
                    }, 500);
                }

            });

            function isInViewport(element) {
                const rect = element.getBoundingClientRect();
                return (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                );
            }

            // Function to load the item
            const load_item = (lazy_item, observer) => {

                const id = lazy_item.dataset.id;
                if (id) {

                    let f = files_arr.find(f => f.id === id);
                    let item;

                    // console.log('lazy load view', this.view);

                    // if (this.view === 'list_view') {

                    //     item = this.get_list_view_item(f);
                    //     lazy_item.replaceWith(item);

                    // } else if (this.view === 'grid_view') {

                    item = this.get_view_item(f);
                    lazy_item.replaceWith(item);

                    // }

                    this.handleDataAttributes(item, f);
                    this.handleTitle(item, f);

                    // Stop watching and remove the placeholder
                    lazy_item.classList.remove("lazy");
                    observer.unobserve(lazy_item);

                } else {
                    console.log('No lazy items load');
                }
            }

        } else {
            // Possibly fall back to a more compatible method here
        }


    }

    // // get list view
    // get_list_view(files_arr) {

    //     this.clear_filter();

    //     // const start = this.loaded_rows;
    //     // const end = Math.min(start + this.chunk_size, files_arr.length);

    //     // Set up tab content
    //     let active_tab_content = tabManager.get_active_tab_content();
    //     if (!active_tab_content) {
    //         this.tabManager.add_tab(utilities.get_location());
    //         active_tab_content = document.querySelector('.active-tab-content');
    //     }
    //     active_tab_content.innerHTML = '';

    //     // scroll to top of active tab content
    //     active_tab_content.scrollTop = 0;

    //     let table = document.createElement('table');
    //     table.classList.add('table');

    //     let thead = document.createElement('thead');
    //     let tr = document.createElement('tr');

    //     let tbody = document.createElement('tbody');

    //     this.settings = settingsManager.get_settings();
    //     this.list_view_settings = settingsManager.get_list_view_settings();

    //     for (const key in this.settings.columns) {
    //         if (this.settings.columns[key]) {

    //             let th_sort_icon = document.createElement('i');
    //             th_sort_icon.classList.add('th_sort_icon');
    //             if (this.settings.sort_by === key) {

    //                 // th_sort_icon.classList.add('bi', 'bi-caret-up-fill');
    //                 if (this.settings.sort_direction === 'desc') {
    //                     th_sort_icon.classList.remove('bi', 'bi-caret-up-fill');
    //                     th_sort_icon.classList.add('bi', 'bi-caret-down-fill');
    //                 } else {
    //                     th_sort_icon.classList.remove('bi', 'bi-caret-down-fill');
    //                     th_sort_icon.classList.add('bi', 'bi-caret-up-fill');
    //                 }
    //             }

    //             let drag_handle = document.createElement('div');
    //             drag_handle.classList.add('drag_handle');

    //             let th = document.createElement('th');
    //             th.classList.add('sort_column');

    //             // handle name column
    //             if (key === 'name') {

    //                 th.innerHTML = 'Name';
    //                 th.appendChild(drag_handle);
    //                 th.dataset.col_name = key;
    //                 tr.appendChild(th);

    //                 th.style.width = this.list_view_settings.col_width[key] + 'px';

    //             } else {

    //                 // let th = document.createElement('th');

    //                 switch (key) {
    //                     case 'size':
    //                         th.innerHTML = 'Size';
    //                         break;
    //                     case 'mtime':
    //                         th.innerHTML = 'Modified';
    //                         break;
    //                     case 'ctime':
    //                         th.innerHTML = 'Created';
    //                         break;
    //                     case 'atime':
    //                         th.innerHTML = 'Accessed';
    //                         break;
    //                     case 'type':
    //                         th.innerHTML = 'Type';
    //                         break;
    //                     case 'location':
    //                         th.innerHTML = 'Location';
    //                         break;
    //                     case 'count':
    //                         th.innerHTML = 'Count';
    //                         break;
    //                 }

    //                 th.appendChild(th_sort_icon);
    //                 th.appendChild(drag_handle);
    //                 th.dataset.col_name = key;
    //                 tr.appendChild(th);

    //                 th.style.width = this.list_view_settings.col_width[key] + 'px';

    //             }

    //             // init resize column
    //             drag_handle.addEventListener('mousedown', (e) => {
    //                 this.init_col_resize(e);
    //             });

    //             // handle sort event
    //             this.handleColumnSort(th, key);

    //         }

    //     }

    //     // table.appendChild(colgroup);
    //     thead.appendChild(tr);
    //     table.appendChild(thead);
    //     table.appendChild(tbody);

    //     // sort files array
    //     files_arr = utilities.sort(files_arr, this.settings.sort_by, this.settings.sort_direction);

    //     files_arr.forEach((f, idx) => {
    //         let tr = document.createElement('tr'); //this.get_list_view_item(f);
    //         tr.classList.add('tr', 'lazy');
    //         tr.dataset.id = f.id;
    //         tr.dataset.href = f.href;
    //         tr.dataset.name = f.display_name;
    //         tr.dataset.size = f.size;
    //         tr.dataset.mtime = f.mtime;
    //         tr.dataset.content_type = f.content_type;
    //         tr.dataset.is_dir = f.is_dir;
    //         tr.dataset.location = f.location;
    //         tbody.appendChild(tr);
    //     });

    //     table.appendChild(tbody);
    //     active_tab_content.appendChild(table);
    //     this.lazy_load_files(files_arr);

    //     thead.addEventListener('contextmenu', (e) => {
    //         e.preventDefault();
    //         e.stopPropagation();
    //         ipcRenderer.send('columns_menu');
    //     })

    //     active_tab_content.addEventListener('mouseover', (e) => {
    //         e.target.focus();
    //     });


    // }

    // // add_list_view_item(f) {
    // get_list_view_item(f) {

    //     // loop f to make sure its complete
    //     for (let items in f) {
    //         if (f[items] === undefined || f[items] === null) {
    //             console.log('error getting grid view item', f);
    //             return -1;
    //         }
    //     }

    //     let tr = document.createElement('tr');
    //     tr.classList.add('tr');
    //     tr.draggable = true;

    //     // add data attributes from column settings
    //     this.handleDataAttributes(tr, f);

    //     // add hover over title
    //     this.handleTitle(tr, f);

    //     let div_name = utilities.add_div(['div_name']);
    //     let icon = utilities.add_div(['icon']);
    //     let img = document.createElement('img');
    //     let input = document.createElement('input');
    //     let link = utilities.add_link(f.href, f.display_name);

    //     // input settings
    //     input.type = 'text';
    //     input.value = f.display_name;
    //     input.classList.add('edit_name', 'hidden');
    //     input.spellcheck = false;

    //     icon.style = 'cursor: pointer';
    //     img.classList.add('img');
    //     img.loading = 'lazy';

    //     link.draggable = false;
    //     link.classList.add('href');

    //     // handle columns
    //     this.settings = settingsManager.get_settings();
    //     for (const key in this.settings.columns) {
    //         if (this.settings.columns[key]) {

    //             let td = document.createElement('td');

    //             // handle name column
    //             if (key === 'name') {

    //                 img.loading = 'lazy';
    //                 icon.appendChild(img);

    //                 td.classList.add('name');

    //                 div_name.append(icon, link, input);
    //                 td.append(div_name);

    //                 // tr.appendChild(td_icon);
    //                 tr.appendChild(td);

    //                 // handle icons
    //                 if (f.is_dir) {

    //                     ipcRenderer.send('get_folder_icon', f.href);
    //                     ipcRenderer.send('get_folder_size', f.href);

    //                 } else {

    //                     this.handleIcon(icon, f);

    //                 }

    //                 // handle click events
    //                 this.handleClick(tr, f);
    //                 this.handleClick(link, f);
    //                 this.handleClick(img, f);

    //                 // handle rename
    //                 this.handleRename(input, f);

    //             } else {

    //                 switch (key) {
    //                     case 'size':
    //                         td.innerHTML = utilities.get_file_size(f.size);
    //                         td.classList.add('size');
    //                         break;
    //                     case 'mtime':
    //                         td.innerHTML = utilities.get_date_time(f.mtime);
    //                         break;
    //                     case 'ctime':
    //                         td.innerHTML = utilities.get_date_time(f.ctime);
    //                         break;
    //                     case 'atime':
    //                         td.innerHTML = utilities.get_date_time(f.atime);
    //                         break;
    //                     case 'type':
    //                         td.innerHTML = f.content_type;
    //                         break;
    //                     default:
    //                         td.innerHTML = f[key];
    //                         break;
    //                 }

    //                 td.dataset.col_name = key;
    //                 tr.appendChild(td);

    //             }

    //         }

    //     }

    //     // handle context menu
    //     if (f.is_dir) {

    //         // handle folder context menu
    //         tr.addEventListener('contextmenu', (e) => {
    //             e.preventDefault();
    //             e.stopPropagation();
    //             tr.classList.add('highlight_select');
    //             ipcRenderer.send('folder_menu', f);
    //         })

    //     } else {

    //         // handle file context menu
    //         tr.addEventListener('contextmenu', (e) => {
    //             e.preventDefault();
    //             e.stopPropagation();
    //             tr.classList.add('highlight_select');
    //             ipcRenderer.send('file_menu', f);
    //         })
    //     }

    //     this.handleDragStart(tr);
    //     this.handleDragOver(tr);
    //     this.handleDragLeave(tr);
    //     this.handleDrop(tr);

    //     return tr;

    // }

    // handleDrag

    // sort event
    handleColumnSort(item) {

        item.addEventListener('click', (e) => {

            e.preventDefault();
            e.stopPropagation();

            if (this.is_resizing) {
                return;
            }

            console.log('running sort by column', e.target);
            this.settings.sort_by = e.target.dataset.col_name;
            this.settings.sort_direction = this.settings.sort_direction === 'asc' ? 'desc' : 'asc';
            settingsManager.update_settings(this.settings);
            this.get_files(this.location);

        });

    }

    // handle title
    handleTitle(item, f) {

        let title =
            'Name: ' + f.display_name +
            '\n' +
            'Location: ' + f.location +
            '\n' +
            'Size: ' + utilities.get_file_size(f.size) +
            '\n' +
            'Accessed: ' + utilities.get_date_time(f.atime) +
            '\n' +
            'Modified: ' + utilities.get_date_time(f.mtime) +
            '\n' +
            'Created: ' + utilities.get_date_time(f.ctime) +
            '\n' +
            'Type: ' + f.content_type

        item.title = title;

    }

    // handle data attributes
    handleDataAttributes(item, f) {

        item.dataset.id = f.id;
        item.dataset.href = f.href;
        item.dataset.name = f.name;
        item.dataset.mtime = f.mtime;
        item.dataset.atime = f.atime;
        item.dataset.ctime = f.ctime;
        item.dataset.size = f.size;
        item.dataset.type = f.content_type;
        item.dataset.is_dir = f.is_dir;
        item.dataset.is_writable = f.is_writable;
        item.dataset.is_readable = f.is_readable;
        item.dataset.location = f.location;
        item.dataset.content_type = f.content_type;

    }

    // handle icon
    handleIcon(icon, f) {

        for (let field in f) {
            if (f[field] === undefined || f[field] === null) {
                console.log('error getting icon', f);
                return -1;
            }
        }

        if (icon === undefined || icon === null) {
            const errorMessage = `Error loading icon ${icon}`;
            console.log(errorMessage);
            utilities.set_msg(errorMessage);
            if (err && typeof err === 'function') {
                err(errorMessage);
            }
            return -1;
        }

        if (f.href === undefined || f.href === null) {
            console.log('Error getting icon href', f.href);
            utilities.set_msg(`Error getting href ${f.href}`);
            return -2;
        }

        if (f.content_type === undefined || f.content_type === null) {
            console.log('Error getting icon content type', f.content_type);
            utilities.set_msg(`Error getting icon content type ${f.content_type}`);
            return -3;
        }

        let img = icon.querySelector('.img');
        if (!img) {
            console.log('Error getting .img for icon', img);
            utilities.set_msg('Error getting .img for icon');
            return -4;
        }

        // console.log('running handle icon', f);
        this.settings = settingsManager.get_settings();

        try {

            if (f.is_dir || f.type === 'inode/directory') {

                ipcRenderer.send('get_folder_icon', f.href);

            } else if (f.is_dir === false) {

                if (f.content_type.includes('image/')) {

                    // check for svg
                    if (f.content_type.includes('svg')) {
                        img.src = f.href;
                        img.classList.add('svg');
                    } else {
                        img.src = f.href;
                    }


                } else if (f.content_type.includes('video/')) {

                    let video = document.createElement('video');
                    video.src = f.href;
                    video.classList.add('video');
                    icon.innerHTML = '';
                    icon.append(video);

                } else {
                    img.classList.add('lazy');
                    ipcRenderer.invoke('get_icon', f.href).then(icon => {
                        img.src = icon;
                    })
                }

            }

            if (!f.is_writable) {
                icon.classList.add('readonly');
                let readonly_img = document.createElement('img');
                ipcRenderer.invoke('get_readonly_icon', f.href).then(readonly_icon => {
                    console.log('readonly icon', readonly_icon);
                    readonly_img.src = readonly_icon;
                    readonly_img.classList.add('symlink');
                    icon.append(readonly_img);
                })
            }

            if (f.is_symlink) {
                let symlink_img = document.createElement('img');
                ipcRenderer.invoke('get_symlink_icon', f.href).then(symlink_icon => {
                    symlink_img.src = symlink_icon;
                    symlink_img.classList.add('symlink');
                    icon.append(symlink_img);
                })
            }

            img.style.width = `${this.settings.icon_size}px`;
            img.style.height = `${this.settings.icon_size}px`;

        } catch (err) {

            console.log('Error loading icon', err);
            utilities.set_msg(`Error loading icon ${err}`);

            ipcRenderer.invoke('get_icon', (f.href)).then(res => {
                img.src = res;
            })

            img.style.width = `${this.settings.icon_size}px`;
            img.style.height = `${this.settings.icon_size}px`

        }

        return 0;

    }

    // handle dragstart
    handleDragStart(item) {

        item.addEventListener('dragstart', (e) => {

            // console.log(item);
            // utilities.copy();

            item.classList.add('highlight_select');

            e.dataTransfer.effectAllowed = 'copyMove';
            this.is_dragging = true;
            this.is_dragging_divs = true;

        })
    }

    // handle drag over
    handleDragOver(item) {

        item.addEventListener('dragover', (e) => {

            e.preventDefault();
            e.stopPropagation();

            if (item.dataset.is_dir === 'true') {

                // Add highlight only if not already highlighted
                if (!item.dataset.dragover) {
                    item.dataset.dragover = 'true';
                    item.classList.add('highlight_target');
                }

                if (e.ctrlKey) {
                    e.dataTransfer.dropEffect = "copy";
                    utilities.set_msg(`Copy items to ${item.dataset.href}`);
                } else {
                    e.dataTransfer.dropEffect = "move";
                    utilities.set_msg(`Move items to ${item.dataset.href}`);
                }
                utilities.set_destination(item.dataset.href);
                // utilities.set_msg(`Destination: ${item.dataset.href}`);
            } else {
                // handle drag/drop on active tab content
            }

        })

    }

    // handle dragleave
    handleDragLeave(item) {
        item.addEventListener('dragleave', (e) => {
            if (item.dataset.dragover === 'true') {
                delete item.dataset.dragover;
                item.classList.remove('highlight_target');
            }
        })
    }

    // handle drop
    handleDrop(item) {

        item.addEventListener('drop', (e) => {

            e.preventDefault();
            e.stopPropagation();

            ipcRenderer.send('is_main', 0);

            if (!item.classList.contains('highlight') && item.classList.contains('highlight_target')) {

                utilities.copy();
                if (e.ctrlKey) {
                    console.log('running drop ctrl', item.dataset.href);
                    utilities.paste();
                } else {
                    console.log('running drop', item.dataset.href);
                    utilities.move();
                }

            } else {

                console.log('did not find target')
                ipcRenderer.send('is_main', 1);
                utilities.copy();
                utilities.paste();

            }

            utilities.clear();
            dragSelect.set_is_dragging(true);

        })

    }

    // handle rename
    handleRename(input, f) {

        input.addEventListener('keydown', (e) => {

            if (e.key === 'Tab') {
            }

            if (e.key === 'Enter') {
                let id = f.id;
                let source = f.href;
                let destination = source.split('/').slice(0, -1).join('/') + '/' + input.value;
                utilities.rename(source, destination, id);
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                utilities.cancel_edit();
            }
        })

        // input.addEventListener('blur', (e) => {
        //     e.preventDefault();
        //     input.focus();
        // });

    }

    // handle click event
    handleClick(item, f) {

        if (item === null || item === undefined) {
            utilities.set_msg('Error: handleClick - item is null or undefined');
            return;
        }

        if (f === null || f === undefined) {
            utilities.set_msg('Error: handleClick - file is null or undefined');
            return;
        }

        if (item.classList.contains('card') || item.classList.contains('tr')) {

            item.addEventListener('click', (e) => {

                e.preventDefault();
                e.stopPropagation();

                if (e.ctrlKey) {
                    item.classList.toggle('highlight_select');
                } else {
                    this.clearHighlight();
                    item.classList.add('highlight_select');
                }

            })

            return;

        }

        item.addEventListener('click', (e) => {

            e.preventDefault();
            e.stopPropagation();

            if (f.is_dir === true) {

                if (!f.is_readable) {
                    utilities.set_msg('Error: Access Denied');
                    return;
                }

                if (e.ctrlKey) {
                    tabManager.add_tab(f.href);
                    this.get_files(f.href);
                } else {
                    this.get_files(f.href);
                    tabManager.add_tab_history(f.href);
                }

                utilities.set_location(f.href);

            } else if (f.is_dir === false) {
                console.log('running handle click file', f.href);
                ipcRenderer.send('open', f.href);
            }

            this.clearHighlight();

        });

    }

    // handleMouseover(item) {
    //     if (item) {
    //         item.addEventListener('mouseover', (e) => {
    //             e.preventDefault()
    //             e.stopPropagation();
    //             item.classList.add('highlight');
    //         })
    //     }
    // }

    // handleMouseout(item) {
    //     if (item) {
    //         item.addEventListener('mouseout', (e) => {
    //             e.preventDefault()
    //             e.stopPropagation();
    //             item.classList.remove('highlight');
    //         })
    //     }
    // }

    clearHighlight() {
        let active_tab_content = document.querySelector('.main');
        let items = active_tab_content.querySelectorAll('.highlight, .highlight_select');
        items.forEach((item) => {
            item.classList.remove('highlight', 'highlight_select');
        })
    }

    // create a breadcrumbs from location
    get_breadcrumbs(location) {

        console.log('running get breadcrumbs', location);

        let breadcrumbs = [];
        let breadcrumb_div = document.querySelector('.breadcrumbs');

        if (!breadcrumb_div) {
            return;
        }

        breadcrumb_div.innerHTML = '';
        if (location === '/') {

            let breadcrumb_item = document.createElement('div');
            let i = document.createElement('i');
            let label = document.createElement('div');

            breadcrumb_item.classList.add('breadcrumb_item', 'flex');
            i.classList.add('bi', 'bi-hdd');
            label.innerHTML = `File System`;

            breadcrumb_item.append(i, label);
            breadcrumb_item.title = `File System`;

            breadcrumb_div.append(breadcrumb_item);

            return;

        }


        breadcrumbs = location.split('/');
        if (breadcrumbs.length > 0) {

            breadcrumbs.forEach((breadcrumb, idx) => {

                if (breadcrumb !== '' && breadcrumb !== 'home') {

                    let breadcrumb_item = document.createElement('div');
                    let i = document.createElement('i');
                    let label = document.createElement('div');

                    breadcrumb_item.classList.add('breadcrumb_item', 'flex');

                    let is_home = 0;
                    if (breadcrumbs[1] == 'home') is_home = true;
                    if (typeof utilities.user_name !== 'undefined' && breadcrumb === utilities.user_name && is_home && idx == 2) {

                        i.classList.add('bi', 'bi-house');
                        breadcrumb_item.append(i)
                        label.innerHTML = 'Home'
                        breadcrumb_item.title = `Home`;

                    } else {
                        label.innerHTML = breadcrumb;
                        breadcrumb_item.title = `${breadcrumb}`;
                    }

                    breadcrumb_item.append(label);
                    breadcrumb_item.addEventListener('click', (e) => {

                        e.preventDefault();
                        e.stopPropagation();

                        let new_location = breadcrumbs.slice(0, idx + 1).join('/');
                        if (new_location) {

                            // console.log('key', e.ctrlKey);

                            if (e.ctrlKey) {
                                fileManager.get_files(new_location)
                                tabManager.add_tab(new_location)
                            } else {
                                fileManager.get_files(new_location);
                            }

                            utilities.set_location(new_location);

                        } else {
                            utilities.set_msg('Error: getting new location in get_breadcrumbs');
                        }

                    });

                    breadcrumb_div.append(breadcrumb_item);

                }

            });

        }

        // click event for breadcrumbs div
        breadcrumb_div.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            utilities.show_location_input();
        });

    }

    // request files from location
    get_files(location, add_tab = false) {

        console.log('running get_files', location);

        // check if location is null or empty
        if (!location || location === '' || location === undefined) {
            utilities.set_msg('Error: get_files - location is empty');
            return;
        }

        // check if location is valid on the file system
        ipcRenderer.invoke('validate_location', location).then((is_valid) => {
            if (is_valid < 0) {
                if (this.startup == 1) {
                    location = this.home_dir;
                } else {

                    // alert(`Error: The location "${location}" is not valid on the file system. Setting location to previous valid location. ${this.location0}`);

                    // set location to previous valid location
                    settingsManager.set_location(this.location0);
                    utilities.set_location(this.location0);
                    utilities.set_destination(this.location0);
                    this.get_breadcrumbs(this.location0);

                    return;

                }
            }
        });

        utilities.set_msg(`<img src="../renderer/icons/spinner.gif" style="width: 12px; height: 12px" alt="loading" /> Loading...`);

        this.location0 = this.location;
        this.location = location;

        ipcRenderer.send('ls', this.location, add_tab);

        settingsManager.set_location(this.location);
        utilities.set_location(this.location);
        utilities.set_destination(this.location);
        this.get_breadcrumbs(this.location);

        this.startup = 0;
        ipcRenderer.send('is_main', 1);

        // let main = document.querySelector('.main');
        // main.style.width = window.innerWidth + 'px';
        // load tabs from settings


    }

    // add copy_array items to the view
    add_items(copy_arr) {

        console.log('running add_items');

        // Loop Copy array
        copy_arr.forEach(f => {

            // make sure f is complete
            for (let a in f) {
                if (f[a] === undefined || f[a] === null) {
                    console.log('error getting grid view item', f);
                    utilities.set_msg('error getting properties for', f);
                    return -1;
                }
            }

        })

        // validate length of copy_arr
        if (copy_arr.length === 0) {
            utilities.set_msg('Error: Add items - copy_arr is empty');
            return;
        }

        // get active tab content
        let active_tab_content = tabManager.get_active_tab_content();

        // get current items in the view
        let items = Array.from(active_tab_content.querySelectorAll('.card'));
        if (items.length === 0) {
            console.log('no cards found in the view');
        }

        // get view container
        let view_container = active_tab_content.querySelector('.view_container');
        if (!view_container) {
            utilities.set_msg('Error: Add items - Could not find view container');
            return;
        }

        // Clear view container
        // view_container.innerHTML = '';

        // loop copy array and create new cards array
        copy_arr.forEach(f => {

            // make sure f is complete
            for (let a in f) {
                if (f[a] === undefined || f[a] === null) {
                    console.log('error getting grid view item', f);
                    return -1;
                }
            }

            // set id
            f.id = btoa(f.href);

            // get card
            let card = this.get_view_item(f);
            card.classList.add('highlight_select');

            // add to items array
            items.push(card)

        })

        // if (this.view === 'list_view') {
        //     // this.get_list_view_header();
        // }

        // add new items array to the grid
        console.log('sorting', this.sort_by, this.sort_direction);
        let arr = utilities.sortItems(items, this.sort_by, this.sort_direction);
        arr.forEach(item => {
            view_container.append(item);
        })

        // clear arrays
        arr = [];
        items = [];
        copy_arr = [];
    }

    update_item(f) {

        console.log('running update_item', f);

        // check file object
        for (let i in f) {
            if (f[i] === undefined || f[i] === null) {
                console.log('Invalid property:', i, f[i]);
                return;
            }
        }

        let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
        let item = active_tab_content.querySelector(`[data-id="${f.id}"]`);

        if (item) {

            // Get card
            let card = this.get_view_item(f);
            if (!card) {
                console.log('error getting card');
                utilities.set_msg('Error: getting card');
                return;
            }

            // replace card with updated card
            item.replaceWith(card);

        }

    }

    // go back
    back() {
        // get previous directory
        this.location = this.location.split('/').slice(0, -1).join('/');
        ipcRenderer.send('ls', this.location);
        this.get_breadcrumbs(this.location);
    }

    // go forward
    forward() {
        ipcRenderer.send('ls', this.location);
        this.get_breadcrumbs(this.location);
    }

}


