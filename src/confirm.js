// const { getCurrentWindow, globalShortcut, ipcRenderer, contextBridge, Menu, shell, ipcMain, app, MenuItem, menu, BrowserWindow, TouchBarSegmentedControl, desktopCapturer, clipboard, nativeImage } = require('electron')
// const fs = require('fs');
// const stat = require('fs')
// const watch = require('fs')
// const url = require('url')
// const path = require('path')
// const { exec, execSync, spawn, execFileSync } = require("child_process");
// const Mousetrap = require('mousetrap');
// const os = require('os');
// const { dirname, basename, normalize } = require('path');


// ipcRenderer.on('confirming_overwrite', (e, data) => {

//     let confirm_dialog = document.getElementById('confirm')

//     let source_stats = fs.statSync(data.source)
//     let destination_stats = fs.statSync(data.destination)

//     let btn_cancel = add_button('btn_cancel', 'Cancel')
//     let btn_replace = add_button('btn_replace', 'Replace')
//     let btn_skip = add_button('btn_skip', 'Skip')
//     let icon = add_icon('info-circle')
//     let header = add_header('<br />Replace file:  ' + path.basename(data.source) + '<br /><br />')

//     let confirm_msg = add_div()

//     btn_replace.classList.add('primary')

//     let destination_data = add_p(
//         add_header('Original with').outerHTML +
//         add_img(get_icon_path(data.source)).outerHTML +
//         'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified:' + destination_stats.mtime +
//         '<br />' +
//         '<br />'
//     )
//     let source_data = add_p(
//         add_header('Replace file').outerHTML +
//         add_img(get_icon_path(data.source)).outerHTML +
//         'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified:' + source_stats.mtime +
//         '<br />' +
//         '<br />'
//     )


//     confirm_dialog.append(header,destination_data,source_data,btn_cancel,btn_replace,btn_skip)


//     btn_replace.addEventListener('click', (e) => {

//         // ovevrwrite_confirmed(data)
//         ipcRenderer.send('overwrite_confirmed', data)

//     })


// })