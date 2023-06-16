const { parentPort, workerData, isMainThread } = require('worker_threads');
const { execSync, exec } = require('child_process')
const path          = require('path');
const gio_utils     = require('../utils/gio');
const gio           = require('../gio/build/Release/obj.target/gio')

parentPort.on('message', data => {

    if (data.cmd === 'create_thumbnail') {
        // let thumb_dir  = path.join(app.getPath('userData'), 'thumbnails')
        let thumbnail = `${path.join(data.thumb_dir, path.basename(data.href))}`
        if (!gio.exists(thumbnail)) {
            gio.thumbnail(data.href, path.join(data.thumb_dir, path.basename(data.href)));
            // let cmd = `gdk-pixbuf-thumbnailer "${data.href}" "${path.join(data.thumb_dir, path.basename(data.href))}"`
            //     exec(cmd, (err, stdout, stderr) => {
            //     if (!err) {
            //     }
            // })
        }
    }

})