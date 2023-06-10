/*
    todo: System and fs calls need to start getting moved into main.js
    Electron v20. seems to be breaking fs and path
*/
const {
    BrowserWindow,
    Notification,
    getCurrentWindow,
    globalShortcut,
    ipcRenderer,
    contextBridge,
    Menu,
    shell,
    ipcMain,
    app,
    MenuItem,
    menu,
    TouchBarSegmentedControl,
    desktopCapturer,
    clipboard,
    nativeImage,
} = require("electron");
const { exec, execSync, spawn, execFileSync } = require("child_process");
const { dirname, basename, normalize } = require("path");
const fs = require("fs");
const stat = require("fs");
const watch = require("fs");
const url = require("url");
const path = require("path");
const Mousetrap = require("mousetrap");
const os = require("os");
const Chart = require("chart.js");
const DragSelect = require("dragselect");
const open = require("open");
const readline = require("readline");
const mime = require("mime-types");
const im = require("imagemagick");
const crypto = require("crypto");
const gio = require("./utils/gio");
// const gvfs                                      = require('../gio/build/Release/gio')

// Arrays
let file_arr = [];
let copy_files_arr = [];
let chart_labels = [];
let chart_data = [];
let directories = [];
let files = [];

// COUNTERS
let idx = 0;

// todo: check if this is being used
let options = {
    sort: 1,
    search: "",
};

// todo: check if this is being used
let prev_target = "";
let target = "";

// ACTIVE LINK BEING HOVERED OVER FOR CONTEXT MENU
// todo: this should replace source and target i think. needs review
let active_href = "";

// USE VAR GLOBAL
// USE LET INSIDE FUNCTIONS TO REDECLARE VARIABLE
let source = "";
let card_id = 0;
let mode = 0;

// PROGRESS VARS
let intervalid = 0;

// GLOBAL VARS
// HISTORY ARRAY
let history_arr = [];
let files_arr = [];

// CUT / COPY
let state = 0;
let cut_files = 0;

let prev_card;
let destination;

// COUNTERS FOR NAVIGATION
let nc = 1;
let nc2 = 0;
let adj = 0;
let is_folder_card = 1;

// FOLDER / FILE COUNTERS
let folder_count = 0;
let hidden_folder_count = 0;
let file_count = 0;
let hidden_file_count = 0;

// PAGING VARIABLES
let pagesize = 100;
let page = 1;
let start_path = "";

// Flags
let historize = 1;

// LOAD VIEW
let view = "";
let view0 = "";

let thumbnails_dir = "";
let userdata_dir = "";
let settings = "";

// Inputs
let input_value0 = "";

ipcRenderer.on("clear_items", (e) => {
    clear_items();
});

ipcRenderer.on("set_progress_msg", (e, msg) => {
    set_progress_msg(msg);
});

ipcRenderer.on("set_progress", (e, max, value) => {
    set_progress(max, value);
});

ipcRenderer.on("get_devices", (e) => {
    get_devices();
});

ipcRenderer.on("get_disk_summary_view", (e) => {
    localStorage.setItem("view", "disk_summary");
    get_view(breadcrumbs.value);
});

ipcRenderer.invoke("get_thumbnails_directory").then((res) => {
    thumbnails_dir = res;
});

ipcRenderer.on("get_card", (e, file) => {
    file_arr.push(file);

    let file_grid = document.getElementById("file_grid");
    let folder_grid = document.getElementById("folder_grid");
    let info_view = document.getElementById("info_view");

    info_view.innerHTML = "";
    info_view.classList.add("hidden");

    let card = get_card1(file);
    let col = add_column("three");
    col.append(card);
    if (file.is_dir || file.type == "directory") {
        folder_grid.classList.remove("hidden");
        folder_grid.insertBefore(col, folder_grid.firstChild);
    } else {
        file_grid.classList.remove("hidden");
        file_grid.insertBefore(col, file_grid.firstChild);
    }
});

ipcRenderer.on("connect", (e) => {
    // Init
    let cmd = "";
    let connect = document.querySelector(".connect");
    let chk_pk = document.getElementById("chk_pk");
    let btn_connect = document.getElementById("button_connect");
    let btn_close = document.getElementById("button_close");
    let password = document.getElementById("txt_password");
    btn_connect.tabIndex = 1;

    connect.addEventListener("keyup", (e) => {
        if (e.key === "Escape") {
            window.close();
        }
    });

    btn_close.onclick = (e) => {
        window.close();
    };

    chk_pk.onchange = () => {
        if (chk_pk.checked) {
            password.disabled = true;
        } else {
            password.disabled = false;
        }
    };

    btn_connect.onclick = (e) => {
        e.preventDefault();

        // Inputs
        let state = 0;
        let conntection_type = document.getElementById("connection_type");
        let server = document.getElementById("txt_server");
        let username = document.getElementById("txt_username");

        let connect_msg = document.getElementById("connect_msg");

        connect_msg.innerHTML = `Connecting to ${server.value}`;

        // Process
        let inputs = [].slice.call(
            document.querySelectorAll(".input, .checkbox")
        );

        inputs.every((input) => {
            if (input.value === "" && input.disabled == false) {
                (connect_msg.innerHTML = `${input.placeholder} Required.`),
                    add_br();
                state = 0;
                return false;
            } else {
                state = 1;
                return true;
            }
        });

        // Output
        if (state === 1) {
            if (conntection_type.value === "ssh") {
                // let cmd = `zenity --password --title="SSH Password" | gio mount ssh://${username.value}@${server.value}`
                cmd = `echo '${password.value}' | gio mount ssh://${username.value}@${server.value}`;
            } else if (conntection_type.value === "smb") {
                cmd = `echo '${username.value}\n${"workgroup"}\n${
                    password.value
                }\n' | gio mount smb://${server.value}`;
            }
            exec(cmd, (err, stdout, stderr) => {
                if (!err) {
                    connect_msg.style.color = "green";
                    connect_msg.innerHTML = `Connected to ${
                        conntection_type[conntection_type.options.selectedIndex]
                            .text
                    } Server.`;
                    ipcRenderer.send("get_sidebar_view");
                } else {
                    if (stderr) {
                        connect_msg.innerHTML = stderr;
                    }
                }
            });
        }
    };
});

// Confirm delete
ipcRenderer.on("confirm_delete", (e, delete_arr) => {
    let confirm_delete = document.getElementById("confirm_delete");
    let delete_files = document.getElementById("delete_files");
    let delete_button = document.getElementById("delete_button");
    let cancel_delete_button = document.getElementById("cancel_delete_button");

    delete_arr.forEach((item) => {
        if (item.source !== null) delete_files.append(item.source, add_br());
    });

    delete_button.onclick = (e) => {
        ipcRenderer.send("delete_confirmed", delete_arr);
        delete_arr = [];
    };

    confirm_delete.addEventListener("keyup", (e) => {
        if (e.key === "Escape") {
            ipcRenderer.send("delete_canceled");
        }
    });

    cancel_delete_button.onclick = (e) => {
        ipcRenderer.send("delete_canceled");
    };
});

ipcRenderer.on("item_count", (e, data) => {
    let contents = document.querySelector(
        '[data-contents="' + data.filename + '"]'
    );
    contents.innerHTML =
        data.folder_count.toLocaleString() +
        " Folder/s " +
        data.file_count.toLocaleString() +
        " File/s";
});

// Add new tab
ipcRenderer.on("open_new_tab", (e, label) => {
    add_tab(label);
});

// Start drag select
ipcRenderer.on("ds_start", (e) => {
    ds.start();
});

// ON START PATH
ipcRenderer.on("start_path", (e, res) => {
    if (res) {
        start_path = res;
    }
});

ipcRenderer.on("get_view", (e, dir) => {
    get_view(dir);
});

ipcRenderer.on("view", (e, view) => {
    get_view(view);
});

// On notification
ipcRenderer.on("notification", (e, msg) => {
    notification(msg);
});

ipcRenderer.on("update_card1", (e, href) => {
    update_card1(href, (res) => {
        console.log("update card1", res);
    });
});

ipcRenderer.on("update_cards1", (e, dir) => {
    update_cards1(dir);
});

// Update Card
ipcRenderer.on("update_card", (e, href) => {
    try {
        update_card(href);
    } catch (err) {}
});

// On update cards
ipcRenderer.on("update_cards", (e) => {
    update_cards(document.getElementById("main_view"));
});

// On clear copy array
ipcRenderer.on("clear_copy_arr", (e) => {
    clear_copy_arr();
});

ipcRenderer.on("remove_from_workspace", (e, href) => {
    let workspace = document.getElementById("workspace");
    let workspace_items = workspace.querySelectorAll(".highlight_select");

    workspace_items.forEach((item) => {
        item.remove();
    });
});

// REMOVE CARD
ipcRenderer.on("remove_card", (e, href) => {
    try {
        let cards = document.querySelectorAll('[data-href="' + href + '"]');
        cards.forEach((item) => {
            // Handle list view
            let tr = item.closest("tr");
            if (tr) {
                tr.remove();
            }

            let col = item.closest(".column");
            if (col) {
                col.remove();
            }
        });
    } catch (err) {}
});

// CONFIRM OVERWRITE DIALOG
ipcRenderer.on("confirming_overwrite", (e, data, copy_files_arr) => {
    let confirm_dialog = document.getElementById("confirm");

    let source_stats = fs.statSync(data.source);
    let destination_stats = fs.statSync(data.destination);

    // CHECKBOX REPLACE
    let chk_replace_div = add_checkbox(
        "chk_replace",
        "Apply this action to all files and folders"
    );

    // CANCEL BUTTON
    let btn_cancel = add_button("btn_cancel", "Cancel");
    btn_cancel.addEventListener("click", (e) => {
        if (is_checked) {
            ipcRenderer.send("overwrite_canceled_all", copy_files_arr);
        } else {
            ipcRenderer.send("overwrite_canceled", copy_files_arr);
        }
    });

    // CONFIRM BUTTON
    let btn_replace = add_button("btn_replace", "Replace");
    btn_replace.classList.add("primary");
    btn_replace.addEventListener("click", (e) => {
        if (is_checked) {
            ipcRenderer.send("overwrite_confirmed_all", copy_files_arr);
        } else {
            ipcRenderer.send("overwrite_confirmed", data, copy_files_arr);
        }
    });

    // SKIP BUTTON
    let btn_skip = add_button("btn_skip", "Skip");
    btn_skip.addEventListener("click", (e) => {
        if (is_checked) {
            ipcRenderer.send("overwrite_canceled_all");
        } else {
            ipcRenderer.send("overwrite_skip", copy_files_arr);
        }
    });

    // FOOTER
    let footer = add_div();
    footer.style =
        "position:fixed; bottom:0; height: 40px; margin-bottom: 25px;";
    footer.append(btn_cancel, btn_replace, btn_skip);

    let source_data = "";
    let destination_data = "";
    let header = "";

    // DIRECTORY
    if (destination_stats.isDirectory()) {
        btn_replace = add_button("btn_replace", "Merge");
        btn_replace.classList.add("primary");

        let description = "";
        if (destination_stats.mtime > source_stats.mtime) {
            description =
                "<p>A newer folder with the same name already exists</p>";
            // 'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        } else {
            description =
                "<p>An older folder with the same name already exists in " +
                "Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>";
        }

        header = add_header(
            "<br />Copy Folder:  " + path.basename(data.source) + "<br /><br />"
        );

        source_data = add_p(
            description +
                add_header("Current Folder").outerHTML +
                "Size:" +
                get_file_size(destination_stats.size) +
                "<br />" +
                "Last modified: " +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(destination_stats.mtime) +
                "<br />" +
                "<br />"
        );

        destination_data = add_p(
            add_header("Overwrite with").outerHTML +
                "Size:" +
                get_file_size(source_stats.size) +
                "<br />" +
                "Last modified: " +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(source_stats.mtime) +
                "<br />" +
                "<br />"
        );

        // FILE
    } else {
        let description;
        if (destination_stats.mtime >= source_stats.mtime) {
            description =
                "<p>A newer file with the same name already exists. " +
                "Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>";
        } else {
            description =
                "<br /><p>An older file with the same name already exists " +
                "Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>";
        }

        header = add_header(
            "<br />Replace File: <span>" +
                path.basename(data.source) +
                "</span><br />"
        );

        // This is realy destination
        source_data = add_p(
            description +
                add_header("Original File").outerHTML +
                "Size:" +
                get_file_size(destination_stats.size) +
                "<br />" +
                "Last modified:" +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(destination_stats.mtime) +
                "<br />" +
                "<br />"
        );

        // This is realy source
        destination_data = add_p(
            add_header("Replace With").outerHTML +
                "Size:" +
                get_file_size(source_stats.size) +
                "<br />" +
                "Last modified:" +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(source_stats.mtime) +
                "<br />" +
                "<br />"
        );
    }

    // HANDLE CHECKBOX
    let replace_all = add_div();
    replace_all.append(chk_replace_div);

    confirm_dialog.append(
        header,
        source_data,
        destination_data,
        replace_all,
        footer
    );

    let chk_replace = document.getElementById("chk_replace");
    let is_checked = 0;
    chk_replace.addEventListener("change", (e) => {
        if (chk_replace.checked) {
            is_checked = 1;
        } else {
            is_checked = 0;
        }
    });
});

// OVERITE COPY FILES
ipcRenderer.on("overwrite", (e, data) => {
    let progress = document.getElementById("progress");

    let destination = data.destination;
    let source = data.source;

    let destination_stats = fs.statSync(destination);
    let source_stats = fs.statSync(source);

    destination_size = destination_stats.size;
    source_size = source_stats.size;

    notification("overwriting file " + destination);

    if (destination_stats.isDirectory()) {
        copyFolderRecursiveSync(source, destination);
    } else {
        // COPY FILE
        fs.copyFile(source, destination, (err) => {
            let file_grid = document.getElementById("file_grid");
            if (err) {
                console.log(err);
            } else {
                // REMOVE PREVIOUS CARD
                let previous_card = document.querySelector(
                    '[data-href="' + destination + '"]'
                );
                let col = previous_card.closest(".column");
                col.remove();

                // ADD CARD
                let options = {
                    id: "file_grid_" + idx,
                    href: destination,
                    linktext: path.basename(destination),
                    grid: file_grid,
                };

                try {
                    add_card(options).then((col) => {
                        file_grid.insertBefore(col, file_grid.firstChild);

                        // COUNT ITEMS IN MAIN VIEW
                        folder_count = get_folder_count();
                        file_count = get_file_count();

                        // RESET CARD INDE TO HANDLE LAZY LOADED IMAGES
                        cardindex = 0;
                    });
                } catch (err) {
                    notification(err);
                }
            }
            // UPDATE CARDS
            update_cards(file_grid);
        });
    }
});

// OVERWRITE COPY ALL
ipcRenderer.on("overwrite_all", (e, copy_files_arr) => {
    copy_files_arr.forEach((item) => {
        let source_stats = fs.statSync(item.source);
        // Directory
        if (source_stats.isDirectory()) {
            copyFolderRecursiveSync(item.destination);
            // File
        } else {
            copyFileSync(item.source, item.destination);
        }
    });
    clear_copy_arr();
});

// ON COPY COMPLETE
ipcRenderer.on("copy-complete", function (e) {
    get_files(breadcrumbs.value);
});

// Confirm move dialog
ipcRenderer.on("confirming_move", (e, data, copy_files_arr) => {
    let btn_cancel = add_button("btn_cancel", "Cancel");
    let btn_ok = add_button("btn_ok", "Move");
    btn_ok.classList.add("primary");

    let footer = add_div();
    footer.style = "position:fixed; bottom:0; margin-bottom: 25px;";
    footer.append(btn_cancel);
    footer.append(btn_ok);

    let source_stats = fs.statSync(data.source);
    let header = add_header(
        "<br />Confirm Move:  " + path.basename(data.source) + "<br /><br />"
    );

    let description = "";
    let source_data = "";
    if (fs.statSync(data.source).isDirectory()) {
        description = add_p("Move Folders " + data.source);
        source_data = add_p(
            add_header("").outerHTML +
                "Size:" +
                get_file_size(localStorage.getItem(data.source)) +
                "<br />" +
                "Last modified: " +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(source_stats.mtime) +
                "<br />" +
                "<br />"
        );
    } else {
        description = add_p("Move files " + data.source);
        source_data = add_p(
            add_header("").outerHTML +
                "Size:" +
                get_file_size(localStorage.getItem(data.source)) +
                "<br />" +
                "Last modified: " +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(source_stats.mtime) +
                "<br />" +
                "<br />"
        );
    }

    let chk_div = add_div();
    let chk_move_all = add_checkbox(
        "chk_replace",
        "Apply this action to all files and folders"
    );
    chk_div.append(chk_move_all);

    let confirm_dialog = document.getElementById("confirm");
    confirm_dialog.append(
        header,
        description,
        source_data,
        chk_div,
        add_br(),
        add_br(),
        add_br(),
        footer
    );

    chk = document.getElementById("chk_replace");

    let is_checked = 0;
    if (localStorage.getItem("move_all") === null) {
        localStorage.setItem("move_all", 0);
    } else {
        is_checked = parseInt(localStorage.getItem("move_all"));
    }

    chk.checked = is_checked;

    // MOVE ALL
    chk.addEventListener("change", (e) => {
        if (chk.checked) {
            localStorage.setItem("move_all", 1);
            is_checked = 1;
        } else {
            localStorage.setItem("move_all", 0);
            is_checked = 0;
        }
    });

    // MOVE CONFIRMED
    btn_ok.addEventListener("click", (e) => {
        if (is_checked) {
            ipcRenderer.send("move_confirmed_all", data, copy_files_arr);
        } else {
            ipcRenderer.send("move_confirmed", data, copy_files_arr);
        }
    });

    // CANCEL MOVE
    btn_cancel.addEventListener("click", (e) => {
        if (is_checked) {
            ipcRenderer.send("move_canceled_all");
        } else {
            ipcRenderer.send("move_canceled");
        }
    });

    window.addEventListener("keyup", (e) => {
        if (e.key === "Escape") {
            ipcRenderer.send("move_canceled");
        }
    });
});

// CONFIRM OVERWRITE MOVE DIALOG
ipcRenderer.on("confirming_overwrite_move", (e, data) => {
    let confirm_dialog = document.getElementById("confirm");

    let source_stats = fs.statSync(data.source);
    let destination_stats = fs.statSync(data.destination);

    let chk_replace_div = add_checkbox(
        "chk_replace",
        "Apply this action to all files and folders"
    );

    let footer = add_div();
    let btn_cancel = add_button("btn_cancel", "Cancel");
    let btn_replace = add_button("btn_replace", "Replace");
    let btn_skip = add_button("btn_skip", "Skip");
    let icon = add_icon("info-circle");

    footer.style = "position:fixed; bottom:0; margin-bottom: 25px;";
    footer.append(btn_cancel);
    footer.append(btn_replace);
    footer.append(btn_skip);

    //
    let confirm_msg = add_div();

    btn_replace.classList.add("primary");

    let source_data = "";
    let destination_data = "";
    let header = "";

    // DIRECTORY
    if (destination_stats.isDirectory()) {
        let description = "";
        if (destination_stats.mtime > source_stats.mtime) {
            description =
                "<p>A newer folder with the same name already exists. " +
                "Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>";
        } else {
            description =
                "<p>An older folder with the same name already exists. " +
                "Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>";
        }

        header = add_header(
            "<br />Merge Folder:  " +
                path.basename(data.source) +
                "<br /><br />"
        );

        destination_data = add_p(
            description +
                add_header("Merge with").outerHTML +
                "Size:" +
                get_file_size(destination_stats.size) +
                "<br />" +
                "Last modified: " +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(destination_stats.mtime) +
                "<br />" +
                "<br />"
        );
        source_data = add_p(
            add_header("Original Folder").outerHTML +
                "Size:" +
                get_file_size(source_stats.size) +
                "<br />" +
                "Last modified: " +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(source_stats.mtime) +
                "<br />" +
                "<br />"
        );

        // FILE
    } else {
        let description = "";
        if (destination_stats.mtime >= source_stats.mtime) {
            description =
                "<p>A newer file with the same name already exists. " +
                "Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>";
        } else {
            description =
                "<p>An older file with the same name already exists. " +
                "Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>";
        }

        header = add_header(
            "<br />Replace File: <span>" +
                path.basename(data.source) +
                "</span><br /><br />"
        );

        destination_data = add_p(
            description +
                add_header("Original File").outerHTML +
                "Size:" +
                get_file_size(destination_stats.size) +
                "<br />" +
                "Last modified:" +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(destination_stats.mtime) +
                "<br />" +
                "<br />"
        );
        source_data = add_p(
            add_header("Replace With").outerHTML +
                "Size:" +
                get_file_size(source_stats.size) +
                "<br />" +
                "Last modified:" +
                new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(source_stats.mtime)
        );
    }

    // HANDLE CHECKBOX
    let replace_all = add_div();
    replace_all.append(chk_replace_div);

    confirm_dialog.append(
        header,
        destination_data,
        source_data,
        add_br(),
        replace_all,
        add_br(),
        footer
    );

    // Handle checkbox
    let chk_replace = document.getElementById("chk_replace");
    let is_checked = 0;
    chk_replace.addEventListener("change", (e) => {
        if (chk_replace.checked) {
            is_checked = 1;
        } else {
            is_checked = 0;
        }
    });

    // MOVE OVERWRITE
    btn_replace.addEventListener("click", (e) => {
        if (is_checked) {
            ipcRenderer.send(
                "overwrite_move_confirmed_all",
                data,
                copy_files_arr
            );
        } else {
            ipcRenderer.send("overwrite_move_confirmed", data);
        }
    });

    // CANCEL OVERWRITE BUTTON
    btn_cancel.addEventListener("click", (e) => {
        ipcRenderer.send("overwrite_move_canceled");
    });

    // SKIP OVERWRITE BUTTON
    btn_skip.addEventListener("click", (e) => {
        if (is_checked) {
            ipcRenderer.send("overwrite_move_canceled_all");
        } else {
            ipcRenderer.send("overwrite_move_skip");
        }
    });
});

// OVERWRITE MOVE
ipcRenderer.on("overwrite_move", (e, data) => {
    let progress = document.getElementById("progress");
    let destination = data.destination;
    let source = data.source;

    let destination_stats = fs.statSync(destination);
    let source_stats = fs.statSync(source);

    destination_size = destination_stats.size;
    source_size = source_stats.size;

    notification("overwriting file " + destination);

    if (destination_stats.isDirectory()) {
        copyFolderRecursiveSync(source, destination);
    } else {
        // HANDLE PROGESS
        progress.classList.remove("hidden");
        progress.title = "Moving " + source;
        progress.max = source_size;

        let intervalid = setInterval(() => {
            progress.value = destination_size;
            if (destination_size >= source_size) {
                clearInterval(intervalid);
                hide_top_progress();
            }
        }, 100);

        // COPY FILE
        fs.copyFile(source, destination, (err) => {
            let file_grid = document.getElementById("file_grid");
            if (err) {
                console.log(err);
            } else {
                delete_file(source);
            }
            // UPDATE CARDS
            update_cards(file_grid);
        });
    }
});

// ON MOVE CONFIRMED. todo: this needs work
ipcRenderer.on("move_confirmed", (e, data) => {
    let source = data.source;
    let destination = data.destination;

    fs.copyFile(source, destination, (err) => {
        if (err) {
            console.log(err);
        } else {
            // REMOVE CARD
            let card = document.querySelector('[data-href="' + source + '"]');
            let col = card.closest(".column");
            col.remove();

            delete_file(source);
        }
    });
});

// OVERWRITE MOVE ALL
ipcRenderer.on("overwrite_move_all", (e, destination) => {
    copy_files_arr.forEach((data) => {
        let source_stats = fs.statSync(data.source);

        // DIRETORY
        if (source_stats.isDirectory()) {
            // FILE
        } else {
            fs.copyFile(
                data.source,
                path.join(destination, path.basename(source)),
                (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        delete_file(data.source);
                    }
                }
            );
        }
    });

    clear_copy_arr();
    clear_items();
});

// ON FILE SIZE
ipcRenderer.on("file_size", function (e, args) {
    let href = args.href;
    let size = args.size;

    try {
        let card = document.querySelector('[data-href="' + href + '"]');
        let extra = card.querySelector(".extra");

        extra.innerHTML = get_file_size(size);
        localStorage.setItem(href, args.size);
    } catch (err) {
        console.log(err);
    }
});

// ON DISk SPACE - NEW
ipcRenderer.on("disk_space", (e, data) => {
    let info_view = document.getElementById("info_view");
    let folder_count = get_folder_count();
    let file_count = get_file_count();

    if (folder_count === 0 && file_count === 0) {
        let msg = add_div();
        msg.classList.add("empty_folder");
        let icon = add_icon("folder");

        msg.append(icon, "Folder is empty");

        info_view.classList.remove("hidden");
        info_view.append(msg);
    }

    if (data.length > 0) {
        let status = document.getElementById("status");
        status.innerHTML = "";
        let disksize = add_div();
        let usedspace = add_div();
        let availablespace = add_div();
        let foldersize = add_div();
        let foldercount = add_div();
        let filecount = add_div();

        foldersize.id = "du_folder_size";

        data.forEach((item) => {
            disksize.innerHTML =
                '<div class="item">Disk size: <b>&nbsp' +
                item.disksize +
                "</b></div>";
            usedspace.innerHTML =
                '<div class="item">Used space: <b>&nbsp' +
                item.usedspace +
                "</b></div>";
            availablespace.innerHTML =
                '<div class="item">Available space: <b>&nbsp' +
                item.availablespace +
                "</b></div>";
            foldersize.innerHTML =
                '<div class="item">Folder Size: <b>&nbsp' +
                item.foldersize +
                "</b></div>";
            foldersize.innerHTML =
                '<div class="item">Folder Size: <b>&nbspCalculating.... </b></div>';
            foldercount.innerHTML =
                '<div class="item">Folder Count: <b>&nbsp' +
                folder_count +
                "</b></div>";
            filecount.innerHTML =
                '<div class="item">File Count: <b>&nbsp' +
                file_count +
                "</b></div>";

            status.appendChild(disksize);
            status.appendChild(usedspace);
            status.appendChild(availablespace);
            status.appendChild(foldersize);
            status.appendChild(foldercount);
            status.appendChild(filecount);
        });
    } else {
        console.log("no data found");
    }
});

ipcRenderer.on("du_folder_size", (e, folder_size) => {
    try {
        let du_folder_size = document.getElementById("du_folder_size");
        du_folder_size.innerHTML =
            '<div class="item">Folder Size: <b>&nbsp' +
            folder_size +
            "</b></div>";
    } catch (err) {}
});

// ON FOLDER SIZE
ipcRenderer.on("folder_size", (e, data) => {
    try {
        let cards = document.querySelectorAll(
            '[data-href="' + data.href + '"]'
        );
        cards.forEach((card) => {
            let size = card.querySelector(".size");

            size.innerHTML = get_file_size(data.size);
            localStorage.setItem(data.href, data.size);
        });
    } catch (err) {
        console.log("on get folder size error:", err);
    }
});

// ON GIO DEVICE
ipcRenderer.on("gio_devices", (e, res) => {
    let device_grid = document.getElementById("device_grid");
    let menu_items = add_div();
    let data = res.split("\n");

    // GET REFERENCE TO DEVICE GRID
    device_grid.innerHTML = "";
    menu_items.classList.add("ui", "items");
    // CREATE VOLUMES ARRAY
    let volumes_arr = [];
    data.forEach((item, idx) => {
        // CREATE VOLLUMES ARRAY
        if (item.indexOf("Volume(0):") > -1) {
            let split_item = item.split("->");
            let volume_obj = {
                idx: idx,
                volume: split_item[0],
            };
            volumes_arr.push(volume_obj);
        }
    });
    // LOOP OVER VOLUMES ARRAY
    // GIO OBJECT
    let gio = {};
    let subitem_counter = 0;
    let is_activationroot = 0;
    // LOOP OVER VOLUMES
    for (let i = 0; i < volumes_arr.length; i++) {
        let volume = volumes_arr[i].volume;
        gio.volume = volume.replace("Volume(0):", "").trim();
        // LOOP OVER GIO DATA AND GET SUB ITEMS
        data.forEach((subitem, subidx) => {
            let volumeidx = volumes_arr[i].idx;
            let volumeidx2 = data.length;
            // IF MORE THAN 1 VOLUME IS FOUND GET ITS INDEX TO USE AS FILTER
            if (i < volumes_arr.length - 1) {
                volumeidx2 = volumes_arr[i + 1].idx;
            }
            let uuid = "";
            // IF ARRAY COUNTER IS BETWEEN 1ST AND SECOND
            if (subidx >= volumeidx && subidx <= volumeidx2) {
                if (subitem.indexOf("activation_root=") > -1) {
                    uuid = subitem.replace("activation_root=", "").trim();
                    gio.uuid = uuid;
                    // CREATE HREF ELEMENT
                    let href = document.createElement("a");
                    let icon = document.createElement("i");
                    let icon_phone = document.createElement("i");
                    let menu_item = add_div();
                    let content = add_div();
                    href.href = "#";
                    href.classList.add("block");
                    icon.classList.add("icon", "bi-hdd");
                    icon.style.marginLeft = "15px";
                    icon_phone.classList.add("icon", "mobile", "alternate");
                    menu_item.classList.add("item");
                    content.classList.add("item");
                    // ADD DATA
                    href.dataset.uuid = uuid;
                    href.text = gio.volume;
                    href.addEventListener("click", (e) => {
                        ipcRenderer.send("mount_gio", gio);
                    });
                    menu_item.appendChild(icon_phone);
                    content.appendChild(href);
                    menu_item.appendChild(content);
                    menu_items.appendChild(menu_item);
                    device_grid.appendChild(menu_items);
                    is_activationroot = 1;
                }
                if (
                    subitem.indexOf("default_location=") > -1 &&
                    is_folder_card == 1
                ) {
                    uuid = path.normalize(
                        subitem.replace("default_location=file://", "").trim()
                    );
                    if (uuid.indexOf("sftp") === -1) {
                        // IF UUID CONTAINS DEFAULT_LOCATION. ONLY SHOW FIRST INSTANCE
                        if (
                            uuid.indexOf("default_location=") > -1 &&
                            subitem_counter === 0
                        ) {
                            // CREATE HREF ELEMENT
                            let href = document.createElement("a");
                            let icon = document.createElement("i");
                            let icon_phone = document.createElement("i");
                            let menu_item = add_div();
                            let content = add_div();
                            href.href = "#";
                            href.classList.add("block");
                            icon.classList.add("icon", "bi-hdd");
                            icon.style.marginLeft = "15px";
                            icon_phone.classList.add(
                                "icon",
                                "mobile",
                                "alternate"
                            );
                            menu_item.classList.add("item");
                            content.classList.add("item");
                            // ADD DATA
                            uuid = uuid
                                .replace(
                                    "default_location=",
                                    "/run/user/1000/gvfs/"
                                )
                                .replace("mtp:/", "mtp:host=");
                            href.dataset.uuid = uuid;
                            href.text = gio.volume;
                            href.addEventListener("click", (e) => {
                                get_view(uuid);
                            });
                            content.appendChild(href);
                            menu_item.appendChild(icon_phone);
                            menu_item.appendChild(content);
                            menu_items.appendChild(menu_item);
                            device_grid.appendChild(menu_items);
                            subitem_counter = 1;
                        }
                        // IF UUID DOES NOT CONTAIN DEFAULT_LOCATION
                        if (uuid.indexOf("default_location=") === -1) {
                            // CREATE HREF ELEMENT
                            let href = document.createElement("a");
                            let icon = document.createElement("i");
                            let icon_phone = document.createElement("i");
                            let menu_item = add_div();
                            let content = add_div();
                            href.href = "#";
                            href.classList.add("block");
                            icon.classList.add("icon", "bi-hdd");
                            icon.style.marginLeft = "15px";
                            icon_phone.classList.add(
                                "icon",
                                "mobile",
                                "alternate"
                            );
                            menu_item.classList.add("item");
                            content.classList.add("item");
                            // ADD DATA
                            uuid = uuid
                                .replace(
                                    "default_location=",
                                    "/run/user/1000/gvfs/"
                                )
                                .replace("mtp:/", "mtp:host=");
                            href.dataset.uuid = uuid;
                            href.text = gio.volume;
                            href.addEventListener("click", (e) => {
                                get_view(uuid);
                                // get_files(uuid, () => {})
                            });
                            menu_item.appendChild(icon);
                            content.appendChild(href);
                            menu_item.appendChild(content);
                            menu_items.appendChild(menu_item);
                            device_grid.appendChild(menu_items);
                        }
                    }
                }
            }
        });
    }
});

// ON GIO MOUNTED
ipcRenderer.on("gio_mounted", (e, data) => {
    let path = "";
    if (data.indexOf("mounted at") > -1) {
        path = data.substring(data.indexOf("`") + 1, data.lastIndexOf("'"));

        if (path === "") {
            path = "/run/user/1000/gvfs";
        }
        get_view(path);
    } else {
        console.log("gio mount error");
    }

    if (data.indexOf("mounted at") > -1) {
    }

    if (data.indexOf("already mounted") > -1) {
        get_view("/run/user/1000/gvfs");
    }

    let str_arr = data.split(" ");
    str_arr.forEach((item, idx) => {
        let direcotry = item.replace(".", "").replace("'", "").replace("`", "");

        if (item.indexOf("already mounted") !== -1) {
            if (idx === 8) {
                direcotry = item
                    .replace(".", "")
                    .replace("'", "")
                    .replace("`", "");
                get_view(direcotry.trim());
            }
        }
    });
});

// ON GIO MONITORED
ipcRenderer.on("gio_monitor", (e, data) => {
    let device_grid = document.getElementById("device_grid");
    device_grid.innerHTML = "";
});

// ON GIO FILES
ipcRenderer.on("gio_files", (e, data) => {
    // SPLIT RETURED FILES / FOLDERS
    let files = data.res.split("\n");

    let folder_grid = document.getElementById("folder_grid");
    let file_grid = document.getElementById("file_grid");

    folder_grid.innerHTML = "";
    file_grid.innerHTML = "";
    folders_card.classList.remove("hidden");

    // LOOP OVER FILES / FOLDERS
    files.forEach((item, idx) => {
        let href = path.join(
            "/run/user/1000/gvfs",
            data.data.replace("//", "host=")
        );
        // CREATE CARD OPTIONS
        let options = {
            id: "card_id_" + idx,
            href: href,
            linktext: item,
            grid: folder_grid,
        };
        try {
            add_card(options).then((card) => {
                folder_grid.insertBefore(card, folder_grid.firstChild);
                let col = add_column("three");
                col.append(card);
            });
        } catch (err) {
            notification(err);
        }
    });
});

// ADD CARD VIA IPC
ipcRenderer.on("add_card", (e, options) => {
    let duplicate = 0;
    let items = main_view.querySelectorAll(".nav_item");
    let info_view = document.getElementById("info_view");

    info_view.innerHTML = "";

    items.forEach((item) => {
        if (options.href == item.dataset.href) {
            duplicate = 1;
        }
    });

    if (!duplicate) {
        if (options.is_dir) {
            options.grid = document.getElementById("folder_grid");
        } else {
            options.grid = document.getElementById("file_grid");
        }

        add_card(options).then((card) => {
            let col = add_column("three");
            col.append(card);
            options.grid.insertBefore(col, options.grid.firstChild);
            update_card(card.dataset.href);
        });
    } else {
        console.log("error: duplicate found. this needs to be fixed");
    }
});

// ON DELETE CONFIRMED
ipcRenderer.on("delete_file_confirmed", (e, res) => {
    delete_confirmed();
});

// ON CREATE FILE FROM TEMPLATE
ipcRenderer.on("create_file_from_template", function (e, file) {
    create_file_from_template(file.file);
});

// On file properties window
ipcRenderer.on("file_properties_window", (e, data) => {
    let sb_items = document.getElementById("sidebar_items");
    sb_items.innerHTML = "";
    get_properties(source);
});

// On file properties
ipcRenderer.on("file_properties", (e, file_properties_obj) => {
    get_properties(file_properties_obj);
});

// On add workspace
ipcRenderer.on("add_workspace", (e) => {
    add_workspace();
});

// On select all
ipcRenderer.on("select_all", (e) => {
    select_all();
});

// Set progress
ipcRenderer.on("progress", (e, max, destination_folder) => {
    if (is_gio_file(destination_folder)) {
    } else {
        get_progress(max, destination_folder);
    }
});

// Update progress
ipcRenderer.on("update_progress", (e, step) => {
    update_progress(step);
});

// On sort
ipcRenderer.on("sort", (e, sort) => {
    let breadcrumbs = document.getElementById("breadcrumbs");

    if (sort === "date") {
        localStorage.setItem("sort", 1);
    } else if (sort === "size") {
        localStorage.setItem("sort", 3);
    } else if (sort === "name") {
        localStorage.setItem("sort", 2);
    } else if (sort === "type") {
        localStorage.setItem("sort", 4);
    }

    get_view(breadcrumbs.value);
});

// todo: these need to be consolidated at ome point
// NOTICE
function notice(notice_msg) {
    let container = document.getElementById("notice");
    container.innerHTML = "";
    container.innerHTML = notice_msg;
}

function createFlexTable(containerId, tableData) {
    const container = document.getElementById(containerId);
    const table = document.createElement("div");
    table.className = "table";

    // Create table header
    const header = document.createElement("div");
    header.className = "table-row header";
    for (let i = 0; i < tableData[0].length; i++) {
        const cell = document.createElement("div");
        cell.className = "table-cell header-cell";
        cell.innerText = tableData[0][i];
        header.appendChild(cell);
    }
    table.appendChild(header);

    // Create table rows
    for (let i = 1; i < tableData.length; i++) {
        const row = document.createElement("div");
        row.className = "table-row";
        for (let j = 0; j < tableData[i].length; j++) {
            const cell = document.createElement("div");
            cell.className = "table-cell";
            cell.innerText = tableData[i][j];
            row.appendChild(cell);
        }
        table.appendChild(row);
    }

    container.appendChild(table);
}

function get_recent_files(href, call) {
    ipcRenderer.invoke("get_recent_files", href).then((res) => {
        let main_view = document.getElementById("main_view");
        let folder_grid = document.getElementById("folder_grid");
        let file_grid = document.getElementById("file_grid");

        folder_grid.innerHTML = "";
        file_grid.innerHTML = "";

        main_view.append(add_header("Recent Files"));

        if (res.length > 0) {
            res.forEach((href) => {
                gio.get_file(href, (file) => {
                    let card = get_card1(file);
                    let col = add_column("three");
                    col.append(card);

                    if (file.type === "directory") {
                        folder_grid.append(col);
                    } else {
                        file_grid.append(col);
                    }
                });
            });
        }
    });
}

function get_sidebar_home() {
    let home_dir = get_home();
    let my_computer_arr = [
        "Home",
        "Documents",
        "Music",
        "Pictures",
        "Videos",
        "Downloads",
        "Recent",
        "File System",
    ];
    let my_computer_paths_arr = [
        home_dir,
        `${path.join(home_dir, "Documents")}`,
        `${path.join(home_dir, "Music")}`,
        `${path.join(home_dir, "Pictures")}`,
        `${path.join(home_dir, "Video")}`,
        `${path.join(home_dir, "Downloads")}`,
        "Recent",
        "Recent",
    ];
    let my_computer_icons_arr = [
        "home",
        "folder",
        "music",
        "image",
        "video",
        "download",
        "history",
        "hdd",
    ];

    localStorage.setItem("minibar", "mb_home");

    let sidebar_items = document.getElementById("sidebar_items");
    sidebar_items.innerHTML = "";
    sidebar_items.append(add_header("Home"));

    // Get home

    for (let i = 0; i < my_computer_arr.length; i++) {
        let href = my_computer_paths_arr[i];

        let item = add_div();
        item.classList.add("flex");

        let link = add_link(my_computer_paths_arr[i], my_computer_arr[i]);

        item.classList.add("item");
        item.append(
            add_icon(my_computer_icons_arr[i].toLocaleLowerCase()),
            link
        );

        sidebar_items.append(item);

        item.onclick = () => {
            let items = sidebar_items.querySelectorAll(".item");
            items.forEach((item) => {
                item.classList.remove("active");
            });

            item.classList.add("active");
            if (href === "Recent") {
                get_recent_files(`${get_home()}/Documents`);
            } else {
                gio.get_file(href, (file) => {
                    if (file.type === "directory") {
                        get_view(file.href);
                    } else {
                        open(file.href);
                    }
                });
            }
        };
    }

    // Workspace
    sidebar_items.append(add_header("Workspace"));
    local_items = JSON.parse(localStorage.getItem("workspace"));
    if (local_items != undefined) {
        if (local_items.length > 0 && local_items != undefined) {
            local_items.forEach((item, idx) => {
                let div = add_div();
                let col1 = add_div();
                let col2 = add_div();
                let rm_icon = add_icon("times");

                rm_icon.classList.add("small");
                rm_icon.style = "margin-left: auto;";

                div.style = "display: flex; padding: 6px; width: 100%;";
                div.classList.add("item");
                col1.append(add_icon("bookmark"));
                col2.append(item.name);
                div.append(col1, col2, rm_icon);
                sidebar_items.append(div);

                div.title = item.href;
                div.onclick = (e) => {
                    gio.get_file(item.href, (file) => {
                        if (file.type === "directory") {
                            get_view(item.href);
                        } else {
                            open(item.href);
                        }
                    });
                };

                rm_icon.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    div.remove();
                    local_items.splice(idx, 1);
                    if (local_items.length > 0) {
                        localStorage.setItem(
                            "workspace",
                            JSON.stringify(local_items)
                        );
                    } else {
                        localStorage.removeItem("workspace");
                    }
                };

                div.oncontextmenu = (e) => {
                    div.classList.add("highlight_select");
                    ipcRenderer.send("show-context-menu-workspace", item);
                };
            });
        }
    }

    // Get devices
    sidebar_items.append(add_header("Devices"));
    gio.get_devices((devices) => {
        devices.forEach((device, idx) => {
            let link = add_link(device.href, device.name);
            let icon = add_icon("hdd");
            let umount = add_icon("eject");
            let div = add_div();

            let col1 = (add_div().innerHTML = icon);
            let col2 = (add_div().innerHTML = link);
            let col3 = (add_div().innerHTML = umount);

            link.style = "display: block";
            col2.style = "width: 100%";
            col3.style = "margin-left: auto";

            div.append(col1, col2, col3);
            div.style = "display: flex; padding: 6px; width: 100%;";
            div.classList.add("item");

            umount.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                exec(`gio mount -u -f "${device.href}"`, (err, stdout) => {
                    if (!err) {
                        div.remove();
                        notification(stdout);
                    } else {
                        notification(err);
                    }
                });
            });

            div.onclick = (e) => {
                get_view(device.href);
            };

            div.oncontextmenu = (e) => {
                ipcRenderer.send("show-context-menu-devices");
            };

            sidebar_items.append(div);
        });
    });
}

// INFO
function info(msg) {
    let container = document.getElementById("notification");
    container.style = "font-size:small; right: 0;";
    container.classList.remove("hidden");
    container.innerHTML = "";
    container.innerHTML = msg;
}

/**
 * Display a notification in the lower left corner
 * @param {string} msg
 */
function notification(msg) {
    let notification = document.getElementById("notification");
    notification.innerHTML = "";

    if (msg.toString().toLocaleLowerCase().search("error") > -1) {
        notification.style.color = "#ff0000";
    } else {
        notification.style.color = "#cfcfcf";
    }

    notification.append(msg);
    notification.classList.remove("hidden");
    notification.classList.add("right");
}

// // GET FILE CONTENTS. USED TO LOAD PAGES
// 이 함수를 활성화 시키면 클릭 감도가 이상해짐
// async function get_file(file) {
//     let res = fs.readFileSync(__dirname + "/" + file);
//     return res;
// }

// CLEAR CACHE
function clear_cache() {
    let folder_cache = path.join(__dirname, "/", "folder_cache.json");
}

/**
 * Get image properties. This function uses the identify function from the ImageMagick toolset
 * @param {string} image
 */
async function get_image_properties(image) {
    let sb_items = document.getElementById("sidebar_items");
    let card = add_div();
    let content = add_div();

    card.classList.add("ui", "card");
    content.classList.add("content");

    exec('identify -verbose "' + image + '"', (err, info) => {
        if (err) {
        } else {
            let prop_view = add_div();
            let icon = add_icon("times");

            prop_view.style = "height: 100%; overflow-y: auto;";
            icon.style =
                "display:block; float:right; width: 23px; cursor: pointer";

            icon.addEventListener("click", (e) => {
                card.remove();
            });

            let image_obj = {};
            let info_arr = info.split("\n");
            info_arr.forEach((item, idx) => {
                if (idx <= 10) {
                    const [key, value] = item.trim().split(":");
                    image_obj[key] = value;

                    let row = add_div();
                    let col1 = add_div();
                    let col2 = add_div();

                    row.style = "display:flex; padding: 5px;";
                    col1.style = "width: 150px;";

                    col1.append(key);
                    col2.append(value);

                    row.append(col1, col2);
                    prop_view.append(row);
                }
            });

            content.append(icon, prop_view);
            card.append(content);

            sb_items.append(card);
        }
    });
}

// FILE PROPERTIES WINDOW
/**
 * Display file properties in the sidebar
 * @param {object} file_properties_obj
 */
async function get_properties(file_properties_obj) {
    let filename = file_properties_obj["Name"];
    let ext = path.extname(filename);
    let execute_chk_div = add_checkbox("", "Make Executable");
    let sb_items = document.getElementById("sidebar_items");
    let mb_info = document.getElementById("mb_info");
    let remove_btn = add_icon("times");
    let card = add_div();
    let content = add_div();
    let image = add_div();

    image.classList.add("image");

    clear_minibar();
    mb_info.style = "color: #ffffff !important;";
    remove_btn.classList.add("small");
    remove_btn.style =
        "display:block; float:right; width: 23px; cursor: pointer";
    remove_btn.addEventListener("click", (e) => {
        card.remove();
        let items = sb_items.querySelectorAll(".nav_item");
        if (items.length === 0) {
            get_sidebar_view();
        }
    });

    let execute_chk = execute_chk_div.querySelector(".checkbox");

    try {
        fs.accessSync(filename, fs.constants.X_OK);
        execute_chk.checked = 1;
    } catch (err) {
        execute_chk.checked = 0;
    }

    execute_chk.addEventListener("change", (e) => {
        // mode: r/w 33188
        // mode: r/w/x 33261
        if (execute_chk.checked) {
            chmod = fs.chmodSync(filename, "755");
        } else {
            chmod = fs.chmodSync(filename, "33188");
        }
    });

    let stats = fs.statSync(filename);

    card.dataset.href = filename;
    card.classList.add("ui", "card", "fluid", "nav_item", "nav");
    card.style = "color: #ffffff !important;";
    content.classList.add("content");

    content.append(remove_btn, add_br());

    let c = 0;
    for (const prop in file_properties_obj) {
        ++c;
        let div = add_div();
        div.style = "display: flex; padding: 5px; word-break: break-all";

        let col1 = add_div();
        let col2 = add_div();

        col1.style = "width: 30%;";
        col2.style = "width: 60%;";

        switch (prop) {
            case "Name":
                let link = add_link(
                    file_properties_obj[prop],
                    file_properties_obj[prop]
                );
                link.addEventListener("click", (e) => {
                    if (fs.statSync(file_properties_obj[prop]).isDirectory()) {
                        get_view(file_properties_obj[prop]);
                    } else {
                        open(file_properties_obj[prop]);
                    }
                });

                col2.append(link);

                // Directory
                if (stats.isDirectory()) {
                    let img = add_img(folder_icon);
                    img.src = img.dataset.src;
                    img.classList.remove("lazy");
                    image.append(img);

                    col1.append(image);
                    div.append(col1, col2);

                    // Files
                } else {
                    ipcRenderer
                        .invoke("get_icon", card.dataset.href)
                        .then((res) => {
                            let img = document.createElement("img");
                            img.src = res;
                            image.append(img);
                        });
                    col1.append(image);
                    div.append(col1, col2);
                }

                break;
            case "Contents":
                col1.append(prop);
                col2.dataset.contents = filename;
                div.append(col1, col2);

                ipcRenderer
                    .invoke("get_folder_count_recursive", filename)
                    .then((res) => {
                        col2.append(res + " Folders, ");
                    });

                ipcRenderer
                    .invoke("get_file_count_recursive", filename)
                    .then((res) => {
                        col2.append(res + " Files ");
                    });

                break;
            case "Size":
                col1.append(prop);
                col2.append(get_file_size(localStorage.getItem(filename)));
                div.append(col1, col2);

                break;
            default:
                col1.append(prop);
                col2.append(`${file_properties_obj[prop]}`);
                div.append(col1, col2);

                break;
        }

        if (ext === ".sh") {
            content.append(div, execute_chk_div);
        } else {
            content.append(div);
        }
    }

    card.append(content);
    sb_items.appendChild(card);

    localStorage.setItem("sidebar", 1);
    show_sidebar();
}

/**
 * Send a request to main to get file properties
 */
async function get_file_properties() {
    file_properties_arr = [];
    let sb_items = document.getElementById("sidebar_items");
    let main_view = document.getElementById("main_view");
    let items = document.querySelectorAll(
        ".highlight_select, .highlight, .ds-selected"
    );

    if (items.length > 0) {
        sb_items.innerHTML = "";

        items.forEach((item) => {
            file_properties_arr.push(item.dataset.href);
            ipcRenderer.send("get_file_properties", file_properties_arr);
            file_properties_arr = [];
        });

        clear_items();
    } else {
        sb_items.innerHTML = "";
        let href = breadcrumbs.value;
        file_properties_arr.push(href);
        ipcRenderer.send("get_file_properties", file_properties_arr);
        file_properties_arr = [];
    }
}

// Get sidebar info
async function get_info() {
    let file_properties = document.getElementById("file_properties");
    if (file_properties) {
        file_properties.classList.remove("hidden");
    }
}

// UPDATE PROGRESS
function update_progress(val) {
    let progress = document.getElementById("progress");
    progress.value = val;
}

function set_progress_msg(msg) {
    let progress_div = document.getElementById("progress_div");
    let progress_msg = document.getElementById("progress_msg");

    progress_div.classList.remove("hidden");
    progress_msg.innerText = msg;
}

let prog_state = 0;

function set_progress(max, value) {
    if (prog_state === 0) {
        prog_state = 1;
        let progress_div = document.getElementById("progress_div");
        let progress = document.getElementById("progress");
        let progress_msg = document.getElementById("progress_msg");

        progress_div.classList.remove("hidden");
        progress.classList.remove("hidden");
        progress.value = 0;
        progress.max = parseInt(max);
    }

    progress.value = parseInt(value);

    if (value === max) {
        prog_state = 0;
        progress.value = 0;
        progress_msg = "";
        progress_div.classList.add("hidden");
    }
}

/**
 * Show progress for file operations
 * @param {int} max
 * @param {string} destination_folder // folder to update after progress stops
 */
function get_progress(total) {
    let breadcrumbs = document.getElementById("breadcrumbs");
    let progress_div = document.getElementById("progress_div");
    let progress = document.getElementById("progress");
    let cancel = document.getElementById("cancel_operation");

    cancel.onclick = (e) => {
        ipcRenderer.send("cancel");
    };

    if (total > 0) {
        progress_div.classList.remove("hidden");
        progress.classList.remove("hidden");
        progress.value = 0;

        // CONVERT TO KB
        // max = max / 1024
        total = total / 1024;

        let cmd = "du -s '" + breadcrumbs.value + "' | awk '{print $1}'";
        exec(cmd, (err, stdout) => {
            if (!err) {
                let start_size = parseInt(stdout);

                if (start_size > 0) {
                    progress.max = total;

                    let current_size0 = 0;
                    let current_size = 0;
                    let progress_size = 0;

                    let interval_id = setInterval(() => {
                        cmd =
                            "du -s '" +
                            breadcrumbs.value +
                            "' | awk '{print $1}'";
                        exec(cmd, (err, stdout, stderr) => {
                            if (!err) {
                                current_size0 = current_size;

                                // Get new size and subtract the start size
                                current_size = parseInt(stdout) - start_size;
                                progress_size =
                                    parseInt(current_size / total) * 100;
                                progress.value = current_size;

                                if (current_size0 >= current_size) {
                                    progress.value = 0;
                                    progress_div.classList.add("hidden");
                                    progress.classList.add("hidden");

                                    update_cards2();
                                    clearInterval(interval_id);
                                }
                            }
                        });
                    }, 1000);
                }
            }
        });
    }
}

/**
 * Get available application launchers for use in the Context Menu.
 * The function parses the mimeinfo.cache file to extract assiciated apps
 * @param {string} filetype
 * @param {string} source
 * @returns Array of application launchers
 */
function get_available_launchers(filetype, source) {
    let launchers = [];
    try {
        let cmd =
            "grep '" + filetype + "' /usr/share/applications/mimeinfo.cache";
        let desktop_launchers = execSync(cmd)
            .toString()
            .replace(filetype + "=", "")
            .split(";");

        if (desktop_launchers.length > 0) {
            for (let i = 0; i < desktop_launchers.length; i++) {
                let filepath = path.join(
                    "/usr/share/applications",
                    desktop_launchers[i]
                );

                if (!fs.statSync(filepath).isDirectory()) {
                    // GET DESKTOP LAUNCHER EXECUTE PATH
                    cmd = "grep '^Exec=' " + filepath;
                    let exec_path = execSync(cmd).toString().split("\n");

                    // GET LAUNCHER NAME
                    cmd = "grep '^Name=' " + filepath;
                    let exec_name = execSync(cmd).toString().split("\n");

                    // GET MIME TYPE
                    cmd = "xdg-mime query filetype '" + source + "'";
                    let exec_mime = execSync(cmd).toString();
                    let options = {
                        name: exec_name[0].replace("Name=", ""),
                        icon: "",
                        exec: exec_path[0].replace("Exec=", ""),
                        desktop: desktop_launchers[i],
                        mimetype: exec_mime,
                    };
                    launchers.push(options);
                }
            }
        }
    } catch (err) {
        let options = {
            name: "Code", //exec_name[0].replace('Name=', ''),
            icon: "",
            exec: '/usr/bin/code "' + source + '"',
            desktop: "", //desktop_launchers[i],
            mimetype: "application/text",
        };

        launchers.push(options);
    }

    return launchers;
}

// SET DEFAULT LAUNCHER
function set_default_launcher(desktop_file, mimetype) {
    // xdg-mime default vlc.desktop
    let cmd = "xdg-mime default " + desktop_file + " " + mimetype;
    try {
        execSync(cmd);
    } catch (err) {
        notification(err);
    }
}

// GET NETWORK
// todo: this probrably needs to be removed
async function get_network() {
    let network_grid = document.getElementById("network_grid");
    network_grid.innerHTML = "";

    let menu_items = add_div();
    menu_items.classList.add("ui", "items");

    let dir = "/run/user/1000/gvfs/";

    fs.readdir(dir, function (err, files) {
        if (err) {
            console.log(err);
        } else {
            if (files.length > 0) {
                let content = add_div();
                content.classList.add("item");

                files.forEach((file, idx) => {
                    let filename = path.join("/run/user/1000/gvfs/", file);

                    // CREATE HREF ELEMENT
                    let href = document.createElement("a");
                    let icon = document.createElement("i");
                    let icon_phone = document.createElement("i");
                    let menu_item = add_div();

                    href.href = filename;
                    href.text = file;
                    href.dataset.uuid = filename;
                    href.title = filename;

                    href.classList.add("block", "header_link");
                    icon.classList.add("icon", "hdd");
                    icon.style.marginLeft = "15px";
                    icon_phone.classList.add("icon", "mobile", "alternate");
                    menu_item.classList.add("item");

                    menu_item.appendChild(icon);
                    content.appendChild(href);
                    menu_item.appendChild(content);
                    menu_items.appendChild(menu_item);

                    network_grid.appendChild(menu_items);

                    href.addEventListener("click", (e) => {
                        get_view(filename);
                    });
                });

                network_grid.closest(".content").classList.add("active");
            }
        }
    });
}

// GET TRANSFER SPEED
function get_transfer_speed(source_size, destination_size, elapsed_time) {
    let transfer_speed = parseInt(destination_size) / parseInt(elapsed_time);
    let transfer_time = parseInt(source_size) / parseInt(transfer_speed);
    let transfer_data_amount =
        parseInt(transfer_speed) * parseInt(transfer_time);

    let options = {
        transfer_speed: transfer_speed,
        transfer_time: transfer_time,
        transfer_data_amount: transfer_data_amount,
    };

    return options;
}

// ADD CARD //////////////////////////////////////////////////////////////////////
async function add_card(options) {
    try {
        // Options
        let id = options.id;
        let href = options.href;
        let linktext = options.linktext;
        let is_folder = options.is_folder;
        let grid = options.grid;
        let size = "";

        // Create elements
        let col = add_div();
        let card = add_div();
        let items = add_div();
        let item = add_div();
        let image = add_div();
        let content = add_div();
        let extra = add_div();
        let progress = add_div();
        let form_field = add_div();
        let popovermenu = add_div();
        let form_control = add_div();
        let progress_bar = add_progress();
        let header = document.createElement("a");
        let img = document.createElement("img");
        let audio = document.createElement("audio");
        let video = document.createElement("video");
        let source = document.createElement("source");
        let input = document.createElement("input");
        let form = document.createElement("form");

        col.classList.add("column", "three", "wide");
        popovermenu.classList.add("popup");

        // Card
        card.classList.add("ui", "card", "fluid", "nav_item", "nav", "lazy");
        card.draggable = "true";
        card.id = id;
        card.dataset.href = href;
        input.spellcheck = false;

        // Get Extension Name
        let ext = path.extname(href).toLocaleLowerCase();
        image.appendChild(img);

        // Handle Picture / Audio / Video Files
        let is_image = 0;
        let is_audio = 0;

        // Create items
        items.classList.add("ui", "items");

        // CREATE ITEM
        item.classList.add("item", "fluid");

        // CREATE IMAGE CLASS
        image.classList.add("image");

        // DISABLE IMAGE DRAG
        img.draggable = false;
        img.classList.add("icon", "lazy");
        let icon_size = localStorage.getItem("icon_size");

        switch (icon_size) {
            case "0": {
                image.classList.add("icon16");
                img.classList.add("icon16");
                break;
            }
            case "1": {
                image.classList.add("icon24");
                img.classList.add("icon24");
                break;
            }
            case "2": {
                image.classList.add("icon32");
                img.classList.add("icon32");
                break;
            }
            case "3": {
                image.classList.add("icon48");
                img.classList.add("icon48");
                break;
            }
            case "4": {
                image.classList.add("icon64");
                img.classList.add("icon64");
                break;
            }
        }

        // Folder
        if (is_folder) {
            card.classList.add("folder_card");
            img.classList.add("icon");
            img.dataset.src = folder_icon;
            // File
        } else {
            if (
                ext === ".png" ||
                ext === ".jpg" ||
                ext === ".gif" ||
                ext === ".webp" ||
                ext === ".jpeg"
            ) {
                is_image = 1;
                img.classList.add("img", "lazy");
            } else if (ext === ".svg") {
                img.dataset.src = img.dataset.src = href;
            } else if (
                ext === ".m4a" ||
                ext === ".mp3" ||
                ext === ".wav" ||
                ext === ".ogg"
            ) {
                is_audio = 1;
            } else if (ext === ".mp4" || ext === ".webm") {
                img.remove();
                source.src = href;
                video.append(source);
                content.append(video);

                video.onclick = (e) => {
                    open(href);
                };
            }
            card.classList.add("file_card");
        }

        // CARD CLICK
        card.addEventListener("click", function (e) {
            e.stopPropagation();
            // CRTRL+SHIFT ADD TO WORKSPACE
            if (e.ctrlKey === true && e.shiftKey === true) {
                add_workspace();

                // MULTI SELECT
            } else if (e.ctrlKey === true) {
                if (
                    card.classList.contains(
                        "highlight_select",
                        "highlight",
                        "ds-selected"
                    )
                ) {
                    card.classList.remove(
                        "highlight_select",
                        "highlight",
                        "ds-selected"
                    );
                } else {
                    card.classList.add("highlight_select");
                }

                // SINGLE SELECT
            } else {
                clear_items();

                // HIGHLIGHT
                if (this.classList.contains("highlight_select")) {
                    this.classList.remove("highlight_select");
                } else {
                    // NAV COUNTER
                    nc = parseInt(card.dataset.id);
                    this.classList.add("highlight_select");

                    if (prev_card) {
                        prev_card.classList.remove("highlight_select");
                        prev_card = this;
                    } else {
                        prev_card = this;
                    }
                }
            }
        });

        // LISTEN FOR CONTEXT MENU. LISTEN ONLY DONT SHOW A MENU HERE !!!!!!
        card.oncontextmenu = (e) => {
            // SET GLOBAL CARD_ID
            card_id = card.id;
            source = href;

            if (is_folder) {
                card.classList.add("folder_card", "ds-selected");
            } else {
                card.classList.add("file_card", "ds-selected");
            }
        };

        // MOUSE OVER
        card.onmouseover = (e) => {
            card_id = id;
            active_href = href;

            card.classList.add("highlight");
            nc = nc2;
            nc2 = parseInt(card.dataset.id);

            /* Add audio controls on mouse over */
            if (is_audio) {
                source.src = href;
                audio.setAttribute("controls", "");
                audio.style = "height: 15px; width: 100%;";
                audio.classList.add("audio");
                audio.append(source);
                card.append(audio);
            }

            if (is_folder) {
                ipcRenderer.send("active_folder", href, 0);
            }
        };

        //  OUT
        card.onmouseout = (e) => {
            card.classList.remove("highlight");
            audio.removeAttribute("controls");
        };

        // IMG CLICK
        img.addEventListener("click", function (e) {
            e.preventDefault();

            historize = 1;
            back_counter = 1;

            if (is_folder) {
                get_view(href);
            } else {
                open(href, { wait: false });
            }
        });

        img.onmouseover = () => {
            get_image_properties(href);
        };

        // CREATE CONTENT
        content.classList.add("content");
        content.style = "overflow-wrap: break-word;";

        // CREATE HEADER
        header.href = href;
        header.text = linktext;
        header.title = "open file? " + href;
        header.id = "header_" + id;
        header.classList.add("header_link");
        header.draggable = false;

        header.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            historize = 1;
            back_counter = 1;

            if (is_folder) {
                get_view(href);
            } else {
                open(href, { wait: false });
            }
        });

        // HEADER MOUSE OVER
        header.addEventListener("mouseover", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (is_folder) {
                card_id = id;
            }
        });

        // FOR EDIT MODE
        input.id = "edit_" + id;
        input.classList.add("hidden", "input");
        input.type = "text";
        input.spellcheck = false;
        input.value = linktext;

        // CHANGE EVENT
        input.addEventListener("change", function (e) {
            e.preventDefault();

            if (this.value === "") {
                alert("enter a name");
            } else {
                card.classList.add("highlight_select");
                source = path.dirname(href) + "/" + this.value.trim();

                // RENAME FILE
                if (!fs.existsSync(source)) {
                    rename_file(href, this.value.trim());
                    this.classList.add("hidden");
                    href = path.dirname(href) + "/" + this.value;
                    card.dataset.href = href;
                    header.classList.remove("hidden");
                    header.text = this.value;
                    header.href = href;
                    header.title =
                        "open file? " + path.dirname(href) + "/" + this.value;
                    card.classList.remove(
                        "highlight_select",
                        "highlight",
                        "ds-selected"
                    );
                } else {
                    notification(`err ${path.basename(href)} already exists..`);
                }
            }
        });

        // KEYDOWN EVENT
        input.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                // CLEAR ITEMS
                clear_items();

                // CLEAR COPY ARRAY
                clear_copy_arr();
            }
        });

        // INPUT CLICK
        input.addEventListener("click", function (e) {
            e.stopPropagation();
            e.preventDefault();
        });

        form_control = add_div();

        form_field.appendChild(input);
        form_control.appendChild(form_field);
        form.appendChild(form_control);

        form.preventDefault = true;

        let description = add_div();
        description.classList.add("description", "no-wrap");
        description.draggable = false;

        extra.classList.add("extra");

        // ON DRAG START
        card.ondragstart = function (e) {
            e.dataTransfer.effectAllowed = "copyMove";
            add_copy_file();
        };

        // INITIALIZE COUNTER
        let dragcounter = 0;

        // ON DRAG ENTER
        card.ondragenter = function (e) {
            e.preventDefault();
            e.stopPropagation();

            dragcounter++;
            let target = e.target;

            // CARD. NOTE. THIS SEEMS BACKWARDS BUT WORKS AND IS ESSENTIAL FOR SETTING THE CORRECT TARGET PATH. NOT SURE WHY ??
            if (target.id == "") {
                destination = href;
            } else {
                destination = breadcrumbs.value;
            }

            let main_view = document.getElementById("main_view");
            main_view.classList.add("selectableunselected");
            main_view.draggable = false;

            if (e.ctrlKey === true) {
                e.dataTransfer.dropEffect = "copy";
            } else {
                e.dataTransfer.dropEffect = "move";
            }

            return false;
        };

        // DRAG OVER
        card.ondragover = function (e) {
            // ADD HIGHLIGHT
            card.classList.add("highlight");

            if (e.ctrlKey === true) {
                e.dataTransfer.dropEffect = "copy";
            } else {
                e.dataTransfer.dropEffect = "move";
            }

            ipcRenderer.send("active_folder", href);
            ipcRenderer.send("is_main_view", 0);

            e.preventDefault();
            e.stopPropagation();

            return false;
        };

        // ON DRAG LEAVE
        card.ondragleave = function (e) {
            e.preventDefault();
            e.stopPropagation();

            dragcounter--;

            // todo: this is breaking drag and drop on workspace
            card.classList.remove("highlight");

            if (dragcounter === 0) {
                // TURN DRAGGABLE ON MAIN CARD ON
                let main_view = document.getElementById("main_view");
            }
            return false;
        };

        card.appendChild(items);
        items.appendChild(item);
        item.appendChild(image);
        item.appendChild(content);
        content.appendChild(header);
        content.appendChild(form_control);
        content.appendChild(description);
        content.appendChild(extra);
        col.appendChild(card);

        if (grid) {
            grid.appendChild(col);
        }
        return card;
    } catch (err) {
        console.log("error adding card", err);
    }
}

/**
 * String Formated Date Time
 * @param {object} date
 * @returns String formated date
 */
function get_date(date) {
    try {
        let d = new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(date));
        return d;
    } catch (err) {
        console.log(err);
    }
}

/**
 * Create a File Card for the Grid View
 * @param {object} file
 * @returns File Card
 */
function get_card1(file) {
    // this is being used

    let card = add_div();
    let icon = document.createElement("img");
    let link = add_link(file.href, file.name);
    let input = document.createElement("input");
    let date = add_div();
    let size = add_div();
    let icon_col = add_div();
    let info_col = add_div();
    let audio = document.createElement("audio");
    let video = document.createElement("video");
    let source = document.createElement("source");

    let is_image = 0;
    let is_svg = 0;
    let is_audio = 0;
    let is_video = 0;
    let is_pdf = 0;

    let icon_size = localStorage.getItem("icon_size");

    input.type = "text";
    input.value = path.basename(file.name);
    input.classList.add("hidden", "input");
    icon.draggable = false;
    icon_col.classList.add("col", "icon_col");
    info_col.classList.add("col", "info_col");
    link.draggable = false;

    card.draggable = true;
    card.classList.add("card", "flex", "nav_item");
    link.classList.add("header_link");
    icon.classList.add("icon");
    size.classList.add("size");
    date.classList.add("date");

    icon_col.append(icon);

    let badge = add_icon("add");
    info_col.append(input, link, date, size);

    audio.append(source);
    card.append(icon_col, info_col);
    card.dataset.href = file.href;

    if (file["access::can-write"] === "FALSE") {
        card.style = "opacity: 0.6 !important";
    }

    // Directory
    if (file.is_dir || file.type === "directory") {
        card.classList.add("folder_card");
        icon.src = folder_icon;

        // Directory event listeners
        link.addEventListener("click", (e) => {
            e.preventDefault();
            get_view(file.href);
        });
        icon.addEventListener("click", (e) => {
            e.preventDefault();
            get_view(file.href);
        });

        // Setting folder size
        if (!is_gio_file(file.href)) {
            ipcRenderer.invoke("get_folder_size1", file.href).then((res) => {
                if (parseInt(res) > 4) {
                    file.size = parseInt(res) * 1024;
                    size.innerHTML = get_file_size(file.size); //get_file_size(parseInt(res.replace('.', '') * 1024))
                    localStorage.setItem(file.href, file.size);
                } else {
                    size.innerHTML = "0 Items";
                }
            });
        } else {
            size.innerHTML = "";
        }
    } else {
        card.classList.add("file_card");
        size.innerHTML = get_file_size(file.size);
        localStorage.setItem(file.href, file.size);

        if (
            file.ext === ".jpg" ||
            file.ext === ".png" ||
            file.ext === ".jpeg"
        ) {
            is_image = 1;
        } else {
            is_image = 0;
        }
        if (file.ext === ".svg") {
            is_svg = 1;
        } else {
            is_svg = 0;
        }
        if (file.ext === ".pdf") {
            is_pdf = 1;
        }
        if (
            file.ext === ".m4a" ||
            file.ext === ".mp3" ||
            file.ext === ".wav" ||
            file.ext === ".ogg"
        ) {
            is_audio = 1;
        } else {
            is_audio = 0;
        }

        if (is_image) {
            icon.classList.add("img");
            let thumbnail = path.join(thumbnails_dir, path.basename(file.href));

            if (fs.existsSync(thumbnail)) {
                icon.dataset.src = thumbnail;
                icon.classList.add("icon", "lazy");
            } else {
                if (process.platform === "linux") {
                    if (is_gio_file(file.href)) {
                        gio.cp(file.href, thumbnails_dir, (res) => {
                            if (res.err) {
                                notification(err);
                            }
                        });
                    } else {
                        let cmd =
                            'gdk-pixbuf-thumbnailer "' +
                            file.href +
                            '" "' +
                            thumbnail +
                            '"';
                        exec(cmd, (err, stdout, stderr) => {
                            if (!err) {
                                icon.src = thumbnail;
                            }
                        });
                    }
                } else {
                    im.resize(
                        {
                            srcPath: file.href,
                            dstPath: thumbnail,
                            width: 128,
                        },
                        (err, stdout, stderr) => {
                            if (!err) {
                                icon.src = thumbnail;
                                notification("");
                            }
                        }
                    );
                }
            }
        } else if (is_svg) {
            if (is_gio_file(file.href)) {
                ipcRenderer
                    .invoke("get_icon", path.basename(file.href))
                    .then((res) => {
                        icon.src = res;
                    });
            } else {
                icon.classList.add("lazy", "svg");
                icon.dataset.src = file.href;
            }
        } else {
            ipcRenderer
                .invoke("get_icon", path.basename(file.href))
                .then((res) => {
                    icon.src = res;
                });
        }

        if (is_pdf && !is_gio_file(file.href)) {
            iframe = document.createElement("iframe");
            iframe.dataset.src = file.href;
            iframe.style =
                "transform: scale(.5); width: 120px; height: 84px; overflow: hidden;";
            iframe.classList.add("lazy");
            icon.remove();
            card.prepend(iframe);
        }
    }

    card.onclick = (e) => {
        if (
            card.classList.contains("highlight_select") &&
            !card.classList.contains("workspace_card")
        ) {
            card.classList.remove("highlight_select", "ds-selected");
        } else if (!card.classList.contains("workspace_card")) {
            card.classList.add("highlight_select");
            notification(
                `${path.basename(file.href)} Selected. (${get_file_size(
                    file.size
                )})`
            );
        }
    };

    card.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (file.is_dir) {
            card.classList.add("folder_card", "ds-selectable", "ds-selected");

            let filetype = mime.lookup(file.href);
            let associated_apps = get_available_launchers(filetype, file.href);
            ipcRenderer.send("show-context-menu-directory", associated_apps);
        } else {
            card.classList.add("file_card", "ds-selectable", "ds-selected");

            let filetype = mime.lookup(file.href);
            let associated_apps = get_available_launchers(filetype, file.href);

            let access = file["access::can-execute"];
            ipcRenderer.send("show-context-menu-files", {
                apps: associated_apps,
                access: access,
                href: file.href,
            });
        }
    };

    let mtime = "";
    let atime = "";
    let ctime = "";

    // Mouse over
    card.onmouseover = (e) => {
        e.preventDefault();
        e.stopPropagation();

        active_href = file.href;
        card.classList.add("highlight");

        let size = get_file_size(localStorage.getItem(file.href));
        card.title =
            "Name: " +
            file.href +
            "\n" +
            "Size: " +
            size +
            "\n" +
            "Accessed: " +
            gio.getDateTime(file["time::access"]) +
            "\n" +
            "Modified: " +
            gio.getDateTime(file["time::modified"]) +
            "\n" +
            "Created: " +
            gio.getDateTime(file["time::created"]);

        if (is_audio) {
            source.src = file.href;
            audio.setAttribute("controls", "");
            audio.style = "height: 15px; width: 100%;";
            audio.classList.add("audio");
            audio.append(source);
            card.append(audio);
        }
    };

    // Out
    card.onmouseout = (e) => {
        card.classList.remove("highlight");
        audio.removeAttribute("controls");
    };

    // On drag start
    card.ondragstart = (e) => {
        e.dataTransfer.effectAllowed = "copyMove";
        add_copy_file();
    };

    // On drag enter
    card.ondragenter = (e) => {
        e.preventDefault();
        e.stopPropagation();

        let target = e.target;
        destination = card.dataset.href;

        if (e.ctrlKey === true) {
            e.dataTransfer.dropEffect = "copy";
        } else {
            e.dataTransfer.dropEffect = "move";
        }

        return false;
    };

    // Drag over
    card.ondragover = (e) => {
        if (file.is_dir) {
            card.classList.add("highlight");

            if (e.ctrlKey === true) {
                e.dataTransfer.dropEffect = "copy";
            } else {
                e.dataTransfer.dropEffect = "move";
            }

            ipcRenderer.send("active_folder", card.dataset.href);
            ipcRenderer.send("is_main_view", 0);

            e.preventDefault();
            e.stopPropagation();

            return false;
        }
    };

    // On drag leave
    card.ondragleave = (e) => {
        e.preventDefault();
        e.stopPropagation();

        card.classList.remove("highlight");
        return false;
    };

    input.onkeyup = (e) => {
        e.stopPropagation();

        if (e.key === "Enter" || e.key === "Tab") {
            if (input.value === "") {
                alert("enter a name");
            } else {
                source = path.join(path.dirname(file.href), input.value.trim());

                if (!fs.existsSync(source)) {
                    let input_value = input.value.trim();
                    input.classList.add("hidden");
                    link.classList.remove("hidden");

                    rename_file(file.href, input_value, (res) => {
                        if (res) {
                            href = path.dirname(file.href) + "/" + input_value;
                            card.dataset.href = href;
                            file.href = href;

                            update_card1(href);
                        }
                    });
                } else {
                    notification(
                        `Error: ${path.basename(file.href)} already exists..`
                    );
                }
            }
        }
    };

    // Directory event listeners
    link.onclick = (e) => {
        e.preventDefault();
        if (file.is_dir || file.type === "directory") {
            get_view(file.href);
        } else {
            open(file.href);
        }
    };

    icon.onclick = (e) => {
        e.preventDefault();
        if (file.is_dir || file.type === "directory") {
            get_view(file.href);
        } else {
            open(file.href);
        }
    };

    date.innerHTML = gio.getDateTime(file["time::modified"]);

    switch (icon_size) {
        case "0": {
            icon.classList.add("icon16");
            break;
        }
        case "1": {
            icon.classList.add("icon24");
            break;
        }
        case "2": {
            icon.classList.add("icon32");
            break;
        }
        case "3": {
            icon.classList.add("icon48");
            break;
        }
        case "4": {
            icon.classList.add("icon64");
            break;
        }
    }
    try {
        ds.addSelectables(card);
    } catch (err) {}

    return card;
}

/**
 * Update Card File Statistics
 * @param {string} href // Path to File
 *
 */
function update_card1(href) {
    let cards = document.querySelectorAll(`[data-href="${href}"]`);
    get_file(href, (file) => {
        cards.forEach((card) => {
            card.dataset.href = file.href;
            let header = card.querySelector(".header_link");
            let size = card.querySelector(".size");
            let date = card.querySelector(".date");

            header.innerHTML = file.name;
            header.href = file.href;
            header.title = file.href;
            date.innerHTML = get_date(
                new Date(parseInt(file["time::modified"]) * 1000)
            );

            if (!is_gio_file(href)) {
                if (file.type === "directory") {
                    ipcRenderer.invoke("get_folder_size1", href).then((res) => {
                        size.innerHTML = get_file_size(
                            parseInt(res.replace(".", "") * 1024)
                        );
                        localStorage.setItem(
                            href,
                            parseInt(res.replace(".", "") * 1024)
                        );
                    });
                } else {
                    size.innerHTML = get_file_size(file.size);
                }
            } else {
                size.innerHTML = "";
            }

            card.onmouseover = (e) => {
                active_href = file.href;
                card.classList.add("highlight");

                size = get_file_size(localStorage.getItem(file.href));
                card.title =
                    "Name: " +
                    file.href +
                    "\n" +
                    "Size: " +
                    size +
                    "\n" +
                    "Accessed: " +
                    gio.getDateTime(file["time::access"]) +
                    "\n" +
                    "Modified: " +
                    gio.getDateTime(file["time::modified"]) +
                    "\n" +
                    "Created: " +
                    gio.getDateTime(file["time::created"]);
            };
        });
    });
}

function update_cards2() {
    let folder_cards = document.querySelectorAll(".folder_card");
    folder_cards.forEach((card) => {
        ipcRenderer
            .invoke("get_folder_size1", card.dataset.href)
            .then((res) => {
                let size = card.querySelector(".size");
                size.innerHTML = get_file_size(
                    parseInt(res.replace(".", "") * 1024)
                );
                localStorage.setItem(
                    card.dataset.href,
                    parseInt(res.replace(".", "") * 1024)
                );
            });
    });
    let file_cards = document.querySelectorAll(".file_card");
    file_cards.forEach((file_card) => {
        gio.get_file(file_card.dataset.href, (file) => {
            let size = file_card.querySelector(".size");
            size.innerHTML = get_file_size(file.size);
        });
    });
}

function update_cards1(dir) {
    console.log("running update card");
    let cards = document.querySelectorAll(".nav_item");
    cards.forEach((card) => {
        update_card1(card.dataset.href);
    });
}

// Update card
function update_card(href) {
    if (fs.existsSync(href)) {
        let ext = path.extname(href);
        let cards = document.querySelectorAll('[data-href="' + href + '"]');
        cards.forEach((card) => {
            // Details
            let size = card.querySelector(".size");
            let date = card.querySelector(".date");
            let icon = card.querySelector(".icon");

            // Add data to card
            fs.stat(href, (err, stats) => {
                let mtime = new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(stats.mtime);
                let atime = new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(stats.atime);
                let ctime = new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(stats.birthtime);

                date.innerHTML = mtime;

                // HANDLE DIRECTORY
                if (stats.isDirectory()) {
                    icon.src = folder_icon;

                    try {
                        ipcRenderer
                            .invoke("get_folder_size1", href)
                            .then((res) => {
                                size.innerHTML = get_file_size(
                                    parseInt(res.replace(".", "") * 1024)
                                );
                                localStorage.setItem(
                                    href,
                                    parseInt(res.replace(".", "") * 1024)
                                );
                            });
                    } catch (err) {}

                    // CARD ON MOUSE OVER
                    card.addEventListener("mouseover", (e) => {
                        size = get_file_size(localStorage.getItem(href));
                        card.title =
                            "Name: " +
                            href +
                            "\n" +
                            "Size: " +
                            size +
                            "\n" +
                            "Accessed: " +
                            atime +
                            "\n" +
                            "Modified: " +
                            mtime +
                            "\n" +
                            "Created: " +
                            ctime;
                    });

                    // Files
                } else {
                    if (
                        ext === ".png" ||
                        ext === ".jpg" ||
                        ext === ".gif" ||
                        ext === ".jpeg"
                    ) {
                        is_image = 1;
                        icon.style =
                            "border: 2px solid #cfcfcf; background-color: #cfcfcf";
                        let destination = path.join(
                            thumbnails_dir,
                            path.basename(href)
                        );

                        if (fs.existsSync(destination)) {
                            icon.src = destination;
                            notification("");
                        } else {
                            notification("Saving thumbnails. Please wait.");

                            if (process.platform === "linux") {
                                let cmd =
                                    'gdk-pixbuf-thumbnailer "' +
                                    href +
                                    '" "' +
                                    destination +
                                    '"';
                                exec(cmd, (err, stdout, stderr) => {
                                    icon.src = destination;
                                });
                            } else {
                                im.resize(
                                    {
                                        srcPath: href,
                                        dstPath: destination,
                                        width: 128,
                                    },
                                    (err, stdout, stderr) => {
                                        icon.src = destination;
                                        notification("");
                                    }
                                );
                            }
                        }
                    } else if (ext === ".svg") {
                        icon.src = href;
                    } else if (
                        ext === ".m4a" ||
                        ext === ".mp3" ||
                        ext === ".wav" ||
                        ext === ".ogg"
                    ) {
                        is_audio = 1;

                        ipcRenderer.invoke("get_icon", href).then((res) => {
                            icon.src = res;
                            icon.dataset.src = res;
                        });
                    } else if (ext === ".mp4" || ext === ".webm") {
                        is_video = 1;
                        ipcRenderer.invoke("get_icon", href).then((res) => {
                            icon.src = res;
                            icon.dataset.src = res;
                        });
                    } else {
                        ipcRenderer.invoke("get_icon", href).then((res) => {
                            icon.src = res;
                            icon.dataset.src = res;
                        });
                    }

                    size = get_file_size(stats.size);
                    size.innerHTML = size;
                    localStorage.setItem(href, stats.size);

                    // Card on mouse over
                    card.addEventListener("mouseover", (e) => {
                        size = get_file_size(localStorage.getItem(href));
                        card.title =
                            "Name: " +
                            href +
                            "\n" +
                            "Size: " +
                            size +
                            "\n" +
                            "Accessed: " +
                            atime +
                            "\n" +
                            "Modified: " +
                            mtime +
                            "\n" +
                            "Created: " +
                            ctime;
                    });
                }

                ds.addSelectables(card);
            });
        });
    }
}

/**
 * Update Cards - this function adds additional file information
 * @param {*} view requires a valid view to update
 */
function update_cards(view) {
    try {
        let cards = view.querySelectorAll(".nav_item");
        let cards_arr = [];

        for (var i = 0; i < cards.length; i++) {
            cards_arr.push(cards[i]);
        }

        let size = "";
        let folder_counter = 0;
        let file_counter = 0;
        cards_arr.forEach((card, idx) => {
            // DRAG AMD DROP
            ds.addSelectables(card, false);

            let header = card.querySelector(".header_link");
            let img = card.querySelector(".image");

            // PROGRESS
            let progress = card.querySelector(".progress");
            let progress_bar = progress.querySelector("progress");

            // DETAILS
            let extra = card.querySelector(".extra");
            let description = card.querySelector(".description");

            let href = card.dataset.href;

            // ADD DATA TO CARD
            let stats = fs.statSync(href);
            if (stats) {
                let atime = new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(stats.atime);
                let mtime = new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(stats.mtime);
                let ctime = new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(stats.birthtime);

                card.dataset.id = idx + 1;
                description.innerHTML = mtime;

                // HANDLE DIRECTORY
                if (stats.isDirectory()) {
                    ++folder_counter;

                    card.id = "folder_card_" + folder_counter;
                    card.dataset.id = folder_counter + 1;
                    header.id = "header_folder_card_" + folder_counter;

                    card.classList.add("folder_card");

                    img.src = path.join(
                        icon_dir,
                        "-pgrey/places/scalable@2/network-server.svg"
                    );
                    img.height = "24px";
                    img.width = "24px";

                    ipcRenderer.send("get_folder_size", { href: href });

                    // CARD ON MOUSE OVER
                    card.addEventListener("mouseover", (e) => {
                        size = get_file_size(localStorage.getItem(href));
                        card.title =
                            "Name: " +
                            href +
                            "\n" +
                            "Size: " +
                            size +
                            "\n" +
                            "Accessed: " +
                            atime +
                            "\n" +
                            "Modified: " +
                            mtime +
                            "\n" +
                            "Created: " +
                            ctime;
                    });

                    // FILES
                } else {
                    ++file_counter;

                    card.id = "file_card_" + file_counter;
                    header.id = "header_file_card_" + file_counter;

                    progress.id = "progress_" + card.id;
                    progress_bar.id = "progress_bar_" + card.id;

                    card.classList.add("file_card");

                    size = get_file_size(stats.size);

                    extra.innerHTML = size;
                    localStorage.setItem(href, stats.size);

                    // CARD ON MOUSE OVER
                    card.addEventListener("mouseover", (e) => {
                        size = get_file_size(localStorage.getItem(href));
                        card.title =
                            "Name: " +
                            href +
                            "\n" +
                            "Size: " +
                            size +
                            "\n" +
                            "Accessed: " +
                            atime +
                            "\n" +
                            "Modified: " +
                            mtime +
                            "\n" +
                            "Created: " +
                            ctime;
                    });
                }
            }
        });
    } catch (err) {
        console.log(err);
    }

    file_count = 0;
    folder_count = 0;
}

/**
 * Display Loader
 */
function show_loader() {
    let loader = document.getElementById("loader");
    loader.classList.add("active");
    loader.style = "background: transparent !important";

    setTimeout(() => {
        if (loader.classList.contains("active")) {
            hide_loader();
            notification("Error Reading the Directory. Operation Timed Out");
        }
    }, 10000);
}

/**
 * Hide Loader
 */
function hide_loader() {
    let loader = document.getElementById("loader");
    loader.classList.remove("active");
}

// ADD BREADCUMBS
function add_pager_item(options) {
    let pager = document.getElementById("pager");

    let breadcrumbs = add_div();
    breadcrumbs.classList.add("ui", "breadcrumb");

    let section = add_link(options.name, options.name);
    section.classList.add("section", "active", "item");
    section.text = options.name;
    section.href = "#";

    let divider = add_div();
    divider.classList.add("divider");
    divider.innerText = "/";

    breadcrumbs.appendChild(section);
    breadcrumbs.appendChild(divider);
    pager.appendChild(breadcrumbs);

    section.addEventListener("click", function (e) {
        page = parseInt(options.name);
        pager.html = "";
        get_files(options.dir, () => {});
    });
}

// ADD LIST ITEM
function add_list_item(options) {
    let list_item = add_div();
    let list_item1 = add_div();
    let folder_icon = document.createElement("i");
    let content = add_div();
    let header = add_div();
    let description = add_div();

    list_item.classList.add("item");
    list_item1.classList.add("item");
    folder_icon.classList.add("folder", "icon", "large");
    content.classList.add("content");
    header.classList.add("header");
    description.classList.add("description");

    header.innerHTML = options.header;

    list_item.appendChild(folder_icon);
    list_item.appendChild(content);

    content.appendChild(header);
    content.appendChild(description);
    content.appendChild(list_item1);

    return list_item;
}

// RUN COMMAND
var execute = function (command, callback) {
    exec(command, { maxBuffer: 1024 * 500 }, function (error, stdout, stderr) {
        callback(error, stdout);
    });
};

let du = [];

/**
 * Get Disk Usage Information
 */
async function get_disk_usage() {
    let cmd = "df -Ph";
    let child = exec(cmd);
    child.stdout.on("data", (du_data) => {
        let du_grid = document.getElementById("du_grid");
        du_grid.innerHTML = "";
        let du = du_data.split("\n");
        for (let i = 0; i < du.length; i++) {
            let du_col = add_div();
            du_col.innerHTML = du[i] + "</br></br>";
            du_grid.appendChild(du_col);
        }
    });
}

// PAGER
function paginate(array, page_size, page_number) {
    // human-readable page numbers usually start with 1, so we reduce 1 in the first argument
    return array.slice((page_number - 1) * page_size, page_number * page_size);
}

// ADD TREE ITEM
function add_tree_item(options) {
    let filename = options.linktext;
    let filepath = options.href;

    let items = add_div();
    let item = add_div();
    let header = add_div();
    let icon_div = add_div();
    let icon = document.createElement("i");
    let chevron = add_icon("chevron");
    let subicon_div = add_div();
    let subicon = document.createElement("i");
    let href = document.createElement("a");
    let content = add_div();
    let subitems = add_div();
    let sidebar_items = document.getElementById("sidebar_items");

    icon.classList.add("right", "icon");
    items.classList.add("items", "tree_item");
    item.classList.add("item", "no-wrap");

    chevron.classList.add("right", "small");
    chevron.style = "float: left;";
    item.draggable = false;

    // CHECK FOR SUB DIRS
    let subdirs = "";
    try {
        subdirs = fs.readdirSync(filepath, { withFileTypes: true });
    } catch (err) {}

    if (subdirs.length > 0) {
    }

    href.src = filepath;
    href.text = filename + " (" + subdirs.length + ")";

    header.append(href);
    subitems.dataset.id = filename;

    if (subdirs.length > 0) {
        for (let i = 0; i < subdirs.length; i++) {
            let subfilename = subdirs[i].name;
            let subfilepath = path.join(filepath, "/", subfilename);

            let stats;
            try {
                stats = fs.statSync(subfilepath);
            } catch (err) {}

            if (stats) {
                if (stats.isDirectory()) {
                } else {
                }
            }

            subicon.classList.add("icon", "bi-folder", "tree_subicon");
            subicon_div.append(subicon);
        }
    } else {
        subicon.classList.add("icon", "bi-folder", "tree_subicon");
        subicon_div.append(subicon);
    }

    if (path.dirname(filepath) === "/media/michael") {
        subicon.classList.add("icon", "hdd", "outline");
    }

    content.appendChild(subicon_div);
    content.appendChild(header);

    items.appendChild(item);
    items.appendChild(subitems);
    item.appendChild(content);

    sidebar_items.append(items);
    item.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (chevron.classList.contains("right")) {
            chevron.classList.remove("right");
            chevron.classList.add("down");

            try {
                get_sidebar_files(filepath);
            } catch (err) {}
            subitems.classList.remove("hidden");
        } else {
            chevron.classList.add("right");
            chevron.classList.remove("down");

            subitems.classList.add("hidden");
        }
    });

    // TREE ICON CLICK
    chevron.addEventListener("click", function (e) {
        e.preventDefault();

        if (chevron.classList.contains("right")) {
            chevron.classList.remove("right");
            chevron.classList.add("down");

            try {
                get_sidebar_files(filepath);
            } catch (err) {}
            subitems.classList.remove("hidden");
        } else {
            chevron.classList.add("right");
            chevron.classList.remove("down");

            subitems.classList.add("hidden");
        }
    });

    href.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        get_view(filepath);
    });

    // HEADER CLICK
    header.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        e.preventDefault();

        if (chevron.classList.contains("right")) {
            chevron.classList.remove("right");
            chevron.classList.add("down");

            try {
                get_sidebar_files(filepath);
            } catch (err) {}
            subitems.classList.remove("hidden");
        } else {
            chevron.classList.add("right");
            chevron.classList.remove("down");

            subitems.classList.add("hidden");
        }
    });

    item.addEventListener("mouseover", function (e) {
        this.classList.add("highlight");
    });

    item.addEventListener("mouseout", function (e) {
        this.classList.remove("highlight");
    });

    return items;
}

/**
 * Display Folders in the Sidebar
 * @param {string} dir // Path to Directory
 */
async function get_sidebar_files(dir) {
    let sidebar_items = document.getElementById("sidebar_items");
    let sb_breadcrumbs = document.createElement("ul");
    let dirents = fs.readdirSync(dir, { withFileTypes: true });

    sidebar_items.innerHTML = "";
    sb_breadcrumbs.classList.add("uk-breadcrumb");

    if (dirents) {
        /* Make header dir selectable */
        let dir_arr = dir.split("/");
        let nav_path = "/";
        dir_arr.forEach((item, idx) => {
            nav_path = path.join(nav_path, item);

            let li = document.createElement("li");

            let link = add_link(nav_path, item);
            link.classList.add("nav_header", "section");
            link.dataset.src = nav_path;
            link.style = "font-size: 12px; color: red; padding: 2px;";
            link.style.color = "red";
            link.addEventListener("click", (e) => {
                e.preventDefault();
                get_sidebar_files(link.dataset.src);
                get_view(link.dataset.src);
            });

            if (idx > 0) {
                sidebar_items.append(link, "/");
            }
        });

        sidebar_items.append(add_br(), add_br());

        //SET DEFAULT SORT OPTION
        if (!options.sort) {
            options.sort = 1;
        }

        // SORT BY NAME
        let filter = dirents.sort((a, b) => {
            if (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase()) {
                return -1;
            }
            if (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase()) {
                return 1;
            }
            return 0;
        });

        const regex = /^\..*/;
        filter.forEach((file, idx) => {
            if (
                regex.test(file.name) === false ||
                localStorage.getItem("show_hidden") === 1
            ) {
                let filename = file.name;
                let filepath = dir + "/" + filename;
                let stats = fs.statSync(filepath);
                let is_dir = stats.isDirectory();

                if (is_dir) {
                    let options = {
                        id: "tree_" + idx,
                        href: filepath,
                        linktext: filename,
                        image: "../assets/icons/vscode/default_folder.svg",
                        is_folder: true,
                        grid: sidebar_items,
                        description: "",
                        size: 0,
                    };

                    add_tree_item(options);
                }
            }
        });
    }
}

// GET FILE FROM TEMPLATE
function get_templates(file) {
    let templates = fs.readdirSync("assets/templates");
}

// DISK USAGE CHART
var chart;

function add_chart(chart_type, chart_labels, chart_data) {
    const ctx = document.createElement("canvas");
    ctx.getContext("2d");
    ctx.id = "chart";
    ctx.width = 200;
    ctx.height = 100;

    chart = new Chart(ctx, {
        type: chart_type,
        data: {
            labels: chart_labels,
            datasets: [
                {
                    data: chart_data,
                    backgroundColor: [
                        "rgba(255, 132, 132, 0.2)",
                        "rgba(54, 162, 235, 0.2)",
                        "rgba(255, 206, 86, 0.2)",
                    ],
                    borderColor: [
                        "rgba(255, 99, 132, .5)",
                        "rgba(54, 162, 235, .5)",
                        "rgba(255, 206, 86, .5)",
                        "rgba(75, 192, 192, .5)",
                        "rgba(153, 102, 255, .5)",
                        "rgba(255, 159, 64, .5)",
                    ],
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: false,
            scales: {
                x: {
                    ticks: {
                        display: false,
                    },
                },
                y: {
                    beginAtZero: true,
                },
            },
            plugins: {
                legend: {
                    display: false,
                },
                footer: {
                    display: false,
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function (x) {
                            return get_file_size(
                                x.dataset.data[x.dataIndex] * 1024
                            );
                        },
                    },
                },
            },
        },
    });

    return ctx;
}

// DISK USAGE CHART
var disk_usage_chart;

function bar_chart(chart_labels, chart_data) {
    if (disk_usage_chart !== undefined) {
        disk_usage_chart.destroy();
    }

    const ctx = document.getElementById("myChart").getContext("2d");

    disk_usage_chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: chart_labels,
            datasets: [
                {
                    label: "",
                    data: chart_data,
                    backgroundColor: [
                        "rgba(255, 99, 132, 0.2)",
                        "rgba(54, 162, 235, 0.2)",
                        "rgba(255, 206, 86, 0.2)",
                        "rgba(75, 192, 192, 0.2)",
                        "rgba(153, 102, 255, 0.2)",
                        "rgba(255, 159, 64, 0.2)",
                    ],
                    borderColor: [
                        "rgba(255, 99, 132, 1)",
                        "rgba(54, 162, 235, 1)",
                        "rgba(255, 206, 86, 1)",
                        "rgba(75, 192, 192, 1)",
                        "rgba(153, 102, 255, 1)",
                        "rgba(255, 159, 64, 1)",
                    ],
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            indexAxis: "y",
            scales: {
                x: {
                    ticks: {
                        callback: function (value) {
                            return get_file_size(value);
                        },
                    },
                },
                y: {
                    beginAtZero: true,
                },
            },
            plugins: {
                legend: {
                    display: false,
                },
                footer: {
                    display: false,
                },
            },
        },
    });
}

// CHART OPTIONS
function get_disk_usage_chart() {
    let info_view = document.getElementById("info_view");

    let grid = add_div();
    grid.classList.add("ui", "grid");

    let col = add_div();
    col.classList.add("column", "sixteen", "wide");

    let cmd = "df '" + breadcrumbs.value + "'";
    let child = exec(cmd);

    let chart_labels = [];
    let chart_labels1 = [];
    let chart_data = [];

    child.stdout.on("data", (res) => {
        let res1 = res.split("\n");

        let headers = res1[0].split(" ");
        for (let i = 0; i < headers.length; i++) {
            if (headers[i] !== "") {
                chart_labels.push(headers[i]);
            }
        }

        let details = res1[1].split(" ");
        for (let i = 0; i < details.length; i++) {
            if (details[i] !== "") {
                chart_labels1.push(get_file_size(details[i]));
            }
        }

        for (let i = 0; i < details.length; i++) {
            if (details[i] !== "") {
                chart_data.push(details[i]);
            }
        }

        cmd = 'cd "' + breadcrumbs.value + '"; du -s';
        du = exec(cmd);

        du.stdout.on("data", function (res) {
            let size = parseInt(res.replace(".", ""));

            chart_labels.push("folder size");
            chart_data.push(size);

            if (size > 1000000000) {
                extra.innerHTML =
                    '<span style="color:red">' +
                    get_file_size(size) +
                    "</span>";
            }
            grid.append(col);
            let chart = add_chart("bar", chart_labels, chart_data);
            col.append(chart);
            info_view.append(grid);
        });
    });
}

// GET DISK SPACE
function get_diskspace(dir) {
    let cmd = 'df "' + dir + '"';
    let child = exec(cmd);

    child.stdout.on("data", (res) => {
        let status = document.getElementById("status");
        status.innerHTML = "";

        res = res.split("\n");

        for (let i = 1; i < res.length - 1; i++) {
            res1 = res[i].split(" ");

            if (res1.length > 0) {
                for (let i = 0; i < res1.length; i++) {
                    // 0 DISK
                    // 6 SIZE OF DISK
                    // 7 USED SPACE
                    // 8 AVAILABLE SPACE
                    // 10 PERCENTAGE USED
                    // 11 CURRENT DIR

                    if (res1[i] != "") {
                        let item = add_div();
                        item.style = "padding-right: 5px";

                        chart_labels.push("");
                        chart_data.push(res1[i]);

                        switch (i) {
                            case 6:
                                item.innerHTML =
                                    '<div class="item">Disk size: <b>&nbsp' +
                                    get_file_size(res1[i] * 1024) +
                                    "</b></div>";
                                break;
                            case 7:
                                item.innerHTML =
                                    '<div class="item">Used space: <b>&nbsp' +
                                    get_file_size(res1[i] * 1024) +
                                    "</b></div>";
                                break;
                            case 8:
                                item.innerHTML =
                                    '<div class="item">Available space: <b>&nbsp' +
                                    get_file_size(res1[i] * 1024) +
                                    "</b></div>";
                                break;
                        }

                        status.appendChild(item);
                    }
                }
                notification(chart_labels + " " + chart_data);
                get_disk_usage_chart(chart_labels, chart_data);
            }
        }

        cmd = 'cd "' + breadcrumbs.value + '"; du -s';
        du = exec(cmd);

        du.stdout.on("data", function (res) {
            let size = parseInt(res.replace(".", "") * 1024);
            size = get_file_size(size);

            let item1 = add_div();
            item1.innerHTML =
                '<div class="item">Folder Size: <b>&nbsp' + size + "</b></div>";
            status.appendChild(item1);

            let item2 = add_div();
            item2.innerHTML =
                '<div class="item"><b>' +
                directories.length +
                "</b>&nbsp Folders / <b>" +
                files.length +
                "</b>&nbsp Files</div>";
            status.appendChild(item2);
        });
    });
}

// GET DIR SIZE
async function get_dir_size(dir) {
    href = dir;
    cmd = "cd '" + href + "'; du -s";
    du = exec(cmd);
    return new Promise((resolve, reject) => [
        du.stdout.on("data", function (res) {
            let size = parseInt(res.replace(".", "") * 1024);
            resolve(size);
        }),
    ]);
}

// GET FOLDER SIZE
function get_flder_size(href) {
    return new Promise((resolve) => {
        let breadcrumbs = document.getElementById("breadcrumbs");
        if (breadcrumbs.value.indexOf("gvfs") === -1) {
            const regex = /^\..*/;
            let folder_card = document.getElementsByClassName("folder_card");

            if (folder_card.length > 0) {
                for (let i = 0; i < folder_card.length; i++) {
                    cmd = 'cd "' + href + '"; du -s';
                    du = exec(cmd);
                    du.stdout.on("data", function (res) {
                        let extra = folder_card[i].querySelector(".extra");

                        let size = parseInt(res.replace(".", "") * 1024);
                        if (size > 1000000000) {
                            extra.innerHTML =
                                '<span style="color:red">' +
                                get_file_size(size) +
                                "</span>";
                        } else {
                            extra.innerHTML = get_file_size(size);
                        }

                        resolve(size);
                    });
                }
            }
        } else {
            console.log("gvfs folder. dont scan size");
        }
    });
}

function get_folder_size1(href, callback) {
    cmd = 'cd "' + href + '"; du -s';
    du = exec(cmd);
    du.stdout.on("data", function (res) {
        let size = parseInt(res.replace(".", "") * 1024);
        callback(size);
    });
}

/**
 * Clear Highlighted Icon in the Minibar
 */
function clear_minibar() {
    let file_properties = document.getElementById("file_properties");
    let minibar_item = document.getElementById("minibar");
    minibar_items = minibar_item.querySelectorAll(".item");
    if (file_properties) {
        file_properties.classList.add("hidden");
    }

    minibar_items.forEach((item) => {
        item.style = "";
    });
}

// CLEAR WORKSPACE
function clear_workspace() {
    localStorage.setItem("workspace", "[]");
    let workspace = document.getElementById("workspace");
    workspace.innerHTML = "";
}

// ADD ITEM TO WORKSPACE
function add_workspace() {
    let cards = document.querySelectorAll(
        ".highlight, .highlight_select, .ds-selected"
    );
    let workspace_arr = [];

    if (localStorage.getItem("workspace") === null) {
        cards.forEach((card) => {
            let file = file_arr.filter((x) => x.href === card.dataset.href)[0];
            workspace_arr.push(file);
        });
        localStorage.setItem("workspace", JSON.stringify(workspace_arr));
    } else {
        workspace_arr = JSON.parse(localStorage.getItem("workspace"));
        cards.forEach((card) => {
            workspace_arr.every((local_item) => {
                if (card.dataset.href != local_item.href) {
                    let file = file_arr.filter(
                        (x) => x.href === card.dataset.href
                    )[0];
                    workspace_arr.push(file);
                    return false;
                } else {
                    return true;
                }
            });
        });

        localStorage.setItem("workspace", JSON.stringify(workspace_arr));
    }

    get_sidebar_view();
    clear_items();
}

/**
 * Get Workspace Items
 */
async function get_workspace() {
    clear_minibar();

    let local_items = "";
    let mb_workspace = document.getElementById("mb_workspace");
    let sb_items = document.getElementById("sidebar_items");
    let workspace = add_div();
    let workspace_msg = add_div();

    sb_items.innerHTML = "";
    workspace.id = "workspace";
    workspace_msg.id = "workspace_msg";

    mb_workspace.style = "color: #ffffff !important";
    workspace.style.height = "100%";

    if (localStorage.getItem("workspace") === null) {
        localStorage.setItem("minibar", "mb_workspace");
        workspace_msg =
            "To add files or folders to the workspace. Right Click, (Ctrl+D) or Drag and Drop";
    } else {
        // Workspace
        sidebar_items.append(add_header("Workspace"));
        local_items = JSON.parse(localStorage.getItem("workspace"));
        if (local_items != undefined) {
            if (local_items.length > 0 && local_items != undefined) {
                local_items.forEach((item, idx) => {
                    let div = add_div();
                    let col1 = add_div();
                    let col2 = add_div();
                    let rm_icon = add_icon("times");

                    rm_icon.classList.add("small");
                    rm_icon.style = "margin-left: auto;";

                    div.style = "display: flex; padding: 6px; width: 100%;";
                    div.classList.add("item");
                    col1.append(add_icon("bookmark"));
                    col2.append(item.name);
                    div.append(col1, col2, rm_icon);
                    workspace.append(div);
                    sidebar_items.append(workspace);

                    div.title = item.href;
                    div.onclick = (e) => {
                        gio.get_file(item.href, (file) => {
                            if (file.type == "directory") {
                                get_view(item.href);
                            } else {
                                open(item.href);
                            }
                        });
                    };

                    rm_icon.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        div.remove();
                        local_items.splice(idx, 1);
                        if (local_items.length > 0) {
                            localStorage.setItem(
                                "workspace",
                                JSON.stringify(local_items)
                            );
                        } else {
                            localStorage.removeItem("workspace");
                        }
                    };

                    div.oncontextmenu = (e) => {
                        div.classList.add("highlight_select");
                        ipcRenderer.send("show-context-menu-workspace", item);
                    };
                });
            }
        }
    }

    // Workspace on drag over
    workspace.ondragover = (e) => {
        return false;
    };

    // Workspace on drag leave
    workspace.ondragleave = (e) => {
        e.preventDefault();
        return false;
    };

    // Workspace content on drop
    workspace.ondrop = (e) => {
        add_workspace();
    };

    sb_items.append(workspace);
}

// todo: Move code for quick search from bottom
function quick_search() {}

// GET TIME STAMP
function get_time_stamp(date) {
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

/**
 *   Get view - Run all calls to files should run through this.
 */
async function get_view(dir) {
    // Set local storage
    localStorage.setItem("folder", dir);

    // Update active directory in main.js
    ipcRenderer.send("current_directory", dir);

    /* Set active on file menu */
    let file_menu = document.getElementById("file_menu");
    let file_menu_items = file_menu.querySelectorAll(".item");

    let sidebar_items = document.getElementById("sidebar_items");

    /* Get reference to list */
    let list_view = document.getElementById("list_view");

    file_menu_items.forEach((item) => {
        if (item.innerText === path.basename(dir)) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    let btn_list_view = document.getElementById("btn_list_view");
    btn_list_view.classList.add("active");
    btn_grid_view.classList.remove("active");
    btn_disk_view.classList.remove("active");

    list_view.classList.remove("hidden");
    list_view.innerHTML = "";

    info_view.classList.add("hidden");
    info_view.innerHTML = "";

    grid_view.classList.add("hidden");

    localStorage.setItem("view", "list");
    get_list_view(dir);

    /* Change target on view */
    ipcRenderer.send("is_main_view", 1);
    ipcRenderer.send("active_folder", dir, 1);
    ipcRenderer.send("current_directory", dir);
}

// Settings View
async function get_settings_view() {
    let main_view = document.getElementById("main_view");
    let grid_view = document.getElementById("grid_view");
    let info_view = document.getElementById("info_view");
    let message = add_message(
        "Be carfull editing these settings. There is currently no protection and you might break something!"
    );
    let tabs = document.getElementById("tabs");
    let tab_view = add_div();
    let tab = add_tab("Keyboard Shortuts");

    tabs.innerHTML = "";
    info_view.innerHTML = "";

    tabs.append(tab);

    info_view.classList.remove("hidden");
    info_view.classList.add("fm", "tab-content");
    message.classList.add("inverted");

    let views = document.querySelectorAll(".view");
    views.forEach((view) => {
        view.classList.add("hidden");
    });

    info_view.classList.remove("hidden");

    info_view.append(message);

    let div = add_div();
    let col1 = add_div();
    let col2 = add_div();
    let col3 = add_div();

    div.classList.add("fm", "grid", "item");
    col1.classList.add("fm", "col");
    col2.classList.add("fm", "col");

    col1.append(add_header("Command"));
    col2.append(add_header("Shortcut"));
    col3.append(add_header("Set Shortcut"));

    div.append(col1, col2);
    info_view.append(div);

    for (let shortcut in settings.keyboard_shortcuts) {
        let div = add_div();
        div.classList.add("fm", "grid", "item", "stripe");

        let col1 = add_div();
        let col2 = add_div();

        let label = add_label(shortcut, settings.keyboard_shortcuts[shortcut]);
        let input = add_input("text", shortcut);
        let set_shortcut = add_input("", 0);

        label.classList.add("settings_label");
        input.value = settings.keyboard_shortcuts[shortcut];
        input.classList.add("settings_input");

        col1.classList.add("fm", "col");
        col2.classList.add("fm", "col");

        col1.append(label);
        col2.append(input);

        div.append(col1, col2);

        info_view.append(div);

        input.addEventListener("change", (e) => {
            let key = input.id;
            settings.keyboard_shortcuts[key] = input.value;

            fs.writeFileSync(
                path.join(userdata_dir, "settings.json"),
                JSON.stringify(settings, null, 4)
            );

            ipcRenderer.send("reload_settings");
        });
    }
}

// GET DISK SUMMARY VIEW
async function get_disk_summary_view() {
    // ADD ARRAY
    let chart_labels = [];
    let labels = [];

    // INFO VIEW
    let view = document.getElementById("info_view");
    view.innerHTML = "";

    // GRID
    let grid = add_div();
    grid.classList.add("ui", "grid");

    // COMMAND
    let disks = execSync("df").toString().split("\n");
    disks_arr = disks.filter((a) => {
        return a !== "";
    });
    disks_arr.forEach((disk, i) => {
        // GRID FOR DATA
        let data_grid = add_div();
        data_grid.classList.add("ui", "grid", "fluid");

        let chart_data = [];

        // ADD COLUMN TO GRID
        let col = add_div();
        col.classList.add("column", "eight", "wide");

        // ADD CARD
        let card = add_div();
        card.classList.add("ui", "card", "fluid", "shadow");
        card.style = "border: 1px solid black;";

        let image = add_div();
        image.classList.add("image1");

        // ADD CONTENT
        let content = add_div();
        content.classList.add("content");

        // ADD HEADER
        let header = add_div();
        header.classList.add("header");

        // CREATE ARRAY OF DISK INFO
        let data = disk.split(" ");
        let data_arr = data.filter((a) => {
            return a !== "";
        });

        // LOOP OVER DATA ARRAY
        data_arr.forEach((item, ii) => {
            // GET LABELS
            if (i === 0) {
                labels.push(item);
            }

            // ADD CHART LABELS
            if (i === 0 && ii > 0 && ii < 4) {
                chart_labels.push(item);
                content.append(item);

                // ADD CHART DATA
            } else if (i > 0 && ii > 0 && ii < 4) {
                chart_data.push(parseInt(item));
            }

            // ADD FIRST ITEM AS HEADER
            if (ii === 0) {
                header.append(item);
                content.append(header, add_br(), add_br());

                // ADD DATA
            } else {
                // IF INTEGER THEN GET FILE SIZE
                if (ii > 0 && ii < 4) {
                    let data_col1 = add_column("three");
                    data_col1.append(labels[ii]);
                    data_col1.style = "border: none;";

                    let data_col2 = add_column("twelve");
                    data_col2.append(get_file_size(parseInt(item) * 1024));
                    data_col2.style = "border: none;";

                    data_grid.append(data_col1, data_col2);
                } else {
                    let data_col1 = add_column("three");
                    data_col1.append(labels[ii]);

                    let data_col2 = add_column("twelve");

                    // ADD LINK TO MOUNTED
                    if (ii >= data_arr.length - 1) {
                        let href = add_link(item, item);
                        href.addEventListener("click", (e) => {
                            e.preventDefault();
                            get_view(item);
                        });
                        data_col2.append(href);
                    } else {
                        data_col2.append(item);
                    }

                    data_grid.append(data_col1, data_col2);
                }
            }

            // ADD DATA GRID TO CONTENT
            content.append(data_grid);

            // ADD CONTENT TO CARD
            card.append(content);

            // ADD CARD TO COLUMN
            col.append(card);
        });

        // CREATE CHART
        if (i > 0) {
            let chart = add_chart("doughnut", chart_labels, chart_data);
            chart.style = "float:left";

            image.append(chart);
            content.prepend(image);

            content.style = "padding-bottom: 20px;";

            // ADD COLUMN TO GRID
            grid.append(col);
        }
    });

    // ADD GRID TO VIEW
    view.append(grid);

    get_disk_usage_chart();
}

// GET LIST VIEW
async function get_list_view(dir) {
    ipcRenderer.send("current_directory", dir);

    let list_view = document.getElementById("list_view");

    list_view.innerHTML = "";
    let sort = parseInt(localStorage.getItem("sort"));

    const breadcrumbs = document.getElementById("breadcrumbs");
    breadcrumbs.classList.add("ui", "breadcrumb");
    breadcrumbs.value = dir;
    breadcrumbs.title = dir;

    // SET FOLDER TO LOCAL STORAGE
    localStorage.setItem("folder", dir);

    // DEFINE COLUMNS
    let cols_arr = [
        {
            name: "Name",
            sort: 2,
            show: 1,
        },
        {
            name: "Git Status",
            show: 1,
        },
        {
            name: "Size",
            sort: 3,
            show: 1,
        },
        {
            name: "Modified",
            sort: 1,
            show: 1,
        },
        {
            name: "Type",
            sort: 4,
            show: 1,
        },
        {
            name: "Created",
            sort: 5,
            show: 0,
        },
    ];

    // READ DIRECTORY
    fs.readdir(dir, (err, dirents_arr) => {
        let colgroup = document.createElement("colgroup");
        let table = document.createElement("table");
        let thead = document.createElement("thead");
        let tr = document.createElement("tr");
        let tbody = document.createElement("tbody");

        thead.classList.add("full-width");
        table.style = "width: 100% ; background:transparent !important;";

        table.append(colgroup);
        table.append(thead);
        thead.append(tr);

        cols_arr.forEach((col, idx) => {
            let cols = document.createElement("col");
            colgroup.append(cols);

            if (col.show === 1) {
                let th = document.createElement("th");
                th.innerHTML = col.name;
                th.dataset.sort = idx + 1;
                th.id = `col${idx}-header`;

                th.addEventListener("click", (e) => {
                    let sort = col.sort;
                    localStorage.setItem("sort", sort);
                    get_list_view(dir);
                });

                if (col.name === "Name") {
                    th.classList.add("eight", "wide", "resizable");
                } else {
                    th.classList.add("two", "wide");
                }

                tr.append(th);
            }
        });

        // ADD TABLE TO LIST VIEW
        list_view.append(table);

        // REGEX FOR HIDDEN FILE
        const regex = /^\..*/;

        let dirents = [];
        let show_hidden = localStorage.getItem("show_hidden");
        if (show_hidden === "0" || show_hidden === "") {
            dirents = dirents_arr.filter((a) => !regex.test(a));
        } else {
            dirents = dirents_arr;
        }

        /* Get sort direction */
        let sort_direction = localStorage.getItem("sort_direction");
        let sort_flag = 0;
        if (sort_direction === "asc") {
            sort_flag = 1;
        }

        // SORT
        switch (parseInt(sort)) {
            // SORT BY DATE
            case 1: {
                // SORT BY DATE DESC
                dirents.sort((a, b) => {
                    try {
                        s1 = fs.statSync(path.join(dir, a)).mtime;
                        s2 = fs.statSync(path.join(dir, b)).mtime;
                        // SORT FLAG
                        if (sort_flag === 0) {
                            return s2 - s1;
                        } else {
                            return s1 - s2;
                        }
                    } catch (err) {
                        console.log(err);
                    }
                });
                break;
            }
            // SORT BY NAME
            case 2: {
                dirents.sort((a, b) => {
                    if (sort_flag === 0) {
                        return a
                            .toLocaleLowerCase()
                            .localeCompare(b.toLocaleLowerCase());
                    } else {
                        return b
                            .toLocaleLowerCase()
                            .localeCompare(a.toLocaleLowerCase());
                    }
                });
                break;
            }

            // SORT BY SIZE
            case 3: {
                dirents.sort((a, b) => {
                    let s1 = parseInt(localStorage.getItem(path.join(dir, a)));
                    let s2 = parseInt(localStorage.getItem(path.join(dir, b)));

                    if (sort_flag === 0) {
                        return s2 - s1;
                    } else {
                        s1 - s2;
                    }
                });
            }
        }

        // SORT FOLDER FIRST
        dirents.sort((a, b) => {
            let breadcrumbs = document.getElementById("breadcrumbs");
            let a_filename = path.join(breadcrumbs.value, a);
            let b_filename = path.join(breadcrumbs.value, b);

            a_stats = fs.statSync(a_filename);
            b_stats = fs.statSync(b_filename);

            return a_stats.isFile() === b_stats.isFile()
                ? 1
                : a_stats.isFile()
                ? 0
                : -1;
        });

        let file0 = "";

        // LOOP OVER FILES
        dirents.forEach((file, idx) => {
            file0 = file;

            // GET FILE NAME
            let filename = path.join(dir, file);

            try {
                // GET FILE STATS
                let stats = fs.statSync(filename);

                if (stats) {
                    let type = mime.lookup(filename);

                    if (!type) {
                        type = "inode/directory";
                    }

                    // CREATE HEADER
                    let header_link = add_link(filename, file);
                    header_link.classList.add("nav_item;", "header_link");

                    // CREATE INPUT
                    let input = document.createElement("input");
                    input.type = "text";
                    input.value = file;
                    input.spellcheck = false;
                    input.classList.add("hidden", "input");
                    input.setSelectionRange(
                        0,
                        input.value.length - path.extname(filename).length
                    );

                    // INPUT CHANGE EVENT
                    input.addEventListener("change", (e) => {
                        rename_file(filename, input.value);
                        input.classList.add("hidden");
                        header_link.classList.remove("hidden");
                        update_cards(document.getElementById("main_view"));
                    });

                    // CREATE TABLE ROW
                    let tr = document.createElement("tr");
                    tr.dataset.href = filename;
                    tr.classList.add("nav_item");
                    tr.draggable = "true";

                    // LOOP OVER COLUMNS
                    cols_arr.forEach((item) => {
                        let box = add_div();
                        box.style = "display:flex; align-items: center";

                        let td = document.createElement("td");
                        td.style = "color: #cfcfcf; vertical-align: middle;";

                        if (item.show == "1") {
                            // ADD DATA
                            switch (item.name) {
                                case "Name": {
                                    let icon = document.createElement("img");
                                    let stats = fs.statSync(header_link);

                                    icon.classList.add("icon", "icon24");

                                    if (stats.isDirectory()) {
                                        icon.src = folder_icon;
                                        icon.style = "margin-right: 15px";
                                        box.append(icon, header_link, input);
                                    } else {
                                        ipcRenderer
                                            .invoke("get_icon", filename)
                                            .then((res) => {
                                                icon.src = res;
                                                box.append(
                                                    icon,
                                                    header_link,
                                                    input
                                                );
                                            });
                                    }

                                    td.append(box);
                                    td.tabIndex = idx;

                                    // EDIT MODE
                                    td.addEventListener("keyup", (e) => {
                                        if (e.key === "F2") {
                                            header_link.classList.add("hidden");
                                            input.classList.remove(
                                                "hidden",
                                                "input"
                                            );
                                            input.select();
                                            input.focus();
                                        }

                                        if (e.key === "Escape") {
                                            input.classList.add("hidden");
                                            input.value = file0;
                                            header_link.classList.remove(
                                                "hidden"
                                            );
                                        }
                                    });

                                    td.onmousedown = (e) => {
                                        if (e.button === 2) {
                                            td.classList.add(
                                                "highlight_select"
                                            );
                                            ipcRenderer.send(
                                                "show-context-menu-files"
                                            );
                                            ipcRenderer.send(
                                                "show-context-menu-files",
                                                {
                                                    apps: null,
                                                    access: 0,
                                                    href: filename,
                                                }
                                            );
                                        }
                                    };

                                    td.onmouseup = (e) => {
                                        if (e.button === 2) {
                                            td.classList.remove(
                                                "highlight_select"
                                            );
                                        }
                                    };
                                    break;
                                }
                                case "Size": {
                                    td.append(
                                        get_file_size(
                                            localStorage.getItem(filename)
                                        )
                                    );
                                    break;
                                }
                                case "Modified": {
                                    td.append(
                                        new Intl.DateTimeFormat("en", {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        }).format(stats.mtime)
                                    );
                                    break;
                                }
                                case "Type": {
                                    td.append(type);
                                    break;
                                }
                                case "Created": {
                                    td.append(
                                        new Intl.DateTimeFormat("en", {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        }).format(stats.birthtime)
                                    );
                                    break;
                                }
                                case "Git Status": {
                                    if (stats.isDirectory()) break;

                                    let dirPath = dir.replaceAll(" ", "\\ ");
                                    let fileName = file.replaceAll('"', '\\"');
                                    let cmd = `cd ${dirPath} && git status -s "${fileName}"`;
                                    exec(cmd, (error, stdout, stderr) => {
                                        if (error) {
                                            console.error(`${error}`);
                                            return;
                                        }
                                        if (stderr) {
                                            console.error(`${stderr}`);
                                            return;
                                        }

                                        if (
                                            stdout[1] === "M" ||
                                            stdout[1] === "T" ||
                                            stdout[1] === "A" ||
                                            stdout[1] === "D" ||
                                            stdout[1] === "R" ||
                                            stdout[1] === "C" ||
                                            stdout[1] === "U"
                                        ) {
                                            td.append("Modified");
                                        } else if (
                                            stdout[0] === "M" ||
                                            stdout[0] === "T" ||
                                            stdout[0] === "A" ||
                                            stdout[0] === "D" ||
                                            stdout[0] === "R" ||
                                            stdout[0] === "C" ||
                                            stdout[0] === "U"
                                        ) {
                                            td.append("Staged");
                                        } else if (stdout[0] === "?") {
                                            td.append("Untracked");
                                        }
                                    });
                                    break;
                                }
                            }

                            tr.append(td);
                        }

                        // TABLE DATA MOUSEOVER
                        tr.addEventListener("mouseover", (e) => {
                            let title = {
                                filename: filename,
                                size: get_file_size(
                                    localStorage.getItem(filename)
                                ),
                                modified: get_time_stamp(
                                    fs.statSync(filename).mtime
                                ),
                            };

                            e.target.title =
                                title.filename +
                                "\n" +
                                title.size +
                                "\n" +
                                title.modified;

                            // HIGHLIGHT ROW
                            td.classList.add("highlight");

                            // SET ACTIVE HREF FOR CONTEXT MENU
                            active_href = filename;
                        });

                        tr.addEventListener("mouseout", (e) => {
                            td.classList.remove("highlight");
                        });
                    });

                    // ADD TR TO TABLE BODY
                    tbody.appendChild(tr);

                    // DIRECTORY
                    if (stats.isDirectory()) {
                        header_link.addEventListener("click", (e) => {
                            get_list_view(filename);
                        });

                        tr.oncontextmenu = (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            tr.classList.add("highlight");

                            let filetype = mime.lookup(filename);
                            let associated_apps = get_available_launchers(
                                filetype,
                                filename
                            );
                            ipcRenderer.send(
                                "show-context-menu-directory",
                                associated_apps
                            );
                        };

                        tr.classList.add("folder_card");

                        // FILES
                    } else {
                        header_link.addEventListener("click", (e) => {
                            open(filename, { wait: false });
                        });

                        tr.oncontextmenu = (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            tr.classList.add("highlight");

                            let access = 0;
                            let filetype = mime.lookup(filename);
                            let associated_apps = get_available_launchers(
                                filetype,
                                filename
                            );
                            try {
                                fs.accessSync(filename, fs.X_OK);
                                access = 1;
                                ipcRenderer.send("show-context-menu-files", {
                                    apps: associated_apps,
                                    access: access,
                                    href: filename,
                                });
                            } catch (err) {
                                ipcRenderer.send("show-context-menu-files", {
                                    apps: associated_apps,
                                    access: access,
                                    href: filename,
                                });
                            }

                            tr.classList.add("file_card");
                        };
                    }

                    tr.ondragstart = (e) => {
                        console.log("dragging");
                    };

                    tr.ondragover = (e) => {
                        tr.classList.add("highlight");
                    };

                    tr.ondragleave = (e) => {
                        tr.classList.remove("highlight");
                    };

                    header_link.draggable = false;
                }
            } catch (er) {}
        });

        // ADD TABLE BODY  TO TABLE
        table.append(tbody);

        // Get the column headers
        var col0Header = document.getElementById("col0-header");
        var col1Header = document.getElementById("col1-header");
        var col2Header = document.getElementById("col2-header");
        var col3Header = document.getElementById("col3-header");

        // Add mousedown event listeners to column headers
        col0Header.addEventListener("mousedown", function (e) {
            startDrag(e, col0Header, 0);
        });
        col1Header.addEventListener("mousedown", function (e) {
            startDrag(e, col1Header, 1);
        });
        col2Header.addEventListener("mousedown", function (e) {
            startDrag(e, col2Header, 2);
        });
        col3Header.addEventListener("mousedown", function (e) {
            startDrag(e, col3Header, 3);
        });

        var startX, startWidth, currentWidth;

        function startDrag(e, header, index) {
            e.preventDefault();
            startX = e.clientX;
            startWidth = parseInt(
                document.defaultView.getComputedStyle(header).width,
                10
            );

            // Add mousemove and mouseup event listeners to document
            document.addEventListener("mousemove", doDrag);
            document.addEventListener("mouseup", stopDrag);

            function doDrag(e) {
                currentWidth = startWidth + (e.clientX - startX);
                table.getElementsByTagName("col")[index].style.width =
                    currentWidth + "px";
            }

            function stopDrag(e) {
                document.removeEventListener("mousemove", doDrag);
                document.removeEventListener("mouseup", stopDrag);
            }
        }
    });
}

let copy_arr1 = [];
let file_count1 = 0;
let file_count2 = 0;

function build_copy_arr(source, destination, callback) {
    gio.get_dir(source, (files) => {
        file_count2 += files.length;
        files.forEach((file) => {
            if (file.type == "directory") {
                build_copy_arr(file.href, destination, callback);
            }
            copy_arr1.push(file);
        });
    });
}

/**
 * Load grid view
 * @param {string} dir // directory to display
 * @param {int} page_number // number of pages
 * @param {int} page_size //
 */
function get_grid_view(dir, page_number = 1, page_size = 2000) {
    let breadcrumbs = document.getElementById("breadcrumbs");
    let tab_menu = document.querySelectorAll(".tabular.menu");
    breadcrumbs.value = dir;
    document.title = path.basename(dir);
    clear_items();

    show_loader();
    gio.get_dir(dir, (dirents) => {
        let main_view = document.getElementById("main_view");
        let folder_grid = document.getElementById("folder_grid");
        let hidden_folder_grid = document.getElementById("hidden_folder_grid");
        let file_grid = document.getElementById("file_grid");
        let hidden_file_grid = document.getElementById("hidden_file_grid");
        let options = {};
        let is_dir = 0;

        folder_grid.innerText = "";
        hidden_folder_grid.innerText = "";
        file_grid.innerText = "";
        hidden_file_grid.innerText = "";

        options.sort = localStorage.getItem("sort");
        let sort_direction = localStorage.getItem("sort_direction");
        let show_hidden = parseInt(localStorage.getItem("show_hidden"));
        let sort_flag = 0;

        folder_grid.classList.add("doubling");
        file_grid.classList.add("doubling");

        if (sort_direction == "asc") {
            sort_flag = 1;
        } else {
            sort_flag = 0;
        }

        switch (parseInt(options.sort)) {
            // Sort by date
            case 1: {
                sort_by_date.classList.add("active");
                dirents.sort((a, b) => {
                    if (sort_flag == 0) {
                        return b["time::modified"] - a["time::modified"];
                    } else {
                        return a["time::modified"] - b["time::modified"];
                    }
                });
                break;
            }
            // Sort by name
            case 2: {
                sort_by_name.classList.add("active");
                dirents.sort((a, b) => {
                    if (sort_flag == 0) {
                        return path
                            .basename(a.href)
                            .toLocaleLowerCase()
                            .localeCompare(
                                path.basename(b.href).toLocaleLowerCase()
                            );
                    } else {
                        return path
                            .basename(b.href)
                            .toLocaleLowerCase()
                            .localeCompare(
                                path.basename(a.href).toLocaleLowerCase()
                            );
                    }
                });
                break;
            }
            // Sort by size
            case 3: {
                sort_by_size.classList.add("active");
                dirents.sort((a, b) => {
                    let s1 = parseInt(localStorage.getItem(a.size));
                    let s2 = parseInt(localStorage.getItem(b.size));
                    if (sort_flag == 0) {
                        return s2 - s1;
                    } else {
                        s1 - s2;
                    }
                });
                break;
            }
            // Sort by type
            case 4: {
                sort_by_type.classList.add("active");
                dirents.sort((a, b) => {
                    let ext1 = path.extname(path.basename(a.href));
                    let ext2 = path.extname(path.basename(b.href));

                    if (ext1 < ext2) return -1;
                    if (ext1 > ext2) return 1;

                    if (a.mtime < b.mtime) return -1;
                    if (a.mtime > b.mtime) return 1;
                });
            }
        }

        dirents.forEach((file, idx) => {
            if (
                idx > page_number - 1 * page_size &&
                idx <= page_number * page_size
            ) {
                let card = get_card1(file);
                let col = add_column("three");
                col.append(card);

                if (file.is_dir) {
                    is_dir = 1;
                    if (!file.is_hidden) {
                        folder_grid.append(col);
                    } else {
                        if (show_hidden) {
                            hidden_folder_grid.append(col);
                        }
                    }
                } else {
                    if (!file.is_hidden) {
                        file_grid.append(col);
                    } else {
                        if (show_hidden) {
                            hidden_file_grid.append(col);
                        }
                    }
                }
            }
        });

        lazyload1();

        if (is_dir) {
            tab_menu.forEach((tab) => {
                let tab_item = tab.querySelector(".item");
                tab_item.innerHTML = "";
                let close_icon = add_icon("times");
                close_icon.style = "padding-left: 15px; margin-right: auto";
                tab_item.append(path.basename(dir), close_icon);

                tab.ondragover = (e) => {
                    console.log("rhrher");
                };

                tab.ondrop = (e) => {
                    let new_tab = document.createElement("a");
                    let cards = document.querySelectorAll(".highlight");
                    cards.forEach((card) => {
                        new_tab.classList.add("item");
                        new_tab.innerHTML = card.datase.href;
                        tab.append(new_tab);
                    });
                };
            });
        }

        if (!is_gio_file(dir)) {
            get_disk_space();
        } else {
            let status = document.getElementById("status");
            status.innerHTML = "";
        }
        file_arr = dirents;
        hide_loader();

        let cards = document.querySelectorAll(".folder_card");
        let current_card = 0;
        Mousetrap.bind(
            settings.keyboard_shortcuts.Down.toLocaleLowerCase(),
            (e) => {
                cards[current_card].classList.remove("highlight_select");
                current_card = (current_card + 5) % cards.length;
                cards[current_card].classList.add("highlight_select");
            }
        );

        Mousetrap.bind(
            settings.keyboard_shortcuts.Up.toLocaleLowerCase(),
            (e) => {
                cards[current_card].classList.remove("highlight_select");
                current_card = (current_card - 5 + cards.length) % cards.length;
                cards[current_card].classList.add("highlight_select");
            }
        );
    });
}

// MAIN GET FILES FUNCTION
async function get_files(dir, callback) {
    // I dont think this is being used

    // Init
    if (fs.existsSync(dir)) {
        state = 1;
    }

    // Input
    show_loader();

    // Init
    let main_view = document.getElementById("main_view");
    let info_view = document.getElementById("info_view");
    let folder_grid = document.getElementById("folder_grid");
    let hidden_folder_grid = document.getElementById("hidden_folder_grid");
    let file_grid = document.getElementById("file_grid");
    let hidden_file_grid = document.getElementById("hidden_file_grid");
    let pager = document.getElementById("pager");
    let grid_view = document.getElementById("grid_view");
    let list_view = document.getElementById("list_view");

    grid_view.classList.remove("hidden");
    list_view.classList.add("hidden");

    if (historize) {
        add_history(dir);
    }

    options.sort = localStorage.getItem("sort");
    options.page = localStorage.getItem("page");

    // HANDLE COUNTER
    cardindex = 0;

    if (start_path) {
        dir = start_path;
        start_path = "";
    }

    if (options.page == "") {
        options.page = 1;
    }

    breadcrumbs.value = dir;
    breadcrumbs.title = dir;

    // SET FOLDER TO LOCAL STORAGE
    localStorage.setItem("folder", dir);

    file_grid.innerHTML = "";
    folder_grid.innerHTML = "";

    // HANDLE QUIT
    // LOOP OVER QUIT
    let quit = document.getElementsByClassName("quit");
    for (let i = 0; i < quit.length; i++) {
        quit[i].addEventListener("click", (e) => {
            ipcRenderer.send("close");
        });
    }

    // HANDLE MINIMIZE
    let min = document.getElementById("min");
    min.addEventListener("click", function (e) {
        ipcRenderer.send("minimize");
    });

    // HANDLE MAXAMIZE
    let max = document.getElementById("max");
    max.addEventListener("click", function (e) {
        ipcRenderer.send("maximize");
    });

    // CLEAR ITEMS
    folder_grid.innerText = "";
    hidden_folder_grid.innerText = "";
    file_grid.innerText = "";
    hidden_file_grid.innerText = "";
    pager.innerHTML = "";

    // HANDLE GNOME DISKS BUTTON
    let gnome_disks = document.querySelectorAll(".gnome_disks");
    gnome_disks.forEach(function (e) {
        e.addEventListener("click", function (e) {
            ipcRenderer.send("gnome_disks");
        });
    });

    // DISK USAGE ANALYZER
    let dua = document.getElementById("menu_dua");
    dua.addEventListener("click", function (e) {
        ipcRenderer.send("dua", { dir: breadcrumbs.value });
    });

    // GET CONTROL OPTIONS FROM LOCAL STORAGE. SUCH AS SORT
    let btn_show_hidden = document.getElementById("btn_show_hidden_folders");
    let show_hidden = localStorage.getItem("show_hidden");

    // SHOW HIDDEN FILES
    if (show_hidden === "1") {
        btn_show_hidden.classList.add("active");
        hidden_folder_grid.classList.remove("hidden");
        hidden_file_grid.classList.remove("hidden");
    } else {
        hidden_folder_grid.classList.add("hidden");
        hidden_file_grid.classList.add("hidden");
        btn_show_hidden.classList.remove("active");
    }

    /* Sort */
    let sort = parseInt(localStorage.getItem("sort"));
    switch (sort) {
        case 1:
            sort_by_date.classList.add("active");
            break;
        case 2:
            sort_by_name.classList.add("active");
            break;
        case 3:
            sort_by_size.classList.add("active");
            break;
        case 4:
            sort_by_type.classList.add("active");
            break;
    }

    // GET FILES ARRAY
    let rd_st = new Date().getTime();
    fs.readdir(dir, (err, dirents) => {
        if (!err) {
            if (dirents.length > 0) {
                /* Get sort direction */
                let sort_direction = localStorage.getItem("sort_direction");
                let sort_flag = 0;
                if (sort_direction == "asc") {
                    sort_flag = 1;
                }

                /* Sort */
                switch (parseInt(sort)) {
                    // SORT BY DATE
                    case 1: {
                        // SORT BY DATE DESC
                        dirents.sort((a, b) => {
                            try {
                                s1 = fs.statSync(path.join(dir, a)).mtime;
                                s2 = fs.statSync(path.join(dir, b)).mtime;
                                // SORT FLAG
                                if (sort_flag == 0) {
                                    return s2 - s1;
                                } else {
                                    return s1 - s2;
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        });
                        break;
                    }
                    // SORT BY NAME
                    case 2: {
                        dirents.sort((a, b) => {
                            if (sort_flag == 0) {
                                return a
                                    .toLocaleLowerCase()
                                    .localeCompare(b.toLocaleLowerCase());
                            } else {
                                return b
                                    .toLocaleLowerCase()
                                    .localeCompare(a.toLocaleLowerCase());
                            }
                        });
                        break;
                    }

                    // SORT BY SIZE
                    case 3: {
                        dirents.sort((a, b) => {
                            let s1 = parseInt(
                                localStorage.getItem(path.join(dir, a))
                            );
                            let s2 = parseInt(
                                localStorage.getItem(path.join(dir, b))
                            );
                            if (sort_flag == 0) {
                                return s2 - s1;
                            } else {
                                s1 - s2;
                            }
                        });
                        break;
                    }

                    // SORT BY TYPE
                    case 4: {
                        dirents.sort((a, b) => {
                            try {
                                let s1 = stat.statSync(dir + "/" + a);
                                let s2 = stat.statSync(dir + "/" + b);

                                let ext1 = path.extname(path.basename(a));
                                let ext2 = path.extname(path.basename(b));

                                if (ext1 < ext2) return -1;
                                if (ext1 > ext2) return 1;

                                if (s1.mtime < s2.mtime) return -1;
                                if (s1.mtime > s2.mtime) return 1;
                            } catch {
                                console.log(err);
                            }
                        });
                    }
                }

                // REGEX FOR HIDDEN FILE
                const regex = /^\..*/;

                // PAGE FILES
                if (dirents.length > pagesize) {
                    let number_pages = parseInt(
                        parseInt(dirents.length) / parseInt(pagesize)
                    );
                    for (let i = 1; i < number_pages + 1; i++) {
                        add_pager_item({ dir, name: i });
                    }
                    dirents = paginate(dirents, pagesize, page);
                }

                // HANDLE GROUP BY
                let groupby = 1;
                let exts = dirents.filter((a) => {
                    let ext1 = path.extname(a);
                    let ext2 = path.extname(a);

                    if (ext1 > ext2) return -1;
                    if (ext1 < ext2) return 1;
                });

                if (groupby) {
                    exts.forEach((ext) => {
                        dirents.forEach((file, idx) => {
                            if (path.extname(file) == ext) {
                            }
                        });
                    });
                }

                dirents.forEach((file, idx) => {
                    let filename = file;
                    let filepath = path.join(dir, filename);

                    try {
                        let stats = fs.statSync(filepath);

                        // DIRECTORY
                        if (stats.isDirectory()) {
                            let options = {
                                id: "folder_card_" + idx,
                                href: filepath,
                                linktext: filename,
                                size: "",
                                is_folder: true,
                            };
                            if (!regex.test(file)) {
                                options.grid = folder_grid;
                                add_card(options).then((card) => {
                                    update_card(card.dataset.href);
                                });
                            } else {
                                options.grid = hidden_folder_grid;
                                add_card(options).then((card) => {
                                    update_card(card.dataset.href);
                                });
                            }
                            ++folder_count;
                            // FILES
                        } else {
                            let filename = path.basename(file);
                            let filepath = path.join(dir, "/", filename);
                            if (groupby) {
                                let ext = path.extname(filename);
                            } else {
                            }
                            let options = {
                                id: "file_card_" + idx,
                                href: filepath,
                                linktext: filename,
                                is_folder: false,
                            };
                            if (!regex.test(file)) {
                                options.grid = file_grid;
                                add_card(options).then((card) => {
                                    update_card(card.dataset.href);
                                });
                            } else {
                                options.grid = hidden_file_grid;
                                add_card(options).then((card) => {
                                    update_card(card.dataset.href);
                                });
                            }
                            ++file_count;
                        }
                    } catch (err) {
                        notification("get_files error:", err);
                    }
                });

                if (folder_count == 0) {
                    folders_card.classList.add("hidden");
                } else {
                    folders_card.classList.remove("hidden");
                }

                hide_loader();
                callback(1);

                let sidebar = document.getElementById("sidebar");
                sidebar.addEventListener("mouseover", (e) => {
                    sidebar.focus();
                });

                // HANDLE QUICK SEARCH KEY PRESS. THIS IS FOR FIND BY TYPING //////////////////////////////////
                let letters = "";
                let txt_search = document.getElementById("txt_search");

                // MAIN VIEW
                main_view.tabIndex = 0;

                // KEYBOARD NAVIGATION
                main_view.addEventListener("keypress", function (e) {
                    // PEVENT KEYPRESS FROM BEING FIRED ON QUICK SEARCH AND FIND
                    e.stopPropagation();

                    // LOOK FOR LETTERS AND NUMBERS. I DONT THINK THIS
                    let regex = /[^A-Za-z0-9-.]+/;

                    // TEST FOR LETTERS AND NUMBERS
                    if (
                        regex.test(e.key) === false &&
                        !e.shiftKey &&
                        e.key !== "Delete" &&
                        !e.ctrlKey
                    ) {
                        // MAKE SURE WHERE NOT SOMETHING THAT WE NEED
                        if (
                            e.target === e.currentTarget ||
                            e.target === txt_search ||
                            e.target.classList.contains("header_link")
                        ) {
                            txt_search.classList.remove("hidden");
                            txt_search.focus();

                            if (e.key === "Enter" && txt_search.value != "") {
                                cards = main_view.querySelectorAll(".nav_item");
                                cards.forEach((card) => {
                                    let href =
                                        card.dataset.href.toLocaleLowerCase();
                                    if (
                                        href.indexOf(
                                            txt_search.value.toLocaleLowerCase()
                                        ) != -1
                                    ) {
                                        card.classList.add("highlight_select");
                                        card.querySelector("a").focus();
                                    }
                                });

                                txt_search.classList.add("hidden");
                            }
                        }
                    }
                });

                // DISABLE MOVING CONTENT ON ARROW
                document.addEventListener("keydown", (e) => {
                    if (["ArrowUp", "ArrowDown"].indexOf(e.code) > -1) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                });

                // HIDE QUICK SEARCH
                txt_search.addEventListener("keydown", function (e) {
                    if (e.key === "Escape") {
                        // CLEAR ITEMS
                        clear_items();
                        // CLEAR COPY ARRAY
                        clear_copy_arr();
                    }
                });

                main_view.onmouseover = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    ipcRenderer.send("active_window");
                    ipcRenderer.send("active_folder", breadcrumbs.value, 1);
                };

                main_view.onmouseout = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                };
                /* RESET CARD INDEX TO 0 SO WE CAN DETECT WHEN SINGLE CARDS ARE ADDED */
                cardindex = 0;
                notice(
                    " (" +
                        directories.length +
                        ") directories and (" +
                        files.length +
                        ") files"
                );
            } else {
                hide_loader();
            }
        } else {
            notification("error: " + err);
            hide_loader();
            return 0;
        }

        // For keyboard navigation
        let items = main_view.querySelectorAll(".nav_item");
        items.forEach((item, idx) => {
            item.dataset.id = idx + 1;
        });

        let date2 = new Date();
        get_disk_space();
    });

    ///////////////////////////////////////////////////////////////////////

    let folder_cards = document.getElementsByClassName("folder_card");
    let headers = document.getElementsByClassName("header_link");

    nc = 1;
    nc2 = 0;
    adj = 0;
    is_folder_card = true;

    let keycounter = 0;
    let keycounter0 = 0;

    let is_last = 0;
    let is_last0 = 0;

    // Shift RIGHT
    Mousetrap.bind("shift+right", (e) => {
        keycounter0 = keycounter;
        keycounter += 1;

        document
            .querySelector("[data-id='" + keycounter + "']")
            .classList.add("highlight_select");
        document
            .querySelector("[data-id='" + keycounter + "']")
            .querySelector("a")
            .focus();
    });

    // RIGHT
    Mousetrap.bind(
        settings.keyboard_shortcuts.Right.toLocaleLowerCase(),
        (e) => {
            clear_highlight();

            let items = main_view.querySelectorAll(".nav_item");
            keycounter0 = keycounter;

            if (keycounter < 1) {
                keycounter = 1;
            } else {
                if (keycounter < items.length) {
                    keycounter += 1;
                    document
                        .querySelector("[data-id='" + keycounter0 + "']")
                        .classList.remove("highlight_select");
                }
            }

            document
                .querySelector("[data-id='" + keycounter + "']")
                .classList.add("highlight_select");
            document
                .querySelector("[data-id='" + keycounter + "']")
                .querySelector("a")
                .focus();
        }
    );

    // SHIFT LEFT. MULTI SELECT
    Mousetrap.bind("shift+left", (e) => {
        keycounter0 = keycounter;
        keycounter -= 1;
        document
            .querySelector("[data-id='" + keycounter + "']")
            .classList.add("highlight_select");
        document
            .querySelector("[data-id='" + keycounter + "']")
            .querySelector("a")
            .focus();
    });

    // LEFT
    Mousetrap.bind(
        settings.keyboard_shortcuts.Left.toLocaleLowerCase(),
        (e) => {
            clear_highlight();

            keycounter0 = keycounter;

            if (keycounter <= 1) {
                keycounter = 1;
            } else {
                document
                    .querySelector("[data-id='" + keycounter + "']")
                    .classList.remove("highlight_select");
                keycounter -= 1;
            }

            document
                .querySelector("[data-id='" + keycounter + "']")
                .classList.add("highlight_select");
            document
                .querySelector("[data-id='" + keycounter + "']")
                .querySelector("a")
                .focus();
        }
    );

    // HANDLE SHIFT DOWN MULTI SELECTION
    Mousetrap.bind("shift+down", function (e) {
        e.preventDefault();

        if (nc2 == 0) {
            document
                .querySelector("[data-id='" + nc + "']")
                .classList.add("highlight_select");
            headers[nc - 1].focus();

            nc2 = 1;
        } else {
            // NC = ACTUAL LOCATION
            nc = nc2;
            nc2 = nc2 + 5;

            // DONT AJUST IF LESS THAN NAV COUNTER
            if (nc2 > 1) {
                // HANDLE MOVING BETWEEN GRIDS
                if (localStorage.getItem("show_hidden") == "0") {
                    adj = folder_count;
                }

                if (nc2 > adj && is_folder_card == true) {
                    is_folder_card = false;

                    //THIS EQUALS 25
                    let last_row_count = Math.ceil(folder_count / 5) * 5;

                    if (localStorage.getItem("show_hidden") == "0") {
                        // THIS SHOULD = 1 IF FOLDER COUNT = 24 + COUNT OF HIDDEN DIRECTORIES
                        adj =
                            5 -
                            (last_row_count - folder_count) +
                            hidden_folder_count;
                        nc2 = nc + adj;
                    } else {
                        adj = hidden_folder_count;
                    }
                }

                document
                    .querySelector("[data-id='" + nc2 + "']")
                    .classList.add("highlight_select");
                document
                    .querySelector("[data-id='" + nc2 + "']")
                    .querySelector("a")
                    .focus();
            }
        }
    });

    // HANDLE KEYBOARD DOWN. DONT CHANGE
    Mousetrap.bind(
        settings.keyboard_shortcuts.Down.toLocaleLowerCase(),
        (e) => {
            clear_highlight();

            let items = main_view.querySelectorAll(".nav_item");

            keycounter0 = keycounter;

            let min = Math.floor(folder_cards.length / 5) * 5;
            let diff =
                Math.ceil(folder_cards.length / 5) * 5 - folder_cards.length;

            is_last0 = is_last;

            // CHECK IF LAST ROW
            if (keycounter > min) {
                is_last = 1;
            }

            //
            if (keycounter < 1) {
                keycounter = 1;
            } else {
                keycounter += 5;

                // ADJUST SECOND TO LAST ROW
                if (
                    keycounter > folder_cards.length &&
                    is_folder_card &&
                    !is_last
                ) {
                    keycounter = keycounter + (5 - diff);
                    is_folder_card = 0;
                    // ADJUST LAST ROW
                } else if (
                    keycounter > folder_cards.length &&
                    is_folder_card &&
                    is_last
                ) {
                    keycounter = keycounter0 + (5 - diff);
                    is_folder_card = 0;
                    is_last = 0;
                }

                document
                    .querySelector("[data-id='" + keycounter0 + "']")
                    .classList.remove("highlight_select");
            }

            if (keycounter > items.length) {
                is_folder = 1;
                keycounter0 = 0;
                keycounter = 1;
                document
                    .querySelector("[data-id='" + keycounter + "']")
                    .classList.add("highlight_select");
            } else {
                document
                    .querySelector("[data-id='" + keycounter + "']")
                    .classList.add("highlight_select");
                document
                    .querySelector("[data-id='" + keycounter + "']")
                    .querySelector("a")
                    .focus();
            }
        }
    );

    // todo: check hidden files
    // Handle Keyboard Up.
    Mousetrap.bind(settings.keyboard_shortcuts.Up.toLocaleLowerCase(), (e) => {
        clear_highlight();

        keycounter0 = keycounter;

        let min = Math.floor(folder_cards.length / 5) * 5;
        let diff =
            5 - (Math.ceil(folder_cards.length / 5) * 5 - folder_cards.length);

        if (keycounter - 5 < min && !is_folder_card) {
            is_last = 1;
        }

        if (keycounter <= 5) {
            keycounter = 1;
            if (keycounter >= 1) {
                try {
                    document
                        .querySelector("[data-id='" + keycounter0 + "']")
                        .classList.remove("highlight_select");
                } catch (err) {}
            }
        } else {
            keycounter -= 5;

            if (
                keycounter < folder_cards.length &&
                !is_folder_card &&
                is_last
            ) {
                keycounter = keycounter - diff;
                is_folder_card = 1;
            } else if (
                keycounter < folder_cards.length &&
                !is_folder_card &&
                !is_last
            ) {
                keycounter = keycounter0 - diff;
                is_folder_card = 1;
            }
            document
                .querySelector("[data-id='" + keycounter0 + "']")
                .classList.remove("highlight_select");
        }

        document
            .querySelector("[data-id='" + keycounter + "']")
            .classList.add("highlight_select");
        document
            .querySelector("[data-id='" + keycounter + "']")
            .querySelector("a")
            .focus();
    });

    async function clear_highlight() {
        let items = document.querySelectorAll(
            ".highlight, .highlight_select, .ds-selected"
        );
        items.forEach((item) => {
            item.classList.remove("highlight");
            item.classList.remove("highlight_select");
            item.classList.remove("ds-selected");
        });
    }

    clear_items();
    autocomplete();
}

// GET HOME DIRECTORY
function get_home() {
    return os.homedir();
}

// GET FOLDER SIZE
function get_folder_size(href) {
    return new Promise((resolve) => {
        let breadcrumbs = document.getElementById("breadcrumbs");
        const regex = /^\..*/;
        let folder_card = document.getElementsByClassName("folder_card");

        if (folder_card.length > 0) {
            for (let i = 0; i < folder_card.length; i++) {
                cmd = 'cd "' + href + '"; du -s';
                du = exec(cmd);
                du.stdout.on("data", function (res) {
                    let extra = folder_card[i].querySelector(".extra");

                    let size = parseInt(res.replace(".", "") * 1024);
                    if (size > 1000000000) {
                        extra.innerHTML =
                            '<span style="color:red">' +
                            get_file_size(size) +
                            "</span>";
                    } else {
                        extra.innerHTML = get_file_size(size);
                    }
                    resolve(size);
                });
            }
        }
    });
}

// CONTEXT BRIDGE
contextBridge.exposeInMainWorld("api", {
    add_card: (options) => {
        add_card(options);
    },
    get_info: () => {
        get_info();
    },
    get_devices: () => {
        get_devices();
    },
    get_workspace: () => {
        get_workspace();
    },
    load_workspace: () => {
        load_workspace();
    },
    get_folder_size: () => {
        get_folder_size();
    },
    find_files: () => {
        find_files(() => {});
    },
    get_disk_usage: () => {
        get_disk_usage();
    },
    get_folders1: (dir) => {
        return get_folders1(dir);
    },
    get_sidebar_home: () => {
        return get_sidebar_home();
    },
    get_sidebar_files: (dir) => {
        return get_sidebar_files(dir);
    },
    get_files: (dir, callback) => {
        return get_files(dir, callback);
    },
    get_settings_view: () => {
        return get_settings_view();
    },
    get_view: (dir) => {
        historize = 1;
        return get_view(dir);
    },
    get_list_view: (dir) => {
        return get_list_view(dir);
    },
    get_network: () => {
        return get_network();
    },
    get_icon_path: (path) => {
        return get_icon_path(path);
    },
    get_data: (dir) => {
        return get_data(dir);
    },
    get_home: () => {
        return get_home();
    },
    navigate: (direction) => {
        navigate(direction);
    },
    get_terminal: () => {
        open_terminal();
    },
    toggle: () => ipcRenderer.invoke("dark-mode:toggle"),
});

/* Add location to history array */
function add_history(dir) {
    history_arr.forEach((item) => {
        if (!fs.existsSync(item)) {
            history_arr.shift();
        }
    });
    history_arr.push(dir);
}

// CLEAR SELECTED FILES ARRAY
function clear_items() {
    let main_view = document.getElementById("main_view");
    let progress = document.getElementById("progress");
    let progress_div = document.getElementById("progress_div");
    let pager = document.getElementById("pager");
    let txt_search = document.getElementById("txt_search");
    let nav_items = document.querySelectorAll(".nav_item");
    let input = document.getElementById("edit_" + card_id);
    let header = document.getElementById("header_" + card_id);
    let breadcrumb_items = document.getElementById("breadcrumb_items");
    let hamburger_menu = document.getElementById("hamburger_menu");
    let info_view = document.getElementById("info_view");
    let notification = document.getElementById("notification");
    let items = document.querySelectorAll(".item");

    /* Reset nav counters */
    nc = 1;
    nc2 = 0;
    adj = 0;
    ac = 0;
    is_folder_card = true;

    /* Clear arrays */
    delete_arr = [];
    selected_files = [];

    /* Clear elements */
    pager.innerHTML = "";
    txt_search.value = "";

    /* Hidden elements */
    txt_search.classList.add("hidden");
    breadcrumb_items.classList.add("hidden");
    hamburger_menu.classList.add("hidden");
    progress.classList.add("hidden");
    progress_div.classList.add("hidden");
    notification.classList.add("hidden");

    items.forEach((item) => {
        item.classList.remove("highlight_select");
    });

    if (input) {
        input.value = input_value0;
    }

    if (header) {
        header.classList.remove("hidden");
    }

    /* Clear nav items */
    if (nav_items) {
        nav_items.forEach((item) => {
            try {
                item.classList.remove(
                    "highlight_select",
                    "ds-selected",
                    "highlight"
                );
                item.querySelector("input").classList.add("hidden");
                item.querySelector("a").classList.remove("hidden");

                // This set the previous input value
                item.querySelector("input").value =
                    item.querySelector("a").innerText;
            } catch (err) {}
        });
    }

    if (target) {
        let card = document.getElementById(target.id);
        if (card) {
            let header = card.querySelector("a");
            let textarea = card.querySelector("textarea");
            let input = card.querySelector("input");

            //
            if (prev_target) {
                prev_target.classList.remove("highlight_select");
            }

            if (textarea) {
                header.classList.remove("hidden");
                textarea.classList.add("hidden");
            }

            if (input) {
                try {
                    header.classList.remove("hidden");
                    input.classList.add("hidden");
                } catch (err) {}
            }
        }
    }
}

// CLEAR COPY CACHE
function clear_copy_arr() {
    if (copy_files_arr.length > 0) {
        copy_files_arr = [];
    }
}

// PRELOAD IMAGES
function preloadImages(array) {
    if (!preloadImages.list) {
        preloadImages.list = [];
    }
    var list = preloadImages.list;
    for (var i = 0; i < array.length; i++) {
        var img = new Image();
        img.onload = function () {
            var index = list.indexOf(this);
            if (index !== -1) {
                // remove image from the array once it's loaded
                // for memory consumption reasons
                list.splice(index, 1);
            }
        };
        list.push(img);
        img.src = array[i];
    }
}

/**
 * Ajax Get Function using XMLHttpRequest
 * @param {url} href
 * @param {*} callback
 * Returns Results from an Ajax Call
 */
function get(href, callback) {
    const xhr = new XMLHttpRequest();
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    };
    xmlHttp.open("GET", href, true); // true for asynchronous
    xmlHttp.send(null);
}

// Find for win32
async function find_win32() {
    get("../src/find.html", (find_page) => {
        let sidebar_items = document.getElementById("sidebar_items");
        sidebar_items.innerHTML = find_page;

        let find = document.getElementById("find");
        let search_info = document.getElementById("search_info");
        let search_results = document.getElementById("search_results");
        let find_folders = document.getElementById("find_folders");
        let find_files = document.getElementById("find_files");

        let options = {
            show_folders: 1,
            show_files: 1,
            case: 0,
            depth: 1,
            start_date: "",
            end_date: "",
            size: "",
        };

        options.show_folders = parseInt(localStorage.getItem("find_folders"));
        options.show_files = parseInt(localStorage.getItem("find_files"));

        find_folders.checked = options.show_folders;
        find_files.checked = options.show_files;

        // FIND FOLDERS
        find_folders.addEventListener("change", (e) => {
            if (find_folders.checked) {
                localStorage.setItem("find_folders", 1);
                options.show_folders = 1;
            } else {
                localStorage.setItem("find_folders", 0);
                options.show_folders = 0;
            }
        });

        // FIND FILES
        find_files.addEventListener("change", (e) => {
            if (find_files.checked) {
                localStorage.setItem("find_files", 1);
                options.show_files = 1;
            } else {
                localStorage.setItem("find_files", 0);
                options.show_files = 0;
            }
        });

        let search_arr = [];

        let inputs = find_options.querySelectorAll(".find_input");
        inputs.forEach((input) => {
            options[input.id] = input.value;

            input.addEventListener("change", (e) => {
                localStorage.setItem(input.id, input.value);
                options[input.id] = input.value;
            });

            if (localStorage.getItem(input.id) != "") {
                input.value = localStorage.getItem(input.id);
            }
        });

        let recursive = 0;
        find.addEventListener("keyup", (e) => {
            if (e.key == "Enter") {
                search_info.innerHTML = "searching..";
                search_results.innerHTML = "";

                function get_files_recursive(filename) {
                    // let dirents = fs.readdirSync(filename)
                    fs.readdir(filename, (err, dirents) => {
                        if (!err) {
                            try {
                                let files = dirents.filter(
                                    (item) =>
                                        !fs
                                            .statSync(path.join(filename, item))
                                            .isDirectory()
                                );
                                if (files.length > 0) {
                                    files.forEach((file, idx) => {
                                        if (
                                            file
                                                .toLocaleLowerCase()
                                                .indexOf(find.value) > -1
                                        ) {
                                            let cfilename = path.join(
                                                filename,
                                                file
                                            );

                                            search_arr.push(cfilename);
                                        }
                                    });
                                } else {
                                    search_info.innerHTML = "";
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        } else {
                            console.log(err);
                        }
                    });
                }

                let c = 0;

                function get_folders_recursive(filename) {
                    c++;
                    fs.readdir(filename, (err, dirents) => {
                        if (!err) {
                            try {
                                let folders = dirents.filter((item) =>
                                    fs
                                        .statSync(path.join(filename, item))
                                        .isDirectory()
                                );
                                if (folders.length > 0) {
                                    search_info.innerHTML = "";
                                    folders.forEach((folder, idx) => {
                                        // Get folders recursive
                                        let cursource = path.join(
                                            filename,
                                            folder
                                        );
                                        if (options.show_folders) {
                                            if (
                                                folder
                                                    .toLocaleLowerCase()
                                                    .indexOf(find.value) > -1
                                            ) {
                                                search_arr.push(cursource);
                                                let options = {
                                                    id: 0,
                                                    href: cursource,
                                                    linktext:
                                                        path.basename(
                                                            cursource
                                                        ),
                                                    is_folder: 1,
                                                    grid: "",
                                                };

                                                add_card(options).then(
                                                    (card) => {
                                                        search_info.innerHTML =
                                                            "";
                                                        search_results.append(
                                                            card
                                                        );
                                                        update_card(
                                                            card.dataset.href
                                                        );
                                                    }
                                                );
                                            }
                                        }

                                        // Get files recursive
                                        if (options.show_files) {
                                            get_files_recursive(cursource);
                                        }
                                    });
                                } else {
                                    search_info.innerHTML =
                                        "no results found..";
                                }
                            } catch (err) {
                                console.log(err);
                            }
                        } else {
                            console.log(err);
                        }
                    });
                }

                if (find.value != "") {
                    get_files_recursive(breadcrumbs.value);
                    get_folders_recursive(breadcrumbs.value);
                }
            }
        });

        find.focus();
    });
}

var search_res = "";

/**
 * Find Files.
 * The Function runs the Linux Find Utility
 * @param {int} callback
 * Returns 1 in the callback
 */
async function find_files(callback) {
    notification("running find files");

    if (process.platform === "win32") {
        find_win32();
    }

    let cmd = "";
    get("../src/find.html", (find_page) => {
        let sidebar_items = document.getElementById("sidebar_items");
        sidebar_items.innerHTML = find_page;
        let search_results = document.getElementById("search_results");
        let find = document.getElementById("find");
        let find_div = document.getElementById("find_div");
        let find_options = document.getElementById("find_options");
        let find_folders = document.getElementById("find_folders");
        let find_files = document.getElementById("find_files");
        let btn_find_options = document.getElementById("btn_find_options");
        let breadcrumbs = document.getElementById("breadcrumbs");
        let find_size = document.getElementById("find_size");
        let start_date = document.getElementById("start_date");
        let end_date = document.getElementById("end_date");
        let mb_find = document.getElementById("mb_find");
        let search_progress = document.getElementById("search_progress");

        let options = {
            show_folders: 1,
            show_files: 1,
            case: 0,
            depth: 1,
            start_date: "",
            end_date: "",
            size: "",
        };

        options.show_folders = parseInt(localStorage.getItem("find_folders"));
        options.show_files = parseInt(localStorage.getItem("find_files"));
        options.depth = parseInt(localStorage.getItem("depth"));

        find_folders.checked = options.show_folders;
        find_files.checked = options.show_files;

        localStorage.setItem("minibar", "mb_find");

        // FIND FOLDERS
        find_folders.addEventListener("change", (e) => {
            if (find_folders.checked) {
                localStorage.setItem("find_folders", 1);
                options.show_folders = 1;
            } else {
                localStorage.setItem("find_folders", 0);
                options.show_folders = 0;
            }
        });

        // FIND FILES
        find_files.addEventListener("change", (e) => {
            if (find_files.checked) {
                localStorage.setItem("find_files", 1);
                options.show_files = 1;
            } else {
                localStorage.setItem("find_files", 0);
                options.show_files = 0;
            }
        });

        let inputs = find_div.querySelectorAll(".find_input");
        inputs.forEach((input) => {
            input.preventDefault = true;

            if (localStorage.getItem(input.id) != null) {
                options[input.id] = localStorage.getItem(input.id);
            } else {
                if (input.id == "find_files") {
                    options[input.id] = 1;
                    localStorage.setItem(options[input.id], 1);
                }

                if (input.id == "find_folders") {
                    options[input.id] = 1;
                    localStorage.setItem(options[input.id], 1);
                }
            }

            input.value = localStorage.getItem(input.id);

            input.addEventListener("change", (e) => {
                localStorage.setItem(input.id, input.value);
                options[input.id] = input.value;
            });

            input.addEventListener("keyup", (e) => {
                if (e.key === "Enter") {
                    show_loader();

                    if (find.value != "") {
                        search_info.innerHTML = "Searching...";
                        search_progress.classList.remove("hidden");
                    } else {
                        search_info.innerHTML = "";
                        search_progress.classList.add("hidden");
                    }
                    search_results.innerHTML = "";
                    if (
                        find.value != "" ||
                        find_size.value != "" ||
                        start_date.value != "" ||
                        end_date.value != ""
                    ) {
                        // CHECK LOCAL STORAGE
                        if (
                            localStorage.getItem("find_folders") == "" ||
                            localStorage.getItem("find_folders") == null
                        ) {
                            localStorage.setItem("find_folders", 1);
                        }

                        if (
                            localStorage.getItem("find_files") == "" ||
                            localStorage.getItem("find_files") == null
                        ) {
                            localStorage.setItem("find_files", 1);
                        }

                        let find_folders = localStorage.getItem("find_folders");
                        let find_files = localStorage.getItem("find_files");

                        (options.d = find_folders),
                            (options.f = find_files),
                            (options.start_date = start_date.value),
                            (options.end_date = end_date.value),
                            (options.size = find_size.value), //localStorage.getItem('find_by_size'),
                            (options.o = " -o "),
                            (options.s = "*" + find.value + "*");

                        //  SIZE
                        if (options.size != "") {
                            let size_option = document.querySelector(
                                'input[name="size_options"]:checked'
                            ).value;
                            options.size =
                                "-size " +
                                options.size
                                    .replace(">", "+")
                                    .replace("<", "-")
                                    .replace(" ", "") +
                                size_option;
                        }
                        //  DEPTH
                        if (options.depth != "") {
                            options.depth = " -maxdepth " + options.depth;
                        } else {
                            options.depth = "";
                        }
                        // START DATE
                        if (options.start_date != "") {
                            let start_date =
                                ' -newermt "' + options.start_date + '"';
                            options.start_date = start_date;
                        } else {
                            options.start_date = "";
                        }
                        // END DATE
                        if (options.end_date != "") {
                            let end_date =
                                ' ! -newermt "' + options.end_date + '"';
                            options.end_date = end_date;
                        } else {
                            options.end_date = "";
                        }
                        // DIR
                        if (options.d == 1 && options.s != "") {
                            options.d =
                                " -type d " + '-iname "' + options.s + '"';
                        } else {
                            options.d = "";
                        }
                        // FILES
                        if (options.f == 1 && options.s != "") {
                            options.f =
                                " -type f " +
                                '-iname "' +
                                options.s +
                                '" ' +
                                options.size;
                        } else {
                            options.f = "";
                        }
                        // OR
                        if (options.d && options.f && options.s != "") {
                            options.o = " -or ";
                        } else {
                            options.o = "";
                        }

                        cmd =
                            'find "' +
                            breadcrumbs.value +
                            '"' +
                            options.depth +
                            options.d +
                            options.start_date +
                            options.end_date +
                            options.o +
                            options.f +
                            options.start_date +
                            options.end_date;
                        if (process.platform === "Win32") {
                            notification(
                                "find is not yet implemented on window"
                            );
                        }
                        let data = 0;
                        let c = 0;
                        let child = exec(cmd);
                        child.stdout.on("data", (res) => {
                            data = 1;
                            search_info.innerHTML = "";
                            let files = res.split("\n");
                            search_progress.value = 0;
                            search_progress.max = files.length;

                            if (files.length > 500) {
                                search_info.innerHTML =
                                    "Please narrow your search.";
                                search_progress.classList.add("hidden");

                                hide_loader();
                                return false;
                            } else {
                                for (let i = 0; i < files.length; i++) {
                                    if (files[i] != "") {
                                        ++c;
                                        search_progress.value = i;

                                        fs.stat(files[i], (err, stats) => {
                                            let file_obj = {
                                                name: path.basename(files[i]),
                                                href: files[i],
                                                is_dir: stats.isDirectory(),
                                                mtime: stats.mtime,
                                                size: 0,
                                            };

                                            let card = get_card1(file_obj);
                                            let icon =
                                                card.querySelector(".icon");
                                            icon.style =
                                                "width: 16px !important; height: 16px !important";
                                            search_results.append(card);
                                            update_card1(files[i]);
                                        });
                                    }
                                }

                                hide_loader();
                            }
                        });

                        child.stdout.on("end", (res) => {
                            if (!data) {
                                search_info.innerHTML = "0 matches found";
                            } else {
                                search_info.innerHTML = c + " matches found";
                            }

                            search_progress.classList.add("hidden");
                        });
                    } else {
                        search_results.innerHTML = "";
                        fs.writeFileSync(
                            path.join(__dirname, "src/find.html"),
                            sidebar_items.innerHTML
                        );
                    }
                }

                if (e.key === "ArrowDown") {
                }

                if (e.key === "Escape") {
                    main_view.focus();
                }
            });
        });

        clear_minibar();
        mb_find.style = "color: #ffffff !important";

        // FIND OPTIONS
        btn_find_options.addEventListener("click", (e) => {
            let chevron = btn_find_options.querySelector("i");

            // Remove Hidden
            if (find_options.classList.contains("hidden")) {
                find_options.classList.remove("hidden");
                chevron.classList.add("down");
                chevron.classList.remove("right");
                localStorage.setItem("find_options", 1);

                // Add Hidden
            } else {
                find_options.classList.add("hidden");
                chevron.classList.add("right");
                chevron.classList.remove("down");
                localStorage.setItem("find_options", 0);
            }
        });
        callback(1);
    });
}

// FUNCTION SIMILAR TO STRING.FORMAT IN C# LAND
String.prototype.format = function () {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp("\\{" + i + "\\}", "gm"), arguments[i]);
    }
    return s;
};

// DARK MODE
contextBridge.exposeInMainWorld("darkMode", {
    toggle: () => ipcRenderer.invoke("dark-mode:toggle"),
    system: () => ipcRenderer.invoke("dark-mode:system"),
});

// FUNCTIONS //
function formatDate(date) {
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

/**
 * Tests href for smb:, sftp: or mtp:
 * todo: need to add additioal prefixs
 * @param {string} href
 * @returns 1 or 0
 */
function is_gio_file(href) {
    if (href) {
        if (
            href.indexOf("smb:") > -1 ||
            href.indexOf("sftp:") > -1 ||
            href.indexOf("mtp:") > -1
        ) {
            return true;
        } else {
            return false;
        }
    }
}

/**
 *
 * @param {string} href
 * @param {object} callback
 *
 */
function get_file(href, callback) {
    exec(`gio info "${href}"`, (err, stdout, stderr) => {
        if (!err) {
            let files = stdout.split("\n").map((p) => p.trim().split(": "));
            file_obj = {};

            file_obj.href = href;
            file_obj.name = path.basename(href);

            files.forEach((item) => {
                file_obj[item[0]] = item[1];
            });

            // file_arr = dirents;
            return callback(file_obj);
        } else {
            return callback(err);
        }
    });
}

/**
 * Read Directory Contents into an File Object Array
 * @param {string} dir // Directory to Read
 * @param {*} callback Retuns a Array of File Object
 */
function get_dir(dir, callback) {
    // This is not being used

    let isGio = 1;
    let gio_dir = ["smb:", "sftp:", "mtp:"];
    let dirents = [];
    file_arr = [];

    ipcRenderer.send("active_folder", dir);

    for (let i = 0; i < gio_dir.length; i++) {
        if (dir.indexOf(gio_dir[i]) > -1) {
            isGio = 1;
            break;
        }
    }

    if (isGio) {
        exec(
            `gio list -h -l -a "*" "${dir}"`,
            { maxBuffer: 1024 * 1024 * 1024 },
            (err, stdout, stderr) => {
                if (!err) {
                    let file_info = stdout.split("\n");
                    file_info.forEach((item, idx) => {
                        if (idx < file_info.length - 1) {
                            let file_obj = {};
                            let files = item.split("\t");

                            file_obj.size = files[1]; // this is being set on get_card1
                            file_obj.name = files[0];

                            if (is_gio_file(dir)) {
                                file_obj.href = dir + files[0] + "/";
                            } else {
                                file_obj.href = dir + "/" + files[0];
                            }

                            // Check for hidden. todo: find out why its not an attribute of gio
                            if (files[0].substring(0, 1) == ".") {
                                file_obj.is_hidden = 1;
                            } else {
                                file_obj.is_hidden = 0;
                            }

                            if (files[2] == "(directory)") {
                                file_obj.is_dir = 1;
                            } else {
                                file_obj.is_dir = 0;
                                file_obj.ext = path.extname(files[0]);
                            }

                            if (files[3]) {
                                // Add attributes
                                attributes = files[3]
                                    .split(" ")
                                    .map((pair) => pair.split("="));
                                attributes.forEach((attribute) => {
                                    // Handle dates
                                    if (attribute[0] == "time::modified") {
                                        file_obj["mtime"] = attribute[1];
                                    } else if (attribute[0] == "time::access") {
                                        file_obj["atime"] = attribute[1];
                                    } else if (
                                        attribute[0] == "time::created"
                                    ) {
                                        file_obj["ctime"] = attribute[1];
                                    } else {
                                        file_obj[attribute[0]] = attribute[1];
                                    }
                                });
                            }

                            dirents.push(file_obj);
                        }
                    });

                    file_arr = dirents;
                    return callback(dirents);
                } else {
                    console.log(err);
                }
            }
        );
    } else {
        fs.readdir(dir, (err, files) => {
            files.forEach((file) => {
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
                });
            });

            file_arr = dirents;
            return callback(dirents);
        });
    }
}

function get_gio_files(href) {
    breadcrumbs.value = href;
    let folder_grid = document.getElementById("folder_grid");
    let file_grid = document.getElementById("file_grid");

    get_dir(href, (files) => {
        folder_grid.innerHTML = "";
        file_grid.innerHTML = "";

        files.forEach((file, idx) => {
            if (idx < files.length - 1) {
                let card = get_card(file.href);
                let col = add_column("three");
                col.append(card);

                if (file.is_dir) {
                    folder_grid.append(col);
                } else {
                    file_grid.append(col);
                }
            }
        });
    });
}

async function get_disk_space() {
    let status = document.getElementById("status");
    status.innerHTML = "";
    status.append(add_icon("spinner"), "Getting disk space..");
    ipcRenderer.send("get_disk_space", {
        href: breadcrumbs.value,
        folder_count: get_folder_count(),
        file_count: get_file_count(),
    });
}

/**
 * Get Mounts and Display in Sidebar
 */
async function get_devices() {
    try {
        // Init
        let devices = [];
        let sidebar_items = document.getElementById("sidebar_items");
        let device_view = add_div();
        let uid = execSync("id -u").toString().replace("\n", "");
        let username = await ipcRenderer.invoke("username");
        let media_path = `/media/${username}/`;

        device_view.style = "padding-top: 20px; height: 100%";
        device_view.id = "device_view";
        device_view.addEventListener("contextmenu", function (e) {
            ipcRenderer.send("show-context-menu-devices");
        });

        sidebar_items.innerHTML = "";

        let enable = 1;
        if (enable) {
            exec(`gio mount -l | grep "Mount("`, (err, stdout, stderr) => {
                if (!err) {
                    devices = [];
                    let output = stdout.split("\n");
                    output.forEach((item) => {
                        let device = {};
                        let gio_mounts = item.split(": ");
                        gio_mounts.forEach((gio_mount, idx) => {
                            if (idx % 2) {
                                let mounts = gio_mount.trim().split(" -> ");

                                mounts.forEach((item, idx) => {
                                    if (!idx % 2) {
                                        device.name = item;
                                    } else {
                                        if (is_gio_file(item)) {
                                            device.type = 1;
                                        } else {
                                            device.type = 0;
                                        }

                                        if (
                                            item.substring(
                                                item.length,
                                                item.length - 1
                                            ) === "/"
                                        ) {
                                            item = item.substring(
                                                0,
                                                item.length - 1
                                            );
                                        }

                                        device.href = item;
                                    }
                                });
                            }
                        });

                        devices.push(device);
                    });
                    // GIO devices
                    if (devices.length > 0) {
                        device_view.append("Network");
                        let ul_header = document.createElement("ul");

                        devices.forEach((item, idx) => {
                            if (
                                idx < devices.length - 1 &&
                                item.href.indexOf("/media") == -1
                            ) {
                                let li = document.createElement("li");
                                let device = add_div();
                                let link = add_link(item.href, item.name);
                                let icon = add_icon("server");
                                let umount = add_icon("eject");
                                let div = add_div();

                                let col1 = (add_div().innerHTML = icon);
                                let col2 = (add_div().innerHTML = link);
                                let col3 = (add_div().innerHTML = umount);

                                link.style = "display: block; margin-top:15px;";
                                col2.style = "width: 100%";

                                div.append(col1, col2, col3);
                                div.classList.add("flex", "item");

                                device.append(div);

                                li.append(device);

                                umount.addEventListener("click", (e) => {
                                    let cmd = `gio mount -u -f "${item.href}"`;
                                    console.log(cmd);

                                    exec(
                                        `gio mount -u -f "${item.href}"`,
                                        (err, stdout) => {
                                            if (!err) {
                                                div.remove();
                                                notification(stdout);
                                            } else {
                                                notification(err);
                                            }
                                        }
                                    );
                                });

                                div.onclick = (e) => {
                                    e.preventDefault();

                                    breadcrumbs.value = link.href;
                                    get_view(`${link.href}`);
                                };
                                ul_header.append(li);
                            }
                        });

                        device_view.append(ul_header);
                        sidebar_items.append(device_view);
                    } else {
                        sidebar_items.append("No devices found.");
                    }
                }
            });
        }

        let dirs = [{ type: "media", path: media_path }];
        dirs.forEach((dir) => {
            fs.readdir(dir.path, (err, devices) => {
                if (!err) {
                    if (devices.length > 0) {
                        device_view.append("Devices");

                        let ul_header = document.createElement("ul");
                        devices.forEach((item) => {
                            let li = document.createElement("li");

                            let device = add_div();
                            let link = add_link(item, item);
                            let icon = add_icon("hdd");
                            let umount = add_icon("eject");
                            let div = add_div();

                            let col1 = (add_div().innerHTML = icon);
                            let col2 = (add_div().innerHTML = link);
                            let col3 = (add_div().innerHTML = umount);

                            link.style = "display: block";
                            col2.style = "width: 100%";

                            div.append(col1, col2, col3);
                            div.style =
                                "display: flex; padding: 6px; width: 100%;";
                            div.classList.add("item");

                            device.append(div);

                            li.append(device);

                            umount.addEventListener("click", (e) => {
                                if (dir.type == "media" || dir.type == "mnt") {
                                    exec(
                                        `umount "${path.join(dir.path, item)}"`,
                                        (err, stdout) => {
                                            if (!err) {
                                                get_devices();
                                                notification(stdout);
                                            } else {
                                                notification(err);
                                            }
                                        }
                                    );
                                } else if (dir.type == "gvfs") {
                                    exec(
                                        `fusermount -uz "${dir.path}"`,
                                        (err, stdout) => {
                                            if (!err) {
                                                get_devices();
                                                notification(stdout);
                                            } else {
                                                notification(err);
                                            }
                                        }
                                    );
                                }
                            });

                            div.onclick = (e) => {
                                e.preventDefault();
                                get_view(`${path.join(dir.path, item)}`);
                            };
                            ul_header.append(li);
                        });

                        device_view.append(ul_header);
                        sidebar_items.append(device_view);
                    }
                } else {
                    notification(err);
                }
            });
        });

        let mnt = fs.readdirSync("/mnt/");
        mnt.forEach((item) => {
            devices.push({
                name: item,
                href: path.join("/mnt", item),
                type: "mount",
            });
        });

        let media = fs.readdirSync("/media/michael/");
        media.forEach((item) => {
            devices.push({
                name: item,
                href: path.join("/media/michael", item),
                type: "media",
            });
        });
    } catch (err) {
        notification(err);
    }
}

/**
 * Autocomplete for directories in the location textbox (breadcrumbs)
 * refer to style.css for formating options
 */
function autocomplete() {
    let ac = 0;

    let autocomplete = document.getElementById("autocomplete");
    let breadcrumbs = document.getElementById("breadcrumbs");
    let breadcrumb_items = document.getElementById("breadcrumb_items");
    let folders = fs.readdirSync(breadcrumbs.value);
    let folders_arr = folders.filter((a) =>
        fs.statSync(path.join(breadcrumbs.value, a)).isDirectory()
    );

    breadcrumbs.addEventListener("keyup", (e) => {
        breadcrumb_items.innerHTML = "";
        let search_results = [];

        let search = e.target.value.substring(
            path.dirname(breadcrumbs.value).length + 1,
            e.target.value.length
        );

        folders_arr.forEach((item) => {
            if (
                item.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) >
                    -1 &&
                (item.toLocaleLowerCase().indexOf(search) < 1 ||
                    item.toLocaleLowerCase().indexOf(search.toLowerCase()) < 1)
            ) {
                search_results.push(
                    path.join(path.dirname(breadcrumbs.value), item)
                );
            }
        });

        if (search_results.length > 0) {
            breadcrumb_items.classList.remove("hidden");
            if (e.key === "Escape") {
                breadcrumb_items.classList.add("hidden");
            }

            search_results.forEach((breadcrumb_item, idx) => {
                if (idx == 0) {
                    let length0 = breadcrumbs.value.length;
                    breadcrumbs.setSelectionRange(
                        parseInt(length0),
                        parseInt(breadcrumb_item.length)
                    );
                }

                let link = add_link(breadcrumb_item, breadcrumb_item);

                link.classList.add("header_link");

                let item = add_item(link);
                item.tabIndex = idx;
                breadcrumb_items.append(item);
                autocomplete.append(breadcrumb_items);

                item.addEventListener("click", (e) => {
                    get_view(e.target.innerText);
                });
            });

            let items = breadcrumb_items.querySelectorAll(".item");

            if (e.key === "ArrowDown") {
                ++ac;
                items[ac - 1].classList.add("highlight");
                if (ac >= items.length) {
                    ac = 0;
                }
            }

            if (e.key === "ArrowUp") {
                --ac;
                items[ac].classList.add("highlight");
            }

            if (e.key === "Enter") {
                let dir = items[ac - 1].innerText;
                ac = 0;
                get_view(dir);
                breadcrumb_items.classList.add("hidden");
                breadcrumbs.focus();
            }
        } else {
        }

        if (e.key === "Escape") {
            main_view.focus();
        }
    });
}

/* Add select files to copy array */
function copy() {
    add_copy_file();
}

/* Cut operation */
function cut() {
    let highlight = document.querySelectorAll(
        ".highlight, .highlight_select, .ds-selected"
    );

    // SET CUT FLAG TO 1
    cut_files = 1;

    let folder_count = 0;
    let file_count = 0;

    if (highlight.length > 0) {
        add_copy_file();

        let source = "";
        highlight.forEach((item, idx) => {
            source = item.querySelector("a").getAttribute("href");
            item.style = "opacity: 0.6 !important";
            item.classList.remove("ds-selected");
        });
    }
}

/* Select all cards */
function select_all() {
    let card = document.getElementsByClassName("highlight");

    if (card.length > 0) {
        let grid = card[0].closest(".grid");
        let cards = grid.getElementsByClassName("card");

        for (let i = 0; i < cards.length; i++) {
            cards[i].classList.add("highlight_select");
        }
    } else {
        let main_view = document.getElementById("main_view");
        let nav_item = main_view.querySelectorAll(".nav_item");

        nav_item.forEach((item) => {
            item.classList.add("highlight_select");
        });

        notification(`${nav_item.length} Items Selected`);
    }
}

// LAZY LOAD IMAGES
let page_number = 1;
let page_size = 100;

function lazyload1() {
    let c = 0;
    let cards = [].slice.call(document.querySelectorAll(".lazy"));
    let pager = document.getElementById("pager");

    if ("IntersectionObserver" in window) {
        let cardObserver = new IntersectionObserver(function (
            entries,
            observer
        ) {
            entries.forEach((e, idx) => {
                if (e.isIntersecting) {
                    target = e.target;
                    target.src = target.dataset.src;
                }
            });
        });

        cards.forEach((card) => {
            cardObserver.observe(card);
        });
    }
}

// LAZY LOAD IMAGES
function lazyload() {
    // LAZY LOAD IMAGES
    let cards = [].slice.call(document.querySelectorAll(".nav_item"));
    let pager = document.getElementById("pager");

    // CHECK IF WINDOW
    if ("IntersectionObserver" in window) {
        // GET REFERENCE TO LAZY IMAGE
        let cardObserver = new IntersectionObserver(function (
            entries,
            observer
        ) {
            entries.forEach((e, idx) => {
                if (e.isIntersecting) {
                    target = e.target;
                    target.src = target.dataset.src;
                }
            });
        });

        // THIS RUNS ON INITIAL LOAD
        cards.forEach((card) => {
            cardObserver.observe(card);
        });
    }
}

// HIDE PROGRESS
function hide_progress(card_id) {
    let progress = document.getElementsByClassName("progress");
    if (progress) {
        for (let i = 0; i < progress.length; i++) {
            progress[i].classList.add("hidden");
        }
    }
}

// PASTE
function paste() {
    state = 2;
    ipcRenderer.send("is_main_view", 1);

    // RUN MOVE TO FOLDER
    if (cut_files == 1) {
        cut_files = 0;
        move_to_folder(breadcrumbs.value, state);

        // RUN COPY FUNCTION
    } else {
        copy_files(breadcrumbs.value, state);
    }

    // CLEAN UP
    clear_items();
}

// ADD GRID
function add_grid() {
    let grid = document.createElement("div");
    grid.classList.add("ui", "grid");
    return grid;
}

// ADD DIV
function add_div() {
    let div = document.createElement("div");
    return div;
}

function add_tab(label) {
    tabs.classList.remove("hidden");

    let div = add_div();
    div.classList.add("fm", "tab");

    let col1 = add_div();
    let col2 = add_div();

    div.onclick = (e) => {
        let tabs = document.querySelectorAll(".tab");
        tabs.forEach((tab) => {
            tab.classList.remove("active-tab");
        });

        div.classList.add("fm", "active-tab");
        get_view(label);
    };

    div.classList.add("fm", "active-tab");

    let btn_close = add_icon("times");
    btn_close.classList.add("small");
    col2.onclick = (e) => {
        div.remove();
        get_view(breadcrumbs.value);
    };

    btn_close.style = "padding-left: 10px; padding-right: 10px;";

    col1.append(label);
    col2.append(btn_close);

    div.append(col1, col2);

    return div;
}

// ADD ROW
function add_row() {
    let row = document.createElement("div");
    row.classList.add("row");
    row.style = "width: 100%; padding: 0px !important;";
    return row;
}

// ADD DRAGHANDLE
function add_draghandle() {
    let draghandle = add_div();
    draghandle.style =
        "width: 4px; height:100%; position:absolute; right: 0; background-color: #2c2c2c";

    draghandle.addEventListener("mouseover", (e) => {
        draghandle.style.cursor = "col-resize";
    });

    draghandle.addEventListener("mouseout", (e) => {});

    return draghandle;
}

// ADD COLUNN
function add_column(length) {
    // CREATE OOLUMN
    let column = add_div();
    column.classList.add("column", length, "wide");
    return column;
}

// ADD BREAK
function add_br() {
    return document.createElement("br");
}

/**
 *
 * @param {HTMLElement} text
 * @returns HTMLDivElement
 */
function add_item(text) {
    let item = add_div();
    item.classList.add("item");
    item.append(text);
    return item;
}

/**
 *
 * @param {String} text
 * @returns a text
 */
function add_text(text) {
    let item = add_div();
    item.append(text);
    return item;
}

/**
 *
 * @param {string} type valid types text, checkbox, color, date, datetime-local, email, file, hidden, image, month, number, password,radio, range,reset, search, submit, tel, text, time, url, week
 * @param {string} id HTML Element ID
 */
function add_input(type, id) {
    let input = document.createElement("input");
    input.id = id;
    input.type = type;
    input.style =
        "height: 20px; border: none; margin-top: 10px; margin-bottom: 10px";
    return input;
}

/**
 *
 * @param {int} id
 * @param {string} text
 * @returns
 */
function add_button(id, text) {
    let button = document.createElement("input");
    button.type = "button";
    button.classList.add("ui", "button");
    button.value = text;
    return button;
}

// ADD CHECKBOX
function add_checkbox(id, label) {
    let checkbox = add_div();

    let chk_label = add_label(label);
    chk_label.htmlFor = id;

    let chk = document.createElement("input");
    chk.type = "checkbox";
    chk.id = id;
    chk.classList.add("checkbox");

    checkbox.append(chk);
    checkbox.append(chk_label);

    return checkbox;
}

/**
 * Append a string or object to a label
 * @param {object} text
 * * @param {string} label_for
 * @returns HTML label element
 */
function add_label(text, label_for = "") {
    let label = document.createElement("label");
    label.classList.add("label");
    label.htmlFor = label_for;
    label.style = "padding-bottom: 5px;";
    label.append(text);
    return label;
}

// ADD PROGRESS
function add_progress() {
    let progress = document.createElement("progress");
    progress.value = 1;
    progress.max = 100;
    return progress;
}

// ADD IMG
function add_img(src) {
    let img = document.createElement("img");
    let icon_dir = path.join(__dirname, "assets", "icons");
    img.style =
        "float:left; padding-right: 5px; vertical-align: middle !important";
    img.width = 32;
    img.classList.add("lazy");
    img.dataset.src = src;
    img.src = path.join(
        __dirname,
        "assets/icons/kora/actions/scalable/viewimage.svg"
    );
    return img;
}

/**
 *
 * @param {HtmlElement} msg
 */
function add_message(msg) {
    let div = add_div();
    div.classList.add("ui", "message");
    div.append(msg);
    return div;
}

// RETURNS A STRING PATH TO AN ICON IMAGE BASED ON FILE EXTENSION
function get_icon_theme() {
    let icon_theme = "kora";
    let icon_dir = path.join(__dirname, "assets", "icons");

    try {
        if (process.platform === "linux") {
            icon_theme = execSync(
                "gsettings get org.gnome.desktop.interface icon-theme"
            )
                .toString()
                .replace(/'/g, "")
                .trim();

            let search_path = [];
            search_path.push(
                path.join(get_home(), ".local/share/icons"),
                path.join(get_home(), ".icons"),
                "/usr/share/icons"
            );

            search_path.every((icon_path) => {
                if (fs.existsSync(path.join(icon_path, icon_theme))) {
                    icon_dir = path.join(icon_path, icon_theme);
                    return false;
                } else {
                    icon_dir = path.join(__dirname, "assets", "icons", "kora");
                    return true;
                }
            });
        } else if (
            process.platform === "win32" ||
            process.platform === "darwin"
        ) {
        } else {
        }
    } catch (err) {}

    return icon_dir;
}

// Get icon theme directory
let theme_dir = get_icon_theme();

// GET FOLDER_ICON
function get_folder_icon(callback) {
    let folder_icon_path = "";
    let icon_dirs = [
        path.join(theme_dir, "32x32/places/folder.png"),
        path.join(theme_dir, "places/scalable/folder.svg"),
        path.join(theme_dir, "places/64/folder.svg"),
    ];
    icon_dirs.every((icon_dir) => {
        // let icon_path = path.join(icon_dir, 'folder.png');
        if (fs.existsSync(icon_dir)) {
            folder_icon_path = icon_dir;
            return false;
        } else {
            folder_icon_path = path.join(
                __dirname,
                "assets/icons/kora/places/scalable/folder.svg"
            );
            return true;
        }
    });

    return folder_icon_path;
}

let folder_icon = get_folder_icon();

function get_icon_path(file) {
    try {
        let stats = fs.statSync(file);
        let file_ext = path.extname(file);
        if (stats.isDirectory()) {
            // todo: this needs to be reworked to get theme folder icon
            icon_dir = path.join(__dirname, "/assets/icons/kora");
            icon = path.join(
                icon_dir,
                "/mimetypes/scalable/application-document.svg"
            );
        } else {
            icon_dir = path.join(__dirname, "/assets/icons/kora");
            if (
                file_ext.toLocaleLowerCase() == ".jpg" ||
                file_ext.toLocaleLowerCase() == ".png" ||
                file_ext.toLocaleLowerCase() == ".jpeg" ||
                file_ext.toLocaleLowerCase() == ".gif" ||
                file_ext.toLocaleLowerCase() == ".svg" ||
                file_ext.toLocaleLowerCase() == ".ico" ||
                file_ext.toLocaleLowerCase() == ".webp"
            ) {
                icon = file;
                let img_data = get_img_data(file);
            } else if (
                file_ext == ".xls" ||
                file_ext == ".xlsx" ||
                file_ext == ".xltx" ||
                file_ext == ".csv"
            ) {
                icon = path.join(icon_dir, "/apps/scalable/ms-excel.svg");
            } else if (
                file_ext == ".docx" ||
                file_ext == ".ott" ||
                file_ext == ".odt"
            ) {
                icon = path.join(
                    icon_dir,
                    "/apps/scalable/libreoffice-writer.svg"
                );
            } else if (
                file_ext == ".wav" ||
                file_ext == ".mp3" ||
                file_ext == ".mp4" ||
                file_ext == ".ogg"
            ) {
                icon = path.join(icon_dir, "/mimetypes/scalable/audio-wav.svg");
            } else if (file_ext == ".iso") {
                icon = path.join(icon_dir, "/apps/scalable/isomaster.svg");
            } else if (file_ext == ".pdf") {
                icon = path.join(icon_dir, "/apps/scalable/gnome-pdf.svg");
            } else if (
                file_ext == ".zip" ||
                file_ext == ".xz" ||
                file_ext == ".tar" ||
                file_ext == ".gz" ||
                file_ext == ".bz2"
            ) {
                icon = path.join(icon_dir, "/apps/scalable/7zip.svg");
            } else if (file_ext == ".deb") {
                icon = path.join(icon_dir, "/apps/scalable/gkdebconf.svg");
            } else if (file_ext == ".txt") {
                icon = path.join(icon_dir, "/apps/scalable/text.svg");
            } else if (file_ext == ".sh") {
                icon = path.join(icon_dir, "/apps/scalable/terminal.svg");
            } else if (file_ext == ".js") {
                icon = path.join(
                    icon_dir,
                    "/apps/scalable/applications-java.svg"
                );
            } else if (file_ext == ".sql") {
                icon = path.join(
                    icon_dir,
                    "/mimetypes/scalable/application-x-sqlite.svg"
                );
            } else {
                icon = path.join(
                    icon_dir,
                    "/mimetypes/scalable/application-document.svg"
                );
            }
        }
    } catch (err) {}
    return icon;
}

// ADD LINK
function add_link(href, text) {
    let link = document.createElement("a");
    link.href = href;
    link.text = text;
    link.title = href;

    link.onclick = (e) => {
        e.preventDefault();
    };

    return link;
}

// ADD ICON
function add_icon(icon_name) {
    let icon = document.createElement("i");
    icon.classList.add("ui", "icon");

    let icon_names = icon_name.split(",");
    icon_names.forEach((item) => {
        icon.classList.add(item);
    });

    return icon;
}

// ADD ICON
function add_p(text) {
    let p = document.createElement("p");
    p.innerHTML = text;
    return p;
}

// ADD HEADER
function add_header(text) {
    let header = add_div();
    header.classList.add("header");
    header.title = text;
    header.innerHTML = text;
    return header;
}

// ADD HEADER MENU ITEM
function add_menu_item(options) {
    let item = document.createElement("a");
    item.classList.add("item");
    item.id = options.id;

    let icon = document.createElement("i");
    icon.classList.add(options.icon, "icon");

    let content = document.createElement("div");
    content.innerText = "shit";

    item.appendChild(icon);
    item.appendChild(content);

    const header_menu = document.getElementById("header_menu");
    header_menu.appendChild(item);
}

/* SHOW SIDE BAR */
function show_sidebar() {
    let show = parseInt(localStorage.getItem("sidebar"));
    let sidebar = document.getElementById("sidebar");
    let main_view = document.getElementById("main_view");
    let draghandle = document.getElementById("draghandle");

    // SET / GET SIDEBAR WIDTH
    let sidebar_width = 250;
    if (localStorage.getItem("sidebar_width")) {
        sidebar_width = localStorage.getItem("sidebar_width");
    } else {
        localStorage.setItem("sidebar_width", sidebar_width);
    }

    if (show) {
        sidebar.classList.remove("hidden");
        sidebar.style.width = sidebar_width + "px";
        draghandle.style.height = parseInt(main_view.clientHeight + 30) + "px";

        // SET MAIN VIEW SIZE
        main_view.style.marginLeft = parseInt(sidebar_width) + 40 + "px";

        localStorage.setItem("sidebar", 1);
        show = 0;
    } else {
        sidebar.classList.add("hidden");
        main_view.style.marginLeft = parseInt(0) + 50 + "px";

        localStorage.setItem("sidebar", 0);
        show = 1;
    }

    sidebar.draggable = false;
}

// HIDE SIDE BAR
function hide_sidebar() {
    // SHOW / HIDE SIDEBAR
    let sidebar = document.getElementById("sidebar");
    let main_view = document.getElementById("main_view");

    sidebar.style.width = "0";
    sidebar.classList.add("hidden");

    main_view.style.marginLeft = "5px";

    sidebar_visible = 0;
}

/** NOTIFICATION */
window.notification = function notification(msg) {
    let notification = document.getElementById("notification");
    notification.innerHTML = msg;
    notification.classList.remove("hidden");
    setInterval(() => {
        notification.classList.add("hidden");
    }, 3000);
};

/** Refresh Main View */
function refreshView() {
    get_view(breadcrumbs.value);
    localStorage.setItem("folder", breadcrumbs.value);
}

/** Create Folder */
function create_folder(folder) {
    let folder_grid = document.getElementById("folder_grid");
    folder_grid.classList.remove("hidden");

    gio.mkdir(folder, (res) => {
        gio.get_file(folder, (file) => {
            let card = get_card1(file);
            let col = add_column("three");
            col.append(card);
            folder_grid.prepend(col);

            let info_view = document.getElementById("info_view");
            info_view.classList.add("hidden");

            let header_link = card.querySelector(".header_link");
            let input = card.querySelector(".input");

            header_link.classList.add("hidden");
            input.classList.remove("hidden");
            input.select();
        });

        let file_obj = {
            name: path.basename(folder),
            href: folder,
            size: 0,
            mtime: new Date(),
            is_dir: 1,
        };
        if (!res.err) {
            let main_view = document.getElementById("main_view");
            main_view.tabIndex = -1;
            main_view.preventDefault = true;

            let info_view = document.getElementById("info_view");
            info_view.classList.add("hidden");

            let card = get_card1(file_obj);
            let col = add_column("three");
            col.append(card);

            folder_grid.insertBefore(col, folder_grid.firstChild);

            let header = card.querySelector(".header_link");
            let input = card.querySelector(".input");

            input.classList.remove("hidden");
            header.classList.add("hidden");

            input.focus();
            input.select();
        } else {
            notification(res.err);
        }
    });

    fs.mkdir(folder, {}, (err) => {
        if (err) {
            notification(err);
        } else {
            let info_view = document.getElementById("info_view");
            info_view.innerHTML = "";

            // GET REFERENCE TO FOLDERS CARD
            let folders_card = document.getElementById("folders_card");
            folders_card.classList.remove("hidden");

            // GET REFERENCE TO FOLDER GRID
            let folder_grid = document.getElementById("folder_grid");

            let items = document.getElementsByClassName("folder_card");
            let card_id = "folder_card_" + items.length;

            // CREATE CARD OPTIONS
            let options = {
                id: card_id,
                href: folder,
                linktext: path.basename(folder),
                grid: folder_grid,
                is_folder: true,
            };

            try {
                /* Add Card */
                add_card(options).then((card) => {
                    let header = card.querySelector(".header_link");
                    let input = card.querySelector("input");
                    let col = add_column("three");

                    input.classList.remove("hidden");

                    col.append(card);
                    folder_grid.insertBefore(col, folder_grid.firstChild);

                    input.focus();
                    input.select();
                    header.classList.add("hidden");
                    update_card(card.dataset.href);
                });
            } catch (err) {
                notification(err);
                info(err);
            }
        }
    });
    refreshView();
    ipcRenderer.send("get_disk_space", {
        href: breadcrumbs.value,
        folder_count: get_folder_count(),
        file_count: get_file_count(),
    });
    clear_items();
}

function add_copy_file() {
    let folder_count = 0;
    let file_count = 0;

    copy_files_arr = [];

    let cards = document.querySelectorAll(
        ".highlight_select, .highlight, .ds-selected"
    );
    cards.forEach((card) => {
        let file = card.dataset.href;
        if (file) {
            copy_files_arr.push(file);

            if (file.is_dir) {
                ++folder_count;
            } else {
                ++file_count;
            }
        }
    });

    notification(`${folder_count} Folders ${file_count} Files Copied`);
    ipcRenderer.send("add_copy_files", copy_files_arr);
}

/* Add copy files array */
function add_copy_file_old(source, card_id) {
    if (!source == "") {
        if (copy_files_arr.length > 0) {
            if (copy_files_arr.every((x) => x.source != source)) {
                let file = {
                    card_id: card_id,
                    source: source,
                    size: localStorage.getItem(source),
                    destination: "",
                };

                copy_files_arr.push(file);
                ipcRenderer.send("add_copy_files", copy_files_arr);
                ipcRenderer.send(
                    "copy_to_clipboard",
                    JSON.stringify(copy_files_arr)
                );
            }
        } else {
            let file = {
                card_id: card_id,
                source: source,
                size: localStorage.getItem(source),
            };

            copy_files_arr.push(file);
            ipcRenderer.send("add_copy_files", copy_files_arr);
            ipcRenderer.send(
                "copy_to_clipboard",
                JSON.stringify(copy_files_arr)
            );
        }
    }
}

/* COPY FILES */
async function copy_files(destination_folder, state) {
    ipcRenderer.send("get_copy_files");
    ipcRenderer.send("destination_folder", destination_folder); // set destination folder for updates

    let info_view = document.getElementById("info_view");
    info_view.innerHTML = "";

    // RESET COUNTER. HANDLES SETTING ROOT FOLDER SO THE SIZE CAN BE UPDATED
    copy_folder_counter = 0;

    // ADD DESTINATION TO COPY FILES ARRAY
    copy_files_arr.forEach((item, idx) => {
        item.destination = destination_folder;
    });

    ipcRenderer.send("copy", state);
    clear_copy_arr();
}

// todo: need to figure out when this is done

// COPY FILE SYNC
let number_of_files = 0;
let recursive = 0;

// COPY FILE
function copyFileSync(source, target) {
    var targetFile = target;
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    recursive++;

    // HANDLE PROGRESS
    let progress = document.getElementById("progress");
    progress.classList.remove("hidden");

    let source_stats = fs.statSync(source);
    let intervalid = setTimeout(() => {
        try {
            let destination_stats = fs.statSync(target);
            progress.value = destination_stats.size;

            if (destination_stats.size >= source_stats.size) {
                hide_top_progress();
                clearInterval(intervalid);
            }
        } catch (err) {}
    }, 100);

    // COPY FILE
    fs.copyFile(source, targetFile, (err) => {
        if (err) {
            console.log(err);
        } else {
            if (--recursive == 0) {
                // CLEAR PROGRESS
                hide_top_progress();
                c = 0;

                // UPDATE CARDS
                let main_view = document.getElementById("main_view");
                update_cards(main_view);

                notification("done copying folder files to " + target);
            } else {
                notification("copying folder files to " + targetFile);
            }
        }
    });
}

// COPY FOLDER
let root = "";
let copy_folder_counter = 0;
let destination0 = "";

function copyFolderRecursiveSync(source, destination) {
    copy_folder_counter += 1;

    // COPY
    // READ SOURCE DIRECTORY
    fs.readdir(source, function (err, files) {
        if (err) {
            console.log(err);
        } else {
            // CHECK LENGTH
            if (files.length > 0) {
                if (!fs.existsSync(destination)) {
                    destination0 = destination;
                    fs.mkdirSync(destination);
                } else {
                    fs.mkdirSync(destination + " Copy");
                }

                // LOOP OVER FILES
                files.forEach((file, idx) => {
                    // GET FOLDER SIZE WORKS HERE KIND OF!!!. RUNS TOO MANY TIMES.
                    // todo: need to figure out how to handle this better

                    // GET CURRENT SOURCE / CURRENT DESTINATION
                    let cursource = path.join(source, file);
                    let curdestination = path.join(destination, file);

                    // GET STATS OF CURRENT SOURCE
                    fs.stat(cursource, (err, stats) => {
                        if (err) {
                            console.log(err);
                        } else {
                            // DIRECTORY
                            if (stats.isDirectory() == true) {
                                copyFolderRecursiveSync(
                                    cursource,
                                    curdestination
                                );
                                // UPDATE FOLDER_SIZE
                                ipcRenderer.send("get_folder_size", {
                                    href: destination,
                                });

                                // FILE
                            } else if (stats.isFile() == true) {
                                // debugger
                                copyFileSync(cursource, curdestination);
                            }
                        }
                    });
                });
            }
        }
    });
}

// MOVE FOLDER - done
// 이동을 할때 반영이 안되고, 폴더가 생성되면 바로 반영이 안됨
function move_to_folder(destination, state) {
    let info_view = document.getElementById("info_view");
    info_view.innerHTML = "";
    // // ADD DESTINATION TO ARRAY
    copy_files_arr.forEach((item, idx) => {
        item.destination = destination;
    });

    // SEND TO MAIN
    ipcRenderer.send("move", state);
    clear_items();
}

// CREATE FILE FROM TEMPLATE
function create_file_from_template(filename) {
    let main_view = document.getElementById("main_view");
    let info_view = document.getElementById("info_view");

    let template = path.join(__dirname, "assets/templates/", filename);
    let destination = `${breadcrumbs.value}/${filename}`;

    info_view.innerHTML = "";

    if (fs.existsSync(destination) === true) {
        alert("this file already exists");
    } else {
        fs.writeFileSync(destination, "");
        refreshView();

        ipcRenderer.send("get_disk_space", {
            href: breadcrumbs.value,
            folder_count: get_folder_count(),
            file_count: get_file_count(),
        });
    }

    clear_items();
}

// RENAME FILE OR FOLDER
function rename_file(source, destination_name, callback) {
    if (destination_name === "") {
        alert("Enter a file name");
    } else {
        let filename = path.join(path.dirname(source), destination_name);
        if (fs.existsSync(filename)) {
            alert(filename + " already exists!");
            return false;
        } else {
            fs.rename(source, filename, function (err) {
                if (!err) {
                    notification(`Renamed ${source} to ${filename}`);
                    refreshView();
                    return callback(1);
                } else {
                    notification(err);
                    return callback(err);
                }
            });
        }
    }
}

// DELETE CONFIRMED
delete_files_count = 0;
delete_folder_count = 0;

function delete_confirmed() {
    let info_view = document.getElementById("info_view");

    // LOOP OVER ITEMS DELETE ARRAY
    if (delete_arr.length > 0) {
        delete_arr.forEach((file, idx) => {
            card_id = file.card_id;

            // IF DIRECTORY
            if (fs.statSync(file.source).isDirectory()) {
                ++delete_folder_count;

                // RUN PROGRESS
                get_progress(parseInt(localStorage.getItem(file.source) * -1));

                // DELETE FOLDER
                delete_file(file.source);

                // IF FILE
            } else if (fs.statSync(file.source).isFile()) {
                ++delete_files_count;

                // DELETE FILE
                delete_file(file.source);
            } else {
                delete_file(file.source);
            }

            active_href = "";
        });

        let msg = "";
        if (delete_folder_count > 0) {
            msg = delete_folder_count + " folder/s deleted.";
        }
        if (delete_files_count > 0) {
            msg = msg + " " + delete_files_count + " file/s deleted";
        }

        notification(msg);

        // CLEAR DELETE ARRAY
        delete_arr = [];
        clear_items();

        ipcRenderer.send("get_disk_space", {
            href: breadcrumbs.value,
            folder_count: get_folder_count(),
            file_count: get_file_count(),
        });
    }
}

// Delete file
async function delete_file(file) {
    ipcRenderer.send("delete_file", file);
}

// Send selected files to delete
function delete_files() {
    let list = "";
    delete_arr = [];

    // GET HIGHLIGHTED ITEMS
    let items = document.querySelectorAll(
        ".highlight, .highlight_select, .ds-selected"
    );
    if (items.length > 0) {
        // LOOP OVER ITEMS AND ADD TO DELETE ARRAY
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let href = item.getAttribute("data-href");

            let file = {
                card_id: item.id,
                source: href,
            };

            delete_arr.push(file);
            list += href + "\n";

            item.classList.remove(
                "highlight",
                "highlight_select",
                "ds-selected"
            );
        }
        ipcRenderer.send("confirm_file_delete", delete_arr);
    }

    clear_items();
}

ipcRenderer.on("refresh", () => {
    refreshView();
});

/**
 *
 * @returns Number of Folders in the Current VIew
 */
function get_folder_count() {
    let folder_count = 0;
    let main_view = document.getElementById("main_view");
    let folder_cards = main_view.querySelectorAll(".folder_card");
    folder_count = folder_cards.length;
    return folder_count;
}

/**
 *
 * @returns Number of Files in the Current View
 */
function get_file_count() {
    let file_count = 0;
    let main_view = document.getElementById("main_view");
    let file_cards = main_view.querySelectorAll(".file_card");
    file_count = file_cards.length;
    return file_count;
}

// Calculate file size
function get_file_size(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [" kB", " MB", " GB", " TB", "PB", "EB", "ZB", "YB"];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
}

// Get raw file size
function get_raw_file_size(fileSizeInBytes) {
    var i = -1;
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1);
}

// Open terminal
function open_terminal() {
    let cards = document.querySelectorAll(
        ".highlight, .highlight_select, .ds-selected"
    );
    if (cards.length > 0) {
        cards.forEach((card) => {
            exec(
                `gnome-terminal --working-directory="${card.dataset.href}"`,
                (error, data, getter) => {}
            );
        });
    } else {
        exec(
            `gnome-terminal --working-directory="${breadcrumbs.value}"`,
            (error, data, getter) => {}
        );
    }
}

// NAVIGATE FUNCTION LEFT RIGHT UP
let back_counter = 1;

function navigate(direction) {
    let breadcrumbs = document.getElementById("breadcrumbs");
    let dir = breadcrumbs.value;
    let last_index = history_arr.lastIndexOf(breadcrumbs.value);
    let idx = 0;
    historize = 0;

    if (direction === "left") {
        if (dir.lastIndexOf(path.join("/")) == dir.length - 1) {
            dir = dir.substring(0, dir.length - 1);
        }
        dir = dir.substring(0, dir.lastIndexOf(path.join("/")));

        if (!dir) {
            dir = path.join("/");
        }
    }
    if (direction === "right") {
        ++back_counter;
        idx = history_arr + back_counter;
        if (idx < history_arr.length) {
            dir = history_arr[idx];
        } else {
            idx = 0;
            back_counter = 0;
        }
    }

    if (idx >= 0) {
        get_view(dir);
    } else {
        get_view(get_home());
    }
}

// EXTRACT HERE / DECOMPRESS
function extract() {
    let items = document.querySelectorAll(
        ".highlight, .highlight_select, .ds-selected"
    );

    items.forEach((item) => {
        let cmd = "";
        let us_cmd = "";
        let filename = "";
        let source = item.dataset.href;
        let ext = path.extname(source).toLowerCase();
        let makedir = 1;

        let c = 0;
        switch (ext) {
            case ".zip":
                filename = source.replace(".zip", "");
                c = 0;
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + " Copy";
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'";
                cmd = "unzip '" + source + "' -d '" + filename + "'";
                break;
            case ".tar":
                filename = source.replace(".tar", "");
                c = 0;
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + " Copy";
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'";
                cmd =
                    'cd "' +
                    breadcrumbs.value +
                    '"; /usr/bin/tar --strip-components=1 -xzf "' +
                    source +
                    '"';
                break;
            case ".gz":
                filename = source.replace(".tar.gz", "");
                c = 0;
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + " Copy";
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'";
                cmd =
                    'cd "' +
                    breadcrumbs.value +
                    '"; /usr/bin/tar -xzf "' +
                    source +
                    '" -C "' +
                    filename +
                    '"';

                break;
            case ".xz":
                filename = source.replace("tar.xz", "");
                filename = filename.replace(".img.xz", "");
                c = 0;
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + " Copy";
                    ++c;
                }
                us_cmd = "xz -l -v '" + source + "' | awk 'FNR==11{print $6}'";
                if (source.indexOf("img.xz") > -1) {
                    makedir = 0;
                    cmd =
                        'cd "' +
                        breadcrumbs.value +
                        '"; /usr/bin/unxz -k "' +
                        source +
                        '"';
                } else {
                    cmd =
                        'cd "' +
                        breadcrumbs.value +
                        '"; /usr/bin/tar -xf "' +
                        source +
                        '" -C "' +
                        filename +
                        '"';
                }
                break;
            case ".bz2":
                filename = source.replace(".bz2", "");
                c = 0;
                while (fs.existsSync(filename) && c < 5) {
                    filename = filename + " Copy";
                    ++c;
                }
                us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'";
                cmd =
                    'cd "' +
                    breadcrumbs.value +
                    '"; /usr/bin/bzip2 -dk "' +
                    source +
                    '"';
                break;
        }

        if (makedir) {
            fs.mkdirSync(filename);
        }

        // GET UNCOMPRESSED SIZE
        let uncompressed_size = parseInt(
            execSync(us_cmd).toString().replaceAll(",", "")
        );

        // RUN PROGRESS
        get_progress(uncompressed_size);

        notification("Extracting " + source);

        open(cmd);

        // 작업해야함
        // THIS NEEDS WORK. CHECK IF DIRECTORY EXIST. NEED OPTION TO OVERWRITE
        exec(
            cmd,
            { maxBuffer: Number.MAX_SAFE_INTEGER },
            (err, stdout, stderr) => {
                if (err) {
                    notification("error " + err);
                } else {
                    try {
                        if (makedir) {
                            // GET REFERENCE TO FOLDER GRID
                            let folder_grid =
                                document.getElementById("folder_grid");
                            let folders_card =
                                document.getElementById("folders_card");

                            get_file(filename, (file_obj) => {
                                file_obj.is_dir = 1;
                                let card = get_card1(file_obj);
                                let col = add_column("three");
                                col.append(card);

                                folders_card.classList.remove("hidden");
                                folder_grid.insertBefore(
                                    col,
                                    folder_grid.firstChild
                                );
                            });
                        } else {
                            makedir = 1;
                        }
                    } catch (err) {
                        console.log(err);
                        notification(err);
                    }

                    if (uncompressed_size > 1024 * 1024 * 1024) {
                        ipcRenderer.send(
                            "add_system_notification",
                            "Operation Complete",
                            "Done extractig file " + filename
                        );
                    }

                    clear_items();
                    notification("Extracted " + source);
                }
            }
        );
    });
}

// COMPRESS
function compress() {
    let cards = document.querySelectorAll(
        ".highlight, .highlight_select, .ds-selected"
    );
    let file_grid = document.getElementById("file_grid");
    let files_card = document.getElementById("files_card");
    let file_name = "";
    let file_list = "";
    let max = 0;

    cards.forEach((card, idx) => {
        if (idx == 0) {
            file_name = path.basename(card.dataset.href);
            file_name =
                file_name.substring(
                    0,
                    file_name.length - path.extname(file_name).length
                ) + ".tar.gz";
        }

        let file = path.basename(card.dataset.href);
        file_list += "'" + file + "' ";

        max += parseInt(localStorage.getItem(card.dataset.href));
    });
    get_progress(max, file_name);

    // Create compressed file
    let cmd =
        'cd "' +
        breadcrumbs.value +
        '"; tar czf "' +
        file_name +
        '" ' +
        file_list;
    exec(cmd, (err, stdout) => {
        if (err) {
            console.log(err);
        } else {
            update_card(path.join(breadcrumbs.value, file_name));
            clearInterval(intervalid);

            notification("Done compressinge files.");

            let file_obj = {
                href: path.join(breadcrumbs.value, file_name),
                name: path.basename(file_name),
                is_dir: 0,
                ["time::modified"]: get_date(new Date()),
                size: 0,
            };

            let card = get_card1(file_obj);
            let col = add_column("three");
            col.append(card);
            file_grid.insertBefore(col, file_grid.firstChild);

            update_card1(path.join(breadcrumbs.value, file_name));
        }
    });
    clear_items();
}

// Get context menu
function getContextMenu(href) {
    let filetype = mime.lookup(href);
    let associated_apps = get_available_launchers(filetype, href);

    // CHECK FOR FOLDER CARD CLASS
    if (stats.isDirectory()) {
        ipcRenderer.send("show-context-menu-directory", associated_apps);

        // CHECK IF FILE CARD
    } else if (stats.isFile()) {
        let access = 0;
        try {
            fs.accessSync(href, fs.X_OK);
            access = 1;
            ipcRenderer.send("show-context-menu-files", {
                apps: associated_apps,
                access: access,
                href: href,
            });
        } catch (err) {
            ipcRenderer.send("show-context-menu-files", {
                apps: associated_apps,
                access: access,
                href: href,
            });
        }
        // EMPTY AREA
    } else {
        ipcRenderer.send("show-context-menu");
    }
    let data = {
        source: path.join(__dirname, "assets/templates/"),
        destination: breadcrumbs.value + "/",
    };
    ipcRenderer.send("show-context-menu", data);
}

function toggle_hidden() {
    let grids = document.querySelectorAll(".navigate");
    grids.forEach((grid) => {
        if (grid.id == "hidden_folder_grid" || grid.id == "hidden_file_grid") {
            if (grid.classList.contains("hidden")) {
                grid.classList.remove("hidden");
            } else {
                grid.classList.add("hidden");
            }
        }
    });
}

//////////////////////////////////////////////////////////////////

// CONTEXT MENU COMMANDS
// FILES AND BLANK AREA
ipcRenderer.on("context-menu-command", (e, command, args) => {
    if (command == "show_hidden") {
        localStorage.setItem("show_hidden", 1);
        toggle_hidden();
    }

    // OPEN TEMPLATES FOLDER
    if (command == "open_templates_folder") {
        get_files(path.join(__dirname, "assets/templates"), {
            sort: localStorage.getItem("sort"),
        });
    }

    // EXTRACT HERE
    if (command === "extract_here") {
        extract();
    }

    // COMPRESS HERE
    if (command === "compress_folder") {
        compress();
    }

    if (command === "open_in_new_window") {
        let items = document.querySelectorAll(
            ".highlight, .highlight_selected, .ds-selected"
        );
        if (items.length) {
            items.forEach((item) => {
                localStorage.setItem("folder", item.dataset.href);
                ipcRenderer.send("new_window");
            });
        } else {
            localStorage.setItem("folder", breadcrumbs.value);
            ipcRenderer.send("new_window");
        }
    }

    // NEW WINDOW
    if (command === "new_window") {
        ipcRenderer.send("new_window");
    }

    // CREATE NEW FOLDER
    if (command === "new_folder") {
        let folder = breadcrumbs.value;
        function timestamp() {
            const today = new Date();
            today.setHours(today.getHours() + 9);
            return today.toISOString().replace("T", " ").substring(0, 19);
        }
        if (folder !== "") {
            create_folder(folder + "/Untitled Folder " + timestamp());
        }
    }

    // DELETE COMMAND
    delete_arr = [];
    if (command === "delete") {
        delete_files();
    }

    // FILES /////////////////////////////////////////////////////////////////////
    //from here needs check
    // CREATE FILE
    if (command === "new_file") {
        alert("!!!");
    }

    // RENAME FILE
    if (command === "rename") {
        let cards = document.querySelectorAll(
            ".highlight, .highlight_select, .ds-selected"
        );
        if (cards.length > 0) {
            cards.forEach((card) => {
                if (card) {
                    let header = card.querySelector("a");
                    header.classList.add("hidden");

                    let input = card.querySelector("input");
                    input.spellcheck = false;
                    input.classList.remove("hidden");
                    input.setSelectionRange(
                        0,
                        input.value.length - path.extname(header.href).length
                    );
                    input.focus();
                }
            });
        }
    }

    // COPY FILE OR FOLDER
    if (command === "cut") {
        cut();
    }

    // COPY FILE OR FOLDER
    if (command === "copy") {
        copy();
    }

    // PASTE COMMAND
    if (command === "paste") {
        // PAST FILES
        state = 2;
        ipcRenderer.send("is_main_view", 1);
        // RUN MOVE TO FOLDER
        if (cut_files == 1) {
            cut_files = 0;
            copy_files_arr.forEach((copyItem) => {
                let inputPath = copyItem.replaceAll(" ", "\\ ");
                let destPath = breadcrumbs.value.replaceAll(" ", "\\ ");
                exec(`mv ${inputPath} ${destPath}`, (err, stdout, stderr) => {
                    if (err) {
                        console.log(err);
                    }
                    if (stderr) {
                        console.log(stderr);
                    }
                    if (stdout) {
                        console.log(stdout);
                    }
                    refreshView();
                });
            });
            // RUN COPY FUNCTION
        } else {
            copy_files_arr.forEach((copyItem) => {
                let inputPath = copyItem.replaceAll(" ", "\\ ");
                let destPath = breadcrumbs.value.replaceAll(" ", "\\ ");
                exec(
                    `cp -rf ${inputPath} ${destPath}`,
                    (err, stdout, stderr) => {
                        if (err) {
                            console.log(err);
                        }
                        if (stderr) {
                            console.log(stderr);
                        }
                        if (stdout) {
                            console.log(stdout);
                        }
                        refreshView();
                    }
                );
            });
        }
        // CLEAN UP
        clear_items();
        copy_files_arr = [];
    }

    // IF WE RECIEVE DELETE CONFIRMED THEN DELETE FILE/S
    ipcRenderer.on("delete_file_confirmed", (e, res) => {
        delete_confirmed();
    });

    // OPEN TERMINAL
    if (command === "open_terminal") {
        open_terminal();
    }

    // OPEN VSCODE
    if (command === "vscode") {
        let items = document.querySelectorAll(
            ".highlight_select, .highlight, .ds-selected"
        );
        items.forEach((item) => {
            if (fs.statSync(item.dataset.href).isDirectory()) {
                exec(`cd "${item.dataset.href}"; code .`);
            } else {
                exec(`code "${item.dataset.href}"`);
            }
        });
    }

    // OPEN WITH
    if (command === "open_with_application") {
        let items = document.querySelectorAll(
            ".highlight_select, .highlight, .ds-selected"
        );
        items.forEach((item) => {
            let cmd = args;
            cmd = cmd.replace("%U", "'" + item.dataset.href + "'");
            cmd = cmd.replace("%F", "'" + item.dataset.href + "'");
            cmd = cmd.replace("%u", "'" + item.dataset.href + "'");
            cmd = cmd.replace("%f", "'" + item.dataset.href + "'");
            exec(cmd);
        });
    }

    if (command === "open_new_tab") {
        let tabs = document.getElementById("tabs");
        let items = document.querySelectorAll(
            ".highlight_select, .highlight, .ds-selected"
        );
        items.forEach((item, idx) => {
            let tab = add_tab(item.dataset.href);
            tabs.append(tab);

            if (items.length == idx + 1) {
                get_view(item.dataset.href);
            }
        });
    }

    // FILE PROPERTIES
    if (command === "props") {
        get_file_properties();
    }

    clear_items();
});

// RUN ON CONTEXT MENU CLOSE
ipcRenderer.on("clear_selected_files", (e, res) => {
    clear_items();
});

// ON DOCUMENT LOAD
window.addEventListener("DOMContentLoaded", () => {
    ipcRenderer.invoke("userdata_dir").then((res) => {
        // Set userdata directory
        userdata_dir = res;
        settings = JSON.parse(
            fs.readFileSync(path.join(res, "settings.json"), {
                encoding: "utf8",
                flag: "r",
            })
        );

        /* Initialize sort */
        let sort = localStorage.getItem("sort");
        if (sort == null || sort == "") {
            localStorage.setItem("sort", 1);
        }

        /* Initialize sort direction */
        let sort_direction = localStorage.getItem("sort_direction");
        if (sort_direction == null || sort_direction == "") {
            localStorage.setItem("sort_direction", "desc");
        }

        /* Initialize view */
        view = localStorage.getItem("view");
        if (view == null || view == "") {
            localStorage.setItem("view", "grid");
            view = "grid";
        }

        /* Initialize side bar */
        sidebar = localStorage.getItem("sidebar");
        if (sidebar == null || sidebar == "") {
            localStorage.setItem("sidebar", 1);
        }

        let minibar = document.getElementById("minibar");
        if (minibar) {
            minibar.addEventListener("click", (e) => {
                localStorage.setItem("sidebar", 1);
                show_sidebar();
            });
        }

        // INITIALIZE DRAG SELECT
        try {
            ds = new DragSelect({
                area: document.getElementById("grid_view"),
                selectorClass: "drag_select",
                keyboardDragSpeed: 0,
            });

            let sc = 0;
            ds.subscribe("elementselect", (e) => {
                notification(`${++sc} Items Selected`);
            });
            ds.subscribe("elementunselect", (e) => {
                if (--sc == 0) {
                    notification("");
                } else {
                    notification(`${sc} Items Selected`);
                }
            });

            ds.subscribe(
                "predragmove",
                ({ isDragging, isDraggingKeyboard }) => {
                    if (isDragging || isDraggingKeyboard) {
                        ds.break();
                    } else {
                    }
                }
            );
        } catch (err) {
            console.log(err);
        }

        // Show workspace
        Mousetrap.bind(
            settings.keyboard_shortcuts.ShowHome.toLocaleLowerCase(),
            () => {
                get_sidebar_home();
                localStorage.setItem("sidebar", 1);
                show_sidebar();
            }
        );

        // Show workspace
        Mousetrap.bind(
            settings.keyboard_shortcuts.ShowWorkspace.toLocaleLowerCase(),
            () => {
                get_workspace();
                localStorage.setItem("sidebar", 1);
                show_sidebar();
            }
        );

        Mousetrap.bind(
            settings.keyboard_shortcuts.ShowDevices.toLocaleLowerCase(),
            () => {
                get_devices();
                localStorage.setItem("sidebar", 1);
                show_sidebar();
            }
        );

        // Get File info
        Mousetrap.bind(
            settings.keyboard_shortcuts.Properties.toLocaleLowerCase(),
            () => {
                get_file_properties();
            }
        );

        // Navigate right
        Mousetrap.bind(
            settings.keyboard_shortcuts.Right.toLocaleLowerCase(),
            () => {
                navigate("right");
            }
        );

        // ALT+E EXTRACT
        Mousetrap.bind(
            settings.keyboard_shortcuts.Extract.toLocaleLowerCase(),
            (e) => {
                extract();
            }
        );

        // Compress
        Mousetrap.bind(
            settings.keyboard_shortcuts.Compress.toLocaleLowerCase(),
            (e) => {
                compress();
            }
        );

        // Select all
        Mousetrap.bind(
            settings.keyboard_shortcuts.SelectAll.toLocaleLowerCase(),
            (e) => {
                e.preventDefault();
                select_all();
            }
        );

        // DEL DELETE KEY
        Mousetrap.bind(
            settings.keyboard_shortcuts.Delete.toLocaleLowerCase(),
            (e, res) => {
                delete_files();
            }
        );

        // CTRL-L - LOCATION
        Mousetrap.bind("ctrl+l", (e, res) => {
            let breadcrumb = document.getElementById("breadcrumbs");

            breadcrumb.focus();
            breadcrumb.select();
        });

        // CTRL V - PASTE
        Mousetrap.bind(
            settings.keyboard_shortcuts.Paste.toLocaleLowerCase(),
            () => {
                // PAST FILES
                paste();
            }
        );

        // NEW WINDOW
        Mousetrap.bind("ctrl+n", () => {
            ipcRenderer.send("new_window");
        });

        // NEW FOLDER
        Mousetrap.bind(
            settings.keyboard_shortcuts.NewFolder.toLocaleLowerCase(),
            () => {
                create_folder(breadcrumbs.value + "/Untitled Folder");
            }
        );

        // RENAME
        Mousetrap.bind(
            settings.keyboard_shortcuts.Rename.toLocaleLowerCase(),
            () => {
                let cards = document.querySelectorAll(
                    ".highlight, .highlight_select, .ds-selected"
                );
                if (cards.length > 0) {
                    cards.forEach((card) => {
                        if (card) {
                            let header = card.querySelector("a");
                            header.classList.add("hidden");

                            let input = card.querySelector("input");
                            input.spellcheck = false;
                            input.classList.remove("hidden");
                            input.setSelectionRange(
                                0,
                                input.value.length -
                                    path.extname(header.href).length
                            );
                            input.focus();
                        }
                    });
                }
            }
        );

        // RELOAD
        Mousetrap.bind("f5", () => {
            get_view(breadcrumbs.value);
            localStorage.setItem("folder", breadcrumbs.value);
        });

        // FIND
        Mousetrap.bind(
            settings.keyboard_shortcuts.Find.toLocaleLowerCase(),
            () => {
                localStorage.setItem("sidebar", 1);
                show_sidebar();

                // find();
                find_files((res) => {
                    let find = document.getElementById("find");
                    find.focus();
                    find.select();
                });
            }
        );

        // CTRL C COPY
        Mousetrap.bind(
            settings.keyboard_shortcuts.Copy.toLocaleLowerCase(),
            (e) => {
                copy();
            }
        );

        // CTRL+X CUT
        Mousetrap.bind(
            settings.keyboard_shortcuts.Cut.toLocaleLowerCase(),
            (e) => {
                cut();
            }
        );

        // ESC KEY
        Mousetrap.bind("esc", () => {
            notification("");
            clear_copy_arr();
            clear_items();
        });

        // Backspace
        Mousetrap.bind(
            settings.keyboard_shortcuts.Backspace.toLocaleLowerCase(),
            () => {
                navigate("left");
            }
        );

        // Add worksoace
        Mousetrap.bind(
            settings.keyboard_shortcuts.AddWorkspace.toLocaleLowerCase(),
            () => {
                add_workspace();
            }
        );

        // Show settings
        Mousetrap.bind(
            settings.keyboard_shortcuts.ShowSettings.toLocaleLowerCase(),
            () => {
                get_settings_view();
            }
        );
    });

    pagesize = 100;
    page = 1;

    get_view(localStorage.getItem("folder"));

    // Toggle sidebar
    try {
        show_sidebar();
    } catch (err) {}

    let main_view = document.getElementById("main_view");
    main_view.draggable = false;

    main_view.onmouseover = (e) => {
        e.preventDefault();
        e.stopPropagation();
        main_view.tabIndex = 1;
    };

    // ON DRAG ENTER
    main_view.ondragenter = (e) => {
        destination = breadcrumbs.value;
        target = e.target;

        ipcRenderer.send("is_main_view", 1);
        ipcRenderer.send("active_folder", breadcrumbs.value, 1);
    };

    // DRAG OVER
    main_view.ondragover = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.ctrlKey == true) {
            e.dataTransfer.dropEffect = "copy";
        } else {
            e.dataTransfer.dropEffect = "move";
        }
    };

    main_view.ondragleave = (e) => {
        e.preventDefault();
        ipcRenderer.send("is_main_view", 0);
        return false;
    };

    let state = 0;
    main_view.ondrop = function (e) {
        e.preventDefault();
        e.stopPropagation();

        for (const f of e.dataTransfer.files) {
        }

        const file_data = e.dataTransfer.files;

        // GETTING FILE DROPED FROM EXTERNAL SOURCE
        if (file_data.length > 0) {
            // todo: revisit this. needs to have add copy file
            for (let i = 0; i < file_data.length; i++) {
                add_copy_file(file_data[i].path, "card_" + i);
            }
            copy_files(destination, state);
        } else {
            // COPY FILES
            if (e.ctrlKey == true) {
                if (breadcrumbs.value == destination) {
                    ipcRenderer.send("is_main_view", 1);
                    state = 2;
                } else {
                    ipcRenderer.send("is_main_view", 0);
                    state = 0;
                }

                // THIS IS RUNNING COPY FOLDERS TOO
                copy_files(destination, state);
                clear_items();

                // MOVE FILE
            } else {
                if (breadcrumbs.value == destination) {
                    ipcRenderer.send("is_main_view", 1);
                    state = 2;
                } else {
                    ipcRenderer.send("is_main_view", 0);
                    state = 0;
                }
                move_to_folder(destination, state);
            }
        }

        clear_items();
        return false;
    };
    // Handle Quick Search
    main_view.onkeydown = (e) => {
        let regex = /^[A-Za-z0-9]*/;

        // TEST FOR LETTERS AND NUMBERS
        if (
            regex.test(e.key) &&
            e.key != "PageDown" &&
            e.key != "PageUp" &&
            e.key != "ArrowUp" &&
            e.key != "ArrowDown" &&
            e.key != "ArrowLeft" &&
            e.key != "ArrowRight" &&
            e.key != "Delete" &&
            e.key != "Del" &&
            !e.ctrlKey &&
            !e.shiftKey &&
            !e.altKey &&
            e.key != "F2" &&
            e.key != "F5"
        ) {
            // KEEP THIS. THE QUICK SEARCH WILL GRAB FOCUS ON FILE RENAMES. THIS PREVENTS THAT
            if (
                e.target === e.currentTarget ||
                e.target === txt_search ||
                e.target.classList.contains("header_link")
            ) {
                txt_search.classList.remove("hidden");
                txt_search.preventDefault = true;
                txt_search.focus();

                if (e.key === "Enter" && txt_search.value != "") {
                    cards = main_view.querySelectorAll(".nav_item");
                    cards.forEach((card) => {
                        let href = card
                            .querySelector(".header_link")
                            .innerText.toLowerCase();

                        if (
                            href.indexOf(
                                txt_search.value.toLocaleLowerCase()
                            ) != -1
                        ) {
                            card.classList.add("highlight_select");
                        }
                    });
                    txt_search.classList.add("hidden");
                }
            }
        }

        if (e.key == "Escape") {
            clear_items();
        }
    };

    main_view.oncontextmenu = (e) => {
        ipcRenderer.send("show-context-menu");
    };

    let btnInit = document.getElementById("git_init");
    btnInit.addEventListener("click", (e) => {
        ipcRenderer.send("git_init");
    });

    let btnClone = document.getElementById("git_clone");
    btnClone.addEventListener("click", (e) => {
        ipcRenderer.send("git_clone");
    });

    let btnCommit = document.getElementById("git_commit");
    btnCommit.addEventListener("click", (e) => {
        ipcRenderer.send("git_commit");
    });

    let btnMerge = document.getElementById("git_merge");
    btnMerge.addEventListener("click", (e) => {
        ipcRenderer.send("git_merge");
    });

    let btnHistory = document.getElementById("git_history");
    btnHistory.addEventListener("click", (e) => {
        ipcRenderer.send("git_history");
    });

});

ipcRenderer.on("select_repo_visibility", (e, filePath) => {
    let btn_select = document.getElementById(
        "btn_select"
    );
    let repo_visibility;

    btn_select.onclick = (e) => {
        const visibilityList = document.getElementsByName("visibility");
        visibilityList.forEach((node) => {
            if(node.checked) {
                repo_visibility = node.value;
            }
        })
        if (repo_visibility) {
            ipcRenderer.send("repo_visibility_selected", filePath, repo_visibility);
        }
    };
});

ipcRenderer.on("confirm_git_clone", (e, filePath, repo_visibility) => {
    let btn_git_clone_confirm = document.getElementById(
        "btn_git_clone_confirm"
    );
    let btn_git_clone_cancel = document.getElementById(
        "btn_git_clone_cancel"
    );
    let github_repo_address = document.getElementById(
        "github_repo_address"
    );
    let github_id = document.getElementById(
        "github_id"
    );
    let github_access_token = document.getElementById(
        "github_access_token"
    );

    if (repo_visibility === "public_repository") {
        document.getElementById("github_information").style.display = "none";
    }

    btn_git_clone_confirm.onclick = (e) => {
        ipcRenderer.send("git_clone_confirmed", filePath, github_repo_address.value,
            repo_visibility, github_id.value, github_access_token.value);
    };
    btn_git_clone_cancel.onclick = (e) => {
        ipcRenderer.send("git_clone_canceled");
    };
});

ipcRenderer.on("confirm_git_rename", (e, filePath) => {
    let btn_git_rename_confirm = document.getElementById(
        "btn_git_rename_confirm"
    );
    let btn_git_rename_cancel = document.getElementById(
        "btn_git_rename_cancel"
    );
    let git_rename_input = document.getElementById("git_rename_input");

    btn_git_rename_confirm.onclick = (e) => {
        let rename_input_str = git_rename_input.value;
        ipcRenderer.send("git_rename_confirmed", filePath, rename_input_str);
    };

    btn_git_rename_cancel.onclick = (e) => {
        ipcRenderer.send("git_rename_canceled");
    };
});

ipcRenderer.on("confirm_git_commit", (e, filePath) => {
    let btn_git_commit_confirm = document.getElementById(
        "btn_git_commit_confirm"
    );
    let btn_git_commit_cancel = document.getElementById(
        "btn_git_commit_cancel"
    );
    let git_commit_input = document.getElementById("git_commit_message_input");

    btn_git_commit_confirm.onclick = (e) => {
        let commit_input_str = git_commit_input.value;
        ipcRenderer.send("git_commit_confirmed", filePath, commit_input_str);
    };

    btn_git_commit_cancel.onclick = (e) => {
        ipcRenderer.send("git_commit_canceled");
    };
});

ipcRenderer.on("show_git_commit_history",(e,str)=>{
    let tagArea = document.getElementById('show_git_commit');
    let arr = str.split("\n");
    for(let i in arr){
        let new_pTag = document.createElement('p');
        new_pTag.innerHTML = arr[i];
        tagArea.appendChild(new_pTag);
    }
    let btn_git_history_close = document.getElementById(
        "btn_git_history_close"
    );
    btn_git_history_close.onclick = (e) => {
        ipcRenderer.send("git_history_close");
    };
});

ipcRenderer.on("draw_git_history", (e, filePath, list) => {
    let tagArea = document.getElementById('git_history_storage');
    const id_arr = [];
    const hash = [];
    for(let i = 0; i < list.length; i++){
        let new_pTag = document.createElement('p');
        let str = "";
        let flag = false;
        let j = 0;
        for(j = 0; j < list[i].length; j++){
            if(j + 1 < list[i].length && list[i].substring(j, j + 2) === "??"){
                flag = true;
                break;
            }

            switch(list[i][j]){
                case '*':
                    str+=`<span>*</span>`;
                    id_arr.push(i);
                    break;
                case '_':
                    str+='-';
                    break;
                case '|':
                case '/':
                case '\\':
                case ' ':
                    str += list[i][j];
                    break;
            }        
        }
        for(j += 2; flag === true && j < list[i].length && j < 100; j++){
            str += list[i][j];
        }

        if(flag === true && j < list[i].length){
            str += "...";
        }

        if(flag === true){
            let splitIdx = list[i].indexOf("??");
            let tmp = list[i].substring(splitIdx + 2, splitIdx + 9);
            if(tmp !== undefined) {
                hash.push(tmp);
            }
        }

        new_pTag.innerHTML = str;
        new_pTag.id = `graph"${i}`;
        tagArea.appendChild(new_pTag);
    }  
    const doc_id = [];
    for(let i = 0; i < id_arr.length; i++){
        doc_id[i]=document.getElementById(`graph"${id_arr[i]}`);

        doc_id[i].onclick = () =>{
            ipcRenderer.send("show_git_history_status",i,id_arr.length,"", filePath, hash[i]);
        }
    }
    let btn_git_history_close = document.getElementById(
        "btn_git_history_close"
    );
    btn_git_history_close.onclick = (e) => {
        ipcRenderer.send("git_history_close");
    };
});

ipcRenderer.on("",(e,id)=>{
    const text = document.getElementById("git_history_status");
    let checkGitRepo = "git log";
    exec(checkGitRepo,(err, stdout, stderr) => {
        if (error) {
            console.error(`${error}`);
            BrowserWindow.getFocusedWindow().send("notification", error.message);
            BrowserWindow.getFocusedWindow().send("refresh");
            resolve(-1);
            return;
        }
        if (stderr) {
            console.error(`${stderr}`);
            BrowserWindow.getFocusedWindow().send("notification", stderr);
            BrowserWindow.getFocusedWindow().send("refresh");
            resolve(-1);
            return;
        }
        let list = stdout.split("commit");
        }
    );
});

ipcRenderer.on("confirm_git_merge", (e, filePath, branches) => {
    const btn_git_merge_confirm = document.getElementById(
        "btn_git_merge_confirm"
    );
    const btn_git_merge_cancel = document.getElementById(
        "btn_git_merge_cancel"
    );

    const selectBox = document.getElementById("branch");
    branches.forEach((branch) => {
        const option = document.createElement("option");
        option.text = branch;
        selectBox.add(option);
    });

    btn_git_merge_confirm.onclick = (e) => {
        const selectedIndex = selectBox.selectedIndex;
        if (selectedIndex === -1) ipcRenderer.send("git_rename_canceled");
        const targetBranch = selectBox.options[selectedIndex].text;
        ipcRenderer.send("git_merge_confirmed", filePath, targetBranch);
    };

    btn_git_merge_cancel.onclick = (e) => {
        ipcRenderer.send("git_rename_canceled");
    };
});

ipcRenderer.on("confirm_git_branch_create", (e, filePath) => {
    let btn_git_branch_create_confirm = document.getElementById(
        "btn_git_branch_create_confirm"
    );
    let btn_git_branch_create_cancel = document.getElementById(
        "btn_git_branch_create_cancel"
    );
    let git_branch_name_input = document.getElementById(
        "git_branch_name_input"
    );

    btn_git_branch_create_confirm.onclick = (e) => {
        let name_input_str = git_branch_name_input.value;
        ipcRenderer.send(
            "git_branch_create_confirmed",
            filePath,
            name_input_str
        );
    };

    btn_git_branch_create_cancel.onclick = (e) => {
        ipcRenderer.send("git_branch_create_canceled");
    };
});

ipcRenderer.on("confirm_git_branch_delete", (e, filePath, branchList) => {
    const btn_git_branch_delete_confirm = document.getElementById(
        "btn_git_branch_delete_confirm"
    );
    const btn_git_branch_delete_cancel = document.getElementById(
        "btn_git_branch_delete_cancel"
    );

    const selectBox = document.getElementById("branch");
    branchList.forEach((branch) => {
        const option = document.createElement("option");
        option.text = branch;
        selectBox.add(option);
    });

    btn_git_branch_delete_confirm.onclick = (e) => {
        const selectedIndex = selectBox.selectedIndex;
        if (selectedIndex === -1)
            ipcRenderer.send("git_branch_delete_canceled");
        const targetBranch = selectBox.options[selectedIndex].text;
        ipcRenderer.send("git_branch_delete_confirmed", filePath, targetBranch);
    };

    btn_git_branch_delete_cancel.onclick = (e) => {
        ipcRenderer.send("git_branch_delete_canceled");
    };
});

ipcRenderer.on("confirm_git_branch_rename", (e, filePath, branchList) => {
    const btn_git_branch_rename_confirm = document.getElementById(
        "btn_git_branch_rename_confirm"
    );
    const btn_git_branch_rename_cancel = document.getElementById(
        "btn_git_branch_rename_cancel"
    );

    const selectBox = document.getElementById("branch");
    branchList.forEach((branch) => {
        const option = document.createElement("option");
        option.text = branch;
        selectBox.add(option);
    });

    let git_branch_name_input = document.getElementById(
        "git_branch_name_input"
    );

    btn_git_branch_rename_confirm.onclick = (e) => {
        let name_input_str = git_branch_name_input.value;
        if (name_input_str === "") return;

        const selectedIndex = selectBox.selectedIndex;
        if (selectedIndex === -1)
            ipcRenderer.send("git_branch_rename_canceled");
        const targetBranch = selectBox.options[selectedIndex].text;
        ipcRenderer.send(
            "git_branch_rename_confirmed",
            filePath,
            targetBranch,
            name_input_str
        );
    };

    btn_git_branch_rename_cancel.onclick = (e) => {
        ipcRenderer.send("git_branch_rename_canceled");
    };
});

ipcRenderer.on("confirm_git_branch_checkout", (e, filePath, branchList) => {
    const btn_git_branch_checkout_confirm = document.getElementById(
        "btn_git_branch_checkout_confirm"
    );
    const btn_git_branch_checkout_cancel = document.getElementById(
        "btn_git_branch_checkout_cancel"
    );

    const selectBox = document.getElementById("branch");
    branchList.forEach((branch) => {
        const option = document.createElement("option");
        option.text = branch;
        selectBox.add(option);
    });

    btn_git_branch_checkout_confirm.onclick = (e) => {
        const selectedIndex = selectBox.selectedIndex;
        if (selectedIndex === -1)
            ipcRenderer.send("git_branch_checkout_canceled");
        const targetBranch = selectBox.options[selectedIndex].text;
        ipcRenderer.send(
            "git_branch_checkout_confirmed",
            filePath,
            targetBranch
        );
    };

    btn_git_branch_checkout_cancel.onclick = (e) => {
        ipcRenderer.send("git_branch_checkout_canceled");
    };
});
