const fs = require('fs');
const path = require('path');
const libfs = require('./libfs');

// Runs in an isolated Electron child: Shell links and remote metadata can block.
function windows_recent(directory, readShortcutLink) {
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const shortcuts = [];
    for (const entry of entries) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.lnk') continue;
        const shortcut = path.join(directory, entry.name);
        try { shortcuts.push({ shortcut, time: fs.statSync(shortcut).mtimeMs }); }
        catch (_) { /* A shortcut may disappear during enumeration. */ }
    }
    shortcuts.sort((a, b) => b.time - a.time);
    const files = new Map();
    for (const { shortcut, time } of shortcuts) {
        try {
            const target = readShortcutLink(shortcut).target;
            if (typeof target !== 'string' || !path.isAbsolute(target)) continue;
            const href = path.normalize(target);
            const key = href.toLowerCase();
            if (files.has(key)) continue;
            const stats = fs.statSync(href);
            if (!stats.isFile() && !stats.isDirectory()) continue;
            files.set(key, { ...libfs.get_file(href), recent_time: time / 1000 });
        } catch (_) { /* Broken links and missing/inaccessible targets are omitted. */ }
    }
    return [...files.values()];
}

module.exports = { windows_recent };
