const { app, nativeImage } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { createHash } = require('crypto');
const { pathToFileURL, fileURLToPath } = require('url');

const { prune_cache } = require('../common/thumbnail_cache');
const pinned = new Set();
let next_cleanup = 0;

app.disableHardwareAcceleration();
process.on('disconnect', () => app.quit());
process.on('message', async ({ href, cache, retain = [] }) => {
    retain.forEach(url => { try { pinned.add(fileURLToPath(url)); } catch (error) { } });
    let url = null;
    try {
        await app.whenReady();
        const stat = await fs.stat(href);
        // Include decoder version and source metadata to invalidate edited images.
        const key = createHash('sha256').update(JSON.stringify([1, href, stat.mtimeMs, stat.ctimeMs, stat.size, 256])).digest('hex');
        const target = path.join(cache, `${key}.png`);
        await fs.mkdir(cache, { recursive: true });
        try {
            await fs.access(target);
        } catch {
            const image = nativeImage.createFromPath(href);
            if (image.isEmpty()) throw new Error('Unsupported image');
            const size = image.getSize();
            const scale = Math.min(1, 256 / Math.max(size.width, size.height));
            const thumbnail = image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) });
            const temp = `${target}.${process.pid}.tmp`;
            await fs.writeFile(temp, thumbnail.toPNG());
            await fs.rename(temp, target);
        }
        pinned.add(target);
        url = pathToFileURL(target).href;
        if (Date.now() >= next_cleanup) {
            next_cleanup = Date.now() + 60000;
            try { await prune_cache(cache, pinned); } catch (error) { /* A cleanup failure must not discard a valid preview. */ }
        }
    } catch {
        // Corrupt and unsupported files keep the generic image icon.
    }
    if (process.connected) process.send({ href, url });
});
