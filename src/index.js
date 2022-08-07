let options = {
    sort: 1,
    search: ''
}

let find = document.getElementById('find')
let breadcrumbs = document.getElementById('breadcrumbs')
let home = document.getElementById('home')
let documents = document.getElementById('documents')
let downloads = document.getElementById('downloads')
let pictures = document.getElementById('pictures')
let videos = document.getElementById('videos')
let music = document.getElementById('music')
let devices = document.getElementById('devices')
let network = document.getElementById('network')
let footer = document.getElementById('footer')
let btn_disk_usage = document.getElementById('btn_disk_usage')

// TOGGLE VIEWS
let btn_list_view = document.getElementById('btn_list_view')
let btn_grid_view = document.getElementById('btn_grid_view')

// VIEWS
let list_view = document.getElementById('list_view')
let grid_view = document.getElementById('grid_view')
let info_view = document.getElementById('info_view')

let home_folder = window.api.get_home()


// document.getElementById('toggle-dark-mode').addEventListener('click', async () => {
//     const isDarkMode = await window.api.toggle()
//     // document.getElementById('theme-source').innerHTML = isDarkMode ? 'Dark' : 'Light'
// })

// document.getElementById('reset-to-system').addEventListener('click', async () => {
//     await window.api.system()
//     document.getElementById('theme-source').innerHTML = 'System'
// })


if (localStorage.getItem('folder') == '') {
    localStorage.setItem('folder', home_folder)
}

// HANDLES HEADER MENU //////////////////////////////////////////
function clear_active() {

    let header_menu = $('#header_menu, .item')
    header_menu.removeClass('active')

    // home.classList.remove('active')
    // documents.classList.remove('active')
    // downloads.classList.remove('active')
    // pictures.classList.remove('active')
    // videos.classList.remove('active')
    // music.classList.remove('active')
    // devices.classList.remove('active')
    // network.classList.remove('active')

}

// LOAD FILES FROM PREELOAD.JS
function get_files(dir) {

    // GRID VIEW
    if (localStorage.getItem('view') == 'grid' || localStorage.getItem('view') == '') {
        window.api.get_files(dir, () => {})
        btn_grid_view.classList.add('active')

    // LIST VIEW
    } else {
        window.api.get_list_view(dir)
        btn_list_view.classList.add('active')
    }

}


// function get_data(dir) {

//     // todo: reminder this is intended for chart js
//     let breadcrumbs = $('#breadcrumbs')
//     breadcrumbs.val(dir)

//     setitem('folder', dir)


//     // GET FILES
//     let dirents = window.api.get_folders1(dir)

//     let folder_grid = $('#folder_grid')
//     let hidden_folder_grid = $('#hidden_folder_grid')
//     let file_grid = $('#file_grid')
//     let hidden_file_grid = document.getElementById('hidden_file_grid')

//     folder_grid.html('')
//     hidden_folder_grid.html('')
//     file_grid.html('')
//     hidden_file_grid.innerText = ''

//     dirents.forEach((file,idx) => {

//         filepath = file.path + '/' + file.name

//         let id
//         if(file.isfolder){
//             id = 'folder_card_' + idx
//         } else {
//             id = 'file_card_' + idx
//         }

//         let options = {
//             id:  id,
//             isfolder: file.isfolder,
//             linktext: file.name,
//             href: filepath,
//             imagepath: file.imagepath, //window.api.get_icon_path(file.path),
//             description: file.mdate,
//             size: file.size //get_file_size(size)  //get_file_size(size)
//         }



//         add_card(options)
//         // add_card(file)

//     })

// }

// ADD DIV
function add_div() {
    let div = document.createElement('div')
    return div
}


function add_progress(){
    let progress = document.createElement('progress')
    progress.value = 1
    progress.max = 100
    return progress
}


let element = document.getElementById('sidebar');
let main_view = document.getElementById('main_view');



let sidebar_width = '250'

if (localStorage.getItem('sidebar_width')) {
    sidebar_width = localStorage.getItem('sidebar_width')
    main_view.style = 'margin-left:' + sidebar_width
} else {
    element.width = sidebar_width
    main_view.style = 'margin-left:' + sidebar_width
}


// console.log('sidebar width ' + sidebar_width)

//
if (element) {

    // var resizer = document.createElement('div')
    // resizer.className = 'draghandle'

    let resizer = document.getElementById('draghandle')

    // resizer.style.width = '5px'
    resizer.style.height = ''
    element.appendChild(resizer)
    resizer.addEventListener('mousedown', initResize, false)

}



// INIT RESIZE
function initResize(e) {

    window.addEventListener('mousemove', Resize, false);
    window.addEventListener('mouseup', stopResize, false);
    $('#main_view, #sidebar iframe').addClass('marginLeft');

    $('#main_view, #sidebar').addClass('margin-left');

}

// RESIZE
function Resize(e) {
    element.style.width = (e.clientX - element.offsetLeft) + 'px';
    $('#main_view').css('margin-left', (e.clientX - element.offsetLeft) + 'px');
    // $('#sidebar').css('margin-left', (element.offsetLeft) + 'px');

}

// STOP RESIZE
function stopResize(e) {

    console.log('running')

    window.removeEventListener('mousemove', Resize, false);
    window.removeEventListener('mouseup', stopResize, false);
    // $('#sidebar').css('margin-left', element.offsetLeft + 'px');

    // console.log('setting width ' + element.clientWidth)
    localStorage.setItem('sidebar_width', element.clientWidth)
}


// LIST VIEW
btn_list_view.addEventListener('click', (e) => {

    e.preventDefault()

    localStorage.setItem('view', 'list');
    window.api.get_view(localStorage.getItem('folder'));

    // list_view.classList.remove('hidden')
    // grid_view.classList.add('hidden')

    // get_files(localStorage.getItem('folder'))

    btn_list_view.classList.add('active')
    btn_grid_view.classList.remove('active')

})

// ICON VIEW
btn_grid_view.addEventListener('click', (e) => {

    e.preventDefault();

    localStorage.setItem('view', 'grid');
    window.api.get_view(localStorage.getItem('folder'));

    // grid_view.classList.remove('hidden')
    // list_view.classList.add('hidden')

    // get_files(localStorage.getItem('folder'))

    // window.api.get_files(breadcrumbs.value)
    btn_list_view.classList.remove('active')
    btn_grid_view.classList.add('active')



})

// DISK SUMMARY VIEW
btn_disk_usage.addEventListener('click', (e) => {

    localStorage.setItem('view', 'disk_summary')
    window.api.get_view('/')

})


$(function() {

    $('.ui.dropdown')
    .dropdown({
        on:'hover'
    })

    // $('.ui.dropdown')
    // .dropdown({
    //     // clearable: true
    // })

    // $('.ui.dropdown')
    // .dropdown({
    //     clearable: true,
    //     placeholder: 'any'
    // })


    // START OF GET DEVICE LIST DOESNT WORK
    // async function testIt() {

    //     const filters = [
    //         {vendorId: '1235:8211', productId: 004}
    //     ];
    //     const device = await navigator.usb.requestDevice({
    //         filters: filters

    //     })
    //     document.getElementById('device-name').innerHTML = device.name || `ID: ${device.id}`
    //   }

    //   document.getElementById('clickme').addEventListener('click',testIt)


    $('.ui.accordion').on({
        exclusive:false
    })


    //////////////////////////////////////////////////
    // FIND

    // let find = $('#find')
    // let find_options = $('#find_options')
    // $(document).on('click', '#find', function(e) {
    //     find_options.removeClass('hidden')
    // })

    // find.on('keyup', function(e) {

        // console.log(e.key)

        // if (e.key == 'Enter') {
        //     find_options.addClass('hidden')

        // }

    // })


    // FIND FOLDERS
    let find_folders = document.getElementById('find_folders')
    let find_folders_option = localStorage.getItem('find_folders')
    if (find_folders_option == 1) {
        find_folders.checked = true
    }
    find_folders.addEventListener('change', (e) => {
        if (find_folders.checked) {
            localStorage.setItem('find_folders', 1)
            console.log('setting find to 1')
        } else {
            localStorage.setItem('find_folders', 0)
            console.log('setting find to 0')
        }

    })

    // FIND FILES
    let find_files = document.getElementById('find_files')
    let find_files_options = localStorage.getItem('find_files')
    if (find_files_options == 1) {
        find_files.checked = true
    }
    find_files.addEventListener('change', (e) => {
        if (find_files.checked) {

            localStorage.setItem('find_files', 1)
            console.log('setting find to 1')

        } else {

            localStorage.setItem('find_files', 0)
            console.log('setting find to 0')

        }
    })



    // $(document).on('click','#find_files',function(e) {
    //     if (localStorage.getItem('find_files') == '') {
    //         localStorage.setItem('find_files', 1)
    //     } else {
    //         localStorage.setItem('find_files', '')
    //     }
    // })


    // FIND BY SIZE
    let find_by_size = $('#find_by_size')
    let find_by_size_options = localStorage.getItem('find_by_size')
    if (find_by_size_options == 1) {
        find_by_size.attr('checked','checked')
    }

    $(document).on('click','#find_by_size',function(e) {

        if (localStorage.getItem('find_by_size') == '') {
            localStorage.setItem('find_by_size', 1)
        } else {
            localStorage.setItem('find_by_size', '')
        }
    })


    // FIND BY DATE
    // let start_date = document.getElementById('start_date')
    // let end_date = document.getElementById('end_date')
    // start_date.addEventListener('change', (e) => {

    // })
    // end_date.addEventListener('change', (e) => {

    // })


        // find_files()

        // if (localStorage.getItem('find_by_size') == '') {
        //     localStorage.setItem('find_by_size', 1)
        // } else {
        //     localStorage.setItem('find_by_size', '')
        // }
    // })




    ////////////////////////////////////////////////////


    // let find = document.getElementById('find')
    // let find_options = document.getElementById('find_options')
    // let find_directory = document.getElementById('find_directory')

    // find_directory.setAttribute('checked', localStorage.getItem('find_directory'))
    // find_directory.addEventListener('click', function(e) {
    //     if (localStorage.getItem('find_directory') == '') {
    //         localStorage.setItem('find_directory','1')
    //     } else {
    //         localStorage.setItem('find_directory','')
    //     }
    // })

    // find.addEventListener('click', function(e) {

    //     find_options.classList.remove('hidden')

    // })

    // find.addEventListener('change',function (e) {

    //     find_options.classList.add('hidden')

    // })


    // var element = document.getElementById('sidebar');
    // let sidebar_width = localStorage.getItem('sidebar_width')
    // console.log('sidebar width ' + sidebar_width)

    // if (element) {

    //     var resizer = document.createElement('div')
    //     resizer.className = 'draghandle'

    //     resizer.style.color = 'red !important'
    //     resizer.style.width = '5px'
    //     resizer.style.height = '100vh'
    //     element.appendChild(resizer)
    //     resizer.addEventListener('mousedown', initResize, false)

    // }

    // function initResize(e) {

    //     console.log('running')

    //     window.addEventListener('mousemove', Resize, false);
    //     window.addEventListener('mouseup', stopResize, false);
    //     // $('#main_view, #sidebar iframe').addClass('marginLeft');

    //     $('#main, #sidebar').addClass('margin-left');

    // }

    // function Resize(e) {
    //     element.style.width = (e.clientX - element.offsetLeft) + 'px';
    //     $('#main').css('margin-left', (e.clientX - element.offsetLeft) + 'px');
    //     $('#sidebar').css('margin-left', (element.offsetLeft) + 'px');

    //     console.log('setting width')
    //     localStorage.setItem('sidebar_width', element.offsetLeft + 'px')

    // }

    // function stopResize(e) {
    //     window.removeEventListener('mousemove', Resize, false);
    //     window.removeEventListener('mouseup', stopResize, false);
    //     $('#sidebar').css('margin-left', element.offsetLeft + 'px');

    // }






    // SCROLL WHILE DRAGGING OVER
    $("#navigation_menu").bind("dragover", function(e){
        $(window).scrollTop($(window).scrollTop()-20);
    });


    let accordion = $('.ui.accordion')
    accordion.accordion({
        exclusive:false
    })


    accordion.on('mouseover', function (e) {
        // alert($(this).height())
    })

    // LOAD INITIAL TREE VIEW
    // window.api.get_tree(home_folder)

    // LOAD INITIAL TREE VIEW
    window.api.get_tree(home_folder)

    // LOAD INITIAL FILES / FOLDER VIEW
    // let st = Date.now()

    // console.log('running too many times here')

    if (!localStorage.getItem('folder')) {
        localStorage.setItem('folder', home_folder)
    }

    // LOAD FILES
    // get_files(localStorage.getItem('folder'))
    // localStorage.setItem('view', 'disk_summary')
    window.api.get_view(localStorage.getItem('folder'))

    // window.api.get_files(localStorage.getItem('folder'), () => {
    // })

    // window.api.get_files_list(localStorage.getItem('folder'))
    // console.log(Date.now() - st)

    // SHOW MODAL DIALOG
    // $('.ui.modal').modal({
    //     centered: true
    // })
    // .modal('show')
    // console.log('show modal')


    // if ('serviceWorker' in navigator) {
    //     navigator.serviceWorker.register('sw.js', {scope: ''})
    //     .then((reg) => {
    //       // registration worked
    //       console.log('Registration succeeded. Scope is ' + reg.scope);
    //     }).catch((error) => {
    //       // registration failed
    //       console.log('Registration failed with ' + error);
    //     });
    //   }


    ////////////////////////////////////////////////////////////////////////////////////////////


    // ROOT
    $(document).on('click', '#btn_getroot', function(e){

        // window.api.get_tree('/')
        this.classList.add('active')
        window.api.get_view('/')

    })

    // DRIVES
    $(document).on('click', '#btn_getdrives', function(e){

        clear_active()
        this.classList.add('active')

        // GET GIO DEVICES
        // window.api.get_gio_devices()

        // window.api.get_tree('/media/michael')

    })

    // HOME
    $(document).on('click', '#home, #tree_home',function(e){

        clear_active()
        this.classList.add('active')
        window.api.get_view(home_folder)

    })


    /* Documents */
    $(document).on('click', '#documents',function(e){
        clear_active()
        this.classList.add('active')
        window.api.get_view(home_folder + '/Documents')
        // get_data(home_folder + '/Documents')

    })

    // DOWNLOADS
    $(document).on('click', '#downloads',function(e){
        e.preventDefault()
        clear_active()
        this.classList.add('active')
        // get_data(home_folder + '/Documents')
        // get_files(home_folder + '/Downloads')
        window.api.get_view(home_folder + '/Downloads')

    })

    // PICTURES
    $(document).on('click', '#pictures',function(e){

        e.preventDefault()

        clear_active()
        this.classList.add('active')
        // get_data(home_folder + '/Pictures')
        window.api.get_view(home_folder + '/Pictures')

    })

    // VIDEO
    $(document).on('click', '#videos',function(e){

        clear_active()
        this.classList.add('active')
        window.api.get_view(home_folder + '/Videos')

    })

    // MUSIC
    $(document).on('click', '#music',function(e){

        clear_active()
        this.classList.add('active')
        window.api.get_view(home_folder + '/Music')

    })

    // DEVICES
    $(document).on('click', '#devices',function(e){

        clear_active()
        this.classList.add('active')
        window.api.get_view('/run/user/1000/gvfs/')

    })


    // NETWORK
    $(document).on('click', '#network',function(e){

        clear_active()
        this.classList.add('active')
        window.api.get_view('/media')

    })


    $(document).on('click', '#btn_network ', function (e) {

        const filters = [
            // {vendorId: 0x1209, productId: 0xa800},
            // {vendorId: 0x1209, productId: 0xa850}
        ];
        navigator.usb.requestDevice({
            acceptAllDevices: true,
            filters: filters
        })
        .then(usbDevice => {
            console.log("Product name: " + usbDevice.productName);
        })
        .catch(e => {
            console.log("There is no device. " + e);
        });

        // console.log('devices length ' + device)

        window.api.get_network()

    })

    // // SHOW SIDE BAR
    // $(document).on('click', '#btn_show_sidebar', function (e){
    //     let sidebar = $('#sidebar')
    //     let main = $('#main')
    //     if(sidebar.width() == 0){
    //         sidebar.width(250)
    //         main.css('margin-left','2880px')
    //         $(this).addClass('active')
    //         localStorage.setItem('sidebar', '1')
    //         localStorage.setItem('sidebar_width', '250px')
    //     }else {
    //         sidebar.width(0)
    //         main.css('margin-left','0px')
    //         $(this).removeClass('active')
    //         localStorage.setItem('sidebar', '0')
    //     }
    // })

    $(document).on('click', '.header_link', function(e) {

        e.preventDefault()

    })

    $(document).on('click','#btn_show_hidden_folders',function(e){

        e.preventDefault()


        let hidden_directory = document.getElementById('hidden_folder_grid')
        let hidden_files = document.getElementById('hidden_file_grid')

        if(hidden_directory.classList.contains('hidden')){

            $(this).addClass('active')

            hidden_directory.classList.remove('hidden')
            hidden_files.classList.remove('hidden')

            localStorage.setItem('show_hidden', 1)

            window.api.get_tree(breadcrumbs.value)

        }else {

            $(this).removeClass('active')

            hidden_directory.classList.add('hidden')
            hidden_files.classList.add('hidden')

            localStorage.setItem('show_hidden', 0)

            window.api.get_tree(breadcrumbs.value)
        }


    })


    // SORT BY DATE
    $(document).on('click', '#sort_by_date', function(e){

        e.preventDefault()

        clear_active()
        this.classList.add('active')

        dir = breadcrumbs.value
        localStorage.setItem('sort', 1)

        let options = {
            sort: 1,
            search: ''
        }

        window.api.get_view(dir)

    })

    // SORT BY NAME
    $(document).on('click', '#sort_by_name', function(e){

        e.preventDefault()

        clear_active()
        this.classList.add('active')

        dir = breadcrumbs.value
        localStorage.setItem('sort', 2)

        let options = {
            sort: 2,
            search: ''
        }

        window.api.get_view(dir)

    })


    // SORT BY SIZE
    $(document).on('click', '#sort_by_size', function(e){

        e.preventDefault()

        clear_active()
        this.classList.add('active')

        dir = breadcrumbs.value
        localStorage.setItem('sort', 3)

        let options = {
            sort: 3,
            search: ''
        }

        window.api.get_view(dir)

    })


    // SORT BY TYPE
    $(document).on('click', '#sort_by_type', function(e){

        e.preventDefault()

        clear_active()
        this.classList.add('active')

        dir = breadcrumbs.value
        localStorage.setItem('sort', 4)

        let options = {
            sort: 4,
            search: ''
        }

        window.api.get_view(dir,options)

    })


})


// ON LOAD
// window.api.get_files(dir,options)


// document.getElementById('btn_show_hidden_folders').addEventListener('click', async () => {
//     await window.darkMode.system()
//     document.getElementById('theme-source').innerHTML = 'System'
// })



// const loader = document.getElementById('loader')
// loader.classList.remove('active')



// let spinner = document.getElementById('spinner')

// let footer = document.createElement('div')
// footer.classList.add('footer')


// FIND
// $(document).on('keydown', '#find, #find_size, #start_date, #end_date', function(e) {

//     // console.log($(this).val())
//     // OPEN SEARCH RESULTS
//     $('.ui.accordion').accordion('close', 0)
//     $('.ui.accordion').accordion('open', 1)

//     // $('#find_options').addClass('hidden')

//     window.api.find_files()

//     // $('#find_options').addClass('hidden')

// })

// $('#find').on('mouseover', function(e) {
//     // $('#find_options').removeClass('hidden')
// })

// $('#find_options').on('mouseover', function (e) {
//     $(this).removeClass('hidden')
// })

// $('#find_options').on('mouseout', function (e) {
//     $(this).addClass('hidden')
// })

// // find.focus()
// find.addEventListener('keyup',function(e){
//     e.preventDefault()

//     // GET CURRENT DIRECTORY
//     dir = breadcrumbs.value

//     // let options = {
//     //     sort: localStorage.getItem('sort'),
//     //     search: this.value
//     // }

//     // OPEN SEARCH RESULTS
//     $('.ui.accordion').accordion('close', 0)
//     $('.ui.accordion').accordion('open', 1)

//     $('#find_options').addClass('hidden')

//     // console.log(this.value + ' ' + dir)
//     // let titles = $('#accordion').find('.title')
//     //  for(let i = 0; i < titles.length; i++){

//     //     console.log(titles[i].innerHTML)
//     //     // if(titles[i].Results'){
//     //         // console.log('wwhwhwhwrhwrhwh')
//     //         // titles[i].addClass.add('active')
//     //     // }
//     //  }

//     window.api.find_files()

//     // window.api.find_files()

// })

// BREADCRUMBS
breadcrumbs.addEventListener('change',function(e){

    e.preventDefault()

    dir = breadcrumbs.value
    localStorage.setItem('folder', dir)

    console.log('setting local storage to ' + dir)

    clear_active()
    window.api.get_view(dir)
})


// HOME
// home.addEventListener('click', function(e){

//     // e.preventDefault()
//     // e.stopImmediatePropagation()

//     // clear_active()

//     // home.classList.add('active')
//     // window.api.get_files(home_folder, options)


// })

// // DOCUMENTS
// documents.addEventListener('click', function(e){
//     e.preventDefault()
//     clear_active()
//     // documents.classList.add('active')
//     // localStorage.setItem('folder', home_folder + '/Documents')
//     // window.api.get_files(home_folder + '/Documents',options)

//     documents.classList.add('active')
//     // localStorage.setItem('folder', home_folder + '/Documents')
//     get_data(home_folder + '/Documents')


// })

// // DOWNLOADS
// downloads.addEventListener('click', function(e){
//     e.preventDefault()
//     clear_active()
//     downloads.classList.add('active')

//     let dir = home_folder + '/Downloads'
//     localStorage.setItem('folder', dir)

//     // console.log(dir)

//     get_data(dir)

//     // localStorage.setItem('folder', home_folder + '/Downloads')
//     // window.api.get_files(home_folder + '/Downloads',options)

// })

// // PICTURES
// pictures.addEventListener('click', function(e){
//     e.preventDefault()
//     clear_active()
//     pictures.classList.add('active')

//     // spinner.classList.add('active')
//     // console.log('spinner active')

//     localStorage.setItem('folder', home_folder + '/Pictures')
//     get_data(home_folder + '/Pictures')

//     // window.api.get_files(home_folder + '/Pictures',options)

//     // spinner.classList.remove('active')

// })

// // VIDEOS
// videos.addEventListener('click', function(e){
//     e.preventDefault()
//     clear_active()
//     videos.classList.add('active')
//     localStorage.setItem('folder', home_folder + '/Videos')
//     window.api.get_files(home_folder + '/Videos', options)
// })

// // MUSIC
// music.addEventListener('click', function(e){
//     e.preventDefault()
//     clear_active()
//     music.classList.add('active')
//     localStorage.setItem('folder', home_folder + '/Music')
//     window.api.get_files(home_folder + '/Music', options)
// })


// // NETWORK
// // devices.addEventListener('click', function(e){

// //     // e.preventDefault()
// //     // clear_active()
// //     // devices.classList.add('active')

// //     // // todo: this needs to be the users home dir name in /media
// //     // localStorage.setItem('folder', '/run/user/1000/gvfs')
// //     // window.api.get_files('/run/user/1000/gvfs', options)

// // })


// // NETWORK
// network.addEventListener('click', function(e){
//     e.preventDefault()
//     clear_active()
//     network.classList.add('active')
//     localStorage.setItem('folder', '/media')
//     window.api.get_files('/media/',options)
// })


// GET TERMINAL
terminal.addEventListener('click', function(e){
    window.api.get_terminal()
})
// const terminal = document.getElementById('terminal')
// if(terminal){

//   terminal.addEventListener('click', function(e){
    // window.api.get_terminal()
//   })

// }


// GO BACK
document.getElementById('left')
.addEventListener('click', function(e){
    e.preventDefault
    window.api.navigate('left')
})

// GO FOWARD
document.getElementById('right')
.addEventListener('click', function(e){
    e.preventDefault
    window.api.navigate('right')
})


// ENABLE / DISABLE DARK
// document.getElementById('dark_mode')
// .addEventListener('click',function(e){
//     let body = document.getElementById('body')
//     if(body.getAttribute('data-theme') == 'dark'){
//         body.setAttribute('data-theme', '')
//     }else{
//         body.setAttribute('data-theme', 'dark')
//     }

// })





$("#main_view").on("selectableselected selectableunselected", function(){
    console.log(running)
    $(".inside").removeClass("yes").addClass("no");
    $(".ui-selected > .inside").removeClass("no").addClass("yes");
});



//
function httpGet(theUrl) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", theUrl, false ); // false for synchronous request
    xmlHttp.send( null );
    return xmlHttp.responseText;
}



// let btn = document.getElementById('btn')
// btn.addEventListener('click',function(e){
//     document.getElementById('footer').innerHTML = 'working'
//     const http = new XMLHttpRequest()
//     const url = '../src/main_view.html'
//     http.open("GET", url)
//     http.send()
//     http.onreadystatechange=(e)=> {
//         document.getElementById('main').innerHTML = http.responseText
//         console.log(http.responseText)
//         window.api.get_files(home_folder, options)
//     }
//     // document.getElementById('footer').innerText = 'w<gowgo[kwgko[wg'
//     // window.api.get_files(breadcrumbs.value,options)
//     // setTimeout(() => {
//     //     document.getElementById('footer').innerText = 'hmoshekothkohstko[drthko[drthko[thdrthpdrthp[rthl'
//     // }, 3000);
// })


// // SHOW HIDDEN FOLDER
// let btn_show_hidden_folders = document.getElementById('btn_show_hidden_folders')
// let hidden_directory = document.getElementById('hidden_folder_grid')
// let hidden_files = document.getElementById('hidden_file_grid')

// btn_show_hidden_folders.addEventListener('click',function(e){

//     if(hidden_directory.classList.contains('hidden')){
//         this.style.backgroundColor = ''
//         hidden_directory.classList.remove('hidden')
//         hidden_files.classList.remove('hidden')

//         localStorage.setItem('show', 1)

//     }else {
//         this.style.backgroundColor = ''
//         hidden_directory.classList.add('hidden')
//         hidden_files.classList.add('hidden')

//         localStorage.setItem('show', 0)
//     }

// })


// // SORT BY NAME
// let sort_by_name = document.getElementById('sort_by_name')
// sort_by_name.addEventListener('click',function(e){
//     e.preventDefault()
//     e.stopPropagation()

//     dir = breadcrumbs.value

//     localStorage.setItem('sort', 2)

//     // console.log('testing')

//     let options = {
//         sort: 2,
//         search: ''
//     }

//     window.api.get_files(dir,options)
// })


// // SORT BY DATE
// let sort_by_date = document.getElementById('sort_by_date')
// sort_by_date.addEventListener('click',function(e){
//     e.preventDefault()

//     dir = breadcrumbs.value
//     localStorage.setItem('sort', 1)

//     let options = {
//     sort: 1,
//     search: ''
//     }

//     window.api.get_files(dir,options)
// })


////////////////////////////////////////////////////////////////////

// window.addEventListener('contextmenu', (e) => {
//     e.preventDefault()
//     ipcRenderer.send('show-context-menu')
//   })

//   ipcRenderer.on('context-menu-command', (e, command) => {
//     // ...
//   })









