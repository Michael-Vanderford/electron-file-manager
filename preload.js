const { contextBridge, ipcRenderer } = require('electron');

// Global Arrays
let selected_files_arr = [];
let auto_complete_arr = [];

let ds;
let sort = 'modified_desc';
let folder_icon;
let symlink_icon;
let readonly_icon;
let thumbnail_dir;
let is_dragging_tab = false;

let view = 'grid';
if (localStorage.getItem('view') == null) {
    localStorage.setItem('view', view);
} else {
    view = localStorage.getItem('view');
}

class ProgressManager {

    constructor(containerSelector, options) {
        this.container = document.querySelector(containerSelector);
        this.progress = null;
        this.progressMsg = null;
        this.progressBar = null;
        this.startTime = null;
        this.id = null;
        this.msg = null;

        if (this.healthCheck(options)) {
            this.initialize(options);
        }
    }

    healthCheck(options) {
        for (let key in options) {
            if (key[options] === 'undefined' || key[options] === "") {
                console.log('missing option', key)
                return 0;
            }
        }
        return 1;
    }

    initialize(options) {

        // If the provided ID is different, create a new instance
        this.id = options.id;
        this.createProgressElements();
        this.showProgress();

        this.startTime = new Date();

        const currentTime = new Date();
        const elapsedTimeInSeconds = Math.floor((currentTime - this.startTime) / 1000);
        const estimatedTimeInSeconds =
        (elapsedTimeInSeconds / options.value) * (options.max - options.value);

        const formattedEstimatedTime = this.formatEstimatedTime(estimatedTimeInSeconds);
        this.msg = `${options.msg}`;

        if (estimatedTimeInSeconds > 3) {
            this.msg = `${options.msg} (${formattedEstimatedTime})`;
        }

        this.progressMsg.innerHTML = this.msg;
        this.progressBar.value = options.value;
        this.progressBar.max = options.max;

        if (this.progressBar.value === this.progressBar.max) {
            this.hideProgress();
        }

    }

    createProgressElements() {
        this.progress = this.addDiv(['progress']);
        this.progressMsg = this.addDiv(['progress_msg']);
        this.progressBar = document.createElement('progress');

        this.progress.id = `progress_${this.id}`;
        this.progressMsg.id = `progress_msg_${this.id}`;
        this.progressBar.id = `progress_bar_${this.id}`;

        this.progress.append(this.progressMsg, this.progressBar);
        this.container.append(this.progress);

        // this.progress.style.display = 'block';
        // this.progress.style.position = 'absolute';
        // this.progress.style.bottom = `${this.calculateBottomPosition()}px`; // Set the bottom property dynamically

    }

    calculateBottomPosition() {
        // Calculate the height of the progress bar plus any additional margin or padding
        const progressBarHeight = this.progress.offsetHeight;
        const additionalMargin = 5; // Adjust as needed

        // Calculate the bottom position for the new progress bar
        const bottomPosition = Array.from(this.container.children)
            .filter(child => child.classList.contains('progress'))
            .reduce((totalHeight, child) => totalHeight + child.offsetHeight + additionalMargin, 0);

        return bottomPosition;
    }

    addDiv(classList) {
        const div = document.createElement('div');
        div.classList.add(...classList);
        return div;
    }

    formatEstimatedTime(seconds) {
        // Implement your own logic for formatting the estimated time (HH:MM:SS or other format)
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${hours}:${minutes}:${remainingSeconds}`;
    }

    showProgress() {
        this.container.classList.remove('hidden');
    }

    hideProgress() {
        let progress_arr = document.querySelectorAll('.progress');
        if (progress_arr.length === 0) {
            this.container.classList.add('hidden');
        }
    }

    updateProgress(data) {

        if (data.max === 0) {
            console.log('progress bar max is 0')
            this.progressMsg.remove();
            this.progressBar.remove();
            this.progress.remove();
            this.hideProgress();
            return;
        }

        const currentTime = new Date();
        const elapsedTimeInSeconds = Math.floor((currentTime - this.startTime) / 1000);
        const estimatedTimeInSeconds =
            (elapsedTimeInSeconds / data.value) * (this.progressBar.max - data.value);

        const formattedEstimatedTime = this.formatEstimatedTime(estimatedTimeInSeconds);
        let msg = `${data.msg} ${getFileSize(data.value)}`;

        if (estimatedTimeInSeconds > 3) {
            msg = `${data.msg} ${getFileSize(data.value)} (${formattedEstimatedTime})`;
        }

        this.progressMsg.innerHTML = msg;
        this.progressBar.value = data.value;
        this.progressBar.max = data.max;


    }



}

class SettingsManager {

    constructor () {
        this.settings = '';
        this.showHeaderMenu();
        this.moveNavMenu();
    }

    getSettings(callback) {
        ipcRenderer.invoke('settings').then(settings => {
            this.settings = settings;
            // console.log('settings', settings)
            return callback(settings);
        })
    }

    showHeaderMenu () {
        const header_menu = document.querySelector('.header_menu');
        // console.log(header_menu)
        this.getSettings(settings => {
            if (settings['Header Menu'].show) {
                header_menu.classList.remove('hidden')
            } else {
                header_menu.classList.add('hidden')
            }
        })
    }

    moveNavMenu () {
        const nav_menu = document.querySelector('.nav_menu');
        this.getSettings(settings => {
            if (settings['Navigation Menu']['Move to Bottom']) {
                nav_menu.classList.add('bottom')
            } else {
                nav_menu.classList.remove('bottom')
            }
        })
    }

    // Get Settings View
    settingsView() {

        let tab_exists = 0;
        let tabs = document.querySelectorAll('.tab');
        let content_tabs =document.querySelectorAll('.tab-content');
        tabs.forEach((tab, idx) => {
            if (tab.innerText.match('Settings')) {
                tab_exists = 1;
            }
        })

        if (tab_exists) {
            tabs.forEach((tab, idx) => {
                let tab_content = content_tabs[idx];
                if (tab.innerText.match('Settings')) {
                    tab.classList.add('active-tab');
                    tab_content.classList.add('active-tab-content');
                    tab_content.classList.remove('hidden');
                } else {
                    tab.classList.remove('active-tab');
                    tab_content.classList.remove('active-tab-content');
                    tab_content.classList.add('hidden');
                }

            })
            return;
        }

        tabManager.addTab('Settings');
        let tab_content = document.querySelector('.active-tab-content');
        ipcRenderer.invoke('path:join', 'views/settings.html').then(path => {

            fetch(path)
                .then(res => {
                    return res.text();
                })
                .then(settings_html => {

                    tab_content.innerHTML = settings_html;
                    ipcRenderer.invoke('settings')
                        .then(res => res)
                        .then(settings => this.settingsForm(settings))
                        .catch(error => console.error('Error:', error))

                })
                .catch(err => {
                    console.log(err)
                })

        })

    }

    // Setting View
    settingsForm(settings) {

        const form = document.querySelector('.settings_view');

        Object.keys(settings).forEach((key, idx) => {

            const value = settings[key];

            if (typeof value === 'string') {

                let input = document.createElement('input');
                let settings_item = add_div(['settings_item']);
                let label = document.createElement('label');
                label.innerText = key;
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

                        input.addEventListener('change', (e) => {
                            ipcRenderer.send('change_theme', input.value);
                            ipcRenderer.send('update_settings', [key], input.value)
                        })

                        // settings_item.append(label, input)
                        break;
                    }
                    case 'terminal': {
                        input.addEventListener('change', (e) => {
                            ipcRenderer.send('update_settings', [key], input.value)
                        })
                        // settings_item.append(label, input);
                        break;
                    }
                    case 'disk utility': {
                        input.addEventListener('change', (e) => {
                            ipcRenderer.send('update_settings', [key], input.value)
                        })
                        // settings_item.append(label, input);
                        break;
                    }
                }

                settings_item.append(label, input);
                input.value = settings[key];
                form.append(settings_item);

            }


            if (typeof value === 'object') {

                let header = document.createElement('h4');
                let hr = document.createElement('hr');

                header.classList.add('header');

                header.innerHTML = `${key.charAt(0).toUpperCase()}${key.slice(1)}`; //key.toUpperCase();
                form.append(hr, header);
                this.settingsForm(value);

                for (let sub_key in settings[key]) {

                    let input;
                    let settings_item = add_div(['settings_item']);

                    let sub_value = settings[`${key}`][`${sub_key}`];
                    let type = typeof sub_value;

                    // Create input field for non-nested properties
                    switch (type) {
                        case 'boolean': {
                            input = document.createElement('input');
                            input.type = 'checkbox';
                            input.checked = sub_value;

                            input.addEventListener('click', (e) => {
                                if (input.checked) {
                                    ipcRenderer.send('update_settings', [key,sub_key], true);
                                } else {
                                    ipcRenderer.send('update_settings', [key,sub_key], false);
                                }

                                switch (key) {
                                    case 'File Menu': {
                                        ipcRenderer.send('show_menubar')
                                        break;
                                    }
                                    case 'Header Menu': {
                                        this.showHeaderMenu();
                                        break;
                                    }
                                    case 'Navigation Menu': {
                                        this.moveNavMenu();
                                        break;
                                    }
                                }

                            })

                            if (sub_key === 'Name') {
                                input.disabled = true;
                            }

                            break;
                        }
                        case 'string': {
                            input = document.createElement('input');
                            input.type = 'text';
                            input.value = sub_value

                            if (key === 'keyboard_shortcuts') {
                                input.disabled = true;
                            }

                            break;
                        }
                        case 'number': {
                            input = document.createElement('input');
                            input.type = 'number';
                            input.value = sub_value;
                            break;
                        }
                        default: {
                            input = document.createElement('input');
                            input.type = 'text';
                            input.value = sub_value;
                            break;
                        }

                    }

                    let label = document.createElement('label');
                    label.textContent = `${sub_key.charAt(0).toUpperCase() + sub_key.slice(1)}:`;
                    settings_item.append(label, input);
                    form.append(settings_item);

                }



            // } else {

            //     // console.log(typeof value)
            //     let settings_item = add_div(['settings_item']);

            //     // Create input field for non-nested properties
            //     const label = document.createElement('label');
            //     label.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}:`;
            //     let input;
            //     if (typeof value === 'boolean') {
            //         // For boolean values, create a checkbox
            //         input = document.createElement('input');
            //         input.type = 'checkbox';
            //         input.name = key;
            //         input.checked = value;
            //         settings_item.append(label, input);

            //         if ()
            //         input.addEventListener('click', (e) => {
            //             // console.log(key)
            //         })

            //         console.log(value)
            //         console.log('chk', idx, key)

            //     } else {
            //         // For other types (string, number), create a text input
            //         if (key === 'Description') {
            //             input = add_div();
            //             input.innerHTML = value
            //         } else {
            //             input = document.createElement('input');
            //             input.type = 'text';
            //             input.name = key;
            //             input.id = key;
            //             input.value = value;

            //             switch (key.toLocaleLowerCase()) {
            //                 case 'theme': {
            //                     // console.log('running theme')
            //                     input = document.createElement('select');
            //                     let options = ['Light', 'Dark']
            //                     options.forEach((option, i) => {
            //                         let option_select = document.createElement('option');
            //                         option_select.text = option
            //                         option_select.value = option
            //                         input.append(option_select);

            //                         if (option.toLocaleLowerCase() === value.toLocaleLowerCase()) {
            //                             option_select.selected = true
            //                         }
            //                     })

            //                     // console.log('selecting ', value)


            //                     input.addEventListener('change', (e) => {
            //                         ipcRenderer.send('change_theme', input.value);
            //                         ipcRenderer.send('update_settings', key, input.value)
            //                     })

            //                     settings_item.append(label, input)
            //                     break;
            //                 }
            //                 case 'terminal': {
            //                     input.addEventListener('change', (e) => {
            //                         ipcRenderer.send('update_settings', key, input.value)
            //                     })
            //                     settings_item.append(label, input);
            //                     break;
            //                 }
            //                 case 'disk utility': {
            //                     input.addEventListener('change', (e) => {
            //                         ipcRenderer.send('update_settings', key, input.value)
            //                     })
            //                     settings_item.append(label, input);
            //                     break;
            //                 }
            //                 default: {
            //                     settings_item.append(label, input);
            //                     input.disabled = true;
            //                     break;
            //                 }

            //             }
            //         }
            //     }

            //     // settings_item.append(label, input);
            //     form.appendChild(settings_item);

            }

        });



        // for (let setting in settings.keyboard_shortcuts) {
        //     let input = document.getElementById(`${setting}`)
        //     input.addEventListener('change', (e) => {
        //         // Need some Input validation
        //         ipcRenderer.send('update_settings', setting, input.value)
        //     })

        // };

    }

}

class Utilities {

    constructor() {
        console.log('running utilities')
        this.location = document.querySelector('.location');
        this.timeout_id = 0;
        this.msg_timeout_id = 0;

        // Clear Folder Size
        ipcRenderer.on('clear_folder_size', (e, href) => {
            this.clearFolderSize(href);
        });

    }

    /**
     * Get Card for Grid View
     * @param {File} file
     * @returns File Card
     */
    getCard(file) {

        let location = document.getElementById('location');
        let is_dir = 0;

        let card = add_div(['card']);
        let content = add_div(['content']);
        let icon = add_div(['icon_div']);
        let img = document.createElement('img');
        let header = add_div(['header', 'item']);
        let href = document.createElement('a');
        let path = add_div(['path', 'item', 'hidden']);
        let mtime = add_div(['date', 'mtime', 'item', 'hidden']);
        let atime = add_div(['date', 'atime', 'item', 'hidden']);
        let ctime = add_div(['date', 'ctime','item', 'hidden']);
        let size = add_div(['size', 'item', 'hidden']);
        let type = add_div(['type', 'item', 'hidden']);
        let count = add_div(['count', 'item', 'hidden']);
        let input = document.createElement('input');
        let tooltip = add_div('tooltip', 'hidden');

        input.classList.add('input', 'item', 'hidden');
        img.classList.add('icon');

        card.style.opacity = 1;

        // Populate values
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

        card.querySelectorAll('.item').forEach(item => {
            item.draggable = false;
        })

        // tooltip.append(`Name: ${path.basename(file.href)}`);
        let tooltip_timeout;

        // Mouse Over
        let title = '';
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
            href.focus();

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
            // if (e.ctrlKey) {
                if (card.classList.contains('highlight_select')) {
                    card.classList.remove('highlight_select')
                    utilities.getSelectedCount();
                } else {
                    card.classList.add('highlight_select')
                    utilities.getSelectedCount();
                }
            // }
        })

        card.addEventListener('dragstart', (e) => {
            // e.stopPropagation();
            getSelectedFiles();
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
                } else {
                    e.dataTransfer.dropEffect = "move";
                }

            }
        })

        card.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove('highlight_target');
            utilities.msg('');
        })

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // let utils = new Utilities();
            ipcRenderer.send('main', 0);
            if (!card.classList.contains('highlight') && card.classList.contains('highlight_target')) {
                if (e.ctrlKey) {
                    fileOperation.paste(file.href);
                } else {
                    console.log('moving to', file.href);
                    fileOperation.move(file.href);
                }
            } else {
                // console.log('did not find target')
            }

        })

        mtime.append(getDateTime(file.mtime));
        ctime.append(getDateTime(file.ctime));
        atime.append(getDateTime(file.atime));
        type.append(file.content_type);

        // console.log(file.content_type)

        icon.append(img);
        header.append(href, input);

        // Directory
        if (file.is_dir || file.type === 'inode/directory') {

            // ipcRenderer.send('get_folder_icon', file.href);

            is_dir = 1;
            let test_folder_icon_path = folder_icon + `folder.svg`;
            ipcRenderer.invoke('file_exists', test_folder_icon_path)
            .then(res => {

                let ext = '.svg';
                if (!res) {
                    ext = '.png';
                }

                let folder_icon_path = "";
                if (file.href.endsWith('Document')) {
                    folder_icon_path = folder_icon + `folder-documents${ext}`;
                } else if (file.href.endsWith('Downloads')) {
                    const downloadsPath = folder_icon + `folder-downloads${ext}`;
                    ipcRenderer.invoke('file_exists', downloadsPath).then(res => {
                        folder_icon_path = res ? downloadsPath : folder_icon + `folder-download${ext}`;
                        img.src = folder_icon_path;
                    });
                    return;
                } else if (file.href.endsWith('Music')) {
                    folder_icon_path = folder_icon + `folder-music${ext}`;
                } else if (file.href.endsWith('Pictures')) {
                    folder_icon_path = folder_icon + `folder-pictures${ext}`;
                } else if (file.href.endsWith('Videos')) {
                    folder_icon_path = folder_icon + `folder-videos${ext}`;
                } else {
                    folder_icon_path = folder_icon + `folder${ext}`;
                }

                img.src = folder_icon_path;
            });
            // img.src = folder_icon;

            // if (file.href.endsWith('Documents')) {
            //     img.src = folder_icon + 'folder-documents.svg';
            // } else if (file.href.endsWith('Downloads')) {
            //     img.src = folder_icon + 'folder-downloads.svg';
            // } else if (file.href.endsWith('Music')) {
            //     img.src = folder_icon + 'folder-music.svg';
            // } else if (file.href.endsWith('Pictures')) {
            //     img.src = folder_icon + 'folder-pictures.svg';
            // } else if (file.href.endsWith('Videos')) {
            //     img.src = folder_icon + 'folder-videos.svg';
            // } else {
            //     img.src = folder_icon + 'folder.svg';
            // }
            // console.log(img.src)

            card.classList.add('folder_card', 'lazy')

            // Href
            href.addEventListener('click', (e) => {
                e.preventDefault();

                if (!file.is_readable) {
                    utilities.msg('Error: Access Denied');
                    return;
                }

                location.value = file.href;
                navigation.addHistory(file.href);
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

                if (!file.is_readable) {
                    utilities.msg('Error: Access Denied');
                    return;
                }

                location.value = file.href;
                navigation.addHistory(file.href);
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

        if (file.is_symlink) {
            let symlink_img = document.createElement('img');
            symlink_img.src = symlink_icon;
            symlink_img.classList.add('symlink');
            icon.append(symlink_img);
        }

        if (!file.is_writable) {

            // console.log(file)
            let readonly_img = document.createElement('img');
            readonly_img.src = readonly_icon;
            readonly_img.classList.add('readonly');
            // readonly_icon.style = 'height: 12px'; // applied style here because there is a little lag time when set in css
            icon.append(readonly_img);

        }

        if (view == 'list') {

            card.classList.add('list');
            content.classList.add('list');

            for (const key in settings.Captions) {

                if (settings.Captions[key]) {

                    switch (key) {
                        case 'Location':
                            path.classList.remove('hidden')
                            path.append(file.location)
                            break;
                        case 'Modified':
                            mtime.classList.remove('hidden')
                            break;
                        case 'Created':
                            ctime.classList.remove('hidden')
                            break;
                        case 'Accessed':
                            atime.classList.remove('hidden')
                            break;
                        case 'Type':
                            type.classList.remove('hidden')
                            break;
                        case 'Size':
                            size.classList.remove('hidden')
                            break;
                        case 'Count':
                            count.classList.remove('hidden')
                            break;
                    }

                }

            }

            let list_header = add_div(['item', 'list', 'list_header'])
            list_header.append(icon, header)
            // header.append(list_header);
            content.append(list_header, path, mtime, ctime, atime, type, size, count);
            card.append(content, tooltip);
        }

        if (view === 'grid') {
            card.classList.remove('list');
            content.classList.remove('list');
            mtime.classList.remove('hidden')
            size.classList.remove('hidden')
            content.append(header, path, mtime, ctime, atime, type, size, count);
            card.append(icon, content, tooltip);
        }

        return card;
    }

    /**
     * Drag Select
     */
    dragSelect () {

        console.log('running drag select');

        const selectionRectangle = document.getElementById('selection-rectangle');
        console.log(selectionRectangle);
        let isSelecting = false;
        let startPosX = 0;
        let startPosY = 0;
        let endPosX = 0;
        let endPosY = 0;

        const cards = document.querySelectorAll('.card');
        const active_tab_content = document.querySelector('.active-tab-content');
        // const tab_content = document.querySelector('.tab-content');

        active_tab_content.addEventListener('mousedown', (e) => {

            if (e.button === 2 || is_dragging_tab) {
                is_dragging_tab = false;
                return;
            }

            isSelecting = true;
            startPosX = e.clientX;
            startPosY = e.clientY;

            selectionRectangle.style.left = startPosX + 'px';
            selectionRectangle.style.top = startPosY + 'px';
            selectionRectangle.style.width = '0';
            selectionRectangle.style.height = '0';
            selectionRectangle.style.display = 'block';

            cards.forEach(item => item.classList.remove('selected'));

        });

        let allowClick = 1;
        active_tab_content.addEventListener('mousemove', (e) => {

            // e.preventDefault();

            if (!isSelecting || is_dragging_tab) {
                return;
            }

            endPosX = e.clientX;
            endPosY = e.clientY;

            const rectWidth = endPosX - startPosX;
            const rectHeight = endPosY - startPosY;

            selectionRectangle.style.width = Math.abs(rectWidth) + 'px';
            selectionRectangle.style.height = Math.abs(rectHeight) + 'px';
            selectionRectangle.style.left = rectWidth > 0 ? startPosX + 'px' : endPosX + 'px';
            selectionRectangle.style.top = rectHeight > 0 ? startPosY + 'px' : endPosY + 'px';

            // Highlight selectable items within the selection area
            cards.forEach(card => {

                const itemRect = card.getBoundingClientRect();
                const isSelected =
                    ((itemRect.left < endPosX && itemRect.right > startPosX) ||
                    (itemRect.left < startPosX && itemRect.right > endPosX)) &&
                    ((itemRect.top < endPosY && itemRect.bottom > startPosY) ||
                    (itemRect.top < startPosY && itemRect.bottom > endPosY));

                if (isSelected) {

                    card.classList.add('highlight_select');
                    // msg(` ${getFileSize(utilities.getSelectedFilesSize())}`);
                    // folder_count.innerText = viewManager.getFolderCount()
                    // disk_space.prepend(`Folder Count`, folder_count);
                    // utilities.msg(`${viewManager.getFolderCount()} Folders / ${viewManager.getFileCount()} Files Selected (${getFileSize(viewManager.getTotalSize())})`);
                    utilities.getSelectedCount();

                }

                // card.addEventListener('dragstart', (e) => {
                //     e.dataTransfer.setData('text/plain', card.textContent);
                //     isSelecting = false;
                //     selectionRectangle.style.display = 'none';
                //     card.classList.add('dragging')
                // })

                // card.addEventListener('dragover', (e) => {
                //     isSelecting = false;
                // })

                // card.addEventListener('drop', (e) => {
                //     isSelecting = false;
                // })

            });

            allowClick = 0;

        });

        cards.forEach(card => {

            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.textContent);
                isSelecting = false;
                selectionRectangle.style.display = 'none';
                card.classList.add('dragging')
            })

            card.addEventListener('dragover', (e) => {
                isSelecting = false;
            })

            card.addEventListener('drop', (e) => {
                isSelecting = false;
            })

        })

        active_tab_content.addEventListener('mouseup', (e) => {
            isSelecting = false;
            selectionRectangle.style.display = 'none';
            // utilities.msg(`${viewManager.getFolderCount()} Folders / ${viewManager.getFileCount()} Files Selected (${getFileSize(viewManager.getTotalSize())})`);
        });

        active_tab_content.addEventListener('click', (e) => {
            if (allowClick) {
                clearHighlight()
            } else {
                allowClick = 1;
            }
        })

        // utilities.getFolderSizes();
        // utilities.autoComplete();
        // Focus first card
        // let href = cards[0].querySelector('.header a');
        // href.focus();

    }


    /**
     * Clear Folder Size
     */
    clearFolderSize(href) {
        console.log('clearing folder size')
        localStorage.removeItem(href);
    }

    /**
     *
     * @param {*} dateString
     * @returns
     */
    isDate(dateString) {
        // Attempt to create a new date object from the provided string
        const date = new Date(Date.parse(dateString));
        console.log(dateString,date)
        // Check if the date is valid and not equal to the default "Invalid Date"
        return date instanceof Date && !isNaN(date);
    }

    /**
     *
     * @returns Returns the selected files cumulative size
     */
    getSelectedSize() {
        let cards = document.querySelectorAll('.highlight, .highlight_select');
        let size = 0;
        cards.forEach(card => {
            if (card.dataset.size) {
                size += parseInt(card.dataset.size);
            } else {
                size += 0;
            }
        })
        // this.msg(`Selected Size: ${getFileSize(size)}`);
        return size;
    }

    /**
     *
     * @returns Returns the selected count
     */
    getSelectedCount() {
        let tab_content = document.querySelector('.active-tab-content');
        let cards = tab_content.querySelectorAll('.highlight_select');
        let count = cards.length;
        if (count > 0) {
            this.msg(`${count} Items selected (${getFileSize(this.getSelectedSize())})`);
        } else {
            this.msg('');
        }
    }

    /**
     *
     * @returns Returns the selected copy count
     */
    getSelectedCopy() {
        let active_tab_content = document.querySelector('.active-tab-content');
        let cards = Array.from(active_tab_content.querySelectorAll('.highlight, .highlight_select'));
        let count = cards.length;
        if (count === 0) {
            this.msg('');
        } else if (count === 1) {
            this.msg(`${count} Item copied (${getFileSize(this.getSelectedSize())})`, 0);
        } else {
            this.msg(`${count} Items copied (${getFileSize(this.getSelectedSize())})`, 0);
        }
    }

    getIcon(href) {

    }

    // Auto Complete that populates a directory path when typing in the location bar
    autoComplete() {

        // let viewManager = new ViewManager();
        let nav_menu = document.querySelector('.nav_menu');
        let location = document.querySelector('.location');

        let autocomplete_container = document.querySelector('.autocomplete');
        if (!autocomplete_container) {
            autocomplete_container = add_div(['autocomplete']);
            location.append(autocomplete_container);
        }

        let val0 = location.value;
        location.addEventListener('input', (e) => {

            if (e.key !== 'Backspace') {
                let val = e.target.value;
                ipcRenderer.invoke('autocomplete', val).then(res => {
                    if (res.length > 0 && val0 !== val) {
                        autocomplete_container.innerHTML = '';
                        res.forEach((dir, i) => {
                            let suggestion = add_div(['suggestion']);
                            suggestion.textContent = dir;
                            autocomplete_container.appendChild(suggestion);
                            autocomplete_container.classList.remove('hidden');

                            nav_menu.append(autocomplete_container);
                            if (i === 0) {
                                suggestion.classList.add('highlight');
                            }

                            // Open highlighted suggestion
                            suggestion.addEventListener('click', (e) => {
                                viewManager.getView(dir);
                                autocomplete_container.classList.add('hidden');
                            })
                        })

                    }
                })
            }
        })

        // Open highlighted suggestion
        location.addEventListener('keydown', (e) => {
            let suggestions = document.querySelectorAll('.suggestion');
            switch (e.key) {
                case 'ArrowDown': {
                    clearTimeout(this.timeout_id);
                    for (let i = 0; i < suggestions.length; i++) {
                        if (suggestions[i].classList.contains('highlight')) {
                            suggestions[i].classList.remove('highlight');
                            if (i === suggestions.length - 1) {
                                suggestions[0].classList.add('highlight');
                            } else {
                                suggestions[i + 1].classList.add('highlight');
                                location.value = suggestions[i + 1].innerText;
                            }
                            break;
                        }
                    }

                    break
                }
                case 'ArrowUp': {
                    clearTimeout(this.timeout_id);
                    for (let i = 0; i < suggestions.length; i++) {
                        if (suggestions[i].classList.contains('highlight')) {
                            suggestions[i].classList.remove('highlight');
                            if (i === 0) {
                                suggestions[suggestions.length - 1].classList.add('highlight');
                            } else {
                                suggestions[i - 1].classList.add('highlight');
                            }
                            break;
                        }
                    }
                    break;
                }
                case 'Enter': {
                    clearTimeout(this.timeout_id);
                    if (suggestions.length > 0) {
                        suggestions.forEach(item => {
                            if (item.classList.contains('highlight')) {
                                viewManager.getView(item.innerText);
                                autocomplete_container.classList.add('hidden');
                            } else {
                                viewManager.getView(location.value);
                                autocomplete_container.classList.add('hidden');
                            }
                        })
                        viewManager.getView(location.value);
                        autocomplete_container.classList.add('hidden');
                    } else {
                    }
                    break;
                }
                case 'Escape': {
                    clearTimeout(this.timeout_id);
                    autocomplete_container.classList.add('hidden');
                    break;
                }
                case 'Tab': {
                    e.preventDefault()
                    for (let i = 0; i < suggestions.length; i++) {
                        if (suggestions[i].classList.contains('highlight')) {
                            location.value = suggestions[i].innerText;
                            autocomplete_container.classList.add('hidden');
                            break;
                        }
                    }
                    break;
                }
            }

            // if (e.key !== 'Backspace') {
            //     this.timeout_id = setTimeout(() => {
            //         let suggestions = document.querySelectorAll('.suggestion');
            //         if (suggestions.length > 0) {
            //             location.value = suggestions[0].innerText;
            //         }
            //     }, 1000);
            // }


        })

    }

    /**
     *
     * @param {*} message
     * @param {*} has_timeout
     */
    msg(message, has_timeout = 1) {

        // let content = document.querySelector('.tab-content');
        let msg = document.querySelector('.msg');
        // if (!msg) {
        //     msg = add_div(['msg', 'bottom']);
        //     content.append(msg);
        // }

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
        clearTimeout(this.msg_timeout_id);
        if (has_timeout === 1) {
            this.msg_timeout_id = setTimeout(() => {
                msg.classList.add('hidden');
            }, 5000);
        } else {
            clearTimeout(this.msg_timeout_id);
        }

    }

    /**
     * Call get folder size
     */
    getFolderSizes() {
        let tabs_content = document.querySelectorAll('.tab-content');
        tabs_content.forEach(tab_content => {
            let folder_grid = tab_content.querySelector('.folder_grid', '.hidden_folder_grid');
            let cards = folder_grid.querySelectorAll('.card');
            cards.forEach(card => {
                let href = card.dataset.href;
                // this.clearFolderSize(href);
                // if (localStorage.getItem(href) !== null) {
                //     let size = localStorage.getItem(href);
                //     let size_div = card.querySelector('.size');
                //     size_div.innerHTML = getFileSize(size);
                //     card.dataset.size = parseInt(size);
                // } else {
                    ipcRenderer.send('get_folder_size', href);
                // }
            })
        })

    }

    /**
     * Send request to get folder size
     */
    getFolderSize(href) {
        ipcRenderer.send('get_folder_size', href);
    }

}

class IconManager {

    constructor() {
        this.slider = document.getElementById('slider');
    }

    getIconSize() {
        console.log('getting icon size')
        let icon_size = "";
        if (view === 'grid') {
            if (localStorage.getItem('icon_size') === null) {
                localStorage.setItem('icon_size', 48);
                icon_size = 48;
            }
            else {
                icon_size = localStorage.getItem('icon_size');
            }
        } else if (view === 'list') {
            if (localStorage.getItem('list_icon_size') === null) {
                localStorage.setItem('list_icon_size', 24);
                icon_size = 24;
            }
            else {
                icon_size = localStorage.getItem('list_icon_size');
            }
        }
        if (icon_size === null) {
            icon_size = 48;
        }
        return icon_size;
    }

    resizeIcons(icon_size) {
        console.log('resizing icons to', icon_size)
        let cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            // if (!card.classList.contains('list')) {
                let icon = card.querySelector('.icon');
                icon.style.width = `${icon_size}px`;
                icon.style.height = `${icon_size}px`;
            // }
        })
        if (view === 'grid') {
            localStorage.setItem('icon_size', icon_size);
        } else if (view === 'list') {
            localStorage.setItem('list_icon_size', icon_size);
        }
        this.slider.value = icon_size;
        console.log(view)
    }

}

class Navigation {

    constructor() {
        this.historyArr = [];
        this.idx = 0;
        this.location = document.querySelector('.location');

        const left = document.getElementById('left');
        const right = document.getElementById('right');

        left.addEventListener('click', (e) => {
            this.left();
        })

        right.addEventListener('click', (e) => {
            this.right();
        })

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key.toLocaleLowerCase() === 'l') {
                this.location.focus();
            }

        });

    }

    addHistory(location) {

        if (this.historyArr[this.historyArr.length - 1] !== location) {
            // console.log('adding history');
            this.historyArr.push(location);
            this.idx = this.historyArr.length - 1;
        }
    }

    left() {
        console.log('left', this.idx);
        if (this.idx > 0) {
            --this.idx;
            viewManager.getView(this.historyArr[this.idx]);
        }
    }

    right() {
        if (this.idx < this.historyArr.length - 1) {
            ++this.idx
            viewManager.getView(this.historyArr[this.idx]);
        }
    }

}

class TabManager {

    constructor() {

        console.log('running tab manager');

        this.main = document.querySelector('.main')
        this.id = 0;
        this.tabs = [];
        this.tabHeader = document.querySelector('.tab-header'); //add_div(['tab-header','flex']);
        this.tabHeader.classList.add('flex')
        this.main.append(this.tabHeader);

    }

    addTab(label) {

        ++this.id;

        let location = document.querySelector('.location');
        let tab = add_div(['tab', 'flex']);
        let tab_content = add_div(['tab-content']);
        let col1 = add_div(['label']);
        let col2 = add_div(['tab_close']);
        let btn_close = document.createElement('i');

        tab.dataset.id = this.id;
        tab.dataset.href = location.value;
        tab_content.dataset.id = this.id;

        tab.draggable = true;

        col1.innerHTML = label;
        btn_close.classList.add('bi', 'bi-x');

        col2.append(btn_close);
        tab.append(col1, col2);

        this.tabHeader.append(tab);

        this.tabs.push(this.id);
        this.main.append(tab_content)

        this.clearActiveTabs();
        tab.classList.add('active-tab');
        tab_content.classList.add('active-tab-content');
        tab_content.classList.remove('hidden');

        // Close Tab
        btn_close.addEventListener('click', (e) => {
            e.stopPropagation();
            let current_tabs = document.querySelectorAll('.tab');
            let current_tab_content = document.querySelectorAll('.tab-content');
            let active_tab = document.querySelector('.active-tab');
            if (active_tab === tab) {

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

        // Switch Tabs
        tab.addEventListener('click', (e) => {
            this.clearActiveTabs();
            tab.classList.add('active-tab');
            tab_content.classList.add('active-tab-content');
            tab_content.classList.remove('hidden');
        })

        let tabs = document.querySelectorAll('.tab');

        // Handle Tab Dragging ////////////////////////////
        const selectionRectangle = document.getElementById('selection-rectangle');
        let draggingTab = null;
        tabs.forEach(tab => {

            // Drag Start
            tab.addEventListener("dragstart", (e) => {
                e.stopPropagation();
                is_dragging_tab = true;
                if (e.target.classList.contains("tab")) {
                    draggingTab = e.target;
                    e.target.style.opacity = 0.5;
                }
            });

            // Drag End
            tab.addEventListener("dragend", (e) => {
                if (draggingTab) {
                    draggingTab.style.opacity = 1;
                    draggingTab = null;
                }
            });

            tab.addEventListener("dragover", (e) => {
                e.preventDefault();
                tab.classList.add('highlight');
            });

            tab.addEventListener('dragleave', (e) => {
                if (e.target.classList.contains('highlight')) {
                    e.target.classList.remove('highlight');
                }
            })

            tab.addEventListener("drop", (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectionRectangle.style.display = 'none';
                clearHighlight();
                if (draggingTab) {
                    const targetTab = e.target.closest(".tab");
                    if (targetTab) {
                        const container = document.querySelector(".tab-header");
                        const targetIndex = Array.from(container.children).indexOf(targetTab);
                        const draggingIndex = Array.from(container.children).indexOf(draggingTab);

                        if (draggingIndex !== targetIndex) {
                            container.insertBefore(draggingTab, targetTab);
                        }
                    }
                }

            });

        })

    }

    // Add Tab Content
    addTabContent(html) {
        let active_tab_content = document.querySelector('.active-tab-content')
        active_tab_content.innerHTML = html
    }

    // Clear Active Tab
    clearActiveTabs() {
        let tabs = this.tabHeader.querySelectorAll('.tab');
        let tab_content = document.querySelectorAll('.tab-content');
        tabs.forEach((tab, i) => {
            tab.classList.remove('active-tab')
            tab_content[i].classList.remove('active-tab-content')
            tab_content[i].classList.add('hidden');
        })
    }

}

class Progress {
    constructor() {

    }
}

class ViewManager {

    constructor() {

        console.log('running view manager')

        // this.utils = new Utilities();
        this.view = localStorage.getItem('view');

        // Switch View Listener
        ipcRenderer.on('switch_view', (e, view) => {
            this.view = view
            // localStorage.setItem('view', this.view);
            // let location = document.querySelector('.location');
            // this.getView(location.value);
            this.switchView (this.view);
        })

        // Register listener for columns
        ipcRenderer.on('columns', (e) => {
            ipcRenderer.invoke('settings').then(settings => {
                let list = document.querySelector('.columns_list');
                for (const key in settings.Captions) {
                    const item = add_div(['item']);
                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.id = key;
                    const label = document.createElement('label');
                    label.classList.add('label');
                    label.innerText = key;
                    label.htmlFor = key;

                    if (key === 'Name') {
                        input.disabled = true;
                    }

                    if (settings.Captions[key]) {
                        input.checked = true;
                    }

                    item.append(input, label)
                    list.append(item);

                    input.addEventListener('change', (e) => {
                        if (input.checked) {
                            settings.Captions[key] = true;
                        } else {
                            settings.Captions[key] = false;
                        }

                        ipcRenderer.send('update_settings_columns', key, settings.Captions[key], localStorage.getItem('location'));

                    })

                }

            })

        })

    }

    // Get View
    getView(dir, tab = 0) {

        show_loader();
        console.log('running get view');
        ipcRenderer.send('get_files', dir, tab);
        clearHighlight();

    }

    /**
     *
     * @param {string} s_view
     * Valid parameters are 'grid' or 'list'
     */
    switchView(s_view) {
        view = s_view;
        localStorage.setItem('view', view);
        // this.getView(this.location.value);
        switch (view) {
            case 'grid': {
                this.gridView();
                break;
            }
            case 'list': {
                this.listView();
                break;
            }
        }
    }

    /**
     * Grid View
     */
    gridView() {
        console.log('running grid view')
        let tabs_content = document.querySelectorAll('.tab-content');
        tabs_content.forEach((tab_content, idx) => {

            let header_row = tab_content.querySelector('.header_row');
            if (header_row) {
                header_row.classList.add('hidden');
            }

            let grids = ['.folder_grid', '.file_grid', '.hidden_folder_grid', '.hidden_file_grid'];
            grids.forEach(grid => {

                let grid_views = tab_content.querySelectorAll(grid);
                grid_views.forEach(grid_view => {
                    grid_view.classList.add('grid');
                    grid_view.classList.remove('grid1');

                    let cards = grid_view.querySelectorAll('.card');
                    cards.forEach(card => {
                        card.classList.remove('list');

                        let content = card.querySelector('.content');
                        content.classList.remove('list');

                        let item = content.querySelector('.item');
                        item.classList.add('header');
                        item.classList.remove('list', 'list_header');

                        let icon_div = card.querySelector('.icon_div');
                        icon_div.remove();
                        card.prepend(icon_div);

                        let atime = card.querySelector('.atime');
                        atime.classList.add('hidden');

                        let ctime = card.querySelector('.ctime');
                        ctime.classList.add('hidden');

                    })
                })

            })

        });

        let icon_size = iconManager.getIconSize();
        iconManager.resizeIcons(icon_size);

    }

    /**
     * List View
     * This currently is not working. use get_view for now
     */
    listView() {

        console.log('running list view')

        let tabs_content = document.querySelectorAll('.tab-content');
        console.log(tabs_content)
        tabs_content.forEach(tab_content => {

            let header_row = tab_content.querySelector('.header_row');
            if (header_row) {
                header_row.classList.remove('hidden');
            }

            let grids = ['.folder_grid', '.file_grid', '.hidden_folder_grid', '.hidden_file_grid'];
            grids.forEach(grid => {

                console.log(grid)

                let grid_views = document.querySelectorAll(grid);
                grid_views.forEach(grid_view => {

                    grid_view.classList.remove('grid');
                    grid_view.classList.add('grid1');

                    let cards = grid_view.querySelectorAll('.card');
                    cards.forEach(card => {
                        card.classList.add('list');

                        let content = card.querySelector('.content');
                        content.classList.add('list');

                        let item = content.querySelector('.item');
                        item.classList.remove('header');
                        item.classList.add('list', 'list_header');

                        let icon_div = card.querySelector('.icon_div');
                        icon_div.remove();
                        item.prepend(icon_div);

                        let href = card.querySelector('a');

                        let header = card.querySelector('.header');
                        if (!header) {
                            header = add_div(['header', 'item']);
                        }
                        header.append(href);
                        item.append(header);

                        // Handle column headers for list view
                        for (const key in settings.Captions) {
                            if (settings.Captions[key]) {
                                if (key === 'Location') {
                                    let path = card.querySelector('.path');
                                    path.classList.remove('hidden');
                                }
                                if (key === 'Modified') {
                                    let mtime = card.querySelector('.mtime');
                                    mtime.classList.remove('hidden');
                                }
                                if (key === 'Created') {
                                    let ctime = card.querySelector('.ctime');
                                    ctime.classList.remove('hidden');
                                }
                                if (key === 'Accessed') {
                                    let atime = card.querySelector('.atime');
                                    atime.classList.remove('hidden');
                                }
                                if (key === 'Type') {
                                    let type = card.querySelector('.type');
                                    type.classList.remove('hidden');
                                }
                                if (key === 'Size') {
                                    let size = card.querySelector('.size');
                                    size.classList.remove('hidden');
                                }
                                if (key === 'Count') {
                                    let count = card.querySelector('.count');
                                    count.classList.remove('hidden');
                                }

                            } else {
                                if (key === 'Location') {
                                    let path = card.querySelector('.path');
                                    path.classList.add('hidden');
                                }
                                if (key === 'Modified') {
                                    let mtime = card.querySelector('.mtime');
                                    mtime.classList.add('hidden');
                                }
                                if (key === 'Created') {
                                    let ctime = card.querySelector('.ctime');
                                    ctime.classList.add('hidden');
                                }
                                if (key === 'Accessed') {
                                    let atime = card.querySelector('.atime');
                                    atime.classList.add('hidden');
                                }
                                if (key === 'Type') {
                                    let type = card.querySelector('.type');
                                    type.classList.add('hidden');
                                }
                                if (key === 'Size') {
                                    let size = card.querySelector('.size');
                                    size.classList.add('hidden');
                                }
                                if (key === 'Count') {
                                    let count = card.querySelector('.count');
                                    count.classList.add('hidden');
                                }
                                console.log(key);
                            }
                        }

                    })

                })

            })



        })

        let icon_size = iconManager.getIconSize();
        iconManager.resizeIcons(icon_size);

    }


    // Lazy load images
    lazyload() {
        console.log('running lazyload');
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

    // Sort for list view
    sort(dirents) {

        const dirents_arr = []

        const directories = dirents.filter(x => x.is_dir === true && x.is_hidden !== true);
        const hidden_directories = dirents.filter(x => x.is_dir === true && x.is_hidden);
        const files = dirents.filter(x => x.is_dir === false && x.is_hidden !== true);
        const hidden_files = dirents.filter(x => x.is_dir === false && x.is_hidden);

        const show_hidden = localStorage.getItem('show_hidden');
        // console.log('show hidden', show_hidden)
        if (show_hidden === '1') {
            dirents_arr.push(directories, hidden_directories, files, hidden_files)
        } else {
            dirents_arr.push(directories, files)
        }

        dirents_arr.forEach(arr => {

            const sort = localStorage.getItem('sort');
            // console.log(sort);
            switch (sort) {
                case 'name_asc': {
                    arr.sort((a, b) => {
                        if (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase()) {
                            return -1;
                        }
                        if (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase()) {
                            return 1;
                        }
                        return 0;
                    })
                    break;
                }
                case 'name_desc': {
                    arr.sort((a, b) => {
                        if (b.name.toLocaleLowerCase() < a.name.toLocaleLowerCase()) {
                            return -1;
                        }
                        if (b.name.toLocaleLowerCase() > a.name.toLocaleLowerCase()) {
                            return 1;
                        }
                        return 0;
                    })
                    break;
                }
                case 'modified_desc': {
                    arr.sort((a, b) => {
                        // console.log(a,b)
                        return b.mtime - a.mtime
                    })
                    break;
                }
                case 'modified_asc': {
                    arr.sort((a, b) => {
                        return a.mtime - b.mtime
                    })

                    break;
                }
                case 'size': {
                    arr.sort((a, b) => {
                        return b.size - a.size
                    })
                    break;
                }
            }

        })

        if (show_hidden === '1') {
            return directories.concat(hidden_directories, files, hidden_files);
        } else {
            return directories.concat(files);
        }

    }

    hideCols() {

        ipcRenderer.invoke('settings').then(settings => {

            let table = document.querySelector('.table');
            let ths = table.querySelectorAll('thead tr td');
            let rows = table.rows;

            ths.forEach((th, idx) => {
                for (const key in settings.Captions) {

                    if (key === th.innerText && settings.Captions[key] === false) {
                        // th.classList.add('hidden');
                        console.log(key, idx);
                        return;
                    }
                }

                for (let i = 0; i < rows.length; i++) {

                    let td = rows[i].querySelector(`td:nth-child(${idx})`);
                    console.log(idx, td)
                    if (td != null) {
                        td.classList.add('hidden')
                    }

                }

            });

        })

    }

    getColumns() {

        ipcRenderer.send('columns');
        // ipcRenderer.invoke('settings').then(settings => {
        //     console.log(settings.captions)
        // })
        // ipcRenderer.invoke('get')
    }

    // Split View
    splitView() {
        let container = document.querySelector('.container');
        let split_view = add_div(['split-view']);
        container.append(split_view);
    }

    getFolderCount () {
        let folder_count = document.querySelectorAll('.folder_grid > .highlight_select');
        return folder_count.length;
    }

    getFileCount () {
        let file_count = document.querySelectorAll('.file_grid >.highlight_select');
        return file_count.length;
    }

    getTotalSize () {
        let size = 0;
        let cards = document.querySelectorAll('.highlight_select');
        cards.forEach(card => {
            size += parseInt(card.dataset.size);
        })
        return size;
    }

}

class FileOperation {

    constructor() {
        this.location = document.querySelector('.location')
        this.cut_flag = 0;

        // On ls - Get Directory
        ipcRenderer.on('ls', (e, dirents, source, tab) => {

            let st = new Date().getTime();

            show_loader();

            localStorage.setItem('location', source);
            navigation.addHistory(source);
            auto_complete_arr = [];

            let main = document.querySelector('.main');
            let tabs = document.querySelectorAll('.tab');
            let file_menu = document.querySelector('.header_menu');
            let menu_items = file_menu.querySelectorAll('.item');

            view = localStorage.getItem('view');

            const selectionRectangle = document.getElementById('selection-rectangle');
            let isSelecting = false;
            let startPosX, startPosY, endPosX, endPosY;

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
                if (sidebar_item) {
                    if (item.title === source) {
                        item.classList.add('highlight_select')
                    } else {
                        item.classList.remove('highlight_select', 'active')
                    }
                }
            })

            // Add new tab if tab = 1
            if (tab) {
                tabManager.addTab(source);
            }

            if (tabs.length === 0) {
                tabManager.addTab(source);
            }

            let active_tab = document.querySelector('.active-tab');
            let active_label = active_tab.querySelector('.label')
            let active_tab_content = document.querySelector('.active-tab-content');
            active_tab_content.innerHTML = '';

            active_tab.dataset.href = source;
            active_tab.title = source;

            active_tab.addEventListener('click', (e) => {
                location.value = source;
            })

            if (dirents.length === 0) {
                let empty_msg = add_div(['empty_msg']);
                empty_msg.innerHTML = 'Folder is Empty';
                active_tab_content.append(empty_msg);
            }

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

            location.value = source;
            ipcRenderer.invoke('basename', location.value).then(basename => {
                document.title = basename;
            })

            let header = active_tab_content.querySelector('.header_row')
            if (!header) {
                header = add_div();
                header.classList.add('header_row', 'content', 'list', 'sticky');
                header.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation()
                    ipcRenderer.send('columns_menu')
                })
                let colNames = [];
                let colClasses = [];
                for (const key in settings.Captions) {
                    if (settings.Captions[key] === true) {
                        colNames.push(key)
                        colClasses.push(key.toLowerCase());
                    }
                }
                // let colNames = ['Name', 'Modified', 'Size', 'Items'];
                // let colClasses = ['name', 'date', 'size', 'items'];
                let sort_by = '_desc'
                let headerRow = colNames.map((colName, index) => {

                    let col = add_div();
                    col.classList.add('item', colClasses[index]);
                    col.append(colName);
                    col.addEventListener('click', (e) => {

                        sort = colName.toLocaleLowerCase();
                        if (sort === 'name' || sort === 'modified' || sort === 'created' || sort === 'accessed') {
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

                // viewManager.listView(dirents)
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

            } else if (view === 'grid') {

                header.classList.add('hidden');

                list_view.classList.remove('active');
                grid_view.classList.add('active');

                [folder_grid, file_grid, hidden_folder_grid, hidden_file_grid].forEach((element) => {
                    element.classList.remove('grid1');
                    element.classList.add('grid');
                });

            }

            folder_grid.innerHTML = '';
            file_grid.innerHTML = '';

            hidden_folder_grid.innerHTML = '';
            hidden_file_grid.innerHTML = '';

            if (localStorage.getItem('sort') === null) {
                sort = 'date';
            } else {
                sort = localStorage.getItem('sort');
            }

            // Loop Files Array
            for (let i = 0; i < dirents.length; i++) {

                let file = dirents[i];
                let card = utilities.getCard(file);

                // let card = getCardGio(file);
                // console.log(file);

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
                        // getFolderSize(file.href);
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

                if (!file.is_writable) {
                    card.classList.add('not-writable')
                }

            }

            main.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
            })

            main.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
            })

            main.addEventListener('drop', (e) => {
                ipcRenderer.send('main', 1);
                this.paste(location.value);
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
                document.removeEventListener('keyup', quickSearch)
            })

            // if (view === 'grid') {
                active_tab_content.append(folder_grid, hidden_folder_grid, file_grid, hidden_file_grid);
                main.append(active_tab_content)
            // }

            // Set Icon Size
            let icon_size = "";
            if (view === 'grid') {
                icon_size = localStorage.getItem('icon_size')
            } else if (view === 'list') {
                icon_size = localStorage.getItem('list_icon_size')
            }
            iconManager.resizeIcons(icon_size);
            slider.value = icon_size;


            viewManager.lazyload();
            sort_cards();

            // clearHighlight();
            main.classList.remove('loader');

            // Drag Select for cards
            utilities.dragSelect();
            utilities.getFolderSizes();

            // utilities.autoComplete();
            // Focus first card
            // let href = cards[0].querySelector('.header a');
            // href.focus();

            console.log('time', (new Date().getTime() - st));
            hide_loader();

        })

        // Edit Mode
        ipcRenderer.on('edit', (e, source) => {

            console.log('running new edit', source)

            let active_tab_content = document.querySelector('.active-tab-content');
            let card = active_tab_content.querySelector(`[data-href="${source}"]`);
            if (card) {

                let href = source;
                let header_link = card.querySelector('a');
                let input = card.querySelector('input');

                header_link.classList.add('hidden');
                input.classList.remove('hidden');

                input.select();
                ipcRenderer.invoke('path:extname', href).then(extname => {
                    input.setSelectionRange(0, input.value.length - extname.length)
                })
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

            }

        })

    }

    // Cut
    cut() {
        this.cut_flag = 1;
        getSelectedFiles();
        selected_files_arr.forEach(item => {
            let active_tab_content = document.querySelector('.active-tab-content');
            let card = active_tab_content.querySelector(`[data-href="${item}"]`);
            card.style = 'opacity: 0.6 !important';
        })
    }

    // Copy
    copy() {
        getSelectedFiles();
    }

    // Move Files
    move(destination) {
        utilities.clearFolderSize(destination);
        ipcRenderer.send('move', destination);
        clear();
    }

    // Past Files
    paste(destination) {
        // console.log('running paste', destination)
        utilities.clearFolderSize(destination);
        ipcRenderer.send('paste', destination);
        clearHighlight();
    }

    // Run Paste Operation for CTRL+V
    pasteOperation() {
        let location = document.querySelector('.location')
        ipcRenderer.send('main', 1);
        if (this.cut_flag) {
            this.move(location.value);
        } else {
            this.paste(location.value);
        }
        this.cut_flag = 0;
    }

    // Edit Mode
    edit() {
        // console.log('running edit');
        let main = document.querySelector('.main');
        let active_tab_content = document.querySelector('.active-tab-content');
        let cards = Array.from(active_tab_content.querySelectorAll('.highlight, .highlight_select'));

        cards.forEach(card => {
            let href = card.dataset.href;
            let header_link = card.querySelector('a');
            let input = card.querySelector('input');

            header_link.classList.add('hidden');
            input.classList.remove('hidden');

            input.select();
            ipcRenderer.invoke('path:extname', href).then(extname => {
                input.setSelectionRange(0, input.value.length - extname.length)
            })
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
    }

    // Delete
    delete() {
        getSelectedFiles();
        if (selected_files_arr.length > 0) {
            ipcRenderer.send('delete', (selected_files_arr));
        }
        clear();
    }

    // New Folder
    newFolder() {
        console.log('running new folder');
        let location = document.querySelector('.location')
        ipcRenderer.send('new_folder', location.value);
    }

    // Call get Properties
    fileInfo() {
        getSelectedFiles();
        ipcRenderer.send('get_properties', selected_files_arr, location.value);
        clear();
    }

    extract() {
        let location = document.getElementById('location');
        getSelectedFiles();
        ipcRenderer.send('extract', location.value);
        clear();
    }

    // Compress Files
    compress(type) {
        let location = document.getElementById('location');
        getSelectedFiles();
        let size = 0;
        size = utilities.getSelectedSize();
        console.log(size)
        ipcRenderer.send('compress', location.value, type, size);
        clear();
    }

}

class DeviceManager {

    get_type (path) {
        let type = '';
        if (path.match('mtp://')) {
            type = 'phone'
        } else if (path.match('sftp://')) {
            type = 'network'
        }
        return type;
    }

    getDevices(callback) {

        let location = document.getElementById('location');
        let devices = document.querySelector('device_view')
        if (!devices) {
            devices = add_div()
            devices.classList.add('device_view')
            devices.append(document.createElement('hr'))
            ipcRenderer.invoke('get_devices').then(device_arr => {

                let connect_btn = add_link('', 'Connect to Server')

                // console.log('running get devices', device_arr)
                device_arr.sort((a, b) => {
                    return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase());
                })

                device_arr.forEach(device => {

                    // console.log(device)

                    let item = add_div();
                    let icon_div = add_div();
                    let href_div = add_div();
                    let umount_div = add_div();

                    item.classList.add('flex');
                    item.style = 'width: 100%;';
                    href_div.classList.add('ellipsis');
                    href_div.style = 'width: 70%';

                    let a = document.createElement('a');
                    a.preventDefault = true;
                    a.href = device.path; //item.href;
                    a.innerHTML = device.name;

                    let umount_icon = add_icon('eject-fill');
                    umount_div.title = 'Unmount Drive'
                    umount_icon.style = 'position: absolute; right: -30px;';
                    item.classList.add('item');

                    if (device.path === '') {

                        // Mount
                        umount_div.classList.add('inactive');
                        umount_div.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            ipcRenderer.send('mount', device)
                        })

                        item.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            let root = device.root;
                            ipcRenderer.send('mount', device)
                        })

                    } else {

                        // Unmount
                        umount_div.addEventListener('click', (e) => {
                            e.stopPropagation();
                            ipcRenderer.send('umount', device.path);
                        })

                        // Get view
                        item.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            if (e.ctrlKey) {
                                viewManager.getView(`${device.path}`, 1);
                            } else {
                                viewManager.getView(`${device.path}`);
                            }
                            navigation.addHistory(device.path);

                        })

                    }

                    let type = this.get_type(device.path);
                    if (type === 'phone') {
                        icon_div.append(add_icon('phone'), a);
                    } else if (type === 'network') {
                        icon_div.append(add_icon('hdd-network'), a);
                    } else {
                        icon_div.append(add_icon('usb-symbol'), a);
                    }

                    item.addEventListener('mouseover', (e) => {
                        item.title = device.path;
                    })

                    item.addEventListener('contextmenu', (e) => {
                        ipcRenderer.send('device_menu', device.path, device.uuid);
                        item.classList.add('highlight_select');
                    })

                    href_div.append(a);
                    umount_div.append(umount_icon);

                    item.append(icon_div, href_div, umount_div);
                    devices.append(item);

                })

                connect_btn.addEventListener('click', (e) => {
                    ipcRenderer.send('connect_dialog');
                })

                devices.append(document.createElement('br'), connect_btn)

                return callback(devices)

            }).catch(err => {
                console.log(err);
            })
        }
    }

}

class WorkspaceManager {

    Workspace () {

    }

    editWorkspace () {

        let workspace = document.querySelector('.workspace');
        console.log(workspace)
        if (workspace) {

            let workspace_item = workspace.querySelector('.workspace_item');
            let workspace_item_input = workspace.querySelector('.input');

            // Edit workspace item
            workspace.addEventListener('keyup', (e) => {

                e.preventDefault();
                e.stopPropagation();

                if (e.key === 'F2') {
                    workspace_item_input.classList.remove('hidden');
                    workspace_item.classList.add('hidden');
                    workspace_item_input.focus();
                }
                if (e.key === 'Escape') {
                    workspace_item_input.classList.add('hidden');
                    workspace_item.classList.remove('hidden');
                }

            })

            workspace_item_input.addEventListener('click', (e) => {
                e.stopPropagation();
            })

            workspace_item_input.addEventListener('change', (e) => {
                ipcRenderer.send('rename_workspace', file.href, e.target.value)
            })

        }

    }

}

// Get reference to File Operations
let fileOperation = new FileOperation();
let viewManager = new ViewManager();
let settings = null;
let settingsManager = null;
let iconManager = null;
let tabManager = null;
let navigation = null;
let utilities = new Utilities();
let workspaceManager = null;

window.addEventListener('DOMContentLoaded', (e) => {
    settingsManager = new SettingsManager();
    iconManager = new IconManager();
    tabManager = new TabManager();
    navigation = new Navigation();
    // utilities = new Utilities();
    settingsManager.getSettings(res => {
        settings = res;
    })

    utilities.autoComplete();
    workspaceManager = new WorkspaceManager();

})

// Get Keyboard shortcuts
async function getShortcuts() {
    return await ipcRenderer.invoke('settings').then(settings => {
        return settings.keyboard_shortcuts;
    })
}

// Expose Functions to index.js file
contextBridge.exposeInMainWorld('api', {
    getSelectedSize: () => {
        return utilities.getSelectedSize();
    },
    getSelectedCount: () => {
        return utilities.getSelectedCount();
    },
    getSelectedCopy: () => {
        return utilities.getSelectedCopy();
    },
    getShortcuts,
    clear,
    getView: (location) => {
        viewManager.getView(location);
    },
    getSelectedFiles,
    cut: () => {
        fileOperation.cut();
    },
    pasteOperation: () => {
        fileOperation.pasteOperation()
    },
    edit: () => {
        fileOperation.edit();
    },
    newFolder: () => {
        fileOperation.newFolder()
    },
    find_files,
    quickSearch,
    newWindow: () => {
        ipcRenderer.send('new_window');
    },
    clearViews,
    sidebarHome,
    fileInfo: () => {
        fileOperation.fileInfo();
    },
    settingsView: () => {
        settingsManager.settingsView();
    },
    extract: () => {
        fileOperation.extract();
    },
    compress: () => {
        fileOperation.compress('tar.gz');
    },
    addWorkspace: () => {
        // Add to Workspace
        getSelectedFiles()
        ipcRenderer.send('add_workspace', selected_files_arr);
        clear()
    },
    goBack: () => {
        let location = document.querySelector('.location')
        ipcRenderer.invoke('dirname', location.value).then(dir => {
            viewManager.getView(dir);
            localStorage.setItem('location', dir);
        })
    }

})

// })

// IPC ///////////////////////////////////////////////////////////////////
/**/

ipcRenderer.on('get_settings', (e) => {
    settingsManager.settingsView();
})

// ipcRenderer.on('switch_view', (e, s_view) => {
//     view = s_view
//     localStorage.setItem('view', view);
//     let location = document.querySelector('.location');
//     viewManager.getView(location.value);
// })

// Merge done
ipcRenderer.on('done_merging_files', (e, merge_err_arr) => {

    let active_tab = document.querySelector('.active-tab-content');
    const table = active_tab.querySelector('.destination_table');
    let msg = active_tab.querySelector('.merge_done_msg');


    if (merge_err_arr.length > 0) {
        let merge_err_div = add_div(['merge_err_div']);
        merge_err_div.classList.add('error');
        merge_err_arr.forEach(item => {
            let merge_err_item = add_div(['merge_err_item']);
            merge_err_item.textContent = item;
            merge_err_div.append(merge_err_item);
        })
        msg.innerHTML = '<i class="bi bi-exclamation-triangle"></i>Done merging files with errors.<br><br>';
        msg.append(merge_err_div);
    } else {
        msg.innerHTML = '<i class="bi bi-info-circle"></i>Done merging files.';
    }

    table.remove();

})

ipcRenderer.on('merge_view', (e, source, destination, copy_merge_arr) => {
    merge(source, destination, copy_merge_arr);
})

ipcRenderer.on('merge_files', (e, merge_arr, is_move) => {

    // console.log('merge arr', merge_arr)

    if (merge_arr.length > 0) {

        const url = './views/merge.html';
        fetch(url).then(res => {
            return res.text();
        }).then(data => {

            // let tm = new TabManager();
            // tm.addTabContent(data)
            tabManager.addTab('Merge');
            let active_content = document.querySelector('.active-tab-content');
            active_content.innerHTML = data;

            // const main = document.querySelector('.main');
            // let tab_content = add_tab('Merge');
            // let active_tab = document.querySelector('.active-tab');
            // tab_content.innerHTML = data

            const table = active_content.querySelector('.destination_table');
            const btn_merge = active_content.querySelector('.btn_merge');

            merge_arr.forEach(item => {

                // console.log('item', item)
                const row = table.insertRow();

                const dest_cell = row.insertCell(0);
                const source_date_cell = row.insertCell(1);
                const destination_date_cell = row.insertCell(2);
                const action_cell = row.insertCell(3);

                dest_cell.classList.add('destination')

                ipcRenderer.invoke('get_icon', item.destination).then(icon => {

                    let dest_div = add_div(['flex'])

                    let img = document.createElement('img');
                    img.classList.add('icon', 'icon16');
                    img.src = icon;

                    // console.log('what', item.content_type);
                    if (item.content_type.indexOf('image/') > -1) {
                        img.src = item.source;
                    }

                    let href = document.createElement('a');
                    href.preventDefault = true;
                    href.href = "#"
                    href.text = item.destination
                    href.title = item.destination
                    href.classList.add('item')

                    // File is not writable
                    if (!item.is_writable) {
                        console.log('not writable');
                        href.classList.add('merge_not_writable');
                    }

                    dest_div.append(img, href);

                    href.addEventListener('click', (e) => {
                        ipcRenderer.send('open', item.destination);
                    })

                    href.addEventListener('contextmenu', (e) => {
                        console.log('running context menu');
                        e.preventDefault();
                        e.stopPropagation();
                        if (item.is_dir) {
                            console.log('merge folder menu', item.source);
                            ipcRenderer.send('merge_folder_menu', item.source);
                        } else {
                            ipcRenderer.send('merge_file_menu', item.source);
                        }
                    })

                    dest_cell.append(dest_div);
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

                        if (!item.is_writable) {
                            action_select.disabled = true;
                        }
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
                ipcRenderer.send('merge_files_confirmed', filter_merge_arr, is_move);
                // console.log(filter_merge_arr)
            })

        }).catch(err => {
            console.log(err);
        })

    } else {
        alert('Files exists and there is nothing to merge!')
    }

})

// Get folder count
ipcRenderer.on('get_folder_count', (e, href) => {
    getFolderCount(href);
})

ipcRenderer.on('get_folder_size', (e, href) => {
    utilities.clearFolderSize(href);
    utilities.getFolderSize(href)
})

// Update thumbnails
ipcRenderer.on('get_thumbnail', (e, href, thumbnail) => {

    let card = document.querySelector(`[data-href="${href}"]`);
    let img = card.querySelector('img');
    img.src = thumbnail
})

// Get icon theme directory
ipcRenderer.invoke('folder_icon').then(icon => {
    folder_icon = icon;
    // console.log('folder_icon', folder_icon)
})

ipcRenderer.invoke('writable_icon').then(icon => {
    // console.log(icon)
    readonly_icon = icon;
})

ipcRenderer.invoke('symlink_icon').then(icon => {
    // console.log(icon)
    symlink_icon = icon;
})

ipcRenderer.on('lazyload', (e) => {
    viewManager.lazyload();
})

// Get Thumbnail directory
ipcRenderer.invoke('get_thumbnails_directory').then(res => {
    // console.log('thumb dir', res)
    thumbnail_dir = res
})

// Get Devices
ipcRenderer.on('get_devices', (e) => {
    // console.log('getting devices');
    const deviceManager = new DeviceManager();
    let device_view = document.querySelector('.device_view');
    deviceManager.getDevices(devices => {
        device_view.innerHTML = '';
        device_view.append(devices);
    })
})

// On Search Results
ipcRenderer.on('search_results', (e, find_arr) => {

    // console.log('getting array');

    let location = document.querySelector('.location');
    // location.value = 'Search Results';

    let folder_grid = add_div(['folder_grid','grid']);
    let hidden_folder_grid = add_div(['hidden_folder_grid', 'grid']);
    let file_grid = add_div(['file_grid', 'grid']);
    let hidden_file_grid = add_div(['hidden_file_grid', 'grid']);

    // let tab_content = add_tab('Search Results');
    // tab_content.append(folder_grid, file_grid);
    tabManager.addTab('Search Results');
    let tab_content = document.querySelector('.active-tab-content');
    tab_content.append(folder_grid, file_grid);

    find_arr.forEach(file => {

        if (file !== undefined) {
            let card = utilities.getCard(file); //getCardGio(file)
            if (file.is_dir === true) {
                if (file.is_hidden) {
                    hidden_folder_grid.append(card);
                } else {
                    folder_grid.append(card);
                }

                // utilities.getFolderSize(file.href)
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

    if (view === 'grid') {
        iconManager.resizeIcons(localStorage.getItem('icon_size'));
    } else if (view === 'list') {
        iconManager.resizeIcons(localStorage.getItem('list_icon_size'));
    }

    viewManager.switchView(localStorage.getItem('view'));
    sort_cards()
    viewManager.lazyload();


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
    // console.log('setting folder size', folder_size)
    let tab_content = document.querySelector('.active-tab-content');
    let folders = tab_content.querySelector('.folder_grid, .hidden_folder_grid');
    let card = folders.querySelector(`[data-href="${source}"]`)
    if (card !== null) {
        card.dataset.size = folder_size;
        let size = card.querySelector('.size')
        card = null;
        size.innerHTML = ''
        size.innerHTML = getFileSize(folder_size);
        localStorage.setItem(source, folder_size);
    }
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
        viewManager.getView(localStorage.getItem('location'))
    }
})

// Properties
ipcRenderer.on('properties', (e, properties_arr) => {

    // clearViews();
    // let sidebar = document.querySelector('.sidebar');
    getProperties(properties_arr, properties_view => {
        // sidebar.append(properties_view);
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
    const deviceManager = new DeviceManager();
    let devices = document.getElementById('devices');
    let device_arr = deviceManager.getDevices();
    devices.innerHTML = device_arr;
})

// Get View
ipcRenderer.on('get_view', (e, href) => {
    let settingsManager = new SettingsManager()
    settingsManager.getSettings(updated_settings => {
        settings = updated_settings;
        console.log(settings)
        viewManager.getView(href);
    })
})

// Get Workspace
ipcRenderer.on('get_workspace', (e) => {
    getWorkspace(workspace => { });
})

// Remove Workspace
ipcRenderer.on('remove_workspace', (e, href) => {
    ipcRenderer.send('remove_workspace', (e, href));
})

// Rename Workspace
ipcRenderer.on('edit_workspace', (e, href) => {
    // Edit workspace
    editWorkspace(href);

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
    viewManager.getView(location.value);
})

// // Connect to Network
// ipcRenderer.on('connect', (e) => {

//     // Init
//     let cmd = '';
//     let connect = document.querySelector('.connect')
//     let chk_pk = document.getElementById('chk_pk')
//     let btn_connect = document.getElementById('button_connect')
//     let btn_close = document.getElementById('button_close')
//     let password = document.getElementById('txt_password')
//     btn_connect.tabIndex = 1

//     connect.addEventListener('keyup', (e) => {
//         if (e.key === 'Escape') {
//             window.close()
//         }
//     })

//     btn_close.onclick = (e) => {
//         window.close()
//     }

//     chk_pk.onchange = () => {
//         if (chk_pk.checked) {
//             password.disabled = true
//         } else {
//             password.disabled = false
//         }
//     }

//     btn_connect.onclick = (e) => {

//         e.preventDefault()

//         // Inputs
//         let state = 0;
//         let conntection_type = document.getElementById('connection_type');
//         let server = document.getElementById('txt_server');
//         let username = document.getElementById('txt_username');
//         let password = document.getElementById('txt_password');
//         let use_ssh_key = document.getElementById('chk_pk');

//         let str_server = "";
//         let use_key = 0;


//         let connect_msg = document.getElementById('connect_msg');
//         connect_msg.innerHTML = `Connecting to ${server.value}`;

//         // Process
//         let inputs = [].slice.call(document.querySelectorAll('.input, .checkbox'))

//         inputs.every(input => {

//             if (input.value == '' && input.disabled == false) {
//                 connect_msg.innerHTML = `${input.placeholder} Required.`, add_br()
//                 state = 0;
//                 return false
//             } else {
//                 state = 1
//                 return true
//             }

//         })

//         // Output
//         if (state == 1) {

//             if (conntection_type.value == 'ssh') {
//                 // cmd = `echo '${password.value}' | gio mount ssh://${username.value}@${server.value}`
//                 str_server = `sftp://${server.value}`
//             } else if (conntection_type.value == 'smb') {
//                 // cmd = `echo '${username.value}\n${'workgroup'}\n${password.value}\n' | gio mount smb://${server.value}`
//                 str_server = `smb://${server.value}`
//             }

//             if (use_ssh_key.checked) {
//                 use_key = 1;
//             }

//             let cmd = {
//                 server: str_server,
//                 username: username.value,
//                 password: password.value,
//                 use_ssh_key: use_key,
//             }

//             ipcRenderer.invoke('connect', cmd).then(res => {
//                 console.log(res)
//                 if (res === 1) {
//                     // console.log('connection success')
//                     connect_msg.style.color = 'green';
//                     connect_msg.innerHTML = `Connected to ${conntection_type[conntection_type.options.selectedIndex].text} Server.`;
//                 } else {
//                     connect_msg.innerHTML = res;
//                 }
//             })

//             // exec(cmd, (err, stdout, stderr) => {
//             //     if (!err) {
//             //         connect_msg.style.color = 'green';
//             //         connect_msg.innerHTML = `Connected to ${conntection_type[conntection_type.options.selectedIndex].text} Server.`;

//             //     } else {
//             //         if (stderr) {
//             //             connect_msg.innerHTML = stderr;
//             //         }
//             //     }
//             // })
//         }
//         // console.log(conntection_type.value);
//     }
// })

// // Connect to network message
// ipcRenderer.on('msg_connect', (e, msg) => {
//     console.log('running msg connect');
//     let connect_msg = document.querySelector('connect_msg');
//     connect_msg.innerHTML = msg;
// })

// Msg
ipcRenderer.on('msg', (e, message, has_timeout) => {
    utilities.msg(message, has_timeout);
})

// Edit mode
// ipcRenderer.on('edit', (e) => {
//     edit();
// })

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

    console.log('running get card gio');

    let active_tab_content = document.querySelector('.active-tab-content');
    let folder_grid = active_tab_content.querySelector('.folder_grid');
    let file_grid = active_tab_content.querySelector('.file_grid');
    let empty_msg = document.querySelector('.empty_msg');

    if (empty_msg) {
        empty_msg.classList.add('hidden');
    }

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
        let card = utilities.getCard(file); //getCardGio(file);
        if (file.is_dir) {

            folder_grid.prepend(card);
            getFolderCount(file.href);
            utilities.getFolderSize(file.href);

        } else {
            console.log('adding file');
            file_grid.prepend(card);
        }
        // viewManager.lazyload();
    }

    utilities.dragSelect();

    if (view === 'grid') {
        iconManager.resizeIcons(localStorage.getItem('icon_size'));
    } else if (view === 'list') {
        iconManager.resizeIcons(localStorage.getItem('list_icon_size'));
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
    let newcard = utilities.getCard(file); //getCardGio(file);
    card.replaceWith(newcard);

    getFolderCount(href);
    utilities.getFolderSize(href);

})

ipcRenderer.on('update_card', (e, href, file) => {

})

// Function to format estimated time as HH:MM:SS
function formatEstimatedTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours === 0) {
        return `${minutes} minute/s ${remainingSeconds} second/s left`;
    } else {
        return `${hours} hour/s and ${minutes} minute/s ${remainingSeconds} second/s left`;
    }

    // return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Set Progress
const progressInstances = new Map();
ipcRenderer.on('set_progress', (e, data) => {

    let progressInstance;

    // Check if an instance with the ID already exists
    if (progressInstances.has(data.id)) {
        progressInstance = progressInstances.get(data.id);
    } else {
        // If not, create a new instance and store it in the Map
        progressInstance = new ProgressManager('.progress_div', data);
        progressInstances.set(data.id, progressInstance);
    }

    // Update the progress for the specific instance
    progressInstance.updateProgress(data);

})

// Context Menu Commands
ipcRenderer.on('context-menu-command', (e, cmd) => {

    let location = document.getElementById('location');

    switch (cmd) {
        case 'rename': {
            fileOperation.edit();
            break;
        }
        case 'mkdir': {
            fileOperation.newFolder()
            break;
        }
        case 'copy': {
            fileOperation.copy();
            break
        }
        case 'paste': {
            fileOperation.paste(location.value);
            break;
        }
        case 'delete': {
            fileOperation.delete();
            break;
        }
        case 'terminal': {

            ipcRenderer.invoke('settings')
                .then(settings => {
                    let cmd = settings.Terminal;
                    let cards = document.querySelectorAll('.highlight, .highlight_select');
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
                    utilities.msg(err);
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
            fileOperation.compress('tar.gz');
            break;
        }
        case 'compress_zip': {
            fileOperation.compress('zip');
            break;
        }
        case 'extract': {
            fileOperation.extract();
            break;
        }
        case 'properties': {
            // getSelectedFiles();
            // ipcRenderer.send('get_properties', selected_files_arr);
            // clear();
            fileOperation.fileInfo();
            break;
        }
        case 'open_templates': {
            ipcRenderer.invoke('get_templates_folder').then(path => {
                viewManager.getView(path, 1)
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
    ipcRenderer.send('get_files_arr_merge', source, destination, copy_merge_arr);
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
                    display: false,
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

    // let tab_content = add_tab('Disk Usage')
    tabManager.addTab('Disk Usage');
    let tab_content = document.querySelector('.active-tab-content');

    // ADD ARRAY
    let chart_labels = []
    let labels = []

    // INFO VIEW
    let view = add_div(['info_view']); //document.getElementById('info_view')
    view.innerHTML = ''
    // view.style = 'background: white;'

    // GRID
    let grid = add_div()
    grid.classList.add('grid2')

    // COMMAND
    // let disks = execSync('df').toString().split('\n');

    ipcRenderer.invoke('df').then(disks => {

        disks_arr = disks.filter(a => { return a !== ''; })

        disks_arr.forEach((disk, i) => {

            // console.log(disk)

            // GRID FOR DATA
            let data_grid = add_div()
            data_grid.classList.add('grid')

            let chart_data = []

            // ADD COLUMN TO GRID
            let col = add_div()
            let card = add_div()
            card.classList.add('drive')

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

    })

    // ADD GRID TO VIEW
    view.append(grid);

    // main.innerHTML = ''
    // main.append(view)
    tab_content.append(view);
    // main.append(tab_content);
    // return callback(view)



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

    grids.forEach((grid, idx) => {
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
                case 'modified_desc': {
                    grid_cards.sort((a, b) => {
                        return b.dataset.mtime - a.dataset.mtime
                    })
                    break;
                }
                case 'modified_asc': {
                    grid_cards.sort((a, b) => {
                        return a.dataset.mtime - b.dataset.mtime
                    })

                    break;
                }
                case 'created_desc': {
                    grid_cards.sort((a, b) => {
                        return b.dataset.mtime - a.dataset.mtime
                    })
                    break;
                }
                case 'created_asc': {
                    grid_cards.sort((a, b) => {
                        return a.dataset.mtime - b.dataset.mtime
                    })

                    break;
                }
                case 'accessed_desc': {
                    grid_cards.sort((a, b) => {
                        return b.dataset.mtime - a.dataset.mtime
                    })
                    break;
                }
                case 'accessed_asc': {
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

            grid_cards.forEach((card, idx1) => {
                grid_item.appendChild(card);
                if (idx ===0 && idx1 === 0) {
                    let href = card.querySelector('a');
                    // console.log(href)
                    // href.focus();

                }
            })

        })

    })

}

function find_files() {

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

        ipcRenderer.invoke('path:join', 'views/find.html').then(path => {

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

                                    ipcRenderer.invoke('find', cmd).then(search_arr => {

                                        if (search_arr.length > 0) {
                                            ipcRenderer.send('search_results', search_arr);
                                            search_info.innerHTML = search_arr.length + ' matches found';
                                        } else {
                                            search_info.innerHTML = '0 matches found';
                                        }

                                        // })
                                        // let child = exec(cmd)
                                        // let search_arr = [];
                                        // child.stdout.on('data', (res) => {
                                        //     data = 1;
                                        //     search_info.innerHTML = ''
                                        //     let files = res.split('\n')
                                        //     search_progress.value = 0
                                        //     search_progress.max = files.length
                                        //     if (files.length > 500) {
                                        //         search_info.innerHTML = 'Please narrow your search.'
                                        //         search_progress.classList.add('hidden')
                                        //         return false;
                                        //     } else {
                                        //         for (let i = 0; i < files.length; i++) {
                                        //             if (files[i] != '') {
                                        //                 ++c

                                        //                 search_arr.push(files[i])
                                        //             }
                                        //         }
                                        //     }
                                        // })
                                        // child.stdout.on('end', (res) => {
                                        //     if (!data) {
                                        //         search_info.innerHTML = '0 matches found';
                                        //     } else {

                                        // console.log('ipc send search results');
                                        // ipcRenderer.send('search_results', search_arr);
                                        // search_info.innerHTML = c + ' matches found';
                                        // }
                                        // search_progress.classList.add('hidden');
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
                .catch(err => {
                    console.log(err)
                })

        })

    }

    // callback(1)

}

function add_img(src) {
    let img = document.createElement('img')
    img.width = 32
    img.src = src
    return img
}

// function extract() {
//     let location = document.getElementById('location');
//     getSelectedFiles();
//     ipcRenderer.send('extract', location.value);
//     clear();
// }

// // Compress Files
// function compress(type) {
//     let location = document.getElementById('location');
//     getSelectedFiles();
//     ipcRenderer.send('compress', location.value, type);
//     clear();
// }

// function resizeIcons(icon_size) {
//     let slider = document.getElementById('slider');
//     let cards = document.querySelectorAll('.card');
//     cards.forEach(card => {
//         if (!card.classList.contains('list')) {
//             let icon = card.querySelector('.icon');
//             icon.style.width = `${icon_size}px`;
//             icon.style.height = `${icon_size}px`;
//         }
//     })
//     slider.value = icon_size;
//     localStorage.setItem('icon_size', icon_size);
// }

ipcRenderer.on('show_loader', (e) => {
    console.log('running show loader')
    show_loader();
})

ipcRenderer.on('hide_loader', (e) => {
    console.log('running hide loader')
    hide_loader();
})

function show_loader() {
    document.body.style.cursor = 'wait';
}

/**
 * Hide Loader
 */
function hide_loader() {
    document.body.style.cursor = 'auto';
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

    console.log('running clear');
    let autocomplete_container = document.querySelector('.autocomplete');
    if (autocomplete_container) {
        autocomplete_container.classList.add('hidden');
    }
    clearHighlight();
    utilities.msg('');

    copy_arr = [];
    selected_files_arr = [];

    // global.gc()

}

// Clear Highlighted Cards
function clearHighlight() {

    let cards = document.querySelectorAll('.highlight, .highlight_select, .highlight_target')
    cards.forEach(item => {
        item.classList.remove('highlight', 'highlight_select', 'highlight_target')
    })
    utilities.msg('');
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
// let tab_id = 0
// function add_tab(href) {
//     ++tab_id;
//     let main = document.querySelector('.main');
//     let location = document.querySelector('.location');
//     let tab_content = add_div(['tab_content']); //document.querySelector('.tab_content');
//     let tab = add_div(['tab']);
//     let tab_container = add_div(['tab_container','flex'])
//     let col1 = add_div(['label']);
//     let col2 = add_div(['tab_close']);
//     let close_btn = document.createElement('i')
//     close_btn.classList.add('bi', 'bi-x')
//     tab_container.append(col1, col2);
//     let tabs = document.querySelector('.tabs');
//     if (!tabs) {
//         tabs = add_div(['tabs', 'sticky']);
//         main.append(tabs);
//     }
//     tab.dataset.href = href;
//     tab.dataset.id = tab_id;
//     tab.title = href;
//     let current_tab_content = document.querySelectorAll('.tab_content');
//     let current_tabs = tabs.querySelectorAll('.tab');
//     col2.append(close_btn);
//     // Handle tab switching
//     tab.addEventListener('click', (e) => {
//         current_tabs = tabs.querySelectorAll('.tab');
//         current_tab_content = document.querySelectorAll('.tab_content')
//         current_tabs.forEach((current_tab, i) => {
//             current_tab.classList.remove('active-tab');
//             current_tab_content[i].classList.remove('active-tab-content')
//             current_tab_content[i].classList.add('hidden');
//         })

//         tab.classList.add('active-tab');
//         tab_content.classList.add('active-tab-content');
//         tab_content.classList.remove('hidden');
//         location.value = tab.dataset.href
//     })
//     current_tabs.forEach((current_tab, i) => {
//         let current_label = current_tab.querySelector('.label');
//         if (current_label.dataset.href === href) {
//             label_exist = 1
//         } else {
//             current_tab.classList.remove('active-tab');
//             current_tab_content[i].classList.remove('active-tab-content')
//             current_tab_content[i].classList.add('hidden');
//         }
//     })
//     tab.classList.add('active-tab');
//     tab_content.classList.remove('hidden');
//     tab_content.classList.add('active-tab-content');
//     ipcRenderer.invoke('basename', href).then(basename => {
//         col1.append(basename);
//     })
//     tab.append(tab_container);
//     tabs.append(tab);
//     main.append(tab_content);
//     // Handle closing tabs
//     col2.addEventListener('click', (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         let active_tab = document.querySelector('.active-tab');
//         if (active_tab == tab) {
//             if (current_tabs.length > 0) {
//                 let tabs = document.querySelectorAll('.tab')
//                 let idx = Array.from(tabs).indexOf(tab) - 1
//                 if (idx >= 0) {
//                     tab.remove();
//                     tab_content.remove();
//                     current_tabs[idx].classList.add('active-tab');
//                     current_tab_content[idx].classList.add('active-tab-content');
//                     current_tab_content[idx].classList.remove('hidden');
//                     location.value = current_tabs[idx].dataset.href;
//                 }
//             }
//         } else {
//             if (current_tabs.length > 0) {
//                 tab.remove();
//                 tab_content.remove();
//             }
//         }
//     })
//     return tab_content;
// }

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
// let timeout_id;
// function msg(message, has_timeout) {

//     if (has_timeout === undefined || has_timeout === null) {
//         has_timeout = 1;
//     }

//     console.log(message, has_timeout)

//     let main = document.querySelector('.main');
//     let msg = document.querySelector('.msg');
//     if (!msg) {
//         msg = add_div(['msg', 'bottom']);
//         main.append(msg);
//     }

//     msg.innerHTML = '';
//     msg.classList.remove('hidden');
//     if (message === '') {
//         msg.classList.add('hidden');
//     }

//     if (message.toString().toLocaleLowerCase().indexOf('error') > -1) {
//         msg.classList.add('error')
//     } else {
//         msg.classList.remove('error')
//     }

//     msg.innerHTML = message;

//     if (has_timeout === 1) {
//         console.log('wtf', has_timeout)
//         timeout_id = setTimeout(() => {
//             msg.classList.add('hidden');
//         }, 5000);
//     } else {
//         clearTimeout(timeout_id);
//     }

// }

/**
 *
 * @param {int} fileSizeInBytes
 * @returns
 */
function getFileSize(fileSizeInBytes) {
    // console.log(fileSizeInBytes);
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
function getDateTime(date) {
    try {
        var d = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date * 1000));
        return d;
    } catch (err) {
        // // console.log('gio getDateTime Format error')
    }
}

function getMappedPermissions(permissionValue) {
    const symbolicMap = {
        0: 'None', //'---',
        1: '--x',
        2: '-w-',
        3: '-wx',
        4: 'Read-Only', // 'r--',
        5: 'Access Files', //r-x
        6: 'Read and Write', //'rw-',
        7: 'Create and Delete Files' //'rwx'
    };
    return symbolicMap[permissionValue];
}

function getPermissions(unixMode) {

    // const special = unixMode & 0xF000;
    const user = (unixMode >> 6) & 0x7;
    const group = (unixMode >> 3) & 0x7;
    const other = unixMode & 0x7;

    // let p_arr = []
    // p_arr.push(user)
    // p_arr.push(group)
    // p_arr.push(other)

    // return p_arr;

    return {
        // special: special.toString(8),
        owner: user.toString(8),
        group: group.toString(8),
        other: other.toString(8)
    };
}

// Sidebar Functions /////////////////////////////////////////////////////////////

// Get Properties View
function getProperties(properties_arr) {

    // Check if properties tab exists
    // let tab_exists = 0;
    // let tabs = document.querySelectorAll('.tab')
    // tabs.forEach(tab => {
    //     let label = tab.querySelector('.label')
    //     if (label.innerText === 'Properties') {
    //         tab_exists = 1;
    //         return;
    //     }
    // })

    // if (!tab_exists) {
    tabManager.addTab('Properties')
    // }
    let tab_content = document.querySelector('.active-tab-content');
    console.log(tab_content)

    let properties_div = add_div();
    // tab_content.append(properties_div);

    ipcRenderer.invoke('path:join', 'views/properties.html').then(path => {
        fetch(path).then(res => {
            return res.text()
        }).then(html => {

            properties_div.innerHTML = html;

            let properties_view = document.querySelector('.properties_view');
            let properties_content = document.querySelector('.properties_content');
            let permissions_container = document.querySelector('.permissions_container');

            // let tabs = properties_view.querySelectorAll('.properties-tab');
            // let tabs_content = properties_view.querySelectorAll('.properties-tab-content');
            // tabs.forEach((tab, idx) => {
            //     tab.addEventListener('click', (e) => {

            //         tabs.forEach((tab, idx1) => {

            //             if (idx === idx1) {
            //                 tabs[idx1].classList.add('active-properties-tab');
            //                 tabs_content[idx1].classList.remove('hidden')
            //             } else {
            //                 tabs[idx1].classList.remove('active-properties-tab');
            //                 tabs_content[idx1].classList.add('hidden')
            //             }

            //         })

            //     })
            // })

            properties_arr.forEach(file => {

                let properties_div1 = add_div();
                let basic_content = add_div();
                let permissions_content = add_div();

                properties_div1.classList.add('properties', 'grid2');
                basic_content.classList.add('basic');
                permissions_content.classList.add('permissions');

                properties_div1.append(basic_content, permissions_content);
                // properties_content.append(properties_div1);
                tab_content.append(properties_div1);

                // Basic Tab
                let card = add_div();
                let content = add_div();

                card.dataset.properties_href = file.href;

                console.log(file)

                let close_btn = add_div();
                let close_icon = document.createElement('i');
                close_icon.classList.add('bi', 'bi-x');
                close_btn.classList.add('float', 'right', 'pointer');
                close_btn.append(close_icon);
                // card.append(close_btn);
                close_btn.addEventListener('click', (e) => {
                    card.remove()
                    let cards = document.querySelectorAll('.properties')
                    if (cards.length === 0) {
                        clearViews()
                        sidebarHome();
                    }
                })

                content.classList.add('content');
                card.classList.add('properties');

                let icon = add_div();
                icon.classList.add('icon');
                card.append(icon);

                content.append(add_item('Name:'), add_item(file.name));

                let folder_count = add_div();
                folder_count.classList.add('item', 'folder_count');

                let size = add_div();
                size.classList.add('size');
                // size.append('Calculating..');

                content.append(add_item('Type:'), add_item(file.content_type));
                content.append(add_item(`Contents:`), folder_count);

                let location = add_item(file.location);
                location.title = file.location;

                content.append(add_item('Location:'), location);

                if (file.is_dir) {

                    icon.append(add_img(folder_icon + `folder.svg`))
                    content.append(add_item('Size:'), add_item(size));

                    if (file.is_readable) {

                        size.append('Calculating..');
                        folder_count.append('Calculating..');
                        ipcRenderer.send('get_folder_count', file.href);
                        ipcRenderer.invoke('get_folder_size_properties', file.href).then(res => {
                            size.innerHTML = getFileSize(res);
                        })

                    } else {

                        size.append('Unknown')
                        folder_count.append('Unknown')

                    }


                } else {

                    folder_count.append('1');
                    content.append(add_item('Size:'), add_item(getFileSize(file.size)));

                    ipcRenderer.invoke('get_icon', (file.href)).then(res => {

                        if (file.content_type.indexOf('image/') > -1) {
                            icon.append(add_img(file.href));
                        } else {
                            icon.append(add_img(res));
                        }
                    })

                }

                content.append(add_item(`Modified:`), add_item(getDateTime(file.mtime)));
                content.append(add_item(`Accessed:`), add_item(getDateTime(file.atime)));
                content.append(add_item(`Created:`), add_item(getDateTime(file.ctime)));

                card.append(content);
                basic_content.append(card)

                // if (file.is_dir) {

                //     icon.append(add_img(folder_icon))
                //     ipcRenderer.send('get_folder_count', file.href);
                //     ipcRenderer.send('get_folder_size', file.href);

                // } else {
                //     ipcRenderer.invoke('get_icon', (file.href)).then(res => {

                //         if (file.content_type.indexOf('image/') > -1) {
                //             // .src = item.source;
                //             icon.append(add_img(file.href));
                //         } else {
                //             icon.append(add_img(res));
                //         }
                //     })
                // }



                // Permissions Tab
                let permissions = getPermissions(file.permissions);
                let rows = ['Owner', 'Access', 'Group', 'Access', 'Other', 'Access']
                let perm_key;

                if (!file.is_dir) {
                    rows.push('Execute')
                }

                for (let i = 0; i < rows.length; i++) {

                    let row = add_div(['flex', 'row']);
                    for (let ii = 0; ii < 2; ii++) {
                        let col = add_div();
                        if (ii == 0) {
                            col.classList.add('td');
                            col.append(rows[i]);
                        } else {
                            if (i % 2 === 0) {
                                perm_key = rows[i].toLowerCase();
                                if (file[perm_key]) {
                                    col.append(file[perm_key]);
                                }
                            } else {
                                col.append(getMappedPermissions(permissions[perm_key]));
                            }

                            if (rows[i] === 'Execute' && !file.is_dir) {

                                let chk_execute = document.createElement('input');
                                let label_execute = document.createElement('label');

                                label_execute.innerText = ' Allow executing file as program';
                                label_execute.htmlFor = 'chk_execute';

                                chk_execute.id = 'chk_execute';
                                chk_execute.type = 'checkbox';
                                col.append(chk_execute, label_execute);

                                if (file.is_execute) {
                                    chk_execute.checked = true;
                                }

                                chk_execute.addEventListener('click', (e) => {
                                    if (chk_execute.checked) {
                                        ipcRenderer.send('set_execute', file.href);
                                    } else {
                                        ipcRenderer.send('clear_execute', file.href);
                                    }
                                })

                            }
                        }

                        row.append(col);
                    }

                    if (i % 2 === 1) {
                        row.append(document.createElement('br'));
                    }
                    permissions_content.append(row);
                }

            })

        }).catch(err => {
            console.log(err)
        })
    })



}

// Get Recent View
function getRecentView(dirents) {

    let location = document.querySelector('.location')
    location.value = 'Recent'

    let folder_grid = add_div(['folder_grid']);
    let file_grid = add_div(['file_grid']);

    tabManager.addTab('Recent');
    let tab_content = document.querySelector('.active-tab-content');

    dirents.sort((a, b) => {
        return b.atime - a.atime
    })

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

                let card = utilities.getCard(file); //getCardGio(file);
                folder_grid.append(card)

            }

            getFolderCount(file.href);
            utilities.getFolderSize(file.href);

        } else {

            if (file_counter < 20) {
                ++folder_counter;
                if (add_file_label === 1) {
                    add_file_label = 0;
                }
            }

            let card = utilities.getCard(file); //getCardGio(file);
            file_grid.append(card);
        }

    })

    tab_content.append(folder_grid, file_grid)
    localStorage.setItem('location', 'Recent');

    if (view === 'grid') {
        iconManager.resizeIcons(localStorage.getItem('icon_size'));
    } else if (view === 'list') {
        listManager.resizeIcons(localStorage.getItem('list_icon_size'));
    }
    viewManager.lazyload();

    viewManager.switchView(localStorage.getItem('view'));

}

// // Get Settings View
// function getSettings() {

//     tabManager.addTab('Settings');
//     let tab_content = document.querySelector('.active-tab-content');
//     ipcRenderer.invoke('path:join', 'views/settings.html').then(path => {

//         fetch(path)
//             .then(res => {
//                 return res.text();
//             })
//             .then(settings_html => {

//                 tab_content.innerHTML = settings_html;
//                 ipcRenderer.invoke('settings')
//                     .then(res => res)
//                     .then(settings => settingsForm(settings))
//                     .catch(error => console.error('Error:', error))

//             })
//             .catch(err => {
//                 console.log(err)
//             })

//     })

// }

// let obj_key;
// function settingsForm(settings) {

//     const form = document.querySelector('.settings_view');

//     // Object.keys(settings.Terminal).forEach(key => {
//     //     console.log(settings)
//     // })

//     Object.keys(settings).forEach(key => {

//         const value = settings[key];
//         if (typeof value === 'object') {
//             let header = document.createElement('h4');
//             let hr = document.createElement('hr')

//             header.classList.add('header');

//             header.innerHTML = `${key.charAt(0).toUpperCase()}${key.slice(1)}`; //key.toUpperCase();
//             form.append(hr, header);
//             settingsForm(value);
//         } else {

//             // console.log(typeof value)
//             let settings_item = add_div(['settings_item']);

//             // Create input field for non-nested properties
//             const label = document.createElement('label');
//             label.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}:`;
//             let input;
//             if (typeof value === 'boolean') {
//                 // For boolean values, create a checkbox
//                 input = document.createElement('input');
//                 input.type = 'checkbox';
//                 input.name = key;
//                 input.checked = value;
//                 settings_item.append(label, input);
//             } else {
//                 // For other types (string, number), create a text input
//                 if (key === 'Description') {
//                     input = add_div();
//                     input.innerHTML = value
//                 } else {
//                     input = document.createElement('input');
//                     input.type = 'text';
//                     input.name = key;
//                     input.id = key;
//                     input.value = value;

//                     switch (key.toLocaleLowerCase()) {
//                         case 'theme': {
//                             // console.log('running theme')
//                             input = document.createElement('select');
//                             let options = ['Light', 'Dark']
//                             options.forEach((option, i) => {
//                                 let option_select = document.createElement('option');
//                                 option_select.text = option
//                                 option_select.value = option
//                                 input.append(option_select);

//                                 if (option.toLocaleLowerCase() === value.toLocaleLowerCase()) {
//                                     option_select.selected = true
//                                 }
//                             })

//                             // console.log('selecting ', value)


//                             input.addEventListener('change', (e) => {
//                                 ipcRenderer.send('change_theme', input.value);
//                                 ipcRenderer.send('update_settings', key, input.value)
//                             })

//                             settings_item.append(label, input)
//                             break;
//                         }
//                         case 'terminal': {
//                             input.addEventListener('change', (e) => {
//                                 ipcRenderer.send('update_settings', key, input.value)
//                             })
//                             settings_item.append(label, input);
//                             break;
//                         }
//                         case 'disk utility': {
//                             input.addEventListener('change', (e) => {
//                                 ipcRenderer.send('update_settings', key, input.value)
//                             })
//                             settings_item.append(label, input);
//                             break;
//                         }
//                         default: {
//                             settings_item.append(label, input);
//                             input.disabled = true;
//                             break;
//                         }

//                     }
//                 }
//             }

//             // settings_item.append(label, input);
//             form.appendChild(settings_item);

//         }

//     });

//     for (let setting in settings.keyboard_shortcuts) {
//         let input = document.getElementById(`${setting}`)

//         input.addEventListener('change', (e) => {
//             // Need some Input validation
//             ipcRenderer.send('update_settings', setting, input.value)
//         })
//     };

// }

function sidebarHome() {

    let mb = document.getElementById('mb_home');
    mb.classList.add('active');

    const deviceManager = new DeviceManager();

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
            // sb_home.append(document.createElement('br'));
            sb_home.append(workspace)
        })

        // Get Device
        deviceManager.getDevices(devices => {
            // sb_home.append(document.createElement('br'));
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
    // home.append(add_header('Home'))
    // home.append(document.createElement('hr'))

    // Get home
    for (let i = 0; i < my_computer_arr.length; i++) {

        let href = my_computer_paths_arr[i];
        let item = add_div();

        item.classList.add('item');

        let link = add_link(my_computer_paths_arr[i], my_computer_arr[i]);
        item.append(add_icon(my_computer_icons_arr[i].toLocaleLowerCase()), link);
        home.append(item);

        // item.title = link.href.replace('file://', '');
        ipcRenderer.invoke('nav_item', my_computer_paths_arr[i]).then(nav_path => {
            item.title = nav_path;
            item.dataset.href = nav_path;
        })

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
                        viewManager.getView(nav_path, 1);
                    } else {
                        viewManager.getView(nav_path);
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

        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            item.classList.add('highlight_select');
            ipcRenderer.invoke('nav_item', my_computer_paths_arr[i]).then(nav_path => {
                ipcRenderer.send('sidebar_menu', nav_path);
            })

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
        // workspace.append(add_header('Workspace'));
        workspace.append(document.createElement('hr'))

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

            let workspace_div = add_div(['flex', 'item', 'workspace_div'])
            let workspace_item = add_div(['workspace_item']);
            let workspace_item_input = document.createElement('input');
            let img = document.createElement('img')

            img.classList.add('icon', 'icon16')
            let a = document.createElement('a');
            a.href = file.href;
            a.innerHTML = file.name;
            a.preventDefault = true;
            workspace_item_input.classList.add('input', 'hidden');

            workspace_div.dataset.href = file.href;
            workspace_item_input.value = file.name;

            if (file.content_type === 'inode/directory') {
                img.src = folder_icon + 'folder.svg';
                workspace_item.append(a);
                workspace_div.append(img, workspace_item, workspace_item_input);
            } else {
                ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                    img.src = res;
                    workspace_item.append(a);
                    workspace_div.append(img, workspace_item, workspace_item_input);
                    // workspace_item.append(img, a);
                })
            }

            workspace_div.addEventListener('mouseover', (e) => {
                workspace_div.title = `${file.href} \n Rename (F2)`;
                a.focus();
            })

            // Show Workspace Context Menu
            workspace_div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                ipcRenderer.send('workspace_menu', file);
                workspace_div.classList.add('highlight');
            });

            // Open Workspace Item
            workspace_div.addEventListener('click', (e) => {

                e.preventDefault();
                e.stopPropagation();

                if (file.is_dir) {
                    if (e.ctrlKey) {
                        viewManager.getView(file.href, 1);
                    } else {
                        viewManager.getView(file.href);
                    }
                } else {
                    ipcRenderer.send('open', file.href);
                }

            })

            // Edit workspace item
            workspace_div.addEventListener('keyup', (e) => {

                e.preventDefault();
                e.stopPropagation();

                if (e.key === 'F2') {
                    workspace_item_input.classList.remove('hidden');
                    workspace_item.classList.add('hidden');
                    workspace_item_input.focus();
                    workspace_item_input.select();
                }
                if (e.key === 'Escape') {
                    workspace_item_input.classList.add('hidden');
                    workspace_item.classList.remove('hidden');
                }

            })

            workspace_item_input.addEventListener('click', (e) => {
                e.stopPropagation();
            })

            workspace_item_input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    ipcRenderer.send('rename_workspace', file.href, e.target.value)
                }
            })

            // workspace_item.append(img, a);
            workspace.append(workspace_div);

        })
        return callback(workspace);

    })
}

function editWorkspace (href) {

    let workspace = document.getElementById('workspace');
    let workspace_div = workspace.querySelector(`[data-href="${href}"]`);
    let workspace_item = workspace_div.querySelector('.workspace_item');
    let workspace_item_input = workspace_div.querySelector('.input');

    // Edit workspace item
    workspace_item_input.classList.remove('hidden');
    workspace_item.classList.add('hidden');
    workspace_item_input.focus();
    workspace_item_input.select();

}

// Get Devices
// function getDevices(callback) {

//     let location = document.getElementById('location');
//     let devices = document.querySelector('device_view')
//     if (!devices) {
//         devices = add_div()
//         devices.classList.add('device_view')
//         // devices.append(add_header('Devices'));
//         devices.append(document.createElement('hr'))
//         ipcRenderer.invoke('get_devices').then(device_arr => {

//             let connect_btn = add_link('#', 'Connect to Server')

//             // console.log('running get devices', device_arr)
//             device_arr.sort((a, b) => {
//                 return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase());
//             })

//             device_arr.forEach(device => {

//                 console.log(device)

//                 let item = add_div();
//                 let icon_div = add_div();
//                 let href_div = add_div();
//                 let umount_div = add_div();

//                 item.classList.add('flex');
//                 item.style = 'width: 100%;';
//                 href_div.classList.add('ellipsis');
//                 href_div.style = 'width: 70%';

//                 let a = document.createElement('a');
//                 a.preventDefault = true;
//                 a.href = device.path; //item.href;
//                 a.innerHTML = device.name;

//                 let umount_icon = add_icon('eject-fill');
//                 umount_div.title = 'Unmount Drive'
//                 umount_icon.style = 'position: absolute; right: -30px;';
//                 item.classList.add('item');

//                 if (device.path === '') {

//                     // Mount
//                     umount_div.classList.add('inactive');
//                     umount_div.addEventListener('click', (e) => {
//                         e.preventDefault();
//                         e.stopPropagation();
//                         ipcRenderer.send('mount', device)
//                     })

//                     item.addEventListener('click', (e) => {
//                         e.preventDefault();
//                         e.stopPropagation();
//                         let root = device.root;
//                         ipcRenderer.send('mount', device)
//                     })

//                 } else {

//                     // Unmount
//                     umount_div.addEventListener('click', (e) => {
//                         e.stopPropagation();
//                         ipcRenderer.send('umount', device.path);
//                     })

//                     // Get view
//                     item.addEventListener('click', (e) => {
//                         e.preventDefault();
//                         e.stopPropagation();
//                         // console.log('device path', device.path)
//                         getView(`${device.path}`);
//                         navigation.addHistory(device.path);

//                     })

//                 }

//                 if (item.type == 0) {
//                     icon_div.append(add_icon('usb-symbol'), a);
//                     // item.append(add_icon('usb-symbol'), a);
//                 } else {
//                     icon_div.append(add_icon('usb-symbol'), a);
//                     // item.append(add_icon('hdd-network'), a);
//                 }

//                 item.addEventListener('mouseover', (e) => {
//                     item.title = device.path;
//                 })

//                 item.addEventListener('contextmenu', (e) => {
//                     ipcRenderer.send('device_menu', device.path, device.uuid);
//                     item.classList.add('highlight_select');
//                 })

//                 href_div.append(a);
//                 umount_div.append(umount_icon);

//                 item.append(icon_div, href_div, umount_div);
//                 devices.append(item);

//             })

//             connect_btn.addEventListener('click', (e) => {
//                 ipcRenderer.send('connect_dialog');
//             })

//             devices.append(document.createElement('br'), connect_btn)

//             return callback(devices)

//         }).catch(err => {
//             console.log(err);
//         })
//     }
// }

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
    let selected_items = Array.from(active_tab_content.querySelectorAll('.highlight, .highlight_select'));
    selected_items.forEach(item => {
        // console.log(item)
        selected_files_arr.push(item.dataset.href);
        // selected_files_arr.push(item.dataset.search_href);
    })
    if (selected_files_arr.length == 1) {
        // utilities.msg(`${selected_files_arr.length} Item Selected`);
        utilities.getSelectedCopy();
    } else if (selected_files_arr.length > 1) {
        // utilities.msg(`${selected_files_arr.length} Items Selected`);
        utilities.getSelectedCopy();
    } else {
        utilities.msg(`No Items Selected`);
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

// Get Folder Count
function getFolderCount(href) {
    // console.log('running get folder count', href)
    ipcRenderer.send('count', href);
}

/**
 * Get Grid View
 * @param {*} dir
 * @param {*} callback
 */

function clearContextMenu(e) {
    const isInsideContextMenu = e.target.closest('.context-menu');
    if (!isInsideContextMenu) {
        let selected_items = document.querySelectorAll('.highlight, .highlight_select');
        selected_items.forEach(item => {
            item.classList.remove('highlight_select')
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

// function lazyload() {
//     // Lazy load images
//     let lazyImages = [].slice.call(document.querySelectorAll(".lazy"))
//     // CHECK IF WINDOW
//     if ("IntersectionObserver" in window) {
//         // GET REFERENCE TO LAZY IMAGE
//         let lazyImageObserver = new IntersectionObserver(function (entries, observer) {
//             // console.log('entries', entries.length)
//             entries.forEach((e, idx) => {
//                 if (e.isIntersecting) {

//                     let img = e.target;
//                     img.src = img.dataset.src;
//                     // let exists = fs.existsSync(thumbnail);
//                     // if (exists) {
//                     //     console.log(thumbnail)
//                     //     img.src = thumbnail;
//                     // } else {
//                     //     // ipcRenderer.send('create_thumbnail', img.dataset.src, thumbnail);
//                     //     img.src = img.dataset.src;
//                     // }

//                     img.classList.remove("lazy");
//                     lazyImageObserver.unobserve(img);
//                 }
//             })
//         })
//         // THIS RUNS ON INITIAL LOAD
//         for (let i = 0; i < lazyImages.length; i++) {
//             lazyImageObserver.observe(lazyImages[i])
//         }
//     }
// }

function quickSearch(e) {
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

            let c = 0;
            let cards = document.querySelectorAll('.card')
            cards.forEach(card => {
                if (card.dataset.href.toLocaleLowerCase().indexOf(txt_quicksearch.value) > -1) {
                    card.classList.add('highlight');
                    if (c === 0) {
                        let href = card.querySelector('.header a');
                        href.focus();
                    }
                    ++c;
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

        let location = document.querySelector('.location');
        let main = document.querySelector('.main');
        let sidebar = document.querySelector('.sidebar');
        let slider = document.getElementById('slider');
        let header_menu = document.querySelectorAll('.menu_bar');
        let nav_menu = document.querySelector('.nav_menu');
        let settings = document.querySelectorAll('.settings');

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
                        mb_item.classList.add('active')
                        find_files(res => { })
                        break;
                    }
                    case 'mb_info': {
                        let properties_view = document.querySelector('.properties_view');
                        properties_view.classList.remove('hidden')
                        mb_item.classList.add('active')
                        break;
                    }
                }
                sidebar.classList.remove('hidden');
            })
        })

        ipcRenderer.send('get_settings');

        // Local Storage //////////////////////////////////////////////
        // Handle Location
        if (localStorage.getItem('location') !== null) {
            location.value = localStorage.getItem('location');
        } else {

            ipcRenderer.invoke('home').then(home => {
                location.value = home;
                viewManager.getView(location.value);
                localStorage.setItem('location', location.value);
            })

        }

        // Load view on reload
        if (location.value != "") {
            switch (location.value) {
                case 'Recent': {
                    ipcRenderer.send('get_recent_files');
                    break;
                }
                case 'Settings': {
                    // todo: review this is de funked
                    getSettings();
                    break;
                }
                default: {
                    viewManager.getView(location.value)
                    navigation.addHistory(location.value);
                    break;
                }
            }
        }

        // Change Location on change
        location.onchange = () => {
            if (location.value != "") {
                viewManager.getView(location.value)
            }
        }

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
        nav_items.forEach(nav_item => {
            nav_item.addEventListener('click', (e) => {
                e.preventDefault();
                let dir = nav_item.innerText.replace(' ', '');
                if (dir === 'Home') { dir = '' }
                ipcRenderer.invoke('nav_item', dir).then(path => {
                    location.value = path;
                    if (e.ctrlKey) {
                        viewManager.getView(path, 1);
                    } else {
                        viewManager.getView(path);
                    }
                    navigation.addHistory(path);
                })
            })
        })

        // List view
        let list_view = document.querySelectorAll('.list_view');
        list_view.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                view = 'list';
                localStorage.setItem('view', view);

                location = document.querySelector('.location');

                // viewManager.getView(location.value);
                viewManager.switchView('list');

            })
        })

        // Grid view
        let grid_view = document.querySelectorAll('.grid_view');
        grid_view.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                view = 'grid';
                localStorage.setItem('view', view);

                location = document.querySelector('.location');

                // viewManager.getView(location.value);
                viewManager.switchView('grid');

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

        // Settings
        settings.forEach(btn_settings => {
            btn_settings.addEventListener('click', (e) => {
                const settingsManager = new SettingsManager();
                settingsManager.settingsView();
            })
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

        ipcRenderer.invoke('settings').then(res => {

            shortcut = res.keyboard_shortcuts;

        }).then(() => {

            // Delete
            // mt.bind(shortcut.Delete.toLocaleLowerCase(), (e) => {
            //     e.preventDefault();
            //     getSelectedFiles();
            //     if (selected_files_arr.length > 0) {
            //         ipcRenderer.send('delete', (selected_files_arr));
            //     }
            //     clear();
            // })
            // Escape (Cancel)
            // mt.bind(shortcut.Escape.toLocaleLowerCase(), (e) => {
            //     // Clear Arrays and selected items
            //     clear();
            // })
            // // Reload
            // mt.bind(shortcut.Reload.toLocaleLowerCase(), (e) => {
            //     getView(location.value)
            // })
            // // Edit
            // mt.bind(shortcut.Rename.toLocaleLowerCase(), (e) => {
            //     edit();
            // })
            // // Ctrl+C (Copy)
            // mt.bind(shortcut.Copy.toLocaleLowerCase(), (e) => {
            //     getSelectedFiles();
            // })
            // Ctrl+X (Cut)
            // mt.bind(shortcut.Cut.toLocaleLowerCase(), (e) => {
            //     cut_flag = 1;
            //     getSelectedFiles();
            //     selected_files_arr.forEach(item => {
            //         let active_tab_content = document.querySelector('.active-tab-content');
            //         let card = active_tab_content.querySelector(`[data-href="${item}"]`);
            //         card.style = 'opacity: 0.6 !important';
            //     })
            // })
            // Ctrl+V (Paste)
            // mt.bind(shortcut.Paste.toLocaleLowerCase(), (e) => {
            //     ipcRenderer.send('main', 1);
            //     if (cut_flag) {
            //         utils.move(location.value);
            //     } else {
            //         paste(location.value);
            //     }
            //     cut_flag = 0;
            // })
            // // Show / Hide Sidebar
            // mt.bind(shortcut.ShowSidebar.toLocaleLowerCase(), (e) => {
            //     if (sidebar.classList.contains('hidden')) {
            //         sidebar.classList.remove('hidden');
            //         localStorage.setItem('sidebar', 1);
            //     } else {
            //         sidebar.classList.add('hidden');
            //         localStorage.setItem('sidebar', 0);
            //     }
            // })
            // // Find
            // mt.bind(shortcut.Find.toLocaleLowerCase(), (e) => {
            //     // getSearch();
            //     find_files(res => {})
            // })
            // // Quick Search
            // mt.bind(shortcut.QuickSearch.toLowerCase(), (e) => {
            //     quickSearch(e);
            // })
            // // New Window
            // mt.bind(shortcut.NewWindow.toLocaleLowerCase(), (e) => {
            //     ipcRenderer.send('new_window');
            // })
            // // Show Home View Sidebar
            // mt.bind(shortcut.ShowHome.toLocaleLowerCase(), (e) => {
            //     clearViews();
            //     sidebarHome();
            // })

            // // Get File Info
            // mt.bind(shortcut.Properties.toLocaleLowerCase(), (e) => {
            //     getSelectedFiles();
            //     ipcRenderer.send('get_properties', selected_files_arr, location.value);
            //     selected_files_arr = [];
            // })

            // // Select All
            // mt.bind(shortcut.SelectAll.toLocaleLowerCase(), (e) => {
            //     e.preventDefault();
            //     let cards = main.querySelectorAll('.card')
            //     cards.forEach(item => {
            //         item.classList.add('highlight');
            //     })
            // })
            // // Go Back
            // mt.bind(shortcut.Backspace.toLocaleLowerCase(), (e) => {
            //     ipcRenderer.invoke('dirname', location.value).then(dir => {
            //         // console.log('dir', dir)
            //         // location.value = location.value.replace(dir, '');
            //         getView(dir);
            //         localStorage.setItem('location', dir);
            //     })
            //     // ipcRenderer.invoke('basename', location.value).then(basename => {
            //     //     location.value = basename;
            //     //     getView(location.value);
            //     // })
            //     // localStorage.setItem('location', location.value);
            // })
            // // Add to Workspace
            // mt.bind(shortcut.AddWorkspace.toLocaleLowerCase(), (e) => {
            //     getSelectedFiles()
            //     ipcRenderer.send('add_workspace', selected_files_arr);
            //     clear()
            // })
            // // New Folder
            // mt.bind(shortcut.NewFolder.toLocaleLowerCase(), (e) => {
            //     ipcRenderer.send('new_folder', location.value);
            // })
            // // Show settings
            // mt.bind(shortcut.ShowSettings.toLocaleLowerCase(), (e) => {
            //     getSettings();
            // })
            // // Extract Compressed Files
            // mt.bind(shortcut.Extract.toLocaleLowerCase(), (e) => {
            //     extract();
            // })
            // // Compress Files
            // mt.bind(shortcut.Compress.toLocaleLowerCase(), (e) => {
            //     compress();
            // })
            // // New Tav
            // mt.bind(shortcut.NewTab.toLocaleLowerCase(), (e) => {
            //     getView(location.value, 1);
            // })
            // mt.bind(shortcut.Down.toLocaleLowerCase(), (e) => {
            //     console.log('down')
            // })

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
                    init_size += 8
                    iconManager.resizeIcons(init_size);
                    // localStorage.setItem('icon_size', init_size);
                    // console.log("scrolling up", init_size)
                }
            } else if (e.ctrlKey && e.deltaY > 0) {
                if ((init_size) > 16) {
                    init_size -= 8
                    iconManager.resizeIcons(init_size);
                    // localStorage.setItem('icon_size', init_size);
                    // console.log("scrolling up", init_size)
                }
            }
        })

        slider.addEventListener('change', (e) => {
            init_size = slider.value;
            iconManager.resizeIcons(init_size);
            // localStorage.setItem('icon_size', init_size);
        })

        sidebarHome();

        // INITIALIZE DRAG SELECT
        try {

            // ds = new DragSelect({
            //     area: main, //document.querySelector('.active-tab-content'), //main, //document.getElementById('files_grid'),
            //     selectorClass: 'drag_select',
            //     keyboardDragSpeed: 0,
            // })
            // let sc = 0;
            // ds.subscribe('elementselect', (e) => {
            //     // msg(`${++sc} Items Selected`)
            // });
            // ds.subscribe('elementunselect', (e) => {
            //     if (--sc == 0) {
            //         msg('')
            //     } else {
            //         // msg(`${sc} Items Selected`)
            //     }
            // });
            // ds.subscribe('predragmove', ({ isDragging, isDraggingKeyboard }) => {
            //     if (isDragging || isDraggingKeyboard) {
            //         ds.break()
            //     } else {
            //     }
            // })

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