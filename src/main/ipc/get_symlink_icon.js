// main/ipc/get_symlink_icon.js
const { ipcMain } = require('electron');
const iconManager = require('../lib/IconManager.js');

ipcMain.handle('get_symlink_icon', () => {
    return iconManager.get_symlink_icon();
});