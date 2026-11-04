const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../run-e2e.js'), 'utf8');

function run(platform, result = { status: 0 }) {
    const spawnSync = jest.fn(() => result);
    const env = { DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0', WAYLAND_SOCKET: '9',
        XDG_ACTIVATION_TOKEN: 'token', DESKTOP_STARTUP_ID: 'startup', KEEP: 'value' };
    const process = { platform, env, execPath: '/node', argv: ['/node', 'run-e2e.js', '-g', 'isolation'], exit: jest.fn() };
    const require = Object.assign(() => ({ spawnSync }), { resolve: () => '/playwright/cli.js' });
    const console = { error: jest.fn() };
    vm.runInNewContext(source, { require, process, console });
    return { spawnSync, process, console };
}

test('Linux uses Xvfb, strips desktop activation and Wayland, and forwards test filters', () => {
    const { spawnSync, process } = run('linux');
    const [command, args, options] = spawnSync.mock.calls[0];
    expect(command).toBe('xvfb-run');
    expect(Array.from(args)).toEqual(['-a', '/node', '/playwright/cli.js', 'test', '-g', 'isolation']);
    expect(options.env).toEqual({ DISPLAY: ':0', EFM_TEST_DESKTOP_DISPLAY: ':0', EFM_TEST_VIRTUAL_DISPLAY: '1',
        ELECTRON_OZONE_PLATFORM_HINT: 'x11', KEEP: 'value' });
    expect(process.env.WAYLAND_DISPLAY).toBe('wayland-0');
    expect(process.exit).toHaveBeenCalledWith(0);
});

test.each(['win32', 'darwin'])('%s runs Playwright directly', platform => {
    const { spawnSync } = run(platform);
    expect(spawnSync).toHaveBeenCalledWith('/node', ['/playwright/cli.js', 'test', '-g', 'isolation'],
        { env: expect.objectContaining({ WAYLAND_DISPLAY: 'wayland-0' }), stdio: 'inherit' });
});

test('a missing Xvfb fails without falling back to the desktop', () => {
    const { spawnSync, process, console } = run('linux', { status: null, error: new Error('ENOENT') });
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('xvfb-run'));
});

test('forwards a failing test exit status', () => {
    expect(run('linux', { status: 2 }).process.exit).toHaveBeenCalledWith(2);
});
