const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn, execFile } = require('child_process');
const { pipeline } = require('stream/promises');

function extraction_command(source, destination) {
    if (typeof source !== 'string' || !path.isAbsolute(source) || source.includes('\0')) throw new Error('Invalid archive path.');
    const name = path.basename(source).toLowerCase();
    if (name.endsWith('.zip')) return { executable: 'unzip', args: ['-q', source, '-d', destination], directory: true };
    if (/\.(tar|tar\.gz|tar\.xz|tar\.bz2|tgz)$/.test(name)) return { executable: 'tar', args: ['-xf', source, '-C', destination, '--no-same-owner'], directory: true };
    if (name.endsWith('.7z')) return { executable: '7z', args: ['x', source, `-o${destination}`, '-y'], directory: true };
    if (name.endsWith('.gz')) return { executable: 'gzip', args: ['-dc', '--', source], directory: false };
    if (name.endsWith('.xz')) return { executable: 'xz', args: ['-dc', '--', source], directory: false };
    if (name.endsWith('.bz2')) return { executable: 'bzip2', args: ['-dc', '--', source], directory: false };
    throw new Error('Unsupported archive format.');
}

async function extract_archive(source, location, progress = () => {}, { signal, on_child = () => {} } = {}) {
    signal?.throwIfAborted();
    const stem = path.basename(source).replace(/\.(tar\.gz|tar\.xz|tar\.bz2|zip|tar|tgz|7z|gz|xz|bz2)$/i, '');
    if (!stem) throw new Error('Archive has no output name.');
    let destination, output, command;
    for (let index = 0; ; index++) {
        destination = path.join(location, stem + (index ? ` (Copy ${index})` : ''));
        command = extraction_command(source, destination);
        try {
            if (command.directory) await fsp.mkdir(destination, { mode: 0o700 });
            else output = await fsp.open(destination, 'wx');
            break;
        } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    const timer = setInterval(() => {
        execFile('du', ['-sk', '--', destination], { timeout: 1800, maxBuffer: 65536 }, (error, stdout) => {
            if (!error) progress(Number.parseInt(stdout, 10) || 0);
        });
    }, 1000);
    try {
        if (command.directory) {
            await new Promise((resolve, reject) => { const child = execFile(process.platform === 'win32' ? 'python' : 'python3', ['-c', fs.readFileSync(path.join(__dirname, 'extract_entries.py'), 'utf8'), source, destination],
                { cwd: location, signal, maxBuffer: 1024 * 1024 }, error => error ? reject(error) : resolve()); on_child(child.pid); });
        } else {
            const child = spawn(command.executable, command.args, { cwd: location, signal, stdio: ['ignore', 'pipe', 'ignore'] });
            on_child(child.pid);
            const exited = new Promise((resolve, reject) => {
                child.once('error', reject);
                child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command.executable} exited with code ${code}`)));
            });
            try { await Promise.all([exited, pipeline(child.stdout, output.createWriteStream())]); }
            catch (error) { child.kill(); throw error; }
        }
        return destination;
    } catch (error) {
        if (command.directory) await fsp.rm(destination, { recursive: true, force: true });
        else await fsp.unlink(destination).catch(() => {});
        error.message += ` Output: ${destination}`;
        throw error;
    } finally { clearInterval(timer); await output?.close(); }
}

module.exports = { extraction_command, extract_archive };
