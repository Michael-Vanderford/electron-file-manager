// const { ipcRenderer, shell, clipboard } = require('electron');
// const path       = require('path');
// const fs         = require('fs');
// const gio_utils  = require('../utils/gio.js');

// // Globak Vars
// let is_checked = 0;

// // Functions ////////////////////////////////////////////////////////////////////

// // Get File Size
// function getFileSize(fileSizeInBytes) {
//     var i = -1;
//     var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
//     do {
//         fileSizeInBytes = fileSizeInBytes / 1024;
//         i++;
//     } while (fileSizeInBytes > 1024);
//     return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
// };

// function add_p(text) {
//     let p = document.createElement('p');
//     p.innerHTML = text;
//     return p;
// }

// function add_header(text) {
//     let header = add_div();
//     header.classList.add('header');
//     header.title = text;
//     header.innerHTML = text;
//     return header;
// }

// // Add Div
// function add_div() {
//     let div = document.createElement('div');
//     return div;
// }

// // Add input
// function add_input(type, id) {
//     let input = document.createElement('input');
//     input.id = id;
//     input.type = type;
//     input.style = 'height: 20px; border: none; margin-top: 10px; margin-bottom: 10px';
//     return input;
// }

// // Add buttom
// function add_button(id, text) {
//     let button = document.createElement('input');
//     button.type = 'button';
//     button.classList.add('ui', 'button');
//     button.value = text;
//     return button;
// }

// // Add Label
// function add_label(text, label_for = '') {
//     let label = document.createElement('label');
//     label.classList.add('label');
//     label.htmlFor = label_for;
//     label.style = 'padding-bottom: 5px;';
//     label.append(text);
//     return label;
// }

// // Add checkbox
// function add_checkbox(id, label) {

//     let checkbox = add_div()
//     let chk_label = add_label(label)
//     chk_label.htmlFor = id

//     let chk = document.createElement('input')
//     chk.type = "checkbox"
//     chk.id = id
//     chk.classList.add('checkbox')

//     checkbox.append(chk)
//     checkbox.append(chk_label)

//     return checkbox

// }

// // Add Image
// function add_img(src) {
//     let img = document.createElement('img')
//     img.style = 'float:left; padding-right: 5px; vertical-align: middle !important'
//     img.width = 32
//     // img.height = 32
//     img.classList.add('lazy')
//     img.dataset.src = src
//     img.src = src; //path.join(__dirname, 'assets/icons/kora/actions/scalable/viewimage.svg')
//     return img
// }

// function get_icon_path(file) {
//     // try {
//     //     let stats = fs.statSync(file)
//     //     let file_ext = path.extname(file)
//     //     if (stats.isDirectory()) {
//     //         // todo: this needs to be reworked to get theme folder icon
//     //         // icon = path.join(__dirname, '/assets/icons/folder.png');
//     //         icon_dir = path.join(__dirname, '/assets/icons/kora')
//     //         icon = path.join(icon_dir, '/mimetypes/scalable/application-document.svg')
//     //         // alert(icon)
//     //     } else {
//     //         icon_dir = path.join(__dirname, '/assets/icons/kora')
//     //         if (file_ext.toLocaleLowerCase() == '.jpg' || file_ext.toLocaleLowerCase() == '.png' || file_ext.toLocaleLowerCase() == '.jpeg' || file_ext.toLocaleLowerCase() == '.gif' || file_ext.toLocaleLowerCase() == '.svg' || file_ext.toLocaleLowerCase() == '.ico' || file_ext.toLocaleLowerCase() == '.webp') {
//     //             icon = file
//     //             let img_data = get_img_data(file);
//     //             // console.log(img_data)
//     //         } else if (file_ext == '.xls' || file_ext == '.xlsx' || file_ext == '.xltx' || file_ext == '.csv') {
//     //             icon = path.join(icon_dir, '/apps/scalable/ms-excel.svg')
//     //         } else if (file_ext == '.docx' || file_ext == '.ott' || file_ext == '.odt') {
//     //             icon = path.join(icon_dir, '/apps/scalable/libreoffice-writer.svg')
//     //         } else if (file_ext == '.wav' || file_ext == '.mp3' || file_ext == '.mp4' || file_ext == '.ogg') {
//     //             icon = path.join(icon_dir, '/mimetypes/scalable/audio-wav.svg')
//     //         } else if (file_ext == '.iso') {
//     //             icon = path.join(icon_dir, '/apps/scalable/isomaster.svg')
//     //         } else if (file_ext == '.pdf') {
//     //             icon = path.join(icon_dir, '/apps/scalable/gnome-pdf.svg')
//     //         } else if (file_ext == '.zip' || file_ext == '.xz' || file_ext == '.tar' || file_ext == '.gz' || file_ext == '.bz2') {
//     //             icon = path.join(icon_dir, '/apps/scalable/7zip.svg')
//     //         } else if (file_ext == '.deb') {
//     //             icon = path.join(icon_dir, '/apps/scalable/gkdebconf.svg')
//     //         } else if (file_ext == '.txt') {
//     //             icon = path.join(icon_dir, '/apps/scalable/text.svg')
//     //         } else if (file_ext == '.sh') {
//     //             icon = path.join(icon_dir, '/apps/scalable/terminal.svg')
//     //         } else if (file_ext == '.js') {
//     //             icon = path.join(icon_dir, '/apps/scalable/applications-java.svg')
//     //         } else if (file_ext == '.sql') {
//     //             icon = path.join(icon_dir, '/mimetypes/scalable/application-x-sqlite.svg')
//     //         } else {
//     //             icon = path.join(icon_dir, '/mimetypes/scalable/application-document.svg')
//     //         }
//     //     }
//     // } catch (err) {
//     // }
//     // return icon
// }

// // IPC /////////////////////////////////////////////////////////////////////////////

// // Confirming Overwrite
// ipcRenderer.on('confirming_overwrite', (e, source_file, destination_file, copy_overwrite_arr) => {

//     let confirm_dialog = document.getElementById('confirm')
//     // console.log(source_file, destination_file)

//     let source = source_file.href;
//     let destination = destination_file.href;

//     // let source_stats = gio_utils.getFileSync(source);  //fs.statSync(source)
//     // let destination_stats = gio_utils.getFileSync(destination);  //fs.statSync(destination)

//     // Chechbox Replace
//     let chk_replace_div = add_checkbox('chk_replace', 'Apply this action to all files and folders');

//     // Cancel Button
//     let btn_cancel = add_button('btn_cancel', 'Cancel');
//     btn_cancel.addEventListener('click', (e) => {
//         if (is_checked) {
//             // ipcRenderer.send('overwrite_canceled_all', copy_files_arr);
//         } else {
//             // ipcRenderer.send('overwrite_canceled', copy_files_arr);
//             ipcRenderer.send('overwrite_canceled');
//         }

//     })

//     // Confirm Button
//     let btn_replace = add_button('btn_replace', 'Merge');
//     btn_replace.classList.add('primary');
//     btn_replace.addEventListener('click', (e) => {
//         if (is_checked) {
//             // ipcRenderer.send('overwrite_confirmed_all', copy_files_arr);
//         } else {
//             ipcRenderer.send('overwrite_confirmed', source, destination, copy_overwrite_arr);
//         }
//     })

//     // Skip Button
//     let btn_skip = add_button('btn_skip', 'Skip')
//     btn_skip.addEventListener('click', (e) => {
//         if (is_checked) {
//             ipcRenderer.send('overwrite_canceled_all');
//         } else {
//             // ipcRenderer.send('overwrite_skip', copy_files_arr);
//         }
//     })

//     // Footer
//     let footer = add_div()
//     footer.style = 'position:fixed; bottom:0; height: 40px; margin-bottom: 25px;';
//     footer.append(btn_cancel, btn_replace, btn_skip)

//     let source_data = ''
//     let destination_data = ''
//     let header = ''

//     // Directory
//     if (destination_file.type === 'directory') {

//         btn_replace = add_button('btn_replace', 'Merge')
//         btn_replace.classList.add('primary')

//         let description = ''
//         if (gio_utils.getDateTime(destination_file["time::modified"]) > gio_utils.getDateTime(source_file["time::modified"])) {
//             description = '<p class="error">A newer folder with the same name already exists</p>'
//                 'Replacing will overwrite all files</p>'
//             // 'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
//         } else {
//             description = '<p class="error">An older folder with the same name already exists<br /> ' +
//                 // 'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
//                 'Replacing will overwrite all files</p>'
//         }

//         header = add_header('<br />Copy Folder:  ' + path.basename(source_file.href) + '<br /><br />')

//         source_data = add_p(
//             description +
//             add_header('Current Folder').outerHTML +
//             add_img('../assets/icons/folder.png').outerHTML +
//             '<br />' + 'Last modified: ' + gio_utils.getDateTime(destination_file["time::modified"]) +
//             '<br />' +
//             '<br />'
//         )

//         destination_data = add_p(
//             add_header('Overwrite with').outerHTML +
//             add_img('../assets/icons/folder.png').outerHTML +
//             '<br />' + 'Last modified: ' + gio_utils.getDateTime(source_file["time::modified"]) +
//             '<br />' +
//             '<br />'
//         )

//     // File
//     } else {

//         // let description
//         if (destination_file["time::modified"] >= gio_utils.getDateTime(source_file["time::modified"])) {
//             description = '<p>A newer file with the same name already exists. ' +
//                 'Replacing will overwrite all files</p>'
//         } else {
//             description = '<br /><p>An older file with the same name already exists ' +
//                 'Replacing will overwrite all files</p>'
//         }

//         header = add_header('<br />Replace File: <span>' + path.basename(source) + '</span><br />')

//         // This is realy destination
//         source_data = add_p(
//             description +
//             add_header('Original File').outerHTML +
//             // add_img(get_icon_path(data.destination)).outerHTML +
//             '<br />' + 'Last modified:' + gio_utils.getDateTime(destination_file["time::modified"]) +
//             '<br />' +
//             '<br />'
//         )

//         // This is realy source
//         destination_data = add_p(

//             add_header('Replace With').outerHTML +
//             // add_img(get_icon_path(data.source)).outerHTML +
//             '<br />' + 'Last modified:' + gio_utils.getDateTime(source_file["time::modified"]) +
//             '<br />' +
//             '<br />'
//         )

//     }

//     // // Handle checkbox
//     let replace_all = add_div()
//     replace_all.append(chk_replace_div)

//     confirm_dialog.append(header, source_data, destination_data, replace_all, footer);

//     // let chk_replace = document.getElementById('chk_replace')
//     // let is_checked = 0
//     // chk_replace.addEventListener('change', (e) => {
//     //     if (chk_replace.checked) {
//     //         is_checked = 1
//     //     } else {
//     //         is_checked = 0
//     //     }
//     // })

// })

// // Overite copy files
// ipcRenderer.on('overwrite', (e, data) => {

//     let progress = document.getElementById('progress');

//     let destination = data.destination;
//     let source = data.source;

//     let destination_stats = fs.statSync(destination);
//     let source_stats = fs.statSync(source);

//     destination_size = destination_stats.size;
//     source_size = source_stats.size;

//     notification('overwriting file ' + destination);

//     if (destination_stats.isDirectory()) {
//         copyFolderRecursiveSync(source, destination)
//     } else {
//         // Copy file
//         fs.copyFile(source, destination, (err) => {
//             let file_grid = document.getElementById('file_grid');
//             if (err) {
//                 // console.log(err)
//             } else {

//                 // Remove previous card
//                 let previous_card = document.querySelector('[data-href="' + destination + '"]')
//                 let col = previous_card.closest('.column')
//                 col.remove()

//                 // Add card
//                 let options = {
//                     id: 'file_grid_' + idx,
//                     href: destination,
//                     linktext: path.basename(destination),
//                     grid: file_grid
//                 }

//                 try {

//                     add_card(options).then(col => {

//                         file_grid.insertBefore(col, file_grid.firstChild)

//                         // Count items in main view
//                         folder_count = get_folder_count()
//                         file_count = get_file_count()

//                         // RESET CARD INDE TO HANDLE LAZY LOADED IMAGES
//                         cardindex = 0

//                     })

//                 } catch (err) {
//                     notification(err)
//                 }

//             }
//             // Update cards
//             update_cards(file_grid);
//         })
//     }
// })

// // Overwrite copy all
// ipcRenderer.on('overwrite_all', (e, copy_files_arr) => {
//     copy_files_arr.forEach(item => {
//         let source_stats = fs.statSync(item.source)
//         // Directory
//         if (source_stats.isDirectory()) {
//             copyFolderRecursiveSync(item.destination)
//             // File
//         } else {
//             copyFileSync(item.source, item.destination)
//         }
//     })
//     clear_copy_arr()
// })