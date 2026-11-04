const fs = require('fs');
const path = require('path');
const dnd = require('./dnd');

function exists(location) {
    try { fs.lstatSync(location); return true; }
    catch (error) {
        if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false;
        throw error;
    }
}

// Read-only planning runs in the killable device-probe child, never the main process.
function prepare_transfer({ files, location, operation }) {
    const ready = [], overwrite = [], messages = [];
    if (operation === 'copy') {
        files.forEach(f => {

            if (f.location === '' || f.location === undefined) {
                messages.push('Error: No location to paste files.');
                return;
            }

            if (f.is_dir === null || f.is_dir === undefined) {
                messages.push('Error: No file type to paste files.');
                return;
            }

            if (f.name === '' || f.name === undefined) {
                messages.push('Error: No file name to paste files.');
                return;
            }

            if (f.href === '' || f.href === undefined) {
                messages.push('Error: No file href to paste files.');
                return;
            }

            if (f.display_name === '' || f.display_name === undefined) {
                messages.push('Error: No file display name to paste files.');
                return;
            }

            if (f.is_hidden === null || f.is_hidden === undefined) {
                messages.push('Error: No file hidden status to paste files.');
                return;
            }

            f.destination = path.join(location, f.name.replace(/\n/g, ' '));
            f.source = f.href;
            f.name = path.basename(f.destination);
            f.display_name = f.name;
            f.is_hidden = f.is_hidden;
            f.href = f.destination;

            // console.log('paste', f.location, f.destination);

            // handle duplicate file names
            if (f.location == location && exists(f.destination)) {

                let dup_idx = 1;
                while (exists(f.destination)) {
                    let ext = path.extname(f.destination);
                    let base = path.basename(f.destination, ext);
                    let dir = path.dirname(f.destination);
                    let new_base = `${base} (Copy ${dup_idx})`;
                    f.destination = path.join(dir, new_base + ext);
                    dup_idx++;
                }
                // update additional attributes so the new files have the correct data
                f.name = path.basename(f.destination);
                f.display_name = f.name;
                f.href = f.destination;

                ready.push(f);

            } else if (exists(f.destination)) {
                overwrite.push(f);
            } else {
                ready.push(f);
            }

        });
    } else {
        files.forEach(f => {

            const source = f.href;
            const source_location = f.location || path.dirname(source);
            if (f.is_dir && dnd.is_self_or_descendant(location, source)) {
                messages.push(`Cannot move ${f.name} into itself.`);
                return;
            }

            f.destination = path.join(location, f.name); // set destination
            f.source = source; // set source to current href
            f.href = f.destination; // set href to destination
            f.location = location;

            // handle duplicate file names
            if (source_location === location && exists(f.destination)) {

                let dup_idx = 1;
                while (exists(f.destination)) {
                    let ext = path.extname(f.destination);
                    let base = path.basename(f.destination, ext);
                    let dir = path.dirname(f.destination);
                    let new_base = `${base} (Copy ${dup_idx})`;
                    f.destination = path.join(dir, new_base + ext);
                    dup_idx++;
                }
                // update additional attributes so the new files have the correct data
                f.name = path.basename(f.destination);
                f.href = f.destination;

                ready.push(f);

            } else if (exists(f.destination)) {
                overwrite.push(f);
            } else {
                ready.push(f);
            }

        });
    }
    return { ready, overwrite, messages };
}
module.exports = { prepare_transfer };
