const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');
const archiver = require('archiver');
const gio = require('../gio/build/Release/gio.node');

class Utilities {

    // sanitize file name
    sanitize_file_name(href) {
        return href.replace(/\n/g, '').replace('/\:/g', '\\:').replace(/\\n/g, '');
    }

    // used in moving a file with an invalid character in the name
    sanitize_file(href) {
        href = href.replace(/\n/g, '');
        href = href.replace(/\:/g, ':');
        href = href.replace(/\\n:/g, '');
        return href;
    }

    // handle duplicate file names
    get_file_name(file_name) {
        let c = 0;
        while (fs.existsSync(file_name)) {
            ++c;
            file_name = `${file_name} (Copy ${c})`;
        }
        return file_name;
    }

}

let utilities = new Utilities();

if (!isMainThread) {

    parentPort.on('message', (data) => {
        const cmd = data.cmd;

        switch (cmd) {

            case 'compress': {

                for (let d in data) {
                    if (data[d] === undefined) {
                        let msg = {
                            cmd: 'set_msg',
                            msg: `Error: ${d} is undefined`
                        }
                        parentPort.postMessage(msg);
                        return;
                    }
                }

                let location = data.location;
                let type = data.type;
                let size = data.size;
                let files_arr = data.files_arr;
                let progress_id = data.id;

                // Create command for compressed file
                let filename = utilities.sanitize_file_name(path.basename(files_arr[0].href));

                let file_path;
                let setinterval_id;

                let output;
                let archive;

                if (type === 'zip') {

                    filename = filename.substring(0, filename.length - path.extname(filename).length) + '.zip';
                    file_path = path.format({ dir: location, base: filename });

                    output = fs.createWriteStream(file_path);
                    archive = archiver('zip', { zlib: { level: 9 } });

                } else if (type=== 'tar.gz') {

                    filename = filename.substring(0, filename.length - path.extname(filename).length) + '.tar.gz';
                    file_path = path.format({ dir: location, base: filename });

                    output = fs.createWriteStream(file_path);
                    archive = archiver('tar', { gzip: true, xz: false, zlib: { level: 9 } });

                } else if (type === 'tar.xz') {

                    filename = filename.substring(0, filename.length - path.extname(filename).length) + '.tar.xz';
                    file_path = path.format({ dir: location, base: filename });

                    output = fs.createWriteStream(file_path);
                    archive = archiver('tar', { gzip: false, xz: true, zlib: { level: 9 } });

                } else {
                    let msg = {
                        cmd: 'set_msg',
                        msg: `Error: Unknown compression type`
                    }
                    parentPort.postMessage(msg);
                }

                // init progress
                let increment = 10;
                let progress = {
                    cmd: 'progress',
                    value: increment,
                    max: size,
                    status: `Compressing "${path.basename(file_path)}"`
                }
                parentPort.postMessage(progress);



                files_arr.forEach(f => {
                    if (f.is_dir) {
                        archive.directory(f.href, path.relative(location, f.href));
                    } else {
                        archive.file(f.href, { name: path.relative(location, f.href) });
                    }
                });

                archive.on('warning', (err) => {
                    if (err.code === 'ENOENT') {
                        let msg = {
                            cmd: 'set_msg',
                            msg: `Error: ${err.message}`
                        }
                        parentPort.postMessage(msg);
                    } else {
                        throw err;
                    }
                });

                archive.on('error', function(err) {
                    let msg = {
                        cmd: 'set_msg',
                        msg: `Error: ${err.message}`
                    }
                    parentPort.postMessage(msg);
                    throw err;
                });

                archive.on('progress', (progress) => {
                    let progress_data = {
                        // id: progress_id,
                        cmd: 'progress',
                        status: `Compressing "${path.basename(file_path)}"`,
                        max: size,
                        value: progress.fs.processedBytes
                    }
                    console.log('progress', progress_data);
                    parentPort.postMessage(progress_data);
                });

                output.on('close', function() {
                    clearInterval(setinterval_id);

                    let progress = {
                        cmd: 'progress',
                        value: 0,
                        max: 0,
                        status: ''
                    }
                    parentPort.postMessage(progress);

                    let compress_done = {
                        cmd: 'compress_done',
                        id: progress_id,
                        file_path: file_path,
                    }
                    parentPort.postMessage(compress_done);

                    files_arr = [];
                    size = 0;
                    c = 0;
                });

                let msg = {
                    cmd: 'set_msg',
                    msg: `<img src="../renderer/icons/spinner.gif" style="width: 12px; height: 12px" alt="loading" />`,
                    has_timeout: 0
                }
                parentPort.postMessage(msg);

                archive.pipe(output);
                archive.finalize();


                break;
            }


            // Compress Files
            // case 'compress': {

            //     let location = data.location;
            //     let type = data.type;
            //     let size = data.size;
            //     let files_arr = data.files_arr;
            //     let progress_id = data.id;

            //     // create a temporary file list
            //     const tmp_file = path.join(os.tmpdir(), 'file_list.txt');

            //     // sanitize file names
            //     // rename the file if it has a \n in the name
            //     files_arr.forEach(f => {
            //         // check if file has an invalid character in the name and copy
            //         if (f.href.includes('\n')) {
            //             let new_name = utilities.sanitize_file(f.name);
            //             let new_href = path.join(location, new_name);
            //             gio.mv(f.href, new_href, (err, res) => {
            //                 if (!err) {
            //                     f.href = new_href;
            //                 }
            //             });
            //         }
            //     });
            //     fs.writeFileSync(tmp_file, files_arr.map(item => path.relative(location, utilities.sanitize_file_name(item.href))).join('\n'));

            //     let c = 0;
            //     let cmd = '';
            //     let file_list = files_arr.map(item => `"${path.basename(item.href)}"`).join(' ');

            //     // Create command for compressed file
            //     let filename = utilities.sanitize_file_name(path.basename(files_arr[0].href));

            //     let watcher;
            //     let file_path;
            //     let setinterval_id;

            //     if (type === 'zip') {

            //         filename = filename.substring(0, filename.length - path.extname(filename).length) + '.zip';
            //         file_path = path.format({ dir: location, base: filename });

            //         const output = fs.createWriteStream(file_path);
            //         const archive = archiver('zip', { zlib: { level: 9 } });

            //         archive.pipe(output);
            //         files_arr.forEach(f => {
            //             archive.file(f.href, { name: path.relative(location, f.href) });
            //         });

            //         archive.on('warning', (err) => {
            //             if (err.code === 'ENOENT') {
            //                 let msg = {
            //                     cmd: 'set_msg',
            //                     msg: `Error: ${err.message}`
            //                 }
            //                 parentPort.postMessage(msg);
            //             } else {
            //                 throw err;
            //             }

            //         });

            //         archive.on('error', function(err) {
            //             let msg = {
            //                 cmd: 'set_msg',
            //                 msg: `Error: ${err.message}`
            //             }
            //             parentPort.postMessage(msg);
            //             throw err;
            //         });

            //         output.on('end', function() {

            //             let progress = {
            //                 cmd: 'progress',
            //                 value: 0,
            //                 max: 0,
            //                 status: ''
            //             }
            //             parentPort.postMessage(progress);
            //             let compress_done = {
            //                 cmd: 'compress_done',
            //                 id: progress_id,
            //                 file_path: file_path,
            //             }
            //             parentPort.postMessage(compress_done);
            //             files_arr = [];
            //             size = 0;
            //             c = 0;

            //         });

            //         archive.finalize();
            //         return;

            //         // cmd = `cd '${location}'; zip -r '${filename}' -@ < "${tmp_file}"`;

            //         // // Watch for temporary files created by zip
            //         // let tmpFileNamePattern = /zi\w+/;
            //         // let tmpFilePath;
            //         // watcher = fs.watch(location, (eventType, filename) => {
            //         //     if (eventType === 'rename' && tmpFileNamePattern.test(filename)) {
            //         //         tmpFilePath = path.join(location, filename);
            //         //     }
            //         // });

            //         // setinterval_id = setInterval(() => {
            //         //     fs.stat(tmpFilePath, (err, stats) => {
            //         //         if (!err) {
            //         //             let progress_data = {
            //         //                 id: progress_id,
            //         //                 cmd: 'progress',
            //         //                 status: `Compressing "${path.basename(file_path)}"`,
            //         //                 max: Math.round(parseInt(size)),
            //         //                 value: stats.size
            //         //             }
            //         //             parentPort.postMessage(progress_data);
            //         //         }
            //         //     });
            //         // }, 1000);

            //     } else {

            //         filename = filename.substring(0, filename.length - path.extname(filename).length) + '.tar.gz';
            //         file_path = path.format({ dir: location, base: filename });

            //         cmd = `cd '${location}' && tar --force-local -czf "${filename}" -C '${location}' -T "${tmp_file}"`;

            //         const compressionRatio = 0.5;
            //         setinterval_id = setInterval(() => {

            //             fs.stat(file_path, (err, stats) => {
            //                 if (!err) {

            //                     let progress_data = {
            //                         id: progress_id,
            //                         cmd: 'progress',
            //                         status: `Compressing "${path.basename(file_path)}"`,
            //                         max: Math.round(parseInt(size)),
            //                         value: stats.size / compressionRatio
            //                     }
            //                     parentPort.postMessage(progress_data);

            //                 }

            //             });

            //         }, 1000);

            //     }

            //     let msg = {
            //         cmd: 'set_msg',
            //         msg: `Compressing ${files_arr.length} files.`,
            //         has_timeout: 0
            //     }
            //     parentPort.postMessage(msg);

            //     // execute cmd
            //     exec(cmd, (err, stdout, stderr) => {

            //         if (err || stderr) {

            //             clearInterval(setinterval_id);
            //             if (watcher) {
            //                 watcher.close();
            //             }

            //             let progress = {
            //                 cmd: 'progress',
            //                 value: 0,
            //                 max: 0,
            //                 status: ''
            //             }
            //             parentPort.postMessage(progress);

            //             let msg = {
            //                 cmd: 'set_msg',
            //                 msg: `Error compressing files. ${err.message}`
            //             }
            //             parentPort.postMessage(msg);

            //             // cleanup
            //             fs.unlinkSync(tmp_file);
            //             files_arr = [];
            //             return;
            //         }

            //         // listen for process exit
            //         if (stdout) {
            //             let msg = {
            //                 cmd: 'set_msg',
            //                 msg: stdout
            //             }
            //             parentPort.postMessage(msg);

            //         }

            //         // cleanup
            //         fs.unlinkSync(tmp_file);
            //         clearInterval(setinterval_id);
            //         if (watcher) {
            //             watcher.close();
            //         }
            //         let compress_done = {
            //             cmd: 'compress_done',
            //             id: progress_id,
            //             file_path: file_path,
            //         }
            //         parentPort.postMessage(compress_done);

            //         files_arr = [];
            //         size = 0;
            //         c = 0;



            //     });



            //     break;
            // }

            // Extract
            case 'extract': {

                // console.log('running extract')

                let location = data.location;
                let progress_id = data.id;
                let source = data.source;
                let ext = ''

                console.log (path.extname(source).toLowerCase());

                let cmd = '';
                let filename = '';
                let make_dir = 1;

                let c = 0;

                switch (true) {
                    case source.indexOf('.zip') > -1:
                        filename = utilities.get_file_name(source.replace('.zip', ''))
                        cmd = `unzip "${source}" -d "${filename}"`;
                        break;
                    case source.indexOf('.tar.gz') > -1:
                        filename = utilities.get_file_name(source.replace('.tar.gz', ''));
                        cmd = `cd "${location}"; /usr/bin/tar -xzf "${source}" -C "${filename}"`;
                        break;
                    case source.indexOf('.tar') > -1:

                        if (source.indexOf('.tar.gz') > -1) {
                            filename = utilities.get_file_name(source.replace('.tar.gz', ''));
                            cmd = `cd "${location}"; /usr/bin/tar -xzf "${source}" -C "${filename}"`;
                            break;
                        }
                        if (source.indexOf('.tar.xz') > -1) {
                            filename = utilities.get_file_name(source.replace('.tar.xz', ''));
                            cmd = `cd "${location}"; /usr/bin/tar -xf "${source}" -C "${filename}"`;
                            break;
                        }
                        if (source.indexOf('.tar.bz2') > -1) {
                            filename = utilities.get_file_name(source.replace('.tar.bz2', ''));
                            cmd = 'cd "' + location + '"; /usr/bin/tar -xjf "' + source + '" -C "' + filename + '"';
                            break;
                        }
                        if (source.indexOf('.tar') > -1) {
                            filename = source.replace('.tar', '');
                            cmd = 'cd "' + location + '"; /usr/bin/tar --strip-components=1 -xzf "' + source + '"';
                            break;
                        }
                        break;
                    case source.indexOf('.gz') > -1:
                        filename = source.replace('.gz', '');
                        cmd = `cd "${location}"; /usr/bin/gunzip -d -k "${source}"`; // | tar -x -C ${filename}"`;
                        make_dir = 0;
                        break;
                    case source.indexOf('.xz') > -1:
                        filename = source.replace('tar.xz', '');
                        filename = filename.replace('.img.xz', '');
                        if (source.indexOf('.img.xz') > -1) {
                            make_dir = 0;
                            cmd = 'cd "' + location + '"; /usr/bin/unxz -k "' + source + '"';
                        } else {
                            cmd = 'cd "' + location + '"; /usr/bin/tar -xf "' + source + '" -C "' + utilities.get_file_name(filename) + '"';
                        }
                        break;
                    case source.indexOf('.bz2') > -1:
                        ext = '.bz2';
                        filename = source.replace('.bz2', '');
                        cmd = 'cd "' + location + '"; /usr/bin/bzip2 -dk "' + source + '"'
                        break;
                    case source.indexOf('.7z') > -1:
                        ext = '.7z';
                        filename = source.replace('.7z', '');
                        cmd = `cd "${location}"; /usr/bin/7z x "${source}" -o"${filename}"`;
                        break;
                }

                if (make_dir) {
                    gio.mkdir(filename)
                    // fs.mkdirSync(filename);
                }

                // GET UNCOMPRESSED SIZE
                // win.send('msg', `Calculating uncompressed size of ${path.basename(source)}`, 0);
                // let setinterval_id = 0;
                let file = gio.get_file(source)
                let ratio = 0.5;
                let max = (parseInt(file.size / 1024) / ratio);
                let current_size = 0;

                let setinterval_id = setInterval(() => {

                    current_size = parseInt(execSync(`du -s '${filename}' | awk '{print $1}'`).toString().replaceAll(',', ''))
                    // console.log(current_size, filename)
                    let progress_opts = {
                        id: progress_id,
                        cmd: 'progress',
                        value: (current_size),
                        max: max,
                        status: `Extracting "${path.basename(filename)}"`
                    }
                    parentPort.postMessage(progress_opts);

                }, 1000);

                console.log(cmd);

                // THIS NEEDS WORK. CHECK IF DIRECTORY EXIST. NEED OPTION TO OVERWRITE
                exec(cmd, { maxBuffer: Number.MAX_SAFE_INTEGER }, (err, stdout, stderr) => {

                    if (err) {

                        let msg = {
                            cmd: 'set_msg',
                            msg: `Error: ${err.message}`
                        }
                        parentPort.postMessage(msg);
                        // gio.rm(filename);
                        clearInterval(setinterval_id);
                        return;
                    }



                    clearInterval(setinterval_id);
                    let extract_done = {
                        id: progress_id,
                        cmd: 'extract_done',
                        source: source,
                        destination: filename
                    }
                    parentPort.postMessage(extract_done);
                    // clearInterval(setinterval_id);

                })

                break;
            }
            default:
                break;
        }
    });

}
