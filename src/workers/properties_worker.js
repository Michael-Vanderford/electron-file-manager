const {parentPort, workerData, isMainThread} = require('worker_threads');
const path = require('path');
const gio = require('../gio/build/Release/gio.node');


parentPort.on('message', (data) => {

    switch (data.cmd) {

        case 'get_properties':

            let properties_arr = [];
            if (data.selected_files_arr.length > 0) {
                data.selected_files_arr.forEach(file => {
                    let properties = gio.get_file(file.href);
                    if (properties && properties.is_dir) {
                        try {
                            const counts = gio.count(file.href);
                            properties.folder_count = counts.folders;
                            properties.file_count = counts.files;
                            properties.count = counts.total;
                        } catch (e) {
                            // leave counts undefined if not readable
                        }
                    }
                    properties_arr.push(properties);
                })
            } else {
                // let properties = gio.get_file(location);
                // properties_arr.push(properties);
            }
            let cmd = {
                cmd: 'properties',
                properties_arr: properties_arr
            }
            parentPort.postMessage(cmd);
            break;
    }

})

