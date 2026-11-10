const { show_folder_size } = require('../remote_folder_size');
const settings = enabled => ({ schema: { properties: { 'Default View': { properties: {
    'Show Remote Folder Sizes': { default: enabled }
} } } } });
test.each(['/run/user/1000/gvfs/smb-share:server=host,share=files/folder', '/tmp/.gvfs/share/folder', '/tmp/.sftp/host/folder', 'sftp://host/folder'])(
    'remote folder sizes require explicit opt-in: %s', location => {
        expect(show_folder_size(location, {})).toBe(false);
        expect(show_folder_size(location, settings(false))).toBe(false);
        expect(show_folder_size(location, settings(true))).toBe(true);
    }
);
test('local folder sizes remain enabled', () => {
    expect(show_folder_size('/home/user/folder', settings(false))).toBe(true);
});
