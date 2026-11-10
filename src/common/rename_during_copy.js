const fs = require('fs/promises');
const path = require('path');

// Resolve parent aliases even when a destination does not exist yet.
async function canonical(location) {
    location = path.resolve(location);
    try { return await fs.realpath(location); }
    catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return path.join(await canonical(path.dirname(location)), path.basename(location));
    }
}
function overlaps(one, two) {
    const contains = (parent, child) => {
        const relative = path.relative(parent, child);
        return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
    };
    return contains(one, two) || contains(two, one);
}
async function can_rename(queue, source, destination) {
    const active = queue.active;
    const pending = [...queue.pending];
    if (active?.operation !== 'copy' || !active.paths?.length || queue.parallel) return false;
    const jobs = [active, ...pending];
    if (jobs.some(job => !job.paths?.length)) return false;
    try {
        const rename = await Promise.all([source, destination].map(canonical));
        const protected_paths = await Promise.all(jobs.flatMap(job => job.paths).map(canonical));
        return queue.active === active && queue.pending.length === pending.length &&
            queue.pending.every((job, index) => job === pending[index]) && !queue.parallel &&
            !rename.some(location => protected_paths.some(protected_path => overlaps(location, protected_path)));
    } catch (_) { return false; } // Uncertain identities retain normal serialization.
}
module.exports = { can_rename };
