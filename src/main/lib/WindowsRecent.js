const { spawn } = require('child_process');
const path = require('path');

class WindowsRecent {
    constructor(app) {
        this.app = app;
        app.on('before-quit', () => { this.closed = true; this.child?.kill(); });
    }

    get() {
        if (this.closed) return Promise.reject(new Error('Application is closing.'));
        if (this.pending) return this.pending;
        this.pending = new Promise((resolve, reject) => {
            const env = { ...process.env };
            delete env.ELECTRON_RUN_AS_NODE;
            const entry = process.defaultApp
                ? [path.join(__dirname, '../../workers/recent_worker.js')]
                : ['--recent-worker'];
            const flags = process.argv.includes('--no-sandbox') ? ['--no-sandbox'] : [];
            const child = this.child = spawn(process.execPath, [...entry, ...flags, '--disable-gpu'], {
                env, stdio: ['ignore', 'ignore', 'ignore', 'ipc']
            });
            let result;
            let failure;
            const timer = setTimeout(() => {
                failure = new Error('Windows Recent Items lookup timed out.');
                reject(failure);
                child.kill('SIGKILL');
            }, 10000);
            child.on('message', message => { result = message; });
            child.on('error', error => { failure = error; reject(error); });
            // Keep the slot occupied until close, including after a timeout.
            child.on('close', () => {
                clearTimeout(timer);
                this.pending = null;
                this.child = null;
                if (failure || result?.error) reject(failure || new Error(result.error));
                else if (Array.isArray(result?.files)) resolve(result.files);
                else reject(new Error('Windows Recent Items reader exited without a result.'));
            });
            try { child.send({ directory: this.app.getPath('recent') }); }
            catch (error) { failure = error; child.kill('SIGKILL'); }
        });
        return this.pending;
    }
}

module.exports = { WindowsRecent };
