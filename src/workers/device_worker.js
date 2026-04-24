const { parentPort, workerData, isMainThread } = require('worker_threads');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const gio = require('../gio/build/Release/gio.node');

class DeviceManager {

    constructor() {


    }

    // Get Mounts
    get_mounts() {

        // gio.umount("michael.vanderford@gmail.com", (err, res) => {
        //     console.log('umount res', err, res);
        // });

        gio.get_mounts((err, mounts) => {
            if (err) {
                // console.log('error getting mounts', err);
                parentPort.postMessage({
                    cmd: 'set_msg',
                    msg: `Error: get_mounts ${err}`
                });
                return;
            }

            let mount_arr = mounts
            let cmd = {
                cmd: 'mounts',
                mounts: mount_arr
            }
            // console.log('mounts data', mount_arr);
            parentPort.postMessage(cmd);
        })

    }

    // Mount device
    mount(device) {
        console.log('mounting device', device);
        gio.mount(device, (err) => {
            if (err) {
                console.log('error mounting device', err);
                parentPort.postMessage({
                    cmd: 'set_msg',
                    msg: `Error: mount ${err}`
                });
                return;
            }
            parentPort.postMessage({
                cmd: 'mount_done',
                msg: `Mounted ${device.name} successfully`
            });
            // console.log('mount res', res);
        });
    }

    // Unmount device
    umount(device) {
        gio.umount(device, (err) => {
            if (err) {
                console.log('error unmounting device', err);
                parentPort.postMessage({
                    cmd: 'set_msg',
                    msg: `Error: umount ${err}`
                });
                return;
            }
            // console.log('umount res', res);
        });
    }

    // Get drives
    get_devices() {

        gio.get_drives((err, data_arr) => {
            if (err) {
                console.log('error getting drives', err);
                parentPort.postMessage({
                    cmd: 'set_msg',
                    msg: `Error: get_devices getting drives ${err}`
                });
                return;
            }
            let filter_arr = data_arr.filter(x => x.name != 'mtp')

            console.log(filter_arr);

            for (let i = 0; i < filter_arr.length; i++) {
                try {
                    if (filter_arr[i].path.indexOf('file://') > -1) {
                        filter_arr[i].path = filter_arr[i].path.replace('file://', '');
                        let cmd = `df "${filter_arr[i].path}"`;
                        let size = execSync(cmd).toString().split('\n')[1].split(' ').filter(x => x !== '').slice(1, 4).join(' ');
                        filter_arr[i].size_total = size.split(' ')[0];
                        filter_arr[i].size_used = size.split(' ')[1];
                    }
                } catch (err) {
                    console.log(`error getting devices ${err}`);
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: `Error: get_devices ${err}`
                    });
                }
            }

            let cmd = {
                cmd: 'devices',
                devices: filter_arr
            }
            parentPort.postMessage(cmd);
        })

    }


}

const deviceManager = new DeviceManager();

if (!isMainThread) {

    parentPort.on('message', (data) => {
        const cmd = data.cmd;
        switch (cmd) {
            case 'get_devices':
                deviceManager.get_devices();
                break;
            case 'get_mounts':
                deviceManager.get_mounts();
                break;
            case 'mount':
                deviceManager.mount(data.device_path);
                break;
            case 'umount':
                deviceManager.umount(data.device_path);
            default:
                break;
        }
    });

}
