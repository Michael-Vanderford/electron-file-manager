jest.mock('../build-preloads', () => ({ buildPreloads: jest.fn() }));
jest.mock('app-builder-lib/out/util/yarn', () => ({ installOrRebuild: jest.fn() }));
const { buildPreloads } = require('../build-preloads');
const { installOrRebuild } = require('app-builder-lib/out/util/yarn');
const beforePack = require('../before-pack');
const configuration = require('../../package.json').build;
const { spawnSync } = require('child_process');
const path = require('path');
const { Arch } = require('builder-util');

beforeEach(() => jest.clearAllMocks());
function context(platform) {
    return { electronPlatformName: platform, arch: Arch.x64, packager: { info: {
        config: configuration, appDir: '/app', projectDir: '/project',
        framework: { version: '44.4.5' }, getWorkspaceRoot: async () => '/workspace',
        runtimeEnvironmentVariables: { TEST_BUILD: '1' }
    } } };
}

test('Windows skips native rebuilds without disabling electron-builder dependency collection', async () => {
    expect(configuration.beforeBuild).toBeUndefined();
    expect(configuration.beforePack).toBe('scripts/before-pack.js');
    const result = spawnSync(process.execPath, ['-e', `
        const assert = require('assert/strict');
        const { Packager } = require('app-builder-lib/out/packager');
        const config = require('./package.json').build;
        const info = { options: {}, framework: { isNpmRebuildRequired: true }, config,
            _nodeModulesHandledExternally: false };
        Packager.prototype.installAppDependencies.call(info, { nodeName: 'win32' }, 1)
            .then(() => { assert.equal(info._nodeModulesHandledExternally, false); console.log('dependency collection enabled'); })
            .catch(error => { console.error(error); process.exitCode = 1; });
    `], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain('dependency collection enabled');
    expect({ status: result.status, error: result.stderr }).toEqual({ status: 0, error: '' });
    await beforePack(context('win32'));
    expect(buildPreloads).toHaveBeenCalledTimes(1);
    expect(installOrRebuild).not.toHaveBeenCalled();
});

test.each(['linux', 'darwin'])('%s retains the builder install/rebuild helper and target architecture', async platform => {
    await beforePack(context(platform));
    expect(buildPreloads).toHaveBeenCalledTimes(1);
    expect(installOrRebuild).toHaveBeenCalledWith(configuration,
        { appDir: '/app', projectDir: '/project', workspaceRoot: '/workspace' },
        { frameworkInfo: { version: '44.4.5', useCustomDist: true }, platform, arch: 'x64' },
        false, { TEST_BUILD: '1' });
});
