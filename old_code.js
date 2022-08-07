// CHECK IF GVFS
        // let is_gvfs = 0
        // let gvfs = href.indexOf('/gvfs') // -1 is false
        // if (gvfs > -1) {
        //     is_gvfs = 1
        // }


        // REMOVE COPY FILE
function remove_copy_file(href) {

    copy_files_arr.forEach((item, idx) => {

        if (item.source == href) {
            copy_files_arr.splice(idx)
        }

    });
}

// ADD TO SELECTED FILES ARRAY
function add_selected_file(source, card_id) {

    //

    if (source == '' || card_id == '') {
        console.log('error line #2955: empty source or card_id')
    } else {

        if (selected_files.length > 0) {

            if (selected_files.every(x => x.source != source)) {

                console.log('adding selected file ' + source)
                console.log('card id is ' + card_id)

                let file = {
                    card_id: card_id,
                    source: source
                }

                // selected_files.push(file)
                console.log('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')
                notification('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')

            }

        } else {

            let file = {
                card_id: card_id,
                source: source
            }

            selected_files.push(file)
            console.log('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')
            notification('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')

        }

    }

}

// REMOVE FILE FROM SELECTED FILES ARRAY
function remove_selected_file(source) {

    console.log('removing')

    // let card = document.getElementById(card_id)
    // card.classList.add('highlight_select')

    // let file_idx = selected_files.indexOf()
    // selected_files.splice(file_idx,1)


    //   let selected_files_list = document.getElementById('selected_files_list')
    //   selected_files_list.innerHTML = ''

    // LOOP OVER SELECTED FILES ARRAY
    // selected_files.forEach((file, idx) => {

    //     if (file.source == source) {
    //         console.log('removed selected file ' + source)
    //         notification('removed selected file ' + source)
    //         console.log('length ' + selected_files.length)

    //         // selected_files.pop()

    //         console.log('length ' + selected_files.length)

    //     }

    //     // console.log('running ' + idx)

    //     // // CREATE ITEM
    //     // let item = add_div()

    //     // // ADD NAME TO ITEM
    //     // item.innerText = file

    //     // // APPEND TO SELECTED FILES LIST
    //     // selected_files_list.appendChild(item)

    // })

}

// function clear_highlight() {

//     let cards = document.querySelectorAll('.card')
//     cards.forEach((card, idx) => {
//         if (card.classList.contains('highlight')) {
//             card.classList.remove('highlight')
//         }
//     })

// }

// function clear_highlight_select() {

//     let cards = document.querySelectorAll('.card')
//     cards.forEach((card, idx) => {
//         card.classList.remove('highlight_select')
//     })

// }

// SET FOLDER ICON
// if (grid.id == 'folder_grid') {

//     get_folder_icon(icon => {
//         img.src = icon
//     })

//     // SEARCH AND WORKSPACE ICONS
// } else if (grid.id == 'search_results' || grid.id == 'workspace_grid') {

//     card.style.marginLeft = '5px'
//     img.classList.add('workspace_icon')
//     ipcRenderer.send('get_icon_path', href)

// // FILE ICONS
// } else {

//     if (img.classList.contains('img')) {

//         img.src = path.join(icon_dir, '/actions/scalable/image-x-generic-symbolic.svg')
//         img.dataset.src = icon_path
//         img.classList.add('lazy')

//     } else {
//         ipcRenderer.send('get_icon_path', href)
//     }

// }