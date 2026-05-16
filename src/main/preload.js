// @ts-nocheck
const ipcRenderer = require('electron').ipcRenderer;
const Chart = require('chart.js/auto');


// Globals

// section 1 = main content
// section 2 = workspace
let section = 0;

class EventManager {
    constructor(container) {
        this.container = container || document;
        this.events = {};
    }

    // Method to add an event listener
    addEvent(eventType, selector, callback) {
        if (!this.events[eventType]) {
            this.events[eventType] = [];
            this.container.addEventListener(eventType, (e) => this.handleEvent(e));
        }

        this.events[eventType].push({ selector, callback });
    }

    // Method to handle events
    handleEvent(event) {
        const { type, target } = event;
        if (this.events[type]) {
            this.events[type].forEach(({ selector, callback }) => {
                if (target.matches(selector) || target.closest(selector)) {
                    callback.call(target, event);
                }
            });
        }
    }

    // Method to remove an event listener
    removeEvent(eventType, selector, callback) {
        if (this.events[eventType]) {
            this.events[eventType] = this.events[eventType].filter(
                (entry) => entry.selector !== selector || entry.callback !== callback
            );

            // If no more listeners exist for this event type, remove the main listener
            if (this.events[eventType].length === 0) {
                this.container.removeEventListener(eventType, this.handleEvent);
                delete this.events[eventType];
            }
        }
    }

    // Method to clear all event listeners
    clearAllEvents() {
        for (let eventType in this.events) {
            this.container.removeEventListener(eventType, this.handleEvent);
        }
        this.events = {};
    }
}

class SettingsManager {

    constructor() {

        this.settings = {};
        this.init_settings();

        this.schema = this.get_schema();
        // console.log('settings schema', this.schema);


        ipcRenderer.on('settings_updated', (e, updated_settings) => {
            // console.log('settings updated', updated_settings);
            this.settings = updated_settings;
            this.schema = this.get_schema();
        })

        // settings menu
        this.settings_menu = document.querySelector('.settings_menu');
        this.settings_menu_button = this.settings_menu.querySelector('.button.settings');
        this.settings_menu_button.addEventListener('click', (e) => {
            fileManager.get_settings_view();
        });
    }

    init_settings() {
        this.settings = ipcRenderer.sendSync('get_settings');
        if (!this.settings) {
            this.settings = {};
        }

        this.migrate_legacy_top_level_schema_sections();

        // --- Set default to grid_view ONLY if not set ---
        let updated = false;
        if (!this.settings.view || this.settings.view === '' || this.settings.view === undefined) {
            this.settings.view = 'grid_view';
            updated = true;
        }

        // Initialize and migrate settings schema.
        const default_schema = this.get_default_schema();
        if (!this.settings.schema || this.settings.schema.properties === undefined) {
            this.settings.schema = default_schema;
            updated = true;
        } else {
            this.merge_schema_defaults(this.settings.schema, default_schema);
        }

        // --- Set schema default view to grid_view ONLY if not set ---
        if (
            this.settings?.schema?.properties?.['Default View']?.properties?.View &&
            (!this.settings.schema.properties['Default View'].properties.View.default ||
             this.settings.schema.properties['Default View'].properties.View.default === '' ||
             this.settings.schema.properties['Default View'].properties.View.default === undefined)
        ) {
            this.settings.schema.properties['Default View'].properties.View.default = 'grid_view';
            updated = true;
        }

        // --- Ensure icon sizes have valid defaults without overwriting user choices ---
        const validIconSizes = new Set(['16', '24', '32', '48', '64', '128']);
        const iconProps = this.settings?.schema?.properties?.['Icons']?.properties;
        if (iconProps) {
            const listDefault = String(iconProps['List Icon Size']?.default ?? '');
            const gridDefault = String(iconProps['Grid Icon Size']?.default ?? '');

            if (!validIconSizes.has(listDefault)) {
                iconProps['List Icon Size'].default = '32';
                updated = true;
            }

            if (!validIconSizes.has(gridDefault)) {
                iconProps['Grid Icon Size'].default = '48';
                updated = true;
            }
        }

        // Also set flat keys for icon_size and list_icon_size
        if (!this.settings.icon_size || this.settings.icon_size === '' || this.settings.icon_size === undefined) {
            this.settings.icon_size = 48;
            updated = true;
        }
        if (!this.settings.list_icon_size || this.settings.list_icon_size === '' || this.settings.list_icon_size === undefined) {
            this.settings.list_icon_size = 32;
            updated = true;
        }

        // (Removed block that forcibly resets grid view columns defaults)

        // Keep default view in schema and flat key synchronized, but do NOT overwrite user changes
        const schema_view = this.settings?.schema?.properties?.['Default View']?.properties?.View?.default;
        // Only sync if view is missing
        if ((!this.settings.view || this.settings.view === '' || this.settings.view === undefined) && (schema_view === 'grid_view' || schema_view === 'list_view')) {
            this.settings.view = schema_view;
            updated = true;
        }

        // location
        if (this.settings.location === '' || this.settings.location === undefined) {
            let home_dir = ipcRenderer.sendSync('get_home_dir');
            utilities.set_location(home_dir);
            updated = true;
        }

        // disk utility
        if (this.settings.disk_utility === '' || this.settings.disk_utility === undefined) {
            this.settings.disk_utility = 'gnome-disks';
            updated = true;
        }

        if (updated) {
            ipcRenderer.send('update_settings', this.settings);
        }

        // Show columns
        if (this.settings.columns === undefined) {
            this.settings.columns = {
                name: true,
                location: false,
                size: true,
                mtime: true,
                ctime: false,
                atime: false,
                type: false,
                count: false
            }
            ipcRenderer.send('update_settings', this.settings);
        }

        // sort by
        if (this.settings.sort_by === '' || this.settings.sort_by === undefined) {
            this.settings.sort_by = 'mtime';
            this.settings.sort_direction = 'desc';
            ipcRenderer.send('update_settings', this.settings);
        }

        // list view settings
        this.list_view_settings = ipcRenderer.sendSync('get_list_view_settings');
        if (!this.list_view_settings.col_width || this.list_view_settings.col_width === undefined) {
            this.list_view_settings = {
                col_width: {
                    name: 200,
                    location: 100,
                    size: 120,
                    mtime: 140,
                    ctime: 140,
                    atime: 140,
                    type: 100,
                    count: 50
                }
            };
            // console.log('list view settings', this.list_view_settings);
            ipcRenderer.send('update_list_view_settings', this.list_view_settings);
        }

        if (this.settings.icon_size === '' || this.settings.icon_size === undefined) {
            this.settings.icon_size = 32;
            ipcRenderer.send('update_settings', this.settings);
        }

        if (this.settings.list_icon_size === '' || this.settings.list_icon_size === undefined) {
            this.settings.list_icon_size = 32;
            ipcRenderer.send('update_settings', this.settings);
        }

        // Keep legacy flat keys in sync with schema defaults used by the settings UI.
        this.settings.icon_size = parseInt(this.get_schema_setting('Grid Icon Size')?.default, 10) || this.settings.icon_size;
        this.settings.list_icon_size = parseInt(this.get_schema_setting('List Icon Size')?.default, 10) || this.settings.list_icon_size;
        ipcRenderer.send('update_settings', this.settings);

        if (this.settings.show_hidden === undefined) {
            this.settings.show_hidden = true;
            ipcRenderer.send('update_settings', this.settings);
        }

        if (this.settings.tabs == undefined) {
            this.settings.tabs = [];
            ipcRenderer.send('update_settings', this.settings);
        }

    }

    // get settings
    get_settings() {
        return this.settings;
    }

    get_schema() {
        let settings = ipcRenderer.sendSync('get_settings');
        if (settings && settings.schema) {
            return settings.schema.properties;
        }
        return null;
    }

    get_default_schema() {
        return {
            properties: {
                'Default View': {
                    type: 'object',
                    properties: {
                        View: {
                            type: 'string',
                            enum: ['list_view', 'grid_view'],
                            default: 'list_view'
                        },
                        "Sort By": {
                            type: 'string',
                            enum: ['name', 'location', 'size', 'mtime', 'ctime', 'atime', 'type', 'count'],
                            default: 'mtime'
                        },
                        "Sort Direction": {
                            type: 'string',
                            enum: ['asc', 'desc'],
                            default: 'desc'
                        },
                        'Show Hidden': {
                            type: 'boolean',
                            default: true
                        }
                    }
                },
                'Icons': {
                    type: 'object',
                    properties: {
                        'Grid Icon Size': {
                            type: 'string',
                            enum: ['16', '24', '32', '48', '64', '128'],
                            default: '32'
                        },
                        'List Icon Size': {
                            type: 'string',
                            enum: ['16', '24', '32', '48', '64', '128'],
                            default: '24'
                        },
                        'Ctrl+Wheel Resize Icons': {
                            type: 'boolean',
                            default: true
                        }
                    }
                },
                'List View Columns': {
                    type: 'object',
                    properties: {
                        name: { type: 'boolean', default: true, description: 'Name' },
                        location: { type: 'boolean', default: false, description: 'Location' },
                        size: { type: 'boolean', default: true, description: 'Size' },
                        mtime: { type: 'boolean', default: true, description: 'Modified Time' },
                        ctime: { type: 'boolean', default: false, description: 'Created Time' },
                        atime: { type: 'boolean', default: false, description: 'Accessed Time' },
                        type: { type: 'boolean', default: false, description: 'Type' },
                        count: { type: 'boolean', default: false, description: 'Count' }
                    }
                },
                'Grid View Columns': {
                    type: 'object',
                    properties: {
                        name: { type: 'boolean', default: true, description: 'Name' },
                        location: { type: 'boolean', default: false, description: 'Location' },
                        size: { type: 'boolean', default: false, description: 'Size' },
                        mtime: { type: 'boolean', default: false, description: 'Modified Time' },
                        ctime: { type: 'boolean', default: false, description: 'Created Time' },
                        atime: { type: 'boolean', default: false, description: 'Accessed Time' },
                        type: { type: 'boolean', default: false, description: 'Type' },
                        count: { type: 'boolean', default: false, description: 'Count' }
                    }
                }
            }
        };
    }

    merge_schema_defaults(target_schema, default_schema) {
        if (!target_schema.properties) {
            target_schema.properties = {};
        }

        for (const section_name in default_schema.properties) {
            const default_section = default_schema.properties[section_name];
            if (!target_schema.properties[section_name]) {
                target_schema.properties[section_name] = default_section;
                continue;
            }

            const target_section = target_schema.properties[section_name];
            if (!target_section.properties) {
                target_section.properties = {};
            }

            for (const prop_name in default_section.properties) {
                if (!target_section.properties[prop_name]) {
                    target_section.properties[prop_name] = default_section.properties[prop_name];
                }
            }
        }
    }

    migrate_legacy_top_level_schema_sections() {
        const legacy_sections = ['Default View', 'Icons', 'List View Columns', 'Grid View Columns'];

        if (!this.settings.schema || typeof this.settings.schema !== 'object') {
            this.settings.schema = { properties: {} };
        }

        if (!this.settings.schema.properties || typeof this.settings.schema.properties !== 'object') {
            this.settings.schema.properties = {};
        }

        let updated = false;

        legacy_sections.forEach((section_name) => {
            const legacy_section = this.settings[section_name];
            if (!legacy_section || typeof legacy_section !== 'object' || !legacy_section.properties) {
                return;
            }

            if (!this.settings.schema.properties[section_name]) {
                this.settings.schema.properties[section_name] = legacy_section;
                updated = true;
            } else {
                const schema_section = this.settings.schema.properties[section_name];
                if (!schema_section.properties) {
                    schema_section.properties = {};
                }

                for (const prop_name in legacy_section.properties) {
                    if (!schema_section.properties[prop_name]) {
                        schema_section.properties[prop_name] = legacy_section.properties[prop_name];
                        updated = true;
                    }
                }
            }

            delete this.settings[section_name];
            updated = true;
        });

        if (updated) {
            ipcRenderer.send('update_settings', this.settings);
        }
    }

    ensure_name_column_visibility() {
        if (!this.settings?.schema?.properties) {
            return;
        }

        let updated = false;
        const sections = ['List View Columns', 'Grid View Columns'];

        sections.forEach((section_name) => {
            const name_prop = this.settings?.schema?.properties?.[section_name]?.properties?.name;
            if (name_prop && name_prop.default !== true) {
                name_prop.default = true;
                updated = true;
            }
        });

        if (updated) {
            ipcRenderer.send('update_settings', this.settings);
        }
    }

    migrate_grid_column_defaults() {
        this.settings.migrations = this.settings.migrations || {};
        if (this.settings.migrations.grid_columns_v2_applied) {
            return;
        }

        const grid_columns = this.settings?.schema?.properties?.['Grid View Columns']?.properties;
        if (!grid_columns) {
            this.settings.migrations.grid_columns_v2_applied = true;
            ipcRenderer.send('update_settings', this.settings);
            return;
        }

        // Only migrate users that still have the old untouched defaults.
        const previous_defaults = {
            name: true,
            location: false,
            size: true,
            mtime: true,
            ctime: false,
            atime: false,
            type: false,
            count: false
        };

        const is_untouched = Object.keys(previous_defaults).every((key) => {
            return !!grid_columns[key] && grid_columns[key].default === previous_defaults[key];
        });

        if (!is_untouched) {
            // Mark migration complete so user choices are never reinterpreted on future startups.
            this.settings.migrations.grid_columns_v2_applied = true;
            ipcRenderer.send('update_settings', this.settings);
            return;
        }

        grid_columns.name.default = true;
        grid_columns.location.default = false;
        grid_columns.size.default = false;
        grid_columns.mtime.default = false;
        grid_columns.ctime.default = false;
        grid_columns.atime.default = false;
        grid_columns.type.default = false;
        grid_columns.count.default = false;

        this.settings.migrations.grid_columns_v2_applied = true;

        ipcRenderer.send('update_settings', this.settings);
    }

    get_schema_setting(search_key) {

        if (!this.schema || !search_key) {
            return null;
        }

        const target = String(search_key).toLowerCase();

        // Search nested properties in each schema section
        for (const sectionName in this.schema) {
            const section = this.schema[sectionName];
            if (!section || !section.properties) continue;

            for (const propName in section.properties) {
                if (propName.toLowerCase() === target) {
                    const def = section.properties[propName];
                    return def === undefined ? null : def;
                }
            }
        }

        // Fallback: direct match on top-level (if schema was structured differently)
        for (const topKey in this.schema) {
            if (topKey.toLowerCase() === target) {
                const def = this.schema[topKey];
                return def === undefined ? null : def;
            }
        }

        return null;


    }

    set_schema_setting(search_key, value) {
        if (!this.settings?.schema?.properties || !search_key) {
            return false;
        }

        const target = String(search_key).toLowerCase();
        const sections = this.settings.schema.properties;

        for (const section_name in sections) {
            const section = sections[section_name];
            if (!section?.properties) continue;

            for (const prop_name in section.properties) {
                if (prop_name.toLowerCase() === target) {
                    section.properties[prop_name].default = value;
                    return true;
                }
            }
        }

        return false;
    }

    // update settings
    update_settings(settings) {
        this.settings = settings;

        // console.log('update settings', this.settings);

        ipcRenderer.send('update_settings', this.settings);
    }

    get_window_settings() {
        return ipcRenderer.sendSync('get_window_settings');
    }

    // get view
    get_view_settings() {
        const flat_view = this.settings?.view;
        if (flat_view === 'grid_view' || flat_view === 'list_view') {
            return flat_view;
        }
        return this.get_schema_setting('View')?.default || 'list_view';
    }

    // get list view settings
    get_list_view_settings() {
        return this.list_view_settings;
    }

    // get location
    get_location() {
        if (!this.settings.location) {
            this.settings.location = ipcRenderer.sendSync('get_home_dir');
        }
        return this.settings.location;
    }

    // set location
    set_location(location) {

        if (location === undefined || location === '') {
            // console.log('Error: Setting location. No location found'); // commented out for non-error logging
            utilities.set_msg('Error: Setting location. No location found');
            return;
        }

        if (location !== this.settings.location) {

            this.settings.location = location;
            this.update_settings(this.settings);
            this.init_settings();

            // ipcRenderer.invoke('update_settings', this.settings).then(res => {
            //     // this.init_settings();
            // })

        }

    }

}

class Utilities {

    constructor() {

        this.listeners = [];

        this.breadcrumbs = document.querySelector('.breadcrumbs');
        this.location_input = document.querySelector('.location');

        if (!this.location_input) {
            return;
        }

        this.location = '';
        this.destination = '';

        this.home_dir = '';
        this.copy_arr = [];
        this.move_arr = [];
        this.cut_arr = [];
        this.formatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
        this.byteUnits = [' Bytes', ' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];

        this.chunk_size = 500;

        this.is_dragging = false;
        this.is_cut_operation = false;
        this.current_progress_operation = null;
        this.current_progress_can_cancel = false;

        this.selected_files_size = 0;
        this.icon_request_queue = [];
        this.icon_request_in_flight = 0;
        this.max_icon_requests_in_flight = 8;

        this.progress_cancel_button = document.querySelector('.progress_cancel');
        if (this.progress_cancel_button) {
            this.progress_cancel_button.addEventListener('click', () => {
                if (this.current_progress_can_cancel && this.current_progress_operation) {
                    ipcRenderer.send('cancel_operation', this.current_progress_operation);
                    this.set_msg(`Cancelling ${this.current_progress_operation}...`);
                }
            });
        }

        this.location_input.addEventListener('keydown', (e) => {

            // if (e.key === 'Escape') {
            //     e.preventDefault();
            //     e.stopPropagation();
            //     this.hide_location_input();
            // }

            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();

                if (this.location_input.value === 'settings:') {
                    fileManager.get_settings_view();
                    return;
                }

                this.location = this.location_input.value;
                this.hide_location_input();
                fileManager.get_files(this.location);
            }

        });

        // init autocomplete for location
        this.initAutoComplete();

        // select all
        ipcRenderer.on('select_all', (e) => {
            this.select_all();
        });

        // set progress
        ipcRenderer.on('set_progress', (e, progress_data) => {
            this.set_progress(progress_data);
        });

        // disk space
        ipcRenderer.on('disk_space', (e, data) => {
            this.set_disk_space(data);
        });

        // get user
        this.user_name = ipcRenderer.sendSync('get_user');

        // get home dir
        this.home_dir = ipcRenderer.sendSync('get_home_dir');

        // set message
        ipcRenderer.on('set_msg', (e, msg) => {
            this.set_msg(msg);
        });

        ipcRenderer.on('clear_highlight', (e) => {
            this.clear_highlight();
        });

        ipcRenderer.on('folder_size', (e, folder_data) => {
            this.set_folder_size(folder_data);
        })

        ipcRenderer.on('cancel_edit', (e) => {
            this.cancel_edit();
        })

    }

    removeAllListeners() {
        listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        listeners.length = 0;
    }

    // set folder size
    set_folder_size(folder_data) {

        let tabs_content = tabManager.get_tabs_content();
        tabs_content.forEach(tab_content => {
            let item = tab_content.querySelector(`[data-href="${folder_data.source}"]`);
            if (!item) {
                // console.log('no data-href found for', folder_data.source);
                return;
            }
            item.dataset.size = folder_data.size;
            let size_item = item.querySelector('.size');
            if (size_item) {
                const effective_size = folder_data.size <= 4096 ? 0 : folder_data.size;
                size_item.textContent = effective_size === 0 ? '0 bytes' : this.get_file_size(effective_size);
            } else {
                // console.log('no .size found for', folder_data.source);
                return;
            }
        });



        // let active_tab_content = tabManager.get_active_tab_content();
        // let item = active_tab_content.querySelector(`[data-href="${folder_data.source}"]`);
        // if (!item) {
        //     // console.log('no data-href found for', folder_data.source);
        //     return;
        // }
        // item.dataset.size = folder_data.size;
        // let size_item = item.querySelector('.size');
        // if (size_item) {
        //     size_item.textContent = this.get_file_size(folder_data.size);
        // } else {
        //     console.log('no .size found for', folder_data.source);
        //     return;
        // }
    }

    // get home dir
    get_home_dir() {
        return this.home_dir;
    }

    // // set is dragging
    // set_is_dragging(is_dragging) {
    //     this.is_dragging = is_dragging;
    // }

    // get destination
    get_destination() {
        return this.destination;
    }

    // set destination
    set_destination(destination) {
        this.destination = destination;
    }

    queue_icon_request(href, on_success, on_error) {
        if (!href) {
            if (typeof on_error === 'function') {
                on_error();
            }
            return;
        }

        this.icon_request_queue.push({ href, on_success, on_error });
        this.process_icon_request_queue();
    }

    process_icon_request_queue() {
        while (
            this.icon_request_in_flight < this.max_icon_requests_in_flight
            && this.icon_request_queue.length > 0
        ) {
            const task = this.icon_request_queue.shift();
            this.icon_request_in_flight += 1;

            ipcRenderer.invoke('get_icon', task.href).then((icon) => {
                if (typeof task.on_success === 'function') {
                    task.on_success(icon);
                }
            }).catch(() => {
                if (typeof task.on_error === 'function') {
                    task.on_error();
                }
            }).finally(() => {
                this.icon_request_in_flight -= 1;
                this.process_icon_request_queue();
            });
        }
    }

    // init autocomplete
    initAutoComplete() {

        // Create the popup element
        const popup = this.add_div();
        popup.classList.add('autocomplete-popup'); // Add a CSS class for styling
        let val0 = this.location;
        if (!this.location_input) {
            return;
        }

        this.location_input.addEventListener('input', (e) => {
            if (e.key !== 'Backspace') {
                let val = e.target.value;
                ipcRenderer.invoke('autocomplete', val).then(res => {
                    if (res.length > 0 && val0 !== val) {
                        this.autocomplete_idx = 0;
                        popup.innerHTML = '';
                        res.forEach((dir, i) => {
                            const menu_item = this.add_div(['item']);
                            menu_item.textContent = dir;
                            popup.append(menu_item);
                            menu_item.addEventListener('click', (e) => {
                                fileManager.get_files(dir);
                                popup.remove();
                            })
                            if (i === 0) {
                                menu_item.classList.add('highlight_select');
                            }
                        })
                        // Append the popup to the body
                        const nav_menu = document.querySelector('.navigation');
                        nav_menu.appendChild(popup);
                        // Determine position based on space below and above
                        const windowHeight = window.innerHeight;
                        const popupHeight = popup.offsetHeight;
                        const triggerElement = this.location_input // Replace with your trigger element
                        const triggerRect = triggerElement.getBoundingClientRect();
                        const triggerTop = triggerRect.top;
                        const spaceBelow = windowHeight - (triggerTop + triggerRect.height);
                        const spaceAbove = triggerTop;
                        if (spaceBelow > popupHeight) {
                            popup.style.top = triggerTop + triggerRect.height + 5 + 'px';
                        } else if (spaceAbove > popupHeight) {
                            popup.style.top = triggerTop - popupHeight + 'px';
                        } else {
                            // Handle cases where neither direction has enough space
                            console.warn('Not enough space to display popup!');
                        }
                        popup.style.left = triggerRect.left + 5 + 'px';
                    }
                })
            }
        })

        popup.addEventListener('mouseleave', (e) => {
            popup.remove();
        })

        // Handle keyboard events
        this.location_input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            this.suggestions = popup.querySelectorAll('.item');
            switch (e.key) {
                case 'ArrowDown': {
                    this.autocomplete_idx = (this.autocomplete_idx + 1) % this.suggestions.length;
                    for (let i = 0; i < this.suggestions.length; i++) {
                        if (i === this.autocomplete_idx) {
                            this.suggestions[i].classList.add('highlight_select');
                            this.location_input.value = this.suggestions[i].innerText;
                        } else {
                            this.suggestions[i].classList.remove('highlight_select');
                        }
                    }
                    break;
                }
                case 'ArrowUp': {
                    this.autocomplete_idx = (this.autocomplete_idx - 1 + this.suggestions.length) % this.suggestions.length;
                    for (let i = 0; i < this.suggestions.length; i++) {
                        if (i === this.autocomplete_idx) {
                            this.suggestions[i].classList.add('highlight_select');
                            this.location_input.value = this.suggestions[i].innerText;
                        } else {
                            this.suggestions[i].classList.remove('highlight_select');
                        }
                    }
                    break;
                }
                case 'Enter': {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.suggestions.length > 0) {
                        this.suggestions.forEach(item => {
                            if (item.classList.contains('highlight_select')) {
                                fileManager.get_files(item.innerText);
                            } else {
                                fileManager.get_files(this.location);
                            }
                        })
                        popup.innerHTML = '';
                        popup.remove();
                    } else {
                    }
                    break;
                }
                case 'Escape': {
                    // this.location_input.value = this.val0;
                    // popup.remove();
                    break;
                }
                case 'Tab': {
                    if (this.suggestions.length > 0) {
                        // console.log('tab', this.suggestions.length)
                        e.preventDefault()
                        for (let i = 0; i < this.suggestions.length; i++) {
                            if (this.suggestions[i].classList.contains('highlight_select')) {
                                this.location_input.value = this.suggestions[i].innerText;
                                // tabManager.addTabHistory(this.location);
                                popup.innerHTML = '';
                                popup.remove();
                                break;
                            }
                        }
                    }
                    break;
                }
            }
        })

    }

    // set copy arr
    set_copy_arr(copy_arr) {
        this.copy_arr = copy_arr;
    }

    // get copy arr
    get_copy_arr() {
        return this.copy_arr;
    }

    // set move arr
    set_move_arr(move_arr) {
        this.move_arr = move_arr;
    }

    // get move arr
    get_move_arr() {
        return this.move_arr;
    }

    // get disk space
    get_disk_space(href) {
        ipcRenderer.send('get_disk_space', href);
    }

    // get disk space
    set_disk_space(data) {

        let disk_space = document.querySelector('.disk_space')
        disk_space.innerHTML = ''

        if (data.length > 0) {

            let ds = this.add_div();
            let us = this.add_div();
            let as = this.add_div();

            ds.classList.add('item')
            us.classList.add('item')
            as.classList.add('item')

            ds.innerHTML = `Disk Space: ${data[0].disksize}`;
            us.innerHTML = `Used Space: ${data[0].usedspace}`;
            as.innerHTML = `Available: ${data[0].availablespace}`;

            disk_space.append(ds, us, as)

        } else {

        }
    }

    // get date time
    get_date_time(date) {
        try {
            return this.formatter.format(new Date(date * 1000));
        } catch (err) {
            // console.log('getDateTime Format error', date); // commented out for non-error logging
            return "---"
            // console.log('gio getDateTime Format error')
        }
    }

    // get file size
    get_file_size(bytes) {
        if (!bytes || bytes <= 0) {
            return "0 bytes";
        }
        if (bytes < 1024) {
            return bytes + this.byteUnits[0]; // show raw bytes
        }

        let i = 0;
        let size = bytes;
        while (size >= 1024 && i < this.byteUnits.length - 1) {
            size = size / 1024;
            i++;
        }
        return size.toFixed(1) + this.byteUnits[i];
    }

    // create a breadcrumbs from location
    get_breadcrumbs(location) {

        // console.log('running get breadcrumbs', location);

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

            breadcrumb_item.append(i);
            breadcrumb_item.title = `File System`;

            breadcrumb_div.append(breadcrumb_item);

            return;

        }


        breadcrumbs = location.split('/');
        if (breadcrumbs.length > 0) {

            breadcrumbs.forEach((breadcrumb, index) => {

                if (breadcrumb !== '' && breadcrumb !== 'home') {

                    let breadcrumb_item = document.createElement('div');
                    let i = document.createElement('i');
                    let label = document.createElement('div');

                    breadcrumb_item.classList.add('breadcrumb_item', 'flex');

                    if (breadcrumb === utilities.user_name) {

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

                        let new_location = breadcrumbs.slice(0, index + 1).join('/');
                        if (new_location) {
                            if (e.ctrlKey) {
                                fileManager.get_files(new_location)
                                tabManager.add_tab(new_location)
                            } else {
                                tabManager.addTabHistory(new_location);
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

    }

    // get location
    get_location() {
        return this.location;
    }

    // set location
    set_location(location) {

        // this.get_breadcrumbs(location);
        if (!this.location_input) {
            return;
        }

        this.location_input.value = location;
        this.location = location;

        let sidebar = document.querySelector('.sidebar');
        let sidebar_items = sidebar.querySelectorAll('.item');
        sidebar_items.forEach(item => {
            if (item) {
                // console.log('sidebar item', item.dataset.href, location);
                item.classList.remove('highlight_select');
                if (item.dataset.href === location) {
                    item.classList.add('highlight_select');
                }
            }
        });

    }

    // show location
    show_location_input() {
        this.location_input.classList.remove('hidden');
        this.breadcrumbs.classList.add('hidden');
        this.location_input.focus();
    }

    // hide location
    hide_location_input() {
        this.location_input.classList.add('hidden');
        this.breadcrumbs.classList.remove('hidden');
    }

    // get base name
    get_base_name(file_path) {
        file_path = file_path.replace(/\/+$/, '');
        return file_path.split('/').pop();
    }

    // set_msg
    set_msg(msg) {

        try {
            let footer = document.querySelector('.footer');
            let msg_div = footer.querySelector('.msg');
            // check if message contains error
            if (msg.toLocaleLowerCase().includes('error')) {
                msg_div.classList.add('error');
            } else {
                msg_div.classList.remove('error');
            }
            msg_div.innerHTML = '';
            msg_div.innerHTML = `${msg}`;
            footer.classList.remove('footer-hidden');
            this._start_footer_hide_timer();
        } catch (err) {
            // console.log('set_msg error', err); // commented out for non-error logging
        }

    }

    _start_footer_hide_timer(delay = 4000) {
        clearTimeout(this._footer_hide_timer);
        this._footer_hide_timer = setTimeout(() => {
            let footer = document.querySelector('.footer');
            let progress = footer ? footer.querySelector('.progress') : null;
            if (progress && !progress.classList.contains('hidden')) return;
            if (footer) footer.classList.add('footer-hidden');
        }, delay);
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

    add_header(text) {
        let header = this.add_div(['header']) //document.createElement('h5');
        header.title = text
        header.innerHTML = text
        return header;
    }

    add_label(text, label_for = '') {
        let label = document.createElement('label');
        label.classList.add('label')
        label.htmlFor = label_for;
        label.style = 'padding-bottom: 5px;'
        label.append(text);
        return label;
    }

    add_item(text) {
        let item = this.add_div();
        item.classList.add('item');
        item.append(text);
        return item;
    }

    // add link
    add_link(href, text) {

        let link = document.createElement('a')
        link.href = href
        link.text = text
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

    // chunk select
    chunk_select(idx, elements) {

        const last_idx = Math.min(idx + this.chunk_size, elements.length);
        const chunk = elements.slice(idx, last_idx);

        let start = new Date().getTime();
        chunk.forEach(f => {
            f.classList.add('highlight_select');
        });
        let end = new Date().getTime();
        // console.log('chunk select load time', (end - start) / 1000);

        idx += this.chunk_size;

        // Check if more chunks need to be loaded
        if (idx < elements.length) {
            setTimeout(() => {
                this.chunk_select(idx, elements);
            }, 0);
        } else {
            // console.log('All chunks loaded');
        }
    }

    // select all
    select_all() {
        let active_tab_content = document.querySelector('.active-tab-content');
        let items = active_tab_content.querySelectorAll('.card, .tr');

        // filter out hidden items
        items = Array.from(items).filter(item => !item.classList.contains('hidden'));
        items.forEach(item => {
            item.classList.add('highlight_select');
        });
        this.set_msg(`Selected ${items.length} items`);
        items = null;
    }

    // copy
    copy() {

        this.copy_arr = this.get_selected_files();

        // console.log('copy arr', this.copy_arr);

        // send copy arr to MenuManager in main for menu paste operation
        ipcRenderer.send('set_copy_arr', this.copy_arr, this.location);
        this.set_msg(`Copied ${this.copy_arr.length} items at ${this.location}`);

    }

    // cut
    cut() {

        this.is_cut_operation = true;
        this.cut_arr = [];
        this.cut_arr = this.get_selected_files();

        // send copy arr to MenuManager in main for menu paste operation
        ipcRenderer.send('set_copy_arr', this.cut_arr, this.location);

        this.cut_arr.forEach(f => {
            let item = document.querySelector(`[data-id="${f.id}"]`);
            if (item) {
                item.classList.add('cut');
            } else {
                utilities.set_msg(`Error: getting item for cut function.`);
                return;
            }
        });
        this.set_msg(`Cut ${this.cut_arr.length} items at ${this.location}`);
    }

    // paste
    paste() {

        // console.log('running paste', this.destination);
        // check if cut operation
        if (this.is_cut_operation) {
            if (this.cut_arr.length > 0) {
                ipcRenderer.send('move', this.cut_arr, this.destination);
            } else {
                this.set_msg('Nothing to move');
            }
        } else {
            if (this.copy_arr.length > 0) {
                // console.log('paste', this.copy_arr, this.destination);
                ipcRenderer.send('paste', this.copy_arr, this.destination);
            } else {
                this.set_msg('Nothing to paste');
            }
        }
        // reset destination to location
        this.destination = this.location;
        this.is_cut_operation = false;
        this.copy_arr = [];
        this.cut_arr = [];
        this.clear_highlight();
        this.clear_empty_folder();

    }

    // move
    move() {

        this.move_arr = this.get_selected_files();
        if (this.move_arr.length > 0) {
            // console.log('move', this.move_arr, this.destination);
            ipcRenderer.send('move', this.move_arr, this.destination);
            this.set_msg(`Move ${this.move_arr.length} items to ${this.destination}`);
        } else {
            this.set_msg('Nothing to move');
        }
        // reset destination to location
        this.destination = this.location;
        this.move_arr = [];
        this.clear_highlight();

    }

    cancel_edit() {

        let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
        let items = active_tab_content.querySelectorAll('.card, .tr');
        items.forEach(item => {

            let name = item.querySelector('.href');
            if (name) {
                const href_div = item.querySelector('.href_div');
                if (href_div) {
                    href_div.classList.remove('hidden');
                }
                name.classList.remove('hidden');
            } else {
                // console.log('no .href found on', item)
                return;
            }

            let input = item.querySelector('input');
            if (input) {
                const input_div = item.querySelector('.input_div');
                if (input_div) {
                    input_div.classList.add('hidden');
                }
                input.value = item.dataset.name
                input.classList.add('hidden');
                input.removeEventListener('focus', this.focus_input);
            } else {
                console.log('no input found on', item)
                return;
            }
        });
        items = null;

        let location = document.querySelector('.placeholder');
        if (location) {
            location.focus();
        } else {
            console.log('no .placeholder found');
        }

    }

    // edit -
    edit() {

        // console.log('running edit');

        let active_tab_content = tabManager.get_active_tab_content();
        let items = active_tab_content.querySelectorAll('.highlight_select, .highlight');

        if (items.length > 0) {

            items.forEach((item, idx) => {

                let edit_name = item.querySelector('.href');
                if (edit_name) {
                    const href_div = item.querySelector('.href_div');
                    if (href_div) {
                        href_div.classList.add('hidden');
                    }
                    edit_name.classList.add('hidden');
                } else {
                    // console.log('no .href found on', item)
                    return;
                }

                // get input by

                let input = item.querySelector('.edit_name');
                if (input) {

                    input.index = idx;
                    const input_div = item.querySelector('.input_div');
                    if (input_div) {
                        input_div.classList.remove('hidden');
                    }
                    input.classList.remove('hidden');

                    if (idx === 0) {
                        setTimeout(() => {
                            input.focus();
                            input.setSelectionRange(0, input.value.lastIndexOf('.'));
                        }, 1);
                    }

                    input.addEventListener('blur', (e) => {
                        e.preventDefault();
                        input.focus();
                    });

                } else {
                    this.set_msg('No input found for edit');
                    return;
                }

            });
        } else {
            this.set_msg('Nothing to edit');
        }

        // active_tab_content.style.display = 'none';
        // active_tab_content.offsetHeight; // Force a reflow
        // active_tab_content.style.display = '';

    }

    focus_input(e) {
        setTimeout(() => {
            e.target.focus();
            e.target.setSelectionRange(0, e.target.value.lastIndexOf('.'));
        }, 1);
    }

    // rename file
    rename(source, destination, id) {

        if (source === undefined || source === '') {
            utilities.set_msg('No valid source found for rename');
            this.cancel_edit();
            return;
        }

        if (destination === undefined || destination === '') {
            utilities.set_msg('No valid destination found for rename');
            this.cancel_edit();
            return;
        }

        if (id === undefined || id === '') {
            utilities.set_msg('No valid id found for rename');
            this.cancel_edit();
            return;
        }

        ipcRenderer.send('rename', source, destination, id);

    }

    // mkdir
    mkdir() {

        if (this.destination === undefined || this.destination === '') {
            utilities.set_msg('No valid destination found for mkdir');
            return;
        }

        ipcRenderer.send('mkdir', this.destination);
    }

    // delete
    delete() {
        let delete_arr = this.get_selected_delete_files();
        if (delete_arr.length > 0) {
            ipcRenderer.send('delete', delete_arr);
            this.set_msg(`<img src="../renderer/icons/spinner.gif" style="width: 12px; height: 12px" alt="loading" />`);
        } else {
            this.set_msg('Nothing to delete');
        }
        delete_arr = [];
        // fileManager.check_for_empty_folder();
    }

    //
    extract() {
        let files_arr = this.get_selected_files();
        let location = this.get_location();
        ipcRenderer.send('extract', files_arr, location);
        files_arr = [];
        this.clear_highlight();
        this.set_msg('Extracting files.');
    }

    // Compress Files
    compress(type) {
        let selected_files = this.get_selected_files();
        let location = this.get_location();
        ipcRenderer.send('compress', selected_files, location, type, this.selected_files_size);
        this.clear_highlight();
        selected_files = [];
    }

    // set progress
    set_progress(progress_data) {

        let progress = document.querySelector('.progress');
        progress.classList.remove('hidden');
        let progress_status = document.querySelector('.progress_status');
        progress_status.innerHTML = progress_data.status;

        if (progress_data.operation) {
            this.current_progress_operation = progress_data.operation;
        }
        this.current_progress_can_cancel = !!progress_data.can_cancel;

        if (this.progress_cancel_button) {
            if (this.current_progress_can_cancel && progress_data.max > 0) {
                this.progress_cancel_button.classList.remove('hidden');
            } else {
                this.progress_cancel_button.classList.add('hidden');
            }
        }

        if (progress_data.max === 0) {
            progress_status.innerHTML = '';
            progress.classList.add('hidden');
            this.current_progress_operation = null;
            this.current_progress_can_cancel = false;
            if (this.progress_cancel_button) {
                this.progress_cancel_button.classList.add('hidden');
            }
            this._start_footer_hide_timer();
        } else {
            clearTimeout(this._footer_hide_timer);
            let footer = document.querySelector('.footer');
            if (footer) footer.classList.remove('footer-hidden');
        }

        let progress_bar = document.querySelector('.progress_bar');
        progress_bar.max = progress_data.max;
        progress_bar.value = progress_data.value;
    }

    // lazy load icons
    lazy_load_icons(table) {

        let lazyItems = table.querySelectorAll(".lazy");
        const self = this;
        const observer_root = table && table.classList && table.classList.contains('active-tab-content')
            ? table
            : table.closest('.active-tab-content');

        // listen for scroll event
        if ("IntersectionObserver" in window) {
            let observer = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        loadImage(entry.target, observer);
                    }
                });
            }, {
                root: observer_root || null,
                rootMargin: '220px 0px',
                threshold: 0.01
            });

            // Immediately load images that are already in viewport
            lazyItems.forEach(function (lazyImage) {
                if (isInViewport(lazyImage)) {
                    setTimeout(() => {
                        loadImage(lazyImage, observer);
                    }, 10);
                } else {
                    observer.observe(lazyImage);
                }
            });

            function isInViewport(element) {
                const rect = element.getBoundingClientRect();
                return (
                    rect.bottom >= 0 &&
                    rect.right >= 0 &&
                    rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.left <= (window.innerWidth || document.documentElement.clientWidth)
                );
            }

            // Function to load the image
            function loadImage(lazyImage, observer) {
                if (!lazyImage.dataset.src && lazyImage.dataset.iconHref) {
                    self.queue_icon_request(lazyImage.dataset.iconHref, (icon) => {
                        if (icon) {
                            lazyImage.dataset.src = icon;
                            lazyImage.src = icon;
                            lazyImage.classList.remove("lazy");
                            observer.unobserve(lazyImage);
                        }
                    }, () => {
                        observer.unobserve(lazyImage);
                    });
                    return;
                }

                const src = lazyImage.dataset.src;
                if (src) {
                    lazyImage.src = src;
                    lazyImage.classList.remove("lazy");
                    observer.unobserve(lazyImage);
                } else {
                    console.log('No image to load');
                }
            }

        } else {
            // Possibly fall back to a more compatible method here
        }

    }

    // clear selection
    clear() {

        // console.log('clear selection');

        // clear inputs
        this.cancel_edit();

        this.hide_location_input();

        // clear filter
        fileManager.clear_filter();

        // clear tab highlight
        let tabs = document.querySelectorAll('.tab');
        if (tabs.length > 0) {
            tabs.forEach(tab => {
                tab.classList.remove('highlight_select');
            });
        }

        this.clear_highlight();

        // clear sidebar highlight
        // let sidebar = document.querySelector('.sidebar');
        // let sidebar_items = sidebar.querySelectorAll('.item');
        // sidebar_items.forEach(item => {
        //     item.classList.remove('highlight_select', 'highlight');
        // });

        // clear workspace
        let workspace_items = document.querySelectorAll('.workspace_item');
        if (workspace_items) {
            workspace_items.forEach(i => {
                let input_div = i.querySelector('.input_div');
                let href_div = i.querySelector('.href_div');
                if (input_div) {
                    input_div.classList.add('hidden');
                }
                if (href_div) {
                    href_div.classList.remove('hidden');
                }
            });
        }

        // if escape on cut the clear it out
        this.cut_arr = [];
        let active_tab_content = tabManager.get_active_tab_content();
        let cut_items = active_tab_content.querySelectorAll('.cut');
        if (cut_items.length > 0) {
            // console.log('cut items', cut_items);
            cut_items.forEach(item => {
                item.classList.remove('cut');
            })
            this.set_msg(`Cut operation canceled for ${cut_items.length} items.`);
        }


        // set is dragging to false
        // dragSelect.set_is_dragging(false);
        // this.set_msg('');


    }

    // clear highlighted items
    clear_highlight() {

        // console.log('clear highlight');

        let main = document.querySelector('.main');
        let items = main.querySelectorAll('.highlight_select, .highlight, .highlight_target');
        items.forEach(item => {
            item.classList.remove('highlight_select', 'highlight', 'highlight_target');
        });

    }

    // // clear filter
    // clear_filter() {


    //     let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
    //     let cards = active_tab_content.querySelectorAll('.card, .tr');
    //     cards.forEach((card) => {
    //         card.classList.remove('hidden');
    //     })

    //     let filter = document.querySelector('.filter');
    //     if (filter) {
    //         filter.innerText = '';
    //         filter.classList.remove('active');
    //     } else {
    //         console.log('no filter');
    //     }

    //     // let filter = document.querySelector('.filter');
    //     // if (filter) {
    //     //     filter.innerHTML = '';
    //     //     filter.classList.remove('active');
    //     // }

    // }

    // clear empty folder message
    clear_empty_folder() {
        let empty_folder = document.querySelector('.empty_msg');
        if (empty_folder) {
            empty_folder.innerHTML = '';
        }
    }

    // get selected files
    get_selected_files() {
        this.icon_request_queue = [];
        this.icon_request_in_flight = 0;
        this.max_icon_requests_in_flight = 8;

        let selected_files = [];
        let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
        let items = active_tab_content.querySelectorAll('.highlight, .highlight_select');
        // let items = active_tab_content.querySelectorAll('.highlight_select');

        if (items.length === 0) {
            this.set_msg('No items selected');
            return selected_files;
        }

        items.forEach(item => {

            // check item.dataset values
            if (!item.dataset.id || !item.dataset.name || !item.dataset.href) {
                // console.log('missing dataset values', item);
                utilities.set_msg(`Missing dataset values ${item}`);
                return;
            }

            let files_obj = {
                id: item.dataset.id,
                name: item.dataset.name,
                display_name: item.dataset.name,
                href: item.dataset.href,
                size: item.dataset.size,
                mtime: item.dataset.mtime,
                ctime: item.dataset.ctime,
                atime: item.dataset.atime,
                is_dir: this.stob(item.dataset.is_dir),
                content_type: item.dataset.content_type,
                is_writable: this.stob(item.dataset.is_writable),
                is_readable: this.stob(item.dataset.is_readable),
                location: item.dataset.location,
                is_hidden: this.stob(item.dataset.is_hidden)

            }
            selected_files.push(files_obj);
            this.selected_files_size += parseInt(item.dataset.size);
        });

        return selected_files;
    }

    // get selected delete files
    get_selected_delete_files() {
        let selected_files = this.get_selected_files();
        return selected_files;
    }

    // convert string to boolean
    stob(string_val) {

        if (string_val === undefined) {
            console.log('stob: string_val is undefined');
            return -1;
        }

        let bool_val = true;
        if (string_val.toLocaleLowerCase() === 'true') {
            // console.log('true');
            bool_val = true;
        } else if (string_val.toLocaleLowerCase() === 'false') {
            bool_val = false;
        } else {
            bool_val = -1;
        }
        return bool_val;
    }

    // sort
    sort(files_arr, sort_by, sort_direction) {

        const sortFunctions = {
            name: (a, b) => a.name.localeCompare(b.name),
            size: (a, b) => a.size - b.size,
            mtime: (a, b) => a.mtime - b.mtime,
            ctime: (a, b) => a.ctime - b.ctime,
            atime: (a, b) => a.atime - b.atime
        };

        return files_arr.sort((a, b) => {

            // First, separate directories and files
            if (a.is_dir !== b.is_dir) {
                return a.is_dir ? -1 : 1;
            }

            // Sort by hidden status last
            if (a.name.startsWith('.') !== b.name.startsWith('.')) {
                return a.name.startsWith('.') ? 1 : -1;
            }

            // If both are directories or both are files, sort based on the specified criteria
            if (sort_by in sortFunctions) {
                const sortFunction = sortFunctions[sort_by];
                const result = sortFunction(a, b);
                return sort_direction === 'asc' ? result : -result;
            }

            return 0;
        });
    }

    // sort card / tr items. not a file array
    sortItems(items_arr, sort_by, sort_direction) {

        if (sort_by === '' || sort_by === undefined) {
            utilities.set_msg("Error: sort by not found.")
            return;
        }

        if (sort_direction === '' || sort_direction === undefined) {
            utilities.set_msg("Error: sort direction not found.")
            return;
        }

        const sortFunctions = {
            name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
            size: (a, b) => parseInt(a.dataset.size) - parseInt(b.dataset.size),
            mtime: (a, b) => parseInt(a.dataset.mtime) - parseInt(b.dataset.mtime),
            ctime: (a, b) => parseInt(a.dataset.ctime) - parseInt(b.dataset.ctime),
            atime: (a, b) => parseInt(a.dataset.atime) - parseInt(b.dataset.atime),
        };

        return items_arr.sort((a, b) => {

            // First, separate directories and files
            const a_is_dir = a.dataset.is_dir === "true";
            const b_is_dir = b.dataset.is_dir === "true";
            if (a_is_dir !== b_is_dir) {
                return a_is_dir ? -1 : 1; // Directories first
            }

            // Sort by hidden status last
            if (a.dataset.name.startsWith('.') !== b.dataset.name.startsWith('.')) {
                return a.dataset.name.startsWith('.') ? 1 : -1;
            }

            // If both are directories or both are files, sort based on the specified criteria
            if (sort_by in sortFunctions) {
                const sortFunction = sortFunctions[sort_by];
                const result = sortFunction(a, b);
                return sort_direction === 'asc' ? result : -result;
            }

            return 0;
        });
    }

}

class DragSelect {

    constructor() {

        this.items = [];

        this.key = null;
        this.is_dragging = false;
        this.is_selecting = false;
        this.is_scrolling = false;
        this.allow_click = false;
        this.allow_add = false;
        this.initialSelectionState = null;
        this.drag_select_arr = new Set();
        this.startPosX = 0;
        this.startPosY = 0;
        this.endPosX = 0;
        this.endPosY = 0;

    }

    // set is dragging
    set_is_dragging(is_dragging) {
        this.is_dragging = is_dragging;
    }

    // Initialize the drag select functionality
    initialize() {

        const selectionRectangle = document.querySelector('.selection-rectangle');
        const active_tab_content = document.querySelector('.active-tab-content');

        if (!selectionRectangle || !active_tab_content) {
            console.error('Missing required elements.');
            return;
        }

        active_tab_content.draggable = false;

        // Set draggable property for current items (do this after DOM updates as needed)
        Array.from(active_tab_content.querySelectorAll('.tr, .card')).forEach(item => {
            item.draggable = true;
        });

        // Delegated event listeners for .tr and .card elements

        // Prevent mousedown bubbling
        active_tab_content.addEventListener('mousedown', (e) => {
            const item = e.target.closest('.tr, .card');
            if (item) {
                e.stopPropagation();
            } else {
                this.startSelection(e, selectionRectangle, active_tab_content);
            }
        });

        // Mouseover/mouseout for highlight
        active_tab_content.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.tr, .card');
            if (item && !this.is_dragging_divs) {
                item.classList.add('highlight');
                let href = item.querySelector('a');
                const view_container = active_tab_content.querySelector('.view_container');
                const is_list_view = view_container?.classList.contains('list_view');
                if (href && is_list_view) {
                    href.focus({ preventScroll: true });
                }
            }
        });


        active_tab_content.addEventListener('mouseout', (e) => {
            const item = e.target.closest('.tr, .card');
            if (item) {
                item.classList.remove('highlight');
            }
        });

        // Dragstart
        active_tab_content.addEventListener('dragstart', (e) => {

            e.stopPropagation();

            const item = e.target.closest('.tr, .card');
            if (item) {
                // console.log('dragstart');
                this.is_dragging = true;
                this.is_dragging_divs = true;
                e.dataTransfer.effectAllowed = "copyMove"; // ADD THIS LINE
            }

        });

        // Dragover
        active_tab_content.addEventListener('dragover', (e) => {

            e.preventDefault();
            e.stopPropagation();

            const item = e.target.closest('.tr, .card');
            if (item) {

                // console.log('ctrlKey', e.ctrlKey, 'dropEffect', e.dataTransfer.dropEffect);

                if (item.dataset.is_dir === 'true') {
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
                    utilities.set_msg(`Destination: ${item.dataset.href}`);
                }
            }

            if (e.target) {
                if (e.ctrlKey) {
                    e.dataTransfer.dropEffect = "copy";
                    utilities.set_msg(`Copy items to ${utilities.get_location()}`);
                } else {
                    e.dataTransfer.dropEffect = "move";
                    utilities.set_msg(`Move items to ${utilities.get_location()}`);
                }
                utilities.set_destination(utilities.get_location());
            }

        });

        // Dragleave
        active_tab_content.addEventListener('dragleave', (e) => {

            const item = e.target.closest('.tr, .card');
            if (item && item.dataset.dragover === 'true') {
                delete item.dataset.dragover;
                item.classList.remove('highlight_target');
            }

        });

        // Drop
        active_tab_content.addEventListener('drop', (e) => {

            e.preventDefault();
            e.stopPropagation();

            console.log('dropping', e)

            const item = e.target.closest('.tr, .card');
            if (item) {


                // ipcRenderer.send('is_main', 0);
                if (!item.classList.contains('highlight') && !item.classList.contains('highlight_select') && item.classList.contains('highlight_target')) {
                    utilities.copy();
                    if (e.ctrlKey) {
                        utilities.paste();
                    } else {
                        utilities.move();
                    }
                } else {
                    console.log('did not find target')
                    ipcRenderer.send('is_main', 1);
                    utilities.copy();
                    utilities.paste();
                }
                utilities.clear();
                this.set_is_dragging(true);

            }

            if (e.target) {

                // e.preventDefault();
                // e.stopPropagation();

                if (e.ctrlKey) {
                    console.log('running copy')
                    utilities.copy();
                    utilities.paste();
                }

            }

            this.is_dragging_divs = false;

        });

        // Selection rectangle and scroll handling
        active_tab_content.addEventListener('mousemove', (e) => {
            this._lastClientX = e.clientX;
            this._lastClientY = e.clientY;
            this._lastCtrlKey = e.ctrlKey;
            this.updateSelection(e, selectionRectangle, active_tab_content);
        });
        active_tab_content.addEventListener('mouseup', (e) => this.endSelection(e, selectionRectangle, this.items));
        active_tab_content.addEventListener('click', (e) => this.handleOutsideClick(e, active_tab_content));

        // Ensure selection state is always cleared even if mouseup happens outside the view.
        if (this._documentMouseUpHandler) {
            document.removeEventListener('mouseup', this._documentMouseUpHandler);
        }
        this._documentMouseUpHandler = (e) => {
            if (this.is_selecting) {
                this.endSelection(e, selectionRectangle);
            }
        };
        document.addEventListener('mouseup', this._documentMouseUpHandler);

        active_tab_content.addEventListener('scroll', (e) => {
            if (this.is_selecting) {
                this.is_scrolling = true;
                // Re-evaluate selection against newly visible items using last known mouse position
                const syntheticEvent = {
                    clientX: this._lastClientX || 0,
                    clientY: this._lastClientY || 0,
                    ctrlKey: this._lastCtrlKey || false
                };
                this.updateSelection(syntheticEvent, selectionRectangle, active_tab_content);
            }
        });
    }

    // Start selection
    startSelection(e, selectionRectangle, active_tab_content) {

        e.stopPropagation();

        // validate selection rectangle
        if (!selectionRectangle) {
            console.error('Missing selection rectangle element.');
            return;
        }

        // validate active tab content
        if (!active_tab_content) {
            console.error('Missing active tab content element.');
            return;
        }

        if (e.button === 2) return; // Ignore right-click

        this.is_selecting = true;
        this.is_dragging = false;

        this.startPosX = e.clientX;
        this.startPosY = e.clientY;
        this._startScrollTop = active_tab_content.scrollTop;

        selectionRectangle.style.left = `${this.startPosX}px`;
        selectionRectangle.style.top = `${this.startPosY}px`;
        selectionRectangle.style.width = '0';
        selectionRectangle.style.height = '0';
        selectionRectangle.style.display = 'block';

        // Prevent text selection
        active_tab_content.style.userSelect = 'none';

    }

    // Update selection rectangle and highlight items
    updateSelection(e, selectionRectangle, active_tab_content) {

        if (!selectionRectangle || !active_tab_content) {
            console.error('Missing required elements');
            return;
        }

        if (!this.is_selecting || this.is_dragging) return;

        // If the primary button is no longer pressed, stop selection immediately.
        if (typeof e.buttons === 'number' && (e.buttons & 1) === 0) {
            this.endSelection(e, selectionRectangle);
            return;
        }

        // Always get fresh DOM references
        const currentItems = Array.from(active_tab_content.querySelectorAll('.tr, .card'));

        this.endPosX = e.clientX;
        this.endPosY = e.clientY;

        const rectWidth = this.endPosX - this.startPosX;
        const rectHeight = this.endPosY - this.startPosY;

        selectionRectangle.style.width = `${Math.abs(rectWidth)}px`;
        selectionRectangle.style.height = `${Math.abs(rectHeight)}px`;
        selectionRectangle.style.left = rectWidth > 0 ? `${this.startPosX}px` : `${this.endPosX}px`;
        selectionRectangle.style.top = rectHeight > 0 ? `${this.startPosY}px` : `${this.endPosY}px`;

        // Track initial state using current DOM elements
        if (!this.initialSelectionState && (e.ctrlKey || this.is_scrolling)) {
            this.initialSelectionState = new Set(
                currentItems.filter(item => item.classList.contains('highlight_select'))
            );
        }

        const scrollTop = active_tab_content.scrollTop;

        currentItems.forEach(item => {

            const itemRect = item.getBoundingClientRect();
            const isWithinSelection = this.isWithinSelection(itemRect, scrollTop);

            if (e.ctrlKey || this.is_scrolling) {
                if (isWithinSelection && !this.initialSelectionState.has(item)) {
                    item.classList.add('highlight_select');
                    this.drag_select_arr.add(item);
                }
                // Keep initially selected items highlighted
                this.initialSelectionState.forEach(initialItem => {
                    if (!currentItems.includes(initialItem)) return;  // Skip stale elements
                    initialItem.classList.add('highlight_select');
                    this.drag_select_arr.add(initialItem);
                });
            } else {
                if (isWithinSelection) {
                    item.classList.add('highlight_select');
                    this.drag_select_arr.add(item);
                } else {
                    item.classList.remove('highlight_select');
                    this.drag_select_arr.delete(item);
                }
            }
        });

        if (!e.ctrlKey) {
            this.initialSelectionState = null;
        }

        // Auto-scroll when mouse is near the top or bottom edge
        this._startAutoScroll(e, selectionRectangle, active_tab_content);

        // allow outside click
        this.allow_click = false;
    }

    // Start (or stop) the auto-scroll animation loop
    _startAutoScroll(e, selectionRectangle, active_tab_content) {
        const SCROLL_ZONE = 60;  // px from edge that triggers scrolling
        const MAX_SPEED  = 15;  // max px scrolled per frame

        const containerRect = active_tab_content.getBoundingClientRect();
        const distFromBottom = containerRect.bottom - e.clientY;
        const distFromTop    = e.clientY - containerRect.top;

        let scrollSpeed = 0;
        if (distFromBottom < SCROLL_ZONE && distFromBottom >= 0) {
            // Accelerate linearly as mouse moves closer to the bottom edge
            scrollSpeed = Math.round(MAX_SPEED * (1 - distFromBottom / SCROLL_ZONE));
        } else if (distFromTop < SCROLL_ZONE && distFromTop >= 0) {
            scrollSpeed = -Math.round(MAX_SPEED * (1 - distFromTop / SCROLL_ZONE));
        }

        if (scrollSpeed === 0) {
            // Mouse is not in a scroll zone — cancel any running loop
            if (this._autoScrollId) {
                cancelAnimationFrame(this._autoScrollId);
                this._autoScrollId = null;
            }
            return;
        }

        // Already have a loop running — just update the speed
        this._autoScrollSpeed = scrollSpeed;
        if (this._autoScrollId) return;

        const loop = () => {
            if (!this.is_selecting) {
                this._autoScrollId = null;
                return;
            }
            active_tab_content.scrollTop += this._autoScrollSpeed;
            // Re-evaluate selection with the now-updated scroll position
            const syntheticEvent = {
                clientX: this._lastClientX || 0,
                clientY: this._lastClientY || 0,
                ctrlKey: this._lastCtrlKey || false
            };
            this.updateSelection(syntheticEvent, selectionRectangle, active_tab_content);
            this._autoScrollId = requestAnimationFrame(loop);
        };
        this._autoScrollId = requestAnimationFrame(loop);
    }

    // End selection
    endSelection(e, selectionRectangle) {

        // e.stopPropagation();

        // Stop any active auto-scroll
        if (this._autoScrollId) {
            cancelAnimationFrame(this._autoScrollId);
            this._autoScrollId = null;
        }

        this.is_selecting = false;
        selectionRectangle.style.display = 'none';

        setTimeout(() => {
            this.allow_click = true;
            this.is_dragging = false;
        }, 500);

        // Restore text selection
        document.querySelector('.active-tab-content').style.userSelect = '';

        // Ensure selected items are kept highlighted
        this.drag_select_arr.forEach(item => item.classList.add('highlight_select'));

    }

    // Check if an item is within the selection rectangle.
    // Uses document-space Y coordinates so items outside the visible viewport
    // are correctly included/excluded as the container scrolls.
    isWithinSelection(itemRect, scrollTop) {
        const st = scrollTop || 0;
        // Convert mouse positions to document space using scroll offsets
        const startDocY = this.startPosY + (this._startScrollTop || 0);
        const endDocY = this.endPosY + st;
        const minDocY = Math.min(startDocY, endDocY);
        const maxDocY = Math.max(startDocY, endDocY);
        // Item position in document space
        const itemDocTop = itemRect.top + st;
        const itemDocBottom = itemRect.bottom + st;
        const minX = Math.min(this.startPosX, this.endPosX);
        const maxX = Math.max(this.startPosX, this.endPosX);
        return (
            itemRect.left < maxX && itemRect.right > minX &&
            itemDocTop < maxDocY && itemDocBottom > minDocY
        );
    }

    // Handle click outside selected items
    handleOutsideClick(e) {

        console.log('outside click', this.allow_add, this.allow_click);

        if (this.is_dragging) {
            console.log('dragging');
            return;
        }

        if (e.ctrlKey) {
            // console.log('allow add true');
            this.allow_add = true;
        } else {
            // console.log('allow add false');
            this.allow_add = false;
        }

        if (!this.allow_click) {
            // console.log('not allow click');
            return;
        }

        if (!this.is_selecting) {
            setTimeout(() => {
                this.clearSelection();
            }, 100);
        }

    }

    // Clear selection
    clearSelection() {

        // console.log('clear selection');

        let active_tab_content = document.querySelector('.active-tab-content');
        if (!active_tab_content) {
            console.error('Missing active tab content element.');
            return;
        }

        // this.drag_select_arr.forEach(item => {
        //     // console.log('clearing selection', item);
        //     item.classList.remove('highlight_select');
        //     item.classList.remove('highlight');
        //     item.classList.remove('highlight_target');
        // });

        utilities.clear_highlight();

        this.allow_click = false;
        this.drag_select_arr.clear();

    }

}

class DeviceManager {

    constructor() {

        this.sidebar = document.querySelector('.sidebar');
        if (!this.sidebar) {
            return;
        }

        this.device_view = this.sidebar.querySelector('.device_view');
        // if (!this.device_view) {
        //     this.device_view = utilities.add_div(['device_view']);
        // }

        this.device_arr = [];
        this.device = '';

        // ipcRenderer.send('get_devices');
        // ipcRenderer.on('devices', (e, devices) => {
        //     this.device_arr = devices;
        //     this.get_devices();
        // });

        ipcRenderer.send('get_mounts');
        ipcRenderer.on('mounts', (e, mounts) => {

            this.device_arr = mounts;
            // console.log('mounts', this.device_arr);
            this.get_devices();

        });

        // handle mount done
        ipcRenderer.on('mount_done', (e, deice_path) => {
            fileManager.get_files(deice_path);
        })

        // handle unmount done
        ipcRenderer.on('umount_done', (e, path) => {

            this.device_arr = this.device_arr.filter(device => device.path !== path);
            this.get_devices();

        })

        // add device
        ipcRenderer.on('add_device', (e, device) => {
            this.add_device(device, this.device_view);
        })

        // this.device_view.addEventListener('contextmenu', (e) => {
        //     // ipcRenderer.send('device_menu', this.device_arr);
        // })

    }

    get_type(path) {
        let type = '';
        if (path.match('mtp://')) {
            type = 'phone'
        } else if (path.match('sftp://')) {
            type = 'network'
        } else if (path.match('usb://')) {
            type = 'usb'
        } else {
            type = 'drive'
        }
        return type;
    }

    get_device_icon_name(device) {
        const type = (device?.type || this.get_type(device?.path || '') || '').toLowerCase();
        if (type.includes('mtp') || type.includes('phone')) {
            return 'phone';
        }
        if (type.includes('network') || type.includes('sftp') || type.includes('smb')) {
            return 'hdd-network';
        }
        return 'hdd';
    }

    get_devices(callback) {

        this.device_view.innerHTML = '';

        if (this.device_view) {

            // Devices section label
            let devices_label = utilities.add_div(['devices_label']);
            devices_label.textContent = 'Devices';
            this.device_view.append(document.createElement('hr'));
            this.device_view.append(devices_label);

            this.device_arr.sort((a, b) => {
                // First, compare by 'type'
                if (a.type < b.type) return -1;
                if (a.type > b.type) return 1;
                return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase());
            })

            this.device_arr.forEach(device => {
                this.add_device(device);
            })

            // Keep connect action below device entries and visible when there are no devices.
            let connect_btn = document.createElement('button');
            connect_btn.classList.add('button', 'connect_network');
            connect_btn.type = 'button';
            connect_btn.title = 'Connect to Network';
            connect_btn.innerHTML = '<i class="bi bi-hdd-network"></i><span>Connect</span>';
            connect_btn.addEventListener('click', (e) => {
                e.stopPropagation();
                ipcRenderer.send('connect');
            });
            this.device_view.append(connect_btn);

            this.sidebar.append(this.device_view);
            // this.device_arr = [];

            let items = this.sidebar.querySelectorAll('.item');
            items.forEach(item => {
                item.addEventListener('click', (e) => {
                    let sidebar_items = this.sidebar.querySelectorAll('.item');
                    sidebar_items.forEach(sidebar_item => {
                        sidebar_item.classList.remove('highlight_select');
                    })
                    item.classList.add('highlight_select');
                })
            })

        }
    }

    // add device to the device view
    add_device(device) {

        let item = utilities.add_div();
        let icon_div = utilities.add_div();
        let href_div = utilities.add_div();
        let umount_div = utilities.add_div();

        item.classList.add('flex', 'item', 'device_item');
        href_div.classList.add('device_href');

        let device_path = device.path;

        let a = document.createElement('a');
        a.preventDefault = true;
        a.href = device_path;
        a.textContent = device.name;

        let umount_icon = utilities.add_icon('eject-fill');
        umount_div.classList.add('device_eject');
        umount_div.title = 'Unmount Drive';

        // If path is empty string, then assume it's unmounted
        if (device.path === '') {

            // not mounted — hide eject button
            umount_div.classList.add('hidden');
            umount_div.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            })

            // Mount
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // console.log('mounting', device.name);
                ipcRenderer.send('mount', device.name);
            })

            // Hover title
            item.addEventListener('mouseover', (e) => {
                item.title = `Mount "${device.name}"`;
            });

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
                    tabManager.add_tab(device_path);
                    fileManager.get_files(device_path);
                } else {
                    fileManager.get_files(device_path);
                }
                // tabManager.add_tab_history(device_path);

                // handle highlight
                let items = this.sidebar.querySelectorAll('.item');
                items.forEach(item => {
                    item.classList.remove('sidebar_active');
                })
                item.classList.add('sidebar_active')

            })

            item.addEventListener('mouseover', (e) => {
                item.title = device_path;
            })

        }

        icon_div.append(utilities.add_icon(this.get_device_icon_name(device)));

        // Context Menu
        item.addEventListener('contextmenu', (e) => {
            utilities.clear();
            ipcRenderer.send('device_menu', device.name);
            item.classList.add('highlight_select');
        })

        href_div.append(a);
        umount_div.append(umount_icon);

        item.append(icon_div, href_div, umount_div);
        this.device_view.append(item);

        // console.log('device total', device);

        if (device.total) {

            let device_progress_container = utilities.add_div(['device_progress_container']);
            let device_progress = utilities.add_div(['device_progress']);

            let width = (parseInt(device.used) / parseInt(device.total)) * 100;
            device_progress.style = `width: ${width}%`;

            // console.log('device', device.name, device.size_total, device.size_used, width);

            device_progress_container.append(device_progress);
            this.device_view.append(device_progress_container);

            if (width > 70) {
                device_progress.classList.add('size_warming');
            }

            if (width > 90) {
                device_progress.classList.add('size_danger');
            }

            item.addEventListener('mouseover', (e) => {
                item.title = `${device_path}\n Total: ${utilities.get_file_size(device.total)}\n Used: ${utilities.get_file_size(device.used)}`;
            })

        }

    }

}

class WorkspaceManager {

    constructor() {

        this.is_moving = false;
        this.draggedRow = null;

        this.sidebar = document.querySelector('.sidebar');
        if (!this.sidebar) {
            return;
        }

        this.workspace_view = document.querySelector('.workspace_view');
        if (!this.workspace_view) {
            utilities.set_msg('No valid workspace view found');
            return;
        }

        // Get Workspace
        ipcRenderer.on('get_workspace', (e) => {
            this.get_workspace(() => { });
        })

        // Remove Workspace
        ipcRenderer.on('remove_workspace', (e, href) => {
            ipcRenderer.send('remove_workspace', (e, href));
        })

        // Rename Workspace
        ipcRenderer.on('edit_workspace', (e, href) => {
            this.editWorkspace(href);
        })

        // get workspace folder icon
        ipcRenderer.on('set_workspace_folder_icon', (e, href, icon) => {
            let tr = document.querySelector(`.workspace_item[data-href="${href}"]`);
            let img = tr.querySelector('img');
            img.src = icon;
        })

        this.get_workspace(() => { });

        // handle mouse over for workspace section
        this.workspace_view.addEventListener('mouseover', (e) => {
            if (section == 0 || section == 1) {
                section = 2;
                // console.log(section)
            }
        });

    }

    // Get Workspace
    get_workspace(callback) {

        ipcRenderer.invoke('get_workspace').then(res => {

            let table = document.createElement('table');
            let tbody = document.createElement('tbody');
            table.classList.add('workspace_table');
            table.append(tbody);

            // add toggle for workspace items
            let workspace_accordion = utilities.add_div(['workspace_accordion']);
            let workspace_accordion_container = utilities.add_div(['workspace_accordion_container']);
            let workspace_accordion_toggle = utilities.add_link('#', '');

            workspace_accordion.append(workspace_accordion_toggle);
            workspace_accordion.append(workspace_accordion_container);

            let workspace_toggle_icon = utilities.add_icon('chevron-down');
            workspace_toggle_icon.classList.add('workspace_toggle');
            workspace_accordion_toggle.append(workspace_toggle_icon, 'Workspace');


            let workspace = document.getElementById('workspace');
            if (!workspace) {
                workspace = utilities.add_div();
                workspace.id = 'workspace'
                workspace.classList.add('workspace')
            }
            workspace.innerHTML = '';
            this.sidebar.append(workspace);
            workspace.append(document.createElement('hr'));

            if (res.length == 0) {
                workspace.append('Drop a file or folder');
            }

            workspace.addEventListener('mouseout', (e) => {
                workspace.classList.remove('active')
            })

            workspace_accordion_toggle.addEventListener('click', (e) => {

                workspace_accordion_container.classList.toggle('hidden');
                if (workspace_accordion_container.classList.contains('hidden')) {
                    workspace_toggle_icon.classList.add('bi-chevron-right');
                    workspace_toggle_icon.classList.remove('bi-chevron-down');
                } else {
                    workspace_toggle_icon.classList.remove('bi-chevron-right');
                    workspace_toggle_icon.classList.add('bi-chevron-down');
                }

            })

            res.forEach((file, idx) => {

                // console.log('file', file);

                let tr = document.createElement('tr');
                tr.classList.add('item', 'workspace_item');
                tr.dataset.href = file.href;
                tr.tabIndex = idx;

                let td1 = document.createElement('td');
                let td2 = document.createElement('td');

                let img = document.createElement('img');
                img.classList.add('icon');

                let a = document.createElement('a');
                a.href = file.href;

                let input = document.createElement('input');
                input.value = file.name;
                input.classList.add('input', 'workspace_input');
                input.type = 'text';
                input.tabIndex = idx;
                input.id = idx;

                a.innerHTML = file.name;
                a.preventDefault = true;

                let href_div = utilities.add_div(['href_div']);
                href_div.append(a);

                let input_div = utilities.add_div(['input_div', 'hidden']);
                input_div.append(input);

                td1.append(img);
                td2.append(href_div, input_div);
                tr.append(td1, td2);
                tbody.append(tr);

                if (file.content_type === 'inode/directory') {

                    tr.dataset.is_dir = true;
                    // img.src = 'icons/folder.svg';
                    tr.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.ctrlKey) {
                            tabManager.add_tab(file.href);
                            fileManager.get_files(file.href);
                        } else {
                            tabManager.add_tab_history(file.href);
                            fileManager.get_files(file.href);
                        }
                    });

                    ipcRenderer.send('get_workspace_folder_icon', file.href);

                } else {

                    // tr.dataset.is_dir = false;
                    ipcRenderer.invoke('get_icon', (file.href)).then(res => {
                        img.src = res;
                    });
                    tr.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        ipcRenderer.send('open', file.href);
                    });

                }

                // Reorder table rows using drag and drop
                tr.draggable = true;
                this.draggedRow = null; // Keep track of the dragged row

                tr.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    this.draggedRow = tr; // Set the currently dragged row
                    this.is_moving = true;
                    tr.classList.add('dragging');
                    // console.log('dragstart', tr);
                });

                tr.addEventListener('dragover', (e) => {
                    e.preventDefault(); // Allow the drop event
                    e.stopPropagation();
                    tr.classList.add('drag_over'); // Highlight potential drop target
                });

                tr.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    tr.classList.remove('drag_over'); // Remove highlight after leaving
                });

                // Show Workspace Context Menu
                tr.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    ipcRenderer.send('workspace_menu', file);
                    tr.classList.add('highlight_select');
                });

                tr.addEventListener("mouseover", (e) => {
                    a.focus();
                })

                // note: this has some undefined behavior.
                // It is pushing some of the bottom elements up
                // tr.addEventListener('mouseover', (e) => {
                //     a.focus();
                // })

                // Edit workspace item
                tr.addEventListener('keydown', (e) => {

                    // e.preventDefault();
                    // e.stopPropagation();

                    if (e.key === 'F2') {

                        href_div.classList.add('hidden');
                        input_div.classList.remove('hidden');

                        input.select();
                        input.focus();

                    }

                    if (e.key === 'Escape') {
                        // e.preventDefault();
                        // e.stopPropagation();
                        input_div.classList.add('hidden');
                        href_div.classList.remove('hidden');
                    }

                })

                input.addEventListener('click', (e) => {
                    e.stopPropagation();
                })

                input.addEventListener('keydown', (e) => {

                    if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        input_div.classList.add('hidden');
                        href_div.classList.remove('hidden');
                    }

                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        ipcRenderer.send('rename_workspace', file.href, input.value);
                        input_div.classList.add('hidden');
                        href_div.classList.remove('hidden');
                    }

                })

                fileManager.handleTitle(tr, file);

                workspace.append(workspace_accordion);
                this.workspace_view.append(workspace);

            })

            // add drop event listeners for tbody
            tbody.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (this.is_moving && this.draggedRow) {
                    // Get the element at the drop position
                    const x = e.clientX;
                    const y = e.clientY;
                    const targetElem = document.elementFromPoint(x, y);

                    if (targetElem && targetElem.closest('tr') && targetElem.closest('tbody')) {
                        const targetRow = targetElem.closest('tr');

                        if (targetRow !== this.draggedRow) {
                            // Insert the dragged row before the target row
                            targetRow.insertAdjacentElement('beforebegin', this.draggedRow);
                            // console.log('Row moved:', this.draggedRow, 'before', targetRow);
                        }
                    }

                    // get all workspace items
                    let workspace_items = tbody.querySelectorAll('.workspace_item');
                    let workspace_arr = [];
                    workspace_items.forEach(item => {
                        workspace_arr.push(item.dataset.href);
                    })

                    ipcRenderer.send('reorder_workspace', workspace_arr);

                    // Clean up
                    this.is_moving = false;
                    this.draggedRow.classList.remove('dragging');
                    tbody.querySelectorAll('.drag_over').forEach((row) => row.classList.remove('drag_over'));
                    this.draggedRow = null;

                } else if (!this.is_moving) {

                    let selected_files_arr = utilities.get_selected_files();
                    ipcRenderer.send('add_workspace', selected_files_arr);

                    selected_files_arr = [];
                    utilities.clear();

                }

                // console.log(this.is_moving, this.draggedRow)

            });

            // Ensure rows don't have leftover 'dragover' styles
            tbody.addEventListener('dragend', () => {
                tbody.querySelectorAll('.drag_over').forEach((row) => row.classList.remove('dragover'));
                if (this.draggedRow) this.draggedRow.classList.remove('dragging');
                this.is_moving = false;
                this.draggedRow = null;
            });

            workspace_accordion_container.append(table);

            return callback(workspace);

        })
    }


    // edit workspace
    editWorkspace(href) {


        let workspace = document.querySelector('.workspace');
        if (!workspace) {
            utilities.msg('No workspace item found');
            return;
        }

        let workspace_item = workspace.querySelector('.workspace_item');
        if (!workspace_item) {
            utilities.msg('No workspace item found');
            return;
        }

        let href_div = workspace.querySelector('.href_div');
        if (!href_div) {
            utilities.msg('No href div found');
            return;
        }

        let workspace_input_div = workspace.querySelector('.input_div');
        if (!workspace_input_div) {
            utilities.msg('No workspace item input found');
            return;
        }

        let workspace_input = workspace.querySelector('.workspace_input');
        if (!workspace_input) {
            utilities.msg('No workspace item input found');
            return;
        }
        workspace_input.focus();
        workspace_input.select();

        // hide workspace item
        href_div.classList.add('hidden');

        // Show workspace item input
        workspace_input_div.classList.remove('hidden');


        // Edit workspace item
        workspace.addEventListener('keyup', (e) => {

            // e.preventDefault();
            // e.stopPropagation();

            if (e.key === 'F2') {
                e.preventDefault();
                e.stopPropagation();
                workspace_input_div.classList.remove('hidden');
                workspace_item.classList.add('hidden');
                workspace_input_div.focus();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                workspace_input_div.classList.add('hidden');
                workspace_item.classList.remove('hidden');
            }

        })

        workspace_input_div.addEventListener('click', (e) => {
            e.stopPropagation();
        })

        workspace_input_div.addEventListener('change', (e) => {
            ipcRenderer.send('rename_workspace', file.href, e.target.value)
        })

    }

}

class SideBarManager {

    constructor() {

        // this.utilities = Utilities;
        // this.fileManager = FileManager;

        this.sidebar = document.querySelector('.sidebar');
        if (!this.sidebar) {
            console.log('error getting sidebar');
            return;
        }

        // handle mousedown for sidebar
        this.sidebar.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        })

        this.main = document.querySelector('.main');
        if (!this.main) {
            console.log('error getting main');
            return;
        }

        // mouse down for main
        this.main.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        // handle mousedown for nav menu
        let nav_menu = document.querySelector('.navigation');
        nav_menu.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        })

        // Get references to the resize handle element
        this.drag_handle = document.querySelector(".sidebar_draghandle");

        // Get the initial mouse position
        this.initialMousePos;
        this.initialSidebarWidth = this.sidebar.offsetWidth;
        this.initialMainWidth = this.main.offsetWidth;

        this.distanceMoved = 0;
        this.newSidebarWidth = 0;
        this.newMainWidth = 0;

        this.is_resizing = false;
        // console.log('is_resizing', this.is_resizing)

        this.home_view = utilities.add_div(['home_view']);
        this.workspace_view = utilities.add_div(['workspace_view']);
        this.device_view = utilities.add_div(['device_view']);

        this.init_sidebar();

        this.sidebar.append(this.home_view, this.workspace_view, this.device_view);
        this.get_home();

        // set global section variable for main
        this.main.addEventListener('mouseover', (e) => {
            if (section == 0 || section == 2) {
                section = 1;
                // console.log(section)
            }
        });

        // let items = this.sidebar.querySelectorAll('.item');
        // items.forEach(item => {
        //     console.log('sidebar item', item);
        // });

    }

    // get home
    get_home() {

        // create array for bootstrap icons
        let icons = ['house', 'speedometer2', 'folder', 'file-earmark', 'image', 'music-note', 'camera-video', 'clock-history', 'hdd'];
        let home_dirs = ['Home', 'Dashboard', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos', 'Recent', 'File System'];
        home_dirs.forEach(dir => {

            let home_view_item = document.createElement('div');
            home_view_item.classList.add('home', 'item');

            let icon_arr_item = icons[home_dirs.indexOf(dir)];
            let icon_div = document.createElement('div');
            icon_div.classList.add('icon');

            let icon_i = document.createElement('i');
            icon_i.classList.add('bi', `bi-${icon_arr_item}`);

            icon_div.appendChild(icon_i);

            let link_div = document.createElement('div');
            link_div.innerHTML = dir;

            home_view_item.append(icon_div, link_div);
            this.home_view.append(home_view_item);

            // home_view_item.dataset.href = `${utilities.home_dir}/${dir}`;

            home_view_item.addEventListener('click', (e) => {
                let home_dir = `${utilities.home_dir}`;
                switch (dir) {
                    case 'Home':
                        if (e.ctrlKey) {
                            tabManager.add_tab(home_dir);
                            fileManager.get_files(`${home_dir}`);
                        } else {
                            tabManager.add_tab_history(`${home_dir}`);
                            fileManager.get_files(`${home_dir}`);
                        }
                        break;
                    case 'Recent':
                        if (e.ctrlKey) {
                            tabManager.add_tab(home_dir);
                            ipcRenderer.send('get_recent_files');
                        } else {
                            ipcRenderer.send('get_recent_files');
                        }
                        break;
                    case 'File System':
                        if (e.ctrlKey) {
                            tabManager.add_tab('/');
                            fileManager.get_files(`/`);
                        } else {
                            tabManager.add_tab_history('/');
                            fileManager.get_files(`/`);
                        }
                        break;
                    case 'Dashboard':
                        fileManager.get_dashboard_view();
                        break;
                    default:
                        if (e.ctrlKey) {
                            tabManager.add_tab(`${home_dir}/${dir}`);
                            fileManager.get_files(`${home_dir}/${dir}`);
                        } else {
                            tabManager.add_tab_history(`${home_dir}/${dir}`);
                            fileManager.get_files(`${home_dir}/${dir}`);
                        }
                        break;
                }

            });

            home_view_item.addEventListener('contextmenu', (e) => {
                ipcRenderer.send('home_menu', dir);
                home_view_item.classList.add('highlight_select');
            });

            // fileManager.handleTitle(home_view_item, )

        });

    }

    // init sidebar
    init_sidebar() {
        // Get references to the resize handle element
        this.drag_handle = document.querySelector(".sidebar_draghandle");

        // Only start resizing if mousedown is on the drag handle
        this.drag_handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.start_resize(e);
        });
        document.addEventListener('mousemove', (e) => this.resize(e));
        document.addEventListener('mouseup', (e) => this.stop_resize(e));

        // resize sidebar width
        let window_settings = ipcRenderer.sendSync('get_window_settings');
        if (window_settings.sidebar_width) {
            this.sidebar.style.width = `${window_settings.sidebar_width}px`;
        }
    }

    // handle sidebar resize
    start_resize(e) {
        this.is_resizing = true;
        this.sidebar = document.querySelector('.sidebar');
        this.main = document.querySelector('.main');
        // Get the initial widths of sidebar and main divs
        this.initialSidebarWidth = this.sidebar.offsetWidth;
        this.initialMainWidth = this.main.offsetWidth;
        // Get the initial mouse position
        this.initialMousePos = e.clientX;
        this.main.classList.add('margin_left');
    }

    // resize sidebar
    resize(e) {
        if (!this.is_resizing) return;
        // Calculate the distance the mouse has been moved
        this.distanceMoved = e.clientX - this.initialMousePos;
        // Enforce a minimum sidebar width (e.g., 180px)
        const minSidebarWidth = 180;
        this.newSidebarWidth = Math.max(this.initialSidebarWidth + this.distanceMoved, minSidebarWidth);
        this.newMainWidth = this.initialMainWidth - (this.newSidebarWidth - this.initialSidebarWidth);
        // Update the sidebar width
        this.sidebar.style.width = `${this.newSidebarWidth}px`;
        // Update the main width
        if (this.newSidebarWidth < 500) {
            this.main.style.width = `${this.newMainWidth}px`;
        }
    }

    // stop the resizing
    stop_resize(e) {

        if (!this.is_resizing) return;

        this.is_resizing = false;

        let window_settings = ipcRenderer.sendSync('get_window_settings');
        window_settings.sidebar_width = this.newSidebarWidth;
        window_settings.main_width = this.newMainWidth;
        ipcRenderer.send('update_window_settings', window_settings);

        // console.log('window settings', window_settings);


    }

}

class KeyBoardManager {

    constructor() {

        // add event listener for keydown
        document.addEventListener('keydown', (e) => {

            // e.preventDefault();
            // e.stopPropagation();

            // prevent inputs from firing global keyboard events
            // if (section == 2 || (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.classList.contains('input_div'))) {
            //     return;
            // }



            if (section == 2) {
                return;
            }

            // ctrl + r to refresh
            if (e.ctrlKey && e.key.toLocaleLowerCase() === 'r') {
                e.preventDefault();
                e.stopPropagation();
                ipcRenderer.send('reload');
            }

            // ctrl + l to focus location
            if (e.ctrlKey && e.key.toLocaleLowerCase() === 'l') {
                e.preventDefault();
                e.stopPropagation();
                utilities.show_location_input();
            }

            // ctrl/cmd + f to toggle find form
            if ((e.ctrlKey || e.metaKey) && e.key.toLocaleLowerCase() === 'f') {
                e.preventDefault();
                e.stopPropagation();
                if (fileManager && typeof fileManager.get_find_view === 'function') {
                    fileManager.get_find_view();
                }
                return;
            }

            // esc to deselect all
            if (e.key === 'Escape') {
                if (fileManager && typeof fileManager.close_find_view === 'function') {
                    const closed_find = fileManager.close_find_view();
                    if (closed_find) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                }
                e.preventDefault();
                e.stopPropagation();
                utilities.clear();
            }

            // ctrl + a to select all
            if (e.ctrlKey && e.key.toLocaleLowerCase() === 'a') {
                e.preventDefault();
                e.stopPropagation();
                utilities.select_all();
            }

            // ctrl + c to copy
            if (e.ctrlKey && e.key.toLocaleLowerCase() === 'c') {
                const selected_files = utilities.get_selected_files();
                if (selected_files.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    utilities.copy();
                }
            }

            // ctrl + v to paste
            if (e.ctrlKey && e.key.toLocaleLowerCase() === 'v') {
                utilities.paste();
            }

            // ctrl + x to cut
            if (e.ctrlKey && e.key.toLocaleLowerCase() === 'x') {
                e.preventDefault();
                e.stopPropagation();
                utilities.cut();
            }

            // ctrl + shift + n to create a new folder
            if (e.ctrlKey && e.shiftKey && e.key.toLocaleLowerCase() === 'n') {
                e.preventDefault();
                e.stopPropagation();
                utilities.mkdir();
            }

            // ctrl + shift + e to extract
            if (e.ctrlKey && e.shiftKey && e.key.toLocaleLowerCase() === 'e') {
                e.preventDefault();
                e.stopPropagation();
                utilities.extract();
            }

            // ctrl + shift + c to compress
            if (e.ctrlKey && e.shiftKey && e.key.toLocaleLowerCase() === 'c') {
                e.preventDefault();
                e.stopPropagation();
                utilities.compress('zip');
            }

            // del to delete
            if (e.key === 'Delete' && !e.target.isContentEditable && !e.target.tagName === 'INPUT') {
                e.preventDefault();
                e.stopPropagation();
                utilities.delete();
            }

            // f2 to rename
            if (e.key === 'F2') {
                e.preventDefault();
                e.stopPropagation();
                utilities.edit();
            }

            // f5 to refresh
            if (e.key === 'F5') {
                e.preventDefault();
                e.stopPropagation();
                fileManager.get_files(utilities.get_location());
            }

            // ctrl + t
            if (e.ctrlKey && e.key.toLocaleLowerCase() === 't') {
                e.preventDefault();
                e.stopPropagation();
                ipcRenderer.send('ls', utilities.get_location(), true);
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                const active = document.activeElement;
                const is_input_like = active && (
                    active.tagName === 'INPUT' ||
                    active.tagName === 'TEXTAREA' ||
                    active.isContentEditable
                );

                if (!is_input_like) {
                    e.preventDefault();
                    fileManager.handleInitKeyNav();
                }
            }

        })

        // add event listener for keyup
        document.addEventListener('keyup', (e) => {

            // e.preventDefault();
            // e.stopPropagation();

            // prevent inputs from firing global keyboard events
            // if (e.ctrlKey) {
            // utilities.set_msg('');
            // }


        })

    }



}

class IconManager {

    constructor() {

        this.readonly_icon = '';
        this.settings = settingsManager.get_settings();


        // listen for set_folder_icon event
        ipcRenderer.on('set_folder_icon', (e, href, icon) => {
            this.set_folder_icon(href, icon);
        });

        // listen for set_icon event
        ipcRenderer.on('set_icon', (e, href, icon) => {
            this.set_icon(href, icon);
        });

        ipcRenderer.on('icon_theme_changed', () => {
            this.refresh_visible_icons();
        });

        // resize icons on wheel event
        document.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                const allow_wheel_resize = settingsManager.get_schema_setting('Ctrl+Wheel Resize Icons')?.default;
                if (!allow_wheel_resize) {
                    return;
                }

                const view_type = fileManager?.view === 'list_view' ? 'list_view' : 'grid_view';
                const current_size = this.get_icon_size_for_view(view_type);
                if (e.deltaY < 0) {

                    // increase current icon size by n pixels
                    if (current_size >= 128) {
                        return;
                    }

                    this.resize_icons(current_size + 16, view_type);

                } else {

                    // decrease current icon size by n pixels
                    if (current_size <= 16) {
                        return;
                    }

                    this.resize_icons(current_size - 16, view_type);
                }
            }
        });

    }

    // get icons
    get_icons() {

        // console.log('running get icons');

        let items = document.querySelectorAll('tr');
        items.forEach(item => {
            // console.log('get icon', item.dataset.is_dir, item.dataset.href);
            if (item.dataset.is_dir === 'true') {
                ipcRenderer.send('get_folder_icon', item.dataset.href);
            } else {
                try {
                    ipcRenderer.invoke('get_icon', item.dataset.href).then(icon => {
                        this.set_icon(item.dataset.id, icon);
                    });
                } catch (err) {

                }
            }
        });

        utilities.lazy_load_icons(document.querySelector('.table'));

    }

    // get readonly_icon
    get_readonly_icon() {
        return this.readonly_icon;
    }

    is_in_viewport(element) {
        if (!element) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return (
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.left <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    refresh_visible_icons() {
        const active_tab_content = document.querySelector('.active-tab-content');
        if (!active_tab_content) {
            return;
        }

        const items = active_tab_content.querySelectorAll('.card[data-href], tr[data-href]');

        items.forEach((item) => {
            const href = item.dataset.href;
            if (!href) {
                return;
            }

            const is_dir = item.dataset.is_dir === 'true';
            if (is_dir) {
                ipcRenderer.send('get_folder_icon', href);
                return;
            }

            const icon = item.querySelector('.icon');
            const img = icon ? icon.querySelector('img.img') : null;
            if (!img) {
                return;
            }

            const current_src = img.getAttribute('src') || '';
            if (current_src === href || current_src.startsWith('file://')) {
                return;
            }

            img.dataset.iconHref = href;

            if (!this.is_in_viewport(item)) {
                img.dataset.src = '';
                img.classList.add('lazy');
                return;
            }

            ipcRenderer.invoke('get_icon', href).then((next_icon) => {
                if (!next_icon) {
                    return;
                }

                img.dataset.src = next_icon;
                img.src = next_icon;
                img.classList.remove('lazy');
            }).catch(() => {
            });
        });

        utilities.lazy_load_icons(active_tab_content);
    }

    get_media_icon_selector() {
        return '.icon > img.img, .icon > video.video';
    }

    apply_icon_size_to_media(media, view_type) {
        if (!media) {
            return;
        }

        const size = this.get_icon_size_for_view(view_type);
        media.style.width = `${size}px`;
        media.style.height = `${size}px`;
    }

    apply_icon_size_to_container(view_container, view_type) {
        if (!view_container) {
            return;
        }

        view_container.querySelectorAll(this.get_media_icon_selector()).forEach((media) => {
            this.apply_icon_size_to_media(media, view_type);
        });
    }

    // set icon
    set_icon(id, icon) {
        let item = document.querySelector(`[data-id="${id}"]`);
        if (item) {
            let icon_div = item.querySelector('.icon');
            let img = icon_div.querySelector('img');
            img.dataset.src = icon;
        }
    }

    // set folder icon
    set_folder_icon(href, icon) {

        try {

            let tab_content = document.querySelectorAll('.tab-content');
            if (tab_content.length == 0) {
                console.log('Error: No tab content found');
                return;
            }

            // get active tab content
            tab_content.forEach(t => {
                let icon_div = t.querySelector(`[data-href="${href}"]`);
                if (!icon_div) {
                    console.log('Error: Setting folder icon div');
                    return;
                }
                let img = icon_div.querySelector('img');
                if (img) {

                    img.src = icon;
                    const view_container = img.closest('.view_container');
                    const view_type = view_container?.classList.contains('list_view') ? 'list_view' : 'grid_view';
                    this.apply_icon_size_to_media(img, view_type);

                }

            })

            // let active_tab_content = tabManager.get_active_tab_content();
            // let icon_div = active_tab_content.querySelector(`[data-href="${href}"]`);
            // if (!icon_div) {
            //     console.log('Error: Setting folder icon div');
            //     return;
            // }
            // let img = icon_div.querySelector('img');
            // if (img) {

            //     img.src = icon;
            //     img.style.width = `${this.icon_size}px`;
            //     img.style.height = `${this.icon_size}px`;

            // }



        } catch (err) {
            utilities.set_msg('Error setting folder icon', err);
        }

    }

    get_icon_size_for_view(view_type) {
        const settings = settingsManager.get_settings();
        if (view_type === 'list_view') {
            return parseInt(settings.list_icon_size, 10) || 24;
        }
        return parseInt(settings.icon_size, 10) || 32;
    }

    // resize icons
    resize_icons(size, view_type = 'grid_view') {

        this.settings = settingsManager.get_settings();

        let selector = `.grid_view ${this.get_media_icon_selector()}`;
        if (view_type === 'list_view') {
            selector = `.list_view ${this.get_media_icon_selector()}`;
        }

        let items = document.querySelectorAll(selector);
        items.forEach(item => {
            item.style.width = `${size}px`;
            item.style.height = `${size}px`;
        })

        if (view_type === 'list_view') {
            this.settings.list_icon_size = size;
            settingsManager.set_schema_setting('List Icon Size', String(size));
        } else {
            this.settings.icon_size = size;
            settingsManager.set_schema_setting('Grid Icon Size', String(size));
        }
        settingsManager.update_settings(this.settings);

    }

}

class TabManager {

    constructor() {

        this.tab_data = {
            tab_id: 1,
            files_arr: []
        }
        this.tab_data_arr = [];

        this.tabs = [];
        this.tab_history_arr = [];
        this.tab_history_idx_arr = [];

        this.tab_id = 0;

        this.location_input = document.querySelector('.location');
        if (!this.location_input) {
            return;
        }

        this.settings = settingsManager.get_settings();

        this.main = document.querySelector('.main')
        this.tabHeader = document.querySelector('.tab-header');
        this.tabHeader.classList.add('flex')
        this.main.append(this.tabHeader);

        this.back_btn = document.querySelector('.back');
        this.forward_btn = document.querySelector('.forward');

        this.back_btn.classList.add('disabled')
        this.forward_btn.classList.add('disabled')

        // this.back_btn.style = 'pointer-events: none';
        // this.tab_history_idx = 0;
        this.back_btn.addEventListener('click', (e) => {
            this.tabHistoryBack(this.tab_id);
        })

        this.forward_btn.addEventListener('click', (e) => {
            this.tabHistoryForward(this.tab_id);
        })

        // Context menu
        this.back_btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.getTabHistory(this.tab_id, 0);
        })

        this.forward_btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.getTabHistory(this.tab_id, 1);
        })

        // enable back button
        ipcRenderer.on('enable_back_button', (e) => {
            this.enable_back_button();
        })

        // disable back button
        ipcRenderer.on('disable_back_button', (e) => {
            this.disable_back_button();
        });

        // enable forward button
        ipcRenderer.on('enable_forward_button', (e) => {
            this.enable_forward_button();
        });

        // disable forward button
        ipcRenderer.on('disable_forward_button', (e) => {
            this.disable_forward_button();
        });

    }

    // set tab data array
    set_tab_data_arr(files_arr) {

        // check if tab data exists
        let tab_data = this.tab_data_arr.find(tab_data => tab_data.tab_id === this.tab_id);
        if (tab_data) {
            tab_data.files_arr = files_arr;
        } else {
            this.tab_data = {
                tab_id: this.tab_id,
                files_arr: files_arr
            }
            this.tab_data_arr.push(this.tab_data);
        }

        // console.log('tab data arr', this.tab_data_arr);

    }

    // get tab data array
    get_tab_data_arr(tab_id) {

        let id = parseInt(tab_id);
        let tab_data = this.tab_data_arr.find(tab_data => tab_data.tab_id === id);
        if (tab_data) {
            return tab_data.files_arr;
        } else {
            return [];
        }

    }

    // remove tab data
    remove_tab_data(tab_id) {
        let id = parseInt(tab_id);
        let tab_data = this.tab_data_arr.find(tab_data => tab_data.tab_id === id);
        if (tab_data) {

            let idx = this.tab_data_arr.indexOf(tab_data);
            this.tab_data_arr.splice(idx, 1);
        }
        // console.log('removing tab data', this.tab_data_arr, id);
    }

    // get active_tab_content div
    get_active_tab_content() {
        return this.active_tab_content;
    }

    get_tabs_content() {
        return this.main.querySelectorAll('.tab-content');
    }

    // clear highlight tabs
    clear_highlight() {
        let tabs = document.querySelectorAll('.tab');
        if (tabs.length > 0) {
            tabs.forEach(tab => {
                tab.classList.remove('highlight');
            })
        }
    }

    /**
     *
     * @param {string} location
     * @returns
     */
    add_tab(location) {

        ++this.tab_id;

        // validate location
        // regex to validate location
        let regex = /^(\/[a-zA-Z0-9_]+)+$/;
        if (location == regex.test(location) || location === undefined || location === null || location === '') {
            utilities.set_msg('Error adding tab. Invalid location');
            return;
        }

        let label = utilities.get_base_name(location);

        // struct for tracking tab history idx
        this.tab_idx_obj = {
            tab_id: this.tab_id,
            tab_idx: 0
        }
        this.tab_history_idx_arr.push(this.tab_idx_obj);

        // let location = document.querySelector('.location');
        let tab = utilities.add_div(['tab', 'flex']);
        let tab_content = utilities.add_div(['tab-content']);
        let col1 = utilities.add_div(['label']);
        let col2 = utilities.add_div(['tab_close']);
        let btn_close = document.createElement('i');

        // set active tab content
        this.active_tab_content = tab_content;

        tab.title = location;
        tab.dataset.id = this.tab_id;
        tab.dataset.href = location;
        tab_content.dataset.id = this.tab_id;

        tab.draggable = true;

        col1.innerHTML = label;
        btn_close.classList.add('bi', 'bi-x');

        col2.append(btn_close);
        tab.append(col1, col2);

        this.tabHeader.append(tab);

        this.tabs.push(this.tab_id);
        this.main.append(tab_content)

        this.clearActiveTabs();
        tab.classList.add('active-tab');
        tab_content.classList.add('active-tab-content');
        tab_content.classList.remove('hidden');

        ipcRenderer.send('add_tab', location, this.tab_id);

        // Close Tab
        btn_close.addEventListener('click', (e) => {
            e.stopPropagation();
            let current_tabs = document.querySelectorAll('.tab');
            let current_tab_content = document.querySelectorAll('.tab-content');
            let active_tab = document.querySelector('.active-tab');
            let tab_id = tab.dataset.id;

            if (active_tab === tab) {

                if (current_tabs.length > 0) {

                    let tabs = document.querySelectorAll('.tab');
                    let idx = Array.from(tabs).indexOf(tab) - 1

                    if (idx >= 0) {

                        current_tabs[idx].classList.add('active-tab');
                        current_tab_content[idx].classList.add('active-tab-content');
                        current_tab_content[idx].classList.remove('hidden');
                        this.tab_id = idx + 1;

                        // update active tab content
                        this.active_tab_content = current_tab_content[idx];

                        // update global location
                        utilities.set_location(current_tabs[idx].dataset.href);

                        this.remove_tab_data(tab.dataset.id);
                        tab_content.remove();
                        tab.remove();

                        // Remove tab from tabs.json
                        ipcRenderer.send('remove_tab', tab_id);

                    }

                }

            } else {
                if (current_tabs.length > 0) {

                    this.remove_tab_data(tab.dataset.id);
                    tab_content.remove();
                    tab.remove();

                    // Remove tab from tabs.json
                    ipcRenderer.send('remove_tab', tab_id);

                }
            }

            const latest_settings = settingsManager.get_settings() || {};
            if (!Array.isArray(latest_settings.tabs)) {
                latest_settings.tabs = [];
            }

            // find index of tab to be removed from settings
            const idx = latest_settings.tabs.findIndex(settings_tab =>
                parseFloat(tab.dataset.id) === parseFloat(settings_tab.tab.id)
            );

            // remove item from settings
            if (idx !== -1) {
                latest_settings.tabs.splice(idx, 1); // removes 1 element at that index
            }

            // console.log('removed item', latest_settings);
            settingsManager.update_settings(latest_settings);



        })

        // Switch Tabs
        tab.addEventListener('click', (e) => {

            // console.log('switch tab')
            e.preventDefault()

            this.clearActiveTabs();

            tab.classList.add('active-tab');
            tab_content.classList.add('active-tab-content');
            tab_content.classList.remove('hidden');

            // set active tab content
            this.active_tab_content = tab_content;

            this.tab_id = parseInt(tab.dataset.id);
            this.tab_history_idx = 0;


            settingsManager.set_location(tab.dataset.href);
            utilities.set_location(tab.dataset.href);
            utilities.set_destination(tab.dataset.href);
            utilities.hide_location_input();
            fileManager.get_breadcrumbs(tab.dataset.href);

            // set local destination
            this.destination = tab.dataset.href;

            ipcRenderer.send('switch_tab', this.tab_id);

            // update disk space
            utilities.get_disk_space(tab.dataset.href);

            // navigation.getCardCount(); // get new card count for navigation
            // navigation.getCardGroups();

        })

        let tabs = document.querySelectorAll('.tab');

        // Handle Tab Dragging ////////////////////////////
        const selectionRectangle = document.querySelector('.selection-rectangle');
        let draggingTab = null;
        tabs.forEach(tab => {

            // Drag Start
            tab.addEventListener("dragstart", (e) => {
                e.stopPropagation();
                utilities.is_dragging = true;
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
                this.clear_highlight();
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

        // drop for active tab content
        tab_content.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // tab_content.classList.add('highlight');
        });

        tab_content.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // tab_content.classList.remove('highlight');
        })

        // tab_content.addEventListener('drop', (e) => {
        //     e.preventDefault();
        //     e.stopPropagation();
        //     if (e.ctrlKey) {
        //         alert('2680 fix me - tab_content.addEventListener drop');
        //         console.log('2680 fix me - tab_content.addEventListener drop');
        //         // utilities.copy();
        //         // console.log('dropping on tab content', e);
        //     }
        // })

        // navigation.getCardCount(); // get new card count for navigation
        // navigation.getCardGroups();

        // if (label !== 'Home' && label !== 'Settings' && label !== 'Recent' && label !== 'Search Results') {
        //     this.addTabHistory(this.location_input.value);
        // }

        // ipcRenderer.send('switch_tab', this.tab_id);

        // this.settings.tabs = [];
        dragSelect.initialize();

    }

    // switch tab
    switch_tab(tab_id) {
        let tab = document.querySelector(`.tab[data-id="${tab_id}"]`);
        if (tab) {
            tab.click();
        }
    }

    // update tab
    update_tab(location) {

        let tab = document.querySelector('.active-tab');
        if (!tab) {
            utilities.set_msg(`Error: Invalid tag ${tag} in update_tag.`);
            return;
        }
        let col1 = tab.querySelector('.label');

        const latest_settings = settingsManager.get_settings() || {};
        if (!Array.isArray(latest_settings.tabs)) {
            latest_settings.tabs = [];
        }

        if (latest_settings.tabs.length > 0) {
            let is_update = 0;
            latest_settings.tabs.forEach(settings_tab => {

                // if id's match then update the existing one
                if (parseInt(tab.dataset.id) === parseInt(settings_tab.tab.id)) {

                    settings_tab.tab.id = this.tab_id;
                    settings_tab.tab.location = location;
                    is_update = 1;
                }
            })

            if (!is_update) {

                let settings_tab = {
                    id: this.tab_id,
                    location: location
                }
                latest_settings.tabs.push({ "tab": settings_tab });
            }

        } else {

            if (latest_settings.tabs) {
                let settings_tab = {
                    id: this.tab_id,
                    location: location
                }
                latest_settings.tabs.push({ "tab": settings_tab });
            }

        }

        // settingsManager.update_settings(this.settings);
        // console.log('tabs', latest_settings.tabs);
        settingsManager.update_settings(latest_settings);

        tab.title = location;
        tab.dataset.href = location
        let label = utilities.get_base_name(location);
        col1.innerHTML = label;

    }

    get_tabs() {
        let settings = settingsManager.get_settings();
        let tabs = settings.tabs;
        return tabs;
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

    // add tab history
    add_tab_history(href) {

        // console.log('add tab history', href, this.tab_id,);

        if (href === undefined || href === null) {
            return;
        }

        ipcRenderer.send('add_tab_history', href, this.tab_id);

    }

    // enable back button
    enable_back_button() {
        this.back_btn.classList.remove('disabled')
        this.back_btn.style = 'pointer-events: auto';
    }

    // disable back button
    disable_back_button() {
        this.back_btn.classList.add('disabled')
        this.back_btn.style = 'pointer-events: none';
    }

    // enable forward button
    enable_forward_button() {
        this.forward_btn.classList.remove('disabled')
        this.forward_btn.style = 'pointer-events: auto';
    }

    // disable forward button
    disable_forward_button() {
        this.forward_btn.classList.add('disabled')
        this.forward_btn.style = 'pointer-events: none';
    }

    // get tab history
    getTabHistory(tab_id, direction = 0) {

        // console.log('get tab history', tab_id, direction);

        // ipcRenderer.invoke('get_tab_history').then(history => {
        // // this.tab_history_arr = history;
        // let tab_history = this.tab_history_arr.filter(item => item.tab_id === parseInt(tab_id));
        // if (tab_history.length === 0) {
        //     return;
        // }

        // if (direction === 1) {
        //     tab_history.reverse();
        // }

        // // Create the popup element
        // const popup = document.createElement('div');
        // popup.classList.add('history-popup'); // Add a CSS class for styling

        // // Create the title
        // const title = document.createElement('h2');
        // title.textContent = 'Navigation History';

        // // Create the list of history items
        // tab_history.forEach((item, idx) => {

        //     // if (idx > 0) {

        //     const menu_item = utilities.add_div(['item']);
        //     menu_item.textContent = item.location;
        //     popup.append(menu_item);

        //     menu_item.addEventListener('click', (e) => {
        //         fileManager.get_files(item.location);
        //         // this.history_idx = this.historyArr.length - 1;
        //         utilities.clear_highlight();
        //     })

        //     // }

        // });

        // popup.addEventListener('mouseleave', (e) => {
        //     popup.remove();
        // })

        // // Determine position based on space below and above
        // const windowHeight = window.innerHeight;
        // const popupHeight = popup.offsetHeight;
        // const triggerElement = this.back_btn // Replace with your trigger element
        // const triggerRect = triggerElement.getBoundingClientRect();
        // const triggerTop = triggerRect.top;
        // const spaceBelow = windowHeight - (triggerTop + triggerRect.height);
        // const spaceAbove = triggerTop;

        // if (spaceBelow > popupHeight) {
        //     popup.style.top = triggerTop + triggerRect.height + 10 + 'px';
        // } else if (spaceAbove > popupHeight) {
        //     popup.style.top = triggerTop - popupHeight + 'px';
        // } else {
        //     // Handle cases where neither direction has enough space
        //     // console.warn('Not enough space to display popup!');
        // }
        // popup.style.left = triggerRect.left + 10 + 'px';

        // // Append the popup to the body
        // const nav_menu = document.querySelector('.navigation');
        // nav_menu.appendChild(popup);

        // // console.log(this.historyArr)
        // return tab_history;

        // })

    }

    // get history idx by tab
    getTabHistoryIdx(tab_id) {
        // let tab_history_idx = 0;
        // this.tab_history_idx_arr.forEach(item => {
        //     if (item.tab_id === tab_id) {
        //         tab_history_idx = item.tab_idx;
        //         return;
        //     }
        // })
        // return tab_history_idx;
    }

    // set history idx by tab
    setTabHistoryIdx(tab_id, idx) {

        // this.tab_history_idx_arr.forEach(item => {
        //     if (item.tab_id === tab_id) {
        //         item.tab_idx = idx;
        //         return;
        //     }
        // })

    }

    // tab history back
    tabHistoryBack(tab_id) {
        ipcRenderer.send('go_back', tab_id);
    }

    // tab history forward
    tabHistoryForward(tab_id) {
        ipcRenderer.send('go_forward', tab_id);
    }

}

class FileManager {

    constructor() {

        // this.events = [];
        // this.tabManager = tabManager;
        // this.iconManager = iconManager;

        this.schema = null;
        this.show_hidden = false;

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

        // Utility: check if focus is in an editable field
        this.isInputLike = function (el) {
            if (!el) return false;
            const tag = el.tagName ? el.tagName.toLowerCase() : '';
            return (
                tag === 'input' ||
                tag === 'textarea' ||
                el.isContentEditable === true
            );
        };

        this.main = document.querySelector('.main');
        if (!this.main) {
            // console.log('error getting main');
            return;
        }

        // get view settings
        this.view = settingsManager.get_view_settings();
        // console.log('file manager default view', this.view);

        if (settingsManager.get_location() === '') {
            this.location = utilities.home_dir;
        } else {
            this.location = settingsManager.get_location();
        }

        if (this.location === '' || this.location === undefined) {
            utilities.set_msg('error getting location');
        }

        // console.log('file manager location', this.location);

        // this.get_files(this.location);
        let tabs = tabManager.get_tabs();
        if (tabs.length > 0) {
            tabs.forEach(tab => {
                // tabManager.add_tab(tab.tab.location);
                this.get_files(tab.tab.location, true);
            })
        }

        this.filter = document.querySelector('.filter');
        this.find_view_button = document.querySelector('.find_menu .button.find');
        if (this.find_view_button) {
            this.find_view_button.addEventListener('click', () => {
                this.toggle_find_view();
            });
        }
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
        this.sort_by = settingsManager.get_schema_setting('Sort By')?.default;
        this.sort_direction = settingsManager.get_schema_setting('Sort Direction')?.default;

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

        // get dashboard view
        ipcRenderer.on('get_dashboard_view', (e) => {
            this.get_dashboard_view();
        })

        // sort menu
        ipcRenderer.on('sort_by', (e, sort, sort_direction) => {

            // console.log('sort by', sort, sort_direction)

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
            const latest_settings = settingsManager.get_settings() || {};
            if (latest_settings?.schema?.properties?.['Default View']?.properties?.['Sort By']) {
                latest_settings.schema.properties['Default View'].properties['Sort By'].default = this.sort_by;
            }
            if (latest_settings?.schema?.properties?.['Default View']?.properties?.['Sort Direction']) {
                latest_settings.schema.properties['Default View'].properties['Sort Direction'].default = this.sort_direction;
            }
            latest_settings.sort_by = this.sort_by;
            latest_settings.sort_direction = this.sort_direction;
            settingsManager.update_settings(latest_settings);
            this.settings = latest_settings;

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

             if (view === this.view) {
                return;
            }

            this.view = view;

            let tab_contents = document.querySelectorAll('.tab-content');
            tab_contents.forEach(tab_content => {
                let tab = document.querySelector(`.tab[data-id="${tab_content.dataset.id}"]`);
                if (tab && tab.dataset.href === 'Settings') {
                    return;
                }

                let v = tab_content.querySelector('.view_container');
                if (!v) {
                    return;
                }

                // Never transform non-file special views.
                if (v.classList.contains('settings_view')) {
                    return;
                }

                this.apply_view_settings_to_container(v, this.view);
                iconManager.apply_icon_size_to_container(v, this.view);

            });

            const latest_settings = settingsManager.get_settings() || {};
            latest_settings.view = this.view;

            if (latest_settings?.schema?.properties?.['Default View']?.properties?.View) {
                latest_settings.schema.properties['Default View'].properties.View.default = this.view;
            }

            settingsManager.update_settings(latest_settings);
            this.settings = latest_settings;

        });

        // Get files
        ipcRenderer.on('get_files', (e, location) => {
            this.get_files(location);
        });

        // get files
        ipcRenderer.on('ls_done', (e, files_arr, new_tab) => {

            console.log('running ls done');

            this.files_arr = files_arr;
            if (this.view === '' || this.view === undefined) {
                utilities.set_msg('Error: View is undefined');
            }

            if (new_tab) {

                if (files_arr.length > 0) {
                    this.location = files_arr[0].location;
                }

                tabManager.add_tab(this.location);
                utilities.set_location(this.location);

                // // set location in settings, utilities and breadcrumbs
                // // this handles unreachable paths on startup or when a valid location becomes unreachable
                // // get_ls(location, add_tab) in main will set the location back to home dir
                // settingsManager.set_location(this.location);
                // utilities.set_destination(this.location);
                // this.get_breadcrumbs(this.location);

            }

            // set location in settings, utilities and breadcrumbs
            // this handles unreachable paths on startup or when a valid location becomes unreachable
            // get_ls(location, add_tab) in main will set the location back to home dir
            settingsManager.set_location(this.location);
            utilities.set_destination(this.location);
            this.get_breadcrumbs(this.location);

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
            const active_tab_content = tabManager.get_active_tab_content();
            if (active_tab_content) {
                utilities.lazy_load_icons(active_tab_content);
            }

        });

        // get item
        ipcRenderer.on('get_item', (e, f) => {

            // console.log('get_item', f);

            // get active tab
            let active_tab_content = tabManager.get_active_tab_content();
            if (!active_tab_content) {
                utilities.set_msg('Error: Getting active tab content');
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
                utilities.set_msg('Error: Getting view container');
                return;
            }

            // get view item
            item = this.get_view_item(f);
            if (!item) {
                utilities.set_msg('Error: Getting view item');
                return;
            }

            if (this.view === 'grid_view') {

                // insert item at top of view container
                view_container.prepend(item);

            } else if (this.view === 'list_view') {

                // insert item below header
                let header = view_container.querySelector('.list_view_header');
                if (!header) {
                    utilities.set_msg('Error: Getting list view header');
                    return;
                }
                view_container.insertBefore(item, header.nextSibling);

            }

            utilities.lazy_load_icons(active_tab_content);


        });

        // edit item mode
        ipcRenderer.on('edit_item', (e, f) => {

            // console.log('edit_item', f);

            if (f.id === undefined || f.id === null) {
                utilities.set_msg('Error: Getting file id');
                return;
            }

            let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
            let item = active_tab_content.querySelector(`[data-id="${f.id}"]`);
            if (!item) {
                // console.log('error getting data-id', f.id);
                utilities.set_msg(`Error: Getting  data-id ${f.id}`);
                return;
            }

            let edit_name = item.querySelector('.href');
            if (edit_name) {
                const href_div = item.querySelector('.href_div');
                if (href_div) {
                    href_div.classList.add('hidden');
                }
                edit_name.classList.add('hidden');
            } else {
                // console.log('error getting edit name');
                utilities.set_msg('Error: Getting edit name');
                return;
            }

            let input = item.querySelector('input');
            if (input) {
                const input_div = item.querySelector('.input_div');
                if (input_div) {
                    input_div.classList.remove('hidden');
                }
                input.classList.remove('hidden');

                input.focus();
                input.setSelectionRange(0, input.value.lastIndexOf('.'));

                input.addEventListener('blur', (e) => {
                    e.preventDefault();
                    input.focus();
                });

            } else {
                // console.log('error getting input');
                utilities.set_msg('Error: Getting input');
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
                utilities.set_msg('Error: Getting file id');
                // console.log('error getting file id');
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
                // utilities.set_msg(`Error: Removing item ${id}`);
                // console.log('error removing item', id);
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

        ipcRenderer.on('overwrite_copy', (e, overwrite_arr) => {
            this.show_overwrite_view(overwrite_arr, 'copy');
        });

        ipcRenderer.on('overwrite_move', (e, overwrite_arr) => {
            this.show_overwrite_view(overwrite_arr, 'move');
        });

        ipcRenderer.on('recent_files', (e, files_arr) => {
            tabManager.add_tab('Recent');
            this.get_view(files_arr);
        });

    }

    get_active_find_panel() {
        const active_tab_content = tabManager.get_active_tab_content();
        if (!active_tab_content) {
            return null;
        }
        return active_tab_content.querySelector('.find_panel');
    }

    restore_list_view_header_handlers(container) {
        if (!container) {
            return;
        }

        const header = container.querySelector('.list_view_header');
        if (!header) {
            return;
        }

        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.show_column_menu(e);
        });

        header.querySelectorAll('.sort_column').forEach((col) => {
            this.handleSort(col);
        });
    }

    close_find_view() {
        const active_tab_content = tabManager.get_active_tab_content();
        if (!active_tab_content) {
            return false;
        }

        const find_main_container = active_tab_content.querySelector('.find_main_container');
        const find_panel = active_tab_content.querySelector('.find_panel');
        if (!find_panel && !find_main_container) {
            return false;
        }

        // If find was opened as an overlay panel (no find_main_container),
        // remove only the panel so existing DOM listeners remain intact.
        if (!find_main_container && find_panel) {
            find_panel.remove();
            if (active_tab_content.dataset.savedContent) {
                delete active_tab_content.dataset.savedContent;
            }
            return true;
        }

        let restored_from_saved = false;

        const fallback_view = find_main_container?.querySelector('.find_results_window > .view_container');
        if (fallback_view) {
            active_tab_content.innerHTML = '';
            active_tab_content.appendChild(fallback_view);
            if (active_tab_content.dataset.savedContent) {
                delete active_tab_content.dataset.savedContent;
            }
            if (Array.isArray(this.files_arr) && this.files_arr.length > 0) {
                this.lazy_load_files(this.files_arr);
            }
            return true;
        }

        const saved = active_tab_content.dataset.savedContent;
        if (saved) {
            try {
                active_tab_content.innerHTML = atob(saved);
                delete active_tab_content.dataset.savedContent;
                restored_from_saved = true;

                // Saved HTML may contain lazy placeholders; hydrate restored cards.
                if (Array.isArray(this.files_arr) && this.files_arr.length > 0) {
                    this.lazy_load_files(this.files_arr);
                }
            } catch (e) {
                active_tab_content.innerHTML = '<div>Unable to restore view.</div>';
            }
        } else if (find_main_container) {
            const fallback_view = find_main_container.querySelector('.find_results_window .view_container');
            active_tab_content.innerHTML = '';
            if (fallback_view) {
                active_tab_content.appendChild(fallback_view);
                if (Array.isArray(this.files_arr) && this.files_arr.length > 0) {
                    this.lazy_load_files(this.files_arr);
                }
            }
        } else {
            find_panel.remove();
        }

        if (restored_from_saved) {
            this.restore_list_view_header_handlers(active_tab_content);
        }

        return true;
    }

    toggle_find_view() {
        if (this.close_find_view()) {
            return;
        }
        this.get_find_view();
    }

    reset_find_view() {
        const active_tab_content = tabManager.get_active_tab_content();
        if (!active_tab_content) {
            return;
        }

        const find_main_container = active_tab_content.querySelector('.find_main_container');
        if (find_main_container) {
            find_main_container.remove();
        }

        const find_panel = active_tab_content.querySelector('.find_panel');
        if (find_panel) {
            find_panel.remove();
        }

        if (active_tab_content.dataset.savedContent) {
            delete active_tab_content.dataset.savedContent;
        }
    }

    // set / remove empty folder message
    check_for_empty_folder() {

        let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
        let items = active_tab_content.querySelectorAll('.card, .tr');

        // console.log('check for empty folder', items.length);

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
            this.run_filer(e);
        });

        this.filter.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.clear_filter();
            }
        })

        document.addEventListener('keydown', (e) => {
            // Centralized input check
            if (this.isInputLike(document.activeElement) || typeof section !== 'undefined' && section == 2) {
                return;
            }

            // Example: Ctrl+L (location focus) -- currently disabled
            if (e.ctrlKey && e.key === 'l') {
                // this.location.focus();
                return;
            }

            // Escape clears filter
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.clear_filter();
                return;
            }

            // Ignore navigation and modifier keys
            if (this.specialKeys.includes(e.key)) {
                return;
            }

            // Ignore key combos (Ctrl/Alt/Shift/Meta with alphanum)
            if (e.key.match(/[a-z0-9-_.]/i) && (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)) {
                return;
            }

            // Quick search: focus filter if not already focused
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

    // Accept event for direct value, fallback to DOM if not provided
    let filterValue = '';
    if (arguments.length > 0 && arguments[0] && arguments[0].target) {
        filterValue = arguments[0].target.innerText;
    } else {
        filterValue = this.filter.innerText;
    }
    this.quick_search_sting = filterValue;
    this.filter.focus();

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
            } else {
                item.classList.remove('highlight_select');
                item.classList.add('hidden');
            }
        });
        // reset nav idx for up down navigation
        // navigation.clearNavIdx();
        // set indexes for up down navigation
        // navigation.getCardGroups();
    }

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

    get_column_settings_for_view(view_name = this.view) {
        const schema = settingsManager.get_schema() || {};
        const section_name = view_name === 'grid_view' ? 'Grid View Columns' : 'List View Columns';
        return schema[section_name]?.properties || schema['List View Columns']?.properties || {};
    }

    get_visible_column_keys(view_name = this.view) {
        const columns = this.get_column_settings_for_view(view_name);
        return Object.keys(columns).filter((key) => key === 'name' || columns[key].default);
    }

    get_list_grid_template_columns(view_name = this.view) {
        const visible_keys = this.get_visible_column_keys(view_name);
        this.list_view_settings = settingsManager.get_list_view_settings();

        return visible_keys.map((key) => {
            if (key === 'name') {
                return '1fr';
            }

            const width = this.list_view_settings?.col_width?.[key] || 100;
            return `${width}px`;
        }).join(' ');
    }

    apply_column_settings_to_header(header, view_name = this.view) {
        if (!header) {
            return;
        }

        const visible_keys = new Set(this.get_visible_column_keys(view_name));
        header.querySelectorAll('.sort_column').forEach((column) => {
            column.classList.toggle('hidden', !visible_keys.has(column.dataset.col_name));
        });

        header.style.gridTemplateColumns = this.get_list_grid_template_columns(view_name);
    }

    apply_column_settings_to_card(card, view_name = this.view) {
        if (!card) {
            return;
        }

        const visible_keys = new Set(this.get_visible_column_keys(view_name));
        const content = card.querySelector('.content');
        if (!content) {
            return;
        }

        content.querySelectorAll('[data-column-key]').forEach((item) => {
            item.classList.toggle('hidden', !visible_keys.has(item.dataset.columnKey));
        });

        if (view_name === 'list_view') {
            content.style.gridTemplateColumns = this.get_list_grid_template_columns(view_name);
        } else {
            content.style.gridTemplateColumns = '';
        }
    }

    apply_view_settings_to_container(view_container, view_name = this.view) {
        if (!view_container) {
            return;
        }

        if (view_name === 'list_view') {
            view_container.classList.remove('grid_view', 'grid3');
            view_container.classList.add('list_view');
        } else {
            view_container.classList.add('grid_view', 'grid3');
            view_container.classList.remove('list_view');
        }

        let header = view_container.querySelector('.list_view_header');
        if (!header && view_name === 'list_view') {
            header = this.get_list_view_header();
            view_container.prepend(header);
        }

        if (header) {
            header.classList.toggle('hidden', view_name !== 'list_view');
            this.apply_column_settings_to_header(header, 'list_view');
        }

        view_container.querySelectorAll('.card').forEach((card) => {
            this.apply_column_settings_to_card(card, view_name);
        });
    }

    //
    get_list_view_header() {

        // console.log('get list view header');

        // this.settings = settingsManager.get_settings();
        this.settings = settingsManager.get_schema();
        this.list_view_settings = settingsManager.get_list_view_settings();

        const list_view_columns = this.settings['List View Columns'].properties
        const sort_by = settingsManager.get_schema_setting('Sort By')?.default || 'mtime'
        const sort_direction = settingsManager.get_schema_setting('Sort Direction')?.default || 'desc'


        let header = utilities.add_div(['list_view_header']);

        for (const key in list_view_columns) {

            // console.log('columns', key, list_view_columns[key])

            if (list_view_columns[key]) {

                let col_width = this.list_view_settings.col_width[key] ? this.list_view_settings.col_width[key] : 100;

                let col = document.createElement('div');
                col.classList.add('sort_column');

                let sort_icon = document.createElement('i');
                sort_icon.classList.add('th_sort_icon');
                if (sort_by === key) {

                    // th_sort_icon.classList.add('bi', 'bi-caret-up-fill');
                    if (sort_direction === 'desc') {
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

                }

            }

        }

        // add event listener for columns menu
        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.show_column_menu(e);
        });

        // set grid template columns
        header.style.gridTemplateColumns = this.get_list_grid_template_columns('list_view');
        this.apply_column_settings_to_header(header, 'list_view');

        return header;

    };

    show_column_menu(e) {
        // Remove any existing column menu
        const existing = document.getElementById('col_context_menu');
        if (existing) {
            existing.remove();
        }

        const schema = settingsManager.get_schema();
        const columns = schema?.['List View Columns']?.properties || {};

        const menu = document.createElement('div');
        menu.id = 'col_context_menu';
        menu.classList.add('col_context_menu');

        const title = document.createElement('div');
        title.classList.add('col_context_menu_title');
        title.textContent = 'Show columns';
        menu.append(title);

        for (const key in columns) {
            const col_def = columns[key];
            const is_name = key === 'name';

            const row = document.createElement('label');
            row.classList.add('col_context_menu_item');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = is_name ? true : !!col_def.default;
            checkbox.disabled = is_name;
            checkbox.dataset.col_key = key;

            checkbox.addEventListener('change', () => {
                const latest_settings = settingsManager.get_settings() || {};
                const col_props = latest_settings?.schema?.properties?.['List View Columns']?.properties;
                if (col_props && col_props[key]) {
                    col_props[key].default = checkbox.checked;
                }
                settingsManager.update_settings(latest_settings);

                // Apply to all visible headers and cards
                document.querySelectorAll('.list_view_header').forEach((h) => {
                    this.apply_column_settings_to_header(h, 'list_view');
                });
                document.querySelectorAll('.card').forEach((card) => {
                    this.apply_column_settings_to_card(card, 'list_view');
                });
            });

            const label_text = document.createElement('span');
            label_text.textContent = col_def.description || key;

            row.append(checkbox, label_text);
            menu.append(row);
        }

        // Position near cursor, keeping within viewport
        document.body.append(menu);
        const rect = menu.getBoundingClientRect();
        const x = Math.min(e.clientX, window.innerWidth - rect.width - 8);
        const y = Math.min(e.clientY, window.innerHeight - rect.height - 8);
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // Dismiss on outside click or Escape
        const dismiss = (ev) => {
            if (ev.type === 'keydown' && ev.key !== 'Escape') {
                return;
            }
            if (ev.type === 'mousedown' && menu.contains(ev.target)) {
                return;
            }
            menu.remove();
            document.removeEventListener('mousedown', dismiss);
            document.removeEventListener('keydown', dismiss);
        };

        // Use setTimeout so the current mousedown that triggered contextmenu doesn't immediately dismiss
        setTimeout(() => {
            document.addEventListener('mousedown', dismiss);
            document.addEventListener('keydown', dismiss);
        }, 0);

            menu.addEventListener('mouseleave', () => {
                menu.remove();
                document.removeEventListener('mousedown', dismiss);
                document.removeEventListener('keydown', dismiss);
            });
        }

    handleSort(col) {

        col.addEventListener('click', (e) => {

            e.preventDefault();
            e.stopPropagation();

            this.sort_by = col.dataset.col_name;

            if (this.sort_direction === 'asc') {
                this.sort_direction = 'desc';
            } else {
                this.sort_direction = 'asc';
            }

            const latest_settings = settingsManager.get_settings() || {};
            if (latest_settings?.schema?.properties?.['Default View']?.properties?.['Sort By']) {
                latest_settings.schema.properties['Default View'].properties['Sort By'].default = this.sort_by;
            }
            if (latest_settings?.schema?.properties?.['Default View']?.properties?.['Sort Direction']) {
                latest_settings.schema.properties['Default View'].properties['Sort Direction'].default = this.sort_direction;
            }
            latest_settings.sort_by = this.sort_by;
            latest_settings.sort_direction = this.sort_direction;
            settingsManager.update_settings(latest_settings);
            this.settings = latest_settings;

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
            tabManager.add_tab(utilities.get_location());
            active_tab_content = document.querySelector('.active-tab-content');
        }

        // Preserve find UI so it stays visible across view re-renders.
        let preserved_find_main_container = active_tab_content.querySelector('.find_main_container');
        let preserved_find_panel = null;
        if (preserved_find_main_container) {
            preserved_find_main_container.remove();
        } else {
            preserved_find_panel = active_tab_content.querySelector('.find_panel');
            if (preserved_find_panel) {
                preserved_find_panel.remove();
            }
        }

        active_tab_content.innerHTML = '';

        // scroll to top of active tab content
        active_tab_content.scrollTop = 0;

        let view_container = document.createElement('div');
        view_container.classList.add('view_container');
        view_container.tabIndex = 0; // Make it focusable

        if (this.view === 'list_view') {
            let header = this.get_list_view_header();
            view_container.appendChild(header);
        }

        this.apply_view_settings_to_container(view_container, this.view);
        // Initialize keyboard navigation and focus the container
        this.handleInitKeyNav(view_container);

        // hide hidden files if schema setting exists and default is false
        this.schema = settingsManager.get_schema();
        this.show_hidden = this.schema['Default View'] ? this.schema['Default View'].properties['Show Hidden'].default : null;
        // if (show_hidden ==  true) {
        //     files_arr = files_arr.filter(f => f.is_hidden === false);
        // }

        // sort files array
        files_arr = utilities.sort(files_arr, this.sort_by, this.sort_direction);

        for (let i = 0; i < files_arr.length; i++) {

            let card = this.get_view_item(files_arr[i]);
            // utilities.add_div(['card', 'lazy'])
            // card.dataset.id = files_arr[i].id;
            // card.dataset.href = files_arr[i].href;
            // card.dataset.name = files_arr[i].name;
            // card.dataset.size = files_arr[i].size;
            // card.dataset.mtime = files_arr[i].mtime;
            // card.dataset.content_type = files_arr[i].content_type;
            // card.dataset.is_dir = files_arr[i].is_dir;
            // card.dataset.location = files_arr[i].location;
            // card.dataset.content_type = files_arr[i].content_type;
            // card.dataset.is_hidden = files_arr[i].is_hidden;
            view_container.appendChild(card);

        }


        if (preserved_find_main_container) {
            const preserved_results_window = preserved_find_main_container.querySelector('.find_results_window');
            if (preserved_results_window) {
                preserved_results_window.innerHTML = '';
                preserved_results_window.appendChild(view_container);
            }

            // Keep close behavior restoring the latest rendered view.
            // active_tab_content.dataset.savedContent = btoa(view_container.outerHTML);
            active_tab_content.appendChild(preserved_find_main_container);
        } else {
            if (preserved_find_panel) {
                // Keep close behavior restoring the latest rendered view.
                // active_tab_content.dataset.savedContent = btoa(view_container.outerHTML);
                active_tab_content.appendChild(preserved_find_panel);
            }
            active_tab_content.appendChild(view_container);
        }

        this.lazy_load_files(files_arr);

        // handle the first arrow down event for card selection
        this.handleInitKeyNav(view_container);

        // // hide hidden files if schema setting exists and default is false
        // let schema = settingsManager.get_schema().properties;
        // let show_hidden = schema['Default View'] ? schema['Default View'].properties['Show Hidden'].default : null;
        // if (show_hidden ==  true) {
        //     this.show_hidden_files();
        // } else if (show_hidden ==  false) {
        //     this.hide_hidden_files();
        // }

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

        if (!f || !f.href) {
            console.log('error getting view item', f);
            return -1;
        }

        this.settings = settingsManager.get_schema();
        const columns_section = this.view === 'grid_view' ? 'Grid View Columns' : 'List View Columns';
        let columns = this.settings[columns_section] ? this.settings[columns_section].properties : null;
        if (!columns) {
            columns = this.settings['List View Columns'] ? this.settings['List View Columns'].properties : null;
        }
        const all_columns = this.settings['List View Columns'] ? this.settings['List View Columns'].properties : columns;
        this.list_view_settings = settingsManager.get_list_view_settings();

        let card = utilities.add_div(['card', 'lazy']);
        let content = utilities.add_div(['content']);
        let icon = utilities.add_div(['icon']);
        let img = document.createElement('img');
        let video = document.createElement('video');
        let filename = utilities.add_div(['header', 'item']);

        let href = document.createElement('a');
        let input = document.createElement('input');

        card.draggable = true;

        if (this.show_hidden === false && f.is_hidden === true) {
            card.classList.add('hidden');
        }

        // handle icon
        icon.append(img);
        icon.style = 'cursor: pointer';
        img.classList.add('img');

        for (const key in all_columns) {

            if (all_columns[key]) {

                let col_width = this.list_view_settings.col_width[key] ? this.list_view_settings.col_width[key] : 100;

                // handle name column
                if (key === 'name') {

                    // let href = document.createElement('a');
                    let href_div = utilities.add_div(['href_div']);
                    let input_div = utilities.add_div(['input_div', 'hidden']);

                    href.classList.add('href');
                    href.classList.add('item');
                    href.innerHTML = f.display_name;
                    href.href = f.href;
                    href_div.append(href);

                    // let input = document.createElement('input');
                    input.classList.add('input', 'item', 'hidden', 'edit_name');
                    input.value = f.display_name;
                    input.spellcheck = false;
                    input.type = 'text';
                    input.dataset.href = f.href;
                    input_div.append(input);
                    filename.dataset.columnKey = key;

                    filename.append(href_div, input_div);
                    content.appendChild(filename);

                } else {

                    let item = utilities.add_div(['item']);
                    content.appendChild(item);

                    item.innerHTML = f[key] ? f[key] : '';
                    item.classList.add(key);
                    item.dataset.columnKey = key;

                    switch (key) {
                        case 'size':
                            item.innerHTML = f.is_dir ? '—' : utilities.get_file_size(f["size"]);
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
                }



            }

        }

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

        // Get Icon
        this.handleIcon(icon, f, this.view);

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

        this.handleKeyNav(card, f);

        card.append(icon, content);
        this.apply_column_settings_to_card(card, this.view);
        return card;

    }

    async get_dashboard_view() {

        console.log('getting dash view')

        let active_tab_content = tabManager.get_active_tab_content();
        if (!active_tab_content) {

            // utilities.set_msg('Error: Unable to open Dashboard view');
            tabManager.add_tab('Dashboard');
            active_tab_content = tabManager.get_active_tab_content() //document.querySelector('.active-tab-content');
            // return;

        }

        tabManager.update_tab('Dashboard');

        let res = '';
        try {
            res = await ipcRenderer.invoke('get_dashboard_view');
        } catch (err) {
            console.log('error', err);
        } finally {

            active_tab_content.innerHTML = '';
            active_tab_content.innerHTML = res.dashboard_view;

            let recent_folders_view = active_tab_content.querySelector('.recent_folders_view');
            let recent_folders_div = utilities.add_div(['recent_folders', 'grid_view', 'grid3']);

            let recent_files_view = active_tab_content.querySelector('.recent_files_view');
            let recent_files_div = utilities.add_div(['recent_files', 'grid_view', 'grid3']);

            let recent_files_arr = await ipcRenderer.invoke('get_recent_files_arr');

            let recent_folders = (recent_files_arr.length > 0) ? recent_files_arr.filter(a => a.is_dir == true) : [] ;
            let recent_files = (recent_files_arr.length > 0) ? recent_files_arr.filter(a => a.is_dir == false) : [] ;

            if (recent_folders.length > 0) {
                for (let i = 0; i < recent_folders.length; ++i) {
                    let card = this.get_view_item(recent_folders[i]);
                    recent_folders_div.appendChild(card);
                }
                recent_folders_view.append(recent_folders_div);
            } else {
                recent_folders_view.innerHTML = '<div class="no_recent_folders">No recent folders</div>';
            }

            if (recent_files.length > 0) {
                for (let i = 0; i < recent_files.length; ++i) {
                    let card = this.get_view_item(recent_files[i]);
                    recent_files_div.appendChild(card);
                }
                recent_files_view.append(recent_files_div);
            } else {
                recent_files_view.innerHTML = '<div class="no_recent_files">No recent files</div>';
            }

            utilities.lazy_load_icons(active_tab_content);

            let overview = document.querySelector('.overview');
            overview.innerHTML = '';

            // get local disk stats and render chart for each local disk (home and root at least)

            // get data for overview
            let stats = await ipcRenderer.invoke('get_dashboard_disk_stats', '/home');
            let chart1 = this.renderChart(stats);


            if (chart1) {
                overview.append(chart1);
            }

            let stats2 = await ipcRenderer.invoke('get_dashboard_disk_stats', '/');
            let chart2 = this.renderChart(stats2);


            if (chart2) {
                overview.append(chart2);
            }

            // process entries in the device array and render charts for each device
            if (deviceManager.device_arr && deviceManager.device_arr.length > 0) {

                deviceManager.device_arr.forEach(device => {

                    ipcRenderer.invoke('get_dashboard_disk_stats', device.path).then(stats => {
                        const chart = this.renderChart(stats);
                        if (chart) {
                            overview.append(chart);
                        }
                    });

                })

            }

            let workspace_view_div = document.querySelector('.workspace_dashboard_view');
            let workspace_arr = await ipcRenderer.invoke('get_workspace');

            if (workspace_arr && workspace_arr.length > 0) {

                for (let i = 0; i < workspace_arr.length; ++i) {
                    let card = this.get_view_item(workspace_arr[i]);
                    workspace_view_div.appendChild(card);
                }

                utilities.lazy_load_icons(workspace_view_div);

            } else {
                workspace_view_div.innerHTML = '<div class="no_workspace">No workspace items</div>';
            }

            // recent_folders_arr.forEach(f => {
            //     let card = this.get_view_item(f);
            //     recent_folders.appendChild(card);
            // });



        }

    }

    renderChart(stats) {

        // change colors based on usage percentage
        let usedPercentage = (parseInt(stats.used) / (parseInt(stats.used) + parseInt(stats.free))) * 100;
        let backgroundColor;
        console.log('used percentage', usedPercentage);
        if (usedPercentage <= 70) {
            backgroundColor = ['#a9bdf4', '#36a2eb'];
        } else if (usedPercentage <= 80) {
            backgroundColor = ['#f4d03f', '#f39c12'];
        } else if (usedPercentage <= 100) {
            backgroundColor = ['#e74c3c', '#892a20'];
        }

        const data = {
            labels: [
            `${utilities.get_file_size(stats.used)} Used`,
            `${utilities.get_file_size(stats.free)} Available`
            ],
            datasets: [{
                label: `${stats.display_name}`,
                // label: utilities.get_file_size(stats.used) + ' Used / ' + utilities.get_file_size(stats.free) + ' Available',
                data: [stats.used, stats.free],
                backgroundColor: backgroundColor,
                borderWidth: 1
            }]
        };

        const container = document.createElement('div');
        container.className = 'chart-container';
        container.style.width = '100%';
        container.style.height = '100px';
        container.style.position = 'relative';

        let chartCanvas = document.createElement('canvas');
        chartCanvas.width = 250;
        chartCanvas.height = 100;
        container.appendChild(chartCanvas);

        const chart = new Chart(chartCanvas, {
            type: 'doughnut',
            data,
            options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            cutoutPercentage: 85,
            rotation: -90,
            circumference: 180,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 0,
                        boxHeight: 0
                    }
                },
                title: { display: true, text: stats.display_name },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const label = ctx.label || '';
                            return `${label}: ${utilities.get_file_size(ctx.raw)}`;
                        }
                    }
                }
            }
            }
        });

        const ro = new ResizeObserver(() => {
            chart.resize(container.offsetWidth, 100);
        });
        ro.observe(container);

        container.chart = chart;
        return container;
    }

    // Find View
    get_find_view() {

        const active_tab_content = tabManager.get_active_tab_content();
        if (!active_tab_content) {
            utilities.set_msg('Error: Unable to open Find view');
            return;
        }

        const existing_find_input = active_tab_content.querySelector('.find_input');
        if (existing_find_input) {
            existing_find_input.focus();
            existing_find_input.select();
            return;
        }

        // Store original content if not already in find mode
        if (!active_tab_content.querySelector('.find_panel')) {
            const saved_content = active_tab_content.innerHTML;
            // Use a safe base64 encoding for Unicode strings
            active_tab_content.dataset.savedContent = base64EncodeUnicode(saved_content);
        }

        // Helper function to safely base64 encode Unicode strings
        function base64EncodeUnicode(str) {
            // First we escape the string using encodeURIComponent to get the UTF-8 encoding,
            // then we convert the percent encodings into raw bytes, and finally btoa.
            return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
        }

        const main_container = utilities.add_div(['find_main_container']);
        const find_panel = utilities.add_div(['find_panel']);
        const find_form = utilities.add_div(['find_form']);
        const find_row_primary = utilities.add_div(['find_row', 'find_row_primary']);
        const find_row_filters = utilities.add_div(['find_row', 'find_row_filters']);
        const find_actions_inline = utilities.add_div(['find_actions_inline']);
        const find_date_range = utilities.add_div(['find_range_group', 'find_date_range']);
        const find_size_range = utilities.add_div(['find_range_group', 'find_size_range']);
        const find_max_depth = utilities.add_div(['find_max_depth_group', 'find_max_depth']);
        const query_field = utilities.add_div(['find_field', 'find_field_query']);
        const min_size_field = utilities.add_div(['find_field']);
        const max_size_field = utilities.add_div(['find_field']);
        const date_from_field = utilities.add_div(['find_field']);
        const date_to_field = utilities.add_div(['find_field']);
        const max_depth_field = utilities.add_div(['find_field']);

        const find_input = document.createElement('input');
        const min_size_input = document.createElement('input');
        const max_size_input = document.createElement('input');
        const date_from_input = document.createElement('input');
        const date_to_input = document.createElement('input');
        const max_depth_input = document.createElement('input');

        const query_label = document.createElement('label');
        const min_size_label = document.createElement('label');
        const max_size_label = document.createElement('label');
        const date_from_label = document.createElement('label');
        const date_to_label = document.createElement('label');
        const max_depth_label = document.createElement('label');

        const find_submit = document.createElement('button');
        const close_button = document.createElement('button');
        const filters_toggle = document.createElement('button');
        const results_window = utilities.add_div(['find_results_window']);
        const results_header = utilities.add_div(['find_results_header']);
        const results_list = utilities.add_div(['find_results_list']);

        query_label.classList.add('find_label');
        min_size_label.classList.add('find_label');
        max_size_label.classList.add('find_label');
        date_from_label.classList.add('find_label');
        date_to_label.classList.add('find_label');

        query_label.textContent = 'Search term';
        min_size_label.textContent = 'Minimum size (bytes)';
        max_size_label.textContent = 'Maximum size (bytes)';
        date_from_label.textContent = 'Modified from';
        date_to_label.textContent = 'Modified to';
        max_depth_label.textContent = 'Max Search Depth'

        find_input.type = 'text';
        find_input.classList.add('find_input');
        find_input.placeholder = 'Search from current location';

        min_size_input.type = 'number';
        min_size_input.classList.add('find_option_input');
        min_size_input.min = '0';
        min_size_input.step = '1';
        min_size_input.placeholder = 'Min size (bytes)';
        min_size_input.title = 'Only include files at or above this size in bytes';

        max_size_input.type = 'number';
        max_size_input.classList.add('find_option_input');
        max_size_input.min = '0';
        max_size_input.step = '1';
        max_size_input.placeholder = 'Max size (bytes)';
        max_size_input.title = 'Only include files at or below this size in bytes';

        date_from_input.type = 'datetime-local';
        date_from_input.classList.add('find_option_input');
        date_from_input.placeholder = 'Modified after';
        date_from_input.title = 'Only include files modified on or after this date and time';

        date_to_input.type = 'datetime-local';
        date_to_input.classList.add('find_option_input');
        date_to_input.placeholder = 'Modified before';
        date_to_input.title = 'Only include files modified on or before this date and time';

        max_depth_input.type = 'number';
        max_depth_input.classList.add('find_option_input');
        max_depth_input.value = 1;
        max_depth_input.min = '1';
        max_depth_input.max = '5';
        max_depth_input.step = '1';
        max_depth_input.placeholder = 'Max Search Depth';
        max_depth_input.title = 'Max Search Depth';

        find_submit.type = 'button';
        find_submit.classList.add('button', 'find_submit');
        find_submit.textContent = 'Search';

        close_button.type = 'button';
        close_button.classList.add('button', 'find_close');
        close_button.title = 'Close search';
        close_button.textContent = 'Close';

        filters_toggle.type = 'button';
        filters_toggle.classList.add('button', 'find_filters_toggle');
        filters_toggle.textContent = 'More options';
        filters_toggle.title = 'Show additional search filters';

        results_header.textContent = 'Enter a search term and press Enter or click Search.';
        let has_search_run = false;

        const normalize_find_match = (f) => {
            const href = f?.href || '';
            const location = f?.location || (href ? path.dirname(href) : '');
            const name = f?.name || f?.display_name || (href ? path.basename(href) : 'Unknown');

            return {
                ...f,
                id: f?.id || (href ? btoa(href) : btoa(`${name}-${Date.now()}`)),
                href,
                location,
                name,
                display_name: f?.display_name || name,
                is_dir: !!f?.is_dir,
                is_symlink: !!f?.is_symlink,
                is_writable: f?.is_writable !== false,
                is_readable: f?.is_readable !== false,
                content_type: f?.content_type || '',
                size: f?.size || 0,
                mtime: f?.mtime || 0,
                ctime: f?.ctime || 0,
                atime: f?.atime || 0
            };
        };

        const render_results_view = (matches) => {
            results_list.innerHTML = '';

            if (!Array.isArray(matches) || matches.length === 0) {
                const empty_state = utilities.add_div(['find_empty']);
                empty_state.textContent = 'No matches found.';
                results_list.append(empty_state);
                return;
            }

            const results_view = utilities.add_div(['view_container']);

            if (this.view === 'list_view') {
                results_view.classList.add('list_view');
                const header = this.get_list_view_header();
                results_view.append(header);
            } else {
                results_view.classList.add('grid_view', 'grid3');
            }

            matches.forEach((match) => {
                const item = this.get_view_item(match);
                results_view.append(item);
            });

            results_list.append(results_view);

            // Load icons for lazy items in search results
            setTimeout(() => {
                const lazy_icons = results_view.querySelectorAll('.icon .img.lazy[data-icon-href]');
                lazy_icons.forEach((icon_img) => {
                    ipcRenderer.invoke('get_icon', icon_img.dataset.iconHref).then((icon_path) => {
                        if (!icon_path) {
                            return;
                        }
                        icon_img.dataset.src = icon_path;
                        icon_img.src = icon_path;
                        icon_img.classList.remove('lazy');
                    }).catch(() => {
                    });
                });
            }, 10);
        };

        const parse_size_value = (value) => {
            const trimmed = String(value || '').trim();
            if (!trimmed) {
                return null;
            }

            const parsed = Number(trimmed);
            if (!Number.isFinite(parsed) || parsed < 0) {
                return null;
            }

            return Math.floor(parsed);
        };

        const parse_date_value = (value) => {
            const trimmed = String(value || '').trim();
            if (!trimmed) {
                return null;
            }

            const parsed = new Date(trimmed);
            if (Number.isNaN(parsed.getTime())) {
                return null;
            }

            return parsed.toISOString();
        };

        const get_search_options = () => {
            const options = {};

            const min_size = parse_size_value(min_size_input.value);
            const max_size = parse_size_value(max_size_input.value);
            const date_from = parse_date_value(date_from_input.value);
            const date_to = parse_date_value(date_to_input.value);
            const max_depth = parse_size_value(max_depth_input.value);

            if (min_size !== null) {
                options.minSize = min_size;
            }

            if (max_size !== null) {
                options.maxSize = max_size;
            }

            if (date_from !== null) {
                options.dateFrom = date_from;
            }

            if (date_to !== null) {
                options.dateTo = date_to;
            }

            if (max_depth !== null) {
                options.folderDepth = max_depth;
            }

            if (
                options.minSize !== undefined &&
                options.maxSize !== undefined &&
                options.minSize > options.maxSize
            ) {
                return {
                    error: true,
                    message: 'Min size cannot be greater than max size.',
                    options: {}
                };
            }

            if (
                options.dateFrom !== undefined &&
                options.dateTo !== undefined &&
                new Date(options.dateFrom).getTime() > new Date(options.dateTo).getTime()
            ) {
                return {
                    error: true,
                    message: 'Date From cannot be later than Date To.',
                    options: {}
                };
            }

            return {
                error: false,
                message: '',
                options
            };
        };

        const render_results = async (query) => {

            const q = (query || '').trim();
            results_list.innerHTML = '';

            if (!q) {
                results_header.textContent = 'Enter a search term.';
                return;
            }

            if (!has_search_run) {
                has_search_run = true;
            }

            // If navigation swapped in the normal folder view, switch back to search results view.
            if (!active_tab_content.contains(main_container)) {
                active_tab_content.innerHTML = '';
                main_container.append(find_panel, results_window);
                active_tab_content.append(main_container);
            }

            // get_view can replace results_window content with a regular view container.
            if (!results_window.contains(results_list)) {
                results_window.innerHTML = '';
                results_window.append(results_list);
            }

            const search_location = this.location || settingsManager.get_location() || utilities.get_location();
            const search_options_result = get_search_options();

            if (search_options_result.error) {
                results_header.textContent = search_options_result.message;
                return;
            }

            results_header.innerHTML = `<img src="../renderer/icons/spinner.gif" style="width: 12px; height: 12px" alt="loading" class="spinner" />Searching in ${search_location}...`;
            find_submit.disabled = true;

            let response;
            try {
                response = await ipcRenderer.invoke('find', q, search_location, search_options_result.options);
            } catch (err) {
                response = {
                    error: true,
                    message: String(err.message || err),
                    results: []
                };
            } finally {
                find_submit.disabled = false;
            }

            if (response && response.error) {
                results_header.textContent = response.message || 'Search failed.';
                return;
            }

            const matches = Array.isArray(response?.results) ? response.results : [];
            const normalized_matches = matches.map((match) => normalize_find_match(match));
            const sorted_matches = utilities.sort(normalized_matches, this.sort_by, this.sort_direction);

            results_header.textContent = `${sorted_matches.length} result${sorted_matches.length === 1 ? '' : 's'} in search location.`;

            render_results_view(sorted_matches);
        };

        find_submit.addEventListener('click', () => {
            render_results(find_input.value);
        });

        find_input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                render_results(find_input.value);
            }
        });

        [min_size_input, max_size_input, date_from_input, date_to_input].forEach((input) => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    render_results(find_input.value);
                }
            });
        });

        close_button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.close_find_view();
        });

        filters_toggle.addEventListener('click', () => {
            const expanded = find_row_filters.classList.toggle('find_row_filters_visible');
            filters_toggle.textContent = expanded ? 'Fewer options' : 'More options';
            filters_toggle.title = expanded ? 'Hide additional search filters' : 'Show additional search filters';
        });

        query_field.append(query_label, find_input);
        min_size_field.append(min_size_label, min_size_input);
        max_size_field.append(max_size_label, max_size_input);
        date_from_field.append(date_from_label, date_from_input);
        date_to_field.append(date_to_label, date_to_input);
        max_depth_field.append(max_depth_label, max_depth_input);

        find_actions_inline.append(find_submit, filters_toggle, close_button);
        find_row_primary.append(query_field, find_actions_inline);

        find_date_range.append(date_from_field, date_to_field);
        find_size_range.append(min_size_field, max_size_field);
        find_max_depth.append(max_depth_field);
        find_row_filters.append(find_date_range, find_size_range, find_max_depth);

        find_form.append(find_row_primary, find_row_filters, results_header);
        find_panel.append(find_form);
        active_tab_content.prepend(find_panel);

        setTimeout(() => {
            find_input.focus();
        }, 0);
    }

    // Settings View
    get_settings_view() {

        // build settings view (cleanly formatted)
        console.log('get settings view');

        // If a Settings tab already exists, activate it instead of creating a duplicate
        const existingSettingsTab = document.querySelector('.tab[data-href="Settings"]');
        if (existingSettingsTab) {
            existingSettingsTab.click();
            return;
        }

        tabManager.add_tab('Settings');

        const active_tab_content = tabManager.get_active_tab_content();
        if (!active_tab_content) {
            console.log('error getting active tab content');
            return;
        }
        active_tab_content.innerHTML = '';

        let view_container = utilities.add_div(['view_container', 'settings_view']);

        const settings = settingsManager.get_settings();
        if (!settings || typeof settings !== 'object') {
            utilities.set_msg('Error: Invalid settings');
            return;
        }

        Object.keys(settings.schema.properties).forEach((key, idx) => {

            let header;

            if (settings.schema.properties[key].type === 'object') {
                header = document.createElement('h4');
                header.classList.add('header');
                header.innerHTML = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
                view_container.append(header);

                const properties = settings.schema.properties[key].properties;
                if (properties) {

                    Object.keys(properties).forEach((propKey) => {

                        if (properties[propKey].type === 'boolean') {

                            // console.log('boolean property', propKey);

                            let settings_item = utilities.add_div(['settings_item']);

                            const label = document.createElement('label');
                            label.innerText = `${propKey.charAt(0).toUpperCase()}${propKey.slice(1)}`;

                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.checked = propKey === 'name' ? true : properties[propKey].default;
                            if (propKey === 'name') {
                                checkbox.disabled = true;
                                label.innerText = `${propKey.charAt(0).toUpperCase()}${propKey.slice(1)} (always visible)`;
                            }
                            checkbox.addEventListener('change', (e) => {
                                const latest_settings = settingsManager.get_settings() || {};
                                const latest_properties = latest_settings?.schema?.properties?.[key]?.properties;
                                if (!latest_properties || !latest_properties[propKey]) {
                                    return;
                                }

                                if (propKey === 'name') {
                                    latest_properties[propKey].default = true;
                                    checkbox.checked = true;
                                    settingsManager.update_settings(latest_settings);
                                    return;
                                }

                                latest_properties[propKey].default = checkbox.checked;

                                // Keep legacy flat settings updated where still referenced.
                                if (propKey === 'Show Hidden') {
                                    latest_settings.show_hidden = checkbox.checked;
                                    if (checkbox.checked) {
                                        this.show_hidden_files();
                                    } else {
                                        this.hide_hidden_files();
                                    }
                                }

                                settingsManager.update_settings(latest_settings);

                                if (key === 'List View Columns' || key === 'Grid View Columns') {
                                    this.refresh_file_tabs_for_column_settings(key);
                                }
                            });

                            settings_item.append(label, checkbox);
                            view_container.append(settings_item);

                        }

                        if (properties[propKey].type === 'string') {

                            const label = document.createElement('label');
                            label.innerText = `${propKey.charAt(0).toUpperCase()}${propKey.slice(1)}`;

                            let input;
                            if (properties[propKey].enum && Array.isArray(properties[propKey].enum)) {
                                // Enum: Render dropdown
                                input = document.createElement('select');
                                properties[propKey].enum.forEach(option => {
                                    const opt = document.createElement('option');
                                    opt.value = option;
                                    opt.textContent = option.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    input.appendChild(opt);
                                });
                                input.value = properties[propKey].default || settings[propKey] || '';
                            } else {
                                // Plain string: Text input
                                input = document.createElement('input');
                                input.type = 'text';
                                input.value = settings[propKey] || '';
                            }

                            input.addEventListener('change', (e) => {
                                const latest_settings = settingsManager.get_settings() || {};
                                const latest_properties = latest_settings?.schema?.properties?.[key]?.properties;
                                if (!latest_properties || !latest_properties[propKey]) {
                                    return;
                                }

                                latest_properties[propKey].default = e.target.value;

                                // Keep legacy flat settings updated where still referenced.
                                if (propKey === 'View') {
                                    ipcRenderer.emit('switch_view', null, e.target.value);
                                    return;
                                }

                                if (propKey === 'Sort By') {
                                    latest_settings.sort_by = e.target.value;
                                }

                                if (propKey === 'Sort Direction') {
                                    latest_settings.sort_direction = e.target.value;
                                }

                                if (propKey === 'Grid Icon Size') {
                                    latest_settings.icon_size = parseInt(e.target.value, 10) || 32;
                                    iconManager.resize_icons(latest_settings.icon_size, 'grid_view');
                                }

                                if (propKey === 'List Icon Size') {
                                    latest_settings.list_icon_size = parseInt(e.target.value, 10) || 24;
                                    iconManager.resize_icons(latest_settings.list_icon_size, 'list_view');
                                }

                                settingsManager.update_settings(latest_settings);
                            });

                            const item = utilities.add_div(['settings_item']);
                            item.append(label, input);
                            view_container.append(item);

                        }


                    });
                }

            }

        })

        // console.log('view_container', view_container);

        // Object.keys(settings).forEach((key, idx) => {

        //     const value = settings[key];

        //     if (typeof value === 'string') {

        //         console.log('key', key, 'value', value);

        //         let input = document.createElement('input');
        //         input.classList.add('input');

        //         let settings_item = utilities.add_div(['settings_item']);
        //         let label = document.createElement('label');

        //         label.innerText = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;

        //         switch (key.toLocaleLowerCase()) {
        //             case 'view': {
        //                 input = document.createElement('select');
        //                 let options = ['list_view', 'grid_view']
        //                 options.forEach((option, i) => {
        //                     let option_select = document.createElement('option');
        //                     option_select.text = option
        //                     option_select.value = option
        //                     input.append(option_select);

        //                     if (option.toLocaleLowerCase() === value.toLocaleLowerCase()) {
        //                         option_select.selected = true
        //                     }
        //                 })

        //                 input.addEventListener('change', (e) => {
        //                     // ipcRenderer.send('change_theme', input.value);
        //                     // ipcRenderer.send('update_settings', [key], input.value)
        //                 })

        //                 settings_item.append(label, input)
        //                 break;
        //             }
        //             case 'theme': {
        //                 input = document.createElement('select');
        //                 let options = ['Light', 'Dark']
        //                 options.forEach((option, i) => {
        //                     let option_select = document.createElement('option');
        //                     option_select.text = option
        //                     option_select.value = option
        //                     input.append(option_select);

        //                     if (option.toLocaleLowerCase() === value.toLocaleLowerCase()) {
        //                         option_select.selected = true
        //                     }
        //                 })

        //                 input.addEventListener('change', (e) => {
        //                     ipcRenderer.send('change_theme', input.value);
        //                     ipcRenderer.send('update_settings', [key], input.value)
        //                 })

        //                 settings_item.append(label, input)
        //                 break;
        //             }
        //             case 'terminal': {
        //                 input.addEventListener('change', (e) => {
        //                     ipcRenderer.send('update_settings', [key], input.value)
        //                 })
        //                 settings_item.append(label, input);
        //                 break;
        //             }
        //             case 'disk_utility': {
        //                 input.addEventListener('change', (e) => {
        //                     ipcRenderer.send('update_settings', [key], input.value)
        //                 })
        //                 settings_item.append(label, input);

        //                 break;
        //             }
        //         }

        //         input.value = settings[key];
        //         view_container.append(settings_item);

        //     }


        //     if (typeof value === 'object') {

        //         let header = document.createElement('h4');
        //         let hr = document.createElement('hr');

        //         header.classList.add('header');

        //         header.innerHTML = `${key.charAt(0).toUpperCase()}${key.slice(1)}`; //key.toUpperCase();
        //         view_container.append(hr, header);

        //         for (let sub_key in settings[key]) {

        //             let input;
        //             let settings_item = utilities.add_div(['settings_item']);

        //             let sub_value = settings[`${key}`][`${sub_key}`];
        //             let type = typeof sub_value;

        //             let label = document.createElement('label');
        //             label.textContent = `${sub_key.charAt(0).toUpperCase() + sub_key.slice(1)}:`;

        //             // Create input field for non-nested properties
        //             switch (type) {
        //                 case 'boolean': {

        //                     let item = utilities.add_div(['settings_checkbox_item']);

        //                     input = document.createElement('input');
        //                     input.type = 'checkbox';
        //                     input.checked = sub_value;

        //                     input.addEventListener('click', (e) => {
        //                         if (input.checked) {
        //                             ipcRenderer.send('update_settings', settings);
        //                             fileManager.get_view();
        //                         } else {
        //                             ipcRenderer.send('update_settings', settings);
        //                             fileManager.get_view();
        //                         }

        //                         switch (key) {
        //                             case 'File Menu': {
        //                                 // ipcRenderer.send('show_menubar')
        //                                 break;
        //                             }
        //                             case 'Header Menu': {
        //                                 // this.showHeaderMenu();
        //                                 break;
        //                             }
        //                             case 'Navigation Menu': {
        //                                 // this.moveNavMenu();
        //                                 break;
        //                             }
        //                             case 'Minibar': {
        //                                 // this.showMinibar();
        //                                 break;
        //                             }
        //                         }

        //                     })

        //                     if (sub_key === 'name') {
        //                         input.disabled = true;
        //                     }
        //                     item.append(label, input);
        //                     view_container.append(item);
        //                     break;
        //                 }
        //                 case 'string': {
        //                     input = document.createElement('input');
        //                     input.type = 'text';
        //                     input.value = sub_value
        //                     if (key.toLocaleLowerCase() === 'keyboard_shortcuts') {
        //                         console.log(sub_key, sub_value)
        //                         input.disabled = true;
        //                     }
        //                     settings_item.append(label, input);
        //                     view_container.append(settings_item);
        //                     break;
        //                 }
        //                 case 'number': {
        //                     input = document.createElement('input');
        //                     input.type = 'number';
        //                     input.value = sub_value;

        //                     settings_item.append(label, input);
        //                     view_container.append(settings_item);

        //                     break;
        //                 }
        //                 default: {
        //                     // input = document.createElement('input');
        //                     // input.type = 'text';
        //                     // input.value = sub_value;

        //                     // settings_item.append(label, input);
        //                     // view_container.append(settings_item);

        //                     break;
        //                 }

        //             }

        //             // let label = document.createElement('label');
        //             // label.textContent = `${sub_key.charAt(0).toUpperCase() + sub_key.slice(1)}:`;
        //             // settings_item.append(label, input);
        //             // form.append(settings_item);

        //         }

        //         // viewManager.resize();

        //     }

        // })

        active_tab_content.appendChild(view_container);

    }

    refresh_file_tabs_for_column_settings(section_name) {
        const tab_contents = document.querySelectorAll('.tab-content');
        tab_contents.forEach((tab_content) => {
            const tab = document.querySelector(`.tab[data-id="${tab_content.dataset.id}"]`);
            if (!tab || tab.dataset.href === 'Settings') {
                return;
            }

            const view_container = tab_content.querySelector('.view_container');
            if (!view_container || view_container.classList.contains('settings_view')) {
                return;
            }

            const is_list = section_name === 'List View Columns' && view_container.classList.contains('list_view');
            const is_grid = section_name === 'Grid View Columns' && view_container.classList.contains('grid_view');
            if (!is_list && !is_grid) {
                return;
            }

            this.apply_view_settings_to_container(view_container, is_grid ? 'grid_view' : 'list_view');
        });
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

        // console.log('running lazy load files', lazyItems.length);

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

                    const icon_img = item.querySelector('.icon .img.lazy[data-icon-href]');
                    if (icon_img) {
                        ipcRenderer.invoke('get_icon', icon_img.dataset.iconHref).then((icon_path) => {
                            if (!icon_path) {
                                return;
                            }

                            icon_img.dataset.src = icon_path;
                            icon_img.src = icon_path;
                            icon_img.classList.remove('lazy');
                        }).catch(() => {
                        });
                    }

                    // }

                    this.handleDataAttributes(item, f);
                    this.handleTitle(item, f);
                    this.handleFolderSize(f)

                    // Stop watching and remove the placeholder
                    lazy_item.classList.remove("lazy");
                    observer.unobserve(lazy_item);

                } else {
                    // console.log('No lazy items load');
                }
            }

        } else {
            // Possibly fall back to a more compatible method here
        }


    }

    // show hidden files
    show_hidden_files() {

        // console.log('show hidden files');

        let views = document.querySelectorAll('.grid_view, .list_view');
        // console.log('views', views);
        views.forEach(view => {
            let hidden_files = view.querySelectorAll('.card[data-is_hidden="true"]');
            // console.log('hidden files', hidden_files.length);
            hidden_files.forEach(file => {
                file.classList.remove('hidden');
            })
        });

    }

    // hide hidden files
    hide_hidden_files() {

        // console.log('hide hidden files');

        let views = document.querySelectorAll('.grid_view, .list_view');
        // console.log('views', views);
        views.forEach(view => {
            let hidden_files = view.querySelectorAll('.card[data-is_hidden="true"]');
            // console.log('hidden files', hidden_files.length);
            hidden_files.forEach(file => {
                file.classList.add('hidden');
            })
        });

    }

    // sort event
    handleColumnSort(item) {

        item.addEventListener('click', (e) => {

            e.preventDefault();
            e.stopPropagation();

            if (this.is_resizing) {
                return;
            }

            // console.log('running sort by column', e.target);
            const latest_settings = settingsManager.get_settings() || {};
            latest_settings.sort_by = e.target.dataset.col_name;
            latest_settings.sort_direction = latest_settings.sort_direction === 'asc' ? 'desc' : 'asc';
            if (latest_settings?.schema?.properties?.['Default View']?.properties?.['Sort By']) {
                latest_settings.schema.properties['Default View'].properties['Sort By'].default = latest_settings.sort_by;
            }
            if (latest_settings?.schema?.properties?.['Default View']?.properties?.['Sort Direction']) {
                latest_settings.schema.properties['Default View'].properties['Sort Direction'].default = latest_settings.sort_direction;
            }
            settingsManager.update_settings(latest_settings);
            this.settings = latest_settings;
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
        item.dataset.is_hidden = f.is_hidden;

    }

    // handle icon
    handleIcon(icon, f, view_type_hint) {

        if (!f) {
            utilities.set_msg('Error: getting icon data', f_);
            return -1;
        }

        if (icon === undefined || icon === null) {
            utilities.set_msg(`Error: loading icon ${icon}`);
            return -1;
        }

        if (f.href === undefined || f.href === null) {
            utilities.set_msg(`Error: getting href ${f.href}`);
            return -2;
        }

        let img = icon.querySelector('.img');
        if (!img) {
            // console.log('Error getting .img for icon', img);
            utilities.set_msg('Error getting .img for icon');
            return -4;
        }

        // console.log('running handle icon', f);
        this.settings = settingsManager.get_settings();

        try {

            // Always start with a transparent SVG so metadata-poor files don't show a visible icon.
            img.src = '../assets/icons/transparent.svg';

            const content_type = typeof f.content_type === 'string' ? f.content_type : '';

            if (f.is_dir || f.type === 'inode/directory') {

                ipcRenderer.send('get_folder_icon', f.href);

            } else if (f.is_dir === false) {

                if (content_type.includes('image/')) {

                    // check for svg
                    if (content_type.includes('svg')) {
                        img.src = f.href;
                        img.classList.add('svg');
                    } else if (content_type.includes('x-xcf')) {
                        ipcRenderer.invoke('get_icon', (f.href)).then(res => {
                            img.src = res;
                        })
                    } else {
                        img.src = f.href;
                    }


                } else if (content_type.includes('video/')) {

                    let video = document.createElement('video');
                    video.src = f.href;
                    video.classList.add('video');
                    icon.innerHTML = '';
                    icon.append(video);
                    const view_container = icon.closest('.view_container');
                    const view_type = view_type_hint || (view_container?.classList.contains('list_view') ? 'list_view' : 'grid_view');
                    iconManager.apply_icon_size_to_media(video, view_type);

                } else {
                    img.classList.add('lazy');
                    img.dataset.iconHref = f.href;
                    img.dataset.src = '';
                }

            }

            if (!f.is_writable) {
                icon.classList.add('readonly');
                let readonly_img = document.createElement('img');
                ipcRenderer.invoke('get_readonly_icon', f.href).then(readonly_icon => {
                    // console.log('readonly icon', readonly_icon);
                    readonly_img.src = readonly_icon;
                    readonly_img.classList.add('symlink', 'readonly-emblem');
                    icon.append(readonly_img);
                })
            }

            if (f.is_symlink) {
                let symlink_img = document.createElement('img');
                ipcRenderer.invoke('get_symlink_icon', f.href).then(symlink_icon => {
                    symlink_img.src = symlink_icon;
                    symlink_img.classList.add('symlink', 'symlink-emblem');
                    icon.append(symlink_img);
                })
            }

            {
                const view_container = icon.closest('.view_container');
                const view_type = view_type_hint || (view_container?.classList.contains('list_view') ? 'list_view' : 'grid_view');
                iconManager.apply_icon_size_to_media(img, view_type);
            }

        } catch (err) {

            // console.log('Error loading icon', err);
            utilities.set_msg(`Error loading icon ${err}`);

            ipcRenderer.invoke('get_icon', (f.href)).then(res => {
                img.src = res;
            })

            {
                const view_container = icon.closest('.view_container');
                const view_type = view_type_hint || (view_container?.classList.contains('list_view') ? 'list_view' : 'grid_view');
                iconManager.apply_icon_size_to_media(img, view_type);
            }

        }

        return 0;

    }

    handleFolderSize(f) {
        ipcRenderer.send('get_folder_size', f.href);
    }

    // handle dragstart
    handleDragStart(item) {

        item.addEventListener('dragstart', (e) => {

            // console.log(item);
            // utilities.copy();

            item.classList.add('highlight_select');

            const href = item?.dataset?.href;
            if (href) {
                // Provide standard drag payloads so Linux desktop apps can accept the drop.
                e.dataTransfer.setData('text/plain', href);
                e.dataTransfer.setData('text/uri-list', `file://${href}`);

                // Native startDrag can crash on some Linux/X11 Electron builds.
                if (process.platform !== 'linux') {
                    ipcRenderer.send('start_drag_external', href);
                }
            }

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
                    // utilities.set_msg('Running drop ctrl', item.dataset.href);
                    utilities.paste();
                } else {
                    // console.log('running drop', item.dataset.href);
                    utilities.move();
                }

            } else {

                // console.log('did not find target')
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

            if (e.key === 'Enter') {
                e.stopPropagation();
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

    handleInitKeyNav() {

        const view_container = document.querySelector('.view_container');
        if (!view_container) return;
        const cards = Array.from(view_container.querySelectorAll('.card'));
        if (!cards.length) return;
        const active = document.activeElement;
        const isCardFocused = active && active.classList && active.classList.contains('card');
        if (!isCardFocused) {
            if (typeof this.clearHighlight === 'function') this.clearHighlight();
            cards[0].focus();
            cards[0].classList.add('highlight_select');
        }
    }

    handleKeyNav(card, f) {

        // Allow navigation with arrow keys between cards in the current view
        card.tabIndex = 0; // Make card focusable
        card.addEventListener('keydown', (e) => {
            // Prevent navigation if focus is in an input, textarea, or contenteditable
            const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
                return;
            }

            const viewContainer = card.closest('.view_container');
            if (!viewContainer) return;
            const cards = Array.from(viewContainer.querySelectorAll('.card'));
            const currentIndex = cards.indexOf(card);
            if (currentIndex === -1) return;

            let nextIndex = null;
            let cardsPerRow = 1;
            // Try to estimate cards per row for grid view
            if (viewContainer.classList.contains('grid_view')) {
                // All cards have same width, so use offsetTop to group by row
                const currentTop = card.offsetTop;
                cardsPerRow = cards.filter(c => c.offsetTop === currentTop).length || 1;
            }

            switch (e.key) {
                case 'ArrowDown':
                    if (viewContainer.classList.contains('grid_view')) {
                        nextIndex = currentIndex + cardsPerRow;
                    } else {
                        nextIndex = currentIndex + 1;
                    }
                    break;
                case 'ArrowUp':
                    if (viewContainer.classList.contains('grid_view')) {
                        nextIndex = currentIndex - cardsPerRow;
                    } else {
                        nextIndex = currentIndex - 1;
                    }
                    break;
                case 'ArrowLeft':
                    nextIndex = currentIndex - 1;
                    break;
                case 'ArrowRight':
                    nextIndex = currentIndex + 1;
                    break;
                case 'Enter': {
                    // Open the selected file or folder
                    if (typeof card !== 'undefined' && card.dataset) {
                        if (card.dataset.is_dir === 'true' || card.dataset.type === 'inode/directory') {
                            // Open folder
                            fileManager.get_files(card.dataset.href);
                        } else {
                            // Open file (simulate click or call open handler)
                            ipcRenderer.send('open', card.dataset.href)
                        }
                    }
                    break;
                }
                default:
                    return;
            }
            if (nextIndex !== null && nextIndex >= 0 && nextIndex < cards.length) {
                e.preventDefault();
                cards[nextIndex].focus();
                if (e.shiftKey) {
                    const is_contracting = e.key === 'ArrowUp' || e.key === 'ArrowLeft';

                    if (is_contracting) {
                        // Contract selection when moving backward.
                        card.classList.remove('highlight_select');
                        cards[nextIndex].classList.add('highlight_select');
                    } else {
                        // Extend selection when moving forward.
                        cards[nextIndex].classList.add('highlight_select');
                        card.classList.add('highlight_select');
                    }
                } else {
                    // Single select: clear all, highlight only next
                    this.clearHighlight();
                    cards[nextIndex].classList.add('highlight_select');
                }
            }
        });
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
                // console.log('running handle click file', f.href);
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

    // Show overwrite conflict resolution view in a new tab
    show_overwrite_view(overwrite_arr, operation) {

        tabManager.add_tab('File Conflicts');
        const active_tab_content = tabManager.get_active_tab_content();

        const container = utilities.add_div(['overwrite_view']);
        container.style.cssText = 'padding: 10px; overflow-y: auto; height: 100%;';

        // --- Header bar ---
        const header = utilities.add_div();
        header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border);';

        const title = utilities.add_div();
        title.innerHTML = `<strong>${overwrite_arr.length} file conflict${overwrite_arr.length !== 1 ? 's' : ''}</strong>`;
        title.style.flex = '1';

        const btn_overwrite_all = utilities.add_div();
        btn_overwrite_all.innerHTML = 'Overwrite All';
        btn_overwrite_all.style.cssText = 'cursor: pointer; padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--menu);';

        const btn_skip_all = utilities.add_div();
        btn_skip_all.innerHTML = 'Skip All';
        btn_skip_all.style.cssText = 'cursor: pointer; padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--menu);';

        header.append(title, btn_overwrite_all, btn_skip_all);
        container.append(header);

        // --- Column headers ---
        const col_header = utilities.add_div();
        col_header.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 4px; opacity: 0.6; font-weight: bold; border-bottom: 1px solid var(--border); margin-bottom: 4px;';
        const ch_name = utilities.add_div(); ch_name.innerHTML = 'Name'; ch_name.style.flex = '1';
        const ch_dest = utilities.add_div(); ch_dest.innerHTML = 'Destination'; ch_dest.style.flex = '2';
        const ch_actions = utilities.add_div(); ch_actions.innerHTML = 'Action'; ch_actions.style.cssText = 'width: 140px; text-align: right;';
        col_header.append(ch_name, ch_dest, ch_actions);
        container.append(col_header);

        // --- File list ---
        const list = utilities.add_div();
        container.append(list);

        // track remaining conflicts so bulk actions work on unresolved ones
        let remaining = [...overwrite_arr];

        const remove_row = (f, row) => {
            row.remove();
            remaining = remaining.filter(r => r.source !== f.source);
            if (remaining.length === 0) {
                utilities.set_msg('All conflicts resolved.');
            }
        };

        overwrite_arr.forEach(f => {
            const row = utilities.add_div();
            row.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 5px 4px; border-bottom: 1px solid var(--border);';

            const icon = document.createElement('i');
            icon.classList.add('bi', f.is_dir ? 'bi-folder' : 'bi-file-earmark');
            icon.style.cssText = 'font-size: 14px; flex-shrink: 0;';

            const name_div = utilities.add_div();
            name_div.innerHTML = f.name;
            name_div.title = `${f.source} → ${f.destination}`;
            name_div.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

            const dest_div = utilities.add_div();
            dest_div.innerHTML = f.destination;
            dest_div.title = f.destination;
            dest_div.style.cssText = 'flex: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.7;';

            const btn_overwrite = utilities.add_div();
            btn_overwrite.innerHTML = 'Overwrite';
            btn_overwrite.style.cssText = 'cursor: pointer; padding: 3px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--menu); white-space: nowrap; flex-shrink: 0;';
            btn_overwrite.addEventListener('click', () => {
                ipcRenderer.send('overwrite_one', f, operation);
                remove_row(f, row);
            });

            const btn_keep = utilities.add_div();
            btn_keep.innerHTML = 'Keep';
            btn_keep.style.cssText = 'cursor: pointer; padding: 3px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--menu); white-space: nowrap; flex-shrink: 0;';
            btn_keep.addEventListener('click', () => {
                remove_row(f, row);
            });

            const actions = utilities.add_div();
            actions.style.cssText = 'display: flex; gap: 4px; flex-shrink: 0;';
            actions.append(btn_overwrite, btn_keep);

            row.append(icon, name_div, dest_div, actions);
            list.append(row);
        });

        btn_overwrite_all.addEventListener('click', () => {
            const to_overwrite = [...remaining];
            ipcRenderer.send('overwrite_all', to_overwrite, operation);
            list.innerHTML = '';
            remaining = [];
            utilities.set_msg(`Overwriting ${to_overwrite.length} file${to_overwrite.length !== 1 ? 's' : ''}.`);
        });

        btn_skip_all.addEventListener('click', () => {
            list.innerHTML = '';
            remaining = [];
            utilities.set_msg('Skipped all conflicts.');
        });

        active_tab_content.appendChild(container);
    }

    // create a breadcrumbs from location
    get_breadcrumbs(location) {

        // console.log('running get breadcrumbs', location);

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

        // click event for breadcrumbs div (use onclick to avoid accumulating duplicate listeners)
        breadcrumb_div.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            utilities.show_location_input();
        };

    }

    // request files from location
    get_files(location, add_tab = false) {

        // console.log('running get_files', location);

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

        // console.log('running add_items');

        // Loop Copy array
        copy_arr.forEach(f => {

            // make sure f is complete
            for (let a in f) {
                if (f[a] === undefined || f[a] === null) {
                    // console.log('error getting grid view item', f);
                    utilities.set_msg('Error: Getting properties for', f);
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
            // console.log('no cards found in the view');
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
                    // console.log('error getting grid view item', f);
                    utilities.set_msg('Error: Getting grid view item', f);
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
        // console.log('sorting', this.sort_by, this.sort_direction);
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

        // console.log('running update_item', f);

        // check file object
        for (let i in f) {
            if (f[i] === undefined || f[i] === null) {
                // console.log('Invalid property:', i, f[i]);
                utilities.set_msg(`Error: Invalid property: ${i} ${f[i]}`);
                return;
            }
        }

        let active_tab_content = tabManager.get_active_tab_content(); //document.querySelector('.active-tab-content');
        let item = active_tab_content.querySelector(`[data-id="${f.id}"]`);

        if (item) {

            // Get card
            let card = this.get_view_item(f);
            if (!card) {
                // console.log('error getting card');
                utilities.set_msg('Error: Getting card');
                return;
            }

            // replace card with updated card
            item.replaceWith(card);
            utilities.lazy_load_icons(active_tab_content);

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

class PropertiesManager {

    constructor() {

        ipcRenderer.on('properties', (e, properties_arr) => {
            this.show_properties(properties_arr);
        })

    }

    // show_properties(properties_arr) {

    //     console.log('properties_arr', properties_arr);
    //     tabManager.add_tab('Properties');
    //     const active_tab_content = document.querySelector('.active-tab-content');
    //     let properties_div = utilities.add_div(['properties']);
    //     active_tab_content.appendChild(properties_div);

    //     if (properties_arr.length > 0) {
    //         properties_arr.forEach((properties, index) => {
    //             let properties_table = this.get_properties_table(properties);
    //             properties_div.appendChild(properties_table);
    //         });
    //     }

    // }

    show_properties(properties_arr) {

        tabManager.add_tab('Properties');
        let active_tab_content = document.querySelector('.active-tab-content');

        if (properties_arr.length > 0) {

            properties_arr.forEach(file => {

                // console.log('file', file);

                let properties_div1 = utilities.add_div();
                let basic_content = utilities.add_div();
                let permissions_content = utilities.add_div();

                properties_div1.classList.add('properties_view', 'grid2');
                basic_content.classList.add('basic');
                permissions_content.classList.add('permissions');

                properties_div1.append(basic_content, permissions_content);
                active_tab_content.append(properties_div1);
                // tab_content.append(properties_div1);

                // Basic Tab
                let card = utilities.add_div();
                let content = utilities.add_div();

                card.dataset.properties_href = file.href;
                card.dataset.href = file.href;

                let close_btn = utilities.add_div();
                let close_icon = document.createElement('i');
                close_icon.classList.add('bi', 'bi-x');
                close_btn.classList.add('float', 'right', 'pointer');
                close_btn.append(close_icon);
                close_btn.addEventListener('click', (e) => {
                    card.remove()
                    let cards = document.querySelectorAll('.properties')
                    if (cards.length === 0) {
                        utilities.clear()
                        // navigation.sidebarHome();
                    }
                })

                content.classList.add('content');
                card.classList.add('properties');

                let icon = utilities.add_div();
                icon.classList.add('icon');
                card.append(icon);

                content.append(utilities.add_item('Name:'), utilities.add_item(file.display_name));

                let contents_item = utilities.add_div();
                contents_item.classList.add('item', 'folder_count');

                let size = utilities.add_div();
                size.classList.add('size');

                content.append(utilities.add_item('Type:'), utilities.add_item(file.content_type));
                content.append(utilities.add_item(`Contents:`), contents_item);

                let location = utilities.add_item(file.location);
                location.title = file.location;

                content.append(utilities.add_item('Location:'), location);

                if (file.is_dir) {

                    // utilities.getFolderIcon(file).then(folder_icon => {
                    //     // console.log('folder_icon', folder_icon)
                    //     let icon_img = utilities.add_img(folder_icon);
                    //     icon_img.classList.add('icon48');
                    //     icon.append(icon_img);
                    // });

                    content.append(utilities.add_item('Size:'), utilities.add_item(size));

                    if (file.is_readable) {
                        size.append('Calculating...');

                        contents_item.textContent = this.get_contents_text(file);

                        ipcRenderer.send('get_folder_size', file.href);

                    } else {

                        size.append('Unknown')
                        contents_item.textContent = 'Unknown';

                    }


                } else {

                    contents_item.textContent = this.get_contents_text(file);
                    content.append(utilities.add_item('Size:'), utilities.add_item(utilities.get_file_size(file.size)));

                    ipcRenderer.invoke('get_icon', (file.href)).then(res => {

                        let icon_img;
                        if (file.content_type.indexOf('image/') > -1) {
                            icon_img = utilities.add_img(file.href);
                            icon_img.classList.add('icon48');
                            icon.append(icon_img);
                        } else {
                            icon_img = utilities.add_img(res);
                            icon_img.classList.add('icon48');
                            icon.append(icon_img);
                        }
                    })

                }

                if (!file.mtime) {
                    file.mtime = "";
                }
                if (!file.atime) {
                    file.atime = "";
                }
                if (!file.ctime) {
                    file.ctime = "";
                }

                content.append(utilities.add_item(`Modified:`), utilities.add_item(utilities.get_date_time(file.mtime)));
                content.append(utilities.add_item(`Accessed:`), utilities.add_item(utilities.get_date_time(file.atime)));
                content.append(utilities.add_item(`Created:`), utilities.add_item(utilities.get_date_time(file.ctime)));

                card.append(content);
                basic_content.append(card)

                // Permissions Tab
                let permissions = this.getPermissions(file.permissions);
                let rows = ['Owner', 'Access', 'Group', 'Access', 'Other', 'Access']
                let perm_key;

                if (!file.is_dir) {
                    rows.push('Execute')
                }

                for (let i = 0; i < rows.length; i++) {

                    let row = utilities.add_div(['flex', 'row']);
                    for (let ii = 0; ii < 2; ii++) {
                        let col = utilities.add_div();
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
                                col.append(this.getMappedPermissions(permissions[perm_key]));
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

        } else {
            active_tab_content.innerHTML = "Unable to get properties";
        }

    }

    get_contents_text(file) {

        if (!file || typeof file !== 'object') {
            return '--';
        }

        const as_num = (value) => {
            const n = Number(value);
            return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
        };

        const fmt = (n) => n.toLocaleString();

        const folder_count = as_num(
            file.folder_count ?? file.folders_count ?? file.dir_count ?? file.dirs_count ?? file.directories_count
        );
        const file_count = as_num(
            file.file_count ?? file.files_count
        );
        const total_count = as_num(file.count ?? file.total_count ?? file.items_count);

        if (file.is_dir) {
            if (folder_count !== null || file_count !== null) {
                const fdirs = folder_count ?? 0;
                const ffiles = file_count ?? 0;
                const total = total_count !== null ? total_count : (fdirs + ffiles);
                return `${fmt(fdirs)} folders, ${fmt(ffiles)} files (${fmt(total)} items)`;
            }

            if (total_count !== null) {
                return `${fmt(total_count)} items`;
            }

            return '--';
        }

        return '1 file';
    }

    getPermissions(unixMode) {

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

    getMappedPermissions(permissionValue) {
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

}

class Navigation {

    constructor() {

        // // this.fileManager = FileManager;

        // let back = document.getElementById('btn_back');
        // let forward = document.getElementById('btn_forward');

        // if (!back || !forward) {
        //     return;
        // }

        // back.addEventListener('click', () => {
        //     tabManager.tabHistoryBack();
        // });

        // forward.addEventListener('click', () => {
        //     tabManager.tabHistoryForward();
        // });

    }

}

class MenuManager {

    constructor() {

        this.location = utilities.get_location();
        this.main = document.querySelector('.main');

        if (!this.main) {
            return;
        }

        this.main.addEventListener('contextmenu', (e) => {
            this.location = utilities.get_location();
            ipcRenderer.send('main_menu', this.location);
        })

        // Context Menu Commands
        ipcRenderer.on('context-menu-command', (e, cmd) => {

            let location = this.location; //document.querySelector('.location');

            switch (cmd) {
                case 'rename': {
                    utilities.edit();
                    break;
                }
                case 'mkdir': {
                    utilities.mkdir();
                    break;
                }
                case 'cut': {
                    utilities.cut();
                    break;
                }
                case 'copy': {
                    utilities.copy();
                    break
                }
                case 'paste': {
                    utilities.paste();
                    break;
                }
                case 'delete': {
                    utilities.delete();
                    break;
                }
                case 'terminal': {
                    // Use utilities.get_selected_files() to get selected files/folders
                    const selected_files = utilities.get_selected_files();
                    if (selected_files.length > 0) {
                        // Open a terminal for each selected item
                        selected_files.forEach(file => {
                            if (file && file.href) {
                                let new_cmd = `gnome-terminal --working-directory='${file.href}'`;
                                ipcRenderer.send('command', new_cmd);
                            }
                        });
                    } else {
                        // Only open a terminal for the current location if nothing is selected
                        const current_location = utilities.get_location() || settingsManager.get_location();
                        let new_cmd = `gnome-terminal`;
                        if (current_location) {
                            new_cmd = `gnome-terminal --working-directory='${current_location}'`;
                        }
                        ipcRenderer.send('command', new_cmd);
                    }
                    utilities.clear();
                    break;
                }
                case 'connect': {
                    ipcRenderer.send('connect');
                    break;
                }
                case 'add_workspace': {

                    let selected_files_arr = utilities.get_selected_files();

                    // If nothing is selected, add the current location as a workspace item
                    if (!selected_files_arr || selected_files_arr.length === 0) {
                        const current_location = utilities.get_location() || settingsManager.get_location();
                        if (current_location) {
                            selected_files_arr = [{ href: current_location }];
                        }
                    }

                    ipcRenderer.send('add_workspace', selected_files_arr);
                    selected_files_arr = [];
                    utilities.clear();
                    break;
                }
                case 'compress_xz': {
                    utilities.compress('tar.xz');
                    break
                }
                case 'compress_gz': {
                    utilities.compress('tar.gz');
                    break;
                }
                case 'compress_zip': {
                    utilities.compress('zip');
                    break;
                }
                case 'extract': {
                    utilities.extract();
                    break;
                }
                case 'properties': {
                    let selected_files_arr = [];
                    const active_tab_content = tabManager.get_active_tab_content();
                    const selected_items = active_tab_content
                        ? active_tab_content.querySelectorAll('.highlight, .highlight_select')
                        : [];

                    if (selected_items.length > 0) {
                        selected_files_arr = utilities.get_selected_files();
                    } else {
                        const current_location = utilities.get_location() || settingsManager.get_location();
                        if (current_location) {
                            selected_files_arr = [{ href: current_location }];
                        }
                    }

                    ipcRenderer.send('get_properties', selected_files_arr);
                    selected_files_arr = [];
                    utilities.clear();
                    break;
                }
                case 'sidebar_properties': {
                    let sidebar = document.querySelector('.sidebar');
                    let items = sidebar.querySelectorAll('.item');
                    items.forEach(item => {
                        if (item.classList.contains('highlight_select')) {
                            let file_arr = [];
                            file_arr.push({ href: item.dataset.href });
                            // console.log('item', item.dataset.href);
                            ipcRenderer.send('get_properties', file_arr);
                            clearHighlight();
                        }
                    })

                    break;
                }
                case 'open_templates': {
                    ipcRenderer.invoke('get_templates_folder').then(path => {
                        fileManager.get_files(path);
                        // viewManager.getView(path, 1)
                    })
                    break;
                }
                case 'select_all': {
                    utilities.select_all();
                    break;
                }

            }

            utilities.clear_highlight();

        })

    }

}

class WindowManager {

    constructor() {

        // let main = document.querySelector('.main');
        window.addEventListener('resize', (e) => {

            let content = document.querySelector('.active-tab-content');

            const tag = e.target.tagName.toLowerCase();
            const isEditable = e.target.isContentEditable;
            if (tag === 'input' || tag === 'textarea' || isEditable) {
                // Let the input handle the event, do not trigger custom shortcuts
                return;
            }

        })

    }

}

// the @type is so jump to definition works in vscode for these variables that are initialized in the init function below
/** @type {EventManager} */ let eventManager
/** @type {Utilities} */ let utilities;
/** @type {SettingsManager} */ let settingsManager;
/** @type {KeyBoardManager} */ let km;
/** @type {IconManager} */ let iconManager;
/** @type {TabManager} */ let tabManager;
/** @type {DragSelect} */ let dragSelect;
/** @type {FileManager} */ let fileManager;
/** @type {PropertiesManager} */ let propertiesManager;
/** @type {MenuManager} */ let menuManager;
/** @type {DeviceManager} */ let deviceManager;
/** @type {WorkspaceManager} */ let workspaceManager;
/** @type {SideBarManager} */ let sideBarManager;
/** @type {WindowManager} */ let windowManager;

// init
function init() {

    eventManager = new EventManager();

    utilities = new Utilities();
    settingsManager = new SettingsManager();
    km = new KeyBoardManager();
    iconManager = new IconManager();
    tabManager = new TabManager();
    dragSelect = new DragSelect();
    fileManager = new FileManager(tabManager, iconManager);
    propertiesManager = new PropertiesManager();
    menuManager = new MenuManager();
    windowManager = new WindowManager();
    const navigation = new Navigation();

    // side bar init
    sideBarManager = new SideBarManager();
    deviceManager = new DeviceManager();
    workspaceManager = new WorkspaceManager();

    // Expose utilities to window for use in other renderer scripts (e.g., titlebar.js)
    window.utilities = utilities;

}

document.addEventListener('DOMContentLoaded', init);


// setTimeout(() => {
//     dragSelect.initialize();
// }, 1000);

// let active_tab_content = tabManager.get_active_tab_content();
// let items = Array.from(active_tab_content.querySelectorAll('.card, .tr'));

// let items_arr = []
// items.forEach((item, idx) => {
//     let f = {
//         id: item.dataset.id,
//         name: item.dataset.name,
//         href: item.dataset.href,
//         name: item.dataset.name,
//         display_name: item.dataset.name,
//         size: item.dataset.size,
//         mtime: item.dataset.mtime,
//         atime: item.dataset.atime,
//         ctime: item.dataset.ctime,
//         content_type: item.dataset.content_type,
//         type: item.dataset.type,
//         is_dir: utilities.stob(item.dataset.is_dir),
//         is_writable: item.dataset.is_writable,
//         location: item.dataset.location
//     };
//     items_arr.push(f);
// })

// const sortFunctions = {
//     name: (a, b) => a.name.localeCompare(b.name),
//     size: (a, b) => a.size - b.size,
//     mtime: (a, b) => a.mtime - b.mtime,
//     ctime: (a, b) => a.ctime - b.ctime,
//     atime: (a, b) => a.atime - b.atime
// };

// items_arr.sort((a, b) => {

//     // First, separate directories and files
//     if (a.is_dir !== b.is_dir) {
//         return a.is_dir ? -1 : 1;
//     }

//     // console.log(a)

//     // Sort by hidden status last
//     if (a.name.startsWith('.') !== b.name.startsWith('.')) {
//         return a.name.startsWith('.') ? 1 : -1;
//     }

//     // If both are directories or both are files, sort based on the specified criteria
//     if (this.sort_by in sortFunctions) {
//         const sortFunction = sortFunctions[this.sort_by];
//         const result = sortFunction(a, b);
//         return sort_direction === 'asc' ? result : -result;
//     }

// });

// Remove and re-append to update DOM order
// items.forEach(item => active_tab_content.appendChild(item));

// if (this.view === 'grid_view') {
//     this.get_grid_view(items_arr);
// } else if (this.view === 'list_view') {
//     this.get_list_view(items_arr);
// }

// // // Save sort settings
// this.settings.sort_by = this.sort_by;
// this.settings.sort_direction = this.sort_direction;
// settingsManager.update_settings(this.settings);

// if (sort === null || sort === undefined || sort === '') {
//     utilities.set_msg(`Error: Sort is null or undefined ${sort}`);
//     return;
// }
// if (sort_direction === null || sort_direction === undefined || sort_direction === '') {
//     utilities.set_msg(`Error: Sort direction is null or undefined ${sort_direction}`);
//     return;
// }
// if (this.location === null || this.location === undefined || this.location === '') {
//     utilities.set_msg(`Error: Location is null or undefined ${this.location}`);
//     return;
// }

// this.sort_by = sort;
// this.sort_direction = sort_direction;