const fs = require('fs/promises');
const path = require('path');

// Pinned files have been served by the current decoder session. Never remove
// them while a renderer may still be using their URL; the budget is soft for pins.
async function prune_cache(directory, pinned, max_bytes = 256 * 1024 * 1024, max_entries = 4096) {
    const entries = [];
    for (const name of await fs.readdir(directory)) {
        if (!/^[a-f0-9]{64}\.png$/.test(name)) continue;
        const file = path.join(directory, name);
        try {
            const stat = await fs.lstat(file);
            if (stat.isFile()) entries.push({ file, size: stat.size, time: stat.mtimeMs });
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    let bytes = entries.reduce((total, entry) => total + entry.size, 0);
    let count = entries.length;
    for (const entry of entries.sort((a, b) => a.time - b.time)) {
        if (bytes <= max_bytes && count <= max_entries) break;
        if (pinned.has(entry.file)) continue;
        try { await fs.unlink(entry.file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        bytes -= entry.size;
        count--;
    }
}
module.exports = { prune_cache };
