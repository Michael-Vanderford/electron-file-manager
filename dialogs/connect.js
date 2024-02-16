const { contextBridge, ipcRenderer } = require('electron');

// Connect to Network
ipcRenderer.on('connect', (e) => {

    // Init
    let cmd = '';
    let connect = document.querySelector('.connect')
    let chk_pk = document.getElementById('chk_pk')
    let btn_connect = document.getElementById('button_connect')
    let btn_close = document.getElementById('button_close')
    let password = document.getElementById('txt_password')
    btn_connect.tabIndex = 1

    connect.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            window.close()
        }
    })

    btn_close.onclick = (e) => {
        window.close()
    }

    chk_pk.onchange = () => {
        if (chk_pk.checked) {
            password.disabled = true
        } else {
            password.disabled = false
        }
    }

    btn_connect.onclick = (e) => {

        e.preventDefault()

        // Inputs
        let state = 0;
        let conntection_type = document.getElementById('connection_type');
        let mount_point = document.getElementById('txt_mount_point');
        let server = document.getElementById('txt_server');
        let username = document.getElementById('txt_username');
        let password = document.getElementById('txt_password');
        let use_ssh_key = document.getElementById('chk_pk');

        let str_server = "";
        let use_key = 0;


        let connect_msg = document.getElementById('connect_msg');
        connect_msg.innerHTML = `Connecting to ${server.value}`;

        // Process
        let inputs = [].slice.call(document.querySelectorAll('.input, .checkbox'))

        inputs.every(input => {

            if (input.value == '' && input.disabled == false) {
                connect_msg.innerHTML = `${input.placeholder} Required.`
                state = 0;
                return false
            } else {
                state = 1
                return true
            }

        })

        // Output
        if (state == 1) {

            if (conntection_type.value === 'sshfs') {
                str_server = server.value
            } else if (conntection_type.value === 'ssh') {
                // cmd = `echo '${password.value}' | gio mount ssh://${username.value}@${server.value}`
                str_server = `sftp://${server.value}`
            } else if (conntection_type.value === 'smb') {
                // cmd = `echo '${username.value}\n${'workgroup'}\n${password.value}\n' | gio mount smb://${server.value}`
                str_server = `smb://${server.value}`
            }

            if (use_ssh_key.checked) {
                use_key = 1;
            }

            let cmd = {
                type: conntection_type.value,
                server: str_server,
                mount_point: mount_point.value,
                username: username.value,
                password: password.value,
                use_ssh_key: use_key,
            }

            ipcRenderer.invoke('connect', cmd).then(res => {
                console.log(res)
                if (res === 1) {
                    // console.log('connection success')
                    connect_msg.style.color = 'green';
                    connect_msg.innerHTML = `Connected to ${conntection_type[conntection_type.options.selectedIndex].text} Server.`;
                } else {
                    connect_msg.innerHTML = res;
                }
            })

            // exec(cmd, (err, stdout, stderr) => {
            //     if (!err) {
            //         connect_msg.style.color = 'green';
            //         connect_msg.innerHTML = `Connected to ${conntection_type[conntection_type.options.selectedIndex].text} Server.`;

            //     } else {
            //         if (stderr) {
            //             connect_msg.innerHTML = stderr;
            //         }
            //     }
            // })
        }
        // console.log(conntection_type.value);
    }
})

// Connect to network message
ipcRenderer.on('msg_connect', (e, msg) => {
    console.log('running msg connect');
    let connect_msg = document.querySelector('.connect_msg');
    connect_msg.innerHTML = msg;
})