const { spawn } = require('child_process');
const path = require('path');

class ThumbnailManager {
    constructor(cache) {
        this.cache = cache;
        this.pending = new Map();
        this.queue = [];
        this.child = null;
        this.current = null;
    }

    get(href) {
        if (this.blocked) return Promise.resolve(null);
        if (this.pending.has(href)) return this.pending.get(href);
        if (typeof href !== 'string' || !path.isAbsolute(href) || this.queue.length >= 64) return Promise.resolve(null);
        const request = new Promise(resolve => this.queue.push({ href, resolve }));
        this.pending.set(href, request);
        request.finally(() => this.pending.delete(href));
        this.pump();
        return request;
    }

    pump() {
        if (this.current || !this.queue.length) return;
        if (!this.child) {
            const env = { ...process.env };
            delete env.ELECTRON_RUN_AS_NODE;
            const entry = process.defaultApp
                ? [path.join(__dirname, '../../workers/thumbnail_worker.js')]
                : ['--thumbnail-worker'];
            this.child = spawn(process.execPath, [...entry, '--no-sandbox', '--disable-gpu'], {
                env, stdio: ['ignore', 'ignore', 'ignore', 'ipc']
            });
            const child = this.child;
            child.on('message', result => {
                if (this.blocked || !this.current || result.href !== this.current.href) return;
                clearTimeout(this.timer);
                this.current.resolve(result.url || null);
                this.current = null;
                this.pump();
            });
            const fail = () => {
                clearTimeout(this.timer);
                this.current?.resolve(null);
                this.current = null;
                this.queue.splice(0).forEach(task => task.resolve(null));
            };
            child.on('error', fail);
            child.on('exit', () => {
                fail();
                if (this.child === child) this.child = null;
                this.blocked = false;
            });
        }
        this.current = this.queue.shift();
        this.timer = setTimeout(() => {
            this.blocked = true;
            this.current?.resolve(null);
            // Keep the slot occupied until exit if the OS cannot kill the process.
            this.queue.splice(0).forEach(task => task.resolve(null));
            this.child.kill('SIGKILL');
        }, 5000);
        this.child.send({ href: this.current.href, cache: this.cache });
    }

    close() {
        clearTimeout(this.timer);
        this.child?.kill('SIGKILL');
    }
}

module.exports = { ThumbnailManager };
