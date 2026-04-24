// @ts-nocheck
const { parentPort, workerData, isMainThread } = require('worker_threads');
const gio = require('../gio/build/Release/gio.node');


async function find (query, location, options) {

    const search_query = typeof query === 'string' ? query.trim() : '';
    const search_location = typeof location === 'string' && location.trim() !== ''
        ? location
        : os.homedir();
    const search_options = normalize_find_options(options);
    const has_search_options = Object.keys(search_options).length > 0;

    if (!search_query) {
        return {
            error: false,
            results: []
        };
    }

    return await new Promise((resolve) => {
        const find_callback = (err, res) => {
            // Supports both callback shapes: (results) and (err, results)
            const callback_error =
                err &&
                res === undefined &&
                typeof err !== 'string' &&
                !Array.isArray(err)
                    ? err
                    : null;

            if (callback_error) {
                resolve({
                    error: true,
                    message: String(callback_error.message || callback_error),
                    results: []
                });
                return;
            }

            const raw_results = res === undefined ? err : res;
            resolve({
                error: false,
                results: normalize_find_results(raw_results)
            });
        };

        try {
            if (has_search_options) {
                try {
                    gio.find(search_query, search_location, search_options, find_callback);
                } catch (err) {
                    // Fallback for older gio builds that do not support options.
                    gio.find(search_query, search_location, find_callback);
                }
            } else {
                gio.find(search_query, search_location, find_callback);
            }
        } catch (err) {
            resolve({
                error: true,
                message: String(err.message || err),
                results: []
            });
        }
    });

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
                    const file = gio.get_file(item);
                    if (file && file.href) {
                        return file;
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

    return options;
}


if (!isMainThread) {

    parentPort.on('message', (msg) => {

        const cmd = msg.cmd;
        if (cmd === 'find') {

            if (!msg.query || !msg.location) {
                parentPort.postMessage({
                    cmd:'set_msg',
                    err: 'Missing search query or search location'
                })
                return;
            }

            find(msg.query, msg.location, msg.options).then((res) => {

                parentPort.postMessage({
                    cmd: 'find_results',
                    res: res.results,
                    err: res.error
                })

            })


        }


    })


}