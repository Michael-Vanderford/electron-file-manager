const { buildPreloads } = require('./build-preloads');
const { installOrRebuild } = require('app-builder-lib/out/util/yarn');
const { Arch } = require('builder-util');

module.exports = async ({ packager, electronPlatformName, arch }) => {
    buildPreloads();
    // npmRebuild:false preserves dependency collection; returning false from
    // beforeBuild would tell electron-builder not to package dependencies at all.
    if (electronPlatformName === 'win32') return;
    const info = packager.info;
    if (info.config.buildDependenciesFromSource && electronPlatformName !== process.platform) return;
    // Preserve electron-builder's normal Linux/macOS install/rebuild behavior.
    await installOrRebuild(info.config, {
        appDir: info.appDir, projectDir: info.projectDir, workspaceRoot: await info.getWorkspaceRoot()
    }, {
        frameworkInfo: { version: info.framework.version, useCustomDist: true },
        platform: electronPlatformName, arch: Arch[arch]
    }, false, info.runtimeEnvironmentVariables);
};
