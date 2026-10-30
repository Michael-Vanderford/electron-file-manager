function secureWindow(window, allowedURL) {
    const contents = window.webContents;
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', event => { if (event.url !== allowedURL) event.preventDefault(); });
    contents.on('will-frame-navigate', event => {
        if (!event.isMainFrame || event.url !== allowedURL) event.preventDefault();
    });
    contents.on('will-attach-webview', event => event.preventDefault());
    contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    contents.session.setPermissionCheckHandler(() => false);
}
module.exports = { secureWindow };
