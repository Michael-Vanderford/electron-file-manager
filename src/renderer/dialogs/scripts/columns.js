const ipcRenderer = require('electron').ipcRenderer;

class SettingsManager {

    constructor() {
        this.settings = ipcRenderer.sendSync('get_settings');
        if (!this.settings) {
            this.settings = {};
        }
    }

    // get settings
    get_settings() {
        return this.settings;
    }

}

class Utilities {

    constructor() {

        // get home dir
        this.home_dir = ipcRenderer.sendSync('get_home_dir');

        // set message
        ipcRenderer.on('set_msg', (e, msg) => {
            this.set_msg(msg);
        })

    }

    // set_msg
    set_msg(msg) {

        try {
            let msg_div = document.querySelector('.msg');
            // check if message contains error
            if (msg.toLocaleLowerCase().includes('error')) {
                msg_div.classList.add('error');
            } else {
                msg_div.classList.remove('error');
            }
            msg_div.innerHTML = '';
            msg_div.innerHTML = msg;
        } catch (err) {
            console.log('set_msg error', err);
        }

    }

    // add div
    add_div(classlist = []) {
        let div = document.createElement('div')
        if (classlist.length > 0) {
            for (let i = 0; i < classlist.length; i++) {
                div.classList.add(classlist[i])
            }
        }
        return div
    }

    // add link
    add_link(href, text) {

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
    add_icon(icon_name) {
        let icon = document.createElement('i');
        icon.classList.add('bi', `bi-${icon_name}`, 'icon');

        let icon_names = icon_name.split(',');
        icon_names.forEach(item => {
            icon.classList.add(item)
        })
        return icon
    }

    add_img(src) {
        let img = document.createElement('img')
        img.width = 32
        img.src = src
        return img
    }

}

class ColumnManager {

    constructor() {
        this.init_columns();
    }

    // init listner for columns dialog
    init_columns() {

        // Register listener for columns
        ipcRenderer.on('columns', (e) => {

            let settings = settingsManager.get_settings();
            const current_view = settings?.view === 'grid_view' ? 'grid_view' : 'list_view';
            const section_name = current_view === 'grid_view' ? 'Grid View Columns' : 'List View Columns';
            let columns = settings.schema.properties[section_name].properties;
            for (const key in columns) {

                let list = document.querySelector('.columns_list');
                const item = utilities.add_div(['item']);
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = key;
                const label = document.createElement('label');
                label.classList.add('label');

                // capitalize the first letter
                let u_key = '';

                switch (key) {
                    case 'name':
                        u_key = 'Name';
                        break;
                    case 'size':
                        u_key = 'Size';
                        break;
                    case 'mtime':
                        u_key = 'Modified';
                        break;
                    case 'ctime':
                        u_key = 'Created';
                        break;
                    case 'atime':
                        u_key = 'Accessed';
                        break;
                    case 'is_dir':
                        u_key = 'Type';
                        break;
                    case 'location':
                        u_key = 'Location';
                        break;
                    case 'type':
                        u_key = 'Content Type';
                        break;
                    case 'id':
                        u_key = 'ID';
                        break;
                    default:
                        break;
                }

                label.innerText = u_key;
                label.htmlFor = key;

                if (columns[key].default) {
                    input.checked = true;
                }

                if (key === 'name') {
                    input.checked = true;
                    input.disabled = true;
                    label.innerText = `${u_key} (always visible)`;
                }

                item.append(input, label)
                list.append(item);

                input.addEventListener('change', (e) => {
                    if (key === 'name') {
                        columns[key].default = true;
                        input.checked = true;
                        ipcRenderer.send('update_settings', settings);
                        return;
                    }

                    if (input.checked) {
                        columns[key].default = true;
                    } else {
                        columns[key].default = false;
                    }

                    ipcRenderer.send('update_settings', settings);
                    ipcRenderer.send('ls', settings.location);

                })

            }

        });

    }

}

let settingsManager;
let utilities;
let columnManager;

document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
    utilities = new Utilities();
    columnManager = new ColumnManager();
});