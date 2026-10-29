// @ts-nocheck
const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const os = require('os');
// const gio = require('../gio/build/Release/gio.node');
const libfs = require('../common/libfs');

async function find (query, location, options) {

    const search_query = typeof query === 'string' ? query.trim() : '';
    const search_location = typeof location === 'string' && location.trim() !== ''
        ? location
        : os.homedir();
    const search_options = normalize_find_options(options);

    if (!search_query) {
        return {
            error: false,
            results: []
        };
    }

    return {
        success: libfs && typeof libfs.find === 'function',
        generator: (libfs && typeof libfs.find === 'function')
            ? libfs.find(search_query, search_location, search_options)
            : null
    };

};

function normalize_find_results(raw_results = []) {
    if (!Array.isArray(raw_results)) {
        return [];
    }

    return raw_results
        .map((item) => {
            if (!item) {
                return null;
            }

            if (typeof item === 'string') {
                try {
                    if (libfs && typeof libfs.get_file === 'function') {
                        const file = libfs.get_file(item);
                        if (file && file.href) {
                            return file;
                        }
                    }
                } catch (err) {
                }
                return {
                    href: item,
                    name: path.basename(item),
                    display_name: path.basename(item),
                    location: path.dirname(item),
                    is_dir: false,
                    content_type: ''
                };
            }

            if (typeof item === 'object') {
                return item;
            }

            return null;
        })
        .filter(Boolean);
}

function normalize_find_options(raw_options = {}) {
    if (!raw_options || typeof raw_options !== 'object' || Array.isArray(raw_options)) {
        return {};
    }

    const options = {};

    if (raw_options.minSize !== undefined) {
        const min_size = Number(raw_options.minSize);
        if (Number.isFinite(min_size) && min_size >= 0) {
            options.minSize = Math.floor(min_size);
        }
    }

    if (raw_options.maxSize !== undefined) {
        const max_size = Number(raw_options.maxSize);
        if (Number.isFinite(max_size) && max_size >= 0) {
            options.maxSize = Math.floor(max_size);
        }
    }

    if (raw_options.dateFrom !== undefined) {
        const date_from = new Date(raw_options.dateFrom);
        if (!Number.isNaN(date_from.getTime())) {
            options.dateFrom = raw_options.dateFrom;
        }
    }

    if (raw_options.dateTo !== undefined) {
        const date_to = new Date(raw_options.dateTo);
        if (!Number.isNaN(date_to.getTime())) {
            options.dateTo = raw_options.dateTo;
        }
    }

    // Add folderDepth support
    if (raw_options.folderDepth !== undefined) {
        const folder_depth = Number(raw_options.folderDepth);
        if (Number.isFinite(folder_depth) && folder_depth >= 0) {
            options.maxDepth = Math.floor(folder_depth);
        }
    }

    return options;
}


async function stream_results(generator, port) {
    let batch = [];
    const flush = async () => {
        const acknowledged = new Promise(resolve => port.once('message', resolve));
        port.postMessage({ cmd: 'find_batch', files: batch });
        batch = [];
        await acknowledged;
    };
    for await (const file of generator) {
        batch.push(file);
        if (batch.length >= 256) await flush();
    }
    if (batch.length) await flush();
}

if (!isMainThread) {

    parentPort.on('message', async (msg) => {

        const cmd = msg.cmd;
        if (cmd === 'find') {

            if (!msg.query || !msg.location) {
                parentPort.postMessage({
                    cmd:'set_msg',
                    err: 'Missing search query or search location'
                })
                return;
            }

            try {
                const result = await find(msg.query, msg.location, msg.options);

                if (result.generator) {
                    await stream_results(result.generator, parentPort);
                    parentPort.postMessage({
                        cmd: 'find_done',
                        err: false
                    });
                } else {
                    parentPort.postMessage({
                        cmd: 'find_results',
                        res: result.results || [],
                        err: result.error
                    });
                }
            } catch (err) {
                parentPort.postMessage({
                    cmd: 'find_error',
                    err: String(err.message || err)
                });
            }
        }
    })

}
module.exports = { stream_results, normalize_find_options };
