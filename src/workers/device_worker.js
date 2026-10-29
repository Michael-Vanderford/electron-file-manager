// @ts-nocheck
const { parentPort, isMainThread } = require('worker_threads');
const libfs = require('../common/libfs');
const { probe } = require('../common/device_probe');

class DeviceManager {

    constructor() {


    }

    // Discovery and capacity probes run outside this worker's event loop.
    async discover(operation) {
        this.pending = this.pending || new Set();
        this.cache = this.cache || {};
        this.rescan = this.rescan || new Set();
        if (this.pending.has(operation)) {
            this.rescan.add(operation);
            return;
        }
        this.pending.add(operation);
        try {
            const devices = (await probe(operation)).filter(device => device.name !== 'mtp');
            const reachable = [];
            for (const device of devices) {
                // Unmounted drives must remain available for the Mount action.
                if (!device.path && operation === 'devices') {
                    reachable.push(device);
                    continue;
                }
                try {
                    const stats = await probe('mount_info', device.path);
                    reachable.push({ ...device, ...stats, unavailable: false });
                } catch (error) {
                    // An inaccessible or timed-out mount must not appear in the list.
                }
            }
            this.cache[operation] = reachable;
            parentPort.postMessage({ cmd: operation, [operation]: reachable });
        } catch (error) {
            // Discovery failure cannot verify that cached mounts are still accessible.
            this.cache[operation] = [];
            parentPort.postMessage({ cmd: operation, [operation]: [] });
            parentPort.postMessage({ cmd: 'set_msg', msg: `Device discovery unavailable: ${error.message}` });
        } finally {
            this.pending.delete(operation);
            if (this.rescan.delete(operation)) await this.discover(operation);
        }
    }

    get_mounts() { return this.discover('mounts'); }

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

    get_devices() { return this.discover('devices'); }


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

module.exports = { DeviceManager };
