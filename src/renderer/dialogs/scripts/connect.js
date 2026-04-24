// @ts-nocheck
const { contextBridge, ipcRenderer } = require('electron');

function add_div(classlist = []) {
    let div = document.createElement('div');
    if (classlist.length > 0) {
        for (let i = 0; i < classlist.length; i++) {
            div.classList.add(classlist[i]);
        }
    }
    return div;
}

// Connect to Network
ipcRenderer.on('connect', (e) => {

    // Init
    let cmd = '';
    let connect = document.querySelector('.connect')
    let chk_pk = document.getElementById('chk_pk')
    let btn_connect = document.getElementById('button_connect')
    let btn_close = document.getElementById('button_close')
    let password = document.getElementById('txt_password')
    let mount_point = document.getElementById('txt_mount_point');
    let mount_point_div = document.querySelector('.mount_point_div');
    let connection_type = document.getElementById('connection_type');
    let msg_connect = document.querySelector('.msg_connect');
    let server = document.getElementById('txt_server');
    let username = document.getElementById('txt_username');
    let use_ssh_key = document.getElementById('chk_pk');
    let save_connection = document.getElementById('chk_save_connection');

    function updateCredentialInputs() {
        const isSshConnection = connection_type.value === 'ssh' || connection_type.value === 'sshfs';
        const usesSshKey = isSshConnection && chk_pk.checked;

        username.disabled = usesSshKey;

        if (usesSshKey) {
            password.disabled = true;
            password.classList.add('hidden');
        } else {
            password.disabled = connection_type.value !== 'smb';
            if (password.disabled) {
                password.classList.add('hidden');
            } else {
                password.classList.remove('hidden');
            }
        }
    }

    function validateRequiredInput(input) {
        if (!input || input.disabled) {
            return true;
        }

        if ((input.value || '').trim() !== '') {
            return true;
        }

        input.focus();
        msg_connect.classList.replace('msg_connect', 'msg_connect_error');
        msg_connect.innerHTML = `${input.placeholder} Required.`;
        return false;
    }

    btn_connect.tabIndex = 1

    connect.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            window.close()
        }
    })

    btn_close.onclick = (e) => {
        window.close()
    }

    password.disabled = true;
    password.classList.add('hidden');

    chk_pk.onchange = () => {
        updateCredentialInputs();
    }

    connection_type.addEventListener('change', (e) => {
        if (connection_type.value === 'sshfs') {
            msg_connect.innerHTML = `! Using sshfs requires sshfs be installed.`
            mount_point_div.classList.remove('hidden');
            chk_pk.disabled = false;
            chk_pk.checked = true;
        } else if (connection_type.value === 'smb') {
            msg_connect.innerHTML = '';
            mount_point_div.classList.remove('hidden');
            chk_pk.disabled = true;
            chk_pk.checked = false;
        } else {
            msg_connect.innerHTML = '';
            mount_point_div.classList.add('hidden');
            chk_pk.disabled = false;
        }

        updateCredentialInputs();
    })

    if (connection_type.value === 'sshfs') {
        msg_connect.innerHTML = `! Using sshfs requires sshfs be installed.`
    }

    btn_connect.addEventListener('click', (e) => {

        e.preventDefault();

        let str_server = "";
        const requiredInputs = [server];
        const requiresMountPoint = !mount_point_div.classList.contains('hidden');
        const requiresCredentials = connection_type.value === 'smb' || !use_ssh_key.checked;

        if (requiresMountPoint) {
            requiredInputs.push(mount_point);
        }

        if (requiresCredentials) {
            requiredInputs.push(username);
            if (connection_type.value === 'smb') {
                requiredInputs.push(password);
            }
        }

        const state = requiredInputs.every(validateRequiredInput) ? 1 : 0;

        // Output
        if (state == 1) {

            msg_connect.classList.replace('msg_connect_error', 'msg_connect');
            msg_connect.innerHTML = `Connecting to ${server.value}`;

            str_server = server.value.trim();

            let cmd = {
                type: connection_type.value,
                server: str_server,
                mount_point: mount_point.value,
                username: username.disabled ? '' : username.value.trim(),
                password: password.disabled ? '' : password.value,
                use_ssh_key: use_ssh_key.checked,
                save_connection: save_connection.checked
            }

            ipcRenderer.invoke('connect', cmd).then(res => {
                if (!res) {
                    return;
                }
                if (res.error) {
                    msg_connect.classList.add('msg_connect_error');
                    msg_connect.classList.remove('msg_connect_success');
                } else {
                    msg_connect.classList.add('msg_connect_success');
                    msg_connect.classList.remove('msg_connect_error');
                }
                msg_connect.innerHTML = res.msg || '';
            })



        }

        // console.log(conntection_type.value);

    })

    // Create the popup element
    const popup = document.createElement('div');
    popup.classList.add('autocomplete-popup'); // Add a CSS class for styling

    let val0 = mount_point.value;
    // console.log('val', val0)
    mount_point.addEventListener('input', (e) => {

        // console.log(e.key)

        if (e.key !== 'Backspace') {
            let val = e.target.value;

            ipcRenderer.invoke('autocomplete', val).then(res => {

                if (res.length > 0 && val0 !== val) {

                    // console.log('res', res)

                    this.autocomplete_idx = 0;
                    popup.innerHTML = '';
                    res.forEach((dir, i) => {
                        const menu_item = add_div(['item']);
                        menu_item.textContent = dir;
                        popup.append(menu_item);

                        menu_item.addEventListener('click', (e) => {
                            // viewManager.getView(dir);
                            popup.remove();
                        })

                        if (i === 0) {
                            menu_item.classList.add('highlight_select');
                        }

                    })

                    // Determine position based on space below and above
                    const windowHeight = window.innerHeight;
                    const popupHeight = popup.offsetHeight;
                    const triggerElement = mount_point;
                    const triggerRect = triggerElement.getBoundingClientRect();
                    const triggerTop = triggerRect.top;
                    const spaceBelow = windowHeight - (triggerTop + triggerRect.height);
                    const spaceAbove = triggerTop;
                    popup.style.top = triggerTop + triggerRect.height + 5 + 'px';
                    popup.style.left = triggerRect.left + 'px';

                    // Append the popup to the body
                    mount_point_div.append(popup);

                }

            })

        }

    })

    popup.addEventListener('mouseleave', (e) => {
        popup.remove();
    })

    let autocomplete_idx = 0;
    mount_point.addEventListener('keydown', (e) => {

        let suggestions = popup.querySelectorAll('.item');

        switch (e.key) {
            case 'ArrowDown': {

                autocomplete_idx = (autocomplete_idx + 1) % suggestions.length;
                for (let i = 0; i < suggestions.length; i++) {
                    if (i === autocomplete_idx) {
                        suggestions[i].classList.add('highlight_select');
                        mount_point.value = suggestions[i].innerText;
                    } else {
                        suggestions[i].classList.remove('highlight_select');
                    }
                }

                break
            }
            case 'ArrowUp': {

                autocomplete_idx = (autocomplete_idx - 1 + suggestions.length) % suggestions.length;
                for (let i = 0; i < suggestions.length; i++) {
                    if (i === autocomplete_idx) {
                        suggestions[i].classList.add('highlight_select');
                        mount_point.value = suggestions[i].innerText;
                    } else {
                        suggestions[i].classList.remove('highlight_select');
                    }
                }

                break;
            }
            case 'Enter': {
                // clearTimeout(this.timeout_id);
                if (suggestions.length > 0) {
                    suggestions.forEach(item => {
                        if (item.classList.contains('highlight_select')) {
                            popup.remove();
                        } else {
                            popup.remove();
                        }
                    })
                    popup.remove();
                } else {
                }
                break;
            }
            case 'Escape': {
                mount_point.value = val0;
                popup.remove();
                break;
            }
            case 'Tab': {
                if (suggestions.length > 0) {
                    e.preventDefault();
                    for (let i = 0; i < suggestions.length; i++) {
                        if (suggestions[i].classList.contains('highlight_select')) {
                            mount_point.value = suggestions[i].innerText;
                            popup.innerHTML = '';
                            popup.remove();
                            break;
                        }
                    }
                }
                break;
            }

        }

    })

    connection_type.dispatchEvent(new Event('change'));
})

// Connect to network message
ipcRenderer.on('msg_connect', (e, data) => {
    let msg_connect = document.querySelector('.msg_connect');
    if (data.error) {
        msg_connect.classList.add('msg_connect_error');
        msg_connect.classList.remove('msg_connect_success');
    } else {
        msg_connect.classList.add('msg_connect_success');
        msg_connect.classList.remove('msg_connect_error');
    }
    msg_connect.innerHTML = data.msg;

})