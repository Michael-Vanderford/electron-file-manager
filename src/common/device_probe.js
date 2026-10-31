const { fork } = require('child_process');
const path = require('path');

const pending = new Map();
const retry_after = new Map();
let active = 0;

// Keep timed-out children counted until exit: an OS-stuck process may ignore SIGKILL.
function probe(operation, location, timeout = 3000) {
    for (const [entry, deadline] of retry_after) {
        if (deadline <= Date.now()) retry_after.delete(entry);
    }
    const key = JSON.stringify([operation, location]);
    if (pending.has(key)) return pending.get(key);
    const limit = ['validate', 'writable', 'file'].includes(operation) ? 8 : 4;
    if (active >= limit || (retry_after.get(key) || 0) > Date.now()) {
        return Promise.reject(new Error('Device unavailable; retry shortly.'));
    }
    const request = new Promise((resolve, reject) => {
        let child;
        try {
            child = fork(path.join(__dirname, '../workers/device_probe.js'), [], {
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
                stdio: ['ignore', 'ignore', 'pipe', 'ipc']
            });
        } catch (error) {
            reject(error);
            return;
        }
        let diagnostic = '';
        child.stderr?.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-1000); });
        active++;
        let settled = false;
        const finish = (error, result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) {
                retry_after.set(key, Date.now() + 30000);
                reject(error);
            } else {
                retry_after.delete(key);
                resolve(result);
            }
            child.kill('SIGKILL');
        };
        const timer = setTimeout(() => finish(new Error('Device query timed out after 3 seconds.')), timeout);
        child.once('message', message => finish(message.error ? new Error(message.error) : null, message.result));
        child.once('error', error => finish(error));
        child.once('exit', () => { active--; });
        // IPC may still contain a reply when exit fires; close follows channel drain.
        child.once('close', (code, signal) => {
            finish(new Error(`Device query exited before responding (${signal || code}). ${diagnostic}`));
        });
        child.send({ operation, location }, error => { if (error) finish(error); });
    });
    pending.set(key, request);
    request.finally(() => pending.delete(key)).catch(() => {});
    return request;
}

module.exports = { probe };
