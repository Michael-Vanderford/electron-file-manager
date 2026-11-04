const fs = require('fs');
const os = require('os');
const path = require('path');
const { prepare_transfer } = require('../prepare_transfer');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-prepare-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const file = (location, name = 'sample.txt') => ({ name, display_name: name, href: path.join(location, name),
    location, is_dir: false, is_hidden: false });

test.each(['copy', 'move'])('%s preserves conflict and duplicate-name planning without mutating disk', operation => {
    fs.writeFileSync(path.join(root, 'sample.txt'), 'original');
    const duplicate = prepare_transfer({ files: [file(root)], location: root, operation });
    expect(duplicate.ready[0].destination).toBe(path.join(root, 'sample (Copy 1).txt'));
    const conflict = prepare_transfer({ files: [file('/other')], location: root, operation });
    expect(conflict.overwrite).toHaveLength(1);
    expect(conflict.ready).toHaveLength(0);
    expect(fs.readdirSync(root)).toEqual(['sample.txt']);
});

test('broken destination symlinks remain conflicts rather than silently bypassing overwrite', () => {
    fs.symlinkSync(path.join(root, 'missing'), path.join(root, 'sample.txt'));
    expect(prepare_transfer({ files: [file('/other')], location: root, operation: 'copy' }).overwrite).toHaveLength(1);
});

test('I/O failures abort planning rather than treating an inaccessible destination as missing', () => {
    const spy = jest.spyOn(fs, 'lstatSync').mockImplementation(() => { throw Object.assign(new Error('offline'), { code: 'EIO' }); });
    try { expect(() => prepare_transfer({ files: [file('/other')], location: root, operation: 'copy' })).toThrow('offline'); }
    finally { spy.mockRestore(); }
});
