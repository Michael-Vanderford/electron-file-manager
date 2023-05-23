const {
    app,
    globalShortcut,
    Notification,
    BrowserWindow,
    Menu,
    screen,
    dialog,
    accelerator,
    WebContents,
    webContents,
    MenuItem,
    ipcRenderer,
} = require("electron");
const { Worker, isMainThread, parentPort } = require("worker_threads");
const { exec, execSync, spawn, execFileSync } = require("child_process");
const util = require("util");
const exec1 = util.promisify(require("child_process").exec);
const path = require("path");
const fs = require("fs");
const ipcMain = require("electron").ipcMain;
const nativeTheme = require("electron").nativeTheme;
const nativeImage = require("electron").nativeImage;
const shell = require("electron").shell;
const move_windows = new Set();
const window = require("electron").BrowserWindow;
const windows = new Set();
const { clipboard } = require("electron");
const os = require("os");
const gio = require("./utils/gio");
const { promisify } = require("util");
const execPromise = util.promisify(exec);
const Gio = require("gio");
const { session } = require("electron");

let copy_files_arr = [];
let canceled = 0;
let isMainView = 1;
let window_id = 0;
let window_id0 = 0;
let recursive = 0;
let recursive0 = 0;
let file_count_recursive = 0;
let folder_count_recursive = 0;
let active_folder = "";
let destination0 = "";
let win = "";
let current_directory = "";
let destination_folder = "";

let del_file_arr = [];
let del_folder_arr = [];
let rec = 1;
let state = 0;

let is_caneled = 0;

ipcMain.on("connect", (e) => {
    createConnectDialog();
});

// Network connect dialog
function createConnectDialog() {
    let bounds = win.getBounds();

    let x = bounds.x + parseInt((bounds.width - 550) / 2);
    let y = bounds.y + parseInt((bounds.height - 350) / 2);

    let connect = new BrowserWindow({
        parent: window.getFocusedWindow(),
        width: 550,
        height: 350,
        backgroundColor: "#2e2c29",
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    connect.loadFile("src/connect.html");

    // SHOW DIALG
    connect.once("ready-to-show", () => {
        let title = "Connect to server";
        connect.title = title;
        connect.removeMenu();
        connect.send("connect");
    });
}

// Settings
let settings_file = path.join(app.getPath("userData"), "settings.json");
let data = {
    window: {
        length: 1400,
        width: 700,
        x: 0,
        y: 0,
    },
    display: {
        "Icon Caption": {
            None: "None",
            Size: "Size",
        },
    },
    keyboard_shortcuts: {
        Backspace: "Backspace",
        ShowHome: "Alt+H",
        ShowWorkspace: "Alt+W",
        ShowSidebar: "Ctrl+B",
        ShowDevices: "Ctrl+D",
        ShowSettings: "",
        Find: "Ctrl+F",
        Down: "Down",
        Up: "Up",
        Left: "Left",
        Right: "Right",
        Rename: "F2",
        Cut: "Ctrl+X",
        Copy: "Ctrl+C",
        Paste: "Ctrl+V",
        SelectAll: "Ctrl+A",
        Delete: "Delete",
        Compress: "Shift+C",
        Extract: "Shift+E",
        Properties: "Ctrl+I",
        NewFolder: "Ctrl+Shift+N",
        AddWorkspace: "Ctrl+D",
        OpenNewTab: "Ctrl+Enter",
    },
};

fs.writeFileSync(settings_file, JSON.stringify(data, null, 4));

let settings = JSON.parse(
    fs.readFileSync("settings.json", { encoding: "utf8", flag: "r" })
);
ipcMain.on("reload_settings", (e) => {
    settings = JSON.parse(
        fs.readFileSync("settings.json", { encoding: "utf8", flag: "r" })
    );
});

let thumbnails_dir = path.join(app.getPath("userData"), "thumbnails");
if (!fs.existsSync(thumbnails_dir)) {
    fs.mkdirSync(thumbnails_dir);
}


ipcMain.on("get_devices", (e) => {
    win.send("get_devices");
});

ipcMain.handle("image_to_clipboard", (e, href) => {
    const image = nativeImage.createFromPath(href);
    return image;
});

ipcMain.handle("username", (e) => {
    return os.userInfo().username;
});

ipcMain.handle("userdata_dir", (e) => {
    return app.getPath("userData");
});

ipcMain.handle("get_thumbnails_directory", async (e) => {
    return thumbnails_dir;
});

ipcMain.on("cancel", (e) => {
    canceled = 1;
});

ipcMain.on("delete_file", (e, file) => {
    delete_file(file, () => {});
});

ipcMain.on("open_file", (e) => {});

ipcMain.on("is_main_view", (e, state = 0) => {
    isMainView = state;
});

ipcMain.on("active_window", (e) => {
    window_id0 = window_id;
    window_id = e.sender.id;

    if (window_id != window_id0) {
        win = window.fromId(window_id);
    }
});

ipcMain.on("active_folder", (e, href, state = 0) => {
    /* Get active window */
    let window_id = e.sender.id;
    win = window.fromId(window_id);
    active_folder = href;
    isMainView = state;
});

ipcMain.on("item_count_recursive", (e, filename) => {
    get_folder_count_recursive(filename);
    get_file_count_recursive(filename);

    let data = {
        filename: filename,
        folder_count: folder_count_recursive,
        file_count: file_count_recursive,
    };

    win.send("item_count", data);
});

ipcMain.on("current_directory", (e, directory) => {
    if (directory !== current_directory) {
        current_directory = directory;
    }
});

ipcMain.on("add_system_notification", (e, title, body) => {
    AddSysNotification(title, body);
});

ipcMain.on("destination_folder", (e, directory) => {
    destination_folder = directory;
});

function formatDate(date) {
    return new Intl.DateTimeFormat("ko", {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(date);
}

let fsr = 1;

function get_folder_size_recursive(href) {
    gio.get_dir(href, (dirents) => {
        let size = 0;
        dirents.forEach((file) => {
            if (file.is_dir) {
                let next_dir = file.href;
                console.log(next_dir);
                get_folder_size_recursive(next_dir);
                ++fsr;
            } else {
                size += parseInt(file.size);
            }
        });

        if (--fsr == 0) {
            console.log(get_file_size(size));
        }
    });
}

function show_progress() {
    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach((item) => {
        max += parseInt(item.size);
    });

    // SHOW PROGRESS
    windows.forEach((win) => {
        win.webContents.send("progress", max);
    });
}

/**
 * Get folder size. Runs du -Hs command
 * @param {string} href
 */
function get_folder_size1(href) {
    cmd = "cd '" + href + "'; du -Hs";
    du = exec(cmd);
    du.stdout.on("data", function (res) {
        let size = parseInt(res.replace(".", "") * 1024);
        win.send("folder_size", { href: href, size: size });
    });
    du.stderr;
}

function AddSysNotification(title, body) {
    new Notification({ title: title, body: body }).show();
}

function isGioFile(href) {
    if (
        href.indexOf("smb://") > -1 ||
        href.indexOf("sftp://") > -1 ||
        href.indexOf("mtp://") > -1
    ) {
        return 1;
    } else {
        return 0;
    }
}

let do_copy_arr = [];
let source_base = "";
let do_copy_counter = 0;

function do_copy(source, destination, copystate, callback) {
    if (copystate == 0) {
        // // Get size for progress
        let max = 0;
        copy_files_arr.forEach((item) => {
            max += parseInt(item.size);
        });

        // // Show progress
        source_base = source;
        if (
            destination.indexOf("smb") > -1 ||
            destination.indexOf("sftp") > -1 ||
            destination.indexOf("mtp") > -1
        ) {
            exec1(`gio mkdir "${destination}"`);
        } else {
            fs.mkdirSync(destination);
        }

        if (isMainView) {
            let file_obj = {
                name: path.basename(destination),
                href: destination,
                mtime: new Date(),
                is_dir: 1,
            };
            win.send("get_card", file_obj);
        }

        copystate = 1;
    }

    // init
    if (copystate == 1) {
        gio.get_dir(source, (files) => {
            files.forEach((file) => {
                let cursource = path.join(source, file.name);
                let curdestination = "";

                if (file.is_dir) {
                    curdestination = path.join(
                        destination,
                        path.basename(cursource)
                    );

                    if (!fs.existsSync(curdestination)) {
                        gio.mkdir(curdestination, (res) => {
                            if (res.err) {
                                console.log(res.err);
                            }
                        });

                        let file_arr_obj = {
                            source: cursource,
                            destination: curdestination,
                            is_dir: 1,
                        };
                        do_copy_arr.push(file_arr_obj);
                    }

                    do_copy(cursource, curdestination, copystate);
                } else {
                    curdestination = path.join(
                        destination,
                        path.basename(cursource)
                    );

                    if (isGioFile(cursource)) {
                        gio.cp(cursource, curdestination, (res) => {
                            if (res.err) {
                                console.log(res.err);
                            }
                        });
                    } else {
                        fs.copyFile(cursource, curdestination, (err) => {
                            if (err) {
                                win.send("notification", err);
                            } else {
                                get_folder_size1(destination);
                            }

                            ++do_copy_counter;
                        });
                    }
                }
            });
        });
    }
}

/**
 *
 * @param {string} source
 * @param {string} target
 * @param {int} state
 * @param {*} callback
 */
function copyfile(source, target, callback) {
    // TARGET
    var targetfile = target;
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetfile = path.join(target, path.basename(source));
        }
    }

    if (isGioFile(targetfile)) {
        // todo: do error handling
        fs.lstat(source, (err, stats) => {
            if (err) {
                console.log(er);
                return;
            }

            if (!stats.isSymbolicLink()) {
                gio.cp(source, targetfile, (res) => {
                    return callback(1);
                });
            }
        });
    } else {
        fs.lstat(source, (err, stats) => {
            if (err) {
                console.log(er);
                return;
            }

            if (!stats.isSymbolicLink()) {
                fs.copyFile(source, targetfile, (err) => {
                    if (!err) {
                        return callback(1);
                    } else {
                        win.send("remove_card", targetfile);
                        win.send("notification", err);
                        return callback(err);
                    }
                });
            }
        });
    }
}

const copy2 = promisify(gio.cp);
const mkdir2 = promisify(gio.mkdir);
const readdir2 = promisify(gio.get_dir);
const getfile2 = promisify(gio.get_file);

async function copyFileOrFolder2(source, destination, onProgress) {
    console.log("running ", source, destination);

    try {
        const sourceStats = await getfile2(source, (res) => {});
        let isDirectory = 0;
        if (sourceStats.type === "directory") {
            isDirectory = 1;
        }

        // If the source is a directory, create the destination directory
        if (isDirectory) {
            await mkdir2(destination);
            const files = await readdir2(source);
            const fileCount = files.length;
            let filesProcessed = 0;
            await Promise.all(
                files.map(async (file) => {
                    const sourcePath = `${source}/${file}`;
                    const destinationPath = `${destination}/${file}`;
                    await copyFileOrFolder2(sourcePath, destinationPath, () => {
                        filesProcessed++;
                        console.log(fileCount);
                        onProgress && onProgress(filesProcessed / fileCount);
                    });
                })
            );
        } else {
            await copy2(source, destination);
        }
    } catch (err) {
        console.error(`Error copying ${source} to ${destination}: ${err}`);
    }
}

const copy1 = promisify(fs.copyFile);
const mkdir1 = promisify(fs.mkdir);
const readdir1 = promisify(fs.readdir);
const lstat1 = promisify(fs.lstat);

async function copyFileOrFolder(source, destination, onProgress) {
    try {
        const sourceStats = await lstat1(source);
        const isDirectory = sourceStats.isDirectory();

        // If the source is a directory, create the destination directory
        if (isDirectory) {
            await mkdir1(destination);
            const files = await readdir1(source);
            const fileCount = files.length;
            let filesProcessed = 0;
            await Promise.all(
                files.map(async (file) => {
                    const sourcePath = `${source}/${file}`;
                    const destinationPath = `${destination}/${file}`;
                    await copyFileOrFolder(sourcePath, destinationPath, () => {
                        filesProcessed++;
                        console.log(fileCount);
                        onProgress && onProgress(filesProcessed / fileCount);
                    });
                })
            );
        } else {
            await copy1(source, destination);
        }
        win.send("set_progress_msg", `Copied ${source}`);
    } catch (err) {
        console.error(`Error copying ${source} to ${destination}: ${err}`);
    }
}

let folders = 0;

fs.readdir("/path/to/dir", (err, files) => {
    if (err) throw err;
    files.forEach((file) => {
        if (fs.statSync(file).isDirectory()) {
            folders++;
        } else {
            files++;
        }
    });
    console.log("Files:", files, "Folders:", folders);
});

const getNumFilesFolders = (dirPath) => {
    let numFilesFolders = 0;
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
        const filePath = `${dirPath}/${file}`;
        const stats = fs.lstatSync(filePath);
        if (stats.isFile() || stats.isDirectory()) {
            numFilesFolders++;
        }
    });
    return numFilesFolders;
};

function copyDirRecursiveAsync(sourceDir, targetDir, max, callback) {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
        fs.mkdir(targetDir, (err) => {
            if (err) {
                callback(err);
                return;
            }
            copyFiles();
        });
    } else {
        copyFiles();
    }

    function copyFiles() {
        // Get a list of files and directories in the source directory
        fs.readdir(sourceDir, (err, files) => {
            if (err) {
                callback(err);
                return;
            }

            // Loop through the files and directories and copy them to the target directory
            let count = 0;
            files.forEach((file) => {
                const srcPath = path.join(sourceDir, file);
                const destPath = path.join(targetDir, file);

                fs.lstat(srcPath, (err, stats) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    if (stats.isDirectory()) {
                        // Recursively copy subdirectories
                        copyDirRecursiveAsync(srcPath, destPath, max, (err) => {
                            if (err) {
                                callback(err);
                                return;
                            }
                            count++;
                            win.send(
                                "set_progress_msg",
                                `Copying File ${path.basename(srcPath)}`
                            );
                            // active_window.send('set_progress', file.length, count)
                            if (count === files.length) {
                                callback();
                            }
                        });
                    } else {
                        // Copy files
                        fs.copyFile(srcPath, destPath, (err) => {
                            if (err) {
                                callback(err);
                                return;
                            }
                            count++;
                            win.send(
                                "set_progress_msg",
                                `Copying File ${path.basename(srcPath)}`
                            );
                            // active_window.send('set_progress', file.length, count)
                            if (count === files.length) {
                                callback();
                            }
                        });
                    }
                });
            });
        });
    }
}

recursive = 1;
let count = 0;
state = 0;
let orig_dest = "";

/**
 * Copy folders recursive
 * @param {sting} source
 * @param {string} destination
 * @param {int} state
 * @param {*} callback
 */
function copyfolder(source, destination, callback) {
    if (isGioFile(destination)) {
        gio.get_dir(source, (dirents) => {
            gio.mkdir(destination, (res) => {
                win.send(
                    "set_progress_msg",
                    `Copying File ${path.basename(destination)}`
                );
                win.send("set_progress", dirents.length, 1);
            });

            dirents.forEach((file, idx) => {
                const fileCount = dirents.length;
                let cursource = path.format({ dir: source, base: file.name });
                let curdestination = path.format({
                    dir: destination,
                    base: file.name,
                });

                if (file.is_dir) {
                    ++recursive;
                    count++;

                    if (state == 0) {
                        orig_dest = destination;
                        state = 1;
                    }

                    win.send(
                        "set_progress_msg",
                        `Copying File ${path.basename(curdestination)}`
                    );
                    win.send("set_progress", dirents.length, count);
                    copyfolder(cursource, curdestination, (callback) => {});
                } else {
                    count++;
                    win.send(
                        "set_progress_msg",
                        `Copying File ${path.basename(curdestination)}`
                    );
                    win.send("set_progress", dirents.length, count);
                    copyfile(cursource, curdestination, (callback) => {});
                }
            });

            console.log(recursive);
            if (--recursive === 0) {
                win.send("set_progress", 1, 1);

                if (isMainView) {
                    gio.get_file(destination, (file) => {
                        console.log(file);
                        win.send("get_card", file);
                    });
                }

                state = 0;
                recursive = 1;
                console.log("done");
                return callback(1);
            }
        });
    } else {
        fs.readdir(source, (err, files) => {
            if (!err) {
                if (isGioFile(destination)) {
                    gio.mkdir(destination, (res) => {});
                } else {
                    if (!fs.existsSync(destination)) {
                        fs.mkdirSync(destination);
                    }
                }

                // Loop over files
                files.forEach((file, idx) => {
                    let cursource = path.join(source, file);
                    let curdestination = path.join(destination, file);

                    fs.lstat(cursource, (err, stats) => {
                        if (!err) {
                            // Directory
                            if (stats.isDirectory()) {
                                win.send(
                                    "set_progress_msg",
                                    `Copying Folder ${path.basename(
                                        curdestination
                                    )}`
                                );
                                copyfolder(
                                    cursource,
                                    curdestination,
                                    (callback) => {}
                                );
                            } else {
                                win.send(
                                    "set_progress_msg",
                                    `Copying File ${path.basename(
                                        curdestination
                                    )}`
                                );
                                copyfile(
                                    cursource,
                                    curdestination,
                                    (callback) => {}
                                );
                            }

                            return callback(1);
                        } else {
                            win.send("notification", err);
                        }
                    });
                });
            } else {
                win.send("notification", err);
                return callback(err);
            }
        });
    }
}

// Add files to copy array
ipcMain.on("add_copy_files", function (e, data) {
    copy_files_arr = data;
});

const copy_write = (source, destination, callback) => {
    // get the stats of the source
    const stats = fs.statSync(source);

    if (stats.isDirectory()) {
        // if it's a directory, create the destination directory if it doesn't exist
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination);
            win.send(
                "set_progress_msg",
                `Copying ${path.basename(destination)}`
            );
        }

        // list all files and subdirectories in the source directory
        const files = fs.readdirSync(source);
        let count = 0;
        files.forEach((file) => {
            const sourcePath = path.join(source, file);
            const destinationPath = path.join(destination, file);
            win.send(
                "set_progress_msg",
                `Copying ${path.basename(destinationPath)}`
            );
            copy_write(sourcePath, destinationPath, () => {
                count++;
                if (count === files.length) {
                    return callback("ok");
                }
            });
        });
    } else {
        // if it's a file, copy it to the destination
        const reader = fs.createReadStream(source);
        const writer = fs.createWriteStream(destination);
        reader.pipe(writer);

        // Return a function to cancel the copy process
        cancelCopy = () => {
            win.send("notification", "Copy Canceled");
            delete_file(destination, () => {});
            reader.destroy();
            pipe.destroy();
            callback(new Error("Copy process was cancelled"));
        };

        return callback();
    }
};

ipcMain.on("cancel", (e) => {
    cancelCopy();
});

// todo: remove old copy file array reference from preload
ipcMain.on("copy", (e) => {
    copy();
});

// Copy
let size = 0;

function copy() {
    // SHOW PROGRESS
    let source0 = "";
    let source = "";
    copy_files_arr.every((file, idx) => {
        source0 = source;
        source = file.href;
        let destination = path.format({
            dir: active_folder,
            base: path.basename(file.href),
        });

        if (copy_files_arr.length > 0) {
            if (!isGioFile(destination)) {
                // SET SIZE FOR PROGRESS
                let max = 0;
                copy_files_arr.forEach((item) => {
                    max += parseInt(item.size);
                });
                // SHOW PROGRESS
                active_window.send("progress", max);
            }

            if (file.is_dir || file.type === "directory") {
                if (source === destination) {
                    destination = destination + " (Copy)";
                }

                if (fs.existsSync(destination)) {
                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination,
                    };

                    createConfirmDialog(data, copy_files_arr);
                    return false;
                } else {
                    if (isGioFile(destination)) {
                        // show_progress()
                        copyfolder(source, destination, () => {});
                    } else {
                        win.send(
                            "set_progress_msg",
                            `Copying ${source} to ${destination}`
                        );
                        show_progress();
                        const worker = new Worker("./utils/worker.js", {
                            workerData: {
                                source: source,
                                destination: destination,
                            },
                        });
                        worker.on("message", (msg) => {
                            if (msg instanceof Error) {
                                // Handle error
                                win.send("notification", msg);
                            } else {
                                // Handle success
                                if (isMainView) {
                                    gio.get_file(destination, (file) => {
                                        win.send("get_card", file);
                                        win.send("update_card1", file.href);
                                    });
                                } else {
                                    let base = path.dirname(destination);
                                    win.send("update_card", base);
                                }
                            }
                        });
                    }
                }
            } else {
                if (source === destination) {
                    let c = 0;
                    filename = path.basename(destination);
                    destination =
                        path.dirname(destination) +
                        "/" +
                        path.basename(filename, path.extname(filename)) +
                        " (Copy)" +
                        path.extname(filename);
                    while (fs.existsSync(destination)) {
                        destination =
                            path.dirname(destination) +
                            "/" +
                            path.basename(filename, path.extname(filename)) +
                            " (Copy) " +
                            c +
                            path.extname(filename);
                        console.log(destination);
                        ++c;
                    }
                    c = 0;
                }

                if (fs.existsSync(destination)) {
                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination,
                    };

                    createConfirmDialog(data, copy_files_arr);
                    return false;
                } else {
                    if (isGioFile(destination)) {
                        win.send("set_progress_msg", destination);
                        win.send("set_progress", 1, 1);

                        gio.cp(source, destination, () => {
                            if (isMainView) {
                                win.send("update_card", destination);
                                win.send("update_cards1", active_folder);
                            } else {
                                let base = path.dirname(destination);
                                win.send("update_card", base);
                            }
                        });
                    } else {
                        show_progress();

                        win.send(
                            "set_progress_msg",
                            `Copying File ${path.basename(source)}`
                        );
                        copy_write(source, destination, () => {
                            if (isMainView) {
                                let file_obj = {
                                    name: path.basename(destination),
                                    href: destination,
                                    is_dir: 0,
                                    ["time::modified"]: new Date() / 1000,
                                    size: 0,
                                };

                                win.send("get_card", file_obj);
                                win.send("update_card1", destination);
                            } else {
                                let base = path.dirname(destination);
                                win.send("update_card", base);
                            }
                        });
                    }
                }
            }
        }
        return true;
    });
}

folder_count = 0;
file_count = 0;
recursive = 1;

function get_count_recursive(dir, callback) {
    let dirents = fs.readdirSync(dir);

    dirents.forEach((file) => {
        if (fs.statSync(path.join(dir, file)).isDirectory() === 1) {
            ++folder_count;
            ++recursive;
            get_count_recursive(path.join(dir, file), callback);
        } else {
            ++file_count;
        }
    });

    if (--recursive === 0) {
        recursive = 1;
        return callback(file_count + folder_count);
    }
}

async function get_file_count_recursive(href) {
    let dirents = fs.readdirSync(href);
    ++recursive;
    try {
        let files = dirents.filter(
            (item) => !fs.statSync(path.join(href, item)).isDirectory()
        );
        file_count_recursive += files.length;
        return file_count_recursive;
    } catch (err) {}
}

async function get_folder_count_recursive(href) {
    let dirents = fs.readdirSync(href);
    try {
        let folders = dirents.filter((item) =>
            fs.statSync(path.join(href, item)).isDirectory()
        );
        folders.forEach((folder, idx) => {
            let cursource = path.join(href, folder);
            get_folder_count_recursive(cursource);
            ++folder_count_recursive;
            if (fs.statSync(cursource).isDirectory()) {
                get_file_count_recursive(cursource);
            }
        });

        return folder_count_recursive;
    } catch (err) {}
}

ipcMain.handle("get_folder_count_recursive", async (e, href) => {
    folder_count_recursive = 0;
    file_count_recursive = 0;
    return await get_folder_count_recursive(href);
});

ipcMain.handle("get_file_count_recursive", async (e, href) => {
    return await get_file_count_recursive(href);
});

function get_file_properties(filename) {
    let stats = fs.statSync(filename);
    let cmd = "xdg-mime query filetype '" + filename + "'";
    let exec_mime = execSync(cmd).toString();

    folder_count_recursive = 0;
    file_count_recursive = 0;

    // BUILD PROPERTIES
    let name = filename;
    let parent_folder = path.basename(path.dirname(filename));
    let type = exec_mime;
    let size = "";
    let accessed = new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(stats.atime);
    let created = new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(stats.birthtime);
    let modified = new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(stats.mtime);
    let mode = stats.mode;
    let group = stats.uid;
    let contents = "";

    let file_properties = {
        Name: name,
        Type: type,
        Size: size,
        Parent: parent_folder,
        Accessed: accessed,
        Modified: modified,
        Created: created,
        Mode: mode,
        Group: group,
    };

    if (stats.isDirectory()) {
        contents =
            folder_count_recursive.toLocaleString() +
            " Folder/s " +
            file_count_recursive.toLocaleString() +
            " File/s ";

        file_properties = {
            Name: name,
            Type: type,
            Contents: contents,
            Size: size,
            Parent: parent_folder,
            Accessed: accessed,
            Modified: modified,
            Created: created,
            Mode: mode,
            Group: group,
        };
    }

    win.send("file_properties", file_properties);
}

/**
 * Get disk space and send back to preload
 * @param {string} href
 */
function get_disk_space(href) {
    if (
        href.href.indexOf("smb:") > -1 ||
        href.href.indexOf("sftp:") > -1 ||
        href.href.indexOf("mtp:") > -1
    ) {
        win.send("du_folder_size", 0);
    } else {
        df = [];
        // RUN DISK FREE COMMAND
        let cmd = 'df "' + href.href + '"';

        let data = execSync(cmd).toString();
        let data_arr = data.split("\n");

        // CREATE OPTIONS OBJECT
        let options = {
            disksize: 0,
            usedspace: 0,
            availablespace: 0,
            foldersize: 0,
            foldercount: 0,
            filecount: 0,
        };

        if (data_arr.length > 0) {
            let res1 = data_arr[1].split(" ");

            let c = 0;
            res1.forEach((size, i) => {
                if (size != "") {
                    // 0 DISK
                    // 6 SIZE OF DISK
                    // 7 USED SPACE
                    // 8 AVAILABLE SPACE
                    // 10 PERCENTAGE USED
                    // 11 CURRENT DIR

                    switch (c) {
                        case 1:
                            options.disksize = get_file_size(
                                parseFloat(size) * 1024
                            );
                            break;
                        case 2:
                            options.usedspace = get_file_size(
                                parseFloat(size) * 1024
                            );
                            break;
                        case 3:
                            options.availablespace = get_file_size(
                                parseFloat(size) * 1024
                            );
                            break;
                    }

                    ++c;
                }
            });

            options.foldercount = href.folder_count;
            options.filecount = href.file_count;

            df.push(options);

            // SEND DISK SPACE
            win.send("disk_space", df);

            cmd = 'cd "' + href.href + '"; du -s';
            du = exec(cmd);

            du.stdout.on("data", function (res) {
                let size = parseInt(res.replace(".", "") * 1024);
                size = get_file_size(size);
                win.send("du_folder_size", size);
            });
        }
    }
}

/**
 * Get disk space summary
 */
function get_diskspace_summary() {
    get_disk_space({ href: "/" }, (res) => {});
}

/**
 *
 * @param {string} href
 * @param {*} callback
 */
async function rm_gio_files(href, callback) {
    if (state == 0) {
        del_folder_arr.push(href);
        state = 1;
    }

    gio.get_dir_async(href, (dirents) => {
        for (let i = 0; i < dirents.length; i++) {
            if (dirents[i].is_dir) {
                rm_gio_files(dirents[i].href);
                ++rec;
                win.send(
                    "set_progress_msg",
                    `Getting Folder ${path.basename(dirents[i].href)}`
                );
                del_folder_arr.push(dirents[i].href);
            } else {
                win.send(
                    "set_progress_msg",
                    `Getting File ${path.basename(dirents[i].href)}`
                );
                del_file_arr.push(dirents[i]);
            }
        }

        --rec;
        if (rec === 0) {
            console.log("done", rec);

            del_file_arr.forEach((file, idx) => {
                gio.rm(file.href, (res) => {
                    win.send(
                        "set_progress_msg",
                        `Deleted File ${path.basename(file.href)}`
                    );
                    win.send("set_progress", del_file_arr.length - 1, idx);

                    if (isMainView) {
                        win.send("remove_card", file);
                    }
                });
            });

            del_folder_arr.sort((a, b) => {
                return b.length - a.length;
            });

            for (let i = 0; i < del_folder_arr.length; i++) {
                console.log("rm folder", del_folder_arr[i]);
                gio.rm(del_folder_arr[i], () => {});
                win.send(
                    "set_progress_msg",
                    `Deleted Folder ${path.basename(del_folder_arr[i])}`
                );
                win.send("set_progress", del_folder_arr.length - 1, i);
            }

            if (isMainView) {
                win.send(
                    "remove_card",
                    del_folder_arr[del_folder_arr.length - 1]
                );
            }

            del_file_arr = [];
            del_folder_arr = [];
            state = 0;
            rec = 1;

            setImmediate(callback);
        }
    });
}

let cp_file_arr = [];
let cp_folder_arr = [];
let cp_rec = 1;
let cp_state = 0;

async function cp_gio_files(source, destination, callback) {
    if (cp_state === 0) {
        cp_folder_arr.push(destination);
        cp_state = 1;
    }

    gio.get_dir(source, (dirents) => {
        for (let i = 0; i < dirents.length; i++) {
            if (dirents[i].is_dir) {
                cp_gio_files(
                    source + "/" + dirents[i].name,
                    destination + "/" + dirents[i].name
                );
                ++cp_rec;
                win.send(
                    "set_progress_msg",
                    `Getting Folder ${path.basename(dirents[i].href)}`
                );
                XW;
            } else {
                win.send(
                    "set_progress_msg",
                    `Getting File ${path.basename(dirents[i].href)}`
                );
                let cp_obj = {
                    source: dirents[i].href,
                    destination: destination + "/" + dirents[i].name,
                };
                cp_file_arr.push(cp_obj);
            }
        }

        --cp_rec;
        if (cp_rec === 0) {
            console.log("done", cp_rec);

            cp_folder_arr.sort((a, b) => {
                return a.length - b.length;
            });

            for (let i = 0; i < cp_folder_arr.length; i++) {
                console.log("cp folder", cp_folder_arr[i]);
                gio.mkdir(cp_folder_arr[i], () => {
                    win.send(
                        "set_progress_msg",
                        `Copied Folder ${path.basename(cp_folder_arr[i])}`
                    );
                    win.send("set_progress", cp_folder_arr.length - 1, i);
                });
            }

            cp_file_arr.forEach((file, idx) => {
                gio.cp(file.source, file.destination, () => {
                    win.send(
                        "set_progress_msg",
                        `Copied File ${path.basename(file.destination)}`
                    );
                    win.send("set_progress", cp_file_arr.length - 1, idx);
                });
            });
            cp_file_arr = [];
            cp_folder_arr = [];
            cp_state = 0;
            cp_rec = 1;
        }
    });
}

/**
 * Delete a file or folder from the filesystem
 * @param {string} href
 * @param {int} callback *
 */
async function delete_file(href, callback) {
    return new Promise((res) => {
        if (href !== null && !isGioFile(href)) {
            fs.stat(href, (err, stats) => {
                if (!err) {
                    /* Folder */
                    if (stats.isDirectory()) {
                        fs.rm(href, { recursive: true }, (err) => {
                            if (err) {
                                win.send("notification", err);
                                callback(err);
                                res(0);
                            } else {
                                try {
                                    windows.forEach((win) => {
                                        win.send("remove_card", href);
                                    });
                                } catch (err) {
                                    win.send("notification", err);
                                    win.send("notification", err);
                                }

                                // Update disk size
                                get_disk_space(
                                    { href: current_directory },
                                    (res) => {
                                        win.send("disk_space", res);
                                    }
                                );

                                callback(1);
                                res(1);
                            }
                        });
                        /* File */
                    } else {
                        fs.unlink(href, (err) => {
                            if (err) {
                                win.send("notification", err);
                                callback(err);
                                res(0);
                            } else {
                                try {
                                    win.send("remove_card", href);
                                } catch (err) {
                                    win.send("notification", err);
                                }

                                // Update disk size
                                get_disk_space(
                                { href: current_directory },
                                (res) => {
                                    win.send("disk_space", res);
                                });

                                // Update disk size
                                get_disk_space(
                                    { href: current_directory },
                                    (res) => {
                                        win.send("disk_space", res);
                                    }
                                );

                                callback(1);
                                res(1);
                            }
                        });
                    }
                } else {
                    if (href.indexOf("smb") > -1 || href.indexOf("sftp") > -1) {
                        gio.rm(href, () => {});
                        win.send("remove_card", href);
                    }
                }
            });
        } else {
            gio.get_file(href, (file) => {
                if (file.type == "directory") {
                    rm_gio_files(href, () => {
                        if (isMainView) {
                            win.send("remove_card", href);
                        }
                    });
                } else {
                    gio.rm(href, (res) => {
                        if (isMainView) {
                            win.send("remove_card", href);
                        }
                    });
                }
            });
        }
    });
}

/**
 *
 * @param {double} fileSizeInBytes
 * @returns String formated file size
 */
function get_file_size(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [" kB", " MB", " GB", " TB", "PB", "EB", "ZB", "YB"];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);
    return Math.max(fileSizeInBytes, 0.0).toFixed(1) + byteUnits[i];
}

/**
 * Copy string to the clipboard
 * @param {string} data
 */
function CopyToClipboard(data) {
    clipboard.writeText(data);
}

/**
 * Read clipboard
 * Return Clopboard
 */
function ReadClipboard() {
    return clipboard.readText();
}

/**
 * Clear Clipboard
 */
function ClearClipboard() {
    clipboard.clear();
}

/**
 * Create main window
 */
const createWindow = (exports.createWindow = () => {
    let displayToUse = 0;
    let lastActive = 0;
    let displays = screen.getAllDisplays();

    // Single Display
    if (displays.length === 1) {
        displayToUse = displays[0];
        // Multi Display
    } else {
        // if we have a last active window, use that display for the new window
        if (!displayToUse && lastActive) {
            displayToUse = screen.getDisplayMatching(lastActive.getBounds());
        }

        // fallback to primary display or first display
        if (!displayToUse) {
            displayToUse = screen.getPrimaryDisplay() || displays[3];
        }
    }

    if (settings.window.x == 0) {
        settings.window.x = displayToUse.bounds.x + 50;
    }

    if (settings.window.y == 0) {
        settings.window.y = displayToUse.bounds.y + 50;
    }

    // WINDOW OPTIONS
    let options = {
        minWidth: 400,
        minHeight: 600,
        width: settings.window.width,
        height: settings.window.height,
        backgroundColor: "#2e2c29",
        x: settings.window.x,
        y: settings.window.y,
        frame: true,
        autoHideMenuBar: true,
        icon: path.join(__dirname, "/assets/icons/folder.png"),
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: true,
            nativeWindowOpen: false,
            preload: path.join(__dirname, "preload.js"),
            sandbox: false,
            // offscreen: true
        },
    };

    let win = new BrowserWindow(options);
    // win.removeMenu()

    win.loadFile("src/index.html");

    win.once("ready-to-show", () => {
        win.show();
    });

    win.on("closed", () => {
        windows.delete(win);
        // win = null;
    });

    win.on("resize", (e) => {
        let intervalid = setInterval(() => {
            settings.window.width = win.getBounds().width;
            settings.window.height = win.getBounds().height;
            fs.writeFileSync(
                path.join(__dirname, "settings.json"),
                JSON.stringify(settings, null, 4)
            );
        }, 1000);
    });

    win.on("move", (e) => {
        settings.window.x = win.getBounds().x;
        settings.window.y = win.getBounds().y;

        fs.writeFileSync(
            path.join(__dirname, "settings.json"),
            JSON.stringify(settings, null, 4)
        );
    });

    windows.add(win);
});

app.whenReady().then(() => {
    createWindow();

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (details.responseHeaders["cache-control"] == null) {
            details.responseHeaders["cache-control"] = "max-age=3600";
        }
        callback({ cancel: false, responseHeaders: details.responseHeaders });
    });
});

nativeTheme.themeSource = "dark";

ipcMain.handle("dir_size", async (e, href) => {
    let cmd = "du -s '" + href + "' | awk '{print $1}'";
    const { err, stdout, stderr } = await exec(cmd);
    stdout.on("data", (res) => {
        return res.replace(".", "").trim();
    });
});

ipcMain.handle("dark-mode:system", () => {
    nativeTheme.themeSource = "system";
});

ipcMain.on("copy_to_clipboard", (a, data) => {
    CopyToClipboard(data);
});

ipcMain.on("read_clipboard", (a) => {
    ReadClipboard(data);
    // win.webContents
});

ipcMain.on("clear_clipboard", (a, data) => {});

// RELOAD WINDOW
ipcMain.on("reload", function (e) {
    win.loadFile("src/index.html");
});

// MAXAMIZE WINDOW
ipcMain.on("maximize", () => {
    win.maximize();
});

// MINIMIZE WINDOW
ipcMain.on("minimize", () => {
    win.minimize();
});

// CLOSE WINDOW
ipcMain.on("close", () => {
    // var win = BrowserWindow.getFocusedWindow();
    windows.delete(win);
    win.close();
});

// GO BACK
ipcMain.on("go_back", function (e, msg) {
    windows.forEach((win) => {
        win.webContents.goBack();
    });
});

ipcMain.on("go_foward", (e) => {
    win.webContents.goFoward();
});

// On get icon path
ipcMain.on("get_icon_path", (e, href) => {
    get_icon_path(href);
});

// Get icon path
function get_icon_path(href) {
    app.getFileIcon(href)
        .then((icon) => {
            icon_path = icon.toDataURL();
            let data = {
                href: href,
                icon_path: icon_path,
            };
            win.send("icon_path", data);
        })
        .catch((err) => {
            win.send("notification", err);
        });
}

ipcMain.handle("get_icon", async (e, href) => {
    try {
        const res = await app.getFileIcon(href);
        return res.toDataURL();
    } catch (err) {
        win.send("notification", err);
        return path.join(
            __dirname,
            "assets/icons/kora/actions/scalable/gtk-file.svg"
        );
    }
});

ipcMain.handle("get_thumbnail", async (e, href) => {
    const res = await nativeImage.createFromPath(href);
    return res;
});

// SHOW COPY CONFIRM OVERWRITE DIALOG
ipcMain.on("show_confirm_dialog", (e, data) => {
    e.preventDefault();
    createConfirmDialog(data);
});

// CONFIRM COPY OVERWRITE DIALOG
// let confirm = null
function createConfirmDialog(data, copy_files_arr) {
    let win = window.getFocusedWindow();

    let bounds = win.getBounds();

    let x = bounds.x + parseInt((bounds.width - 500) / 2);
    let y = bounds.y + parseInt((bounds.height - 400) / 2);

    const confirm = new BrowserWindow({
        parent: win,
        modal: true,
        width: 550,
        height: 400,
        backgroundColor: "#2e2c29",
        x: x,
        y: y,
        frame: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    // LOAD INDEX FILE
    confirm.loadFile("src/confirm.html");

    //
    confirm.once("ready-to-show", () => {
        if (fs.statSync(data.source).isDirectory()) {
            confirm.title = "Copy Folder Conflict";
        } else {
            confirm.title = "Copy File Conflict";
        }
        confirm.show();
        confirm.send("confirming_overwrite", data, copy_files_arr);
    });
}

// OVERWRITE COPY CONFIRMED ALL
ipcMain.on("overwrite_confirmed_all", (e, copy_files_arr) => {
    // HIDE WINDOW
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();

    // GET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach((item) => {
        max += parseInt(item.size);
    });

    // SHOW PROGRESS
    win.send("progress", max);

    // LOOP OVER COPY ARRAY
    copy_files_arr.forEach((data, idx) => {
        let source = data.href;
        let destination_file = path.join(active_folder, path.basename(source));

        // COPY DIRECTORY
        if (fs.statSync(source).isDirectory()) {
            copyfolder(source, destination_file, (res) => {});

            // COPY FILES - done
        } else {
            copyfile(source, destination_file, (res) => {});
        }
    });
});

// OVERWRITE COPY CONFIRMED
ipcMain.on("overwrite_confirmed", (e, data) => {
    let destination_file = path.join(active_folder, path.basename(data.source));

    // HIDE
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();

    // GET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach((item) => {
        max += parseInt(item.size);
    });

    // SHOW PROGRESS
    windows.forEach((win) => {
        win.webContents.send("progress", max);
    });

    // COPY FOLDER
    if (fs.statSync(data.source).isDirectory()) {
        copyfolder(data.source, destination_file, () => {
            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift();

            if (copy_files_arr.length > 0) {
                copy();
            }
        });

        // COPY FILE - done
    } else {
        copyfile(data.source, destination_file, () => {
            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift();

            if (copy_files_arr.length > 0) {
                copy();
            }
        });
    }
});

// Overwrite copy skip - needs work
ipcMain.on("overwrite_skip", (e) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();

    // REMOVE ITEM FROM ARRAY
    copy_files_arr.shift();

    if (copy_files_arr.length > 0) {
        data = {
            state: 0,
            source: copy_files_arr[0].source,
            destination: copy_files_arr[0].destination,
        };

        // RUN MAIN COPY FUNCTION
        copy();
    }
});

// OVERWRITE COPY CANCLED ALL - done
ipcMain.on("overwrite_canceled_all", (e) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();
    copy_files_arr = [];
});

// OVERWRITE COPY CANCLED - done
ipcMain.on("overwrite_canceled", (e) => {
    // HIDE
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();

    // REMOVE ITEM FROM ARRAY
    copy_files_arr.shift();

    if (copy_files_arr.length > 0) {
        // RUN MAIN COPY FUNCTION
        copy();
    }
});

// MOVE DIALOG
function createMoveDialog(data, copy_files_arr) {
    let bounds = win.getBounds();

    let x = bounds.x + parseInt((bounds.width - 550) / 2);
    let y = bounds.y + parseInt((bounds.height - 275) / 2);

    // DIALOG SETTINGS
    let confirm = new BrowserWindow({
        parent: window.getFocusedWindow(),
        modal: true,
        width: 550,
        height: 275,
        backgroundColor: "#2e2c29",
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    // LOAD FILE
    confirm.loadFile("src/confirm_move.html");

    // SHOW DIALG
    confirm.once("ready-to-show", () => {
        let title = "";
        if (fs.statSync(data.source).isDirectory()) {
            title = "Move Folder";
        } else {
            title = "Move File";
        }

        confirm.title = title;
        confirm.removeMenu();

        confirm.send("confirming_move", data, copy_files_arr);
    });
}

// MOVE
ipcMain.on("move", (e) => {
    move();
});

/**
 *
 * @returns
 */
function move() {
    console.log("running move");

    copy_files_arr.every((file, idx) => {
        let source = file.href;
        let destination = path.join(active_folder, path.basename(file.href));

        if (source !== destination) {
            // trap

            if (file.is_dir) {
                if (fs.existsSync(destination)) {
                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination,
                    };

                    createOverwriteMoveDialog(data);
                    return false;
                } else {
                    // SET SIZE FOR PROGRESS
                    let max = 0;
                    copy_files_arr.forEach((item) => {
                        max += parseInt(item.size);
                    });

                    // SHOW PROGRESS
                    windows.forEach((win) => {
                        win.webContents.send("progress", max);
                    });
                    copy_write(source, destination, () => {
                        delete_file(source, () => {
                            if (isMainView) {
                                let file_obj = {
                                    name: path.basename(destination),
                                    href: destination,
                                    is_dir: 1,
                                    ["time::modified"]: new Date() / 1000,
                                    size: 0,
                                };
                                win.send("get_card", file_obj);
                                win.send("update_card1", path.dirname(source));
                                win.send(
                                    "update_card1",
                                    path.dirname(destination)
                                );
                            }
                        });
                    });
                }
            } else {
                if (fs.existsSync(destination)) {
                    // CREATE CONFIRM COPY OVERWRITE
                    let data = {
                        source: source,
                        destination: destination,
                    };

                    createOverwriteMoveDialog(data);
                    return false;
                } else {
                    // SET SIZE FOR PROGRESS
                    let max = 0;
                    copy_files_arr.forEach((item) => {
                        max += parseInt(item.size);
                    });

                    // SHOW PROGRESS
                    windows.forEach((win) => {
                        win.webContents.send("progress", max);
                    });

                    copyfile(source, destination, (res) => {
                        if (res) {
                            win.send(
                                "set_progress_msg",
                                `Moved File ${path.basename(source)}`
                            );

                            delete_file(source, (res) => {
                                if (isMainView) {
                                    let file_obj = {
                                        name: path.basename(destination),
                                        href: destination,
                                        is_dir: 0,
                                        ["time::modified"]: new Date() / 1000,
                                        size: 0,
                                    };

                                    win.send("get_card", file_obj);
                                    win.send("update_card1", destination);
                                    win.send(
                                        "update_card1",
                                        path.dirname(source)
                                    );
                                    console.log(
                                        `updating card`,
                                        path.dirname(source)
                                    );
                                } else {
                                    win.send(
                                        "update_card1",
                                        path.dirname(destination)
                                    );
                                    console.log(
                                        `updating card`,
                                        path.dirname(destination)
                                    );
                                }
                            });
                        }
                    });
                }
            }
        } else {
            win.send("notification", "Error: Operation not Permitted!");
        }
        return true;
    });
}

// MOVE CONFIRMED - done
ipcMain.on("move_confirmed", (e, data) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();

    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach((item) => {
        max += parseInt(item.size);
    });

    // SHOW PROGRESS
    // let win = window.getFocusedWindow();
    windows.forEach((win) => {
        win.webContents.send("progress", max);
    });

    // DIRECTORY
    if (fs.statSync(data.source).isDirectory()) {
        // state = 0
        copyfolder(data.source, data.destination, data.state, () => {
            try {
                if (fs.existsSync(data.destination)) {
                    delete_file(data.source, () => {
                        // REMOVE ITEM FROM ARRAY
                        copy_files_arr.shift();

                        if (copy_files_arr.length > 0) {
                            move();
                        }

                        win.send("update_card", data.destination);
                    });
                }
            } catch (err) {
                console.log("copy folder recursive error", err);
            }
        });

        // FILES - done
    } else {
        // state = 0
        copyfile(data.source, data.destination, (res) => {
            // REMOVE ITEM FROM ARRAY
            copy_files_arr.shift();
            delete_file(data.source, (res) => {
                if (isMainView) {
                    let options = {
                        id: 0,
                        href: data.destination,
                        linktext: path.basename(data.destination),
                        is_folder: false,
                        grid: "",
                    };

                    win.webContents.send("add_card", options);
                    win.send("update_card1", data.destination);
                }

                move();
            });
        });
    }
});

// MOVE CONFIRMED ALL - done
ipcMain.on("move_confirmed_all", (e, data) => {
    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach((item) => {
        max += parseInt(item.size);
    });

    // SHOW PROGRESS
    win.send("progress", max);

    // COPY FILES
    copy_files_arr.forEach((file, idx) => {
        let destination_file = path.join(
            active_folder,
            path.basename(file.href)
        );
        // DIRECTORY
        if (file.is_dir) {
            copyfolder(file.href, destination_file, () => {
                if (fs.existsSync(destination_file)) {
                    delete_file(file.href, () => {
                        if (isMainView) {
                            win.send("get_card", file);
                        } else {
                            win.send("remove_card", file.href);
                            get_folder_size(active_folder);
                        }
                    });
                }
            });

            // FILES
        } else {
            // state = 0
            copyfile(file.href, destination_file, () => {
                if (fs.existsSync(destination_file)) {
                    delete_file(file.href, () => {
                        if (isMainView) {
                            win.send("get_card", file);
                        } else {
                            win.send("remove_card", file.href);
                            get_folder_size(active_folder);
                        }
                    });
                }
            });
        }
    });

    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();
});

// MOVE CANCELED - done
ipcMain.on("move_canceled", (e) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();

    if (copy_files_arr.length > 0) {
        // REMOVE ITEM FROM ARRAY
        copy_files_arr.shift();
        move();
    }
});

ipcMain.on("move_canceled_all", (e) => {
    let win = window.getFocusedWindow();
    win.hide();
    copy_files_arr = [];
});

// GET CONFIRM DIALOG
ipcMain.on("show_overwrite_move_dialog", (e, data) => {
    e.preventDefault();
    createOverwriteMoveDialog(data);
});

// CONFIRM OVERWRITE FOR MOVE DIALOG
function createOverwriteMoveDialog(data) {
    let bounds = win.getBounds();

    let x = bounds.x + parseInt((bounds.width - 550) / 2);
    let y = bounds.y + parseInt((bounds.height - 350) / 2);

    let confirm = new BrowserWindow({
        parent: window.getFocusedWindow(),
        modal: true,
        width: 550,
        height: 350,
        backgroundColor: "#2e2c29",
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    // LOAD FILE
    confirm.loadFile("src/overwritemove.html");

    // SHOE OVERWRITE MOVE DIALOG
    confirm.once("ready-to-show", () => {
        confirm.title = "Move File Conflict";
        confirm.removeMenu();
        confirm.show();
        confirm.send("confirming_overwrite_move", data);
    });
}

// OVERWRITE MOVE CONFIRMED ALL
ipcMain.on("overwrite_move_confirmed", (e, data) => {
    let confirm = window.getFocusedWindow();
    confirm.hide();

    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach((item) => {
        max += parseInt(item.size);
    });

    win.send("progress", max);

    let source = data.source;
    let destination_file = path.join(active_folder, path.basename(source));

    // DIRECTORY - todo: needs work
    if (fs.statSync(source).isDirectory()) {
        copyfolder(source, destination_file, (res) => {
            if (res) {
                delete_file(source, (res) => {
                    win.send("remove-card", source);
                });
                win.send("update_card", destination_file);
            }
        });

        // FILES - done
    } else {
        copyfile(source, destination_file, (res) => {
            if (res) {
                delete_file(source, () => {
                    win.send("remove-card", source);

                    // REMOVE ITEM FROM ARRAY
                    copy_files_arr.shift();

                    if (copy_files_arr.length > 0) {
                        move();
                    }
                });
            }

            win.send("update_card", destination_file);
        });
    }
});

// OVERWRITE MOVE CONFIRMED ALL
ipcMain.on("overwrite_move_confirmed_all", (e) => {
    let confirm = window.getFocusedWindow();
    confirm.hide();

    // SET SIZE FOR PROGRESS
    let max = 0;
    copy_files_arr.forEach((item) => {
        max += parseInt(item.size);
    });

    // SHOW PROGRESS
    win.send("progress", max);
    // COPY FILES
    copy_files_arr.forEach((file, idx) => {
        let destination_file = path.join(
            active_folder,
            path.basename(file.href)
        );

        // DIRECTORY - todo: needs work
        if (fs.statSync(file.href).isDirectory()) {
            copyfolder(file.href, destination_file, 0, () => {
                delete_file(file.href, () => {
                    win.send("remove-card", file.href);
                });
            });

            // FILES - done
        } else {
            copyfile(file.href, destination_file, () => {
                copy_files_arr.forEach((file) => {
                    delete_file(file.href, () => {
                        win.send("remove-card", file.href);
                    });
                });
            });
        }
    });
});

// OVERWRITE MOVE SKIP - done
ipcMain.on("overwrite_move_skip", (e) => {
    let confirm = window.getFocusedWindow();
    confirm.hide();

    // REMOVE ITEM FROM ARRAY
    copy_files_arr.shift();

    if (copy_files_arr.length > 0) {
        move();
    }
});

// OVERWRITE MOVE CANCELED ALL - done
ipcMain.on("overwrite_move_canceled_all", (e) => {
    let confirm = window.getFocusedWindow();
    confirm.hide();
    copy_files_arr = [];
});

// OVERWRITE CANCELED - done
ipcMain.on("overwrite_move_canceled", (e) => {
    let confirm = window.getFocusedWindow();
    confirm.hide();
    copy_files_arr = [];
});

ipcMain.handle("get_recent_files", (e, href) => {
    return getRecentFiles(href, 50);
});

function getRecentFiles(dirPath, numFiles) {
    const files = fs
        .readdirSync(dirPath)
        .map((file) => {
            const filePath = `${dirPath}/${file}`;
            const stats = fs.statSync(filePath);
            return {
                name: file,
                path: filePath,
                time: stats.ctime.getTime(),
            };
        })
        .sort((a, b) => b.time - a.time)
        .slice(0, numFiles)
        .map((file) => file.path);
    return files;
}

// Create Delete Dialog
function createDeleteDialog(delete_files_arr) {
    let bounds = win.getBounds();

    let x = bounds.x + parseInt((bounds.width - 400) / 2);
    let y = bounds.y + parseInt((bounds.height - 250) / 2);

    // DIALOG SETTINGS
    let confirm = new BrowserWindow({
        parent: window.getFocusedWindow(),
        modal: true,
        width: 550,
        height: 300,
        backgroundColor: "#2e2c29",
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });
    // LOAD FILE
    confirm.loadFile("src/confirm_delete.html");

    // SHOW DIALOG
    confirm.once("ready-to-show", () => {
        confirm.title = "Confirm Delete";
        confirm.removeMenu();

        confirm.send("confirm_delete", delete_files_arr);
        delete_files_arr = [];
    });
}

ipcMain.on("delete_confirmed", async (e, delete_files_arr) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();
    delete_files_arr.forEach((item) => {
        delete_file(item.source).then((res) => {
            if (res === 1) {
                e.sender.send("refresh");
            }
        });
    });
});

ipcMain.on("delete_canceled", (e) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();
});

// FILE PROPERTIES WINDOW
function create_properties_window(filename) {
    let bounds = screen.getPrimaryDisplay().bounds;
    let x = bounds.x + (bounds.width - 400) / 2;
    let y = bounds.y + (bounds.height - 400) / 2;

    const win = new BrowserWindow({
        width: 500,
        height: 500,
        backgroundColor: "#2e2c29",
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    win.once("ready-to-show", () => {
        win.title = path.basename(filename);
        win.show();

        let stats = fs.statSync(filename);

        cmd = "xdg-mime query filetype '" + filename + "'";
        let exec_mime = execSync(cmd).toString();

        // BUILD PROPERTIES
        let name = path.basename(filename);
        let parent_folder = path.basename(path.dirname(filename));
        let type = exec_mime;
        let contents = "0 items, totalling 0 MB";
        let size = "";
        let accessed = new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(stats.atime);
        let created = new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(stats.birthtime);
        let modified = new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(stats.mtime);

        if (type === true) {
            size = "";
        } else {
            size = get_file_size(stats.size);
        }

        let file_properties = {
            Name: name,
            Parent: parent_folder,
            Type: type,
            Contents: contents,
            Size: size,
            Accessed: accessed,
            Modified: modified,
            Created: created,
        };

        win.send("file_properties", file_properties);
    });

    // CLOSE WINDOW
    ipcMain.on("close_properties_window", () => {
        var window = BrowserWindow.getFocusedWindow();
        windows.delete(win);
        window.close();
    });

    windows.add(win);
}

ipcMain.on("get_image_properties", (e) => {});

// GET FILE PROPERTIES
ipcMain.on("get_file_properties", (e, file_properties_arr) => {
    file_properties_arr.forEach((filename) => {
        get_file_properties(filename);
    });
});

// GET DEVICES USING GIO COMMAND LINE UTILITY
ipcMain.on("get_gio_devices", (e) => {
    let output = "";

    // GET GIO LIST
    let cmd = "gio mount --list -i";
    let gio_device = exec(cmd);

    // GET DATA FROM COMMAND
    gio_device.stdout.setEncoding("utf8");
    gio_device.stdout.on("data", (data) => {
        output = output + data;
    });

    gio_device.stderr.on("data", function (res) {
        e.sender.send("gio_devices", res);
    });

    gio_device.on("exit", (data) => {
        e.sender.send("gio_devices", output);
    });
});

// MOUNT GIO DEVICE
ipcMain.on("mount_gio", (e, data) => {
    let uuid = data.uuid;
    let cmd = "gio mount " + uuid;
    let mount_gio = exec(cmd);

    mount_gio.stdout.on("data", (res) => {
        e.sender.send("gio_mounted", res);
    });

    mount_gio.stderr.on("data", (res) => {
        e.sender.send("gio_mounted", res);
    });

    mount_gio.on("exit", (code) => {});
});

// MONITOR GIO DEVICES
ipcMain.on("monitor_gio", (e, data) => {
    let cmd = "gio mount -o";
    let monitor_gio = exec(cmd);

    //
    monitor_gio.stdout.on("data", (res) => {
        e.sender.send("gio_monitor", res);
    });

    monitor_gio.stderr.on("data", (res) => {
        e.sender.send("gio_monitor", res);
    });
});

// LIST FILES USING GIO
ipcMain.on("get_gio_files", (e, data) => {
    let files = exec("gio list " + data);

    // STDOUT
    files.stdout.on("data", (res) => {
        e.sender.send("gio_files", { res, data });
    });

    // S
    files.stderr.on("data", (data) => {
        e.sender.send("gio_files", data);
    });
});

// GET GZIP SIZE
ipcMain.on("get_uncompressed_size", (e, filename) => {
    // RUN GZIP -L TO GET FILE SIZE. ONLY WORKS ON GZIPED FILES
    let cmd = "gzip -l '" + filename + "' | awk 'FNR==2{print $2}'";
    let size = 0;

    try {
        size = execSync(cmd);
    } catch (err) {}

    e.sender.send("uncompressed_size", size);
});

// GET FILES
ipcMain.on("get_files", (e, dir) => {
    fs.readdir(dir, (err, dirents) => {
        e.sender.send("files", dirents);
    });
});

// GNOME-DISKS
ipcMain.on("gnome_disks", (e, args) => {
    let cmd = "gnome-disks";
    exec(cmd);
});

// DISK USAGE ANAYLIZER
ipcMain.on("dua", (e, args) => {
    let cmd = 'baobab "' + args.dir + '"';
    exec(cmd);
});

// GET FILE SIZE. todo: this is just formating and the name needs to change
ipcMain.on("get_file_size", (e, args) => {
    e.sender.send("file_size", { href: args.href, size: args.size });
});

// GET FOLDER SIZE
ipcMain.on("get_folder_size", (e, args) => {
    get_folder_size(args.href);
});

// GET FOLDER SIZE
ipcMain.handle("get_folder_size1", async (e, href) => {
    try {
        cmd = "cd '" + href.replace("'", "''") + "'; du -Hs";
        const { err, stdout, stderr } = await exec1(cmd);
        return stdout;
    } catch (err) {
        return 0;
    }
});

// GET DISK SPACE
// CREATE DF ARRAY
ipcMain.on("get_disk_space", (e, href) => {
    get_disk_space(href, (res) => {
        win.send("disk_space", res);
    });
});

// GET DISK SPACE SUMMARY
ipcMain.on("get_diskspace_summary", (e) => {
    get_diskspace_summary();
});

// CREATE CHILD WINDOW
function createChildWindow() {
    chileWindow = new BrowserWindow({
        minWidth: 1024,
        minHeight: 600,
        width: 1600,
        height: 768,
        backgroundColor: "#2e2c29",
        x: displayToUse.bounds.x + 50,
        y: displayToUse.bounds.y + 50,
        frame: false,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    // LOAD INDEX FILE
    chileWindow.loadFile("src/index.html");
}

process.on("uncaughtException", function (err) {
    //   active_window.send('notification', err);
});

/* Header Menu */
const template = [
    {
        label: "File",
        submenu: [
            {
                label: "New Window",
                click: () => {
                    win.send("context-menu-command", "open_in_new_window");
                },
            },
            { type: "separator" },
            {
                label: "Create New Folder",
                click: () => {
                    win.send("new_folder");
                },
            },
            { type: "separator" },
            {
                label: "Connect to Server",
                click: () => {
                    createConnectDialog();
                },
            },
            { type: "separator" },
            { role: "Close" },
        ],
    },
    {
        label: "Edit",
        submenu: [
            {
                role: "copy",
                click: () => {
                    win.sender.send("copy");
                },
            },
        ],
    },
    {
        label: "View",
        submenu: [
            {
                label: "Disk Usage Summary",
                click: () => {
                    win.send("get_disk_summary_view");
                    // get_diskspace_summary();
                },
            },
            { type: "separator" },
            {
                label: "Sort",
                submenu: [
                    {
                        label: "Date",
                        click: () => {
                            win.send("sort", "date");
                        },
                    },
                    {
                        label: "Name",
                        click: () => {
                            win.send("sort", "size");
                        },
                    },
                    {
                        label: "Size",
                        click: () => {
                            win.send("sort", "name");
                        },
                    },
                    {
                        label: "Type",
                        click: () => {
                            win.send("sort", "type");
                        },
                    },
                ],
            },
            {
                type: "separator",
            },
            {
                label: "Toggle theme",
                click: () => {
                    if (nativeTheme.shouldUseDarkColors) {
                        nativeTheme.themeSource = "light";
                    } else {
                        nativeTheme.themeSource = "dark";
                    }
                },
            },
            { role: "toggleDevTools" },
            { type: "separator" },
            { type: "separator" },
            {
                label: "Appearance",
                role: "viewMenu",
            },
            { type: "separator" },
            { role: "reload" },
        ],
    },
    {
        label: "Help",
        submenu: [
            {
                label: "About",
            },
        ],
    },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// TEMPLATE MENU
function add_templates_menu(menu, e, args) {
    let template_menu = menu.getMenuItemById("templates");

    let templates = fs.readdirSync(path.join(__dirname, "assets/templates"));
    templates.forEach((file, idx) => {
        template_menu.submenu.append(
            new MenuItem({
                label: file.replace(path.extname(file), ""),
                click: () => {
                    e.sender.send("create_file_from_template", {
                        file: `${formatDate()} ${file}`,
                    });
                },
            })
        );
    });
}

// LAUNCHER MENU
let launcher_menu;

function add_launcher_menu(menu, e, args) {
    launcher_menu = menu.getMenuItemById("launchers");

    try {
        for (let i = 0; i < args.length; i++) {
            launcher_menu.submenu.append(
                new MenuItem({
                    label: args[i].name,
                    click: () => {
                        e.sender.send(
                            "context-menu-command",
                            "open_with",
                            args[i].exec
                        );
                        let cmd =
                            "xdg-mime default " +
                            args[i].desktop +
                            " " +
                            args[i].mimetype;
                        execSync(cmd);
                    },
                })
            );
        }
    } catch (err) {}
}

// Run as Program
function add_execute_menu(menu, e, args) {
    menu.append(
        new MenuItem({
            label: "Run as Program",
            click: () => {
                exec1(args.href);
            },
        })
    );
}

// Run as Program
function add_convert_audio_menu(menu, href) {
    menu.append(
        new MenuItem({
            label: "Audio / Video",
            submenu: [
                {
                    label: "Convert to Mp3",
                    click: () => {
                        let filename =
                            href.substring(
                                0,
                                href.length - path.extname(href).length
                            ) + ".mp3";
                        let cmd = "ffmpeg -i " + href + " " + filename;
                        exec(cmd, (err, stdout, stderr) => {
                            if (err) {
                                win.send("notification", err);
                            } else {
                                let options = {
                                    id: 0,
                                    href: filename,
                                    linktext: path.basename(filename),
                                    is_folder: false,
                                    grid: "",
                                };
                                win.send("add_card", options);
                            }
                        });

                        cmd =
                            "ffprobe -i " +
                            href +
                            ' -show_entries format=size -v quiet -of csv="p=0"';
                        exec(cmd, (err, stdout, stderr) => {
                            if (err) {
                                win.send("notification", err);
                            } else {
                                win.send("progress", parseInt(stdout));
                            }
                        });
                    },
                },
                {
                    label: "Convert to Ogg Vorbis",
                    click: () => {
                        let filename =
                            href.substring(
                                0,
                                href.length - path.extname(href).length
                            ) + ".ogg";
                        let cmd =
                            "ffmpeg -i " +
                            href +
                            " -c:a libvorbis -q:a 4 " +
                            filename;

                        exec(cmd, (err, stdout, stderr) => {
                            if (err) {
                                win.send("notification", err);
                            } else {
                                let options = {
                                    id: 0,
                                    href: filename,
                                    linktext: path.basename(filename),
                                    is_folder: false,
                                    grid: "",
                                };
                                win.send("add_card", options);
                            }
                        });

                        cmd =
                            "ffprobe -i " +
                            href +
                            ' -show_entries format=size -v quiet -of csv="p=0"';
                        exec(cmd, (err, stdout, stderr) => {
                            if (err) {
                                win.send("notification", err);
                            } else {
                                win.send("progress", parseInt(stdout));
                            }
                        });
                    },
                },
            ],
        })
    );
}

// Compress Menu
function extract_menu(menu, e) {
    let menu_item = new MenuItem({
        label: "&Extract",
        accelerator:
            settings.keyboard_shortcuts.Extract,
        click: () => {
            e.sender.send("context-menu-command", "extract_here");
        },
    });

    menu.insert(15, menu_item);
}

// Scripts Menu
function add_scripts_menu(menu, e, args) {
    let scripts_menu = menu.getMenuItemById("scripts");

    let templates = fs.readdirSync(path.join(__dirname, "assets/scripts"));
    templates.forEach((file, idx) => {
        template_menu.submenu.append(
            new MenuItem({
                label: file.replace(path.extname(file), ""),
                click: () => {
                    e.sender.send("create_file_from_template", { file: file });
                },
            })
        );
    });
}

// Find Context Menu
ipcMain.on("context-menu-find", (e, args) => {
    let stats = fs.statSync(args);

    if (stats.isDirectory()) {
        find_menu_template = [
            {
                label: "Open location",
                click: () => {
                    win.send("get_view", path.dirname(args));
                },
            },
            {
                type: "separator",
            },
        ];
    } else {
        find_menu_template = [
            {
                label: "Open location",
                click: () => {
                    win.send("get_view", path.dirname(args));
                },
            },
            {
                type: "separator",
            },
            {
                id: "launchers",
                label: "Open with",
                click: () => {
                    e.sender.send("open_with");
                },
                submenu: [],
            },
            {
                type: "separator",
            },
            {
                label: "Add to workspace",
                accelerator:
                    settings.keyboard_shortcuts.AddWorkspace,
                click: () => {
                    e.sender.send("add_workspace");
                },
            },
            {
                type: "separator",
            },
            {
                label: "Cut",
                accelerator:
                    settings.keyboard_shortcuts.Cut,
                click: () => {
                    e.sender.send("context-menu-command", "cut");
                },
            },
            {
                label: "Copy",
                accelerator:
                    settings.keyboard_shortcuts.Copy,
                click: () => {
                    e.sender.send("context-menu-command", "copy");
                },
            },
            {
                label: "&Rename",
                accelerator:
                    settings.keyboard_shortcuts.Rename,
                click: () => {
                    e.sender.send("context-menu-command", "rename");
                },
            },
            {
                type: "separator",
            },
            {
                type: "separator",
            },
            {
                label: "Delete file",
                accelerator:
                    settings.keyboard_shortcuts.Delete,
                click: () => {
                    e.sender.send("context-menu-command", "delete");
                },
            },
            {
                type: "separator",
            },
            {
                label: "Properties",
                accelerator:
                    settings.keyboard_shortcuts.Properties,
                click: () => {
                    e.sender.send("context-menu-command", "props");
                },
            },
        ];
    }

    let menu = Menu.buildFromTemplate(find_menu_template);
    menu.popup(BrowserWindow.fromWebContents(e.sender));
});

// Devices Menu
ipcMain.on("show-context-menu-devices", (e, args) => {
    device_menu_template = [
        {
            label: "Connect",
            click: () => {
                createConnectDialog();
            },
        },
    ];

    let menu = Menu.buildFromTemplate(device_menu_template);
    menu.popup(BrowserWindow.fromWebContents(e.sender));
});

// Workspace Menu
ipcMain.on("show-context-menu-workspace", (e, file) => {
    let workspace_menu_template = [
        {
            label: "Open Location",
            click: () => {
                win.send("get_view", path.dirname(file.href));
            },
        },
    ];

    let menu = Menu.buildFromTemplate(workspace_menu_template);

    // ADD TEMPLATES
    add_templates_menu(menu, e, args);

    // ADD LAUNCHER MENU
    add_launcher_menu(menu, e, args.apps);

    menu.popup(BrowserWindow.fromWebContents(e.sender));

    menu.on("menu-will-close", () => {
        win.send("clear_items");
    });
});

// MAIN MENU
ipcMain.on("show-context-menu", (e, options) => {
    const template = [
        {
            label: "New Window",
            click: () => {
                e.sender.send("context-menu-command", "open_in_new_window");
            },
        },
        {
            type: "separator",
        },
        {
            label: "New Folder",
            accelerator:
                settings.keyboard_shortcuts.NewFolder,
            click: () => {
                e.sender.send("context-menu-command", "new_folder");
            },
        },
        {
            id: "templates",
            label: "New Document",
            submenu: [
                {
                    label: "Open Templates Folder",
                    click: () => {
                        e.sender.send(
                            "context-menu-command",
                            "open_templates_folder"
                        ),
                            {
                                type: "separator",
                            };
                    },
                },
            ],
        },
        {
            type: "separator",
        },
        {
            label: "Sort",
            submenu: [
                {
                    label: "Date",
                    click: () => {
                        win.send("sort", "date");
                    },
                },
                {
                    label: "Name",
                    click: () => {
                        win.send("sort", "name");
                    },
                },
                {
                    label: "Size",
                    click: () => {
                        win.send("sort", "size");
                    },
                },
                {
                    label: "Type",
                    click: () => {
                        win.send("sort", "type");
                    },
                },
            ],
        },
        {
            type: "separator",
        },
        {
            label: "Paste",
            accelerator:
                settings.keyboard_shortcuts.Paste,
            click: () => {
                e.sender.send("context-menu-command", "paste");
            },
        },
        {
            label: "Select all",
            click: () => {
                e.sender.send("select_all");
            },
        },
        {
            type: "separator",
        },
        {
            label: "Terminal",
            click: () => {
                e.sender.send("context-menu-command", "open_terminal");
            },
        },
        {
            type: "separator",
        },
        {
            type: "separator",
        },
        {
            label: "Show Hidden",
            type: "checkbox",
            click: () => {
                e.sender.send("context-menu-command", "show_hidden");
            },
        },
        {
            type: "separator",
        },
        {
            label: "Git Branch:",
            submenu: [],
        },
    ];

    // CALL BUILD TEMPLATE. CREATE NEW FILES
    let menu = Menu.buildFromTemplate(template);
    getGitBranchList(current_directory).then((branchList) => {
        console.log(branchList);
        // ADD TEMPLATES
        add_templates_menu(menu, e, options);
        // SHOW MENU
        menu.popup(BrowserWindow.fromWebContents(e.sender));
    });
});

// FOLDERS MENU
ipcMain.on("show-context-menu-directory", (e, args) => {
    const template1 = [
        {
            label: "New Window",
            click: () => {
                e.sender.send("context-menu-command", "open_in_new_window");
            },
        },
        {
            type: "separator",
        },
        {
            label: "Sort",
            submenu: [
                {
                    label: "Date",
                    click: () => {
                        win.send("sort", "date");
                    },
                },
                {
                    label: "Name",
                    click: () => {
                        win.send("sort", "name");
                    },
                },
                {
                    label: "Size",
                    click: () => {
                        win.send("sort", "size");
                    },
                },
                {
                    label: "Type",
                    click: () => {
                        win.send("sort", "type");
                    },
                },
            ],
        },
        {
            type: "separator",
        },
        {
            label: "New Folder",
            accelerator:
                settings.keyboard_shortcuts.NewFolder,
            click: () => {
                e.sender.send("context-menu-command", "new_folder");
            },
        },
        {
            id: "templates",
            label: "New Document",
            submenu: [
                {
                    label: "Open Templates Folder",
                    click: () => {
                        e.sender.send(
                            "context-menu-command",
                            "open_templates_folder"
                        ),
                            {
                                type: "separator",
                            };
                    },
                },
            ],
        },
        {
            type: "separator",
        },
        {
            label: "Cut",
            accelerator:
                settings.keyboard_shortcuts.Cut,
            click: () => {
                e.sender.send("context-menu-command", "cut");
            },
        },
        {
            label: "Copy",
            accelerator:
                settings.keyboard_shortcuts.Copy,
            click: () => {
                e.sender.send("context-menu-command", "copy");
            },
        },
        {
            label: "Paste",
            accelerator:
                settings.keyboard_shortcuts.Paste,
            click: () => {
                e.sender.send("context-menu-command", "paste");
            },
        },
        {
            label: "&Rename",
            accelerator:
                settings.keyboard_shortcuts.Rename,
            click: () => {
                e.sender.send("context-menu-command", "rename");
            },
        },
        {
            type: "separator",
        },
        {
            label: "Delete",
            accelerator:
                settings.keyboard_shortcuts.Delete,
            click: () => {
                e.sender.send("context-menu-command", "delete");
            },
        },
        {
            type: "separator",
        }
    ];

    const menu1 = Menu.buildFromTemplate(template1);

    // ADD TEMPLATES
    add_templates_menu(menu1, e, args[0]);

    // ADD LAUNCHER MENU
    add_launcher_menu(menu1, e, args);
    menu1.popup(BrowserWindow.fromWebContents(e.sender));
});

// FILES MENU
let files_menu_template = [];
ipcMain.on("show-context-menu-files", (e, args) => {
    files_menu_template = [
        {
            label: "Sort",
            submenu: [
                {
                    label: "Date",
                    click: () => {
                        win.send("sort", "date");
                    },
                },
                {
                    label: "Name",
                    click: () => {
                        win.send("sort", "name");
                    },
                },
                {
                    label: "Size",
                    click: () => {
                        win.send("sort", "size");
                    },
                },
                {
                    label: "Type",
                    click: () => {
                        win.send("sort", "type");
                    },
                },
            ],
        },
        {
            type: "separator",
        },
        {
            label: "Cut",
            accelerator:
                settings.keyboard_shortcuts.Cut,
            click: () => {
                e.sender.send("context-menu-command", "cut");
            },
        },
        {
            label: "Copy",
            accelerator:
                settings.keyboard_shortcuts.Copy,
            click: () => {
                e.sender.send("context-menu-command", "copy");
            },
        },
        {
            label: "&Rename",
            accelerator:
                settings.keyboard_shortcuts.Rename,
            click: () => {
                e.sender.send("context-menu-command", "rename");
            },
        },
        {
            type: "separator",
        },
        {
            id: "templates",
            label: "New Document",
            submenu: [
                {
                    label: "Open Templates Folder",
                    click: () => {
                        e.sender.send(
                            "context-menu-command",
                            "open_templates_folder"
                        ),
                            {
                                type: "separator",
                            };
                    },
                },
            ],
        },
        {
            label: "&New Folder",
            accelerator:
                settings.keyboard_shortcuts.NewFolder,
            click: () => {
                e.sender.send("context-menu-command", "new_folder");
            },
        },
        {
            type: "separator",
        },
        {
            label: "Delete file",
            accelerator:
                settings.keyboard_shortcuts.Delete,
            click: () => {
                e.sender.send("context-menu-command", "delete");
            },
        },
        {
            type: "separator",
        },
        {
            id: "vcs",
            label: "Git",
            submenu: [],
        },
    ];

    let menu = Menu.buildFromTemplate(files_menu_template);

    getGitStatus(args.href, false).then((fileStatus) => {
        console.log(fileStatus);

        let gitMenuList = [];
        if (fileStatus === 0) {
            // git rm --cached
            gitMenuList.push({
                label: "Git: Untrack",
                click: () => {
                    runGitCommand(args.href, "git rm --cached", e);
                },
            });
            // git rm
            gitMenuList.push({
                label: "Git: Delete",
                click: () => {
                    runGitCommand(args.href, "git rm", e);
                },
            });
            // git mv
            gitMenuList.push({
                label: "Git: Rename",
                click: () => {
                    gitRenameDialog(args.href);
                },
            });
        } else if (fileStatus === 1) {
            // git add
            gitMenuList.push({
                label: "Git: Add to Stage",
                click: () => {
                    runGitCommand(args.href, "git add", e);
                },
            });
        } else if (fileStatus === 2) {
            // git add
            gitMenuList.push({
                label: "Git: Add to Stage",
                click: () => {
                    runGitCommand(args.href, "git add", e);
                },
            });
            // git restore
            gitMenuList.push({
                label: "Git: Undo Modification",
                click: () => {
                    runGitCommand(args.href, "git restore", e);
                },
            });
        } else if (fileStatus === 3) {
            // git restore --staged
            gitMenuList.push({
                label: "Git: Unstage",
                click: () => {
                    runGitCommand(args.href, "git rm --cached", e);
                },
            });
        }

        gitMenuList.forEach((gitMenuItem) => {
            menu.getMenuItemById("vcs").submenu.append(
                new MenuItem(gitMenuItem)
            );
        });

        // ADD TEMPLATES
        add_templates_menu(menu, e, args);

        // ADD LAUNCHER MENU
        add_launcher_menu(menu, e, args.apps);

        // Run as program
        if (args.access) {
            add_execute_menu(menu, e, args);
        }

        let ext = path.extname(args.href);
        if (ext === ".mp4" || ext === ".mp3") {
            add_convert_audio_menu(menu, args.href);
        }

        if (
            ext === ".xz" ||
            ext === ".gz" ||
            ext === ".zip" ||
            ext === ".img" ||
            ext === ".tar"
        ) {
            extract_menu(menu, e, args);
        }

        menu.popup(BrowserWindow.fromWebContents(e.sender));
    });
});

// CREATE WINDOW
ipcMain.on("new_window", function (e, args) {
    createWindow();
});

// GET HOME FOLDER
ipcMain.on("get_home_folder", function (e) {
    e.sender.send("home_folder", app.getPath("home"));
});

// FIND ON PAGE
ipcMain.on("find", function (e, args) {});

// GET HOME FOLDER
ipcMain.on("get_home_folder", function (e) {
    e.sender.send("home_folder", app.getPath("home"));
});

// FIND ON PAGE
ipcMain.on("find", function (e, args) {});

// CONFIRM DELETE FILES DIALOG
ipcMain.on("confirm_file_delete", function (e, delete_arr) {
    createDeleteDialog(delete_arr);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

ipcMain.on("quit", () => {
    app.quit();
});

const getGitStatus = (filePath, isDirectory) => {
    return new Promise((resolve) => {
        let filePathBase = path.basename(filePath).replaceAll(" ", "\\ ");
        let filePathDir = path.dirname(filePath).replaceAll(" ", "\\ ");
        let cmd = `cd ${filePathDir} && git status -s ${
            isDirectory ? filePathDir : filePathBase
        }`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.log(`Error: ${error.message}`);
                resolve(-1);
            }
            if (stderr) {
                console.log(`Stderr: ${stderr}`);
                resolve(-1);
            }

            if(stdout[1] === "M" || stdout[1] === "T" || stdout[1] === "A"
                || stdout[1] === "D" || stdout[1] === "R" || stdout[1] === "C" || stdout[1] === "U"){
                // Modified File
                resolve(2);
            }else if(stdout[0] === "M" || stdout[0] === "T" || stdout[0] === "A"
                || stdout[0] === "D" || stdout[0] === "R" || stdout[0] === "C" || stdout[0] === "U"){
                // Staged File
                resolve(3);
            }else if(stdout[0] === "?") {
                // Untracked File
                resolve(1);
            } else {
                // Unmodified / Committed File
                resolve(0);
            }
        });
    });
};

const runGitCommand = (filePath, gitCmd, e) => {
    let filePathDir = path.dirname(filePath).replaceAll(' ', '\\ ');
    filePath = filePath.replaceAll(" ", "\\ ");
    let cmd = `cd ${filePathDir} && ${gitCmd} ${filePath}`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.log(`Error: ${error.message}`);
            resolve(-1);
        }
        if (stderr) {
            console.log(`Stderr: ${stderr}`);
            resolve(-1);
        }
        e.sender.send("refresh");
        resolve(1);
    });
};

const gitRenameDialog = (filePath) => {
    let bounds = win.getBounds();

    let x = bounds.x + parseInt((bounds.width - 400) / 2);
    let y = bounds.y + parseInt((bounds.height - 250) / 2);

    // DIALOG SETTINGS
    let confirm = new BrowserWindow({
        parent: window.getFocusedWindow(),
        modal: true,
        width: 550,
        height: 200,
        backgroundColor: "#2e2c29",
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });
    // LOAD FILE
    confirm.loadFile("src/git_rename_dialog.html");

    // SHOW DIALG
    confirm.once("ready-to-show", () => {
        let title = "Confirm Rename";
        confirm.title = title;
        confirm.removeMenu();

        confirm.send("confirm_git_rename", filePath);
    });
};

ipcMain.on("git_rename_confirmed", (e, filePath, rename_input_str) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();

    let filePathDir = path.dirname(filePath).replaceAll(" ", "\\ ");
    filePath = filePath.replaceAll(" ", "\\ ");
    let cmd = `cd ${filePathDir} && git mv ${filePath} ${rename_input_str}`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.log(`Error: ${error.message}`);
            resolve(-1);
        }
        if (stderr) {
            console.log(`Stderr: ${stderr}`);
            resolve(-1);
        }
        BrowserWindow.getFocusedWindow().send("refresh");
    });
});

ipcMain.on("git_rename_canceled", (e) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();
});

function gitInitialize(dirPath, e) {
    let cmd = `cd ${dirPath} && git init`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`${error}`);
            return;
        }
        if (stderr) {
            console.error(`${stderr}`);
            return;
        }
        console.log(stdout);
        e.sender.send("refresh");
    });
}

ipcMain.on("git_init", (e) => {
    dirPath = current_directory.replaceAll(" ", "\\ ");
    let checkGitRepo = `cd ${dirPath} && ls -a | grep -w .git | wc -l`;
    exec(checkGitRepo, (error, stdout, stderr) => {
        if (error) {
            console.error(`${error}`);
            return;
        }
        if (stderr) {
            console.error(`${stderr}`);
            return;
        }

        if (stdout.trim() === "0") {
            gitInitialize(dirPath, e);
        }
    });
});

ipcMain.on("git_commit", (e) => {
    dirPath = current_directory.replaceAll(" ", "\\ ");
    let checkGitRepo = `cd ${dirPath} && git status -s`;
    exec(checkGitRepo, (error, stdout, stderr) => {
        if (error) {
            console.error(`${error}`);
            return;
        }
        if (stderr) {
            console.error(`${stderr}`);
            return;
        }

        if (stdout[0] === "M" || stdout[0] === "T" || stdout[0] === "A"
            || stdout[0] === "D" || stdout[0] === "R" || stdout[0] === "C" || stdout[0] === "U") {
            gitCommitDialog(current_directory);
        }
    });
});

const gitCommitDialog = (filePath) => {
    let bounds = win.getBounds();

    let x = bounds.x + parseInt((bounds.width - 400) / 2);
    let y = bounds.y + parseInt((bounds.height - 250) / 2);

    // DIALOG SETTINGS
    let confirm = new BrowserWindow({
        parent: window.getFocusedWindow(),
        modal: true,
        width: 550,
        height: 200,
        backgroundColor: "#2e2c29",
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: true, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, "preload.js"),
        },
    });
    // LOAD FILE
    confirm.loadFile("src/git_commit_dialog.html");

    // SHOW DIALG
    confirm.once("ready-to-show", () => {
        let title = "Commit Changed";
        confirm.title = title;
        confirm.removeMenu();

        confirm.send("confirm_git_commit", filePath);
    });
};

ipcMain.on("git_commit_confirmed", (e, filePath, commit_message_input_str) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();

    filePath = filePath.replaceAll(" ", "\\ ");
    let cmd = `cd ${filePath} && git commit -m \"${commit_message_input_str}\"`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.log(`Error: ${error.message}`);
            resolve(-1);
        }
        if (stderr) {
            console.log(`Stderr: ${stderr}`);
            resolve(-1);
        }
        BrowserWindow.getFocusedWindow().send("refresh");
    });
});

ipcMain.on("git_commit_canceled", (e) => {
    let confirm = BrowserWindow.getFocusedWindow();
    confirm.hide();
});

const getGitBranchList = (filePath) => {
    console.log(filePath);
    return new Promise((resolve) => {
        let filePathDir = filePath.replaceAll(" ", "\\ ");
        let cmd = `cd ${filePathDir} && git branch -a`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.log(`Error: ${error.message}`);
                resolve(-1);
            }
            if (stderr) {
                console.log(`Stderr: ${stderr}`);
                resolve(-1);
            }

            branchList = stdout.split("\n");
            for(let i = 0; i < branchList.length; i++){
                branchList[i] = branchList[i].trim();
                if(branchList[i][0] === "*"){
                    branchList.splice(branchList.indexOf(branchList[i]), 1);
                    i--;
                }else if(branchList[i] === ""){
                    branchList.splice(branchList.indexOf(branchList[i]), 1);
                    i--;
                }
            }
            console.log(branchList);
            resolve(branchList);
        });
    });
};