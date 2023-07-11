const { parentPort, workerData, isMainThread } = require('worker_threads');
const path          = require('path');
const gio_utils     = require('../utils/gio');
const gio           = require('../gio/build/Release/obj.target/gio')

// Handle Worker Messages
parentPort.on('message', data => {
    // List Files
    if (data.cmd === 'ls') {
        if (gio.exists(data.source)) {
            gio.ls(data.source, (err, dirents) => {
                if (err) {
                    // parentPort.postMessage({cmd: 'msg', msg: err});
                    return;
                }
                parentPort.postMessage({cmd: 'ls_done', dirents: dirents, source: data.source, tab: data.tab});
            })
        } else {
            parentPort.postMessage({cmd: 'msg', msg: 'Error: Getting Directory'});
        }
    }

})