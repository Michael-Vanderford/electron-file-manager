const fs = require('fs');
const os = require('os');
const path = require('path');
const { windows_recent } = require('../windows_recent');

let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-recent-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test('resolves newest unique targets, preserves metadata, and skips broken shortcuts', () => {
    const first = path.join(root, '日本語.txt');
    const folder = path.join(root, 'folder');
    fs.writeFileSync(first, 'contents'); fs.mkdirSync(folder);
    const targets = { 'old.lnk': first, 'new.LNK': first, 'folder.lnk': folder,
        'missing.lnk': path.join(root, 'missing'), 'relative.lnk': 'relative.txt' };
    for (const name of [...Object.keys(targets), 'bad.lnk', 'ignore.txt']) fs.writeFileSync(path.join(root, name), 'fixture');
    fs.utimesSync(path.join(root, 'new.LNK'), new Date('2030-01-01'), new Date('2030-01-01'));
    fs.utimesSync(first, new Date('2020-01-01'), new Date('2020-01-01'));
    const resolve = jest.fn(shortcut => {
        if (path.basename(shortcut) === 'bad.lnk') throw new Error('Invalid shortcut');
        return { target: targets[path.basename(shortcut)] };
    });
    const files = windows_recent(root, resolve);
    expect(files.map(file => file.href)).toEqual([first, folder]);
    expect(files[0].mtime).toBe(new Date('2020-01-01').getTime() / 1000);
    expect(files[0].recent_time).toBe(new Date('2030-01-01').getTime() / 1000);
    expect(files[0].name).toBe('日本語.txt');
    expect(files[1].is_dir).toBe(true);
    expect(resolve.mock.calls.every(([shortcut]) => shortcut.toLowerCase().endsWith('.lnk'))).toBe(true);
});

test('missing and empty history return an empty list; enumeration errors surface', () => {
    expect(windows_recent(root, jest.fn())).toEqual([]);
    expect(windows_recent(path.join(root, 'absent'), jest.fn())).toEqual([]);
    const file = path.join(root, 'file'); fs.writeFileSync(file, 'x');
    expect(() => windows_recent(file, jest.fn())).toThrow();
});
