// @ts-nocheck
const { parentPort, workerData, isMainThread } = require('worker_threads');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
// const gio = require('../gio/build/Release/gio.node');
const libfs = require('../common/libfs');

class DeviceManager {

    constructor() {


    }

    // Get Mounts
    get_mounts() {

        // gio.umount("michael.vanderford@gmail.com", (err, res) => {
        //     console.log('umount res', err, res);
        // });

        libfs.get_mounts((err, mounts) => {
            if (err) {
                // console.log('error getting mounts', err);
                parentPort.postMessage({
                    cmd: 'set_msg',
                    msg: `Error: get_mounts ${err}`
                });
                return;
            }

            // get total, used, free for disk space
            for (let i = 0; i < mounts.length; i++) {

                // Network mount stats can perform remote I/O. An unavailable
                // server must not delay discovery of the other devices.
                if ((mounts[i].type || '').toLowerCase() === 'network' || /\/gvfs\//i.test(mounts[i].path || '')) {
                    continue;
                }

                if (!fs.existsSync(mounts[i].path)) {
                    console.log(`mount path does not exist: ${mounts[i].path}`);
                    continue;
                }

                try {
                    // add disk stats to mounts array
                    Object.assign(mounts[i], libfs.disk_stats(mounts[i].path));
                    // const stats = gio.disk_stats(mounts[i].path);
                    // mounts[i].total = stats.total;
                    // mounts[i].used = stats.used;
                    // mounts[i].free = stats.free;
                } catch (err) {
                    console.log(`error getting mount stats ${err}`);
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: `Error: get_mounts stats ${err}`
                    });
                }

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
        libfs.mount(device, (err) => {
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
        libfs.umount(device, (err) => {
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

        libfs.get_drives((err, data_arr) => {
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
                // GIO network mount paths are URIs. Querying filesystem stats
                // for an offline server can block the worker long enough that
                // no device list is sent at all. Keep the mount visible and
                // leave its capacity unknown until it is reachable.
                if (/^(smb|sftp|ftp|dav|davs):\/\//i.test(filter_arr[i].path || '')) {
                    continue;
                }
                try {
                    Object.assign(filter_arr[i], libfs.disk_stats(filter_arr[i].path));
                } catch (err) {
                    console.log(`error getting device stats ${err}`);
                    parentPort.postMessage({
                        cmd: 'set_msg',
                        msg: `Error: get_device stats ${err}`
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
