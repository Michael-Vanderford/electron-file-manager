const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const copy_write = (source, destination, callback) => {
    // get the stats of the source
    const stats = fs.statSync(source);

    if (stats.isDirectory()) {

        // if it's a directory, create the destination directory if it doesn't exist
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination);
        }

        // list all files and subdirectories in the source directory
        const files = fs.readdirSync(source);
        let count = 0;
        files.forEach((file) => {
            const sourcePath = path.join(source, file);
            const destinationPath = path.join(destination, file);
            copy_write(sourcePath, destinationPath, () => {
                count++;
                if (count === files.length) {
                    return callback('ok');
                }
            });
        });

    } else {

        // if it's a file, copy it to the destination
        const reader = fs.createReadStream(source);
        const writer = fs.createWriteStream(destination);
        reader.pipe(writer);

        // Return a function to cancel the copy process
        cancelCopy = () => {
            reader.destroy();
            writer.destroy();
            callback(new Error('Copy process was cancelled'));
        };

        callback();

    }
};

const { source, destination } = workerData;
copy_write(source, destination, (err) => {
    parentPort.postMessage(err);
});