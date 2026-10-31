const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { prune_cache } = require('../thumbnail_cache');
test('cache budget removes old generated previews, protecting active files and unrelated assets', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'efm-cache-'));
    try {
        const old = path.join(directory, `${'a'.repeat(64)}.png`);
        const pinned = path.join(directory, `${'b'.repeat(64)}.png`);
        const other = path.join(directory, 'keep.txt');
        await Promise.all([old, pinned, other].map(file => fs.writeFile(file, '12345')));
        await prune_cache(directory, new Set([pinned]), 5, 1);
        await expect(fs.access(old)).rejects.toMatchObject({ code: 'ENOENT' });
        expect(await fs.readFile(pinned, 'utf8')).toBe('12345');
        expect(await fs.readFile(other, 'utf8')).toBe('12345');
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
