// @ts-nocheck
// Custom title bar logic for Electron frameless window

window.addEventListener('DOMContentLoaded', () => {
    const titlebar = document.querySelector('.titlebar');
    if (!titlebar) return;

    // Button actions
    titlebar.querySelector('.titlebar-min').onclick = () => window.titlebarAPI.minimize();
    titlebar.querySelector('.titlebar-max').onclick = () => window.titlebarAPI.maximize();
    titlebar.querySelector('.titlebar-close').onclick = () => window.titlebarAPI.close();

    // Menu dropdown logic
    const menuItems = titlebar.querySelectorAll('.menu-item');
    const requirements = {
        selection: (s) => s.count > 0,
        single: (s) => s.count === 1,
        clipboard: (s) => s.has_clipboard && s.is_real_location,
        location: (s) => s.is_real_location,
        'selection-location': (s) => s.count > 0 && s.is_real_location,
        'selection-or-location': (s) => s.count > 0 || s.is_real_location,
        archive: (s) => s.has_archive && s.is_real_location,
        up: (s) => s.can_go_up
    };

    function refreshMenuState() {
        const state = window.titlebarAPI.getMenuState() || {};
        titlebar.querySelectorAll('[data-requires]').forEach((el) => {
            el.classList.toggle('disabled', !requirements[el.dataset.requires](state));
        });
        titlebar.querySelectorAll('[data-view]').forEach((el) => {
            el.classList.toggle('checked', el.dataset.view === state.view);
        });
        titlebar.querySelectorAll('[data-group]').forEach((el) => {
            el.classList.toggle('checked', el.dataset.group === state.group_by);
        });
        titlebar.querySelectorAll('[data-checked="sidebar"]').forEach((el) => {
            el.classList.toggle('checked', !!state.sidebar_visible);
        });
    }

    function closeAllMenus() {
        titlebar.querySelectorAll('.menu-item.open').forEach(item => {
            item.classList.remove('open');
        });
    }

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = item.classList.contains('open');
            if (isOpen) {
                closeAllMenus();
            } else {
                closeAllMenus();
                refreshMenuState();
                item.classList.add('open');
            }
        });
    });

    // Menu item actions (stub)
    titlebar.querySelectorAll('.menu-dropdown-item').forEach(el => {
        el.addEventListener('click', (e) => {
            // Prevent the parent .menu-item toggle handler from reopening the menu
            e.stopPropagation();
            if (el.classList.contains('disabled')) return;

            closeAllMenus();
            const action = el.getAttribute('data-action');
            switch (action) {
                case 'new-window': {
                    const currentLocation = window.titlebarAPI.getLocation() || (document.querySelector('.location')?.value || '');
                    window.titlebarAPI.newWindow(currentLocation);
                    break;
                }
                case 'sidebar': window.titlebarAPI.toggleSidebar(); break;
                case 'reload': location.reload(); break;
                case 'toggle-devtools': window.titlebarAPI.toggleDevtools(); break;
                case 'fullscreen': window.titlebarAPI.toggleFullscreen(); break;
                case 'exit': window.titlebarAPI.close(); break;
                case 'about': showAboutDialog(); break;
                case 'cut': window.titlebarAPI.cut(); break;
                case 'copy': window.titlebarAPI.copy(); break;
                case 'paste': window.titlebarAPI.paste(); break;
                case 'new-tab': window.titlebarAPI.newTab(); break;
                case 'new-folder': window.titlebarAPI.newFolder(); break;
                case 'add-workspace': window.titlebarAPI.command('add_workspace'); break;
                case 'terminal': window.titlebarAPI.command('terminal'); break;
                case 'properties': window.titlebarAPI.command('properties'); break;
                case 'settings': window.titlebarAPI.command('settings'); break;
                case 'connect': window.titlebarAPI.command('connect'); break;
                case 'rename': window.titlebarAPI.rename(); break;
                case 'delete': window.titlebarAPI.delete(); break;
                case 'select-all': window.titlebarAPI.selectAll(); break;
                case 'find': window.titlebarAPI.find(); break;
                case 'compress-zip': window.titlebarAPI.command('compress_zip'); break;
                case 'compress-gz': window.titlebarAPI.command('compress_gz'); break;
                case 'compress-xz': window.titlebarAPI.command('compress_xz'); break;
                case 'extract': window.titlebarAPI.command('extract'); break;
                case 'view-grid': window.titlebarAPI.setView('grid_view'); break;
                case 'view-list': window.titlebarAPI.setView('list_view'); break;
                case 'group-none': window.titlebarAPI.setGroupBy('None'); break;
                case 'group-type': window.titlebarAPI.setGroupBy('Type'); break;
                case 'group-date': window.titlebarAPI.setGroupBy('Date Modified'); break;
                case 'group-size': window.titlebarAPI.setGroupBy('Size'); break;
                case 'refresh': window.titlebarAPI.refresh(); break;
                case 'back': window.titlebarAPI.back(); break;
                case 'forward': window.titlebarAPI.forward(); break;
                case 'up': window.titlebarAPI.up(); break;
                case 'go-home': window.titlebarAPI.goTo('Home'); break;
                case 'go-dashboard': window.titlebarAPI.goTo('Dashboard'); break;
                case 'go-recent': window.titlebarAPI.goTo('Recent'); break;
                case 'go-root': window.titlebarAPI.goTo('File System'); break;
                // Add more actions as needed
                default:
                    // Placeholder for other actions
                    break;
            }
        });
    });

    // About dialog logic
    function showAboutDialog() {
        const dialog = document.getElementById('about-dialog');
        if (dialog) {
            // Fetch version info from main process
            window.titlebarAPI.getAppVersions().then((versions) => {
                const appVer = document.getElementById('about-app-version');
                const elecVer = document.getElementById('about-electron-version');
                const appName = document.getElementById('about-app-name');
                const appDesc = document.getElementById('about-app-description');
                if (appVer && versions.appVersion) appVer.textContent = `Version ${versions.appVersion}`;
                if (elecVer && versions.electronVersion) elecVer.textContent = `Electron version: ${versions.electronVersion}`;
                if (appName && versions.appName) appName.innerHTML = `<strong>${versions.appName}</strong>`;
                if (appDesc && versions.appDescription) appDesc.textContent = versions.appDescription;
            });
            dialog.classList.remove('hidden');
            // Trap focus
            const closeBtn = document.getElementById('about-dialog-close');
            if (closeBtn) {
                closeBtn.focus();
                closeBtn.onclick = () => {
                    dialog.classList.add('hidden');
                };
            }
            // Close on Escape
            function escListener(e) {
                if (e.key === 'Escape') {
                    dialog.classList.add('hidden');
                    document.removeEventListener('keydown', escListener);
                }
            }
            document.addEventListener('keydown', escListener);
        }
    }

    window.addEventListener('click', (e) => {
        if (!titlebar.contains(e.target)) {
            closeAllMenus();
        }
    });
});
