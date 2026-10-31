const { parentPort, workerData, isMainThread } = require('worker_threads');
const { create_archive } = require('../common/create_archive');
const { extract_archive } = require('../common/extract_archive');
let compression_abort;

if (!isMainThread) {

    parentPort.on('message', (data) => {
        const cmd = data.cmd;

        switch (cmd) {

            case 'compress': {
                compression_abort = new AbortController();
                create_archive(data, {
                    journal_dir: workerData.journal_dir,
                    signal: compression_abort.signal,
                    progress: value => parentPort.postMessage({ cmd: 'set_progress', operation: 'compress', can_cancel: true,
                        max: Math.max(1, data.size || 0), value, status: 'Compressing files' })
                }).then(file_path => {
                    parentPort.postMessage({ cmd: 'compress_done', id: data.id, file_path });
                }).catch(error => {
                    parentPort.postMessage({ cmd: 'compress_error', code: error.code, msg: error.message });
                });
                break;
            }
            case 'cancel':
                compression_abort?.abort();
                break;

            case 'extract': {
                compression_abort = new AbortController();
                extract_archive(data.source, data.location, value => parentPort.postMessage({
                    id: data.id, cmd: 'set_progress', operation: 'extract', value, max: Math.max(1, value), status: 'Extracting files', can_cancel: true
                }), { signal: compression_abort.signal, on_child: pid => parentPort.postMessage({ cmd: 'extract_child', pid }) }).then(destination => parentPort.postMessage({ cmd: 'extract_done', id: data.id, source: data.source, destination }))
                    .catch(error => parentPort.postMessage({ cmd: 'extract_error', id: data.id, msg: error.message }));
                break;
            }
            default:
                break;
        }
    });

}
