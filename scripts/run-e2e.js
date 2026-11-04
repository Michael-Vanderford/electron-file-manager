const { spawnSync } = require('node:child_process');

const env = { ...process.env };
const args = [require.resolve('@playwright/test/cli'), 'test', ...process.argv.slice(2)];
let command = process.execPath;
if (process.platform === 'linux') {
    env.EFM_TEST_DESKTOP_DISPLAY = env.DISPLAY || '';
    env.EFM_TEST_VIRTUAL_DISPLAY = '1';
    for (const key of ['WAYLAND_DISPLAY', 'WAYLAND_SOCKET', 'XDG_ACTIVATION_TOKEN', 'DESKTOP_STARTUP_ID']) delete env[key];
    env.ELECTRON_OZONE_PLATFORM_HINT = 'x11';
    command = 'xvfb-run';
    args.unshift('-a', process.execPath);
}
const result = spawnSync(command, args, { env, stdio: 'inherit' });
if (result.error) console.error(`Could not start UI tests: ${result.error.message}. Linux UI tests require xvfb-run.`);
process.exit(result.status ?? 1);
