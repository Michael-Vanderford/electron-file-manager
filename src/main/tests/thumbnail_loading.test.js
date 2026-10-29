const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
const start = source.indexOf('    lazy_load_icons(table) {');
const end = source.indexOf('    // clear selection', start);

test('bounds visible thumbnail requests and drops detached queued images', async () => {
    let intersect;
    const completions = [];
    const invoke = jest.fn(() => new Promise(resolve => completions.push(resolve)));
    const images = Array.from({ length: 5 }, (_, index) => {
        const classes = new Set(['lazy']);
        return { isConnected: true, dataset: { thumbnailHref: `/image-${index}.png` },
            classList: { contains: value => classes.has(value), remove: value => classes.delete(value) } };
    });
    const root = { closest: () => root, querySelectorAll: () => images };
    const load = vm.runInNewContext(`({${source.slice(start, end)}}).lazy_load_icons`, {
        window: { IntersectionObserver: true },
        IntersectionObserver: class {
            constructor(callback) { intersect = callback; }
            observe() {}
            unobserve() {}
            disconnect() {}
        },
        ipcRenderer: { invoke }
    });
    const utilities = {};
    load.call(utilities, root);
    intersect(images.map(target => ({ target, isIntersecting: true })));
    expect(invoke).toHaveBeenCalledTimes(2);
    images[2].isConnected = false;
    images[0].isConnected = false;
    completions[0]('file:///cache/old.png');
    // Flush the then/catch/finally chain and queue pump.
    for (let index = 0; index < 6; index++) await Promise.resolve();
    expect(images[0].src).toBeUndefined();
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(invoke).toHaveBeenLastCalledWith('get_thumbnail', '/image-3.png');
    expect(utilities.thumbnail_active).toBe(2);
});
