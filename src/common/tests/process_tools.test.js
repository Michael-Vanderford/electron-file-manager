jest.mock('child_process', () => ({ execFile: jest.fn(), spawn: jest.fn() }));
const { execFile } = require('child_process');
const { command_args, launch_desktop } = require('../process_tools');
const { extraction_command } = require('../extract_archive');

test('configured command quoting preserves executable case and literal shell syntax', () => {
    expect(command_args('"/tmp/My Tool" "a b" \'$(literal)\' `literal` ;literal')).toEqual(['/tmp/My Tool', 'a b', '$(literal)', '`literal`', ';literal']);
    expect(() => command_args('"unfinished')).toThrow('Unclosed');
    expect(() => command_args('bad\0command')).toThrow('Invalid');
});

test.each(['zip', 'tar', 'tar.gz', 'tar.xz', 'tar.bz2', 'tgz', '7z', 'gz', 'xz', 'bz2'])('extracts %s using argument arrays and literal absolute paths', extension => {
    const source = `/tmp/quotes' \"$()\` -name.${extension}`;
    const destination = '/tmp/output\' \"$()\`';
    const command = extraction_command(source, destination);
    expect(command.args).toContain(source);
    expect(command).not.toHaveProperty('shell');
    expect(command.args.join(' ')).not.toContain('cd ');
});

test('extractor selection uses basename suffix, not a misleading parent directory', () => {
    expect(extraction_command('/tmp/path.zip/file.tar', '/tmp/out').executable).toBe('tar');
    expect(() => extraction_command('/tmp/path.zip/file.txt', '/tmp/out')).toThrow('Unsupported');
});

test('desktop launches use registered application IDs and preserve literal file arguments', () => {
    execFile.mockImplementation((_command, _args, callback) => callback(null, ''));
    const href = '/tmp/Mixed Case \' $() `literal`.txt';
    const callback = jest.fn();
    launch_desktop({ appid: 'org.Example.Editor.desktop', mimetype: 'text/plain', cmd: 'CaseSensitive --field %U' }, href, callback);
    expect(execFile).toHaveBeenNthCalledWith(1, 'xdg-mime', ['default', 'org.Example.Editor.desktop', 'text/plain'], expect.any(Function));
    expect(execFile).toHaveBeenNthCalledWith(2, 'gtk-launch', ['--', 'org.Example.Editor.desktop', href], callback);
});
