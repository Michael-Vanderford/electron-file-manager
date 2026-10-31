// UTF-8 base64 in both Node workers and sandboxed Chromium preloads.
function path_id(value) {
    if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf8').toString('base64');
    return btoa(encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
}
module.exports = { path_id };
