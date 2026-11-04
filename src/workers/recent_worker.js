const { app, shell } = require('electron');
const { windows_recent } = require('../common/windows_recent');

app.disableHardwareAcceleration();
process.on('disconnect', () => app.quit());
process.once('message', async ({ directory }) => {
    await app.whenReady();
    let result;
    try { result = { files: windows_recent(directory, shortcut => shell.readShortcutLink(shortcut)) }; }
    catch (error) { result = { error: error.message }; }
    if (process.connected) process.send(result, () => app.quit());
    else app.quit();
});
