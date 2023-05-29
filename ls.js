const { parentPort, workerData, isMainThread } = require('worker_threads');
const path          = require('path');
const gio_utils     = require('./utils/gio');
const gio           = require('./gio/build/Release/obj.target/gio')


// Handle Worker Messages
parentPort.on('message', data => {

    // List Files
    if (data.cmd === 'ls') {
        // console.log('source', data.source)
        try {
            let dirents = gio.ls(data.source);
            parentPort.postMessage({cmd: 'ls_done', dirents: dirents, source: data.source});
        } catch (err) {
            console.log(err)
        }

    }

})