// @ts-nocheck
// Custom title bar logic for Electron frameless window
window.addEventListener('DOMContentLoaded', () => {
    const { ipcRenderer } = require('electron');
    const titlebar = document.createElement('div');
    titlebar.className = 'custom-titlebar';
    titlebar.innerHTML = `
        <div class="titlebar-menu">
            <div class="menu-item" tabindex="0">File
                <div class="menu-dropdown">
                    <div class="menu-dropdown-item" data-action="new-window">New Window</div>
                    <div class="menu-dropdown-item" data-action="open">Open...</div>
                    <div class="menu-dropdown-item" data-action="save">Save</div>
                    <div class="menu-dropdown-item" data-action="exit">Exit</div>
                </div>
            </div>
            <div class="menu-item" tabindex="0">Edit
                <div class="menu-dropdown">
                    <div class="menu-dropdown-item" data-action="undo">Undo</div>
                    <div class="menu-dropdown-item" data-action="redo">Redo</div>
                    <div class="menu-dropdown-item" data-action="cut">Cut</div>
                    <div class="menu-dropdown-item" data-action="copy">Copy</div>
                    <div class="menu-dropdown-item" data-action="paste">Paste</div>
                </div>
            </div>
            <div class="menu-item" tabindex="0">View
                <div class="menu-dropdown">
                    <div class="menu-dropdown-item" data-action="reload">Reload</div>
                    <div class="menu-dropdown-item" data-action="toggle-devtools">Toggle Developer Tools</div>
                    <div class="menu-dropdown-item" data-action="fullscreen">Toggle Full Screen</div>
                </div>
            </div>
            <div class="menu-item" tabindex="0">Help
                <div class="menu-dropdown">
                    <div class="menu-dropdown-item" data-action="about">About</div>
                </div>
            </div>
        </div>
        <div class="titlebar-drag"></div>
        <div class="titlebar-title"></div>
        <div class="titlebar-controls">
            <button class="titlebar-btn titlebar-min" title="Minimize">&#x2013;</button>
            <button class="titlebar-btn titlebar-max" title="Maximize">&#x25A1;</button>
            <button class="titlebar-btn titlebar-close" title="Close">&#x2715;</button>
        </div>
    `;
    document.body.prepend(titlebar);

    // Button actions
    titlebar.querySelector('.titlebar-min').onclick = () => ipcRenderer.send('window-minimize');
    titlebar.querySelector('.titlebar-max').onclick = () => ipcRenderer.send('window-maximize');
    titlebar.querySelector('.titlebar-close').onclick = () => ipcRenderer.send('window-close');

    // Menu dropdown logic
    const menuItems = titlebar.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('focus', () => {
            item.classList.add('open');
        });
        item.addEventListener('blur', () => {
            item.classList.remove('open');
        });
        item.addEventListener('mouseenter', () => {
            item.classList.add('open');
        });
        item.addEventListener('mouseleave', () => {
            item.classList.remove('open');
        });
    });

    // Menu item actions (stub)
    titlebar.querySelectorAll('.menu-dropdown-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const action = el.getAttribute('data-action');
            switch (action) {
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
