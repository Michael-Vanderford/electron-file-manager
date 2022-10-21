let options = {
    sort: 1,
    search: ''
}

let find            = document.getElementById('find')
let breadcrumbs     = document.getElementById('breadcrumbs')
let home            = document.getElementById('home')
let documents       = document.getElementById('documents')
let downloads       = document.getElementById('downloads')
let pictures        = document.getElementById('pictures')
let videos          = document.getElementById('videos')
let music           = document.getElementById('music')
let devices         = document.getElementById('devices')
let network         = document.getElementById('network')
let footer          = document.getElementById('footer')
let btn_disk_usage  = document.getElementById('btn_disk_usage')
let minibar         = document.getElementById('minibar')
let minibar_items   = minibar.querySelectorAll('.item')

// TOGGLE VIEWS
let btn_settings_view   = document.getElementById('btn_settings_view')
let btn_list_view       = document.getElementById('btn_list_view')
let btn_grid_view       = document.getElementById('btn_grid_view')
let btn_disk_view       = document.getElementById('btn_disk_view')

// VIEWS
let main_view       = document.getElementById('main_view');
let list_view       = document.getElementById('list_view')
let grid_view       = document.getElementById('grid_view')
let info_view       = document.getElementById('info_view')

let home_folder     = window.api.get_home()

if (localStorage.getItem('folder') == '') {
    localStorage.setItem('folder', home_folder)
}

// HANDLES HEADER MENU //////////////////////////////////////////
function clear_active() {

    let header_menu = $('#header_menu, .item')
    header_menu.removeClass('active')
}

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
let sidebar_width = '250'
if (localStorage.getItem('sidebar_width')) {
    sidebar_width = localStorage.getItem('sidebar_width')
    main_view.style = 'margin-left:' + sidebar_width
} else {
    element.width = sidebar_width
    main_view.style = 'margin-left:' + sidebar_width
}

//
if (element) {

    let resizer = document.getElementById('draghandle')

    // resizer.style.width = '5px'
    resizer.style.height = ''
    element.appendChild(resizer)
    resizer.addEventListener('mousedown', initResize, false)

}

/* Init resize sidebar */
function initResize(e) {

    window.addEventListener('mousemove', Resize, false);
    window.addEventListener('mouseup', stopResize, false);

    // let items = document.querySelectorAll('#sidebar .')
    let sidebar = document.getElementById('sidebar')
    let iframe = sidebar.querySelector('iframe')

    sidebar.classList.add()

    $('#main_view, #sidebar iframe').addClass('marginLeft');
    $('#main_view, #sidebar').addClass('margin-left');

}

/* Resize sidebar */
function Resize(e) {
    element.style.width = (e.clientX - element.offsetLeft) + 'px';
    main_view.style.marginLeft = (e.clientX - (element.offsetLeft - 40)) + 'px'
}

/* Stop resize of sidebar */
function stopResize(e) {
    console.log('running')
    window.removeEventListener('mousemove', Resize, false);
    window.removeEventListener('mouseup', stopResize, false);
    localStorage.setItem('sidebar_width', element.clientWidth);
}

/* Clear minibar highlight */
function clear_minibar() {
    minibar_items.forEach(item => {
        item.style = '';
    })
}

/* Update sidebar_items */
minibar_items.forEach(item => {
    item.addEventListener('click', (e) => {
        clear_minibar();
        item.style = 'color: #ffffff !important; font-weight:bold;';
        localStorage.setItem('minibar', item.id)
        switch (item.id) {
            case 'mb_home':
                window.api.get_sidebar_files(window.api.get_home());
                break;
            case 'mb_workspace':
                window.api.get_workspace();
                break;
            case 'mb_find':
                window.api.find_files()
                break;
            case 'mb_fs':
                window.api.get_sidebar_files('/');
                break;
            case 'mb_devices':
                window.api.get_devices();
                break;
            case 'mb_info':
                window.api.get_info();
                break;

        }
    })
});

let active_minibar_item = localStorage.getItem('minibar')
if (active_minibar_item == null) {
    localStorage.setItem('minibar', 'mb_home')
    document.querySelector('#mb_home').style = 'color: #ffffff !important; font-weight:bold;';
    window.api.get_sidebar_files(window.api.get_home());
} else {
    document.querySelector('#' + active_minibar_item).style = 'color: #ffffff !important; font-weight:bold;';

    console.log(active_minibar_item)

    switch (active_minibar_item) {
        case 'mb_home':
            window.api.get_sidebar_files(window.api.get_home());
            break;
        case 'mb_workspace':
            // window.api.get_workspace();
            window.api.get_workspace();
            break;
        case 'mb_find':
            window.api.find_files()
            break;
        case 'mb_fs':
            window.api.get_sidebar_files('/');
            break;
        case 'mb_devices':
            window.api.get_devices();
            break;
        case 'mb_info':
            window.api.get_info();
            break;

    }
}

// Settings View
btn_settings_view.addEventListener('click', (e) => {
    // localStorage.setItem('view', 'settings');
    window.api.get_settings_view();
})

/* List view */
btn_list_view.addEventListener('click', (e) => {

    e.preventDefault()

    localStorage.setItem('view', 'list');
    window.api.get_view(localStorage.getItem('folder'));

    btn_list_view.classList.add('active')
    btn_grid_view.classList.remove('active')

})

// ICON VIEW
btn_grid_view.addEventListener('click', (e) => {

    e.preventDefault();

    localStorage.setItem('view', 'grid');
    window.api.get_view(localStorage.getItem('folder'));
    btn_list_view.classList.remove('active')
    btn_grid_view.classList.add('active')

})

btn_disk_view.addEventListener('click', (e) => {
    e.preventDefault()
    localStorage.setItem('view', 'disk_summary');
    window.api.get_view(localStorage.getItem('folder'));
    this.classList.add('active')
})

// LOAD FILES
window.api.get_view(localStorage.getItem('folder'))


$(function() {

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

    if (!localStorage.getItem('folder')) {
        localStorage.setItem('folder', home_folder)
    }

    // // LOAD FILES
    // window.api.get_view(localStorage.getItem('folder'))



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

    $(document).on('click', '.header_link', function(e) {

        e.preventDefault()

    })

    let btn_show_hidden_folders = document.getElementById('btn_show_hidden_folders')
    btn_show_hidden_folders.onclick = (e) => {

        // e.preventDefault()

        let hidden_directory = document.getElementById('hidden_folder_grid')
        let hidden_files = document.getElementById('hidden_file_grid')

        if(hidden_directory.classList.contains('hidden')){

            btn_show_hidden_folders.classList.add('active')

            hidden_directory.classList.remove('hidden')
            hidden_files.classList.remove('hidden')

            localStorage.setItem('show_hidden', 1)

            if (localStorage.getItem('minibar') == 'mb_home') {
                window.api.get_sidebar_files(breadcrumbs.value)
            }

            // window.api.get_sidebar_files(breadcrumbs.value)

        }else {

            btn_show_hidden_folders.classList.remove('active')

            hidden_directory.classList.add('hidden')
            hidden_files.classList.add('hidden')

            localStorage.setItem('show_hidden', 0)

            if (localStorage.getItem('minibar') == 'mb_home') {
                window.api.get_sidebar_files(breadcrumbs.value)
            }

        }
    }

    // SORT BY DATE
    $(document).on('click', '#sort_by_date', function(e){

        e.preventDefault();
        clear_active();
        this.classList.add('active');

        dir = breadcrumbs.value;
        localStorage.setItem('sort', 1);

        let sort_direction = localStorage.getItem('sort_direction');
        console.log('sort_direction', sort_direction)
        if (sort_direction === 'desc') {;
            localStorage.setItem('sort_direction', 'asc');
        } else {
            localStorage.setItem('sort_direction', 'desc');
        }

        window.api.get_view(dir);

    })

    // SORT BY NAME
    $(document).on('click', '#sort_by_name', function(e){

        e.preventDefault()

        clear_active()
        this.classList.add('active')

        dir = breadcrumbs.value
        localStorage.setItem('sort', 2)

        let sort_direction = localStorage.getItem('sort_direction');
        if (sort_direction === 'desc') {;
            localStorage.setItem('sort_direction', 'asc');
        } else {
            localStorage.setItem('sort_direction', 'desc');
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

        let sort_direction = localStorage.getItem('sort_direction');
        if (sort_direction === 'desc') {;
            localStorage.setItem('sort_direction', 'asc');
        } else {
            localStorage.setItem('sort_direction', 'desc');
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

        let sort_direction = localStorage.getItem('sort_direction');
        if (sort_direction === 'desc') {;
            localStorage.setItem('sort_direction', 'asc');
        } else {
            localStorage.setItem('sort_direction', 'desc');
        }

        window.api.get_view(dir)

    })


})

breadcrumbs.addEventListener('keydown', (e) => {
    if (e.key == 'Enter') {
        window.api.get_view(breadcrumbs.value);
    }
})


// GET TERMINAL
terminal.addEventListener('click', function(e){
    window.api.get_terminal()
})

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









