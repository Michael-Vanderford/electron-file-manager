const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function replace(file, value) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    let fd;
    try {
        fd = fs.openSync(temporary, 'wx', 0o600);
        fs.writeFileSync(fd, JSON.stringify(value, null, 4));
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = undefined;
        fs.renameSync(temporary, file);
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
        try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
}

class JsonStore {
    constructor(file, defaults, valid) {
        this.file = file;
        this.defaults = defaults;
        this.valid = valid;
    }
    readFile(file) {
        const value = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!this.valid(value)) throw new Error(`Invalid preferences: ${path.basename(file)}`);
        return value;
    }
    read() {
        try { return this.readFile(this.file); } catch (error) {
            if (error.code && error.code !== 'ENOENT') throw error;
        }
        try { return this.readFile(`${this.file}.bak`); } catch (error) {
            if (error.code && error.code !== 'ENOENT') throw error;
        }
        // Retain malformed data for recovery instead of overwriting the only copy.
        if (fs.existsSync(this.file)) fs.renameSync(this.file, `${this.file}.${randomUUID()}.corrupt`);
        return structuredClone(this.defaults);
    }
    update(edit) {
        // All callers run synchronously in the main process: read/edit/publish cannot
        // interleave between windows. No cached whole-file snapshot is written back.
        const current = this.read();
        const next = edit(structuredClone(current));
        if (!this.valid(next)) throw new Error(`Invalid preferences: ${path.basename(this.file)}`);
        replace(`${this.file}.bak`, current);
        replace(this.file, next);
        return next;
    }
}
module.exports = { JsonStore };
