const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { pipeline } = require('stream/promises');
const safe = require('./safe_replace');

function archive_destination(files, location, type) {
    if (!Array.isArray(files) || !files.length || !files.every(file => typeof file?.href === 'string' && path.isAbsolute(file.href)) ||
        typeof location !== 'string' || !path.isAbsolute(location) || !['zip', 'tar.gz', 'tar.xz'].includes(type)) throw new Error('Invalid archive request.');
    const name = path.basename(files[0].href);
    return path.join(location, `${path.basename(name, path.extname(name))}.${type}`);
}

async function create_archive(job, { journal_dir, signal, progress = () => {} }) {
    const { files_arr, location, type } = job;
    const suggested = archive_destination(files_arr, location, type);
    const destination = job.destination || suggested;
    for (const file of files_arr) await safe.assert_destination(file.href, destination);
    const cancelled = () => signal?.aborted;
    await safe.replace(destination, async staged => {
        const archive = type === 'zip'
            ? archiver('zip', { zlib: { level: 9 } })
            : archiver('tar', { gzip: type === 'tar.gz', xz: type === 'tar.xz', zlib: { level: 9 } });
        // Warnings mean inputs were omitted: never publish a partial replacement as success.
        archive.on('warning', error => archive.destroy(error));
        archive.on('progress', data => progress(data.fs.processedBytes));
        const writing = pipeline(archive, fs.createWriteStream(staged, { flags: 'wx' }), { signal });
        try {
            for (const file of files_arr) {
                safe.check_cancel(cancelled);
                if (file.is_dir && !file.is_symlink) archive.directory(file.href, path.relative(location, file.href));
                else archive.file(file.href, { name: path.relative(location, file.href) });
            }
            await Promise.all([writing, archive.finalize()]);
        } catch (error) {
            archive.destroy(error);
            await writing.catch(() => {});
            throw error;
        }
    }, { journal_dir, overwrite: !!job.overwrite, cancelled });
    return destination;
}

module.exports = { archive_destination, create_archive };
