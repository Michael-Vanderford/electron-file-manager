const fs = require('fs');
const os = require('os');
const path = require('path');
const { JsonStore } = require('../lib/JsonStore');
const { merge, changes, object } = require('../../common/settings_patch');
let directory, file, store;
beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'efm-store-'));
    file = path.join(directory, 'settings.json');
    store = new JsonStore(file, { view: 'grid', columns: { size: true, name: true } }, object);
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
test('two stale renderer snapshots update only edited fields', () => {
    const first = store.read(), second = store.read();
    store.update(current => merge(current, changes(first, { ...first, view: 'list' })));
    const columns = { ...second, columns: { ...second.columns, size: false } };
    store.update(current => merge(current, changes(second, columns)));
    expect(store.read()).toEqual({ view: 'list', columns: { size: false, name: true } });
    if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600);
});
test('truncation recovers last-good data without committing an incomplete temporary file', () => {
    store.update(value => ({ ...value, terminal: 'custom' }));
    store.update(value => ({ ...value, view: 'list' }));
    fs.writeFileSync(file, '{');
    fs.writeFileSync(`${file}.interrupted.tmp`, '{');
    expect(store.read().terminal).toBe('custom');
    store.update(value => ({ ...value, restored: true }));
    expect(JSON.parse(fs.readFileSync(file))).toMatchObject({ terminal: 'custom', restored: true });
});
test('malformed data without backup is retained; wrong shapes and interrupted publish do not overwrite valid preferences', () => {
    fs.writeFileSync(file, '[]');
    expect(store.read().view).toBe('grid');
    expect(fs.readdirSync(directory).some(name => name.endsWith('.corrupt'))).toBe(true);
    store.update(value => value);
    const rename = jest.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('interrupted'); });
    try { expect(() => store.update(value => ({ ...value, view: 'list' }))).toThrow('interrupted'); }
    finally { rename.mockRestore(); }
    expect(store.read().view).toBe('grid');
});
