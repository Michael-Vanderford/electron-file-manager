// @ts-nocheck
// Custom title bar logic for Electron frameless window

window.addEventListener('DOMContentLoaded', () => {
    const { ipcRenderer } = require('electron');
    const titlebar = document.querySelector('.titlebar');
    if (!titlebar) return;

    // Button actions
    titlebar.querySelector('.titlebar-min').onclick = () => ipcRenderer.send('window-minimize');
    titlebar.querySelector('.titlebar-max').onclick = () => ipcRenderer.send('window-maximize');
    titlebar.querySelector('.titlebar-close').onclick = () => ipcRenderer.send('window-close');

    // Menu dropdown logic
    const menuItems = titlebar.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('focus', () => {
            // item.classList.add('open');
        });
        item.addEventListener('blur', () => {
            item.classList.remove('open');
        });
        item.addEventListener('mouseenter', () => {
            // item.classList.add('open');
        });
        item.addEventListener('click', () => {
            item.classList.toggle('open');
        });
        item.addEventListener('mouseleave', () => {
            // item.classList.remove('open');
        });
    });

    // Menu item actions (stub)
    titlebar.querySelectorAll('.menu-dropdown-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const action = el.getAttribute('data-action');
            switch (action) {
                case 'new-window': {
                    const currentLocation = (window.utilities && typeof window.utilities.get_location === 'function')
                        ? window.utilities.get_location()
                        : (document.querySelector('.location')?.value || '');
                    ipcRenderer.send('new-window', currentLocation);
                    break;
                }
                case 'sidebar':
                    if (window.sideBarManager && typeof window.sideBarManager.toggle_sidebar === 'function') {
                        window.sideBarManager.toggle_sidebar();
                    }
                    break;
                case 'reload':
                    location.reload();
                    break;
                case 'toggle-devtools':
                    ipcRenderer.send('toggle-devtools');
                    break;
                case 'fullscreen':
                    ipcRenderer.send('toggle-fullscreen');
                    break;
                case 'exit':
                    ipcRenderer.send('window-close');
                    break;
                case 'about':
                    showAboutDialog();
                    break;
                case 'cut':
                    window.utilities.cut();
                    break;
                case 'copy':
                    window.utilities.copy();
                    break;
                case 'paste':
                    window.utilities.paste();
                    break;
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
            require('electron').ipcRenderer.invoke('get_app_versions').then((versions) => {
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
});
