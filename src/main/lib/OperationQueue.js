// Serialize filesystem jobs while retaining the initiating renderer and immutable input.
class OperationQueue {
    constructor() { this.pending = []; this.active = null; }
    enqueue(job) {
        this.pending.push(job);
        this.next();
    }
    next() {
        if (this.active || this.parallel) return;
        const job = this.pending.shift();
        if (!job) return;
        if (job.sender.isDestroyed()) { this.next(); return; }
        this.active = job;
        let done = false;
        job.finish = () => {
            if (done) return;
            done = true;
            this.active = null;
            this.next();
        };
        const failed = error => {
            if (!job.sender.isDestroyed()) {
                job.sender.send('set_progress', { operation: job.operation, max: 0, value: 0, can_cancel: false });
                job.sender.send('set_msg', `${job.operation} could not start: ${error.message}`);
            }
            job.finish();
        };
        try { Promise.resolve(job.start(job)).catch(failed); }
        catch (error) { failed(error); }
    }
    // One unrelated rename may run beside the active copy. Hold the next job
    // until both finish so newly queued work cannot race the rename.
    run_parallel(job) {
        this.parallel = job;
        job.finish = () => {
            if (this.parallel !== job) return;
            this.parallel = null;
            this.next();
        };
        if (job.sender.isDestroyed()) { job.finish(); return; }
        try { Promise.resolve(job.start(job)).catch(() => job.finish()); }
        catch (_) { job.finish(); }
    }
    cancel(sender, operation) {
        this.pending = this.pending.filter(job => job.sender !== sender || job.operation !== operation);
        if (this.active?.sender === sender && this.active.operation === operation) this.active.cancel?.();
    }
}
module.exports = { OperationQueue };
