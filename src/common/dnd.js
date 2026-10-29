// @ts-nocheck

const path = require('path');

function path_to_file_uri(p) {
    const encoded = String(p).split('/').map(encodeURIComponent).join('/');
    return `file://${encoded}`;
}

function file_uri_to_path(uri) {
    try {
        const u = new URL(uri);
        if (u.protocol !== 'file:') return null;
        const p = decodeURIComponent(u.pathname);
        return path.isAbsolute(p) ? p : null;
    } catch (err) {
        return null;
    }
}

// text/uri-list is CRLF separated; lines starting with '#' are comments (RFC 2483).
function parse_uri_list(text) {
    if (!text) return [];
    const out = [];
    for (const line of String(text).split(/\r?\n/)) {
        const l = line.trim();
        if (!l || l.startsWith('#')) continue;
        const p = file_uri_to_path(l);
        if (p) out.push(p);
    }
    return Array.from(new Set(out));
}

function build_drag_payload(paths) {
    const uris = paths.map(path_to_file_uri);
    return {
        'text/uri-list': uris.join('\r\n'),
        'text/plain': paths.join('\n'),
        'x-special/gnome-copied-files': `copy\n${uris.join('\n')}`
    };
}

// A drop is inside itself if the target is the item or one of its descendants.
function is_self_or_descendant(target_dir, source) {
    const rel = path.relative(source, target_dir);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function select_drag_item(item, clear_selection) {
    if (!item.classList.contains('highlight_select') && !item.classList.contains('highlight')) {
        clear_selection();
    }
    item.classList.add('highlight_select');
}

function is_active_destination(destination, location) {
    return path.resolve(destination) === path.resolve(location);
}

module.exports = { path_to_file_uri, file_uri_to_path, parse_uri_list, build_drag_payload, is_self_or_descendant, select_drag_item, is_active_destination };
