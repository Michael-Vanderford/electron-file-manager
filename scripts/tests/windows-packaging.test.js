const { spawnSync } = require('child_process');
const path = require('path');

test('builder collects Windows production dependencies and packaged archiver creates a ZIP without GIO', () => {
    const result = spawnSync(process.execPath, ['-e', String.raw`
        const fs = require('fs/promises');
        const path = require('path');
        const os = require('os');
        const assert = require('assert/strict');
        const { createRequire } = require('module');
        const { TmpDir } = require('temp-file');
        const { Platform } = require('app-builder-lib');
        const { PM } = require('app-builder-lib/out/node-module-collector');
        const { getNodeModuleFileMatcher } = require('app-builder-lib/out/fileMatcher');
        const { computeNodeModuleFileSets } = require('app-builder-lib/out/util/appFileCopier');
        const configuration = require('./package.json').build;
        (async () => {
            const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'efm-package-'));
            const tempDirManager = new TmpDir();
            try {
                const appDir = path.join(fixture, 'source'); const destination = path.join(fixture, 'app');
                await fs.mkdir(appDir); await fs.mkdir(destination);
                await fs.writeFile(path.join(appDir, 'package.json'), JSON.stringify({ name: 'isolated-package-check', version: '1.0.0',
                    dependencies: { archiver: require('./package.json').dependencies.archiver }, optionalDependencies: { 'libgio-node': '^1.0.11' } }));
                // Read installed modules through a link; writes only target the temporary app tree.
                await fs.symlink(path.resolve('node_modules'), path.join(appDir, 'node_modules'), 'junction');
                const info = { originalMetadata: JSON.parse(await fs.readFile(path.join(appDir, 'package.json'), 'utf8')), appDir, projectDir: appDir, config: configuration, appInfo: { type: 'commonjs' },
                    tempDirManager, getWorkspaceRoot: async () => appDir, getPackageManager: async () => PM.TRAVERSAL,
                    nodePackageName: 'isolated-package-check', debugLogger: { isEnabled: false } };
                const matcher = getNodeModuleFileMatcher(appDir, destination, value => value, configuration.win, info);
                const sets = await computeNodeModuleFileSets({ info, config: configuration, platform: Platform.WINDOWS }, matcher);
                assert(sets.some(set => set.destination === path.join(destination, 'node_modules', 'archiver') && set.files.length));
                assert(!sets.some(set => set.destination.includes('libgio-node') && set.files.length));
                for (const set of sets) for (const source of set.files) {
                    const target = path.join(set.destination, path.relative(set.src, source));
                    await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(source, target);
                }
                const packagedRequire = createRequire(path.join(destination, 'main.js'));
                const resolved = packagedRequire.resolve('archiver');
                assert(resolved.startsWith(destination + path.sep), resolved);
                const { ZipArchive } = await import(require('url').pathToFileURL(resolved).href);
                const archive = new ZipArchive();
                const output = require('fs').createWriteStream(path.join(fixture, 'test.zip'));
                const finished = new Promise((resolve, reject) => { output.on('close', resolve); output.on('error', reject); archive.on('error', reject); });
                archive.pipe(output); archive.append('packaged runtime', { name: 'test.txt' });
                await archive.finalize(); await finished;
                assert.equal((await fs.readFile(path.join(fixture, 'test.zip'))).subarray(0, 2).toString(), 'PK');
                console.log('Packaged archiver resolves and creates ZIP; GIO excluded.');
            } finally { await fs.rm(fixture, { recursive: true, force: true }); await tempDirManager.cleanup(); }
        })().catch(error => { console.error(error); process.exitCode = 1; });
    `], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
    expect(result.error).toBeUndefined();
    expect({ status: result.status, error: result.stderr }).toEqual({ status: 0, error: '' });
    expect(result.stdout).toContain('Packaged archiver resolves and creates ZIP; GIO excluded.');
}, 35000);
