const { parentPort, workerData, isMainThread } = require('worker_threads');
const { execSync, exec } = require('child_process')
const path = require('path');
const gio_utils = require('../utils/gio');
// const gio = require('node-gio');
const gio = require('../gio/build/Release/obj.target/gio')
// const gio = require('/home/michael/source/repos/node-gio/build/Release/obj.target/gio');


let sort = 'date_desc'
function get_images(source, start, offset, callback) {
    try {
        gio.ls(source, (err, dirents) => {
            if (!err) {
                let exclude = ['image/x-xcf', 'image/svg+xml', 'image/gif', 'image/webp', 'image/vnd.dxf']
                let filter = dirents.filter(x => x.content_type.startsWith('image/') && !exclude.includes(x.content_type));

                switch (sort) {
                    case 'name_asc': {
                        filter.sort((a, b) => {
                            if (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase()) {
                                return -1;
                            }
                            if (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase()) {
                                return 1;
                            }
                            return 0;
                        })
                        break;
                    }
                    case 'name_desc': {
                        filter.sort((a, b) => {
                            if (b.name.toLocaleLowerCase() < a.name.toLocaleLowerCase()) {
                                return -1;
                            }
                            if (b.name.toLocaleLowerCase() > a.name.toLocaleLowerCase()) {
                                return 1;
                            }
                            return 0;
                        })
                        break;
                    }
                    case 'date_desc': {
                        filter.sort((a, b) => {
                            return b.mtime - a.mtime
                        })
                        break;
                    }
                    case 'date_asc': {
                        filter.sort((a, b) => {
                            return a.mtime - b.mtime
                        })

                        break;
                    }
                    case 'size': {
                        filter.sort((a, b) => {
                            return b.size - a.size
                        })
                        break;
                    }
                }
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
    } catch (err) {
        // console.log('ls worker', err.message)
    }
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

                    let thumbnail = `${path.join(destination, `${image.mtime}_${path.basename(image.href)}`)}`
                    if (!gio.exists(thumbnail)) {
                        sort = data.sort;
                        try {
                            gio.thumbnail(image.href, thumbnail);
                        } catch (err) {
                        }
                        parentPort.postMessage({cmd: 'thumbnail_chunk_done', href: image.href, thumbnail: thumbnail})
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