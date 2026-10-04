const assert = require('assert');
const { path_to_file_uri, parse_uri_list, build_drag_payload, is_self_or_descendant } = require('../dnd');

test('uri round-trip for special characters', () => {
    const paths = ['/home/a b/c#d%e.txt', '/tmp/ünï/x'];
    const list = paths.map(path_to_file_uri).join('\r\n');
    assert.deepStrictEqual(parse_uri_list(list), paths);
});

test('parse ignores comments, blanks, non-file schemes and duplicates', () => {
    const text = '# c\r\n\r\nhttp://x/y\r\nfile:///a\r\nfile:///a\r\n';
    assert.deepStrictEqual(parse_uri_list(text), ['/a']);
});

test('payload has all mime types', () => {
    const p = build_drag_payload(['/a', '/b c']);
    assert.strictEqual(p['text/uri-list'], 'file:///a\r\nfile:///b%20c');
    assert.strictEqual(p['text/plain'], '/a\n/b c');
    assert.ok(p['x-special/gnome-copied-files'].startsWith('copy\n'));
});

test('self/descendant detection', () => {
    assert.ok(is_self_or_descendant('/a/b', '/a/b'));
    assert.ok(is_self_or_descendant('/a/b/c', '/a/b'));
    assert.ok(!is_self_or_descendant('/a/bc', '/a/b'));
    assert.ok(!is_self_or_descendant('/a', '/a/b'));
});
