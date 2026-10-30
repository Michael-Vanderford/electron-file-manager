const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { extract_archive } = require('../extract_archive');
let fixture;
beforeEach(async () => { fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'efm-extract-')); });
afterEach(async () => { await fs.rm(fixture, { recursive: true, force: true }); });

test('standalone gzip streams restore bytes, preserve the source, and reserve a noncolliding output', async () => {
    const name = '-literal\' $() `name`\n'; const source = path.join(fixture, `${name}.gz`);
    const bytes = Buffer.from('streamed contents\0with binary bytes'); const compressed = zlib.gzipSync(bytes);
    await fs.writeFile(source, compressed); await fs.writeFile(path.join(fixture, name), 'original output');
    const destination = await extract_archive(source, fixture);
    expect(destination).toBe(path.join(fixture, `${name} (Copy 1)`));
    expect(await fs.readFile(destination)).toEqual(bytes);
    expect(await fs.readFile(source)).toEqual(compressed);
    expect(await fs.readFile(path.join(fixture, name), 'utf8')).toBe('original output');
});

test('a failed standalone extractor rejects and removes its partial output', async () => {
    const source = path.join(fixture, 'invalid.gz'); await fs.writeFile(source, 'invalid gzip bytes');
    await expect(extract_archive(source, fixture)).rejects.toThrow('gzip exited');
    expect(await fs.readdir(fixture)).toEqual(['invalid.gz']);
});
