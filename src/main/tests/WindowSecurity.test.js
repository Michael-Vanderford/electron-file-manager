const { secureWindow } = require('../lib/WindowSecurity');

test('window policy denies popups, off-page/subframe navigation, webviews, and permissions', () => {
    const listeners = {};
    const session = { setPermissionRequestHandler: jest.fn(), setPermissionCheckHandler: jest.fn() };
    const contents = { session, on: (name, listener) => { listeners[name] = listener; }, setWindowOpenHandler: jest.fn() };
    const allowed = 'file:///app/index.html'; secureWindow({ webContents: contents }, allowed);
    expect(contents.setWindowOpenHandler.mock.calls[0][0]({ url: 'https://example.test/' })).toEqual({ action: 'deny' });
    const own = { url: allowed, isMainFrame: true, preventDefault: jest.fn() };
    listeners['will-navigate'](own); listeners['will-frame-navigate'](own);
    expect(own.preventDefault).not.toHaveBeenCalled();
    for (const url of ['https://example.test/', 'file:///tmp/untrusted.html', 'about:blank']) {
        const event = { url, isMainFrame: true, preventDefault: jest.fn() };
        listeners['will-navigate'](event); expect(event.preventDefault).toHaveBeenCalled();
    }
    const frame = { url: allowed, isMainFrame: false, preventDefault: jest.fn() };
    listeners['will-frame-navigate'](frame); expect(frame.preventDefault).toHaveBeenCalled();
    const webview = { preventDefault: jest.fn() }; listeners['will-attach-webview'](webview);
    expect(webview.preventDefault).toHaveBeenCalled();
    const reply = jest.fn(); session.setPermissionRequestHandler.mock.calls[0][0](contents, 'geolocation', reply);
    expect(reply).toHaveBeenCalledWith(false);
    expect(session.setPermissionCheckHandler.mock.calls[0][0](contents, 'media')).toBe(false);
});
