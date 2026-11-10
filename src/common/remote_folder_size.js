function is_remote_folder(location = '') {
    return /\/\.?(?:gvfs|sftp)\//i.test(location) ||
        (/^[a-z][a-z0-9+.-]*:\/\//i.test(location) && !/^file:\/\//i.test(location));
}
function show_folder_size(location, settings) {
    return !is_remote_folder(location) || settings?.schema?.properties?.['Default View']?.properties?.['Show Remote Folder Sizes']?.default === true;
}
module.exports = { is_remote_folder, show_folder_size };
