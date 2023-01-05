// const { exec, execSync, spawn, execFileSync }   = require("child_process");
const util  = require('util')
const path  = require('path')
const exec  = util.promisify(require('child_process').exec)

let file_arr = []

function get_dir_recursive(dir, state) {

    exec(`gio list -h -l -a "*" "${dir}"`, {maxBuffer: 1024 * 1024 * 1024}, (err, stdout, stderr) => {

        if (!err) {

            let file_info = stdout.split('\n')
            file_info.forEach((item, idx) => {

                if (idx < file_info.length -1) {

                    let file_obj = {}
                    let files = item.split('\t')

                    file_obj.size = files[1] // this is being set on get_card1
                    file_obj.name = files[0]

                    if (isGioFile(dir)) {
                        file_obj.href = dir + files[0]  + '/'
                    } else {
                        file_obj.href = dir + '/' + files[0]
                    }

                    // Check for hidden. todo: find out why its not an attribute of gio
                    if (files[0].substring(0,1) == '.') {
                        file_obj.is_hidden = 1
                    } else {
                        file_obj.is_hidden = 0
                    }

                    if (files[2] == '(directory)') {
                        file_obj.is_dir = 1
                    } else {
                        file_obj.is_dir = 0
                        file_obj.ext = path.extname(files[0])
                    }

                    if (files[3]) {

                        // Add attributes
                        attributes = files[3].split(' ').map(pair => pair.split('='))
                        attributes.forEach(attribute => {
                            // Handle dates
                            if (attribute[0] == 'time::modified') {
                                file_obj['mtime'] = attribute[1]
                            } else if (attribute[0] == 'time::access') {
                                file_obj['atime'] = attribute[1]
                            } else if (attribute[0] == 'time::created') {
                                file_obj['ctime'] = attribute[1]
                            } else {
                                file_obj[attribute[0]] = attribute[1]
                            }
                        })

                    }

                    dirents.push(file_obj)

                }

            })

            file_arr = dirents;
            return callback(dirents)

        } else {
            console.log(err)
        }

    })

}

/**
 * Tests href for smb:, sftp: or mtp:
 * todo: need to add additioal prefixs
 * @param {string} href
 * @returns 1 or 0
 */
function is_gio_file(href) {
    if (href) {
        if (href.indexOf('smb:') > -1 || href.indexOf('sftp:') > -1 || href.indexOf('mtp:') > -1) {
            return true
        } else {
            return false
        }
    }
}

/**
 * Get File Information from GIO (gvfs)
 * @param {*} href
 * @param {*} callback
 */
exports.get_file = function(href, callback) {

    exec(`gio info "${href}"`, (err, stdout, stderr) => {

        if (!err) {

            let files = stdout.split('\n').map(p => p.trim().split(': '))
            file_obj = {}

            file_obj.href = href
            file_obj.name = path.basename(href)

            files.forEach(item => {
                file_obj[item[0]] = item[1]
                if (file_obj["time::changed"]) {
                    file_obj.mtime = file_obj["time::changed"]
                }
            })

            // file_arr = dirents;
            return callback(file_obj)

        } else {
            return callback(err)
        }

    })
}

exports.get_dir = function(dir, callback) {

    let isGio   = 1;
    let gio_dir = ['smb:', 'sftp:', 'mtp:']
    let dirents = []
    file_arr    = []

    for (let i = 0; i < gio_dir.length; i++) {
        if (dir.indexOf(gio_dir[i]) > -1) {
            isGio = 1;
            break;
        }
    }

    if (isGio) {

        exec(`gio list -h -l -a "*" "${dir}"`, {maxBuffer: 1024 * 1024 * 1024}, (err, stdout, stderr) => {

            if (!err) {

                let file_info = stdout.split('\n')
                file_info.forEach((item, idx) => {

                    if (idx < file_info.length -1) {

                        let file_obj = {}
                        let files = item.split('\t')

                        file_obj.size = files[1] // this is being set on get_card1
                        file_obj.name = files[0]

                        if (is_gio_file(dir)) {
                            file_obj.href = dir + files[0]  + '/'
                        } else {
                            file_obj.href = dir + '/' + files[0]
                        }

                        // // Check for hidden. todo: find out why its not an attribute of gio
                        // if (files[0].substring(0,1) == '.') {
                        //     file_obj.is_hidden = 1
                        // } else {
                        //     file_obj.is_hidden = 0
                        // }

                        if (files[2] == '(directory)') {
                            file_obj.is_dir = 1
                        } else {
                            file_obj.is_dir = 0
                            file_obj.ext = path.extname(files[0])
                        }

                        if (files[3]) {

                            // Add attributes
                            attributes = files[3].split(' ').map(pair => pair.split('='))
                            attributes.forEach(attribute => {

                                // Handle dates
                                // if (attribute[0] == 'time::modified') {
                                //     file_obj['mtime'] = attribute[1]
                                // } else if (attribute[0] == 'time::access') {
                                //     file_obj['atime'] = attribute[1]
                                // } else if (attribute[0] == 'time::created') {
                                //     file_obj['ctime'] = attribute[1]
                                // } else {
                                    file_obj[attribute[0]] = attribute[1]
                                // }
                            })

                        }

                        dirents.push(file_obj)

                    }

                })

                file_arr = dirents;
                // console.log(file_arr)
                return callback(dirents)

            } else {
                console.log(err)
            }

        })

    } else {

        fs.readdir(dir, (err, files) => {

            files.forEach(file => {

                href = path.join(dir, file);
                let file_obj = {};

                fs.stats(href, (err, stats) => {

                    file_obj.href = href;
                    file_obj.mtime = stats.mtime;
                    file_obj.ctime = stats.ctime;
                    file_obj.atime = stats.atime;

                    if (stats.isDirectory()) {
                        file_obj.is_dir = 1;
                    } else {
                        file_obj.is_dir = 0;
                        file_obj.size = get_file_size(stats.size);
                        file_obj.ext = path.extname(file);
                    }

                    dirents.push(file_obj);

                })

            })

            return callback(dirents);

        })

    }

}


/**
 * Copy File using GIO (gvfs)
 * @param {string} source
 * @param {string} destination
 * @param {callback} callback
 *
 */
exports.cp = function(source, destination, callback) {

    exec(`gio copy "${source}" "${destination}"`).then(res => {
        return callback(res);
    }).catch(err => {
        return callback(err);
    })

};

/**
 * Make a Directory with GIO (gvfs)
 * @param {string} destination
 * @param {string} callback
 */
exports.mkdir = function(destination, callback) {
    exec(`gio mkdir "${destination}"`).then(res => {
        return callback(res)
    }).catch(err => {
        return callback(err)
    })
}

/**
 * Remote a File or Directory using GIO (gvfs)
 * @param {*} href
 * @param {*} callback
 */
exports.rm = function (href, callback) {
    exec(`gio remove "${href}"`).then(res => {
        return callback(res)
    }).catch(err => {
        return callback(err)
    })
}

exports.get_mounts = function () {

    let devices = []
    exec(`gio mount -l | grep "Mount("`, (err, stdout, stderr) => {
        let output = stdout.split('\n')
        output.forEach(item => {

            let gio_mounts = item.split(': ')
            let device = {}
            gio_mounts.forEach((gio_mount, idx) => {

                if (idx % 2) {
                    let mounts = gio_mount.trim().split(' -> ')

                    mounts.forEach((item, idx) => {

                        if (!idx % 2) {
                            device.name = item
                        } else {
                            device.href = item
                        }

                    })

                }

            })

            devices.push(device)

        })
    })

    return devices;

}

exports.unmount = function () {

}

/**
 * Convert Gio date time (Unix time stamp) to a formatted date and time
 * @param {string} date
 * @returns A formated date and time
 */
exports.getDateTime = function (date) {
    try {
        var d = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date * 1000));
        return d;
    } catch (err) {
        // console.log('gio getDateTime Format error')
    }
}

// const {Gio, GLib} = imports.gi;

// let uri = ARGV[0]
// let file_arr = []

// const directory = Gio.File.new_for_uri(uri);

// // Synchronous, blocking method
// const iter = directory.enumerate_children('standard::*',
//     Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);

// while (true) {

//     const info = iter.next_file(null);

//     if (info == null) {
//         break;
//     }

//     let file_info = {
//         name: info.get_name(),
//         size: info.get_size(),
//         mtime: info.get_modification_date_time()
//     }

//     file_arr.push(file_info);

// }


// console.log(file_arr)