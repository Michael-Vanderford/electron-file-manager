const { EventEmitter } = require('events');
const { stream_results, normalize_find_options } = require('../find_worker');

test('search delivers at most one bounded batch until acknowledged', async () => {
    const port = new EventEmitter();
    const messages = [];
    let notify;
    let arrived = new Promise(resolve => { notify = resolve; });
    port.postMessage = message => { messages.push(message); notify(); };
    let produced = 0;
    async function* files() {
        for (let i = 0; i < 600; i++) { produced++; yield { href: `/file-${i}` }; }
    }
    const request = stream_results(files(), port);
    await arrived;
    expect(produced).toBe(256);
    expect(messages).toHaveLength(1);
    arrived = new Promise(resolve => { notify = resolve; });
    port.emit('message', { cmd: 'continue' });
    await arrived;
    expect(produced).toBe(512);
    arrived = new Promise(resolve => { notify = resolve; });
    port.emit('message', { cmd: 'continue' });
    await arrived;
    expect(messages.map(message => message.files.length)).toEqual([256, 256, 88]);
    port.emit('message', { cmd: 'continue' });
    await request;
    expect(messages.flatMap(message => message.files)).toHaveLength(600);
});

test('search preserves depth, size, and date filters', () => {
    expect(normalize_find_options({ folderDepth: 2, minSize: 10, maxSize: 100, dateFrom: '2026-01-01', dateTo: '2026-12-31' }))
        .toEqual({ maxDepth: 2, minSize: 10, maxSize: 100, dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    expect(normalize_find_options({ folderDepth: -1, minSize: NaN, dateFrom: 'invalid' })).toEqual({});
});
