const fs = require('fs/promises');
const path = require('path');
const { createHash } = require('crypto');

async function lstat(location) {
    try { return await fs.lstat(location); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function check_cancel(cancelled = () => false) {
    if (cancelled()) throw Object.assign(new Error('Operation cancelled.'), { code: 'ECANCELED' });
}

// Resolve existing parent aliases without following the final entry (which may be a link).
async function entry_path(location) {
    return path.join(await fs.realpath(path.dirname(location)), path.basename(location));
}

function contains(parent, child) {
    const relative = path.relative(parent, child);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function assert_destination(source, destination) {
    const from = await entry_path(source);
    const to = await entry_path(destination);
    const source_stat = await fs.lstat(from);
    const destination_stat = await lstat(to);
    if (from === to || (destination_stat && source_stat.dev === destination_stat.dev && source_stat.ino === destination_stat.ino)) {
        throw new Error('Source and destination refer to the same entry.');
    }
    if (source_stat.isDirectory() && contains(from, to)) throw new Error('Cannot transfer a folder into itself.');
    if (destination_stat?.isDirectory() && contains(to, from)) throw new Error('Cannot replace a folder containing the source.');
    return to;
}

// Hash bytes and link text, never traverse symlinks. Used to verify staged replacements.
async function snapshot(location, cancelled) {
    check_cancel(cancelled);
    const stat = await fs.lstat(location);
    if (stat.isSymbolicLink()) return ['link', await fs.readlink(location)];
    if (stat.isDirectory()) {
        const entries = [];
        for (const name of (await fs.readdir(location)).sort()) {
            entries.push([name, await snapshot(path.join(location, name), cancelled)]);
        }
        return ['directory', entries];
    }
    if (!stat.isFile()) throw new Error(`Unsupported filesystem entry: ${location}`);
    const hash = createHash('sha256');
    const handle = await fs.open(location, 'r');
    try {
        for await (const chunk of handle.createReadStream()) {
            check_cancel(cancelled);
            hash.update(chunk);
        }
    } finally { await handle.close(); }
    return ['file', stat.size, hash.digest('hex')];
}

async function assert_parents(location, root) {
    let parent = path.dirname(location);
    root = path.resolve(root);
    while (contains(root, parent)) {
        const stat = await fs.lstat(parent);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Folder changed into a link: ${parent}`);
        if (parent === root) break;
        parent = path.dirname(parent);
    }
}

async function remove_verified(location, expected, root = location) {
    await assert_parents(location, root);
    const stat = await fs.lstat(location);
    if (expected[0] === 'directory') {
        const names = stat.isDirectory() && !stat.isSymbolicLink() ? (await fs.readdir(location)).sort() : null;
        if (JSON.stringify(names) !== JSON.stringify(expected[1].map(([name]) => name))) {
            throw new Error(`Replacement committed, but source changed; remaining source retained at ${location}.`);
        }
        for (const [name, child] of expected[1]) await remove_verified(path.join(location, name), child, root);
        // Never recursively remove a source: concurrent new entries must survive cleanup.
        await fs.rmdir(location);
    } else {
        if (JSON.stringify(await snapshot(location)) !== JSON.stringify(expected)) {
            throw new Error(`Replacement committed, but source changed; remaining source retained at ${location}.`);
        }
        await fs.unlink(location);
    }
}

async function write_record(file, record) {
    const temporary = `${file}.tmp`;
    const handle = await fs.open(temporary, 'w', 0o600);
    try { await handle.writeFile(JSON.stringify(record)); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temporary, file);
}

async function clean(record, journal) {
    await fs.rm(record.work, { recursive: true, force: true });
    await fs.rm(record.lock, { force: true });
    await fs.rm(`${journal}.tmp`, { force: true });
    await fs.rm(journal, { force: true });
}

// Recovery never deletes sources or overwrites an entry created by another process.
async function recover_one(record, journal) {
    const backup = path.join(record.work, 'original');
    if (await lstat(backup)) {
        if (!await lstat(record.destination)) {
            await fs.rename(backup, record.destination);
        } else if (record.phase !== 'committed') {
            throw new Error(`Replacement interrupted. Original retained at ${backup}; destination also exists at ${record.destination}.`);
        }
    }
    await clean(record, journal);
}

async function recover(journal_dir) {
    await fs.mkdir(journal_dir, { recursive: true, mode: 0o700 });
    const errors = [];
    for (const name of await fs.readdir(journal_dir)) {
        if (!name.endsWith('.json')) continue;
        const journal = path.join(journal_dir, name);
        try {
            const record = JSON.parse(await fs.readFile(journal, 'utf8'));
            if (record.pid && record.pid !== process.pid) {
                try { process.kill(record.pid, 0); continue; }
                catch (error) { if (error.code !== 'ESRCH') { errors.push(`Recovery deferred for active or inaccessible process ${record.pid}.`); continue; } }
            }
            // Only recover our recorded sibling workspace and lock, never arbitrary cleanup paths.
            if (path.dirname(record.work) !== path.dirname(record.destination) ||
                !path.basename(record.work).startsWith('.efm-replace-') ||
                path.dirname(record.lock) !== path.dirname(record.destination) ||
                !path.basename(record.lock).startsWith('.efm-lock-')) throw new Error(`Invalid recovery record: ${journal}`);
            await recover_one(record, journal);
        } catch (error) { errors.push(error.message); }
    }
    return errors;
}

async function replace(destination, produce, { journal_dir, overwrite = false, cancelled = () => false } = {}) {
    if (!journal_dir) throw new Error('A recovery directory is required.');
    destination = await entry_path(destination);
    const lock = path.join(path.dirname(destination), `.efm-lock-${createHash('sha256').update(destination).digest('hex').slice(0, 24)}`);
    try {
        const lock_handle = await fs.open(lock, 'wx', 0o600);
        await lock_handle.close();
    } catch (error) {
        if (error.code === 'EEXIST') throw Object.assign(new Error(`Destination is busy or needs recovery. Lock retained at ${lock}.`), { code: 'EBUSY' });
        throw error;
    }
    let record;
    let journal;
    let committed = false;
    try {
        await fs.mkdir(journal_dir, { recursive: true, mode: 0o700 });
        const work = await fs.mkdtemp(path.join(path.dirname(destination), '.efm-replace-'));
        journal = path.join(journal_dir, `${path.basename(work)}.json`);
        record = { destination, work, lock, pid: process.pid, phase: 'preparing' };
        await write_record(journal, record);
        const staged = path.join(work, 'replacement');
        check_cancel(cancelled);
        if (!overwrite && await lstat(destination)) throw Object.assign(new Error('Destination already exists.'), { code: 'EEXIST' });
        await produce(staged);
        check_cancel(cancelled);
        const staged_stat = await fs.lstat(staged);
        // Record recovery paths before moving the original out of the way.
        record.phase = 'prepared';
        await write_record(journal, record);
        if (overwrite && await lstat(destination)) await fs.rename(destination, path.join(work, 'original'));
        check_cancel(cancelled);
        if (staged_stat.isSymbolicLink()) {
            await fs.symlink(await fs.readlink(staged), destination);
        } else if (staged_stat.isFile()) {
            // link is exclusive: a concurrent creator must not be silently overwritten.
            await fs.link(staged, destination);
        } else {
            if (await lstat(destination)) throw Object.assign(new Error('Destination changed during replacement.'), { code: 'EEXIST' });
            await fs.rename(staged, destination);
        }
        committed = true;
        record.phase = 'committed';
        await write_record(journal, record);
        await clean(record, journal);
        return destination;
    } catch (error) {
        if (record) {
            try {
                if (committed) {
                    // Preserve both copies if recording the commit failed; startup will not guess.
                    throw new Error(`Replacement committed; recovery files retained at ${record.work}.`);
                }
                await recover_one(record, journal);
            } catch (recovery_error) {
                error.message += ` ${recovery_error.message}`;
            }
        } else { await fs.rm(lock, { force: true }); }
        error.committed = committed;
        throw error;
    }
}

async function transfer(source, destination, options) {
    destination = await assert_destination(source, destination);
    const before = JSON.stringify(await snapshot(source, options.cancelled));
    await replace(destination, async staged => {
        await fs.cp(source, staged, { recursive: true, dereference: false, verbatimSymlinks: true, errorOnExist: true, force: false });
        if (JSON.stringify(await snapshot(staged, options.cancelled)) !== before ||
            JSON.stringify(await snapshot(source, options.cancelled)) !== before) throw new Error('Source changed or replacement verification failed.');
    }, options);
    if (options.move) {
        // A crash or cancellation before this point always leaves the source intact.
        await remove_verified(source, JSON.parse(before));
    }
    return destination;
}

module.exports = { assert_parents, assert_destination, check_cancel, lstat, snapshot, replace, recover, transfer };
