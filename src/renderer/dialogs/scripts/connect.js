// @ts-nocheck
const { ipcRenderer } = require('electron');

ipcRenderer.on('theme-preference-changed', (_event, preference, system_theme) => {
    const root = document.documentElement;
    const theme = ['dark', 'light', 'modern-dark', 'modern-light'].includes(String(preference).toLowerCase())
        ? String(preference).toLowerCase()
        : null;
    if (theme) root.dataset.theme = theme;
    else delete root.dataset.theme;
    root.classList.toggle('theme-dark', !theme && system_theme === 'dark');
    root.classList.toggle('theme-light', !theme && system_theme === 'light');
});

ipcRenderer.once('connect', () => {
    const form = document.getElementById('connection_form');
    const field = id => document.getElementById(id);
    const type = field('connection_type');
    const server = field('txt_server');
    const username = field('txt_username');
    const password = field('txt_password');
    const save = field('chk_save_connection');
    const reconnect = field('chk_auto_reconnect');
    const status = field('connect_msg');
    const submit = field('button_connect');
    const cancel = field('button_cancel');
    let pending = false;
    let closing = false;
    function message(text, error = false) {
        status.classList.toggle('msg_connect_error', error);
        status.classList.toggle('msg_connect_success', !error && !pending);
        status.textContent = text;
    }
    function update() {
        const ssh = ['ssh', 'sftp'].includes(type.value);
        const nfs = type.value === 'nfs';
        field('username_fields').hidden = nfs;
        field('password_fields').hidden = ssh || nfs;
        field('key_fields').hidden = !ssh;
        for (const input of form.querySelectorAll('input, select')) input.disabled = pending;
        field('button_close').disabled = false;
        cancel.disabled = false;
        cancel.hidden = !pending;
        username.disabled = pending || nfs;
        password.disabled = pending || ssh || nfs;
        username.required = type.value === 'smb';
        password.required = type.value === 'smb';
        field('chk_pk').checked = ssh;
        field('chk_pk').disabled = true;
        reconnect.disabled = pending || !save.checked;
        if (!save.checked) reconnect.checked = false;
        form.setAttribute('aria-busy', String(pending));
        submit.value = pending ? 'Connecting…' : 'Connect';
        const help = {
            ssh: 'Example: server.local:2222/home/user. Port and remote path are optional. Use an SSH key installed on the server; username is optional.',
            ftp: 'Example: server.local:21/files. Port and remote path are optional. FTP sends credentials and files without transport encryption.',
            smb: 'Example: server.local:445/share. Port is optional. GVFS manages the local mount location.',
            nfs: 'Example: server.local:2049/export/path. Port is optional. Access uses your system identity; no username or password is sent.',
            davs: 'Example: cloud.example.com:8443/files. Port and remote path are optional. Certificate validation stays enabled. Credentials are optional for public shares.',
            dav: 'Example: server.local:8080/files. HTTP sends credentials and files without transport encryption. Use HTTPS when available.'
        };
        field('protocol_help').textContent = help[type.value];
        server.placeholder = { ssh: 'server.local:2222/home/user', smb: 'server.local/share',
            ftp: 'server.local:21/files', nfs: 'server.local/export/path', davs: 'cloud.example.com:8443/files', dav: 'server.local:8080/files' }[type.value];
    }
    type.addEventListener('change', () => { message(''); update(); });
    save.addEventListener('change', update);
    field('button_close').onclick = () => { closing = true; window.close(); };
    document.addEventListener('keyup', event => {
        if (event.key === 'Escape') { event.preventDefault(); closing = true; window.close(); }
    });
    cancel.onclick = async () => {
        try { await ipcRenderer.invoke('cancel_connect'); }
        catch (_) { if (!closing) message('Unable to cancel the connection.', true); }
    };
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (pending || !form.reportValidity()) return;
        const ssh = ['ssh', 'sftp'].includes(type.value);
        const settings = { type: type.value, server: server.value.trim(),
            username: username.disabled ? '' : username.value.trim(), password: password.disabled ? '' : password.value,
            use_ssh_key: ssh, save_connection: save.checked, auto_reconnect: save.checked && reconnect.checked };
        pending = true; update(); message(`Connecting to ${settings.server}…`);
        try {
            const result = await ipcRenderer.invoke('connect', settings);
            if (!closing) { pending = false; message(result?.msg || 'No connection result was returned.', !result || result.error); }
        } catch (_) {
            if (!closing) { pending = false; message('Unable to request a connection. Please try again.', true); }
        } finally {
            pending = false;
            if (!closing) { update(); submit.focus(); }
        }
    });
    update(); server.focus();
});
