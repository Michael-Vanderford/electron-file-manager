const { parentPort, workerData, isMainThread } = require('worker_threads');
const { execSync, exec } = require('child_process')
const path          = require('path');
const gio_utils     = require('../utils/gio');
const gio           = require('../gio/build/Release/obj.target/gio')


function get_images(source, start, offset, callback) {
    gio.ls(source, (err, dirents) => {
        if (!err) {
            let exclude = ['image/x-xcf', 'image/svg+xml', 'image/gif', 'image/webp', 'image/vnd.dxf']
            let filter = dirents.filter(x => x.content_type.startsWith('image/') && !exclude.includes(x.content_type));
            filter.sort((a,b) => {
                return b.mtime - a.mtime
            })
            // console.log(filter)
            let chunk = []
            for (let i = start; i < offset; i++) {
                if (i < filter.length) {
                    chunk.push(filter[i])
                } else {
                    // parentPort.postMessage({cmd: 'thumbnail_done'})
                    return
                }
            }
            // parentPort.postMessage({cmd: 'thumbnail_chunk_done'})
            return callback(chunk)
        }
    })
}

parentPort.on('message', data => {

    if (data.cmd === 'create_thumbnail') {

        // Get array of images to process
        let start = 0;
        let offset = 1;
        let destination = data.destination;
        function get_next_images(source, start, offset) {
            get_images(source, start, offset, images => {

                // console.log(images);
                images.forEach(image => {
                    let thumbnail = `${path.join(destination, path.basename(image.href))}`
                    if (!gio.exists(thumbnail)) {
                        // parentPort.postMessage({cmd: 'msg', msg: 'Creating Thumbnails...', has_timeout: 0});
                        gio.thumbnail(image.href, thumbnail);
                        parentPort.postMessage({cmd: 'thumbnail_chunk_done', href: image.href})
                    }
                });

                start = start + 1;
                offset = offset + 1;
                get_next_images(source, start, offset);
            })
        }

        get_next_images(data.source, start, offset)

        // if (!gio.exists(thumbnail)) {
        //     console.log('creating thumbnail', thumbnail);
        //     gio.thumbnail(data.href, thumbnail);
        // }
    }

    // if (data.cmd === 'create_thumbnail') {
    //     // gio.thumbnail((data.href));
    //     let thumbnail = `${path.join(data.thumb_dir, path.basename(data.href))}`
    //     if (!gio.exists(thumbnail)) {
    //         console.log('creating thumbnail', thumbnail);
    //         gio.thumbnail(data.href, thumbnail);
    //     }
    // }

})