// const { exec, execSync, spawn, execFileSync }   = require("child_process");
const util  = require('util')
const path  = require('path')
const exec  = util.promisify(require('child_process').exec)
const exexSync = require('child_process').exec;
const spawn = require('child_process').spawn;

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
 *
 * @param {string[]} paths
 */
exports.join = function(paths) {
    let paths_arr = paths.split(',')
    let gio_path = ''
    paths_arr.forEach((path, idx) => {

        if (idx > 0) {
            if (path.indexOf('//') > -1) {
                path.replace('//', '/')
            }
            gio_path += path
        }
    });

    return gio_path
}

/**
 * Get File Information from GIO (gvfs)
 * @param {*} href
 */
get_file1 = async (href) => {

    file_obj = {}
    return exec(`gio info "${href}"`).then(res => {

        let files = res.stdout.split('\n').map(p => p.trim().split(': '))
        file_obj.href = href
        file_obj.name = path.basename(href)

        files.forEach(item => {
            file_obj[item[0]] = item[1]
            if (file_obj["time::changed"]) {
                file_obj.mtime = file_obj["time::changed"]
            }
        })

        return file_obj

    })

}

get_dir1 = async (dir, callback) => {

    let dirents = []
    file_arr    = []

    return exec(`gio list -h -l -a "*" "${dir}"`, {maxBuffer: 1024 * 1024 * 1024}).then(res => {

        let file_info = res.stdout.split('\n')
        file_info.forEach((item, idx) => {

            if (idx < file_info.length -1) {

                let file_obj = {}
                let files = item.split('\t')

                file_obj.size = files[1] // this is being set on get_card1
                file_obj.name = files[0]

                if (is_gio_file(dir)) {
                    file_obj.href = dir + '/' + files[0]
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
                        file_obj[attribute[0]] = attribute[1]
                    })

                }

                dirents.push(file_obj)

            }

        })

        file_arr = dirents;
        return callback(dirents)


    })

}

/**
 * Get File Information from GIO (gvfs)
 * @param {*} href
 * @param {*} callback
 */
get_file = (href, callback) => {

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

get_dir = (dir, callback) => {

    let dirents = []
    file_arr    = []

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
                        file_obj.href = dir + '/' + files[0]
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
                            file_obj[attribute[0]] = attribute[1]
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



}

/**
 * Copy File using GIO (gvfs)
 * @param {string} source
 * @param {string} destination
 * @param {callback} callback
 *
 */
exports.cp = function(source, destination) {

    // spawn(`gio copy "${source}" "${destination}"`)
    return exexSync(`gio copy "${source}" "${destination}"`, (err, stdout, stderr) => {})
    // .then(res => {
    //     return callback(res);
    // }).catch(err => {
    //     return callback(err);
    // })

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

exports.rename = function(source, destination, callback) {
    return exexSync(`gio rename "${source}" "${destination}"`)
}

/**
 * Remote a File or Directory using GIO (gvfs)
 * @param {*} href
 * @param {*} callback
 */
rm = (href) => {

    return exec(`gio remove -f "${href}"`)
    // .then(res => {
    //     return callback(res)
    // }).catch(err => {
    //     return callback(err)
    // })

    // return callback(1)

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


exports.rm = rm
exports.get_file1 = get_file1
exports.get_dir1 = get_dir1
exports.get_file = get_file
exports.get_dir = get_dir