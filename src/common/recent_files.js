const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { fileURLToPath } = require('url');
const fs = require('fs');
const { path_id } = require('./path_id');

function recent_files(xml, get_file) {
    if (XMLValidator.validate(xml) !== true) throw new Error('Invalid recent-file XML.');
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml);
    const value = parsed?.xbel?.bookmark;
    const bookmarks = value ? (Array.isArray(value) ? value : [value]) : [];
    bookmarks.sort((a, b) => (Date.parse(b['@_modified'] || b['@_added']) || 0) - (Date.parse(a['@_modified'] || a['@_added']) || 0));
    const files = new Map();
    for (const bookmark of bookmarks) {
        try {
            const href = fileURLToPath(bookmark['@_href']);
            fs.lstatSync(href); // get_file may synthesize metadata for absent entries.
            if (!files.has(href)) files.set(href, { ...get_file(href), id: path_id(href) });
        } catch (_) { /* Invalid URIs and stale entries are not recent files. */ }
    }
    return [...files.values()];
}
module.exports = { recent_files };
